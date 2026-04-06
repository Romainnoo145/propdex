"""Unit tests for _resolve_addresses() in backfill_address_turbo.

Verifies that empty parcels (has_pand=False) and parcels with no geometry
are skipped during address resolution — preventing incorrect neighbor
addresses from being assigned to undeveloped land.
"""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.parcel_addressing import AddressResolution


# ---------------------------------------------------------------------------
# Helpers — lightweight mock objects
# ---------------------------------------------------------------------------

def _make_parcel_cache(
    parcel_id: str,
    has_pand: bool = True,
    geometry=None,
) -> MagicMock:
    """Build a mock ParcelCache with the fields _resolve_addresses reads."""
    pc = MagicMock()
    pc.parcel_id = parcel_id
    pc.has_pand = has_pand
    if geometry is None and has_pand:
        # Default: valid WKBElement-like geometry whose to_shape returns a point
        pc.geometry = MagicMock()  # truthy, non-None
    else:
        pc.geometry = geometry
    return pc


def _make_scan_result() -> MagicMock:
    return MagicMock()


def _make_rows(specs: list[dict]) -> list[tuple]:
    """Build a list of (ScanResult, ParcelCache) tuples from specs.

    Each spec: {"parcel_id": str, "has_pand": bool, "geometry": Any | sentinel}
    """
    rows = []
    for spec in specs:
        sr = _make_scan_result()
        pc = _make_parcel_cache(
            parcel_id=spec["parcel_id"],
            has_pand=spec.get("has_pand", True),
            geometry=spec.get("geometry", None),  # None → helper assigns default if has_pand
        )
        # If geometry was explicitly set to None in the spec, force it
        if "geometry" in spec and spec["geometry"] is None:
            pc.geometry = None
        rows.append((sr, pc))
    return rows


# Shared mock address resolution result
_VALID_RESOLUTION = AddressResolution(
    address="Kaldenkerkerweg 20, 5913AH Venlo",
    postcode="5913AH",
    nummeraanduiding_id="0983200000012345",
    vbo_id="0983010000054321",
)

# Shapely-like centroid mock
def _mock_to_shape(wkb_elem):
    """Return a mock shape whose centroid is a fixed RD point."""
    shape = MagicMock()
    centroid = MagicMock()
    centroid.x = 155005.0
    centroid.y = 463005.0
    shape.centroid = centroid
    return shape


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@patch("app.tools.backfill_address_turbo.to_shape", side_effect=_mock_to_shape)
@patch("app.tools.backfill_address_turbo.reverse_geocode_rd_point_full", new_callable=AsyncMock)
async def test_resolve_addresses_skips_empty_parcels(mock_geocode, mock_shape):
    """Parcels with has_pand=False must NOT trigger reverse_geocode_rd_point_full."""
    from app.tools.backfill_address_turbo import _resolve_addresses

    mock_geocode.return_value = _VALID_RESOLUTION

    rows = _make_rows([
        {"parcel_id": "EMPTY-1", "has_pand": False},
        {"parcel_id": "EMPTY-2", "has_pand": False},
        {"parcel_id": "VALID-1", "has_pand": True},
    ])

    client = AsyncMock()
    postcodes, vbo_ids, na_ids = await _resolve_addresses(rows, client)

    # Geocode should only be called once — for VALID-1
    assert mock_geocode.call_count == 1
    assert "VALID-1" in postcodes
    assert "EMPTY-1" not in postcodes
    assert "EMPTY-2" not in postcodes


@pytest.mark.asyncio
@patch("app.tools.backfill_address_turbo.to_shape", side_effect=_mock_to_shape)
@patch("app.tools.backfill_address_turbo.reverse_geocode_rd_point_full", new_callable=AsyncMock)
async def test_resolve_addresses_skips_none_geometry(mock_geocode, mock_shape):
    """Parcels with geometry=None must be skipped (existing behavior)."""
    from app.tools.backfill_address_turbo import _resolve_addresses

    mock_geocode.return_value = _VALID_RESOLUTION

    rows = _make_rows([
        {"parcel_id": "NO-GEOM", "has_pand": True, "geometry": None},
        {"parcel_id": "VALID-1", "has_pand": True},
    ])

    client = AsyncMock()
    postcodes, vbo_ids, na_ids = await _resolve_addresses(rows, client)

    # Only VALID-1 should be geocoded
    assert mock_geocode.call_count == 1
    assert "VALID-1" in postcodes
    assert "NO-GEOM" not in postcodes


@pytest.mark.asyncio
@patch("app.tools.backfill_address_turbo.to_shape", side_effect=_mock_to_shape)
@patch("app.tools.backfill_address_turbo.reverse_geocode_rd_point_full", new_callable=AsyncMock)
async def test_resolve_addresses_collects_postcodes_and_vbos(mock_geocode, mock_shape):
    """For valid parcels, postcodes/vbo_ids/na_ids dicts are populated correctly."""
    from app.tools.backfill_address_turbo import _resolve_addresses

    mock_geocode.return_value = _VALID_RESOLUTION

    rows = _make_rows([
        {"parcel_id": "P1", "has_pand": True},
        {"parcel_id": "P2", "has_pand": True},
    ])

    client = AsyncMock()
    postcodes, vbo_ids, na_ids = await _resolve_addresses(rows, client)

    assert mock_geocode.call_count == 2
    # Both parcels should have entries
    assert postcodes == {"P1": "5913AH", "P2": "5913AH"}
    assert vbo_ids == {"P1": "0983010000054321", "P2": "0983010000054321"}
    assert na_ids == {"P1": "0983200000012345", "P2": "0983200000012345"}
