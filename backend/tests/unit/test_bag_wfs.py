"""Tests for BAG WFS client: pagination, truncation detection, and error handling."""

import pytest

from app.government_apis.bag_wfs import BAGWFSClient, bag_wfs_limiter
from app.government_apis.base import GovernmentAPIError
from tests.api_mocks import make_mock_client, make_mock_response


@pytest.fixture(autouse=True)
def disable_rate_limiting():
    """Disable rate limiter for all tests in this module."""
    original_enabled = bag_wfs_limiter.enabled
    bag_wfs_limiter.enabled = False
    yield
    bag_wfs_limiter.enabled = original_enabled


class TestBAGWFSClient:
    @pytest.mark.asyncio
    async def test_single_page_response(self):
        """Verify single page response (< 1000 features) makes exactly 1 request."""
        client = BAGWFSClient()

        # Mock response: 50 features total
        features = [{"id": f"pand-{i}"} for i in range(50)]
        response = make_mock_response(
            200,
            json_data={
                "features": features,
                "numberReturned": 50,
                "numberMatched": 50,
            },
        )

        mock_client = make_mock_client(get=response)

        result = await client.get_panden_in_bbox(
            minx=121000, miny=487000, maxx=122000, maxy=488000, client=mock_client
        )

        # Verify: returns 50 features, makes exactly 1 HTTP request
        assert len(result) == 50
        assert mock_client.get.call_count == 1

    @pytest.mark.asyncio
    async def test_pagination_multiple_pages(self):
        """Verify pagination across 3 pages (2500 features total)."""
        client = BAGWFSClient()

        # Mock 3-page response
        page1_features = [{"id": f"pand-{i}"} for i in range(1000)]
        page2_features = [{"id": f"pand-{i}"} for i in range(1000, 2000)]
        page3_features = [{"id": f"pand-{i}"} for i in range(2000, 2500)]

        page1 = make_mock_response(
            200,
            json_data={
                "features": page1_features,
                "numberReturned": 1000,
                "numberMatched": 2500,
            },
        )
        page2 = make_mock_response(
            200,
            json_data={
                "features": page2_features,
                "numberReturned": 1000,
                "numberMatched": 2500,
            },
        )
        page3 = make_mock_response(
            200,
            json_data={
                "features": page3_features,
                "numberReturned": 500,
                "numberMatched": 2500,
            },
        )

        mock_client = make_mock_client()
        mock_client.get.side_effect = [page1, page2, page3]

        result = await client.get_panden_in_bbox(
            minx=121000, miny=487000, maxx=122000, maxy=488000, client=mock_client
        )

        # Verify: returns 2500 features, makes exactly 3 HTTP requests
        assert len(result) == 2500
        assert mock_client.get.call_count == 3

        # Verify pagination parameters on each request
        calls = mock_client.get.call_args_list
        assert calls[0].kwargs["params"]["startIndex"] == 0
        assert calls[1].kwargs["params"]["startIndex"] == 1000
        assert calls[2].kwargs["params"]["startIndex"] == 2000

    @pytest.mark.asyncio
    async def test_truncation_detection(self):
        """Verify exactly 1000 features (not truncated) makes only 1 request."""
        client = BAGWFSClient()

        # Mock response: exactly 1000 features (genuine, not truncated)
        features = [{"id": f"pand-{i}"} for i in range(1000)]
        response = make_mock_response(
            200,
            json_data={
                "features": features,
                "numberReturned": 1000,
                "numberMatched": 1000,
            },
        )

        mock_client = make_mock_client(get=response)

        result = await client.get_panden_in_bbox(
            minx=121000, miny=487000, maxx=122000, maxy=488000, client=mock_client
        )

        # Verify: returns 1000 features, makes exactly 1 HTTP request
        # (no unnecessary second page check)
        assert len(result) == 1000
        assert mock_client.get.call_count == 1

    @pytest.mark.asyncio
    async def test_empty_bbox_returns_empty(self):
        """Verify empty bounding box returns empty list."""
        client = BAGWFSClient()

        # Mock response: 0 features
        response = make_mock_response(
            200,
            json_data={
                "features": [],
                "numberReturned": 0,
                "numberMatched": 0,
            },
        )

        mock_client = make_mock_client(get=response)

        result = await client.get_panden_in_bbox(
            minx=121000, miny=487000, maxx=122000, maxy=488000, client=mock_client
        )

        # Verify: returns empty list
        assert result == []
        assert mock_client.get.call_count == 1

    @pytest.mark.asyncio
    async def test_api_error_propagates(self):
        """Verify HTTP 500 error raises GovernmentAPIError."""
        client = BAGWFSClient()

        # Mock error response
        response = make_mock_response(500, url="https://service.pdok.nl/lv/bag/wfs/v2_0")

        mock_client = make_mock_client(get=response)

        # Verify: raises GovernmentAPIError with source="bag-wfs"
        with pytest.raises(GovernmentAPIError) as exc_info:
            await client.get_panden_in_bbox(
                minx=121000, miny=487000, maxx=122000, maxy=488000, client=mock_client
            )

        assert exc_info.value.source == "bag-wfs"
        assert exc_info.value.status_code == 500

    @pytest.mark.asyncio
    async def test_pand_count_uses_hits_result_type(self):
        """Verify count query uses resultType=hits parameter."""
        client = BAGWFSClient()

        # Mock response for count query
        response = make_mock_response(
            200,
            json_data={
                "numberMatched": 150,
            },
        )

        mock_client = make_mock_client(get=response)

        result = await client.get_pand_count_in_bbox(
            minx=121000, miny=487000, maxx=122000, maxy=488000, client=mock_client
        )

        # Verify: returns integer count
        assert result == 150
        assert mock_client.get.call_count == 1

        # Verify: correct params sent (resultType=hits)
        call_params = mock_client.get.call_args.kwargs["params"]
        assert call_params["resultType"] == "hits"
        assert "count" not in call_params  # No pagination for count-only
