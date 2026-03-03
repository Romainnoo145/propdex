"""Unit tests for BAG3DClient 3D BAG OGC API Features client (Phase 74-01)."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.government_apis.bag_3d import BAG3DClient
from app.government_apis.base import GovernmentAPIError
from tests.api_mocks import make_mock_client, make_mock_response

# --- Shared helpers -----------------------------------------------------------


def _make_limiter_mock() -> AsyncMock:
    """Create a no-op async context manager mock for the rate limiter."""
    limiter = AsyncMock()
    limiter.__aenter__ = AsyncMock(return_value=None)
    limiter.__aexit__ = AsyncMock(return_value=None)
    return limiter


async def _passthrough_retry(fn: object, **kwargs: object) -> object:
    """Async passthrough for retry_with_backoff — just calls and awaits fn()."""
    return await fn()  # type: ignore[operator]


def _make_feature(
    pand_id: str,
    dak: float | None,
    maaiveld: float | None,
    bouwlagen: float | None,
) -> dict:
    """Build a minimal OGC API Features GeoJSON feature dict."""
    props: dict = {}
    if dak is not None:
        props["b3_h_dak_50p"] = dak
    if maaiveld is not None:
        props["b3_h_maaiveld"] = maaiveld
    if bouwlagen is not None:
        props["b3_bouwlagen"] = bouwlagen
    return {
        "id": pand_id,
        "type": "Feature",
        "properties": props,
        "geometry": {"type": "Polygon", "coordinates": [[]]},
    }


def _make_feature_collection(features: list[dict]) -> dict:
    """Wrap features in an OGC API FeatureCollection dict."""
    return {"type": "FeatureCollection", "features": features}


_PATCH_LIMITER = "app.government_apis.bag_3d.bag_3d_limiter"
_PATCH_RETRY = "app.government_apis.bag_3d.retry_with_backoff"


# --- Tests --------------------------------------------------------------------


@pytest.mark.asyncio
async def test_single_page_response() -> None:
    """Single page (<1000 features) returns dict with correct pand IDs and values."""
    features = [
        _make_feature("NL.IMBAG.Pand.0363100012345678", dak=15.3, maaiveld=2.1, bouwlagen=4),
        _make_feature("NL.IMBAG.Pand.0363100012345679", dak=8.0, maaiveld=0.5, bouwlagen=2),
        _make_feature("NL.IMBAG.Pand.0363100012345680", dak=22.6, maaiveld=1.0, bouwlagen=7),
    ]
    response_data = _make_feature_collection(features)
    mock_client = make_mock_client(get=make_mock_response(json_data=response_data))

    bag_client = BAG3DClient()

    with (
        patch(_PATCH_LIMITER, _make_limiter_mock()),
        patch(_PATCH_RETRY, new=_passthrough_retry),
    ):
        result = await bag_client.get_panden_in_bbox(
            minx=120000, miny=485000, maxx=121000, maxy=486000, client=mock_client
        )

    assert len(result) == 3

    # Check first pand
    pand0 = result["NL.IMBAG.Pand.0363100012345678"]
    assert pand0["actual_bouwhoogte"] == round(15.3 - 2.1, 1)  # 13.2
    assert pand0["actual_bouwlagen"] == 4

    # Check second pand
    pand1 = result["NL.IMBAG.Pand.0363100012345679"]
    assert pand1["actual_bouwhoogte"] == round(8.0 - 0.5, 1)  # 7.5
    assert pand1["actual_bouwlagen"] == 2

    # Check third pand — also verify pand ID prefix
    pand2 = result["NL.IMBAG.Pand.0363100012345680"]
    assert pand2["actual_bouwhoogte"] == round(22.6 - 1.0, 1)  # 21.6
    assert pand2["actual_bouwlagen"] == 7


@pytest.mark.asyncio
async def test_pagination() -> None:
    """Two pages: first=1000 features (triggers next request), second=500. Total=1500."""
    # Build 1000 features for page 1
    page1_features = [
        _make_feature(f"NL.IMBAG.Pand.{i:016d}", dak=10.0, maaiveld=0.0, bouwlagen=3)
        for i in range(1000)
    ]
    # Build 500 features for page 2
    page2_features = [
        _make_feature(f"NL.IMBAG.Pand.{i:016d}", dak=12.0, maaiveld=0.5, bouwlagen=4)
        for i in range(1000, 1500)
    ]

    page1_response = make_mock_response(json_data=_make_feature_collection(page1_features))
    page2_response = make_mock_response(json_data=_make_feature_collection(page2_features))

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(side_effect=[page1_response, page2_response])

    bag_client = BAG3DClient()

    with (
        patch(_PATCH_LIMITER, _make_limiter_mock()),
        patch(_PATCH_RETRY, new=_passthrough_retry),
    ):
        result = await bag_client.get_panden_in_bbox(
            minx=120000, miny=485000, maxx=125000, maxy=490000, client=mock_client
        )

    assert len(result) == 1500
    # Verify both pages were fetched
    assert mock_client.get.call_count == 2


@pytest.mark.asyncio
async def test_height_sanity_bounds() -> None:
    """Height outside [1.5m, 200.0m] returns actual_bouwhoogte=None; valid height returns value."""
    features = [
        # Height = 0.5m — below min (1.5m)
        _make_feature("NL.IMBAG.Pand.0000000000000001", dak=1.0, maaiveld=0.5, bouwlagen=1),
        # Height = 201.0m — above max (200.0m)
        _make_feature("NL.IMBAG.Pand.0000000000000002", dak=202.0, maaiveld=1.0, bouwlagen=50),
        # Height = 12.5m — within bounds
        _make_feature("NL.IMBAG.Pand.0000000000000003", dak=13.0, maaiveld=0.5, bouwlagen=4),
        # Height exactly at lower bound = 1.5m — should be valid
        _make_feature("NL.IMBAG.Pand.0000000000000004", dak=2.0, maaiveld=0.5, bouwlagen=1),
    ]
    mock_client = make_mock_client(get=make_mock_response(json_data=_make_feature_collection(features)))

    bag_client = BAG3DClient()

    with (
        patch(_PATCH_LIMITER, _make_limiter_mock()),
        patch(_PATCH_RETRY, new=_passthrough_retry),
    ):
        result = await bag_client.get_panden_in_bbox(
            minx=120000, miny=485000, maxx=121000, maxy=486000, client=mock_client
        )

    assert result["NL.IMBAG.Pand.0000000000000001"]["actual_bouwhoogte"] is None
    assert result["NL.IMBAG.Pand.0000000000000002"]["actual_bouwhoogte"] is None
    assert result["NL.IMBAG.Pand.0000000000000003"]["actual_bouwhoogte"] == 12.5
    assert result["NL.IMBAG.Pand.0000000000000004"]["actual_bouwhoogte"] == 1.5


@pytest.mark.asyncio
async def test_bouwlagen_sanity_bounds() -> None:
    """Floor count outside [1, 100] returns None; float 3.6 returns 4 via int(round())."""
    features = [
        # bouwlagen=0 — below min (1)
        _make_feature("NL.IMBAG.Pand.0000000000000011", dak=5.0, maaiveld=0.5, bouwlagen=0),
        # bouwlagen=101 — above max (100)
        _make_feature("NL.IMBAG.Pand.0000000000000012", dak=300.0, maaiveld=0.5, bouwlagen=101),
        # bouwlagen=3.6 — valid, should round to 4
        _make_feature("NL.IMBAG.Pand.0000000000000013", dak=12.0, maaiveld=0.5, bouwlagen=3.6),
        # bouwlagen=1 — exactly at lower bound
        _make_feature("NL.IMBAG.Pand.0000000000000014", dak=4.0, maaiveld=0.5, bouwlagen=1),
    ]
    mock_client = make_mock_client(get=make_mock_response(json_data=_make_feature_collection(features)))

    bag_client = BAG3DClient()

    with (
        patch(_PATCH_LIMITER, _make_limiter_mock()),
        patch(_PATCH_RETRY, new=_passthrough_retry),
    ):
        result = await bag_client.get_panden_in_bbox(
            minx=120000, miny=485000, maxx=121000, maxy=486000, client=mock_client
        )

    assert result["NL.IMBAG.Pand.0000000000000011"]["actual_bouwlagen"] is None
    assert result["NL.IMBAG.Pand.0000000000000012"]["actual_bouwlagen"] is None
    assert result["NL.IMBAG.Pand.0000000000000013"]["actual_bouwlagen"] == 4
    assert result["NL.IMBAG.Pand.0000000000000014"]["actual_bouwlagen"] == 1


@pytest.mark.asyncio
async def test_missing_maaiveld_yields_none() -> None:
    """Feature with b3_h_dak_50p but no b3_h_maaiveld returns actual_bouwhoogte=None."""
    # Feature with dak but without maaiveld in props
    feature = {
        "id": "NL.IMBAG.Pand.0363100099999999",
        "type": "Feature",
        "properties": {
            "b3_h_dak_50p": 15.0,
            # b3_h_maaiveld intentionally absent
            "b3_bouwlagen": 4,
        },
        "geometry": {"type": "Polygon", "coordinates": [[]]},
    }
    mock_client = make_mock_client(
        get=make_mock_response(json_data=_make_feature_collection([feature]))
    )

    bag_client = BAG3DClient()

    with (
        patch(_PATCH_LIMITER, _make_limiter_mock()),
        patch(_PATCH_RETRY, new=_passthrough_retry),
    ):
        result = await bag_client.get_panden_in_bbox(
            minx=120000, miny=485000, maxx=121000, maxy=486000, client=mock_client
        )

    pand = result["NL.IMBAG.Pand.0363100099999999"]
    assert pand["actual_bouwhoogte"] is None
    # bouwlagen should still be set
    assert pand["actual_bouwlagen"] == 4


@pytest.mark.asyncio
async def test_401_raises_government_api_error() -> None:
    """HTTP 401 response must raise GovernmentAPIError mentioning Authentication."""
    mock_client = make_mock_client(get=make_mock_response(status_code=401))

    bag_client = BAG3DClient()

    with (
        patch(_PATCH_LIMITER, _make_limiter_mock()),
        patch(_PATCH_RETRY, new=_passthrough_retry),
        pytest.raises(GovernmentAPIError) as exc_info,
    ):
        await bag_client.get_panden_in_bbox(
            minx=120000, miny=485000, maxx=121000, maxy=486000, client=mock_client
        )

    assert exc_info.value.status_code == 401
    assert "Authentication" in exc_info.value.message or "auth" in exc_info.value.message.lower()


@pytest.mark.asyncio
async def test_empty_bbox_returns_empty_dict() -> None:
    """Mock response with empty features list returns empty dict without error."""
    mock_client = make_mock_client(
        get=make_mock_response(json_data=_make_feature_collection([]))
    )

    bag_client = BAG3DClient()

    with (
        patch(_PATCH_LIMITER, _make_limiter_mock()),
        patch(_PATCH_RETRY, new=_passthrough_retry),
    ):
        result = await bag_client.get_panden_in_bbox(
            minx=120000, miny=485000, maxx=121000, maxy=486000, client=mock_client
        )

    assert result == {}
