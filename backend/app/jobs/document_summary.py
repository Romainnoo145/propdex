"""Document AI summarization background job for ARQ worker.

Reads a PolicyDocument PDF, sends it to Claude with DOCUMENT_SUMMARY_PROMPT,
writes structured JSON to ai_summary, and transitions status through
uploaded → parsing → parsed / error.
"""

import base64
import json
import logging
import time
from datetime import datetime

import anthropic
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.ai.claude_client import AIParsingError, create_claude_client
from app.ai.prompts import DOCUMENT_SUMMARY_PROMPT
from app.core.config import settings
from app.models.policy_document import PolicyDocument

logger = logging.getLogger(__name__)


async def document_summary_job(ctx: dict, document_id: str) -> dict:
    """
    Background job: Summarize a policy document PDF with Claude AI.

    Runs in ARQ worker process with its own DB engine/session.
    Status lifecycle: uploaded → parsing → parsed | error.

    Args:
        ctx: ARQ context dict (contains redis connection, etc.)
        document_id: UUID string of the PolicyDocument to summarize.

    Returns:
        dict with document_id and status for ARQ result storage.
    """
    engine = create_async_engine(
        settings.DATABASE_URL,
        pool_size=5,
        max_overflow=10,
        echo=False,
    )
    session_factory = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )

    try:
        async with session_factory() as session:
            # ── Load document ────────────────────────────────────────
            stmt = select(PolicyDocument).where(PolicyDocument.id == document_id)
            result = await session.execute(stmt)
            doc = result.scalar_one_or_none()

            if not doc:
                logger.error("PolicyDocument not found for id=%s", document_id)
                return {"document_id": document_id, "status": "error", "error": "Document not found"}

            # ── Transition: uploaded → parsing ───────────────────────
            doc.status = "parsing"
            doc.updated_at = datetime.utcnow()
            session.add(doc)
            await session.commit()

            logger.info(
                "Starting AI summary for document %s (%s, %d bytes)",
                document_id, doc.filename, doc.file_size,
            )

            # ── Call Claude with PDF ─────────────────────────────────
            try:
                claude = create_claude_client()
                pdf_base64 = base64.standard_b64encode(doc.file_data).decode("utf-8")

                _t0 = time.monotonic()
                response = await claude.client.messages.create(
                    model=claude.model,
                    max_tokens=4096,
                    system=[
                        {
                            "type": "text",
                            "text": DOCUMENT_SUMMARY_PROMPT,
                            "cache_control": {"type": "ephemeral"},
                        }
                    ],
                    messages=[
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "document",
                                    "source": {
                                        "type": "base64",
                                        "media_type": "application/pdf",
                                        "data": pdf_base64,
                                    },
                                    "cache_control": {"type": "ephemeral"},
                                },
                                {
                                    "type": "text",
                                    "text": (
                                        f"Analyseer dit beleidsdocument ({doc.filename}) "
                                        "en produceer een gestructureerde samenvatting "
                                        "volgens de instructies."
                                    ),
                                },
                            ],
                        }
                    ],
                )
                _duration_ms = int((time.monotonic() - _t0) * 1000)

                # Fire-and-forget usage logging
                from app.ai.usage_logger import log_ai_usage

                await log_ai_usage(
                    call_site="document_summary",
                    model=claude.model,
                    usage=response.usage,
                    duration_ms=_duration_ms,
                )

            except (anthropic.RateLimitError, anthropic.APIConnectionError, anthropic.APIError) as e:
                logger.error("Claude API error for document %s: %s", document_id, e)
                doc.status = "error"
                doc.ai_summary = json.dumps({"error": str(e)[:500]})
                doc.updated_at = datetime.utcnow()
                session.add(doc)
                await session.commit()
                return {"document_id": document_id, "status": "error", "error": str(e)}

            # ── Extract JSON from response ───────────────────────────
            text_content = None
            if response.content:
                for block in response.content:
                    if block.type == "text":
                        text_content = block.text
                        break

            if not text_content:
                logger.error("Claude returned empty response for document %s", document_id)
                doc.status = "error"
                doc.ai_summary = json.dumps({"error": "Claude returned empty response"})
                doc.updated_at = datetime.utcnow()
                session.add(doc)
                await session.commit()
                return {"document_id": document_id, "status": "error", "error": "Empty response"}

            # Strip markdown code fences
            json_text = text_content.strip()
            if json_text.startswith("```json"):
                json_text = json_text[7:]
            if json_text.startswith("```"):
                json_text = json_text[3:]
            if json_text.endswith("```"):
                json_text = json_text[:-3]
            json_text = json_text.strip()

            # Validate JSON structure
            try:
                summary_data = json.loads(json_text)
                # Ensure expected keys are present
                if not isinstance(summary_data, dict):
                    raise ValueError("Expected JSON object")
                for key in ("summary", "key_facts", "extracted_values"):
                    if key not in summary_data:
                        summary_data[key] = [] if key == "key_facts" else ({} if key == "extracted_values" else "")
            except (json.JSONDecodeError, ValueError) as e:
                logger.error(
                    "Invalid JSON from Claude for document %s: %s — raw: %.200s",
                    document_id, e, json_text,
                )
                doc.status = "error"
                doc.ai_summary = json.dumps({"error": f"Invalid AI response: {e}"})
                doc.updated_at = datetime.utcnow()
                session.add(doc)
                await session.commit()
                return {"document_id": document_id, "status": "error", "error": f"Invalid JSON: {e}"}

            # ── Transition: parsing → parsed ─────────────────────────
            doc.ai_summary = json.dumps(summary_data, ensure_ascii=False)
            doc.status = "parsed"
            doc.updated_at = datetime.utcnow()
            session.add(doc)
            await session.commit()

            logger.info(
                "AI summary complete for document %s: %d key_facts, %d extracted_values",
                document_id,
                len(summary_data.get("key_facts", [])),
                len(summary_data.get("extracted_values", {})),
            )
            return {"document_id": document_id, "status": "parsed"}

    except Exception as e:
        logger.exception("Unexpected error in document_summary_job for %s: %s", document_id, e)
        # Try to mark as error
        try:
            async with session_factory() as session:
                stmt = select(PolicyDocument).where(PolicyDocument.id == document_id)
                result = await session.execute(stmt)
                doc = result.scalar_one_or_none()
                if doc:
                    doc.status = "error"
                    doc.ai_summary = json.dumps({"error": str(e)[:500]})
                    doc.updated_at = datetime.utcnow()
                    session.add(doc)
                    await session.commit()
        except Exception as update_err:
            logger.error("Failed to update document status after error: %s", update_err)

        return {"document_id": document_id, "status": "error", "error": str(e)}
    finally:
        await engine.dispose()
