"""PDOK Locatieserver API client for address autocomplete and lookup."""

import logging

import httpx

from app.government_apis.base import handle_api_response

logger = logging.getLogger(__name__)


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
