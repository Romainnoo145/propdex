"""Unit tests for retry_with_backoff extension and BAG WFS retry integration."""

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.government_apis.bag_wfs import BAGWFSClient
from app.government_apis.base import retry_with_backoff


def _make_response(status_code: int, json_data: dict | None = None) -> MagicMock:
    """Create a minimal mock httpx.Response."""
    resp = MagicMock(spec=httpx.Response)
    resp.status_code = status_code
    resp.json.return_value = json_data or {}
    resp.url = httpx.URL("https://service.pdok.nl/lv/bag/wfs/v2_0")
    if status_code >= 400:
        resp.raise_for_status.side_effect = httpx.HTTPStatusError(
            message=f"HTTP {status_code}",
            request=MagicMock(spec=httpx.Request),
            response=resp,
        )
    else:
        resp.raise_for_status.return_value = None
    return resp


@pytest.mark.asyncio
class TestRetryWithBackoffErrors:
    """Tests for retry_with_backoff with retry_on_errors=True."""

    async def test_retries_on_5xx_and_succeeds(self) -> None:
        """Returns successful response after 5xx failures."""
        fail_resp = _make_response(500)
        ok_resp = _make_response(200)
        fn = AsyncMock(side_effect=[fail_resp, fail_resp, ok_resp])

        with patch("asyncio.sleep", new_callable=AsyncMock):
            result = await retry_with_backoff(fn, "test", retries=3, retry_on_errors=True)

        assert result.status_code == 200
        assert fn.call_count == 3

    async def test_retries_on_request_error_and_succeeds(self) -> None:
        """Recovers from network error on retry."""
        ok_resp = _make_response(200)
        fn = AsyncMock(side_effect=[httpx.RequestError("timeout"), ok_resp])

        with patch("asyncio.sleep", new_callable=AsyncMock):
            result = await retry_with_backoff(fn, "test", retries=3, retry_on_errors=True)

        assert result.status_code == 200
        assert fn.call_count == 2

    async def test_raises_after_all_retries_exhausted_network_error(self) -> None:
        """All retries fail with network error — last exception propagates."""
        fn = AsyncMock(side_effect=httpx.RequestError("timeout"))

        with patch("asyncio.sleep", new_callable=AsyncMock):
            with pytest.raises(httpx.RequestError):
                await retry_with_backoff(fn, "test", retries=3, retry_on_errors=True)

        # Called retries+1 times (initial + 3 retries)
        assert fn.call_count == 4

    async def test_no_retry_on_success(self) -> None:
        """Successful first call has no retries."""
        ok_resp = _make_response(200)
        fn = AsyncMock(return_value=ok_resp)

        result = await retry_with_backoff(fn, "test", retries=3, retry_on_errors=True)

        assert result.status_code == 200
        assert fn.call_count == 1

    async def test_429_only_mode_unchanged_on_5xx(self) -> None:
        """Default retry_on_errors=False does NOT retry on 500."""
        fail_resp = _make_response(500)
        fn = AsyncMock(return_value=fail_resp)

        result = await retry_with_backoff(fn, "test", retries=3)

        # Should NOT retry on 500 when retry_on_errors=False
        assert result.status_code == 500
        assert fn.call_count == 1

    async def test_429_still_retried_in_error_mode(self) -> None:
        """Even with retry_on_errors=True, 429 responses are retried."""
        fail_resp = _make_response(429)
        ok_resp = _make_response(200)
        fn = AsyncMock(side_effect=[fail_resp, ok_resp])

        with patch("asyncio.sleep", new_callable=AsyncMock):
            result = await retry_with_backoff(fn, "test", retries=3, retry_on_errors=True)

        assert result.status_code == 200
        assert fn.call_count == 2

    async def test_exponential_backoff_delays_on_error(self) -> None:
        """Verifies exponential backoff delays: 1s, 2s, 4s."""
        fail_resp = _make_response(503)
        ok_resp = _make_response(200)
        fn = AsyncMock(side_effect=[fail_resp, fail_resp, fail_resp, ok_resp])

        sleep_calls: list[float] = []
        async def capture_sleep(delay: float) -> None:
            sleep_calls.append(delay)

        with patch("asyncio.sleep", side_effect=capture_sleep):
            result = await retry_with_backoff(fn, "test", retries=3, retry_on_errors=True)

        assert result.status_code == 200
        # Three sleeps: 1s (2^0), 2s (2^1), 4s (2^2)
        assert sleep_calls == [1, 2, 4]


@pytest.mark.asyncio
class TestBAGWFSRetryIntegration:
    """Tests that BAGWFSClient uses retry_with_backoff correctly."""

    async def test_bag_wfs_calls_retry_with_backoff_with_retry_on_errors(self) -> None:
        """BAG WFS passes retry_on_errors=True to retry_with_backoff."""
        ok_resp = _make_response(200, json_data={"features": []})

        client_mock = AsyncMock(spec=httpx.AsyncClient)
        client_mock.get = AsyncMock(return_value=ok_resp)

        wfs = BAGWFSClient()
        with patch(
            "app.government_apis.bag_wfs.retry_with_backoff",
            new_callable=AsyncMock,
            return_value=ok_resp,
        ) as mock_retry:
            # Disable the rate limiter so the inner _fetch_page won't block
            from app.government_apis import bag_wfs as bag_wfs_module
            bag_wfs_module.bag_wfs_limiter.enabled = False
            try:
                result = await wfs.get_panden_in_bbox(0, 0, 1, 1, client_mock)
            finally:
                bag_wfs_module.bag_wfs_limiter.enabled = True

        assert result == []
        mock_retry.assert_called_once()
        # Verify retry_on_errors=True was passed (positional or keyword)
        call_kwargs = mock_retry.call_args
        retry_on_errors_val = call_kwargs.kwargs.get("retry_on_errors")
        assert retry_on_errors_val is True, (
            f"Expected retry_on_errors=True but got: {retry_on_errors_val}"
        )

    async def test_bag_wfs_propagates_persistent_failure(self) -> None:
        """BAG WFS raises exception when all retries are exhausted."""
        client_mock = AsyncMock(spec=httpx.AsyncClient)

        wfs = BAGWFSClient()
        with patch(
            "app.government_apis.bag_wfs.retry_with_backoff",
            new_callable=AsyncMock,
            side_effect=httpx.RequestError("connection refused"),
        ):
            from app.government_apis import bag_wfs as bag_wfs_module
            bag_wfs_module.bag_wfs_limiter.enabled = False
            try:
                with pytest.raises(httpx.RequestError):
                    await wfs.get_panden_in_bbox(0, 0, 1, 1, client_mock)
            finally:
                bag_wfs_module.bag_wfs_limiter.enabled = True
