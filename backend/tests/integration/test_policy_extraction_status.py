# backend/tests/integration/test_policy_extraction_status.py
import uuid
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.factor_extraction_schemas import DOCUMENT_SENTINEL, SCHEMA_VERSION
from app.models.factor_extraction_cache import FactorExtractionCache
from app.models.policy_document import PolicyDocument
from app.policy_documents.extraction_status import get_extraction_map


def _doc(source_key: str, org_id: uuid.UUID, user_id: uuid.UUID) -> PolicyDocument:
    return PolicyDocument(
        entity_type="gemeente", entity_code="GM0983", source_key=source_key,
        filename=f"{source_key}.pdf", content_type="application/pdf",
        file_data=b"x", file_size=1, uploaded_by_user_id=user_id,
        organization_id=org_id, is_global=True, version_number=1, status="uploaded",
    )


@pytest.mark.asyncio
async def test_parsed_when_cache_has_payload(test_db: AsyncSession, create_test_user):
    user, org = await create_test_user(email="extract-hit@example.com", org_name="Hit")
    doc = _doc("woonvisie", org.id, user.id)
    test_db.add(doc)
    await test_db.flush()
    test_db.add(FactorExtractionCache(
        parcel_id=DOCUMENT_SENTINEL, policy_document_id=doc.id,
        factor_id="woonvisie_match", schema_version=SCHEMA_VERSION,
        extracted_payload={"randvoorwaarden": [{"titel": "T", "samenvatting": "S"}]},
    ))
    await test_db.commit()

    result = await get_extraction_map(test_db, [(doc.id, "woonvisie")])
    assert result[doc.id]["status"] == "parsed"
    assert result[doc.id]["extraction"]["randvoorwaarden"][0]["titel"] == "T"


@pytest.mark.asyncio
async def test_pending_when_cascade_doc_without_cache(test_db: AsyncSession, create_test_user):
    user, org = await create_test_user(email="extract-pending@example.com", org_name="Pend")
    doc = _doc("omgevingsvisie", org.id, user.id)
    test_db.add(doc)
    await test_db.commit()

    result = await get_extraction_map(test_db, [(doc.id, "omgevingsvisie")])
    assert result[doc.id]["status"] == "pending"
    assert result[doc.id]["extraction"] is None


@pytest.mark.asyncio
async def test_nvt_when_not_a_cascade_source(test_db: AsyncSession, create_test_user):
    user, org = await create_test_user(email="extract-nvt@example.com", org_name="Nvt")
    doc = _doc("welstandsnota", org.id, user.id)  # not in CASCADE_SOURCE_FACTORS
    test_db.add(doc)
    await test_db.commit()

    result = await get_extraction_map(test_db, [(doc.id, "welstandsnota")])
    assert result[doc.id]["status"] == "nvt"


@pytest.mark.asyncio
async def test_stale_schema_version_is_not_parsed(test_db: AsyncSession, create_test_user):
    user, org = await create_test_user(email="extract-stale@example.com", org_name="Stale")
    doc = _doc("woonvisie", org.id, user.id)
    test_db.add(doc)
    await test_db.flush()
    test_db.add(FactorExtractionCache(
        parcel_id=DOCUMENT_SENTINEL, policy_document_id=doc.id,
        factor_id="woonvisie_match", schema_version=SCHEMA_VERSION - 1,  # stale
        extracted_payload={"randvoorwaarden": []},
    ))
    await test_db.commit()

    result = await get_extraction_map(test_db, [(doc.id, "woonvisie")])
    assert result[doc.id]["status"] == "pending"  # current-schema row absent
