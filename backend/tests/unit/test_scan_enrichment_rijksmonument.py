"""Unit tests for M046/S05: rijksmonument lookup in batch_fetch_environmental_data.

Iron-rule scope: the scan pipeline (area_scan → batch_fetch_environmental_data)
MUST call the RCE client and return a 'rijksmonument' key per parcel. Pre-S05
the key did not exist; post-S05 it returns either a monument dict or
{"is_monument": False} based on RCE response.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import httpx
import pytest

from app.services.scan_enrichment import batch_fetch_environmental_data


@pytest.fixture
def centroids():
    """Single parcel fixture with known RD coords (Venlo area)."""
    return [("parcel-uuid-1", 208000.0, 375000.0)]


async def _noop_async_client():
    async with httpx.AsyncClient() as client:
        yield client


@pytest.fixture
async def http_client():
    async with httpx.AsyncClient() as client:
        yield client


@pytest.mark.asyncio
async def test_fetch_rijksmonument_hit_populates_flag(centroids, http_client):
    """When RCE returns a monument doc, rijksmonument dict contains is_monument=True + naam."""
    hit_doc = {
        "rce_objrijksnr": "12345",
        "rce_objnaam": "Historisch Pand Venlo",
        "abc_beschrijving": "17e-eeuws koopmanshuis",
    }
    with (
        patch(
            "app.services.scan_enrichment._rce_client.query_by_location",
            new=AsyncMock(return_value=[hit_doc]),
        ),
        patch(
            "app.services.scan_enrichment.pdok_natura2000_client.get_nearest",
            new=AsyncMock(return_value=None),
        ),
        patch(
            "app.services.scan_enrichment.rws_overstromingen_client.get_risk_at_point",
            new=AsyncMock(return_value=None),
        ),
        patch(
            "app.services.scan_enrichment.rivm_geluid_client.get_noise_at_point",
            new=AsyncMock(return_value=None),
        ),
        patch(
            "app.services.scan_enrichment.rivm_luchtkwaliteit_client.get_air_quality_at_point",
            new=AsyncMock(return_value=None),
        ),
    ):
        result = await batch_fetch_environmental_data(centroids, http_client)

    assert "parcel-uuid-1" in result
    parcel_env = result["parcel-uuid-1"]
    assert "rijksmonument" in parcel_env, (
        "Iron-rule: rijksmonument key MUST exist in env_enrichment output"
    )
    rm = parcel_env["rijksmonument"]
    assert rm is not None
    assert rm["is_monument"] is True
    assert rm["rce_objrijksnr"] == "12345"
    assert rm["rce_objnaam"] == "Historisch Pand Venlo"


@pytest.mark.asyncio
async def test_fetch_rijksmonument_no_match_populates_false(centroids, http_client):
    """When RCE returns empty list, rijksmonument dict = {is_monument: False}."""
    with (
        patch(
            "app.services.scan_enrichment._rce_client.query_by_location",
            new=AsyncMock(return_value=[]),
        ),
        patch(
            "app.services.scan_enrichment.pdok_natura2000_client.get_nearest",
            new=AsyncMock(return_value=None),
        ),
        patch(
            "app.services.scan_enrichment.rws_overstromingen_client.get_risk_at_point",
            new=AsyncMock(return_value=None),
        ),
        patch(
            "app.services.scan_enrichment.rivm_geluid_client.get_noise_at_point",
            new=AsyncMock(return_value=None),
        ),
        patch(
            "app.services.scan_enrichment.rivm_luchtkwaliteit_client.get_air_quality_at_point",
            new=AsyncMock(return_value=None),
        ),
    ):
        result = await batch_fetch_environmental_data(centroids, http_client)

    rm = result["parcel-uuid-1"]["rijksmonument"]
    assert rm is not None
    assert rm["is_monument"] is False


@pytest.mark.asyncio
async def test_fetch_rijksmonument_api_error_returns_none(centroids, http_client):
    """When RCE raises, rijksmonument = None (non-fatal, logged warning)."""
    with (
        patch(
            "app.services.scan_enrichment._rce_client.query_by_location",
            new=AsyncMock(side_effect=RuntimeError("RCE timeout")),
        ),
        patch(
            "app.services.scan_enrichment.pdok_natura2000_client.get_nearest",
            new=AsyncMock(return_value=None),
        ),
        patch(
            "app.services.scan_enrichment.rws_overstromingen_client.get_risk_at_point",
            new=AsyncMock(return_value=None),
        ),
        patch(
            "app.services.scan_enrichment.rivm_geluid_client.get_noise_at_point",
            new=AsyncMock(return_value=None),
        ),
        patch(
            "app.services.scan_enrichment.rivm_luchtkwaliteit_client.get_air_quality_at_point",
            new=AsyncMock(return_value=None),
        ),
    ):
        result = await batch_fetch_environmental_data(centroids, http_client)

    rm = result["parcel-uuid-1"]["rijksmonument"]
    assert rm is None, "API errors must degrade gracefully to None — downstream fallback in score_monument"
