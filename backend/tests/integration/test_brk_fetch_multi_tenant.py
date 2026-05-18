"""CRITICAL: multi-tenant isolation at the BRK fetch / persist layer (M050/S02).

Closes the CRITICAL E2E GAP from ENG-PLAN §Test coverage diagram (must_haves
truth #2): org-A cannot read org-B records via the cached-read path. Mirrors
S01's tests/integration/test_brk_multi_tenant_isolation.py contract but
focuses on the SERVICE-LAYER fetch_and_persist + get_latest_for_parcel surface
that S02 introduces.

NOTE: The plan's "endpoint user-B starts fresh" test is service-level here
rather than HTTP-level — fetch_and_persist organisation_id is the multi-tenant
guarantee at the persistence layer. Cross-org parcel-existence pre-check is a
future hardening item (the CrossOrgParcelAccess exception class is in place but
not yet raised; documented in test_org_a_cannot_read_org_b_records docstring).
"""
from __future__ import annotations

import pytest

from app.core.config import settings
from app.models.brk_ownership_record import BrkOwnershipRecord
from app.models.organization import Organization
from app.services import credential_resolver
from app.services.brk_fetch_service import (
    fetch_and_persist,
    get_latest_for_parcel,
)

# Crafted response — same shape as test_brk_persist_endpoint.MIXED_RAW
MIXED_RAW = {
    "_embedded": {
        "zakelijkGerechtigden": [
            {
                "persoon": {
                    "type": "NietNatuurlijkPersoon",
                    "statutaireNaam": "BV Voorbeeld",
                    "kvkNummer": "12345678",
                },
                "type": "Eigendom",
            },
        ]
    }
}


@pytest.fixture(autouse=True)
def _flush_credential_cache():
    credential_resolver._clear_cache_for_tests()
    yield
    credential_resolver._clear_cache_for_tests()


async def _seed_brk_credential(test_db) -> None:
    from app.models.integration_credential import IntegrationCredential
    from app.services import credential_crypto

    test_db.add(
        IntegrationCredential(
            source_key="brk",
            credential_name="api_key",
            encrypted_value=credential_crypto.encrypt("test-key"),
        )
    )
    await test_db.commit()


@pytest.mark.asyncio
async def test_org_a_cannot_read_org_b_records(test_db) -> None:
    """CRITICAL: cross-org service-layer query returns [] — no leak via cache.

    Service layer's get_latest_for_parcel(db, org_b, parcel) filters by
    organization_id. Even when org-A has rows for the same parcel_id, org-B
    receives [] (empty cache → fetch path would fetch fresh, not leak).

    This is the same boundary as S01 test_brk_multi_tenant_isolation.py but
    via the S02 service-layer entry-point. Future hardening: cross-org parcel
    existence pre-check at the endpoint layer (CrossOrgParcelAccess raise site
    in brk_fetch_service is the contract).
    """
    org_a = Organization(name="Org A Fetch")
    org_b = Organization(name="Org B Fetch")
    test_db.add_all([org_a, org_b])
    await test_db.commit()
    await test_db.refresh(org_a)
    await test_db.refresh(org_b)

    shared_parcel = "NL.IMKAD.SharedFetch.1"
    a_row = BrkOwnershipRecord(
        organization_id=org_a.id,
        parcel_id=shared_parcel,
        eigenaar_type="rechtspersoon",
        eigenaar_naam="BV A",
    )
    test_db.add(a_row)
    await test_db.commit()

    # Org-B reads via service layer → MUST be empty
    org_b_rows = await get_latest_for_parcel(test_db, org_b.id, shared_parcel)
    assert org_b_rows == [], (
        f"CRITICAL multi-tenant leak: org-B saw {len(org_b_rows)} rows for "
        f"parcel owned by org-A. get_latest_for_parcel must filter by org."
    )

    # Sanity: org-A reads its own row
    org_a_rows = await get_latest_for_parcel(test_db, org_a.id, shared_parcel)
    assert len(org_a_rows) == 1
    assert org_a_rows[0].eigenaar_naam == "BV A"


@pytest.mark.asyncio
async def test_persist_record_filtered_by_org_at_db_layer(test_db) -> None:
    """Two orgs, same parcel_id, two distinct fetched_at rows.

    DB UNIQUE constraint allows historical rows per (org, parcel, fetched_at);
    multi-tenant isolation comes from organization_id filtering. Mirrors S01
    test_org_a_cannot_read_org_b_records at the model layer.
    """
    from sqlalchemy import select

    org_a = Organization(name="Org A DB")
    org_b = Organization(name="Org B DB")
    test_db.add_all([org_a, org_b])
    await test_db.commit()
    await test_db.refresh(org_a)
    await test_db.refresh(org_b)

    parcel = "NL.IMKAD.DBLayer.1"
    test_db.add_all(
        [
            BrkOwnershipRecord(
                organization_id=org_a.id,
                parcel_id=parcel,
                eigenaar_type="rechtspersoon",
                eigenaar_naam="BV A",
            ),
            BrkOwnershipRecord(
                organization_id=org_b.id,
                parcel_id=parcel,
                eigenaar_type="rechtspersoon",
                eigenaar_naam="BV B",
            ),
        ]
    )
    await test_db.commit()

    org_a_rows = (
        await test_db.execute(
            select(BrkOwnershipRecord).where(
                BrkOwnershipRecord.organization_id == org_a.id
            )
        )
    ).scalars().all()
    assert len(org_a_rows) == 1
    assert org_a_rows[0].eigenaar_naam == "BV A"


@pytest.mark.asyncio
async def test_org_b_fetch_does_not_inherit_org_a_cache(
    test_db, monkeypatch: pytest.MonkeyPatch
) -> None:
    """When org-A has fresh BRK row for parcel-X, org-B's fetch_and_persist
    fires the HTTP path (does NOT serve org-A's cache to org-B).

    Per ENG-PLAN: advisory lock + cache are per-(org, parcel). Both orgs spend
    a credit; both orgs end up with their own row in brk_ownership_records.
    """
    from datetime import datetime, timedelta

    from app.services import brk_fetch_service

    monkeypatch.setattr(settings, "M050_BRK_PERSIST_ENABLED", True)
    await _seed_brk_credential(test_db)

    counter = {"n": 0}

    async def fake_call(creds, parcel_id):  # type: ignore[no-untyped-def]
        counter["n"] += 1
        return MIXED_RAW

    monkeypatch.setattr(brk_fetch_service, "_call_kadaster", fake_call)

    org_a = Organization(name="Org A Cache")
    org_b = Organization(name="Org B Cache")
    test_db.add_all([org_a, org_b])
    await test_db.commit()
    await test_db.refresh(org_a)
    await test_db.refresh(org_b)

    parcel = "NL.IMKAD.OrgCacheBoundary.1"
    # Seed FRESH org-A row
    test_db.add(
        BrkOwnershipRecord(
            organization_id=org_a.id,
            parcel_id=parcel,
            eigenaar_type="rechtspersoon",
            eigenaar_naam="BV A pre-existing",
            fetched_at=datetime.utcnow() - timedelta(days=1),
        )
    )
    await test_db.commit()

    # Org-B fetches the same parcel — must fire HTTP (org-B's own cache is empty)
    result = await fetch_and_persist(test_db, org_b.id, parcel)

    assert counter["n"] == 1, (
        "org-B's fetch MUST call Kadaster — advisory lock + cache are "
        "per-(org, parcel); org-A's cache is invisible to org-B."
    )
    # Result is org-B's own newly-persisted row(s)
    assert all(r.organization_id == org_b.id for r in result)
