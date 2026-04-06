"""Unit tests for document_summary_job with mocked Claude."""

import json
import uuid
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import anthropic
import pytest

from app.ai.prompts import DOCUMENT_SUMMARY_PROMPT
from app.jobs.document_summary import document_summary_job


# ── Fixtures ─────────────────────────────────────────────────────────────


def _make_policy_document(
    doc_id: uuid.UUID | None = None,
    status: str = "uploaded",
    content_type: str = "application/pdf",
    file_data: bytes = b"%PDF-1.4 fake pdf content",
    filename: str = "welstandsnota.pdf",
) -> MagicMock:
    """Create a mock PolicyDocument row."""
    doc = MagicMock()
    doc.id = doc_id or uuid.uuid4()
    doc.status = status
    doc.content_type = content_type
    doc.file_data = file_data
    doc.file_size = len(file_data)
    doc.filename = filename
    doc.ai_summary = None
    doc.updated_at = None
    return doc


def _make_claude_response(text: str) -> MagicMock:
    """Create a mock Claude messages.create response with a single text block."""
    block = MagicMock()
    block.type = "text"
    block.text = text

    response = MagicMock()
    response.content = [block]
    response.usage = MagicMock(input_tokens=100, output_tokens=200)
    return response


def _patch_engine_and_session(doc):
    """
    Return a context-manager stack that patches create_async_engine and
    async_sessionmaker so document_summary_job works without a real DB.

    The mocked session.execute().scalar_one_or_none() returns `doc`.
    """
    # Session mock
    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = doc
    mock_session.execute = AsyncMock(return_value=mock_result)
    mock_session.commit = AsyncMock()
    mock_session.add = MagicMock()

    # async context-manager protocol
    mock_session.__aenter__ = AsyncMock(return_value=mock_session)
    mock_session.__aexit__ = AsyncMock(return_value=False)

    # session_factory() returns the context-manager session
    mock_session_factory = MagicMock(return_value=mock_session)

    # engine mock
    mock_engine = MagicMock()
    mock_engine.dispose = AsyncMock()

    return mock_engine, mock_session_factory, mock_session


# ── Tests ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_happy_path_parsed():
    """Claude returns valid JSON → status becomes 'parsed', ai_summary written."""
    doc = _make_policy_document()
    doc_id = str(doc.id)

    summary_payload = {
        "summary": "Dit is een welstandsnota.",
        "key_facts": ["Feit 1", "Feit 2"],
        "extracted_values": {"max_hoogte": "12m"},
    }
    claude_response = _make_claude_response(json.dumps(summary_payload))

    engine, session_factory, session = _patch_engine_and_session(doc)

    mock_claude_obj = MagicMock()
    mock_claude_obj.client.messages.create = AsyncMock(return_value=claude_response)
    mock_claude_obj.model = "claude-sonnet-4-5-20250929"

    with (
        patch("app.jobs.document_summary.create_async_engine", return_value=engine),
        patch("app.jobs.document_summary.async_sessionmaker", return_value=session_factory),
        patch("app.jobs.document_summary.create_claude_client", return_value=mock_claude_obj),
        patch("app.ai.usage_logger.log_ai_usage", new_callable=AsyncMock),
    ):
        result = await document_summary_job({}, doc_id)

    assert result["status"] == "parsed"
    assert result["document_id"] == doc_id
    # Verify the doc object got the right status and ai_summary
    assert doc.status == "parsed"
    stored = json.loads(doc.ai_summary)
    assert stored["summary"] == "Dit is een welstandsnota."
    assert len(stored["key_facts"]) == 2


@pytest.mark.asyncio
async def test_claude_api_error_sets_error_status():
    """Claude raises an API error → status becomes 'error', ai_summary has error detail."""
    doc = _make_policy_document()
    doc_id = str(doc.id)

    engine, session_factory, session = _patch_engine_and_session(doc)

    mock_claude_obj = MagicMock()
    mock_claude_obj.client.messages.create = AsyncMock(
        side_effect=anthropic.APIError(
            message="Service unavailable",
            request=MagicMock(),
            body=None,
        )
    )
    mock_claude_obj.model = "claude-sonnet-4-5-20250929"

    with (
        patch("app.jobs.document_summary.create_async_engine", return_value=engine),
        patch("app.jobs.document_summary.async_sessionmaker", return_value=session_factory),
        patch("app.jobs.document_summary.create_claude_client", return_value=mock_claude_obj),
    ):
        result = await document_summary_job({}, doc_id)

    assert result["status"] == "error"
    assert doc.status == "error"
    # ai_summary should contain the error detail as JSON
    assert doc.ai_summary is not None
    err = json.loads(doc.ai_summary)
    assert "error" in err


@pytest.mark.asyncio
async def test_invalid_json_response_sets_error():
    """Claude returns non-JSON text → status becomes 'error'."""
    doc = _make_policy_document()
    doc_id = str(doc.id)

    claude_response = _make_claude_response("This is not valid JSON at all.")

    engine, session_factory, session = _patch_engine_and_session(doc)

    mock_claude_obj = MagicMock()
    mock_claude_obj.client.messages.create = AsyncMock(return_value=claude_response)
    mock_claude_obj.model = "claude-sonnet-4-5-20250929"

    with (
        patch("app.jobs.document_summary.create_async_engine", return_value=engine),
        patch("app.jobs.document_summary.async_sessionmaker", return_value=session_factory),
        patch("app.jobs.document_summary.create_claude_client", return_value=mock_claude_obj),
        patch("app.ai.usage_logger.log_ai_usage", new_callable=AsyncMock),
    ):
        result = await document_summary_job({}, doc_id)

    assert result["status"] == "error"
    assert doc.status == "error"
    err = json.loads(doc.ai_summary)
    assert "Invalid" in err["error"] or "JSON" in err["error"]


@pytest.mark.asyncio
async def test_document_not_found():
    """Job gracefully handles missing document ID."""
    engine, session_factory, session = _patch_engine_and_session(None)

    with (
        patch("app.jobs.document_summary.create_async_engine", return_value=engine),
        patch("app.jobs.document_summary.async_sessionmaker", return_value=session_factory),
    ):
        result = await document_summary_job({}, str(uuid.uuid4()))

    assert result["status"] == "error"
    assert "not found" in result.get("error", "").lower()


def test_upload_trigger_only_enqueues_for_pdf():
    """Verify the router only enqueues document_summary_job for application/pdf."""
    # This is a static code inspection test — we verify the conditional in the router
    import ast
    import inspect

    from app.policy_documents.router import upload_policy_document

    source = inspect.getsource(upload_policy_document)
    tree = ast.parse(source)

    # Find the `if doc.content_type == "application/pdf"` guard
    found_pdf_guard = False
    for node in ast.walk(tree):
        if isinstance(node, ast.Compare):
            # Look for string comparison to "application/pdf"
            for comparator in node.comparators:
                if isinstance(comparator, ast.Constant) and comparator.value == "application/pdf":
                    found_pdf_guard = True

    assert found_pdf_guard, (
        "upload_policy_document must guard enqueue with "
        '`if doc.content_type == "application/pdf"`'
    )


def test_document_summary_job_registered_in_worker():
    """document_summary_job must be in WorkerSettings.functions."""
    from app.jobs.worker import WorkerSettings

    func_names = [f.__name__ if callable(f) else str(f) for f in WorkerSettings.functions]
    assert "document_summary_job" in func_names


def test_document_summary_prompt_exists():
    """DOCUMENT_SUMMARY_PROMPT should be a non-empty string."""
    assert isinstance(DOCUMENT_SUMMARY_PROMPT, str)
    assert len(DOCUMENT_SUMMARY_PROMPT) > 100


@pytest.mark.asyncio
async def test_happy_path_strips_code_fences():
    """Claude wraps JSON in ```json fences → job strips them and parses correctly."""
    doc = _make_policy_document()
    doc_id = str(doc.id)

    summary_payload = {
        "summary": "Omgevingsvisie gemeente.",
        "key_facts": ["Feit A"],
        "extracted_values": {},
    }
    fenced = f"```json\n{json.dumps(summary_payload)}\n```"
    claude_response = _make_claude_response(fenced)

    engine, session_factory, session = _patch_engine_and_session(doc)

    mock_claude_obj = MagicMock()
    mock_claude_obj.client.messages.create = AsyncMock(return_value=claude_response)
    mock_claude_obj.model = "claude-sonnet-4-5-20250929"

    with (
        patch("app.jobs.document_summary.create_async_engine", return_value=engine),
        patch("app.jobs.document_summary.async_sessionmaker", return_value=session_factory),
        patch("app.jobs.document_summary.create_claude_client", return_value=mock_claude_obj),
        patch("app.ai.usage_logger.log_ai_usage", new_callable=AsyncMock),
    ):
        result = await document_summary_job({}, doc_id)

    assert result["status"] == "parsed"
    stored = json.loads(doc.ai_summary)
    assert stored["summary"] == "Omgevingsvisie gemeente."
