"""Beleidsdocumenten ingest service — downloads and stores gemeente policy documents.

Fetches PDFs from officielebekendmakingen.nl based on KOOP SRU search results,
stores them as GemeenteDocument records, and optionally triggers AI summarization.
"""

from __future__ import annotations

import asyncio
import logging

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.gemeente_document import GemeenteDocument
from app.services.koop_sru_client import (
    BELEID_DOCUMENT_TYPES,
    VerordeningResult,
    search_beleidsdocument,
)

logger = logging.getLogger(__name__)

MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 MB


async def _download_pdf(url: str, *, timeout: float = 30.0) -> tuple[bytes, str] | None:
    """Download a document from officielebekendmakingen.nl.

    Tries the PDF variant first (appending /pdf), falls back to the HTML page.
    Returns (file_bytes, content_type) or None on failure.
    """
    pdf_url = f"{url}/pdf" if not url.endswith("/pdf") else url

    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            resp = await client.get(pdf_url)
            if resp.status_code == 200 and "pdf" in (resp.headers.get("content-type", "")):
                if len(resp.content) > MAX_FILE_SIZE:
                    logger.warning("PDF too large (%d bytes): %s", len(resp.content), pdf_url)
                    return None
                return resp.content, "application/pdf"

            # Fallback: fetch the HTML page itself
            resp = await client.get(url)
            if resp.status_code == 200:
                content = resp.content
                if len(content) > MAX_FILE_SIZE:
                    logger.warning("HTML too large (%d bytes): %s", len(content), url)
                    return None
                ct = resp.headers.get("content-type", "text/html").split(";")[0].strip()
                return content, ct

    except httpx.TimeoutException:
        logger.warning("Download timed out: %s", url)
    except Exception:
        logger.exception("Download failed: %s", url)

    return None


async def _already_ingested(
    db: AsyncSession,
    gemeente_naam: str,
    koop_identifier: str,
) -> bool:
    """Check if a document with this identifier already exists."""
    result = await db.execute(
        select(GemeenteDocument.id).where(
            GemeenteDocument.gemeente_naam == gemeente_naam,
            GemeenteDocument.koop_identifier == koop_identifier,
        )
    )
    return result.scalar_one_or_none() is not None


async def ingest_beleidsdocument(
    gemeente_naam: str,
    document_type: str,
    result: VerordeningResult,
    db: AsyncSession,
) -> GemeenteDocument | None:
    """Download and store a single beleidsdocument.

    Skips if already ingested (based on koop_identifier).
    Returns the stored GemeenteDocument or None.
    """
    if await _already_ingested(db, gemeente_naam, result.identifier):
        logger.info(
            "Already ingested %s for %s (%s)", document_type, gemeente_naam, result.identifier
        )
        return None

    downloaded = await _download_pdf(result.url)
    if downloaded is None:
        logger.warning(
            "Could not download %s for %s: %s", document_type, gemeente_naam, result.url
        )
        return None

    file_bytes, content_type = downloaded
    filename = f"{gemeente_naam}_{document_type}_{result.identifier}.pdf"

    doc = GemeenteDocument(
        gemeente_naam=gemeente_naam,
        document_type=document_type,
        filename=filename,
        content_type=content_type,
        file_data=file_bytes,
        file_size=len(file_bytes),
        source_url=result.url,
        koop_identifier=result.identifier,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    logger.info(
        "Ingested %s for %s: %s (%d bytes)",
        document_type,
        gemeente_naam,
        result.title,
        len(file_bytes),
    )

    # Attempt AI summarization (non-blocking)
    await _try_ai_summarize(doc, file_bytes, content_type, db)

    return doc


async def _try_ai_summarize(
    doc: GemeenteDocument,
    file_bytes: bytes,
    content_type: str,
    db: AsyncSession,
) -> None:
    """Attempt AI summarization for the document. Failures are silent."""
    try:
        from app.services.document_summarizer import summarize_document

        summary = await summarize_document(file_bytes, content_type, doc.filename)
        if summary:
            doc.ai_summary = summary
            await db.commit()
    except Exception:
        logger.debug("AI summarization skipped for %s", doc.filename)


async def ingest_all_beleidsdocumenten(
    gemeente_naam: str,
    db: AsyncSession,
) -> list[GemeenteDocument]:
    """Search and ingest all beleidsdocumenten for a municipality.

    Searches KOOP SRU for all document types in parallel, then downloads
    and stores any new documents found.

    Returns list of newly ingested GemeenteDocument records.
    """
    # Include huisvestingsverordening alongside the standard beleid types
    all_types = {**BELEID_DOCUMENT_TYPES, "huisvestingsverordening": ["huisvestingsverordening"]}

    # Search all types in parallel
    search_tasks = {
        doc_type: search_beleidsdocument(gemeente_naam, title_terms)
        for doc_type, title_terms in all_types.items()
    }
    results = await asyncio.gather(*search_tasks.values(), return_exceptions=True)

    # Ingest found documents sequentially (shared db session)
    ingested: list[GemeenteDocument] = []
    for doc_type, result in zip(search_tasks.keys(), results):
        if isinstance(result, Exception):
            logger.warning("Search failed for %s/%s: %s", gemeente_naam, doc_type, result)
            continue
        if result is None:
            continue

        doc = await ingest_beleidsdocument(gemeente_naam, doc_type, result, db)
        if doc is not None:
            ingested.append(doc)

    logger.info(
        "Beleidsdocumenten ingest complete for %s: %d new documents",
        gemeente_naam,
        len(ingested),
    )
    return ingested


async def get_gemeente_documents(
    gemeente_naam: str,
    db: AsyncSession,
    document_type: str | None = None,
) -> list[GemeenteDocument]:
    """List stored gemeente documents (without file_data bytes)."""
    from sqlalchemy.orm import defer

    query = (
        select(GemeenteDocument)
        .options(defer(GemeenteDocument.file_data))
        .where(GemeenteDocument.gemeente_naam == gemeente_naam)
        .order_by(GemeenteDocument.created_at.desc())
    )
    if document_type is not None:
        query = query.where(GemeenteDocument.document_type == document_type)

    result = await db.execute(query)
    return list(result.scalars().all())
