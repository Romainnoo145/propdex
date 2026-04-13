"""Unit tests for _resolve_ancestor_chain — M045/S02 T02.

Tests cover the four branches of the ancestor chain resolver:
- Full chain (parcel with gemeente + provincie)
- Parcel with NULL gemeente_code (landelijk only)
- Parcel with gemeente_code not in gemeente_provincie_map (gemeente, no provincie)
- Parcel UUID not found in parcel_cache (landelijk only)

The test_db fixture drops and recreates all tables per test, so the
migration-seeded gemeente_provincie_map rows are NOT present — each test
that needs them must seed them explicitly.
"""

import uuid

from geoalchemy2 import WKTElement
from sqlalchemy.ext.asyncio import AsyncSession

from app.documents.cascade_service import _resolve_ancestor_chain
from app.models.gemeente_provincie_map import GemeenteProvincieMap
from app.models.parcel_cache import ParcelCache

# ---------------------------------------------------------------------------
# Minimal geometry helper — MULTIPOLYGON in EPSG:28992 (RD New)
# ---------------------------------------------------------------------------

_DUMMY_GEOMETRY = WKTElement(
    "MULTIPOLYGON(((155000 463000, 155010 463000, 155010 463010, 155000 463010, 155000 463000)))",
    srid=28992,
)


async def _seed_parcel(
    db: AsyncSession,
    *,
    parcel_uuid: uuid.UUID,
    gemeente_code: str | None,
    kadaster_id: str = "TST-ANCH-0001",
) -> ParcelCache:
    """Insert a minimal ParcelCache row and return it after flush."""
    parcel = ParcelCache(
        id=parcel_uuid,
        parcel_id=kadaster_id,
        geometry=_DUMMY_GEOMETRY,
        gemeente_code=gemeente_code,
    )
    db.add(parcel)
    await db.flush()
    return parcel


async def _seed_gemeente_map(
    db: AsyncSession,
    gemeente_code: str,
    provincie_code: str,
) -> None:
    """Insert a GemeenteProvincieMap row and flush."""
    row = GemeenteProvincieMap(
        gemeente_code=gemeente_code,
        provincie_code=provincie_code,
    )
    db.add(row)
    await db.flush()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


async def test_venlo_parcel_returns_full_chain(test_db: AsyncSession) -> None:
    """Parcel with gemeente_code + matching provincie entry → full 3-level chain."""
    parcel_uuid = uuid.uuid4()
    await _seed_parcel(
        test_db,
        parcel_uuid=parcel_uuid,
        gemeente_code="GM0983",
        kadaster_id="NL.IMKAD.0983test",
    )
    await _seed_gemeente_map(test_db, gemeente_code="GM0983", provincie_code="PV31")
    await test_db.commit()

    result = await _resolve_ancestor_chain(str(parcel_uuid), test_db)

    assert result == {"landelijk": "NL", "gemeente": "GM0983", "provincie": "PV31"}


async def test_null_gemeente_code_returns_landelijk_only(test_db: AsyncSession) -> None:
    """Parcel with gemeente_code=NULL → only landelijk in chain."""
    parcel_uuid = uuid.uuid4()
    await _seed_parcel(
        test_db,
        parcel_uuid=parcel_uuid,
        gemeente_code=None,
        kadaster_id="NL.IMKAD.nullgemeente",
    )
    await test_db.commit()

    result = await _resolve_ancestor_chain(str(parcel_uuid), test_db)

    assert result == {"landelijk": "NL"}


async def test_unknown_gemeente_missing_from_map(test_db: AsyncSession) -> None:
    """Parcel with gemeente_code not in gemeente_provincie_map → gemeente present, no provincie."""
    parcel_uuid = uuid.uuid4()
    await _seed_parcel(
        test_db,
        parcel_uuid=parcel_uuid,
        gemeente_code="GM9999",
        kadaster_id="NL.IMKAD.9999test",
    )
    # Deliberately NOT seeding GM9999 in gemeente_provincie_map
    await test_db.commit()

    result = await _resolve_ancestor_chain(str(parcel_uuid), test_db)

    assert result == {"landelijk": "NL", "gemeente": "GM9999"}
    assert "provincie" not in result


async def test_nonexistent_parcel_id_returns_landelijk_only(test_db: AsyncSession) -> None:
    """UUID that doesn't exist in parcel_cache → only landelijk returned."""
    fake_uuid = str(uuid.uuid4())

    result = await _resolve_ancestor_chain(fake_uuid, test_db)

    assert result == {"landelijk": "NL"}
