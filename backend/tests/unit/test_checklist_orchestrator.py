"""Unit tests for the checklist document orchestrator.

Tests the generate_checklist_documents function with mocked DB and PDF generation.
"""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.reports.checklist_orchestrator import (
    ChecklistGenerationResult,
    generate_checklist_documents,
)


def _make_full_report_data() -> dict:
    """Minimal report data that satisfies all 11 doc type required_fields."""
    return {
        "cadastral_parcels": [{"kadastraal_nummer": "ASD01-F-1234"}],
        "zoning": {"bestemmingsplan_naam": "Centrum"},
        "energy_label": {"is_geregistreerd": True, "energieklasse": "A"},
        "wkb_precheck": {"status": "likely_required", "confidence": "medium"},
        "monuments": {"is_monument": False},
        "fysiek_risico_profiel": {"overall_risk": "laag"},
        "bodem_data": {"dominant_type_label": "Klei"},
        "funderingsrisicogebied": {"legenda": "Laag risico"},
        "asbest_indicator": {"risk": "geen"},
        "permit_precedents": {"permits_found": 2},
        "scores_v3": {"potentie": 70, "risico": 30},
        "woz_data": {"woz_waarde": 350000},
    }


@pytest.fixture
def mock_db():
    """Create a mock AsyncSession."""
    db = AsyncMock()
    # _insert_parcel_document uses db.execute() which returns a result with scalar_one()
    mock_result = MagicMock()
    mock_result.scalar_one.return_value = uuid.uuid4()
    db.execute.return_value = mock_result
    db.flush = AsyncMock()
    return db


@pytest.fixture
def user_id():
    return uuid.uuid4()


class TestChecklistOrchestrator:
    """Test generate_checklist_documents orchestration logic."""

    @pytest.mark.asyncio
    async def test_generates_all_available_docs(self, mock_db, user_id):
        """Full report data → all 11 doc types generated."""
        report_data = _make_full_report_data()

        with patch(
            "app.reports.checklist_orchestrator.generate_checklist_pdf"
        ) as mock_pdf:
            mock_pdf.return_value = b"%PDF-fake"

            result = await generate_checklist_documents(
                report_data=report_data,
                report_name="Test Report",
                parcel_id="ASD01-F-1234",
                user_id=user_id,
                db=mock_db,
            )

        assert isinstance(result, ChecklistGenerationResult)
        assert len(result.generated) == 12
        assert len(result.failed) == 0
        assert len(result.skipped) == 0
        assert result.total_bytes == 9 * 12  # b"%PDF-fake" = 9 bytes × 12 docs
        assert mock_pdf.call_count == 12

    @pytest.mark.asyncio
    async def test_skips_unavailable_docs(self, mock_db, user_id):
        """Partial data → only available types generated, rest skipped."""
        report_data = {
            "cadastral_parcels": [{"kadastraal_nummer": "X"}],
            "energy_label": {"is_geregistreerd": True},
        }

        with patch(
            "app.reports.checklist_orchestrator.generate_checklist_pdf"
        ) as mock_pdf:
            mock_pdf.return_value = b"%PDF-fake"

            result = await generate_checklist_documents(
                report_data=report_data,
                report_name="Partial",
                parcel_id="X",
                user_id=user_id,
                db=mock_db,
            )

        assert "kadaster" in result.generated
        assert "energielabel" in result.generated
        assert len(result.generated) == 2
        assert len(result.skipped) == 10  # 12 total - 2 available
        assert mock_pdf.call_count == 2

    @pytest.mark.asyncio
    async def test_handles_single_template_failure(self, mock_db, user_id):
        """One template raises → others still generated, failure recorded."""
        report_data = _make_full_report_data()

        def side_effect(doc_type, *args, **kwargs):
            if doc_type == "kadaster":
                raise RuntimeError("Template render failed")
            return b"%PDF-ok"

        with patch(
            "app.reports.checklist_orchestrator.generate_checklist_pdf",
            side_effect=side_effect,
        ):
            result = await generate_checklist_documents(
                report_data=report_data,
                report_name="Test",
                parcel_id="X",
                user_id=user_id,
                db=mock_db,
            )

        assert "kadaster" not in result.generated
        assert len(result.failed) == 1
        assert result.failed[0]["doc_type"] == "kadaster"
        assert "Template render failed" in result.failed[0]["error"]
        assert len(result.generated) == 11  # 12 - 1 failure

    @pytest.mark.asyncio
    async def test_returns_summary_dict_structure(self, mock_db, user_id):
        """Result has generated/failed/skipped/total_bytes fields."""
        report_data = {"cadastral_parcels": [{"kadastraal_nummer": "X"}]}

        with patch(
            "app.reports.checklist_orchestrator.generate_checklist_pdf"
        ) as mock_pdf:
            mock_pdf.return_value = b"%PDF-test"

            result = await generate_checklist_documents(
                report_data=report_data,
                report_name="Test",
                parcel_id="X",
                user_id=user_id,
                db=mock_db,
            )

        assert hasattr(result, "generated")
        assert hasattr(result, "failed")
        assert hasattr(result, "skipped")
        assert hasattr(result, "total_bytes")
        assert isinstance(result.generated, list)
        assert isinstance(result.failed, list)
        assert isinstance(result.skipped, list)
        assert isinstance(result.total_bytes, int)

    @pytest.mark.asyncio
    async def test_empty_data_generates_nothing(self, mock_db, user_id):
        """Empty report_data → no PDFs generated, all types skipped."""
        with patch(
            "app.reports.checklist_orchestrator.generate_checklist_pdf"
        ) as mock_pdf:
            result = await generate_checklist_documents(
                report_data={},
                report_name="Empty",
                parcel_id="X",
                user_id=user_id,
                db=mock_db,
            )

        assert len(result.generated) == 0
        assert len(result.failed) == 0
        assert len(result.skipped) == 12
        assert result.total_bytes == 0
        mock_pdf.assert_not_called()

    @pytest.mark.asyncio
    async def test_db_insert_called_per_generated_doc(self, mock_db, user_id):
        """Each generated doc results in a DB insert."""
        report_data = {
            "cadastral_parcels": [{"kadastraal_nummer": "X"}],
            "zoning": {"bestemmingsplan_naam": "C"},
        }

        with patch(
            "app.reports.checklist_orchestrator.generate_checklist_pdf"
        ) as mock_pdf:
            mock_pdf.return_value = b"%PDF-x"

            await generate_checklist_documents(
                report_data=report_data,
                report_name="Test",
                parcel_id="X",
                user_id=user_id,
                db=mock_db,
            )

        # 2 available types (kadaster, bestemmingsplan) → 2 inserts + 1 flush
        assert mock_db.execute.call_count == 2
        mock_db.flush.assert_awaited_once()

