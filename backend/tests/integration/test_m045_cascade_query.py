"""Integration tests for cascade query correctness — M045/S02 T04.

Verifies that for_parcel() correctly:
- Returns the latest version per (entity_type, entity_code, source_key) triple
- Excludes is_global=false rows
- Returns only matching ancestor chain levels
- Returns empty lists when no policy_documents exist for a parcel's geography

Each test seeds everything it needs; migration-seeded rows are absent because
test_db drops+recreates all tables per test.
"""

import uuid
from types import SimpleNamespace
from typing import Any

import pytest
from geoalchemy2 import WKTElement
from sqlalchemy.ext.asyncio import AsyncSession

from app.documents.cascade_service import for_parcel
from app.models.gemeente_provincie_map import GemeenteProvincieMap
from app.models.organization import Organization
from app.models.parcel_cache import ParcelCache
from app.models.policy_document import PolicyDocument
from app.models.user import User

# ---------------------------------------------------------------------------
# Minimal geometry helper — MULTIPOLYGON in EPSG:28992 (RD New)
# ---------------------------------------------------------------------------

_DUMMY_GEOMETRY = WKTElement(
    "MULTIPOLYGON(((155000 463000, 155010 463000, 155010 463010, 155000 463010, 155000 463000)))",
    srid=28992,
)


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------


async def _make_vendor_user(
    db: AsyncSession,
    email: str = "vendor@fixture.example",
) -> tuple[User, Organization]:
    """Create a minimal vendor org + user for FK satisfaction on policy_documents."""
    org = Organization(name="Vendor Org")
    db.add(org)
    await db.flush()

    user = User(
        email=email,
        hashed_password="hashed_dummy",
        full_name="Vendor User",
        organization_id=org.id,
        email_verified=True,
        auth_provider="email",
        is_active=True,
    )
    db.add(user)
    await db.flush()
    return user, org


def _make_policy_doc(
    *,
    entity_type: str,
    entity_code: str,
    source_key: str,
    version_number: int,
    is_global: bool,
    user_id: uuid.UUID,
    org_id: uuid.UUID,
) -> PolicyDocument:
    """Construct a PolicyDocument ORM object with all required fields populated."""
    return PolicyDocument(
        entity_type=entity_type,
        entity_code=entity_code,
        source_key=source_key,
        filename=f"{source_key}_v{version_number}.pdf",
        content_type="application/pdf",
        file_data=b"test content",
        file_size=12,
        uploaded_by_user_id=user_id,
        organization_id=org_id,
        status="uploaded",
        is_global=is_global,
        version_number=version_number,
    )


# ---------------------------------------------------------------------------
# Fixture — seeded_cascade_world
# ---------------------------------------------------------------------------


@pytest.fixture
async def seeded_cascade_world(test_db: AsyncSession) -> Any:
    """Seed a realistic cascade world for Venlo (GM0983 / PV31) tests.

    Seeds:
    - gemeente_provincie_map: (GM0983, PV31) and (GM0363, PV27)
    - parcel_cache: one row for NL.IMKAD.VENLO001 in GM0983
    - policy_documents (is_global=True):
      - landelijk NL/beng v1 (older — must NOT win)
      - landelijk NL/beng v2 (newest — must win)
      - provincie PV31/povi v1 (Limburg — in scope)
      - provincie PV26/omgevingsverordening v1 (Utrecht — NOT in scope)
      - gemeente GM0983/welstand v1 (older — must NOT win)
      - gemeente GM0983/welstand v2 (newest — must win)
      - gemeente GM1507/welstand v1 (Horst — NOT in scope)
    - policy_documents (is_global=False):
      - gemeente GM0983/secret v1 (must be EXCLUDED by cascade query)

    Returns a SimpleNamespace with venlo_parcel_id and org_id.
    """
    user, org = await _make_vendor_user(test_db)

    # gemeente_provincie_map
    test_db.add(GemeenteProvincieMap(gemeente_code="GM0983", provincie_code="PV31"))
    test_db.add(GemeenteProvincieMap(gemeente_code="GM0363", provincie_code="PV27"))
    await test_db.flush()

    # parcel_cache — Venlo
    venlo_kadaster_id = "NL.IMKAD.VENLO001"
    test_db.add(
        ParcelCache(
            id=uuid.uuid4(),
            parcel_id=venlo_kadaster_id,
            geometry=_DUMMY_GEOMETRY,
            gemeente_code="GM0983",
        )
    )
    await test_db.flush()

    # policy_documents — is_global=True
    docs = [
        _make_policy_doc(
            entity_type="landelijk", entity_code="NL", source_key="beng",
            version_number=1, is_global=True, user_id=user.id, org_id=org.id,
        ),
        _make_policy_doc(
            entity_type="landelijk", entity_code="NL", source_key="beng",
            version_number=2, is_global=True, user_id=user.id, org_id=org.id,
        ),
        _make_policy_doc(
            entity_type="provincie", entity_code="PV31", source_key="povi",
            version_number=1, is_global=True, user_id=user.id, org_id=org.id,
        ),
        _make_policy_doc(
            entity_type="provincie", entity_code="PV26", source_key="omgevingsverordening",
            version_number=1, is_global=True, user_id=user.id, org_id=org.id,
        ),
        _make_policy_doc(
            entity_type="gemeente", entity_code="GM0983", source_key="welstand",
            version_number=1, is_global=True, user_id=user.id, org_id=org.id,
        ),
        _make_policy_doc(
            entity_type="gemeente", entity_code="GM0983", source_key="welstand",
            version_number=2, is_global=True, user_id=user.id, org_id=org.id,
        ),
        _make_policy_doc(
            entity_type="gemeente", entity_code="GM1507", source_key="welstand",
            version_number=1, is_global=True, user_id=user.id, org_id=org.id,
        ),
        # is_global=False — must be excluded
        _make_policy_doc(
            entity_type="gemeente", entity_code="GM0983", source_key="secret",
            version_number=1, is_global=False, user_id=user.id, org_id=org.id,
        ),
    ]
    for doc in docs:
        test_db.add(doc)

    await test_db.commit()

    return SimpleNamespace(
        venlo_parcel_id=venlo_kadaster_id,
        org_id=org.id,
    )


# ---------------------------------------------------------------------------
# Test 1 — cascade returns correct levels
# ---------------------------------------------------------------------------


async def test_cascade_returns_levels_correctly(
    test_db: AsyncSession,
    seeded_cascade_world: Any,
) -> None:
    """Cascade for Venlo parcel returns exactly 1 doc per level, all scoped correctly."""
    world = seeded_cascade_world
    bundle = await for_parcel(world.venlo_parcel_id, world.org_id, test_db)
    cascade = bundle.cascade_policy_docs

    # landelijk: exactly 1 entry — beng v2 (not v1)
    assert len(cascade.landelijk) == 1
    assert cascade.landelijk[0].source_key == "beng"
    assert cascade.landelijk[0].version_number == 2
    assert cascade.landelijk[0].entity_code == "NL"

    # provincie: exactly 1 entry — povi PV31 (Limburg); PV26 Utrecht must not appear
    assert len(cascade.provincie) == 1
    assert cascade.provincie[0].source_key == "povi"
    assert cascade.provincie[0].entity_code == "PV31"

    # gemeente: exactly 1 entry — welstand v2 GM0983; GM1507 and v1 must not appear
    assert len(cascade.gemeente) == 1
    assert cascade.gemeente[0].source_key == "welstand"
    assert cascade.gemeente[0].entity_code == "GM0983"
    assert cascade.gemeente[0].version_number == 2


# ---------------------------------------------------------------------------
# Test 2 — is_global=false rows are excluded
# ---------------------------------------------------------------------------


async def test_cascade_excludes_is_global_false(
    test_db: AsyncSession,
    seeded_cascade_world: Any,
) -> None:
    """The is_global=false 'secret' row must never appear in any cascade list."""
    world = seeded_cascade_world
    bundle = await for_parcel(world.venlo_parcel_id, world.org_id, test_db)
    cascade = bundle.cascade_policy_docs

    all_source_keys = (
        [d.source_key for d in cascade.landelijk]
        + [d.source_key for d in cascade.provincie]
        + [d.source_key for d in cascade.gemeente]
    )
    assert "secret" not in all_source_keys, (
        "is_global=false rows must be filtered out of the cascade query"
    )


# ---------------------------------------------------------------------------
# Test 3 — latest version per source wins
# ---------------------------------------------------------------------------


async def test_cascade_returns_latest_version_per_source(
    test_db: AsyncSession,
    seeded_cascade_world: Any,
) -> None:
    """DISTINCT ON must return version 2 for beng (landelijk) and welstand (gemeente)."""
    world = seeded_cascade_world
    bundle = await for_parcel(world.venlo_parcel_id, world.org_id, test_db)
    cascade = bundle.cascade_policy_docs

    assert cascade.landelijk[0].version_number == 2, (
        "landelijk beng v2 must win over v1"
    )
    assert cascade.gemeente[0].version_number == 2, (
        "gemeente welstand v2 must win over v1"
    )

    # Confirm no v1 leaks in either list
    landelijk_versions = [d.version_number for d in cascade.landelijk]
    assert 1 not in landelijk_versions, "v1 must not leak into landelijk results"

    gemeente_versions = [d.version_number for d in cascade.gemeente]
    assert 1 not in gemeente_versions, "v1 must not leak into gemeente results"


# ---------------------------------------------------------------------------
# Test 4 — cascade filters ancestor chain when parcel has no matching gemeente
# ---------------------------------------------------------------------------


async def test_cascade_filters_ancestor_chain_when_parcel_has_no_matching_gemeente(
    test_db: AsyncSession,
    seeded_cascade_world: Any,
) -> None:
    """Cascade actively filters rows — does NOT return empty just because table is empty.

    Adds a parcel in GM0017 (not present in gemeente_provincie_map) alongside the
    existing seeded_cascade_world docs (GM0983/PV31 rows, landelijk beng v1+v2, etc.).
    The cascade query must:
    - Return beng v2 for landelijk (entity_code='NL' always matches).
    - Return nothing for provincie (GM0017 has no provincie mapping → param is None).
    - Return nothing for gemeente (no policy_document has entity_code='GM0017').
    This proves the filter path is exercised against a non-empty table.
    """
    world = seeded_cascade_world

    # Add a parcel in GM0017 — NOT in gemeente_provincie_map, so no provincie in chain
    test_db.add(
        ParcelCache(
            id=uuid.uuid4(),
            parcel_id="NL.IMKAD.EMPTY001",
            geometry=_DUMMY_GEOMETRY,
            gemeente_code="GM0017",
        )
    )
    await test_db.commit()

    bundle = await for_parcel("NL.IMKAD.EMPTY001", world.org_id, test_db)
    cascade = bundle.cascade_policy_docs

    # landelijk: beng v2 still returned — entity_code='NL' always matches
    assert len(cascade.landelijk) == 1, (
        "landelijk beng v2 must appear even for a non-Venlo parcel"
    )
    assert cascade.landelijk[0].source_key == "beng"
    assert cascade.landelijk[0].version_number == 2

    # provincie: GM0017 has no entry in gemeente_provincie_map → param is None → no match
    assert cascade.provincie == [], (
        "GM0017 has no provincie mapping → provincie must be empty"
    )

    # gemeente: no policy_document row has entity_code='GM0017' → filter returns nothing
    assert cascade.gemeente == [], (
        "no policy_documents seeded for GM0017 → gemeente must be empty"
    )


# ---------------------------------------------------------------------------
# Test 5 — landelijk only for parcel with null gemeente_code
# ---------------------------------------------------------------------------


async def test_cascade_landelijk_only_for_null_gemeente_parcel(test_db: AsyncSession) -> None:
    """Parcel with gemeente_code=None → only landelijk docs returned; provincie+gemeente empty."""
    user, org = await _make_vendor_user(test_db, email="vendor-null@fixture.example")

    # Parcel with no gemeente_code
    test_db.add(
        ParcelCache(
            id=uuid.uuid4(),
            parcel_id="NL.IMKAD.NULLGM",
            geometry=_DUMMY_GEOMETRY,
            gemeente_code=None,
        )
    )

    # Only a landelijk doc
    test_db.add(
        _make_policy_doc(
            entity_type="landelijk", entity_code="NL", source_key="beng",
            version_number=1, is_global=True, user_id=user.id, org_id=org.id,
        )
    )

    await test_db.commit()

    bundle = await for_parcel("NL.IMKAD.NULLGM", org.id, test_db)
    cascade = bundle.cascade_policy_docs

    assert len(cascade.landelijk) == 1, "landelijk beng must appear for null-gemeente parcel"
    assert cascade.landelijk[0].source_key == "beng"
    assert cascade.provincie == [], "no provincie for null-gemeente parcel"
    assert cascade.gemeente == [], "no gemeente for null-gemeente parcel"
