"""Unit tests for BodemloketClient ArcGIS REST spatial query (Phase 68)."""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from tests.api_mocks import make_mock_response, make_mock_client
from app.government_apis.bodemloket_arcgis import BodemloketClient
from app.schemas.bodem import BodemData, WBBDossierRef


# Confirmed live response field from SPIKE.md (WBB_DOSSIER_DBK=17892535 — second feature at ±25m)
_SINGLE_FEATURE_RESPONSE = {
    "type": "FeatureCollection",
    "features": [
        {
            "properties": {
                "WBB_DOSSIER_DBK": 17892535,
                "SIKB_ID": "0200880020071119121157056",
                "TYPE_CD": "20",
                "VERVOLG_WBB": "voldoende onderzocht",
                "STATUSVER": None,
                "STATUS_OORD": "niet ernstig, plaatselijk sterk verontreinigd",
                "ADMINISTRATOR_NM": "Schiermonnikoog",
                "LOCATIECODE_BEVOEGD_GEZAG": "FR008800069",
                "BIS_LOCCODE": "NZ008800004",
            }
        }
    ],
}

_EMPTY_FEATURE_RESPONSE = {
    "type": "FeatureCollection",
    "features": [],
}

_ALL_FIELDS_FEATURE_RESPONSE = {
    "type": "FeatureCollection",
    "features": [
        {
            "properties": {
                "WBB_DOSSIER_DBK": 17892511,
                "SIKB_ID": "0206060720071119121106654",
                "TYPE_CD": "20",
                "VERVOLG_WBB": "voldoende onderzocht",
                "STATUSVER": "gesaneerd",
                "STATUS_OORD": "niet ernstig, licht tot matig verontreinigd",
                "ADMINISTRATOR_NM": "Schiermonnikoog",
                "LOCATIECODE_BEVOEGD_GEZAG": "FR008800079",
                "BIS_LOCCODE": "NZ060600001",
            }
        }
    ],
}


def _make_limiter_mock() -> AsyncMock:
    """Create a no-op async context manager mock for the rate limiter."""
    limiter = AsyncMock()
    limiter.__aenter__ = AsyncMock(return_value=None)
    limiter.__aexit__ = AsyncMock(return_value=None)
    return limiter


@pytest.mark.asyncio
async def test_query_returns_bodemdata_with_dossiers():
    """BODEM-01/BODEM-02: query_by_point with matching features returns BodemData with dossiers."""
    mock_client = make_mock_client(get=make_mock_response(json_data=_SINGLE_FEATURE_RESPONSE))
    bodem_client = BodemloketClient()

    with (
        patch("app.government_apis.bodemloket_arcgis.bodemloket_limiter", _make_limiter_mock()),
        patch(
            "app.government_apis.bodemloket_arcgis.retry_with_backoff",
            side_effect=lambda fn, **kwargs: fn(),
        ),
    ):
        result = await bodem_client.query_by_point(x=206259, y=610965, client=mock_client)

    assert isinstance(result, BodemData)
    assert len(result.dossiers) == 1
    assert result.dossiers[0].wbb_dossier_dbk == 17892535
    assert result.dossiers[0].administrator_nm == "Schiermonnikoog"


@pytest.mark.asyncio
async def test_query_empty_features_returns_bodemdata_not_error():
    """BODEM-03: empty feature collection returns BodemData(dossiers=[]) — not an error."""
    mock_client = make_mock_client(get=make_mock_response(json_data=_EMPTY_FEATURE_RESPONSE))
    bodem_client = BodemloketClient()

    with (
        patch("app.government_apis.bodemloket_arcgis.bodemloket_limiter", _make_limiter_mock()),
        patch(
            "app.government_apis.bodemloket_arcgis.retry_with_backoff",
            side_effect=lambda fn, **kwargs: fn(),
        ),
    ):
        result = await bodem_client.query_by_point(x=208888, y=378594, client=mock_client)

    assert isinstance(result, BodemData)
    assert result.dossiers == []


@pytest.mark.asyncio
async def test_disclaimer_always_present():
    """BODEM-03: disclaimer is always non-empty regardless of feature count."""
    bodem_client = BodemloketClient()

    for json_data in [_SINGLE_FEATURE_RESPONSE, _EMPTY_FEATURE_RESPONSE]:
        mock_client = make_mock_client(get=make_mock_response(json_data=json_data))
        with (
            patch("app.government_apis.bodemloket_arcgis.bodemloket_limiter", _make_limiter_mock()),
            patch(
                "app.government_apis.bodemloket_arcgis.retry_with_backoff",
                side_effect=lambda fn, **kwargs: fn(),
            ),
        ):
            result = await bodem_client.query_by_point(x=206259, y=610965, client=mock_client)

        assert result.disclaimer is not None
        assert len(result.disclaimer) > 0


@pytest.mark.asyncio
async def test_disclaimer_text_mentions_bodemloket():
    """BODEM-03: disclaimer must mention Bodemloket (per confirmed DISCLAIMER constant)."""
    mock_client = make_mock_client(get=make_mock_response(json_data=_EMPTY_FEATURE_RESPONSE))
    bodem_client = BodemloketClient()

    with (
        patch("app.government_apis.bodemloket_arcgis.bodemloket_limiter", _make_limiter_mock()),
        patch(
            "app.government_apis.bodemloket_arcgis.retry_with_backoff",
            side_effect=lambda fn, **kwargs: fn(),
        ),
    ):
        result = await bodem_client.query_by_point(x=208888, y=378594, client=mock_client)

    assert "Bodemloket" in result.disclaimer


@pytest.mark.asyncio
async def test_http_error_raises_government_api_error():
    """HTTP 500 from ArcGIS must raise GovernmentAPIError — not swallowed."""
    from app.government_apis.base import GovernmentAPIError

    mock_client = make_mock_client(get=make_mock_response(status_code=500))
    bodem_client = BodemloketClient()

    with (
        patch("app.government_apis.bodemloket_arcgis.bodemloket_limiter", _make_limiter_mock()),
        patch(
            "app.government_apis.bodemloket_arcgis.retry_with_backoff",
            side_effect=lambda fn, **kwargs: fn(),
        ),
        pytest.raises(GovernmentAPIError),
    ):
        await bodem_client.query_by_point(x=206259, y=610965, client=mock_client)


@pytest.mark.asyncio
async def test_query_builds_envelope_with_buffer():
    """BUFFER_M: bbox passed to client.get must be x±buffer, y±buffer (SPIKE: BUFFER_M=10)."""
    mock_client = make_mock_client(get=make_mock_response(json_data=_EMPTY_FEATURE_RESPONSE))
    bodem_client = BodemloketClient()

    with (
        patch("app.government_apis.bodemloket_arcgis.bodemloket_limiter", _make_limiter_mock()),
        patch(
            "app.government_apis.bodemloket_arcgis.retry_with_backoff",
            side_effect=lambda fn, **kwargs: fn(),
        ),
    ):
        await bodem_client.query_by_point(x=100000, y=400000, client=mock_client, buffer_m=25)

    # Inspect the params kwarg passed to client.get
    call_args = mock_client.get.call_args
    params = call_args.kwargs.get("params") or call_args.args[1] if len(call_args.args) > 1 else call_args.kwargs.get("params")
    # The geometry value should contain the bbox string
    geometry_param = params.get("geometry") if params else None
    assert geometry_param is not None
    assert "99975" in geometry_param  # x - 25 = 99975
    assert "399975" in geometry_param  # y - 25 = 399975
    assert "100025" in geometry_param  # x + 25 = 100025
    assert "400025" in geometry_param  # y + 25 = 400025


@pytest.mark.asyncio
async def test_parse_all_fields():
    """BODEM-02: All 9 confirmed WBB fields must be parsed into WBBDossierRef correctly."""
    mock_client = make_mock_client(get=make_mock_response(json_data=_ALL_FIELDS_FEATURE_RESPONSE))
    bodem_client = BodemloketClient()

    with (
        patch("app.government_apis.bodemloket_arcgis.bodemloket_limiter", _make_limiter_mock()),
        patch(
            "app.government_apis.bodemloket_arcgis.retry_with_backoff",
            side_effect=lambda fn, **kwargs: fn(),
        ),
    ):
        result = await bodem_client.query_by_point(x=206259, y=610965, client=mock_client)

    assert len(result.dossiers) == 1
    d = result.dossiers[0]
    assert isinstance(d, WBBDossierRef)
    assert d.wbb_dossier_dbk == 17892511
    assert d.sikb_id == "0206060720071119121106654"
    assert d.type_cd == "20"
    assert d.vervolg_wbb == "voldoende onderzocht"
    assert d.statusver == "gesaneerd"
    assert d.status_oord == "niet ernstig, licht tot matig verontreinigd"
    assert d.administrator_nm == "Schiermonnikoog"
    assert d.locatiecode_bevoegd_gezag == "FR008800079"
    assert d.bis_loccode == "NZ060600001"


@pytest.mark.asyncio
async def test_insrc_is_28992():
    """inSR=28992 must be passed to ensure RD New coordinates are used."""
    mock_client = make_mock_client(get=make_mock_response(json_data=_EMPTY_FEATURE_RESPONSE))
    bodem_client = BodemloketClient()

    with (
        patch("app.government_apis.bodemloket_arcgis.bodemloket_limiter", _make_limiter_mock()),
        patch(
            "app.government_apis.bodemloket_arcgis.retry_with_backoff",
            side_effect=lambda fn, **kwargs: fn(),
        ),
    ):
        await bodem_client.query_by_point(x=206259, y=610965, client=mock_client)

    call_args = mock_client.get.call_args
    params = call_args.kwargs.get("params") or {}
    assert params.get("inSR") == "28992"
