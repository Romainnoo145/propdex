"""REGRESSION-CRITICAL — M050/S03 multi-tenant isolation guard (F2).

Pins the ``organization_id`` filter in
``scoring_pipeline.enrich_parcel_data_with_brk``'s SQL query. Failure of
this test ⇒ silent cross-tenant BRK leak ⇒ AVG breach (rechtspersoon
ownership data, including kvk_nummer + koopsom, exposed across orgs).

Iron-rule pattern (per MEMORY.md ``feedback_iron_rule_regression_pattern``):
encode 'X must not change' as a regression test, never as a comment.

Drift-detection (manual, documented in 03-01-SUMMARY.md):
    Remove ``BrkOwnershipRecord.organization_id == org_id`` from the
    query in ``app/services/scoring_pipeline.py`` → this test fails with
    a cross-tenant leak assertion. Restore the filter → test passes.

Mirrors the S01 boundary test
``backend/tests/integration/test_brk_multi_tenant_isolation.py`` but at
the SCORING-PIPELINE layer (S03 read-path), not the S02 service-layer.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.brk_ownership_record import BrkOwnershipRecord
from app.models.organization import Organization
from app.services.scoring_pipeline import enrich_parcel_data_with_brk


def _make_record(
    org_id,
    parcel_id: str,
    eigenaar_naam: str,
) -> BrkOwnershipRecord:
    return BrkOwnershipRecord(
        organization_id=org_id,
        parcel_id=parcel_id,
        eigenaar_type="rechtspersoon",
        eigenaar_naam=eigenaar_naam,
        kvk_nummer="12345678",
        statutaire_zetel="Amsterdam",
        zakelijk_recht_type="eigendom",
        aandeel="1/1",
        koopsom=Decimal("250000.00"),
        koopjaar=2015,
        heeft_hypotheek=True,
        raw_brk_response=None,
        fetched_at=datetime.utcnow(),
        soft_deleted_at=None,
        hard_delete_after=None,
    )


@pytest.mark.asyncio
async def test_enrich_filters_by_org_id(
    test_db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """REGRESSION-CRITICAL F2: enrich must filter by organization_id.

    Setup: two orgs (A, B), same parcel_id, distinct eigenaar_naam per
    org. enrich(org_a, parcel) must return ONLY org_a's record; enrich(
    org_b, parcel) must return ONLY org_b's record; enrich(unrelated
    org, parcel) must return [].

    AVG-breach narrative: if the WHERE clause loses the organization_id
    predicate, both rows leak into either org's scoring run — kvk_nummer
    + koopsom + statutaire_zetel of one customer's holdings exposed to
    another. This is exactly the failure mode the M050 AVG Tier-3
    classification is engineered to prevent.
    """
    monkeypatch.setattr(settings, "M050_S03_FACTORS_ENABLED", True)

    # Seed two distinct organizations
    org_a = Organization(name="Org A — S03 multitenant")
    org_b = Organization(name="Org B — S03 multitenant")
    test_db.add_all([org_a, org_b])
    await test_db.commit()
    await test_db.refresh(org_a)
    await test_db.refresh(org_b)

    # Same parcel_id under both orgs — only the organization_id WHERE
    # clause separates them.
    shared_parcel_id = "NL.IMKAD.SHARED"
    test_db.add_all(
        [
            _make_record(org_a.id, shared_parcel_id, "Org-A BV"),
            _make_record(org_b.id, shared_parcel_id, "Org-B BV"),
        ]
    )
    await test_db.commit()

    # Org-A view: ONLY Org-A's record
    result_a = await enrich_parcel_data_with_brk(
        {"parcel_id": shared_parcel_id},
        org_a.id,
        test_db,
    )
    assert len(result_a["brk_records"]) == 1, (
        f"AVG breach: org_a saw {len(result_a['brk_records'])} rows for "
        f"shared parcel_id — organization_id filter dropped from query."
    )
    assert result_a["brk_records"][0]["eigenaar_naam"] == "Org-A BV", (
        "AVG breach: org_a received org_b's record (eigenaar_naam mismatch)."
    )

    # Org-B view: ONLY Org-B's record
    result_b = await enrich_parcel_data_with_brk(
        {"parcel_id": shared_parcel_id},
        org_b.id,
        test_db,
    )
    assert len(result_b["brk_records"]) == 1, (
        f"AVG breach: org_b saw {len(result_b['brk_records'])} rows for "
        f"shared parcel_id — organization_id filter dropped from query."
    )
    assert result_b["brk_records"][0]["eigenaar_naam"] == "Org-B BV", (
        "AVG breach: org_b received org_a's record (eigenaar_naam mismatch)."
    )

    # Unrelated third org (no rows) → empty list
    unrelated_org_id = uuid.uuid4()
    result_unrelated = await enrich_parcel_data_with_brk(
        {"parcel_id": shared_parcel_id},
        unrelated_org_id,
        test_db,
    )
    assert result_unrelated["brk_records"] == [], (
        f"AVG breach: unrelated org saw {len(result_unrelated['brk_records'])} "
        f"rows — organization_id filter dropped from query."
    )
