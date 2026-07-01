"""Unit tests for create_favorite_from_address (Gat 1 — opslaan vanuit de chat).

The favorite is created from an address by resolving it against the existing
ParcelCache (the map's proven, BRK-free path) → reading the stable parcel_code
→ create_favorite. See .planning/SPIKE-2026-07-01-gat1-opslaan-vanuit-chat.md.
"""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from app.favorites.favorites_service import create_favorite_from_address


def _mock_db_first(row):
    db = AsyncMock()
    result = MagicMock()
    result.first.return_value = row
    db.execute.return_value = result
    return db


@pytest.mark.asyncio
async def test_happy_path_resolves_parcel_code_and_creates_favorite():
    resolved = {
        "parcel_id": str(uuid.uuid4()),
        "address": "Venrayseweg 192, 5928RH Venlo",
        "lng": 6.126,
        "lat": 51.413,
    }
    cache_row = MagicMock(
        parcel_id="37560613570000",
        parcel_code="Venlo X 613",
        gemeente_code="GM0983",
        address="Venrayseweg 192",
    )
    db = _mock_db_first(cache_row)
    fav = MagicMock()
    with patch(
        "app.scans.parcels_service.resolve_parcel_by_address",
        new=AsyncMock(return_value=resolved),
    ), patch(
        "app.services.gemeente_name_lookup.get_gemeente_name_map",
        new=AsyncMock(return_value={"GM0983": "Venlo"}),
    ), patch(
        "app.favorites.favorites_service.create_favorite",
        new=AsyncMock(return_value=fav),
    ) as cf:
        out = await create_favorite_from_address(
            street="Venrayseweg",
            huisnummer=192,
            postcode=None,
            user_id=uuid.uuid4(),
            db=db,
            address="Venrayseweg 192, 5928 RH Venlo",
        )
    assert out is fav
    cf.assert_awaited_once()
    kwargs = cf.await_args.kwargs
    # The stable parcel_code (not the ParcelCache UUID) is what favorites store.
    assert kwargs["parcel_id"] == "Venlo X 613"
    assert kwargs["gemeente_code"] == "GM0983"
    # gemeente_naam resolved from the code so the favorite groups under Venlo.
    assert kwargs["gemeente_naam"] == "Venlo"
    # Caller-supplied display address is preferred over resolve/cache addresses.
    assert kwargs["address"] == "Venrayseweg 192, 5928 RH Venlo"


@pytest.mark.asyncio
async def test_null_parcel_code_falls_back_to_parcel_id():
    """~Half of cached parcels have no parcel_code — fall back to the kadaster
    parcel_id string, which create_favorite also accepts as a key."""
    resolved = {
        "parcel_id": str(uuid.uuid4()),
        "address": "Grote Kerkstraat 27, Venlo",
    }
    cache_row = MagicMock(
        parcel_id="37560541370000",
        parcel_code=None,
        gemeente_code="GM0983",
        address="Grote Kerkstraat 27",
    )
    db = _mock_db_first(cache_row)
    fav = MagicMock()
    with patch(
        "app.scans.parcels_service.resolve_parcel_by_address",
        new=AsyncMock(return_value=resolved),
    ), patch(
        "app.services.gemeente_name_lookup.get_gemeente_name_map",
        new=AsyncMock(return_value={"GM0983": "Venlo"}),
    ), patch(
        "app.favorites.favorites_service.create_favorite",
        new=AsyncMock(return_value=fav),
    ) as cf:
        out = await create_favorite_from_address(
            street="Grote Kerkstraat", huisnummer=27, postcode=None,
            user_id=uuid.uuid4(), db=db,
        )
    assert out is fav
    assert cf.await_args.kwargs["parcel_id"] == "37560541370000"
    assert cf.await_args.kwargs["gemeente_naam"] == "Venlo"


@pytest.mark.asyncio
async def test_missing_cache_row_returns_404():
    resolved = {"parcel_id": str(uuid.uuid4()), "address": None}
    db = _mock_db_first(None)
    with patch(
        "app.scans.parcels_service.resolve_parcel_by_address",
        new=AsyncMock(return_value=resolved),
    ):
        with pytest.raises(HTTPException) as exc:
            await create_favorite_from_address(
                street="Onbekend", huisnummer=1, postcode=None,
                user_id=uuid.uuid4(), db=db,
            )
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_resolve_404_propagates():
    db = AsyncMock()
    with patch(
        "app.scans.parcels_service.resolve_parcel_by_address",
        new=AsyncMock(
            side_effect=HTTPException(status_code=404, detail="Parcel not found for address")
        ),
    ):
        with pytest.raises(HTTPException) as exc:
            await create_favorite_from_address(
                street="X", huisnummer=1, postcode=None,
                user_id=uuid.uuid4(), db=db,
            )
    assert exc.value.status_code == 404
    # DB is never touched when resolution fails.
    db.execute.assert_not_awaited()
