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


def _make_city_object(
    pand_id: str,
    dak: float | None,
    maaiveld: float | None,
    bouwlagen: float | None,
    *,
    include_child: bool = False,
) -> dict:
    """Build a CityJSON feature with CityObjects dict.

    The 3D BAG API returns CityJSON format where each feature contains a
    CityObjects dict keyed by pand ID. Child geometry features have a "-N"
    suffix and should be filtered out by the client.
    """
    attrs: dict = {"identificatie": pand_id}
    if dak is not None:
        attrs["b3_h_dak_50p"] = dak
    if maaiveld is not None:
        attrs["b3_h_maaiveld"] = maaiveld
    if bouwlagen is not None:
        attrs["b3_bouwlagen"] = bouwlagen

    city_objects: dict = {
        pand_id: {
            "attributes": attrs,
            "type": "Building",
        }
    }

    if include_child:
        child_id = f"{pand_id}-0"
        city_objects[child_id] = {
            "attributes": {**attrs, "identificatie": child_id},
            "type": "BuildingPart",
        }

    return {
        "CityObjects": city_objects,
        "id": pand_id,
        "type": "CityJSONFeature",
        "vertices": [],
    }


def _make_cityjson_collection(features: list[dict]) -> dict:
    """Wrap CityJSON features in a collection response."""
    return {
        "type": "FeatureCollection",
        "features": features,
        "numberReturned": len(features),
        "numberMatched": len(features),
    }


_PATCH_LIMITER = "app.government_apis.bag_3d.bag_3d_limiter"
_PATCH_RETRY = "app.government_apis.bag_3d.retry_with_backoff"


# --- Tests --------------------------------------------------------------------


@pytest.mark.asyncio
async def test_single_page_response() -> None:
    """Single page (<1000 features) returns dict with correct pand IDs and values."""
    features = [
        _make_city_object("NL.IMBAG.Pand.0363100012345678", dak=15.3, maaiveld=2.1, bouwlagen=4),
        _make_city_object("NL.IMBAG.Pand.0363100012345679", dak=8.0, maaiveld=0.5, bouwlagen=2),
        _make_city_object("NL.IMBAG.Pand.0363100012345680", dak=22.6, maaiveld=1.0, bouwlagen=7),
    ]
    response_data = _make_cityjson_collection(features)
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
        _make_city_object(f"NL.IMBAG.Pand.{i:016d}", dak=10.0, maaiveld=0.0, bouwlagen=3)
        for i in range(1000)
    ]
    # Build 500 features for page 2
    page2_features = [
        _make_city_object(f"NL.IMBAG.Pand.{i:016d}", dak=12.0, maaiveld=0.5, bouwlagen=4)
        for i in range(1000, 1500)
    ]

    page1_response = make_mock_response(json_data=_make_cityjson_collection(page1_features))
    page2_response = make_mock_response(json_data=_make_cityjson_collection(page2_features))

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
        _make_city_object("NL.IMBAG.Pand.0000000000000001", dak=1.0, maaiveld=0.5, bouwlagen=1),
        # Height = 201.0m — above max (200.0m)
        _make_city_object("NL.IMBAG.Pand.0000000000000002", dak=202.0, maaiveld=1.0, bouwlagen=50),
        # Height = 12.5m — within bounds
        _make_city_object("NL.IMBAG.Pand.0000000000000003", dak=13.0, maaiveld=0.5, bouwlagen=4),
        # Height exactly at lower bound = 1.5m — should be valid
        _make_city_object("NL.IMBAG.Pand.0000000000000004", dak=2.0, maaiveld=0.5, bouwlagen=1),
    ]
    mock_client = make_mock_client(get=make_mock_response(json_data=_make_cityjson_collection(features)))

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
        _make_city_object("NL.IMBAG.Pand.0000000000000011", dak=5.0, maaiveld=0.5, bouwlagen=0),
        # bouwlagen=101 — above max (100)
        _make_city_object("NL.IMBAG.Pand.0000000000000012", dak=300.0, maaiveld=0.5, bouwlagen=101),
        # bouwlagen=3.6 — valid, should round to 4
        _make_city_object("NL.IMBAG.Pand.0000000000000013", dak=12.0, maaiveld=0.5, bouwlagen=3.6),
        # bouwlagen=1 — exactly at lower bound
        _make_city_object("NL.IMBAG.Pand.0000000000000014", dak=4.0, maaiveld=0.5, bouwlagen=1),
    ]
    mock_client = make_mock_client(get=make_mock_response(json_data=_make_cityjson_collection(features)))

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
    feature = _make_city_object(
        "NL.IMBAG.Pand.0363100099999999", dak=15.0, maaiveld=None, bouwlagen=4
    )
    mock_client = make_mock_client(
        get=make_mock_response(json_data=_make_cityjson_collection([feature]))
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
        get=make_mock_response(json_data=_make_cityjson_collection([]))
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


@pytest.mark.asyncio
async def test_child_features_filtered_out() -> None:
    """Child geometry features (e.g. 'NL.IMBAG.Pand.xxx-0') are excluded from results."""
    features = [
        _make_city_object(
            "NL.IMBAG.Pand.0984100001093000",
            dak=12.0,
            maaiveld=2.0,
            bouwlagen=3,
            include_child=True,
        ),
    ]
    mock_client = make_mock_client(
        get=make_mock_response(json_data=_make_cityjson_collection(features))
    )

    bag_client = BAG3DClient()

    with (
        patch(_PATCH_LIMITER, _make_limiter_mock()),
        patch(_PATCH_RETRY, new=_passthrough_retry),
    ):
        result = await bag_client.get_panden_in_bbox(
            minx=204000, miny=394000, maxx=205000, maxy=395000, client=mock_client
        )

    # Only parent pand should be in results, not the child "-0" feature
    assert len(result) == 1
    assert "NL.IMBAG.Pand.0984100001093000" in result
    assert "NL.IMBAG.Pand.0984100001093000-0" not in result
    assert result["NL.IMBAG.Pand.0984100001093000"]["actual_bouwhoogte"] == 10.0
    assert result["NL.IMBAG.Pand.0984100001093000"]["actual_bouwlagen"] == 3
