"""AI document summarization service.

Summarizes uploaded parcel documents using Claude. Extracts text from
PDF documents and generates a concise Dutch summary.
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


async def summarize_document(
    file_data: bytes,
    content_type: str,
    filename: str,
) -> str | None:
    """Generate an AI summary of a document.

    For PDF documents, sends the PDF to Claude for summarization.
    For other types, returns None (not supported yet).

    Args:
        file_data: Raw file bytes
        content_type: MIME type
        filename: Original filename

    Returns:
        Dutch summary string, or None if summarization not possible
    """
    if content_type != "application/pdf":
        logger.debug("Skipping summarization for non-PDF: %s", content_type)
        return None

    try:
        from app.ai.claude_client import AIParsingError, create_claude_client

        client = create_claude_client()

        import base64
        pdf_b64 = base64.standard_b64encode(file_data).decode("utf-8")

        response = await client.client.messages.create(
            model=client.model,
            max_tokens=1000,
            system="Je bent een Nederlandse vastgoed-expert. Geef een beknopte samenvatting (max 3 zinnen) van dit document in het Nederlands. Focus op wat relevant is voor vastgoedontwikkeling: bestemmingen, bouwregels, vergunningseisen, risico's.",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "document",
                            "source": {
                                "type": "base64",
                                "media_type": "application/pdf",
                                "data": pdf_b64,
                            },
                        },
                        {
                            "type": "text",
                            "text": f"Vat dit document samen (bestandsnaam: {filename}). Maximaal 3 zinnen, in het Nederlands.",
                        },
                    ],
                }
            ],
        )

        if response.content:
            for block in response.content:
                if block.type == "text":
                    logger.info("Summarized %s: %d chars", filename, len(block.text))
                    return block.text.strip()

        return None

    except ImportError:
        logger.debug("Claude client not available for summarization")
        return None
    except Exception:
        logger.warning("Document summarization failed for %s", filename, exc_info=True)
        return None
