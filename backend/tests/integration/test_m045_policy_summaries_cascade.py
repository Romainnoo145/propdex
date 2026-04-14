"""Integration tests for get_summaries cascade-aware rewrite — M045/S03 T02."""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.gemeente_provincie_map import GemeenteProvincieMap
from app.models.organization import Organization
from app.models.policy_document import PolicyDocument
from app.models.user import User
from app.policy_documents.service import get_summaries

# ---- Helpers (copy pattern from test_m045_cascade_query.py) ----


async def _make_vendor_user(
    db: AsyncSession,
    *,
    email: str = "vendor@summaries-cascade.example",
) -> tuple[User, Organization]:
    org = Organization(name="Vendor Org Summaries Cascade")
    db.add(org)
    await db.flush()

    user = User(
        email=email,
        hashed_password="hashed_dummy",
        full_name="Vendor Summaries User",
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
    ai_summary: str | None,
) -> PolicyDocument:
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
        ai_summary=ai_summary,
    )


# ---- Tests ----


async def test_get_summaries_returns_cascade_across_levels(
    test_db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Cascade: seed one doc per level with distinct source_keys → dict has all three."""
    user, vendor_org = await _make_vendor_user(test_db)
    monkeypatch.setattr(settings, "VENDOR_ORG_ID", vendor_org.id)

    # Venlo cascade: PV31 is Limburg
    test_db.add(GemeenteProvincieMap(gemeente_code="GM0983", provincie_code="PV31"))

    test_db.add(_make_policy_doc(
        entity_type="landelijk", entity_code="NL",
        source_key="beng", version_number=1, is_global=True,
        user_id=user.id, org_id=vendor_org.id,
        ai_summary="BENG landelijk summary text",
    ))
    test_db.add(_make_policy_doc(
        entity_type="provincie", entity_code="PV31",
        source_key="povi", version_number=1, is_global=True,
        user_id=user.id, org_id=vendor_org.id,
        ai_summary="POVI Limburg summary text",
    ))
    test_db.add(_make_policy_doc(
        entity_type="gemeente", entity_code="GM0983",
        source_key="welstand", version_number=1, is_global=True,
        user_id=user.id, org_id=vendor_org.id,
        ai_summary="Welstandsnota Venlo summary text",
    ))
    await test_db.commit()

    result = await get_summaries(
        entity_type="gemeente",
        entity_code="GM0983",
        organization_id=vendor_org.id,
        db=test_db,
    )

    assert result == {
        "beng": "BENG landelijk summary text",
        "povi": "POVI Limburg summary text",
        "welstand": "Welstandsnota Venlo summary text",
    }


async def test_gemeente_wins_over_landelijk_on_source_key_conflict(
    test_db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Same source_key at landelijk + gemeente → gemeente variant wins in flat dict."""
    user, vendor_org = await _make_vendor_user(
        test_db, email="vendor-conflict@summaries-cascade.example"
    )
    monkeypatch.setattr(settings, "VENDOR_ORG_ID", vendor_org.id)

    test_db.add(GemeenteProvincieMap(gemeente_code="GM0983", provincie_code="PV31"))

    # Both use source_key="omgevingsvisie"
    test_db.add(_make_policy_doc(
        entity_type="landelijk", entity_code="NL",
        source_key="omgevingsvisie", version_number=1, is_global=True,
        user_id=user.id, org_id=vendor_org.id,
        ai_summary="LANDELIJK omgevingsvisie text",
    ))
    test_db.add(_make_policy_doc(
        entity_type="gemeente", entity_code="GM0983",
        source_key="omgevingsvisie", version_number=1, is_global=True,
        user_id=user.id, org_id=vendor_org.id,
        ai_summary="GEMEENTE omgevingsvisie text",
    ))
    await test_db.commit()

    result = await get_summaries(
        entity_type="gemeente",
        entity_code="GM0983",
        organization_id=vendor_org.id,
        db=test_db,
    )

    assert result["omgevingsvisie"] == "GEMEENTE omgevingsvisie text"


async def test_is_global_false_rows_excluded(
    test_db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Rows with is_global=false must not appear in the summary dict."""
    user, vendor_org = await _make_vendor_user(
        test_db, email="vendor-isglobal@summaries-cascade.example"
    )
    monkeypatch.setattr(settings, "VENDOR_ORG_ID", vendor_org.id)

    test_db.add(GemeenteProvincieMap(gemeente_code="GM0983", provincie_code="PV31"))

    test_db.add(_make_policy_doc(
        entity_type="gemeente", entity_code="GM0983",
        source_key="secret", version_number=1, is_global=False,
        user_id=user.id, org_id=vendor_org.id,
        ai_summary="This should never appear",
    ))
    test_db.add(_make_policy_doc(
        entity_type="gemeente", entity_code="GM0983",
        source_key="welstand", version_number=1, is_global=True,
        user_id=user.id, org_id=vendor_org.id,
        ai_summary="Welstand visible",
    ))
    await test_db.commit()

    result = await get_summaries(
        entity_type="gemeente",
        entity_code="GM0983",
        organization_id=vendor_org.id,
        db=test_db,
    )

    assert "secret" not in result
    assert result["welstand"] == "Welstand visible"


async def test_customer_org_gets_same_cascade_as_vendor_org(
    test_db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The organization_id parameter is ignored — customer + vendor see identical responses."""
    vendor_user, vendor_org = await _make_vendor_user(
        test_db, email="vendor-parity@summaries-cascade.example"
    )
    monkeypatch.setattr(settings, "VENDOR_ORG_ID", vendor_org.id)

    # Create a non-vendor customer org
    customer_org = Organization(name="Customer Org Parity")
    test_db.add(customer_org)
    await test_db.flush()

    test_db.add(GemeenteProvincieMap(gemeente_code="GM0983", provincie_code="PV31"))

    test_db.add(_make_policy_doc(
        entity_type="gemeente", entity_code="GM0983",
        source_key="welstand", version_number=1, is_global=True,
        user_id=vendor_user.id, org_id=vendor_org.id,
        ai_summary="Welstand summary parity test",
    ))
    await test_db.commit()

    vendor_result = await get_summaries(
        entity_type="gemeente",
        entity_code="GM0983",
        organization_id=vendor_org.id,
        db=test_db,
    )
    customer_result = await get_summaries(
        entity_type="gemeente",
        entity_code="GM0983",
        organization_id=customer_org.id,
        db=test_db,
    )

    assert vendor_result == customer_result
    assert "welstand" in customer_result


async def test_zero_docs_returns_empty_dict(
    test_db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Gemeente with no seeded policy documents returns an empty dict."""
    _user, vendor_org = await _make_vendor_user(
        test_db, email="vendor-empty@summaries-cascade.example"
    )
    monkeypatch.setattr(settings, "VENDOR_ORG_ID", vendor_org.id)
    await test_db.commit()

    result = await get_summaries(
        entity_type="gemeente",
        entity_code="GM0017",  # no seed, no gemeente_provincie_map entry
        organization_id=vendor_org.id,
        db=test_db,
    )

    assert result == {}
