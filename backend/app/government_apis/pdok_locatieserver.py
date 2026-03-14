"""PDOK Locatieserver API client for address autocomplete and lookup."""

import logging
import re

import httpx

from app.government_apis.base import handle_api_response
from app.government_apis.base import retry_with_backoff
from app.government_apis.rate_limiter import pdok_locatieserver_limiter

logger = logging.getLogger(__name__)

_RD_POINT_RE = re.compile(r"POINT\(([0-9.]+)\s+([0-9.]+)\)")


def _parse_rd_point(wkt: str) -> tuple[float, float] | None:
    """Parse a PDOK centroide_rd WKT POINT string into (x, y) RD coordinates.

    Args:
        wkt: WKT string like "POINT(121348.243 487347.752)"

    Returns:
        Tuple of (x, y) floats in EPSG:28992, or None if unparseable.
    """
    if not wkt:
        return None
    m = _RD_POINT_RE.match(wkt)
    if not m:
        return None
    return (float(m.group(1)), float(m.group(2)))


class PDOKLocatieserver:
    """
    Client for PDOK Locatieserver API (address autocomplete and lookup).

    PDOK Locatieserver provides free geocoding and address autocomplete for Dutch addresses.
    No authentication required.

    API Documentation: https://api.pdok.nl/bzk/locatieserver/search/v3_1/ui/
    """

    BASE_URL = "https://api.pdok.nl/bzk/locatieserver/search/v3_1"

    async def suggest(
        self, query: str, client: httpx.AsyncClient, rows: int = 5
    ) -> list[dict]:
        """
        Get address autocomplete suggestions.

        Args:
            query: User's search query (e.g., "Keizersgracht 1, Amsterdam")
            client: Shared httpx AsyncClient from app.state
            rows: Maximum number of suggestions to return (default: 5)

        Returns:
            list[dict]: List of address suggestions with metadata

        Raises:
            httpx.HTTPStatusError: If API request fails
        """
        url = f"{self.BASE_URL}/suggest"
        params = {
            "q": query,
            "rows": rows,
            "fq": "type:adres",  # Filter to addresses only
        }

        logger.info(f"PDOK suggest: {query} (rows={rows})")
        response = await client.get(url, params=params)
        data = handle_api_response(response, source="pdok")

        return data.get("response", {}).get("docs", [])

    async def lookup(self, object_id: str, client: httpx.AsyncClient) -> dict:
        """
        Look up full address details by PDOK object ID.

        Args:
            object_id: PDOK object identifier from suggest results
            client: Shared httpx AsyncClient from app.state

        Returns:
            dict: Full address details with coordinates and metadata

        Raises:
            httpx.HTTPStatusError: If API request fails
            APINotFoundError: If object_id not found
        """
        url = f"{self.BASE_URL}/lookup"
        params = {"id": object_id}

        logger.info(f"PDOK lookup: {object_id}")
        response = await client.get(url, params=params)
        data = handle_api_response(response, source="pdok")

        docs = data.get("response", {}).get("docs", [])
        if not docs:
            from app.government_apis.base import APINotFoundError

            raise APINotFoundError("pdok", f"Object not found: {object_id}")

        return docs[0]

    async def reverse(
        self, rd_x: float, rd_y: float, client: httpx.AsyncClient
    ) -> str | None:
        """
        Reverse geocode RD coordinates to a display address.

        Uses PDOK Locatieserver /reverse endpoint with RD New (EPSG:28992)
        coordinates. Free, no API key required.

        Args:
            rd_x: X coordinate in EPSG:28992 (RD New)
            rd_y: Y coordinate in EPSG:28992 (RD New)
            client: Shared httpx AsyncClient

        Returns:
            Display address string (e.g., "Kerkstraat 42, 5911AA Venlo") or None
        """
        url = f"{self.BASE_URL}/reverse"
        for distance in (100, 250, 500):
            params = {
                "X": rd_x,
                "Y": rd_y,
                "type": "adres",
                "rows": 1,
                "distance": distance,
            }

            try:
                async with pdok_locatieserver_limiter:
                    response = await retry_with_backoff(
                        lambda: client.get(url, params=params),
                        source="pdok",
                    )
                data = handle_api_response(response, source="pdok")
                docs = data.get("response", {}).get("docs", [])
                if docs:
                    weergavenaam = docs[0].get("weergavenaam")
                    if isinstance(weergavenaam, str) and weergavenaam.strip():
                        return weergavenaam.strip()
            except Exception as e:
                logger.debug(
                    "PDOK reverse geocode failed for (%s, %s) distance=%s: %s",
                    rd_x,
                    rd_y,
                    distance,
                    e,
                )

        return None

    async def reverse_full(
        self, rd_x: float, rd_y: float, client: httpx.AsyncClient
    ) -> dict | None:
        """Reverse geocode RD coordinates and return the full PDOK response doc.

        Same retry/distance logic as reverse(), but returns the entire first doc
        dict instead of just weergavenaam. The doc contains fields like
        nummeraanduiding_id, adresseerbaarobject_id, postcode, weergavenaam.

        Args:
            rd_x: X coordinate in EPSG:28992 (RD New)
            rd_y: Y coordinate in EPSG:28992 (RD New)
            client: Shared httpx AsyncClient

        Returns:
            Full doc dict from PDOK Locatieserver /reverse, or None
        """
        url = f"{self.BASE_URL}/reverse"
        for distance in (100, 250, 500):
            params = {
                "X": rd_x,
                "Y": rd_y,
                "type": "adres",
                "rows": 1,
                "distance": distance,
                "fl": "weergavenaam,postcode,nummeraanduiding_id,adresseerbaarobject_id",
            }

            try:
                async with pdok_locatieserver_limiter:
                    response = await retry_with_backoff(
                        lambda: client.get(url, params=params),
                        source="pdok",
                    )
                data = handle_api_response(response, source="pdok")
                docs = data.get("response", {}).get("docs", [])
                if docs and isinstance(docs[0], dict):
                    return docs[0]
            except Exception as e:
                logger.debug(
                    "PDOK reverse_full failed for (%s, %s) distance=%s: %s",
                    rd_x,
                    rd_y,
                    distance,
                    e,
                )

        return None

    async def geocode_address(
        self,
        street: str,
        huisnummer: int,
        client: httpx.AsyncClient,
        postcode: str | None = None,
        city: str | None = None,
        gemeente_naam: str | None = None,
    ) -> tuple[float, float] | None:
        """Forward geocode a Dutch address to RD New (EPSG:28992) coordinates.

        Uses PDOK Locatieserver /free endpoint. No authentication required.

        Args:
            street: Street name (straatnaam)
            huisnummer: House number
            client: Shared httpx AsyncClient
            postcode: Dutch postcode (e.g., "5911AA") — appended to query when provided
            city: City/place name — appended to query when provided
            gemeente_naam: Municipality name — used as fallback when neither
                postcode nor city is available (pitfall: many addresses share
                a street name across NL; gemeente_naam narrows the search)

        Returns:
            Tuple of (x, y) in EPSG:28992 (RD New), or None on failure.
        """
        try:
            parts = [f"{street} {huisnummer}"]
            if postcode:
                parts.append(postcode)
            if city:
                parts.append(city)
            if not postcode and not city and gemeente_naam:
                parts.append(gemeente_naam)
            query = ", ".join(parts)

            url = f"{self.BASE_URL}/free"
            params = {
                "q": query,
                "fq": "type:adres",
                "fl": "id,centroide_rd",
                "rows": 1,
            }

            logger.debug(f"PDOK geocode: {query!r}")
            response = await client.get(url, params=params)
            data = handle_api_response(response, source="pdok")

            docs = data.get("response", {}).get("docs", [])
            if not docs:
                return None

            centroide_rd = docs[0].get("centroide_rd")
            if not centroide_rd:
                return None

            return _parse_rd_point(centroide_rd)

        except Exception as e:
            logger.debug(f"PDOK geocode failed for {street!r} {huisnummer}: {e}")
            return None
