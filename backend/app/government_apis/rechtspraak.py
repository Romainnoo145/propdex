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

# Omgevingsrecht subject URI — hardcoded per RECHT-01 (never search outside this domain)
OMGEVINGSRECHT_URI = "http://psi.rechtspraak.nl/rechtsgebied#bestuursrecht_omgevingsrecht"

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

    def _extract_next_link(self, response_content: bytes) -> str | None:
        """Extract the next page URL from an Atom feed response.

        The Rechtspraak API includes <link rel="next" href="..."/> for pagination.

        Returns:
            Next page URL or None if no more pages.
        """
        try:
            root = etree.fromstring(response_content, _parser)
        except etree.XMLSyntaxError:
            return None

        for link in root.findall(f"{{{ATOM_NS}}}link"):
            if link.get("rel") == "next":
                return link.get("href")
        return None

    async def search_by_court(
        self,
        court_codes: list[str],
        client: httpx.AsyncClient,
        date_from: str | None = None,
        date_to: str | None = None,
        max_pages: int = 20,
    ) -> list[dict]:
        """Search omgevingsrecht rulings filtered by court using the creator param.

        Makes one API call per court code using the Rechtspraak `creator` parameter
        for server-side filtering. This returns far more results than client-side
        ECLI prefix filtering (e.g. 100 RBLIM results vs 2 with client-side).

        Args:
            court_codes: List of court codes to match (e.g., ["RBLIM", "RBMAA"]).
            client: Shared httpx AsyncClient from app.state.
            date_from: Optional start date filter (YYYY-MM-DD).
            date_to: Optional end date filter (YYYY-MM-DD).
            max_pages: Safety limit on pagination per court (default 20).

        Returns:
            list[dict]: Results with keys: ecli, title, summary, date

        Raises:
            APITimeoutError: If network request times out or connection fails.
            GovernmentAPIError: If XML parsing fails or API returns error.
        """
        PAGE_SIZE = 1000

        logger.info(
            "Rechtspraak court search: codes=%s, date_from=%s, date_to=%s",
            court_codes,
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
                ("subject", OMGEVINGSRECHT_URI),
                ("creator", owms_uri),
                ("max", str(PAGE_SIZE)),
                ("sort", "DESC"),
                ("return", "DOC"),
            ]
            if date_from:
                params.append(("date", date_from))
            if date_to:
                params.append(("date", date_to))

            url: str | None = SEARCH_URL
            current_params: list[tuple[str, str]] | None = params
            page = 0

            while url and page < max_pages:
                page += 1
                try:
                    async with rechtspraak_limiter:
                        if current_params is not None:
                            response = await retry_with_backoff(
                                lambda u=url, p=current_params: client.get(
                                    u, params=p, timeout=30.0
                                ),
                                source="rechtspraak",
                            )
                        else:
                            response = await retry_with_backoff(
                                lambda u=url: client.get(u, timeout=30.0),
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

                # Deduplicate across court codes
                for r in results:
                    if r["ecli"] not in seen_eclis:
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

                next_url = self._extract_next_link(response.content)
                if not next_url:
                    break

                url = next_url
                current_params = None

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
