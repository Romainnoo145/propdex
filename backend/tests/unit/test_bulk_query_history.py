"""Unit tests for bulk query history, CSV export, and manual request endpoints."""

import csv
import io
import json
import uuid
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.agents.schemas import (
    BulkQueryDetailResponse,
    BulkQueryHistoryResponse,
    BulkRequestListResponse,
    BulkRequestResponse,
    BulkRequestUpdate,
    BulkResult,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_bulk_query(**kwargs):
    """Build a mock BulkQuery row."""
    defaults = {
        "id": uuid.uuid4(),
        "user_id": uuid.uuid4(),
        "query_text": "Alle woningen in Venlo",
        "parsed_query": {"municipality": "Venlo", "bestemming": "Wonen"},
        "result_count": 2,
        "status": "completed",
        "results": [
            {"parcel_id": "HTT02-A-1", "address": "Straat 1, 5911AA Venlo",
             "municipality": None, "build_year": 1965, "area_m2": 200.0,
             "bestemming": "Wonen", "pand_status": "Pand in gebruik"},
            {"parcel_id": "HTT02-A-2", "address": "Straat 2, 5911AA Venlo",
             "municipality": None, "build_year": 1970, "area_m2": 350.0,
             "bestemming": "Wonen", "pand_status": "Pand in gebruik"},
        ],
        "created_at": datetime(2026, 3, 25, 12, 0, 0),
        "updated_at": datetime(2026, 3, 25, 12, 0, 0),
    }
    defaults.update(kwargs)
    obj = MagicMock()
    for k, v in defaults.items():
        setattr(obj, k, v)
    return obj


def _make_bulk_request(**kwargs):
    """Build a mock BulkRequest row."""
    defaults = {
        "id": uuid.uuid4(),
        "user_id": uuid.uuid4(),
        "query_text": "Wat is de WOZ-waarde in Venlo?",
        "status": "pending",
        "admin_note": None,
        "results_query_id": None,
        "created_at": datetime(2026, 3, 25, 12, 0, 0),
        "updated_at": datetime(2026, 3, 25, 12, 0, 0),
    }
    defaults.update(kwargs)
    obj = MagicMock()
    for k, v in defaults.items():
        setattr(obj, k, v)
    return obj


def _mock_db_for_list(rows, total):
    """Mock DB session returning count + paginated rows."""
    db = AsyncMock()
    call_idx = {"n": 0}

    async def _execute(stmt, *a, **kw):
        idx = call_idx["n"]
        call_idx["n"] += 1
        result = MagicMock()
        if idx == 0:  # count
            result.scalar_one.return_value = total
        else:  # list
            scalars = MagicMock()
            scalars.all.return_value = rows
            result.scalars.return_value = scalars
        return result

    db.execute = AsyncMock(side_effect=_execute)
    return db


def _mock_db_for_single(row):
    """Mock DB session returning a single row."""
    db = AsyncMock()
    result = MagicMock()
    result.scalar_one_or_none.return_value = row

    async def _execute(stmt, *a, **kw):
        return result

    db.execute = AsyncMock(side_effect=_execute)
    return db


def _mock_db_for_insert():
    """Mock DB session for insert operations."""
    db = AsyncMock()

    async def _refresh(obj):
        obj.id = uuid.uuid4()
        obj.created_at = datetime(2026, 3, 25, 12, 0, 0)
        obj.updated_at = datetime(2026, 3, 25, 12, 0, 0)
        if not hasattr(obj, "status") or obj.status is None:
            obj.status = "pending"

    db.refresh = AsyncMock(side_effect=_refresh)
    return db


# ---------------------------------------------------------------------------
# History endpoint tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_bulk_queries():
    """GET /bulk-queries returns paginated history."""
    from app.agents.router import list_bulk_queries

    user = MagicMock()
    user.id = uuid.uuid4()

    q = _make_bulk_query(user_id=user.id)
    db = _mock_db_for_list([q], total=1)

    resp = await list_bulk_queries(offset=0, limit=20, user=user, db=db)

    assert resp.total == 1
    assert len(resp.queries) == 1
    assert resp.queries[0].query_text == "Alle woningen in Venlo"
    assert resp.queries[0].status == "completed"


@pytest.mark.asyncio
async def test_get_bulk_query_detail():
    """GET /bulk-queries/{id} returns full results."""
    from app.agents.router import get_bulk_query

    user = MagicMock()
    user.id = uuid.uuid4()

    q = _make_bulk_query(user_id=user.id)
    db = _mock_db_for_single(q)

    resp = await get_bulk_query(query_id=q.id, user=user, db=db)

    assert resp.result_count == 2
    assert len(resp.results) == 2
    assert resp.results[0].parcel_id == "HTT02-A-1"


@pytest.mark.asyncio
async def test_get_bulk_query_not_found():
    """GET /bulk-queries/{id} returns 404 for non-existent query."""
    from app.agents.router import get_bulk_query
    from fastapi import HTTPException

    user = MagicMock()
    user.id = uuid.uuid4()
    db = _mock_db_for_single(None)

    with pytest.raises(HTTPException) as exc_info:
        await get_bulk_query(query_id=uuid.uuid4(), user=user, db=db)

    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_get_bulk_query_forbidden():
    """GET /bulk-queries/{id} returns 403 for another user's query."""
    from app.agents.router import get_bulk_query
    from fastapi import HTTPException

    user = MagicMock()
    user.id = uuid.uuid4()

    q = _make_bulk_query(user_id=uuid.uuid4())  # different user
    db = _mock_db_for_single(q)

    with pytest.raises(HTTPException) as exc_info:
        await get_bulk_query(query_id=q.id, user=user, db=db)

    assert exc_info.value.status_code == 403


# ---------------------------------------------------------------------------
# CSV export test
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_csv_export():
    """GET /bulk-queries/{id}/csv returns valid CSV content."""
    from app.agents.router import export_bulk_query_csv

    user = MagicMock()
    user.id = uuid.uuid4()

    q = _make_bulk_query(user_id=user.id)
    db = _mock_db_for_single(q)

    resp = await export_bulk_query_csv(query_id=q.id, user=user, db=db)

    assert resp.media_type == "text/csv"

    # Parse the CSV body
    body = ""
    async for chunk in resp.body_iterator:
        body += chunk

    reader = csv.reader(io.StringIO(body))
    rows = list(reader)

    assert rows[0] == ["Perceel ID", "Adres", "Gemeente", "Bouwjaar", "Oppervlakte (m²)", "Bestemming", "Pandstatus"]
    assert len(rows) == 3  # header + 2 data rows
    assert rows[1][0] == "HTT02-A-1"


# ---------------------------------------------------------------------------
# Manual request tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_bulk_request():
    """POST /bulk-request creates a pending request."""
    from app.agents.router import create_bulk_request
    from app.agents.schemas import BulkRequestCreate

    user = MagicMock()
    user.id = uuid.uuid4()
    db = _mock_db_for_insert()

    body = BulkRequestCreate(query_text="Wat is de WOZ-waarde in Venlo?")
    resp = await create_bulk_request(body=body, user=user, db=db)

    assert resp.status == "pending"
    assert resp.query_text == "Wat is de WOZ-waarde in Venlo?"
    db.add.assert_called_once()
    db.commit.assert_called_once()


@pytest.mark.asyncio
async def test_list_bulk_requests():
    """GET /bulk-requests returns list of requests."""
    from app.agents.router import list_bulk_requests

    user = MagicMock()
    user.id = uuid.uuid4()

    req = _make_bulk_request()
    db = _mock_db_for_list([req], total=1)

    resp = await list_bulk_requests(status=None, offset=0, limit=20, user=user, db=db)

    assert resp.total == 1
    assert len(resp.requests) == 1
    assert resp.requests[0].status == "pending"


# ---------------------------------------------------------------------------
# Update bulk request (PATCH) tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_update_bulk_request_status():
    """PATCH /bulk-requests/{id} updates status and admin_note."""
    from app.agents.router import update_bulk_request

    user = MagicMock()
    user.id = uuid.uuid4()

    req = _make_bulk_request(user_id=user.id)
    db = _mock_db_for_single(req)
    db.commit = AsyncMock()
    db.refresh = AsyncMock()

    body = BulkRequestUpdate(status="completed", admin_note="Done")
    resp = await update_bulk_request(request_id=req.id, body=body, user=user, db=db)

    assert resp.status == "completed"
    assert resp.admin_note == "Done"
    db.commit.assert_called_once()
    db.refresh.assert_called_once()


@pytest.mark.asyncio
async def test_update_bulk_request_not_found():
    """PATCH /bulk-requests/{id} returns 404 for non-existent request."""
    from app.agents.router import update_bulk_request
    from fastapi import HTTPException

    user = MagicMock()
    user.id = uuid.uuid4()
    db = _mock_db_for_single(None)

    body = BulkRequestUpdate(status="completed")
    with pytest.raises(HTTPException) as exc_info:
        await update_bulk_request(request_id=uuid.uuid4(), body=body, user=user, db=db)

    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_update_bulk_request_invalid_status():
    """PATCH with invalid status value is rejected by Pydantic (422)."""
    import pydantic

    with pytest.raises(pydantic.ValidationError):
        BulkRequestUpdate(status="invalid")
