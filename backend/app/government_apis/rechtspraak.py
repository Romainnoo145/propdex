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

        try:
            root = etree.fromstring(response.content, _parser)
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

        logger.info("Rechtspraak search: found %d valid results", len(results))
        return results

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
