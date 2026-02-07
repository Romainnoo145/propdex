"""PDF download service for bestemmingsplan documents from Ruimtelijkeplannen.nl."""

import logging
import re
import uuid
from datetime import datetime

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.pdf_document import PDFDocument

logger = logging.getLogger(__name__)

# IMRO identifier pattern: NL.IMRO.{gemeentecode}.{planid}-{versie}
# Example: NL.IMRO.0363.BP2024CENTRUM-VA01
IMRO_PATTERN = re.compile(r"^NL\.IMRO\.\d{4}\..+-\w+$")

# PDF validation
PDF_MAGIC_BYTES = b"%PDF"
MAX_PDF_SIZE = 100 * 1024 * 1024  # 100MB


class PDFDownloadError(Exception):
    """Raised when PDF download or validation fails."""

    pass


def validate_imro_identifier(plan_idn: str) -> bool:
    """
    Validate IMRO plan identifier format.

    Args:
        plan_idn: Plan identifier to validate

    Returns:
        True if valid IMRO format, False otherwise
    """
    return bool(IMRO_PATTERN.match(plan_idn))


def construct_pdf_url(plan_idn: str) -> str | None:
    """
    Construct PDF download URL for Ruimtelijkeplannen.nl.

    Pattern: https://www.ruimtelijkeplannen.nl/documents/{plan_idn}/d_{plan_idn}.pdf

    Args:
        plan_idn: IMRO plan identifier

    Returns:
        PDF download URL or None if construction fails
    """
    try:
        return f"https://www.ruimtelijkeplannen.nl/documents/{plan_idn}/d_{plan_idn}.pdf"
    except Exception as e:
        logger.error(f"Failed to construct PDF URL for {plan_idn}: {e}")
        return None


async def get_stored_pdf(
    plan_idn: str,
    organization_id: uuid.UUID,
    session: AsyncSession,
) -> PDFDocument | None:
    """
    Check if PDF is already stored for this plan and organization.

    Args:
        plan_idn: IMRO plan identifier
        organization_id: Tenant ID
        session: SQLAlchemy async session

    Returns:
        PDFDocument if found, None otherwise
    """
    stmt = select(PDFDocument).where(
        PDFDocument.organization_id == organization_id,
        PDFDocument.plan_idn == plan_idn,
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def download_and_store_pdf(
    plan_idn: str,
    organization_id: uuid.UUID,
    session: AsyncSession,
    client: httpx.AsyncClient,
) -> PDFDocument:
    """
    Download bestemmingsplan PDF from Ruimtelijkeplannen.nl and store in database.

    Validates IMRO identifier, downloads PDF, validates content, and stores in
    PostgreSQL with metadata.

    Args:
        plan_idn: IMRO plan identifier
        organization_id: Tenant ID
        session: SQLAlchemy async session
        client: Shared httpx AsyncClient for downloads

    Returns:
        PDFDocument: Stored PDF document record

    Raises:
        PDFDownloadError: If validation, download, or storage fails
    """
    # Check if already stored
    existing = await get_stored_pdf(plan_idn, organization_id, session)
    if existing:
        logger.info(f"PDF already stored for {plan_idn} (org {organization_id})")
        return existing

    # Validate IMRO identifier
    if not validate_imro_identifier(plan_idn):
        raise PDFDownloadError(
            f"Invalid IMRO identifier format: {plan_idn}. "
            f"Expected format: NL.IMRO.{{gemeentecode}}.{{planid}}-{{versie}}"
        )

    # Construct download URL
    url = construct_pdf_url(plan_idn)
    if not url:
        raise PDFDownloadError(f"Could not construct download URL for {plan_idn}")

    # Download PDF
    logger.info(f"Downloading PDF from {url}")
    try:
        response = await client.get(url, timeout=60.0, follow_redirects=True)
        response.raise_for_status()
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            raise PDFDownloadError(
                f"PDF not found at Ruimtelijkeplannen.nl for {plan_idn}"
            ) from e
        raise PDFDownloadError(
            f"HTTP error downloading PDF: {e.response.status_code}"
        ) from e
    except httpx.TimeoutException as e:
        raise PDFDownloadError("Download timeout after 60 seconds") from e
    except Exception as e:
        raise PDFDownloadError(f"Download failed: {e}") from e

    pdf_data = response.content

    # Validate PDF content
    if not pdf_data.startswith(PDF_MAGIC_BYTES):
        raise PDFDownloadError(
            f"Downloaded file is not a valid PDF (missing {PDF_MAGIC_BYTES} header)"
        )

    if len(pdf_data) > MAX_PDF_SIZE:
        raise PDFDownloadError(
            f"PDF size {len(pdf_data)} bytes exceeds maximum {MAX_PDF_SIZE} bytes (100MB)"
        )

    if len(pdf_data) == 0:
        raise PDFDownloadError("Downloaded PDF is empty")

    # Store in database
    pdf_doc = PDFDocument(
        organization_id=organization_id,
        plan_idn=plan_idn,
        file_data=pdf_data,
        file_size=len(pdf_data),
        source_url=url,
        is_user_uploaded=False,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )

    session.add(pdf_doc)
    await session.flush()
    await session.commit()

    logger.info(
        f"Successfully stored PDF for {plan_idn} ({len(pdf_data)} bytes, "
        f"org {organization_id})"
    )

    return pdf_doc


async def store_uploaded_pdf(
    plan_idn: str,
    pdf_data: bytes,
    organization_id: uuid.UUID,
    session: AsyncSession,
) -> PDFDocument:
    """
    Store user-uploaded PDF in database.

    Validates PDF content and IMRO identifier before storing.

    Args:
        plan_idn: IMRO plan identifier
        pdf_data: PDF file bytes
        organization_id: Tenant ID
        session: SQLAlchemy async session

    Returns:
        PDFDocument: Stored PDF document record

    Raises:
        PDFDownloadError: If validation or storage fails
    """
    # Validate PDF magic bytes
    if not pdf_data.startswith(PDF_MAGIC_BYTES):
        raise PDFDownloadError(
            f"File is not a valid PDF (missing {PDF_MAGIC_BYTES} header)"
        )

    # Validate size
    if len(pdf_data) > MAX_PDF_SIZE:
        raise PDFDownloadError(
            f"PDF size {len(pdf_data)} bytes exceeds maximum {MAX_PDF_SIZE} bytes (100MB)"
        )

    if len(pdf_data) == 0:
        raise PDFDownloadError("PDF file is empty")

    # Validate IMRO identifier
    if not validate_imro_identifier(plan_idn):
        raise PDFDownloadError(
            f"Invalid IMRO identifier format: {plan_idn}. "
            f"Expected format: NL.IMRO.{{gemeentecode}}.{{planid}}-{{versie}}"
        )

    # Store in database
    pdf_doc = PDFDocument(
        organization_id=organization_id,
        plan_idn=plan_idn,
        file_data=pdf_data,
        file_size=len(pdf_data),
        source_url=None,
        is_user_uploaded=True,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )

    session.add(pdf_doc)
    await session.flush()
    await session.commit()

    logger.info(
        f"Successfully stored user-uploaded PDF for {plan_idn} "
        f"({len(pdf_data)} bytes, org {organization_id})"
    )

    return pdf_doc
