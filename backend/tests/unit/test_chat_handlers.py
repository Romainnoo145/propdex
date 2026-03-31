"""Unit tests for PARCEL_DETAIL, MY_FAVORITES, MY_REPORTS, and UNSUPPORTED handlers."""

import uuid
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.agents.chat_schemas import ChatRequest
from app.agents.chat_service import (
    _build_suggestions,
    dispatch_chat,
    handle_my_favorites,
    handle_my_reports,
    handle_parcel_detail,
    handle_parcel_search,
)
from app.agents.schemas import ParsedQuery

# ── Helpers ──────────────────────────────────────────────────────────────

def _make_parcel_cache_row(
    *,
    parcel_id="NL.IMKAD.KadastraalObject.12345",
    parcel_code="Venlo I 1234",
    address="Leutherweg 139, 5921JH Venlo",
    gemeente_code="0983",
    bouwjaar=1965,
    area_m2=450.0,
    bestemmingen=None,
    pand_status="Pand in gebruik",
    enrichment_data=None,
):
    """Create a mock ParcelCache row."""
    row = MagicMock()
    row.parcel_id = parcel_id
    row.parcel_code = parcel_code
    row.address = address
    row.gemeente_code = gemeente_code
    row.bouwjaar = bouwjaar
    row.area_m2 = area_m2
    row.bestemmingen = bestemmingen or [{"type": "wonen", "naam": "Wonen"}]
    row.pand_status = pand_status
    row.enrichment_data = enrichment_data
    return row


def _make_favorite_row(
    *,
    parcel_id="TEST-001",
    address="Teststraat 1, Venlo",
    gemeente_naam="Venlo",
    wijk_naam="Venlo-Noord",
    pipeline_stage="Onderzoek",
):
    row = MagicMock()
    row.parcel_id = parcel_id
    row.address = address
    row.gemeente_naam = gemeente_naam
    row.wijk_naam = wijk_naam
    row.pipeline_stage = pipeline_stage
    return row


def _make_report_row(
    *,
    id=None,
    report_name="Rapport Leutherweg 139",
    city="Venlo",
    created_at=None,
):
    row = MagicMock()
    row.id = id or uuid.uuid4()
    row.report_name = report_name
    row.city = city
    row.created_at = created_at or datetime(2026, 3, 25, 12, 0, 0)
    row.report_data = {
        "scores_v3": {"potentie": 65.0, "risico": 35.0},
        "building": {"bouwjaar": 1975, "oppervlakte": 120, "gebruiksdoel": ["woonfunctie"]},
        "zoning": {"primary_bestemming": "Wonen"},
        "energy_label": {"energieklasse": "C"},
        "asbest_indicator": {"risk": "middel"},
        "fysiek_risico_profiel": {"overall_risk": "middel"},
        "monuments": {"is_monument": False},
    }
    return row


@pytest.fixture
def mock_db():
    return AsyncMock()


# ── PARCEL_DETAIL handler ────────────────────────────────────────────────

class TestHandleParcelDetail:

    @pytest.mark.asyncio
    async def test_found_by_ilike(self, mock_db):
        """Parcel found via ILIKE search on address."""
        parcel = _make_parcel_cache_row()
        result = MagicMock()
        result.scalar_one_or_none.return_value = parcel
        mock_db.execute = AsyncMock(return_value=result)

        response = await handle_parcel_detail(
            {"address": "Leutherweg 139 Venlo"}, mock_db
        )
        assert response.intent == "PARCEL_DETAIL"
        assert response.data is not None
        assert response.data["address"] == "Leutherweg 139, 5921JH Venlo"
        assert response.data["bouwjaar"] == 1965
        assert response.data["bestemming"] == "Wonen"

    @pytest.mark.asyncio
    async def test_found_by_partial_match(self, mock_db):
        """Parcel not found by ILIKE, found by partial component match."""
        # First call returns None (ILIKE fails), second returns parcel
        parcel = _make_parcel_cache_row()
        result_none = MagicMock()
        result_none.scalar_one_or_none.return_value = None
        result_found = MagicMock()
        result_found.scalar_one_or_none.return_value = parcel

        mock_db.execute = AsyncMock(side_effect=[result_none, result_found])

        response = await handle_parcel_detail(
            {"address": "Leutherweg 139, Venlo"}, mock_db
        )
        assert response.intent == "PARCEL_DETAIL"
        assert response.data is not None

    @pytest.mark.asyncio
    async def test_not_found(self, mock_db):
        """No parcel found → informative message."""
        result_none = MagicMock()
        result_none.scalar_one_or_none.return_value = None
        mock_db.execute = AsyncMock(return_value=result_none)

        response = await handle_parcel_detail(
            {"address": "Onbestaandelaan 999 Nergensdorp"}, mock_db
        )
        assert response.intent == "PARCEL_DETAIL"
        assert response.message is not None
        assert "niet gevonden" in response.message.lower() or "geen perceel" in response.message.lower()

    @pytest.mark.asyncio
    async def test_no_address_param(self, mock_db):
        """Missing address → UNSUPPORTED."""
        response = await handle_parcel_detail({}, mock_db)
        assert response.intent == "UNSUPPORTED"
        assert "adres" in response.message.lower()

    @pytest.mark.asyncio
    async def test_enrichment_data_extracted(self, mock_db):
        """WOZ and energielabel extracted from enrichment_data."""
        parcel = _make_parcel_cache_row(
            enrichment_data={
                "woz": {"woz_waarde": 385000},
                "energy_label": {"label": "C"},
            }
        )
        result = MagicMock()
        result.scalar_one_or_none.return_value = parcel
        mock_db.execute = AsyncMock(return_value=result)

        response = await handle_parcel_detail(
            {"address": "Leutherweg 139 Venlo"}, mock_db
        )
        assert response.data["woz_waarde"] == 385000
        assert response.data["energielabel"] == "C"


# ── MY_FAVORITES handler ────────────────────────────────────────────────

class TestHandleMyFavorites:

    @pytest.mark.asyncio
    async def test_returns_all_favorites(self, mock_db):
        favs = [_make_favorite_row(), _make_favorite_row(parcel_id="TEST-002")]
        result = MagicMock()
        result.scalars.return_value.all.return_value = favs
        mock_db.execute = AsyncMock(return_value=result)

        response = await handle_my_favorites({}, mock_db, str(uuid.uuid4()))
        assert response.intent == "MY_FAVORITES"
        assert response.count == 2
        assert len(response.data) == 2

    @pytest.mark.asyncio
    async def test_empty_favorites(self, mock_db):
        result = MagicMock()
        result.scalars.return_value.all.return_value = []
        mock_db.execute = AsyncMock(return_value=result)

        response = await handle_my_favorites({}, mock_db, str(uuid.uuid4()))
        assert response.intent == "MY_FAVORITES"
        assert response.count == 0
        assert response.message is not None
        assert "nog geen" in response.message.lower()

    @pytest.mark.asyncio
    async def test_filtered_by_stage(self, mock_db):
        fav = _make_favorite_row(pipeline_stage="Onderzoek")
        result = MagicMock()
        result.scalars.return_value.all.return_value = [fav]
        mock_db.execute = AsyncMock(return_value=result)

        response = await handle_my_favorites(
            {"stage": "Onderzoek"}, mock_db, str(uuid.uuid4())
        )
        assert response.intent == "MY_FAVORITES"
        assert response.count == 1

    @pytest.mark.asyncio
    async def test_empty_with_stage_filter_message(self, mock_db):
        result = MagicMock()
        result.scalars.return_value.all.return_value = []
        mock_db.execute = AsyncMock(return_value=result)

        response = await handle_my_favorites(
            {"stage": "Besluit"}, mock_db, str(uuid.uuid4())
        )
        assert "Besluit" in response.message


# ── MY_REPORTS handler ───────────────────────────────────────────────────

class TestHandleMyReports:

    @pytest.mark.asyncio
    async def test_returns_reports(self, mock_db):
        reports = [_make_report_row(), _make_report_row(report_name="Rapport 2")]
        result = MagicMock()
        result.scalars.return_value.all.return_value = reports
        mock_db.execute = AsyncMock(return_value=result)

        response = await handle_my_reports({}, mock_db, str(uuid.uuid4()))
        assert response.intent == "MY_REPORTS"
        assert response.count == 2

    @pytest.mark.asyncio
    async def test_empty_reports(self, mock_db):
        result = MagicMock()
        result.scalars.return_value.all.return_value = []
        mock_db.execute = AsyncMock(return_value=result)

        response = await handle_my_reports({}, mock_db, str(uuid.uuid4()))
        assert response.message is not None
        assert "nog geen" in response.message.lower()

    @pytest.mark.asyncio
    async def test_filtered_by_city(self, mock_db):
        report = _make_report_row(city="Amsterdam")
        result = MagicMock()
        result.scalars.return_value.all.return_value = [report]
        mock_db.execute = AsyncMock(return_value=result)

        response = await handle_my_reports(
            {"city": "Amsterdam"}, mock_db, str(uuid.uuid4())
        )
        assert response.intent == "MY_REPORTS"
        assert response.count == 1

    @pytest.mark.asyncio
    async def test_sort_by_potentie(self, mock_db):
        r1 = _make_report_row(report_name="Low")
        r1.report_data["scores_v3"]["potentie"] = 30.0
        r2 = _make_report_row(report_name="High")
        r2.report_data["scores_v3"]["potentie"] = 90.0
        result = MagicMock()
        result.scalars.return_value.all.return_value = [r1, r2]
        mock_db.execute = AsyncMock(return_value=result)

        response = await handle_my_reports(
            {"sort_by": "potentie", "sort_order": "desc"}, mock_db, str(uuid.uuid4())
        )
        assert response.data[0]["report_name"] == "High"
        assert response.data[1]["report_name"] == "Low"

    @pytest.mark.asyncio
    async def test_max_risico_filter(self, mock_db):
        r1 = _make_report_row(report_name="Risky")
        r1.report_data["scores_v3"]["risico"] = 50.0
        r2 = _make_report_row(report_name="Safe")
        r2.report_data["scores_v3"]["risico"] = 20.0
        result = MagicMock()
        result.scalars.return_value.all.return_value = [r1, r2]
        mock_db.execute = AsyncMock(return_value=result)

        response = await handle_my_reports(
            {"max_risico": 35}, mock_db, str(uuid.uuid4())
        )
        assert response.count == 1
        assert response.data[0]["report_name"] == "Safe"

    @pytest.mark.asyncio
    async def test_min_potentie_filter(self, mock_db):
        r1 = _make_report_row(report_name="Low")
        r1.report_data["scores_v3"]["potentie"] = 30.0
        r2 = _make_report_row(report_name="High")
        r2.report_data["scores_v3"]["potentie"] = 80.0
        result = MagicMock()
        result.scalars.return_value.all.return_value = [r1, r2]
        mock_db.execute = AsyncMock(return_value=result)

        response = await handle_my_reports(
            {"min_potentie": 50}, mock_db, str(uuid.uuid4())
        )
        assert response.count == 1
        assert response.data[0]["report_name"] == "High"

    @pytest.mark.asyncio
    async def test_combined_filter_and_sort(self, mock_db):
        r1 = _make_report_row(report_name="A")
        r1.report_data["scores_v3"] = {"potentie": 70.0, "risico": 25.0}
        r2 = _make_report_row(report_name="B")
        r2.report_data["scores_v3"] = {"potentie": 85.0, "risico": 30.0}
        r3 = _make_report_row(report_name="C")
        r3.report_data["scores_v3"] = {"potentie": 90.0, "risico": 50.0}
        result = MagicMock()
        result.scalars.return_value.all.return_value = [r1, r2, r3]
        mock_db.execute = AsyncMock(return_value=result)

        response = await handle_my_reports(
            {"sort_by": "potentie", "sort_order": "desc", "max_risico": 35},
            mock_db, str(uuid.uuid4()),
        )
        # C filtered out (risico 50 > 35), B first (potentie 85), A second (70)
        assert response.count == 2
        assert response.data[0]["report_name"] == "B"
        assert response.data[1]["report_name"] == "A"


# ── dispatch_chat integration ────────────────────────────────────────────

class TestDispatchChat:

    @pytest.mark.asyncio
    async def test_unsupported_dispatch(self, mock_db):
        """UNSUPPORTED intent returns reason message."""
        with patch("app.agents.chat_service.classify_intent", new_callable=AsyncMock) as mock_cls:
            mock_cls.return_value = ("UNSUPPORTED", {"reason": "Niet beschikbaar"})

            request = ChatRequest(message="Bereken mijn hypotheek")
            response = await dispatch_chat(request, mock_db, str(uuid.uuid4()))

        assert response.intent == "UNSUPPORTED"
        assert "Niet beschikbaar" in response.message

    @pytest.mark.asyncio
    async def test_classification_failure_returns_unsupported(self, mock_db):
        """When classifier raises AIParsingError, return UNSUPPORTED."""
        from app.ai.claude_client import AIParsingError

        with patch("app.agents.chat_service.classify_intent", new_callable=AsyncMock) as mock_cls:
            mock_cls.side_effect = AIParsingError("timeout", retriable=True)

            request = ChatRequest(message="Test")
            response = await dispatch_chat(request, mock_db, str(uuid.uuid4()))

        assert response.intent == "UNSUPPORTED"
        assert "probeer" in response.message.lower()

    @pytest.mark.asyncio
    async def test_handler_exception_returns_unsupported(self, mock_db):
        """When a handler raises, dispatch returns UNSUPPORTED gracefully."""
        with patch("app.agents.chat_service.classify_intent", new_callable=AsyncMock) as mock_cls:
            mock_cls.return_value = ("MY_FAVORITES", {})

            with patch("app.agents.chat_service.handle_my_favorites", new_callable=AsyncMock) as mock_handler:
                mock_handler.side_effect = RuntimeError("DB connection lost")

                request = ChatRequest(message="Mijn opgeslagen")
                response = await dispatch_chat(request, mock_db, str(uuid.uuid4()))

        assert response.intent == "UNSUPPORTED"
        assert "mis" in response.message.lower()


# ── Wijk suggestion pill tests ───────────────────────────────────────────

class TestBuildSuggestionsWijk:

    def test_includes_wijk_when_municipality_set(self):
        """Wijk suggestion appears when municipality is set but wijk is not."""
        parsed = ParsedQuery(municipality="Venlo")
        suggestions = _build_suggestions(parsed)
        wijk_suggestions = [s for s in suggestions if "wijk" in s.lower()]
        assert len(wijk_suggestions) >= 1, f"Expected wijk suggestion, got {suggestions}"

    def test_no_wijk_when_already_set(self):
        """Wijk suggestion does NOT appear when wijk is already set."""
        parsed = ParsedQuery(municipality="Venlo", wijk="Blerick")
        suggestions = _build_suggestions(parsed)
        wijk_suggestions = [s for s in suggestions if "wijk" in s.lower()]
        assert len(wijk_suggestions) == 0, f"Wijk suggestion should not appear when wijk is set, got {suggestions}"

    def test_no_wijk_when_no_municipality(self):
        """Wijk suggestion does NOT appear when municipality is absent."""
        parsed = ParsedQuery(bestemming="Wonen")
        suggestions = _build_suggestions(parsed)
        wijk_suggestions = [s for s in suggestions if "wijk" in s.lower()]
        assert len(wijk_suggestions) == 0, f"Wijk suggestion should not appear without municipality, got {suggestions}"


# ── Wijk parcel search: unscanned wijk ───────────────────────────────────

class TestHandleParcelSearchWijk:

    @pytest.fixture(autouse=True)
    def _clear_gemeente_cache(self):
        """Reset the module-level gemeente lookup before each test."""
        import app.agents.bulk_query_service as svc
        svc._gemeente_lookup = None
        yield
        svc._gemeente_lookup = None

    @pytest.mark.asyncio
    async def test_unscanned_wijk_returns_error_message(self, mock_db):
        """Wijk with 0 results returns helpful Dutch error message."""
        call_idx = {"n": 0}

        async def _execute_side_effect(stmt, *args, **kwargs):
            call_idx["n"] += 1
            compiled = str(stmt)
            result = MagicMock()

            # Gemeente lookup (DISTINCT gemeente_code)
            if "DISTINCT" in compiled and "gemeente_code" in compiled:
                result.all.return_value = [("0983", "Hoofdstraat 1, 5911AA Venlo")]
                return result

            # Count query (check BEFORE ILIKE since wijk count queries contain both)
            if "count" in compiled.lower():
                result.scalar_one.return_value = 0
                return result

            # Gemeente resolve (ILIKE fallback or direct)
            if "gemeente_code" in compiled and "LIKE" in compiled.upper():
                result.scalar_one_or_none.return_value = "0983"
                return result

            # Default
            result.scalar_one_or_none.return_value = None
            return result

        mock_db.execute = AsyncMock(side_effect=_execute_side_effect)

        response = await handle_parcel_search(
            {"municipality": "Venlo", "wijk": "Onbekend"},
            mock_db,
            str(uuid.uuid4()),
        )

        assert response.count == 0
        assert "Onbekend" in response.message
        assert "niet gevonden" in response.message.lower() or "wijk" in response.message.lower()
