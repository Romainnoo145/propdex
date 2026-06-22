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


@pytest.mark.asyncio
async def test_upload_does_not_enqueue_summary_job():
    """After Task 3: document_summary_job must NOT be enqueued on upload."""
    import uuid
    from unittest.mock import AsyncMock
    from app.policy_documents.upload_enqueue import enqueue_post_upload_jobs
    from app.jobs.rescore_cascade_job import CASCADE_RESCORE_SOURCE_KEYS

    pool = AsyncMock()
    # Use a source_key that IS in CASCADE_RESCORE_SOURCE_KEYS to verify only rescore is enqueued
    cascade_key = next(iter(CASCADE_RESCORE_SOURCE_KEYS))
    await enqueue_post_upload_jobs(
        pool,
        document_id=uuid.uuid4(),
        source_key=cascade_key,
        content_type="application/pdf",
    )
    enqueued = [c.args[0] for c in pool.enqueue_job.await_args_list]
    assert "document_summary_job" not in enqueued


@pytest.mark.asyncio
async def test_auto_ingest_does_not_enqueue_summary_job(
    test_db: AsyncSession, monkeypatch: pytest.MonkeyPatch
):
    """After Task 3: ingest_gemeente_policies must NOT enqueue document_summary_job."""
    import uuid as uuid_mod
    from unittest.mock import AsyncMock, MagicMock, patch
    from app.core.config import settings
    from app.models.organization import Organization
    from app.models.user import User
    from app.policy_documents.auto_ingest import ingest_gemeente_policies
    from app.services.koop_sru_client import VerordeningResult

    org = Organization(name="SummaryTest Org")
    test_db.add(org)
    await test_db.flush()
    user = User(
        email="no-summary@example.com",
        hashed_password="hashed",
        full_name="No Summary User",
        organization_id=org.id,
        email_verified=True,
        auth_provider="email",
        is_active=True,
    )
    test_db.add(user)
    await test_db.flush()
    monkeypatch.setattr(settings, "VENDOR_ORG_ID", org.id)
    await test_db.commit()

    result = VerordeningResult(
        title="omgevingsvisie",
        identifier="gmb-2025-NOSUMM-OV",
        creator="Venlo",
        modified="2025-12-01",
        subject="test",
        url="https://zoek.officielebekendmakingen.nl/gmb-2025-NOSUMM-OV",
    )

    mock_pool = MagicMock()
    mock_pool.enqueue_job = AsyncMock()

    with (
        patch(
            "app.policy_documents.auto_ingest.search_policy_document",
            new=AsyncMock(return_value=result),
        ),
        patch(
            "app.policy_documents.auto_ingest.download_cvdr_pdf",
            new=AsyncMock(return_value=b"%PDF fake"),
        ),
    ):
        summary = await ingest_gemeente_policies(
            gemeente_code="GM0983",
            gemeente_naam="Venlo",
            db=test_db,
            arq_pool=mock_pool,
        )

    enqueued_jobs = [c.args[0] for c in mock_pool.enqueue_job.await_args_list]
    assert "document_summary_job" not in enqueued_jobs


@pytest.mark.asyncio
async def test_list_endpoint_includes_extraction_status(
    async_client, test_db: AsyncSession, create_test_user
):
    from httpx import AsyncClient
    from app.auth.jwt import create_access_token

    user, org = await create_test_user(email="extract-api@example.com", org_name="Api")
    headers = {"Authorization": f"Bearer {create_access_token(str(user.id), str(org.id))}"}
    doc = _doc("woonvisie", org.id, user.id)
    test_db.add(doc)
    await test_db.flush()
    test_db.add(FactorExtractionCache(
        parcel_id=DOCUMENT_SENTINEL, policy_document_id=doc.id,
        factor_id="woonvisie_match", schema_version=SCHEMA_VERSION,
        extracted_payload={"randvoorwaarden": [{"titel": "T", "samenvatting": "S"}]},
    ))
    await test_db.commit()

    resp = await async_client.get("/api/policy-documents/gemeente/GM0983", headers=headers)
    assert resp.status_code == 200
    doc_json = next(d for d in resp.json()["documents"] if d["source_key"] == "woonvisie")
    assert doc_json["extraction_status"] == "parsed"
    assert doc_json["extraction"]["randvoorwaarden"][0]["titel"] == "T"
