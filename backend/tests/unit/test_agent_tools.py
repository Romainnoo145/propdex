"""Unit tests for agent tool definitions and executors."""

import json
import uuid
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from google.genai import types

from app.agents.agent_tools import execute_tool, get_agent_tools

# ── Helpers ──────────────────────────────────────────────────────────────

USER_ID = str(uuid.uuid4())


def _make_favorite(
    *,
    parcel_id="NL.TEST.001",
    address="Teststraat 1, 1234AB Venlo",
    gemeente_naam="Venlo",
    wijk_naam="Venlo-Noord",
    pipeline_stage="Onderzoek",
    created_at=None,
):
    row = MagicMock()
    row.parcel_id = parcel_id
    row.address = address
    row.gemeente_naam = gemeente_naam
    row.wijk_naam = wijk_naam
    row.pipeline_stage = pipeline_stage
    row.created_at = created_at or datetime(2025, 1, 1)
    return row


def _make_report(
    *,
    id=None,
    report_name="Test Rapport",
    city="Venlo",
    postcode="5921JH",
    created_at=None,
    report_data=None,
    deleted_at=None,
    user_id=None,
):
    row = MagicMock()
    row.id = id or uuid.uuid4()
    row.report_name = report_name
    row.city = city
    row.postcode = postcode
    row.created_at = created_at or datetime(2025, 3, 15, 10, 0)
    row.report_data = report_data or {}
    row.deleted_at = deleted_at
    row.user_id = user_id or uuid.UUID(USER_ID)
    return row


def _mock_db_returning(rows):
    """Create an AsyncMock db session that returns *rows* on execute."""
    db = AsyncMock()
    scalars = MagicMock()
    scalars.all.return_value = rows
    result = MagicMock()
    result.scalars.return_value = scalars
    db.execute.return_value = result
    return db


def _mock_db_scalar_one_or_none(value):
    """Create an AsyncMock db session for scalar_one_or_none patterns."""
    db = AsyncMock()
    result = MagicMock()
    result.scalar_one_or_none.return_value = value
    db.execute.return_value = result
    return db


# ── Tool schema validation (Gemini FunctionDeclaration format) ──────────


class TestToolSchemas:
    """Verify get_agent_tools() returns Gemini Tool objects."""

    def test_tool_count(self):
        """get_agent_tools() returns 1 Tool object with function declarations."""
        tools = get_agent_tools()
        assert len(tools) == 1

    def test_tools_are_gemini_type(self):
        tools = get_agent_tools()
        for t in tools:
            assert isinstance(t, types.Tool)

    def test_function_declarations_tool(self):
        """First Tool has 6 FunctionDeclarations."""
        tools = get_agent_tools()
        func_tool = tools[0]
        assert func_tool.function_declarations is not None
        assert len(func_tool.function_declarations) == 6

    def test_function_declaration_names(self):
        tools = get_agent_tools()
        names = {fd.name for fd in tools[0].function_declarations}
        assert names == {
            "list_favorites",
            "list_reports",
            "get_report",
            "query_policy_documents",
            "get_checklist_status",
            "get_beleidscontext",
        }

    @pytest.mark.parametrize(
        "name",
        [
            "list_favorites",
            "list_reports",
            "get_report",
            "query_policy_documents",
            "get_checklist_status",
            "get_beleidscontext",
        ],
    )
    def test_function_declaration_has_description_and_params(self, name):
        tools = get_agent_tools()
        fd = next(fd for fd in tools[0].function_declarations if fd.name == name)
        assert fd.description and len(fd.description) > 10
        assert fd.parameters is not None
        assert fd.parameters.type == "OBJECT"

    def test_list_favorites_params(self):
        tools = get_agent_tools()
        fd = next(fd for fd in tools[0].function_declarations if fd.name == "list_favorites")
        props = fd.parameters.properties
        assert "gemeente" in props
        assert "stage" in props

    def test_get_report_requires_report_id(self):
        tools = get_agent_tools()
        fd = next(fd for fd in tools[0].function_declarations if fd.name == "get_report")
        assert "report_id" in (fd.parameters.required or [])


# ── execute_tool dispatcher ─────────────────────────────────────────────


class TestExecuteTool:
    """Test the public execute_tool dispatcher."""

    @pytest.mark.asyncio
    async def test_unknown_tool_returns_error(self):
        db = AsyncMock()
        result = await execute_tool("nonexistent_tool", {}, db, USER_ID)
        data = json.loads(result)
        assert "error" in data
        assert "Onbekende tool" in data["error"]

    @pytest.mark.asyncio
    async def test_dispatches_to_list_favorites(self):
        db = _mock_db_returning([])
        result = await execute_tool("list_favorites", {}, db, USER_ID)
        assert json.loads(result) == []
        db.execute.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_dispatches_to_list_reports(self):
        db = _mock_db_returning([])
        result = await execute_tool("list_reports", {}, db, USER_ID)
        assert json.loads(result) == []

    @pytest.mark.asyncio
    async def test_dispatches_to_get_report(self):
        db = _mock_db_scalar_one_or_none(None)
        report_id = str(uuid.uuid4())
        result = await execute_tool("get_report", {"report_id": report_id}, db, USER_ID)
        data = json.loads(result)
        assert "error" in data  # nonexistent report


# ── _list_favorites ─────────────────────────────────────────────────────


class TestListFavorites:
    """Test _list_favorites executor."""

    @pytest.mark.asyncio
    async def test_zero_favorites(self):
        db = _mock_db_returning([])
        result = await execute_tool("list_favorites", {}, db, USER_ID)
        assert json.loads(result) == []

    @pytest.mark.asyncio
    async def test_two_favorites(self):
        rows = [
            _make_favorite(parcel_id="A", address="Addr A", gemeente_naam="Venlo", pipeline_stage="Gesignaleerd"),
            _make_favorite(parcel_id="B", address="Addr B", gemeente_naam="Maastricht", pipeline_stage="Onderzoek"),
        ]
        db = _mock_db_returning(rows)
        result = await execute_tool("list_favorites", {}, db, USER_ID)
        data = json.loads(result)
        assert len(data) == 2
        assert data[0]["parcel_id"] == "A"
        assert data[0]["address"] == "Addr A"
        assert data[0]["gemeente_naam"] == "Venlo"
        assert data[0]["pipeline_stage"] == "Gesignaleerd"
        assert data[1]["parcel_id"] == "B"

    @pytest.mark.asyncio
    async def test_favorites_with_filters(self):
        """Filters are passed through to the query — we verify execute is called."""
        db = _mock_db_returning([])
        await execute_tool(
            "list_favorites",
            {"gemeente": "Venlo", "stage": "Onderzoek"},
            db,
            USER_ID,
        )
        db.execute.assert_awaited_once()


# ── _list_reports ───────────────────────────────────────────────────────


class TestListReports:
    """Test _list_reports executor."""

    @pytest.mark.asyncio
    async def test_zero_reports(self):
        db = _mock_db_returning([])
        result = await execute_tool("list_reports", {}, db, USER_ID)
        assert json.loads(result) == []

    @pytest.mark.asyncio
    async def test_reports_with_data(self):
        report = _make_report(
            report_name="Leutherweg 139",
            city="Venlo",
            report_data={
                "scores_v3": {"potentie": 7.5, "risico": 3.2},
                "building": {"bouwjaar": 1965, "oppervlakte": 450, "gebruiksdoel": ["woonfunctie"]},
                "zoning": {"primary_bestemming": "Wonen"},
                "energy_label": {"energieklasse": "C"},
                "asbest_indicator": {"risk": "medium"},
                "fysiek_risico_profiel": {"overall_risk": "low"},
                "monuments": {"is_monument": False},
            },
        )
        db = _mock_db_returning([report])
        result = await execute_tool("list_reports", {}, db, USER_ID)
        data = json.loads(result)
        assert len(data) == 1
        r = data[0]
        assert r["report_name"] == "Leutherweg 139"
        assert r["city"] == "Venlo"
        assert r["potentie"] == 7.5
        assert r["risico"] == 3.2
        assert r["bouwjaar"] == 1965
        assert r["gebruiksdoel"] == "woonfunctie"
        assert r["bestemming"] == "Wonen"
        assert r["energielabel"] == "C"
        assert r["asbest_risk"] == "medium"
        assert r["fysiek_risk"] == "low"
        assert r["is_monument"] is False

    @pytest.mark.asyncio
    async def test_reports_empty_report_data(self):
        """Report with empty report_data should still serialize gracefully."""
        report = _make_report(report_data={})
        db = _mock_db_returning([report])
        result = await execute_tool("list_reports", {}, db, USER_ID)
        data = json.loads(result)
        assert len(data) == 1
        assert data[0]["potentie"] is None


# ── _get_report ─────────────────────────────────────────────────────────


class TestGetReport:
    """Test _get_report executor."""

    @pytest.mark.asyncio
    async def test_full_report_data_returned(self):
        """R003: get_report returns full report_data JSONB."""
        report_id = uuid.uuid4()
        report = _make_report(
            id=report_id,
            report_name="Full Report",
            city="Maastricht",
            postcode="6211AA",
            report_data={"scores_v3": {"potentie": 8}, "building": {"bouwjaar": 2000}},
        )
        db = _mock_db_scalar_one_or_none(report)
        result = await execute_tool("get_report", {"report_id": str(report_id)}, db, USER_ID)
        data = json.loads(result)
        assert data["id"] == str(report_id)
        assert data["report_name"] == "Full Report"
        assert data["city"] == "Maastricht"
        assert data["report_data"]["scores_v3"]["potentie"] == 8
        assert data["report_data"]["building"]["bouwjaar"] == 2000

    @pytest.mark.asyncio
    async def test_nonexistent_report(self):
        """Nonexistent report returns error message."""
        db = _mock_db_scalar_one_or_none(None)
        rid = str(uuid.uuid4())
        result = await execute_tool("get_report", {"report_id": rid}, db, USER_ID)
        data = json.loads(result)
        assert "error" in data
        assert "niet gevonden" in data["error"]

    @pytest.mark.asyncio
    async def test_invalid_report_id(self):
        """Malformed report_id (not a UUID) returns error."""
        db = AsyncMock()
        result = await execute_tool("get_report", {"report_id": "not-a-uuid"}, db, USER_ID)
        data = json.loads(result)
        assert "error" in data
        assert "Ongeldig rapport-ID" in data["error"]
        # DB should not even be queried
        db.execute.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_empty_report_id(self):
        """Empty report_id returns error."""
        db = AsyncMock()
        result = await execute_tool("get_report", {"report_id": ""}, db, USER_ID)
        data = json.loads(result)
        assert "error" in data


# ── Read-only constraint (R010) ─────────────────────────────────────────


class TestReadOnlyConstraint:
    """Verify tools never call write operations on the DB session."""

    @pytest.mark.asyncio
    async def test_list_favorites_is_read_only(self):
        db = _mock_db_returning([])
        await execute_tool("list_favorites", {}, db, USER_ID)
        db.add.assert_not_called()
        db.delete.assert_not_called()
        db.commit.assert_not_called()

    @pytest.mark.asyncio
    async def test_list_reports_is_read_only(self):
        db = _mock_db_returning([])
        await execute_tool("list_reports", {}, db, USER_ID)
        db.add.assert_not_called()
        db.delete.assert_not_called()
        db.commit.assert_not_called()

    @pytest.mark.asyncio
    async def test_get_report_is_read_only(self):
        db = _mock_db_scalar_one_or_none(None)
        rid = str(uuid.uuid4())
        await execute_tool("get_report", {"report_id": rid}, db, USER_ID)
        db.add.assert_not_called()
        db.delete.assert_not_called()
        db.commit.assert_not_called()


# ── Google Search grounding tool ─────────────────────────────────────────


class TestGetBeleidscontext:
    """Test the get_beleidscontext executor (cascade randvoorwaarden + klimaat)."""

    ORG_ID = str(uuid.uuid4())

    @staticmethod
    def _rv(titel, samenvatting, categorie="wonen"):
        return {
            "categorie": categorie,
            "titel": titel,
            "samenvatting": samenvatting,
            "citaat": "Letterlijk citaat " * 40,
            "pagina": 12,
        }

    @pytest.mark.asyncio
    async def test_happy_path_includes_randvoorwaarden_and_klimaat(self):
        summaries = {
            "woonvisie": [self._rv("Sociale huur 30%", "Minimaal 30% sociaal bij nieuwbouw.")],
            "omgevingsvisie": [self._rv("Inbreiding voor uitbreiding", "Verdichting binnen bestaand gebied.")],
        }
        klimaat = {
            "approval_rate": 0.62,
            "ruling_count": 14,
            "ruling_count_dev_types": 9,
            "missing": False,
            "reason": None,
        }
        db = AsyncMock()
        with patch(
            "app.agents.agent_tools.get_summaries", new=AsyncMock(return_value=summaries)
        ), patch(
            "app.agents.agent_tools.build_juridisch_klimaat_payload",
            new=AsyncMock(return_value=klimaat),
        ), patch(
            "app.agents.agent_tools.resolve_gemeente_code", new=AsyncMock(return_value="GM0983")
        ):
            result = await execute_tool(
                "get_beleidscontext",
                {"gemeente": "Venlo", "gemeente_code": "GM0983"},
                db,
                USER_ID,
                organization_id=self.ORG_ID,
            )
        data = json.loads(result)
        assert data["gemeente"] == "Venlo"
        assert data["gemeente_code"] == "GM0983"
        # Labels resolved via get_source_key_label
        assert "Woonvisie" in data["beleid"]
        assert "Omgevingsvisie" in data["beleid"]
        assert any("Sociale huur 30%" in item for item in data["beleid"]["Woonvisie"])
        assert data["juridisch_klimaat"]["goedkeuringspercentage"] == 62
        assert data["juridisch_klimaat"]["aantal_uitspraken"] == 14

    @pytest.mark.asyncio
    async def test_gemeente_code_preferred_over_name_resolve(self):
        resolve_mock = AsyncMock(return_value="GM9999")
        summaries_mock = AsyncMock(return_value={"woonvisie": [self._rv("X", "Y")]})
        db = AsyncMock()
        with patch(
            "app.agents.agent_tools.get_summaries", new=summaries_mock
        ), patch(
            "app.agents.agent_tools.build_juridisch_klimaat_payload",
            new=AsyncMock(return_value=None),
        ), patch(
            "app.agents.agent_tools.resolve_gemeente_code", new=resolve_mock
        ):
            result = await execute_tool(
                "get_beleidscontext",
                {"gemeente": "Venlo", "gemeente_code": "GM0983"},
                db,
                USER_ID,
                organization_id=self.ORG_ID,
            )
        data = json.loads(result)
        # resolve_gemeente_code must NOT be used when code is supplied
        resolve_mock.assert_not_awaited()
        # get_summaries called with the supplied code
        assert summaries_mock.await_args.args[1] == "GM0983"
        assert data["gemeente_code"] == "GM0983"

    @pytest.mark.asyncio
    async def test_unknown_gemeente_returns_message(self):
        db = AsyncMock()
        with patch(
            "app.agents.agent_tools.resolve_gemeente_code", new=AsyncMock(return_value=None)
        ):
            result = await execute_tool(
                "get_beleidscontext",
                {"gemeente": "Nergenshuizen"},
                db,
                USER_ID,
                organization_id=self.ORG_ID,
            )
        data = json.loads(result)
        assert "message" in data
        assert "niet gevonden" in data["message"].lower()

    @pytest.mark.asyncio
    async def test_empty_cascade_returns_message(self):
        db = AsyncMock()
        with patch(
            "app.agents.agent_tools.get_summaries", new=AsyncMock(return_value={})
        ), patch(
            "app.agents.agent_tools.build_juridisch_klimaat_payload",
            new=AsyncMock(return_value=None),
        ), patch(
            "app.agents.agent_tools.get_gemeente_name_map",
            new=AsyncMock(return_value={"GM0983": "Venlo"}),
        ):
            result = await execute_tool(
                "get_beleidscontext",
                {"gemeente_code": "GM0983"},
                db,
                USER_ID,
                organization_id=self.ORG_ID,
            )
        data = json.loads(result)
        assert "message" in data
        assert "Venlo" in data["message"]
