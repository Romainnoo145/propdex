"""Rechtspraak Open Data API client.

Provides access to Dutch court rulings (jurisprudentie) from data.rechtspraak.nl.
Searches are automatically filtered to the omgevingsrecht domain (bestuursrecht).

XML parsing uses lxml with XXE protection (resolve_entities=False, no_network=True).
Rate limiting uses the APIRateLimiter singleton from rate_limiter.py.
"""

import logging
import re

import httpx
from lxml import etree

from app.government_apis.base import (
    APITimeoutError,
    GovernmentAPIError,
    retry_with_backoff,
)
from app.government_apis.ecli_registry import get_owms_uri
from app.government_apis.rate_limiter import rechtspraak_limiter

logger = logging.getLogger(__name__)

# Module-level XXE-safe XML parser singleton
_parser = etree.XMLParser(resolve_entities=False, no_network=True, remove_comments=True)

# API endpoints
SEARCH_URL = "https://data.rechtspraak.nl/uitspraken/zoeken"
CONTENT_URL = "https://data.rechtspraak.nl/uitspraken/content"

# Namespaces
ATOM_NS = "http://www.w3.org/2005/Atom"

# Omgevingsrecht subject URI — the precise rechtsgebied sub-tag.
OMGEVINGSRECHT_URI = "http://psi.rechtspraak.nl/rechtsgebied#bestuursrecht_omgevingsrecht"

# Broad bestuursrecht subject URI. Rechtbanken massively UNDER-apply the
# omgevingsrecht sub-tag (e.g. Rechtbank Limburg: only 181 rulings carry
# #bestuursrecht_omgevingsrecht vs 3746 under #bestuursrecht), so court-scoped
# ingestion searches the broad domain and post-filters on omgevingsrecht
# relevance keywords (see is_omgevingsrecht_relevant). This keeps RECHT-01's
# intent — only omgevingsrecht rulings are ever cached/shown — while no longer
# missing ~95% of relevant rulings. NOTE: the Raad van State DOES tag
# omgevingsrecht reliably (9841 rulings) and its #bestuursrecht set is dominated
# by vreemdelingenrecht (97k), so RVS must keep using OMGEVINGSRECHT_URI.
BESTUURSRECHT_URI = "http://psi.rechtspraak.nl/rechtsgebied#bestuursrecht"

# Omgevingsrecht relevance keywords, matched (case-insensitively) against a
# ruling's title + summary. The modern Rechtspraak Atom feed populates summaries
# for ~100% of rulings across all years, so this metadata filter is reliable and
# avoids fetching full documents for irrelevant rulings. Tuned against Rechtbank
# Limburg: 1016/3746 bestuursrecht rulings match (~27%); the excluded remainder
# is genuinely non-omgevingsrecht (Opiumwet-woningsluiting, bijstand, WOZ, BRP,
# ambtenarenrecht, Wob, Leerplichtwet, vreemdelingenrecht).
OMGEVINGSRECHT_KEYWORDS: tuple[str, ...] = (
    "omgevingsvergunning",
    "omgevingswet",
    "omgevingsplan",
    "bestemmingsplan",
    "wabo",
    "algemene bepalingen omgevingsrecht",
    "ruimtelijke ordening",
    "ruimtelijke onderbouwing",
    "ruimtelijke",
    "planologisch",
    "bouwvergunning",
    "bouwwerk",
    "bouwplan",
    "bouwbesluit",
    "bouwkavel",
    "het bouwen",
    "het verbouwen",
    "dakkapel",
    "dakopbouw",
    "aanbouw",
    "bijgebouw",
    "erfafscheiding",
    "wet natuurbescherming",
    "natuurvergunning",
    "stikstof",
    "pas-melder",
    "wet milieubeheer",
    "milieuvergunning",
    "exploitatieplan",
    "welstand",
    "beheersverordening",
    "buitenplanse",
    "vergunningvrij",
    "kruimelgeval",
    "principebesluit",
    "in strijd met het bestemmingsplan",
    "afwijking van het bestemmingsplan",
    "wijzigingsplan",
    "uitwerkingsplan",
    "voorbereidingsbesluit",
    "projectafwijking",
    "planschade",
    "kamergewijze",
    "kamerverhuur",
    "kamerbewoning",
    "woningsplitsing",
    "woningonttrekking",
    "huisvestingsvergunning",
    "inrit",
    "uitweg",
)

_OMGEVINGSRECHT_RE = re.compile(
    "|".join(re.escape(k) for k in OMGEVINGSRECHT_KEYWORDS), re.IGNORECASE
)


def is_omgevingsrecht_relevant(title: str, summary: str) -> bool:
    """Return True if a ruling's metadata indicates the omgevingsrecht domain.

    Used to post-filter broad #bestuursrecht court searches down to omgevingsrecht
    without fetching every full document. Matches OMGEVINGSRECHT_KEYWORDS against
    the combined title + summary.
    """
    return bool(_OMGEVINGSRECHT_RE.search(f"{title} {summary}"))


# ECLI format: ECLI:CC:COURT:YEAR:LOCALID
_ECLI_RE = re.compile(
    r"^ECLI:[A-Z]{2}:[A-Z0-9]{1,7}:\d{4}:[A-Z0-9.]{1,25}$",
    re.IGNORECASE,
)


def validate_ecli(ecli: str) -> bool:
    """Validate ECLI identifier format before making HTTP requests.

    Args:
        ecli: ECLI identifier string (e.g., "ECLI:NL:RVS:2023:1234")

    Returns:
        bool: True if valid ECLI format, False otherwise
    """
    return bool(_ECLI_RE.match(ecli.strip()))


def _text(element: etree._Element | None, tag: str) -> str:
    """Extract text from a child element by tag, returning empty string if missing.

    Args:
        element: Parent lxml element (may be None)
        tag: Tag name with optional namespace prefix in Clark notation

    Returns:
        str: Element text or empty string
    """
    if element is None:
        return ""
    child = element.find(tag)
    if child is None or child.text is None:
        return ""
    return child.text


class RechtspraakClient:
    """Client for fetching jurisprudentie from Rechtspraak.nl Open Data.

    All searches are automatically scoped to the omgevingsrecht domain.
    All XML parsing is XXE-safe using lxml with no_network=True.
    Rate limiting via APIRateLimiter singleton (3 concurrent, 300/hour).
    """

    def _parse_search_results(self, response_content: bytes) -> list[dict]:
        """Parse Atom XML search response into list of result dicts.

        Shared parser used by both search_jurisprudence and search_by_court.

        Args:
            response_content: Raw XML bytes from Rechtspraak search API.

        Returns:
            list[dict]: Parsed results with keys: ecli, title, summary, date

        Raises:
            GovernmentAPIError: If XML parsing fails.
        """
        try:
            root = etree.fromstring(response_content, _parser)
        except etree.XMLSyntaxError as exc:
            raise GovernmentAPIError(
                "rechtspraak", f"Failed to parse search XML: {exc}"
            ) from exc

        entries = root.findall(f"{{{ATOM_NS}}}entry")
        results: list[dict] = []

        for entry in entries:
            ecli = _text(entry, f"{{{ATOM_NS}}}id")
            title = _text(entry, f"{{{ATOM_NS}}}title")
            summary = _text(entry, f"{{{ATOM_NS}}}summary")
            date = _text(entry, f"{{{ATOM_NS}}}updated")

            # Skip entries with missing or invalid ECLI
            if not ecli or not validate_ecli(ecli.strip()):
                logger.debug("Rechtspraak: skipping entry with invalid ECLI: %r", ecli)
                continue

            # Normalize placeholder summaries
            if summary == "-":
                summary = ""

            results.append(
                {
                    "ecli": ecli.strip(),
                    "title": title,
                    "summary": summary,
                    "date": date,
                }
            )

        return results

    async def search_jurisprudence(
        self,
        query: str,
        client: httpx.AsyncClient,
        max_results: int = 10,
        sort: str = "DESC",
    ) -> list[dict]:
        """Search for jurisprudentie using the Rechtspraak Atom index feed.

        Automatically applies subject=omgevingsrecht filter and return=DOC
        to ensure only documents with available full text are returned.

        Args:
            query: Free text search query (e.g., "omgevingsvergunning Amsterdam")
            client: Shared httpx AsyncClient from app.state
            max_results: Maximum results to return (default 10, max 50)
            sort: Sort order ("DESC" for newest first, "ASC" for oldest first)

        Returns:
            list[dict]: Parsed results with keys: ecli, title, summary, date

        Raises:
            APITimeoutError: If network request times out or connection fails
            GovernmentAPIError: If XML parsing fails or API returns error
        """
        params = {
            "searchterms": query,
            "subject": OMGEVINGSRECHT_URI,
            "max": max_results,
            "sort": sort,
            "return": "DOC",
        }

        logger.info("Rechtspraak search: %s (max=%d, sort=%s)", query, max_results, sort)

        try:
            async with rechtspraak_limiter:
                response = await retry_with_backoff(
                    lambda: client.get(SEARCH_URL, params=params, timeout=15.0),
                    source="rechtspraak",
                )
        except httpx.TimeoutException as exc:
            raise APITimeoutError("rechtspraak", f"Search request timed out: {exc}") from exc
        except httpx.RequestError as exc:
            raise APITimeoutError("rechtspraak", f"Search connection error: {exc}") from exc

        if response.status_code != 200:
            raise GovernmentAPIError(
                "rechtspraak",
                f"Search returned HTTP {response.status_code}",
                status_code=response.status_code,
            )

        results = self._parse_search_results(response.content)
        logger.info("Rechtspraak search: found %d valid results", len(results))
        return results

    async def search_by_court(
        self,
        court_codes: list[str],
        client: httpx.AsyncClient,
        date_from: str | None = None,
        date_to: str | None = None,
        max_pages: int = 20,
        subject: str = BESTUURSRECHT_URI,
    ) -> list[dict]:
        """Search omgevingsrecht rulings filtered by court using the creator param.

        Makes one API call per court code using the Rechtspraak `creator` parameter
        for server-side filtering. This returns far more results than client-side
        ECLI prefix filtering (e.g. 100 RBLIM results vs 2 with client-side).

        By default `subject` is the broad #bestuursrecht domain and results are
        post-filtered to omgevingsrecht via is_omgevingsrecht_relevant(), because
        rechtbanken under-apply the omgevingsrecht sub-tag. Callers that query a
        court which DOES tag omgevingsrecht reliably (Raad van State) should pass
        `subject=OMGEVINGSRECHT_URI`, which disables the keyword post-filter.

        Args:
            court_codes: List of court codes to match (e.g., ["RBLIM", "RBMAA"]).
            client: Shared httpx AsyncClient from app.state.
            date_from: Optional start date filter (YYYY-MM-DD).
            date_to: Optional end date filter (YYYY-MM-DD).
            max_pages: Safety limit on pagination per court (default 20).
            subject: Rechtsgebied subject URI (default broad #bestuursrecht).

        Returns:
            list[dict]: Results with keys: ecli, title, summary, date

        Raises:
            APITimeoutError: If network request times out or connection fails.
            GovernmentAPIError: If XML parsing fails or API returns error.
        """
        PAGE_SIZE = 1000
        # Only post-filter on keywords when we searched the broad domain; a
        # narrow OMGEVINGSRECHT_URI search is already correctly scoped.
        apply_relevance_filter = subject == BESTUURSRECHT_URI

        logger.info(
            "Rechtspraak court search: codes=%s, subject=%s, date_from=%s, date_to=%s",
            court_codes,
            subject,
            date_from,
            date_to,
        )

        all_results: list[dict] = []
        seen_eclis: set[str] = set()

        for court_code in court_codes:
            owms_uri = get_owms_uri(court_code)
            if not owms_uri:
                logger.warning("No OWMS URI for court code %s, skipping", court_code)
                continue

            params: list[tuple[str, str]] = [
                ("subject", subject),
                ("creator", owms_uri),
                ("max", str(PAGE_SIZE)),
                ("sort", "DESC"),
                ("return", "DOC"),
            ]
            if date_from:
                params.append(("date", date_from))
            if date_to:
                params.append(("date", date_to))

            # Paginate via the `from` offset parameter. The Rechtspraak Atom feed
            # does NOT emit a rel="next" link, so offset paging is the only way to
            # read past the first 1000 results (previously the hard ceiling, which
            # silently capped each court at its newest 1000 rulings).
            page = 0

            while page < max_pages:
                page_params = [*params, ("from", str(page * PAGE_SIZE))]
                page += 1
                try:
                    async with rechtspraak_limiter:
                        response = await retry_with_backoff(
                            lambda p=page_params: client.get(
                                SEARCH_URL, params=p, timeout=30.0
                            ),
                            source="rechtspraak",
                        )
                except httpx.TimeoutException as exc:
                    raise APITimeoutError(
                        "rechtspraak",
                        f"Court search timed out ({court_code} page {page}): {exc}",
                    ) from exc
                except httpx.RequestError as exc:
                    raise APITimeoutError(
                        "rechtspraak",
                        f"Court search connection error ({court_code} page {page}): {exc}",
                    ) from exc

                if response.status_code != 200:
                    raise GovernmentAPIError(
                        "rechtspraak",
                        f"Court search HTTP {response.status_code} ({court_code} page {page})",
                        status_code=response.status_code,
                    )

                results = self._parse_search_results(response.content)

                # Deduplicate across court codes; when searching the broad
                # #bestuursrecht domain, keep only omgevingsrecht-relevant rulings
                # (cheap title+summary match, no full-document fetch needed).
                for r in results:
                    if r["ecli"] in seen_eclis:
                        continue
                    if apply_relevance_filter and not is_omgevingsrecht_relevant(
                        r.get("title", ""), r.get("summary", "")
                    ):
                        continue
                    all_results.append(r)
                    seen_eclis.add(r["ecli"])

                logger.info(
                    "Rechtspraak %s page %d: %d results, %d total so far",
                    court_code,
                    page,
                    len(results),
                    len(all_results),
                )

                if len(results) < PAGE_SIZE:
                    break

        logger.info(
            "Rechtspraak court search complete: %d results for %s",
            len(all_results),
            court_codes,
        )

        return all_results

    async def get_jurisprudence_document(
        self,
        ecli: str,
        client: httpx.AsyncClient,
    ) -> dict | None:
        """Fetch the full document content for a specific ECLI.

        Three-state contract: returns dict on success, None on 404,
        raises GovernmentAPIError on parse failure or unexpected HTTP errors.

        Args:
            ecli: ECLI identifier (e.g., "ECLI:NL:RVS:2023:1234")
            client: Shared httpx AsyncClient from app.state

        Returns:
            dict with keys: ecli, text, instantie, datum_uitspraak
            None if the document does not exist (404)

        Raises:
            APITimeoutError: If network request times out or connection fails
            GovernmentAPIError: If XML parsing fails or API returns unexpected error
        """
        params = {"id": ecli}

        logger.info("Rechtspraak document fetch: %s", ecli)

        try:
            async with rechtspraak_limiter:
                response = await retry_with_backoff(
                    lambda: client.get(CONTENT_URL, params=params, timeout=15.0),
                    source="rechtspraak",
                )
        except httpx.TimeoutException as exc:
            raise APITimeoutError(
                "rechtspraak", f"Document fetch timed out for {ecli}: {exc}"
            ) from exc
        except httpx.RequestError as exc:
            raise APITimeoutError(
                "rechtspraak", f"Document connection error for {ecli}: {exc}"
            ) from exc

        if response.status_code == 404:
            logger.info("Rechtspraak: document not found for ECLI %s", ecli)
            return None

        if response.status_code != 200:
            raise GovernmentAPIError(
                "rechtspraak",
                f"Document fetch returned HTTP {response.status_code} for {ecli}",
                status_code=response.status_code,
            )

        try:
            root = etree.fromstring(response.content, _parser)
        except etree.XMLSyntaxError as exc:
            raise GovernmentAPIError(
                "rechtspraak", "Failed to parse document XML"
            ) from exc

        # Extract ruling text from <uitspraak> or <conclusie> element
        content_text = ""
        for elem in root.iter():
            local_name = etree.QName(elem.tag).localname
            if local_name in ("uitspraak", "conclusie"):
                content_text = "".join(elem.itertext()).strip()
                break

        # Extract metadata via local name matching (namespace-agnostic)
        instantie = ""
        datum_uitspraak = ""
        for elem in root.iter():
            local_name = etree.QName(elem.tag).localname
            if local_name == "creator" and not instantie:
                instantie = elem.text or ""
            elif local_name == "issued" and not datum_uitspraak:
                datum_uitspraak = elem.text or ""

        logger.info(
            "Rechtspraak: fetched document for %s (%d chars, instantie=%r)",
            ecli,
            len(content_text),
            instantie,
        )

        return {
            "ecli": ecli,
            "text": content_text,
            "instantie": instantie,
            "datum_uitspraak": datum_uitspraak,
        }


# Module-level singleton instance
rechtspraak_client = RechtspraakClient()
