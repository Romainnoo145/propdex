"""Unit tests for chat persistence logic (_persist_chat_turn)."""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.agents.chat_schemas import ChatRequest, ChatResponse
from app.agents.chat_service import _persist_chat_turn


# ── Helpers ──────────────────────────────────────────────────────────────

def _make_request(message: str = "Zoek panden in Venlo", conversation_id: str | None = None) -> ChatRequest:
    return ChatRequest(message=message, conversation_id=conversation_id)


def _make_response(intent: str = "PARCEL_SEARCH", message: str | None = "5 resultaten") -> ChatResponse:
    return ChatResponse(intent=intent, message=message, params={"municipality": "Venlo"})


def _mock_db(existing_convo=None):
    """Create a mock AsyncSession. If existing_convo is given, SELECT returns it."""
    db = AsyncMock()

    # mock execute().scalar_one_or_none()
    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = existing_convo
    db.execute.return_value = result_mock

    # Track added objects
    db._added = []
    original_add = db.add

    def track_add(obj):
        db._added.append(obj)

    db.add = track_add

    # flush populates id on ChatConversation
    async def mock_flush():
        for obj in db._added:
            if hasattr(obj, "id") and obj.id is None:
                obj.id = uuid.uuid4()

    db.flush = mock_flush
    return db


# ── Tests: New conversation (conversation_id=None) ──────────────────────

class TestNewConversation:
    @pytest.mark.asyncio
    async def test_creates_conversation_and_messages(self):
        """When conversation_id is None, creates a new conversation + 2 messages."""
        db = _mock_db()
        user_id = str(uuid.uuid4())

        result = await _persist_chat_turn(
            db, user_id, None, _make_request(), _make_response(), 150
        )

        assert result is not None
        # Should have added 3 objects: conversation + user msg + assistant msg
        assert len(db._added) == 3
        # First is the conversation
        convo = db._added[0]
        assert convo.user_id == uuid.UUID(user_id)
        assert convo.message_count == 2

    @pytest.mark.asyncio
    async def test_returns_conversation_id_string(self):
        """Return value is a string UUID."""
        db = _mock_db()
        result = await _persist_chat_turn(
            db, str(uuid.uuid4()), None, _make_request(), _make_response(), 100
        )
        # Should be a valid UUID string
        uuid.UUID(result)


# ── Tests: Existing conversation ─────────────────────────────────────────

class TestExistingConversation:
    @pytest.mark.asyncio
    async def test_appends_to_existing_conversation(self):
        """When valid conversation_id provided and owned, appends messages."""
        cid = uuid.uuid4()
        user_id = str(uuid.uuid4())

        convo = MagicMock()
        convo.id = cid
        convo.user_id = uuid.UUID(user_id)
        convo.message_count = 2
        convo.last_message_at = None

        db = _mock_db(existing_convo=convo)

        result = await _persist_chat_turn(
            db, user_id, str(cid), _make_request(), _make_response(), 200
        )

        assert result == str(cid)
        # Should have updated message_count
        assert convo.message_count == 4  # was 2, +2
        # Should have added 2 messages (not a new conversation)
        assert len(db._added) == 2

    @pytest.mark.asyncio
    async def test_user_and_assistant_messages_have_correct_fields(self):
        """Verify message fields are populated correctly."""
        cid = uuid.uuid4()
        user_id = str(uuid.uuid4())

        convo = MagicMock()
        convo.id = cid
        convo.user_id = uuid.UUID(user_id)
        convo.message_count = 0

        db = _mock_db(existing_convo=convo)

        req = _make_request("Toon panden voor 1980")
        resp = _make_response("PARCEL_SEARCH", "10 resultaten")

        await _persist_chat_turn(db, user_id, str(cid), req, resp, 300)

        user_msg = db._added[0]
        assert user_msg.role == "user"
        assert user_msg.content == "Toon panden voor 1980"
        assert user_msg.conversation_id == cid

        assistant_msg = db._added[1]
        assert assistant_msg.role == "assistant"
        assert assistant_msg.content == "10 resultaten"
        assert assistant_msg.intent == "PARCEL_SEARCH"
        assert assistant_msg.duration_ms == 300


# ── Tests: Ownership validation ──────────────────────────────────────────

class TestOwnershipValidation:
    @pytest.mark.asyncio
    async def test_foreign_conversation_id_creates_new(self):
        """If conversation_id doesn't belong to user, creates a new conversation."""
        db = _mock_db(existing_convo=None)  # SELECT returns None = not found/not owned

        result = await _persist_chat_turn(
            db, str(uuid.uuid4()), str(uuid.uuid4()),
            _make_request(), _make_response(), 100,
        )

        assert result is not None
        # Should have created a new conversation (3 objects: convo + 2 msgs)
        assert len(db._added) == 3

    @pytest.mark.asyncio
    async def test_invalid_uuid_format_creates_new(self):
        """If conversation_id is not a valid UUID, creates a new conversation."""
        db = _mock_db()

        result = await _persist_chat_turn(
            db, str(uuid.uuid4()), "not-a-uuid",
            _make_request(), _make_response(), 100,
        )

        assert result is not None
        assert len(db._added) == 3


# ── Tests: Fire-and-forget (error resilience) ────────────────────────────

class TestFireAndForget:
    @pytest.mark.asyncio
    async def test_db_failure_returns_none(self):
        """If DB throws during persistence, returns None without raising."""
        db = AsyncMock()
        db.execute.side_effect = Exception("DB connection lost")

        result = await _persist_chat_turn(
            db, str(uuid.uuid4()), str(uuid.uuid4()),
            _make_request(), _make_response(), 100,
        )

        assert result is None

    @pytest.mark.asyncio
    async def test_flush_failure_returns_none(self):
        """If flush throws, returns None without raising."""
        db = _mock_db()

        async def failing_flush():
            raise RuntimeError("constraint violation")

        db.flush = failing_flush

        # Use no conversation_id so it tries to create + flush
        result = await _persist_chat_turn(
            db, str(uuid.uuid4()), None,
            _make_request(), _make_response(), 100,
        )

        assert result is None
