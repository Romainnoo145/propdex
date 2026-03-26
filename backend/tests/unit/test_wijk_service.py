"""Unit tests for wijk_service.get_wijken_in_gemeente."""

import pytest
import httpx

from app.services.wijk_service import get_wijken_in_gemeente


def _make_geojson(features: list[dict] | None = None) -> dict:
    """Build a minimal GeoJSON FeatureCollection."""
    if features is None:
        features = [
            {
                "type": "Feature",
                "geometry": {"type": "Polygon", "coordinates": [[[5.0, 51.0], [5.1, 51.0], [5.1, 51.1], [5.0, 51.0]]]},
                "properties": {"statcode": "WK098301", "statnaam": "Wijk 01"},
            }
        ]
    return {"type": "FeatureCollection", "features": features}


class _MockResponse:
    """Minimal stand-in for httpx.Response."""

    def __init__(self, json_data: dict, status_code: int = 200):
        self._json_data = json_data
        self.status_code = status_code

    def json(self):
        return self._json_data

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError(
                message=f"HTTP {self.status_code}",
                request=httpx.Request("GET", "https://example.com"),
                response=self,  # type: ignore[arg-type]
            )


class _MockClient:
    """Async client stub that returns a canned response."""

    def __init__(self, response: _MockResponse | None = None, error: Exception | None = None):
        self._response = response
        self._error = error

    async def get(self, *args, **kwargs):
        if self._error:
            raise self._error
        return self._response


# ---- Valid cases ----

@pytest.mark.asyncio
async def test_valid_gemeente_code_returns_geojson():
    """Bare 4-digit code → GeoJSON FeatureCollection returned."""
    geojson = _make_geojson()
    client = _MockClient(response=_MockResponse(geojson))
    result = await get_wijken_in_gemeente("0983", client)
    assert result["type"] == "FeatureCollection"
    assert len(result["features"]) == 1


@pytest.mark.asyncio
async def test_gm_prefixed_gemeente_code_returns_geojson():
    """GM-prefixed code is accepted and prefix stripped transparently."""
    geojson = _make_geojson()
    client = _MockClient(response=_MockResponse(geojson))
    result = await get_wijken_in_gemeente("GM0983", client)
    assert result["type"] == "FeatureCollection"


# ---- Empty features → ValueError ----

@pytest.mark.asyncio
async def test_empty_features_raises_value_error():
    """WFS returns zero features → ValueError with descriptive message."""
    geojson = _make_geojson(features=[])
    client = _MockClient(response=_MockResponse(geojson))
    with pytest.raises(ValueError, match="No wijken found"):
        await get_wijken_in_gemeente("0983", client)


# ---- Invalid gemeente_code format → ValueError ----

@pytest.mark.asyncio
async def test_invalid_code_too_short():
    client = _MockClient()
    with pytest.raises(ValueError, match="Invalid gemeente_code"):
        await get_wijken_in_gemeente("098", client)


@pytest.mark.asyncio
async def test_invalid_code_too_long():
    client = _MockClient()
    with pytest.raises(ValueError, match="Invalid gemeente_code"):
        await get_wijken_in_gemeente("09831", client)


@pytest.mark.asyncio
async def test_invalid_code_non_numeric():
    client = _MockClient()
    with pytest.raises(ValueError, match="Invalid gemeente_code"):
        await get_wijken_in_gemeente("abcd", client)


@pytest.mark.asyncio
async def test_invalid_code_empty():
    client = _MockClient()
    with pytest.raises(ValueError, match="Invalid gemeente_code"):
        await get_wijken_in_gemeente("", client)


@pytest.mark.asyncio
async def test_invalid_code_gm_prefix_with_bad_digits():
    """GM prefix + non-4-digit remainder → still invalid."""
    client = _MockClient()
    with pytest.raises(ValueError, match="Invalid gemeente_code"):
        await get_wijken_in_gemeente("GM12", client)


# ---- httpx.HTTPError propagation ----

@pytest.mark.asyncio
async def test_http_error_propagates():
    """Network/HTTP errors from the WFS call propagate as httpx exceptions."""
    error = httpx.ConnectError("Connection refused")
    client = _MockClient(error=error)
    with pytest.raises(httpx.ConnectError):
        await get_wijken_in_gemeente("0983", client)


@pytest.mark.asyncio
async def test_http_status_error_propagates():
    """Non-2xx status → httpx.HTTPStatusError propagates."""
    client = _MockClient(response=_MockResponse({}, status_code=500))
    with pytest.raises(httpx.HTTPStatusError):
        await get_wijken_in_gemeente("0983", client)
