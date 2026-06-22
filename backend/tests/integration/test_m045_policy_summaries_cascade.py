"""Integration tests for get_summaries cascade-aware rewrite — M045/S03 T02."""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.factor_extraction_schemas import DOCUMENT_SENTINEL, SCHEMA_VERSION
from app.core.config import settings
from app.models.factor_extraction_cache import FactorExtractionCache
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


def _make_extraction(
    doc: PolicyDocument,
    factor_id: str,
    randvoorwaarden: list[dict],  # type: ignore[type-arg]
) -> FactorExtractionCache:
    return FactorExtractionCache(
        parcel_id=DOCUMENT_SENTINEL,
        policy_document_id=doc.id,
        factor_id=factor_id,
        schema_version=SCHEMA_VERSION,
        extracted_payload={"randvoorwaarden": randvoorwaarden},
    )


# ---- Tests ----


async def test_get_summaries_returns_cascade_across_levels(
    test_db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Cascade: seed one cascade doc per level with distinct source_keys → dict has all three."""
    user, vendor_org = await _make_vendor_user(test_db)
    monkeypatch.setattr(settings, "VENDOR_ORG_ID", vendor_org.id)

    # Venlo cascade: PV31 is Limburg
    test_db.add(GemeenteProvincieMap(gemeente_code="GM0983", provincie_code="PV31"))

    doc_landelijk = _make_policy_doc(
        entity_type="landelijk", entity_code="NL",
        source_key="grondprijsbeleid", version_number=1, is_global=True,
        user_id=user.id, org_id=vendor_org.id,
        ai_summary=None,
    )
    doc_provincie = _make_policy_doc(
        entity_type="provincie", entity_code="PV31",
        source_key="parkeerbeleid", version_number=1, is_global=True,
        user_id=user.id, org_id=vendor_org.id,
        ai_summary=None,
    )
    doc_gemeente = _make_policy_doc(
        entity_type="gemeente", entity_code="GM0983",
        source_key="woonvisie", version_number=1, is_global=True,
        user_id=user.id, org_id=vendor_org.id,
        ai_summary=None,
    )
    test_db.add(doc_landelijk)
    test_db.add(doc_provincie)
    test_db.add(doc_gemeente)
    await test_db.flush()

    test_db.add(_make_extraction(
        doc_landelijk, "grondwaarde_fit",
        [{"titel": "Grond landelijk", "samenvatting": "Landelijke grondprijzen."}],
    ))
    test_db.add(_make_extraction(
        doc_provincie, "parkeerdruk",
        [{"titel": "Parkeer PV31", "samenvatting": "Provinciaal parkeerbeleid."}],
    ))
    test_db.add(_make_extraction(
        doc_gemeente, "woonvisie_match",
        [{"titel": "Woonvisie GM0983", "samenvatting": "Gemeentelijke woonvisie."}],
    ))
    await test_db.commit()

    result = await get_summaries(
        entity_type="gemeente",
        entity_code="GM0983",
        organization_id=vendor_org.id,
        db=test_db,
    )

    assert result["grondprijsbeleid"][0]["titel"] == "Grond landelijk"
    assert result["parkeerbeleid"][0]["titel"] == "Parkeer PV31"
    assert result["woonvisie"][0]["titel"] == "Woonvisie GM0983"


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
    doc_landelijk = _make_policy_doc(
        entity_type="landelijk", entity_code="NL",
        source_key="omgevingsvisie", version_number=1, is_global=True,
        user_id=user.id, org_id=vendor_org.id,
        ai_summary=None,
    )
    doc_gemeente = _make_policy_doc(
        entity_type="gemeente", entity_code="GM0983",
        source_key="omgevingsvisie", version_number=1, is_global=True,
        user_id=user.id, org_id=vendor_org.id,
        ai_summary=None,
    )
    test_db.add(doc_landelijk)
    test_db.add(doc_gemeente)
    await test_db.flush()

    test_db.add(_make_extraction(
        doc_landelijk, "beleidsalignement",
        [{"titel": "LANDELIJK omgevingsvisie", "samenvatting": "Landelijk beleid."}],
    ))
    test_db.add(_make_extraction(
        doc_gemeente, "beleidsalignement",
        [{"titel": "GEMEENTE omgevingsvisie", "samenvatting": "Gemeentelijk beleid."}],
    ))
    await test_db.commit()

    result = await get_summaries(
        entity_type="gemeente",
        entity_code="GM0983",
        organization_id=vendor_org.id,
        db=test_db,
    )

    assert result["omgevingsvisie"][0]["titel"] == "GEMEENTE omgevingsvisie"


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

    doc_private = _make_policy_doc(
        entity_type="gemeente", entity_code="GM0983",
        source_key="woonvisie", version_number=1, is_global=False,
        user_id=user.id, org_id=vendor_org.id,
        ai_summary=None,
    )
    doc_global = _make_policy_doc(
        entity_type="gemeente", entity_code="GM0983",
        source_key="omgevingsvisie", version_number=1, is_global=True,
        user_id=user.id, org_id=vendor_org.id,
        ai_summary=None,
    )
    test_db.add(doc_private)
    test_db.add(doc_global)
    await test_db.flush()

    # Only add extraction for the private doc to confirm it's still excluded
    test_db.add(_make_extraction(
        doc_private, "woonvisie_match",
        [{"titel": "Private woonvisie", "samenvatting": "Should not appear."}],
    ))
    test_db.add(_make_extraction(
        doc_global, "beleidsalignement",
        [{"titel": "Omgevingsvisie zichtbaar", "samenvatting": "Visible."}],
    ))
    await test_db.commit()

    result = await get_summaries(
        entity_type="gemeente",
        entity_code="GM0983",
        organization_id=vendor_org.id,
        db=test_db,
    )

    assert "woonvisie" not in result
    assert result["omgevingsvisie"][0]["titel"] == "Omgevingsvisie zichtbaar"


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

    doc = _make_policy_doc(
        entity_type="gemeente", entity_code="GM0983",
        source_key="woonvisie", version_number=1, is_global=True,
        user_id=vendor_user.id, org_id=vendor_org.id,
        ai_summary=None,
    )
    test_db.add(doc)
    await test_db.flush()

    test_db.add(_make_extraction(
        doc, "woonvisie_match",
        [{"titel": "Woonvisie parity", "samenvatting": "Parity test content."}],
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
    assert "woonvisie" in customer_result


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


@pytest.mark.asyncio
async def test_get_summaries_returns_randvoorwaarden_from_extraction(
    test_db: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Parsed extraction → randvoorwaarden list is returned per source_key."""
    user, vendor_org = await _make_vendor_user(test_db, email="rv@summaries.example")
    monkeypatch.setattr(settings, "VENDOR_ORG_ID", vendor_org.id)
    doc = _make_policy_doc(
        entity_type="gemeente", entity_code="GM0983", source_key="woonvisie",
        version_number=1, is_global=True, user_id=user.id, org_id=vendor_org.id, ai_summary=None,
    )
    test_db.add(doc)
    await test_db.flush()
    test_db.add(FactorExtractionCache(
        parcel_id=DOCUMENT_SENTINEL, policy_document_id=doc.id,
        factor_id="woonvisie_match", schema_version=SCHEMA_VERSION,
        extracted_payload={"randvoorwaarden": [{"titel": "Sociaal 30%", "samenvatting": "Min 30% sociaal."}]},
    ))
    await test_db.commit()

    result = await get_summaries("gemeente", "GM0983", vendor_org.id, test_db)
    assert result["woonvisie"][0]["titel"] == "Sociaal 30%"
