"""Unit tests for the bulk query builder and NL parsing logic."""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.agents.schemas import BulkResult, ParsedQuery
from app.ai.claude_client import AIParsingError


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _clear_gemeente_cache():
    """Reset the module-level gemeente lookup before each test."""
    import app.agents.bulk_query_service as svc

    svc._gemeente_lookup = None
    yield
    svc._gemeente_lookup = None


def _make_mock_db(
    gemeente_rows=None,
    count_result=0,
    query_rows=None,
    ilike_result=None,
):
    """Build a mock AsyncSession that handles the various query patterns.

    Call order for resolve_gemeente_code:
      1. DISTINCT gemeente_code query → gemeente_rows
      2. (if ILIKE fallback) → ilike_result via scalar_one_or_none

    Call order for execute_bulk_query (after gemeente lookup):
      1. count query → count_result via scalar_one
      2. main query → query_rows via scalars().all()
    """
    db = AsyncMock()
    original_rows = query_rows or []
    call_idx = {"n": 0}

    async def _execute_side_effect(stmt, *args, **kwargs):
        idx = call_idx["n"]
        call_idx["n"] += 1
        result = MagicMock()

        stmt_compiled = str(stmt)

        # Gemeente lookup query (DISTINCT gemeente_code) — always first
        if "DISTINCT" in stmt_compiled and "gemeente_code" in stmt_compiled:
            result.all.return_value = gemeente_rows or []
            return result

        # ILIKE fallback query (compiled as lower(col) LIKE lower(val))
        if "lower" in stmt_compiled.lower() and "LIKE" in stmt_compiled:
            result.scalar_one_or_none.return_value = ilike_result
            return result

        # Count query
        if "count" in stmt_compiled.lower():
            result.scalar_one.return_value = count_result
            return result

        # Main select query (returns scalars)
        scalars_mock = MagicMock()
        scalars_mock.all.return_value = original_rows
        result.scalars.return_value = scalars_mock
        return result

    db.execute = AsyncMock(side_effect=_execute_side_effect)
    return db


def _make_parcel(**kwargs):
    """Build a mock ParcelCache row."""
    defaults = {
        "parcel_id": "HTT02-A-1234",
        "address": "Hoofdstraat 1, 5911AA Venlo",
        "gemeente_code": "0983",
        "bouwjaar": 1965,
        "area_m2": 350.0,
        "bestemmingen": [{"type": "Wonen", "naam": "Wonen - 1"}],
        "pand_status": "Pand in gebruik",
    }
    defaults.update(kwargs)
    obj = MagicMock()
    for k, v in defaults.items():
        setattr(obj, k, v)
    return obj


def _mock_claude_response(text: str):
    """Build a mock Claude Messages response."""
    block = MagicMock()
    block.type = "text"
    block.text = text
    response = MagicMock()
    response.content = [block]
    return response


# ---------------------------------------------------------------------------
# execute_bulk_query tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_gemeente_filter():
    """Municipality name resolves to code and filters correctly."""
    from app.agents.bulk_query_service import execute_bulk_query

    parcel = _make_parcel()
    db = _make_mock_db(
        gemeente_rows=[("0983", "Hoofdstraat 1, 5911AA Venlo")],
        count_result=1,
        query_rows=[parcel],
    )

    parsed = ParsedQuery(municipality="Venlo")
    results, total = await execute_bulk_query(parsed, db)

    assert total == 1
    assert len(results) == 1
    assert results[0].parcel_id == "HTT02-A-1234"


@pytest.mark.asyncio
async def test_bouwjaar_range():
    """Build year range filters both min and max."""
    from app.agents.bulk_query_service import execute_bulk_query

    parcel = _make_parcel(bouwjaar=1985)
    db = _make_mock_db(
        gemeente_rows=[],
        count_result=1,
        query_rows=[parcel],
    )

    parsed = ParsedQuery(build_year_min=1970, build_year_max=2000)
    results, total = await execute_bulk_query(parsed, db)

    assert total == 1
    assert results[0].build_year == 1985


@pytest.mark.asyncio
async def test_bouwjaar_max_only():
    """'voor 1970' → build_year_max=1970 with no min."""
    from app.agents.bulk_query_service import execute_bulk_query

    parcel = _make_parcel(bouwjaar=1960)
    db = _make_mock_db(
        gemeente_rows=[],
        count_result=1,
        query_rows=[parcel],
    )

    parsed = ParsedQuery(build_year_max=1970)
    results, total = await execute_bulk_query(parsed, db)

    assert total == 1


@pytest.mark.asyncio
async def test_area_range():
    """Area min/max filters apply correctly."""
    from app.agents.bulk_query_service import execute_bulk_query

    parcel = _make_parcel(area_m2=300.0)
    db = _make_mock_db(
        gemeente_rows=[],
        count_result=1,
        query_rows=[parcel],
    )

    parsed = ParsedQuery(area_min=200.0, area_max=500.0)
    results, total = await execute_bulk_query(parsed, db)

    assert total == 1
    assert results[0].area_m2 == 300.0


@pytest.mark.asyncio
async def test_bestemming_containment():
    """Bestemming filter uses JSONB containment."""
    from app.agents.bulk_query_service import execute_bulk_query

    parcel = _make_parcel(bestemmingen=[{"type": "wonen", "naam": "Wonen"}])
    db = _make_mock_db(
        gemeente_rows=[],
        count_result=1,
        query_rows=[parcel],
    )

    parsed = ParsedQuery(bestemming="Wonen")
    results, total = await execute_bulk_query(parsed, db)

    assert total == 1
    assert results[0].bestemming == "Wonen"


@pytest.mark.asyncio
async def test_pand_status():
    """Pand status exact match filter."""
    from app.agents.bulk_query_service import execute_bulk_query

    parcel = _make_parcel(pand_status="Pand in gebruik")
    db = _make_mock_db(
        gemeente_rows=[],
        count_result=1,
        query_rows=[parcel],
    )

    parsed = ParsedQuery(pand_status="Pand in gebruik")
    results, total = await execute_bulk_query(parsed, db)

    assert total == 1
    assert results[0].pand_status == "Pand in gebruik"


@pytest.mark.asyncio
async def test_combined_filters():
    """Multiple filters apply together."""
    from app.agents.bulk_query_service import execute_bulk_query

    parcel = _make_parcel()
    db = _make_mock_db(
        gemeente_rows=[("0983", "Hoofdstraat 1, 5911AA Venlo")],
        count_result=1,
        query_rows=[parcel],
    )

    parsed = ParsedQuery(
        municipality="Venlo",
        build_year_max=1970,
        area_min=300.0,
    )
    results, total = await execute_bulk_query(parsed, db)

    assert total == 1
    assert len(results) == 1


@pytest.mark.asyncio
async def test_empty_parsed_query_rejected():
    """All-None ParsedQuery raises ValueError."""
    from app.agents.bulk_query_service import execute_bulk_query

    db = _make_mock_db()
    parsed = ParsedQuery()  # all None

    with pytest.raises(ValueError, match="At least one filter"):
        await execute_bulk_query(parsed, db)


# ---------------------------------------------------------------------------
# parse_nl_query tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_valid_parse():
    """Valid Claude response parses to ParsedQuery."""
    from app.agents.bulk_query_service import parse_nl_query

    response_json = json.dumps({
        "municipality": "Venlo",
        "build_year_min": None,
        "build_year_max": 1970,
        "area_min": None,
        "area_max": None,
        "bestemming": "Wonen",
        "pand_status": None,
    })

    mock_response = _mock_claude_response(response_json)

    with patch("app.agents.bulk_query_service.create_claude_client") as mock_factory:
        mock_client = MagicMock()
        mock_client.client.messages.create = AsyncMock(return_value=mock_response)
        mock_client.model = "test-model"
        mock_factory.return_value = mock_client

        parsed, reason = await parse_nl_query("Alle woningen in Venlo voor 1970")

    assert reason is None
    assert parsed is not None
    assert parsed.municipality == "Venlo"
    assert parsed.build_year_max == 1970
    assert parsed.bestemming == "Wonen"


@pytest.mark.asyncio
async def test_unsupported_parse():
    """Unsupported query returns (None, reason)."""
    from app.agents.bulk_query_service import parse_nl_query

    response_json = json.dumps({
        "unsupported": True,
        "reason": "Huurprijs is niet beschikbaar",
    })

    mock_response = _mock_claude_response(response_json)

    with patch("app.agents.bulk_query_service.create_claude_client") as mock_factory:
        mock_client = MagicMock()
        mock_client.client.messages.create = AsyncMock(return_value=mock_response)
        mock_client.model = "test-model"
        mock_factory.return_value = mock_client

        parsed, reason = await parse_nl_query("Wat is de gemiddelde huurprijs?")

    assert parsed is None
    assert reason == "Huurprijs is niet beschikbaar"


@pytest.mark.asyncio
async def test_malformed_json():
    """Invalid JSON from Claude raises AIParsingError."""
    from app.agents.bulk_query_service import parse_nl_query

    mock_response = _mock_claude_response("This is not JSON at all {broken")

    with patch("app.agents.bulk_query_service.create_claude_client") as mock_factory:
        mock_client = MagicMock()
        mock_client.client.messages.create = AsyncMock(return_value=mock_response)
        mock_client.model = "test-model"
        mock_factory.return_value = mock_client

        with pytest.raises(AIParsingError, match="invalid JSON"):
            await parse_nl_query("Some query")


@pytest.mark.asyncio
async def test_markdown_fence_stripping():
    """Markdown code fences around JSON are stripped before parsing."""
    from app.agents.bulk_query_service import parse_nl_query

    inner_json = json.dumps({
        "municipality": "Amsterdam",
        "build_year_min": None,
        "build_year_max": None,
        "area_min": 500.0,
        "area_max": None,
        "bestemming": "Bedrijf",
        "pand_status": None,
    })
    fenced = f"```json\n{inner_json}\n```"

    mock_response = _mock_claude_response(fenced)

    with patch("app.agents.bulk_query_service.create_claude_client") as mock_factory:
        mock_client = MagicMock()
        mock_client.client.messages.create = AsyncMock(return_value=mock_response)
        mock_client.model = "test-model"
        mock_factory.return_value = mock_client

        parsed, reason = await parse_nl_query("Bedrijfspanden > 500m2 in Amsterdam")

    assert reason is None
    assert parsed is not None
    assert parsed.municipality == "Amsterdam"
    assert parsed.bestemming == "Bedrijf"
    assert parsed.area_min == 500.0


# ---------------------------------------------------------------------------
# Gemeente lookup tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_gemeente_name_resolution():
    """Gemeente names resolve case-insensitively."""
    from app.agents.bulk_query_service import resolve_gemeente_code

    db = _make_mock_db(
        gemeente_rows=[
            ("0983", "Hoofdstraat 1, 5911AA Venlo"),
            ("0363", "Keizersgracht 100, 1015AA Amsterdam"),
        ],
    )

    assert await resolve_gemeente_code("venlo", db) == "0983"
    assert await resolve_gemeente_code("Amsterdam", db) == "0363"


@pytest.mark.asyncio
async def test_unknown_gemeente_ilike_fallback():
    """Unknown gemeente falls back to ILIKE search."""
    from app.agents.bulk_query_service import resolve_gemeente_code

    db = _make_mock_db(
        gemeente_rows=[],  # empty lookup
        ilike_result="0599",
    )

    code = await resolve_gemeente_code("Rotterdam", db)
    assert code == "0599"


@pytest.mark.asyncio
async def test_unknown_gemeente_not_found():
    """Completely unknown gemeente returns None."""
    from app.agents.bulk_query_service import resolve_gemeente_code

    db = _make_mock_db(
        gemeente_rows=[],
        ilike_result=None,
    )

    code = await resolve_gemeente_code("Nonexistent", db)
    assert code is None
