"""SRU Bekendmakingen client for querying official Dutch government announcements.

This module provides access to the Officiele Bekendmakingen (Official Publications)
SRU (Search/Retrieve via URL) API to query permits (vergunningen) and other
government announcements related to specific locations or municipalities.

SRU is an XML-based search protocol. This client parses XML responses into
structured Python dictionaries with explicit XXE (XML External Entity) protection.
"""

import logging
from typing import TypedDict

import httpx
from lxml import etree

from app.government_apis.base import GovernmentAPIError
from app.government_apis.rate_limiter import sru_limiter

logger = logging.getLogger(__name__)

# Module-level XXE-safe XML parser singleton
# This parser configuration prevents XML External Entity (XXE) attacks
_sru_parser = etree.XMLParser(
    resolve_entities=False,  # XXE prevention - do not resolve entities
    no_network=True,  # Block all network access from DTD processing
    remove_comments=True,  # Strip XML comments for cleaner parsing
)

# SRU XML namespaces used in Officiele Bekendmakingen responses
SRU_NAMESPACES = {
    "srw": "http://www.loc.gov/zing/srw/",
    "gzd": "http://standaarden.overheid.nl/sru",
    "overheidop": "http://standaarden.overheid.nl/product/metadata/",
}


class BekendmakingRecord(TypedDict):
    """Structured record representing a single bekendmaking (official announcement).

    Attributes:
        title: Title of the announcement (e.g., "Omgevingsvergunning Hoofdstraat 42")
        identifier: Unique identifier for the publication
        type: Type of announcement (e.g., "Omgevingsvergunning", "Bestemmingsplan")
        date: Publication date as ISO date string
        municipality: Municipality name (gemeente)
        url: Link to the official publication on officielebekendmakingen.nl
    """

    title: str
    identifier: str
    type: str
    date: str
    municipality: str
    url: str


class SRUBekendmakingenClient:
    """Client for querying the Officiele Bekendmakingen SRU API.

    The SRU (Search/Retrieve via URL) protocol is used to search government
    publications including permits, zoning plans, and other official announcements.

    All requests are rate-limited via the sru_limiter context manager.
    All XML parsing is done with XXE protection enabled.
    """

    BASE_URL = "https://repository.overheid.nl/sru"

    async def query_by_postcode(
        self,
        postcode: str,
        client: httpx.AsyncClient,
        max_records: int = 100,
    ) -> list[BekendmakingRecord]:
        """Query bekendmakingen for a specific postcode area.

        Args:
            postcode: Dutch postcode (6 characters, e.g., "1015AA")
            client: Shared httpx AsyncClient from app.state
            max_records: Maximum number of records to retrieve (default: 100)

        Returns:
            list[BekendmakingRecord]: List of bekendmaking records

        Raises:
            GovernmentAPIError: If the SRU request fails
        """
        params = {
            "operation": "searchRetrieve",
            "version": "1.2",
            "query": f"postcode={postcode}",
            "maximumRecords": str(max_records),
        }

        logger.info(f"SRU query_by_postcode: {postcode} (max={max_records})")

        async with sru_limiter:
            response = await client.get(
                self.BASE_URL, params=params, timeout=30.0
            )

        if response.status_code != 200:
            raise GovernmentAPIError(
                "sru",
                f"SRU request failed with status {response.status_code}",
                status_code=response.status_code,
            )

        records = self._parse_sru_response(response.content)
        logger.info(f"SRU: found {len(records)} bekendmakingen for postcode {postcode}")
        return records

    async def query_by_municipality(
        self,
        gemeente: str,
        client: httpx.AsyncClient,
        record_type: str | None = None,
        max_records: int = 100,
        start_record: int = 1,
    ) -> tuple[list[BekendmakingRecord], int]:
        """Query bekendmakingen for a specific municipality.

        Args:
            gemeente: Municipality name (e.g., "Amsterdam")
            client: Shared httpx AsyncClient from app.state
            record_type: Optional filter by type (e.g., "Omgevingsvergunning")
            max_records: Maximum number of records to retrieve (default: 100)
            start_record: Starting record number for pagination (default: 1)

        Returns:
            tuple[list[BekendmakingRecord], int]: (records, total_count)
                - records: List of bekendmaking records
                - total_count: Total number of matching records for pagination

        Raises:
            GovernmentAPIError: If the SRU request fails
        """
        # Build SRU query with gemeente filter
        query_parts = [f"gemeente={gemeente}"]
        if record_type:
            query_parts.append(f"type={record_type}")
        query = " AND ".join(query_parts)

        params = {
            "operation": "searchRetrieve",
            "version": "1.2",
            "query": query,
            "maximumRecords": str(max_records),
            "startRecord": str(start_record),
        }

        logger.info(
            f"SRU query_by_municipality: {gemeente} (type={record_type}, max={max_records}, start={start_record})"
        )

        async with sru_limiter:
            response = await client.get(
                self.BASE_URL, params=params, timeout=30.0
            )

        if response.status_code != 200:
            raise GovernmentAPIError(
                "sru",
                f"SRU request failed with status {response.status_code}",
                status_code=response.status_code,
            )

        records = self._parse_sru_response(response.content)

        # Extract total count from SRU response
        total_count = self._extract_total_count(response.content)

        logger.info(
            f"SRU: found {len(records)} bekendmakingen for {gemeente} (total: {total_count})"
        )
        return records, total_count

    def _parse_sru_response(self, xml_content: bytes) -> list[BekendmakingRecord]:
        """Parse SRU XML response into structured BekendmakingRecord dicts.

        This method centralizes XML parsing logic and handles missing fields
        gracefully with default values.

        Args:
            xml_content: Raw XML response bytes from SRU API

        Returns:
            list[BekendmakingRecord]: Parsed bekendmaking records
        """
        try:
            root = etree.fromstring(xml_content, parser=_sru_parser)
        except etree.XMLSyntaxError as e:
            logger.error(f"SRU XML parsing failed: {e}")
            raise GovernmentAPIError("sru", f"Invalid XML response: {e}") from e

        records: list[BekendmakingRecord] = []

        # Find all record elements using SRU namespace
        record_elements = root.findall(".//srw:record", namespaces=SRU_NAMESPACES)

        for record_elem in record_elements:
            # Extract fields with defensive fallback to empty string
            # Use .findtext() with explicit namespace and default value
            title = (
                record_elem.findtext(
                    ".//overheidop:title", default="", namespaces=SRU_NAMESPACES
                )
                or ""
            )
            identifier = (
                record_elem.findtext(
                    ".//overheidop:identifier", default="", namespaces=SRU_NAMESPACES
                )
                or ""
            )
            record_type = (
                record_elem.findtext(
                    ".//overheidop:type", default="", namespaces=SRU_NAMESPACES
                )
                or ""
            )
            date = (
                record_elem.findtext(
                    ".//overheidop:date", default="", namespaces=SRU_NAMESPACES
                )
                or ""
            )
            municipality = (
                record_elem.findtext(
                    ".//overheidop:spatial", default="", namespaces=SRU_NAMESPACES
                )
                or ""
            )
            url = (
                record_elem.findtext(
                    ".//overheidop:source", default="", namespaces=SRU_NAMESPACES
                )
                or ""
            )

            record: BekendmakingRecord = {
                "title": title,
                "identifier": identifier,
                "type": record_type,
                "date": date,
                "municipality": municipality,
                "url": url,
            }

            records.append(record)

        return records

    def _extract_total_count(self, xml_content: bytes) -> int:
        """Extract total record count from SRU response for pagination.

        Args:
            xml_content: Raw XML response bytes from SRU API

        Returns:
            int: Total number of matching records (0 if not found)
        """
        try:
            root = etree.fromstring(xml_content, parser=_sru_parser)
            count_text = root.findtext(
                ".//srw:numberOfRecords", default="0", namespaces=SRU_NAMESPACES
            )
            return int(count_text or "0")
        except (etree.XMLSyntaxError, ValueError) as e:
            logger.warning(f"Could not extract total count from SRU response: {e}")
            return 0


# Module-level singleton instance
sru_client = SRUBekendmakingenClient()
