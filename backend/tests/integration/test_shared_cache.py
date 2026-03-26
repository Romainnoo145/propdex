"""Integration tests proving shared cache access after de-tenanting.

Verifies that CachedAPIResponse, PDFDocument, ParsingJob,
JuridischAnalyseJob, and FundaListingSnapshot work without
organization_id — all data is shared across authenticated users.
"""

from datetime import datetime
from unittest.mock import AsyncMock

from sqlalchemy import select

from app.models.cached_response import CachedAPIResponse
from app.models.funda_listing_snapshot import FundaListingSnapshot
from app.models.jurisprudence_job import JuridischAnalyseJob
from app.models.parsing_job import ParsingJob
from app.models.pdf_document import PDFDocument
from app.services.cache_manager import get_cached_or_fetch


class TestSharedCacheAccess:
    """Cache entries are globally shared — no org scoping."""

    async def test_write_then_read_without_org_id(self, test_db):
        """Insert via cache_manager (no org_id), read it back — proves basic flow."""
        mock_fetch = AsyncMock(return_value={"gemeente": "Amsterdam", "score": 42})

        result = await get_cached_or_fetch(
            cache_key="bag:nummeraanduiding:0363200000469854",
            source="bag",
            fetch_fn=mock_fetch,
            session=test_db,
        )

        assert result.is_cached is False
        assert result.data["gemeente"] == "Amsterdam"

        # Read back — should be cached
        result2 = await get_cached_or_fetch(
            cache_key="bag:nummeraanduiding:0363200000469854",
            source="bag",
            fetch_fn=AsyncMock(return_value={"should": "not_be_called"}),
            session=test_db,
        )

        assert result2.is_cached is True
        assert result2.data["gemeente"] == "Amsterdam"

    async def test_cache_key_uniqueness_without_org_scoping(self, test_db):
        """Same cache_key upserts (not duplicates) since unique constraint is on cache_key alone."""
        fetch_v1 = AsyncMock(return_value={"version": 1})
        fetch_v2 = AsyncMock(return_value={"version": 2})

        await get_cached_or_fetch(
            cache_key="bag:test:upsert_check",
            source="bag",
            fetch_fn=fetch_v1,
            session=test_db,
        )
        # Force refresh to trigger upsert
        result = await get_cached_or_fetch(
            cache_key="bag:test:upsert_check",
            source="bag",
            fetch_fn=fetch_v2,
            session=test_db,
            force_refresh=True,
        )

        assert result.data == {"version": 2}

        # Verify only 1 row exists for this key
        stmt = select(CachedAPIResponse).where(
            CachedAPIResponse.cache_key == "bag:test:upsert_check",
        )
        rows = (await test_db.execute(stmt)).scalars().all()
        assert len(rows) == 1

    async def test_two_different_keys_coexist(self, test_db):
        """Two different cache keys store independent entries."""
        await get_cached_or_fetch(
            cache_key="bag:addr:001",
            source="bag",
            fetch_fn=AsyncMock(return_value={"addr": "Keizersgracht 1"}),
            session=test_db,
        )
        await get_cached_or_fetch(
            cache_key="bag:addr:002",
            source="bag",
            fetch_fn=AsyncMock(return_value={"addr": "Herengracht 99"}),
            session=test_db,
        )

        stmt = select(CachedAPIResponse).where(
            CachedAPIResponse.cache_key.in_(["bag:addr:001", "bag:addr:002"]),
        )
        rows = (await test_db.execute(stmt)).scalars().all()
        assert len(rows) == 2
        data_set = {r.response_data["addr"] for r in rows}
        assert data_set == {"Keizersgracht 1", "Herengracht 99"}


class TestDeTenantedModelCreation:
    """All 5 de-tenanted models can be created without organization_id."""

    async def test_cached_api_response_no_org_id(self, test_db):
        entry = CachedAPIResponse(
            cache_key="test:model:create",
            source="bag",
            response_data={"test": True},
            fetched_at=datetime.utcnow(),
            ttl_seconds=3600,
        )
        test_db.add(entry)
        await test_db.flush()
        await test_db.commit()

        row = (await test_db.execute(
            select(CachedAPIResponse).where(CachedAPIResponse.cache_key == "test:model:create")
        )).scalar_one()
        assert row.response_data == {"test": True}
        assert not hasattr(row, "organization_id") or getattr(row, "organization_id", None) is None

    async def test_pdf_document_no_org_id(self, test_db):
        doc = PDFDocument(
            plan_idn="NL.IMRO.0363.test001",
            source_url="https://example.com/test.pdf",
            file_size=1024,
            file_data=b"fake pdf content",
        )
        test_db.add(doc)
        await test_db.flush()
        await test_db.commit()

        row = (await test_db.execute(
            select(PDFDocument).where(PDFDocument.plan_idn == "NL.IMRO.0363.test001")
        )).scalar_one()
        assert row.source_url == "https://example.com/test.pdf"

    async def test_parsing_job_no_org_id(self, test_db):
        job = ParsingJob(
            plan_idn="NL.IMRO.0363.test002",
            job_id="test-arq-job-001",
            status="pending",
        )
        test_db.add(job)
        await test_db.flush()
        await test_db.commit()

        row = (await test_db.execute(
            select(ParsingJob).where(ParsingJob.plan_idn == "NL.IMRO.0363.test002")
        )).scalar_one()
        assert row.status == "pending"

    async def test_juridisch_analyse_job_no_org_id(self, test_db):
        job = JuridischAnalyseJob(
            gemeente_naam="Amsterdam",
            job_id="test-arq-job-002",
            ecli_list=["ECLI:NL:RVS:2024:001"],
            status="pending",
        )
        test_db.add(job)
        await test_db.flush()
        await test_db.commit()

        row = (await test_db.execute(
            select(JuridischAnalyseJob).where(JuridischAnalyseJob.gemeente_naam == "Amsterdam")
        )).scalar_one()
        assert row.status == "pending"

    async def test_funda_listing_snapshot_no_org_id(self, test_db):
        snapshot = FundaListingSnapshot(
            source="funda",
            listing_external_id="funda-test-123",
            listing_url="https://funda.nl/test/123",
            snapshot_date=datetime.utcnow().date(),
            metadata_json={"price": 500000},
        )
        test_db.add(snapshot)
        await test_db.flush()
        await test_db.commit()

        row = (await test_db.execute(
            select(FundaListingSnapshot).where(
                FundaListingSnapshot.listing_external_id == "funda-test-123"
            )
        )).scalar_one()
        assert row.metadata_json["price"] == 500000
