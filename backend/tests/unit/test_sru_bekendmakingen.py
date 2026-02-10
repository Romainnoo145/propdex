"""Tests for SRU Bekendmakingen client: XML parsing, XXE protection, error handling."""

import pytest

from app.government_apis.base import GovernmentAPIError
from app.government_apis.sru_bekendmakingen import SRUBekendmakingenClient, sru_limiter
from tests.api_mocks import make_mock_client, make_mock_response


@pytest.fixture(autouse=True)
def disable_rate_limiting():
    """Disable rate limiter for all tests in this module."""
    original_enabled = sru_limiter.enabled
    sru_limiter.enabled = False
    yield
    sru_limiter.enabled = original_enabled


# Sample valid SRU XML response
VALID_SRU_XML = b"""<?xml version="1.0" encoding="UTF-8"?>
<srw:searchRetrieveResponse xmlns:srw="http://www.loc.gov/zing/srw/">
    <srw:numberOfRecords>2</srw:numberOfRecords>
    <srw:records>
        <srw:record>
            <srw:recordData>
                <gzd:gzd xmlns:gzd="http://standaarden.overheid.nl/sru"
                         xmlns:overheidop="http://standaarden.overheid.nl/product/metadata/">
                    <overheidop:title>Omgevingsvergunning Hoofdstraat 42</overheidop:title>
                    <overheidop:identifier>gmb-2024-12345</overheidop:identifier>
                    <overheidop:type>Omgevingsvergunning</overheidop:type>
                    <overheidop:date>2024-01-15</overheidop:date>
                    <overheidop:spatial>Amsterdam</overheidop:spatial>
                    <overheidop:source>https://officielebekendmakingen.nl/gmb-2024-12345</overheidop:source>
                </gzd:gzd>
            </srw:recordData>
        </srw:record>
        <srw:record>
            <srw:recordData>
                <gzd:gzd xmlns:gzd="http://standaarden.overheid.nl/sru"
                         xmlns:overheidop="http://standaarden.overheid.nl/product/metadata/">
                    <overheidop:title>Bestemmingsplan Centrum</overheidop:title>
                    <overheidop:identifier>gmb-2024-67890</overheidop:identifier>
                    <overheidop:type>Bestemmingsplan</overheidop:type>
                    <overheidop:date>2024-02-01</overheidop:date>
                    <overheidop:spatial>Amsterdam</overheidop:spatial>
                    <overheidop:source>https://officielebekendmakingen.nl/gmb-2024-67890</overheidop:source>
                </gzd:gzd>
            </srw:recordData>
        </srw:record>
    </srw:records>
</srw:searchRetrieveResponse>
"""

# XML with missing fields
INCOMPLETE_XML = b"""<?xml version="1.0" encoding="UTF-8"?>
<srw:searchRetrieveResponse xmlns:srw="http://www.loc.gov/zing/srw/">
    <srw:numberOfRecords>1</srw:numberOfRecords>
    <srw:records>
        <srw:record>
            <srw:recordData>
                <gzd:gzd xmlns:gzd="http://standaarden.overheid.nl/sru"
                         xmlns:overheidop="http://standaarden.overheid.nl/product/metadata/">
                    <overheidop:title>Partial Record</overheidop:title>
                    <!-- Missing identifier, type, date, municipality, url -->
                </gzd:gzd>
            </srw:recordData>
        </srw:record>
    </srw:records>
</srw:searchRetrieveResponse>
"""

# Empty result set
EMPTY_XML = b"""<?xml version="1.0" encoding="UTF-8"?>
<srw:searchRetrieveResponse xmlns:srw="http://www.loc.gov/zing/srw/">
    <srw:numberOfRecords>0</srw:numberOfRecords>
    <srw:records>
    </srw:records>
</srw:searchRetrieveResponse>
"""

# Malicious XXE XML
XXE_XML = b"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
<srw:searchRetrieveResponse xmlns:srw="http://www.loc.gov/zing/srw/">
    <srw:numberOfRecords>1</srw:numberOfRecords>
    <srw:records>
        <srw:record>
            <srw:recordData>
                <gzd:gzd xmlns:gzd="http://standaarden.overheid.nl/sru"
                         xmlns:overheidop="http://standaarden.overheid.nl/product/metadata/">
                    <overheidop:title>&xxe;</overheidop:title>
                </gzd:gzd>
            </srw:recordData>
        </srw:record>
    </srw:records>
</srw:searchRetrieveResponse>
"""


class TestSRUBekendmakingenClient:
    @pytest.mark.asyncio
    async def test_parse_valid_xml_response(self):
        """Verify valid SRU XML response is parsed correctly."""
        client = SRUBekendmakingenClient()

        # Mock response with valid XML
        response = make_mock_response(200, content=VALID_SRU_XML)
        mock_client = make_mock_client(get=response)

        result = await client.query_by_postcode("1015AA", mock_client)

        # Verify: returns 2 records with expected structure
        assert len(result) == 2
        assert result[0]["title"] == "Omgevingsvergunning Hoofdstraat 42"
        assert result[0]["identifier"] == "gmb-2024-12345"
        assert result[0]["type"] == "Omgevingsvergunning"
        assert result[0]["date"] == "2024-01-15"
        assert result[0]["municipality"] == "Amsterdam"
        assert result[0]["url"] == "https://officielebekendmakingen.nl/gmb-2024-12345"

        assert result[1]["title"] == "Bestemmingsplan Centrum"
        assert result[1]["type"] == "Bestemmingsplan"

    @pytest.mark.asyncio
    async def test_xxe_protection_blocks_entity(self):
        """Verify XXE entity expansion is blocked by parser."""
        client = SRUBekendmakingenClient()

        # Parse malicious XML with XXE entity
        records = client._parse_sru_response(XXE_XML)

        # Verify: entity is NOT expanded (should be empty or literal "&xxe;")
        # lxml with resolve_entities=False should not expand the entity
        assert len(records) == 1
        # The entity should NOT be replaced with /etc/passwd contents
        # It should be either empty string (entity ignored) or literal "&xxe;"
        title = records[0]["title"]
        assert "root:" not in title  # /etc/passwd would contain "root:"
        assert "/bin" not in title  # /etc/passwd would contain shell paths

    @pytest.mark.asyncio
    async def test_missing_xml_fields_handled(self):
        """Verify missing XML fields default to empty string."""
        client = SRUBekendmakingenClient()

        # Parse XML with missing fields
        records = client._parse_sru_response(INCOMPLETE_XML)

        # Verify: returns record with empty string defaults
        assert len(records) == 1
        assert records[0]["title"] == "Partial Record"
        assert records[0]["identifier"] == ""
        assert records[0]["type"] == ""
        assert records[0]["date"] == ""
        assert records[0]["municipality"] == ""
        assert records[0]["url"] == ""

    @pytest.mark.asyncio
    async def test_empty_result_set(self):
        """Verify empty result set returns empty list."""
        client = SRUBekendmakingenClient()

        # Mock response with empty XML
        response = make_mock_response(200, content=EMPTY_XML)
        mock_client = make_mock_client(get=response)

        result = await client.query_by_postcode("9999XX", mock_client)

        # Verify: returns empty list
        assert result == []

    @pytest.mark.asyncio
    async def test_api_error_raises_exception(self):
        """Verify HTTP 503 error raises GovernmentAPIError."""
        client = SRUBekendmakingenClient()

        # Mock error response
        response = make_mock_response(503)
        mock_client = make_mock_client(get=response)

        # Verify: raises GovernmentAPIError with source="sru"
        with pytest.raises(GovernmentAPIError) as exc_info:
            await client.query_by_postcode("1015AA", mock_client)

        assert exc_info.value.source == "sru"
        assert exc_info.value.status_code == 503

    @pytest.mark.asyncio
    async def test_municipality_query_returns_total_count(self):
        """Verify municipality query returns tuple (records, total_count)."""
        client = SRUBekendmakingenClient()

        # Mock response with 2 records but numberOfRecords=250
        xml_with_count = VALID_SRU_XML.replace(
            b"<srw:numberOfRecords>2</srw:numberOfRecords>",
            b"<srw:numberOfRecords>250</srw:numberOfRecords>",
        )

        response = make_mock_response(200, content=xml_with_count)
        mock_client = make_mock_client(get=response)

        records, total_count = await client.query_by_municipality(
            "Amsterdam", mock_client
        )

        # Verify: returns (records, 250) tuple
        assert len(records) == 2
        assert total_count == 250
