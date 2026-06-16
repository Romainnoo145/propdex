"""One-off: ingest the Huisvestingsverordening Venlo 2026 as a PolicyDocument (M053/S12).

The source PDF is a small (~260 KB) local file, so we store the raw PDF bytes
directly as application/pdf — keeping it viewable in the UI (same proven pattern
as the existing Venlo woonvisie doc). The shared extractor handles PDFs natively.
Stored on the Hauzer demo org (info@hauzer.nl) as a vendor-global doc so cascade
enrichment can extract splitsingsrisico for Venlo parcels.

The source_key matches AUTO_INGESTIBLE_DOCUMENTS so future CVDR versions flow
into the same cascade.

Usage:
    cd backend
    python -m app.tools.seed_huisvestingsverordening_venlo \
      --pdf "/path/to/Huisvestingsverordening gemeente Venlo 2026.pdf"
"""
from __future__ import annotations

import argparse
import asyncio
import logging
from pathlib import Path

from sqlalchemy import or_, select

from app.core.database import async_session_factory
from app.models.policy_document import PolicyDocument
from app.models.user import User

logger = logging.getLogger(__name__)

VENLO_GM = "GM0983"
HAUZER_EMAIL = "info@hauzer.nl"
SOURCE_KEY = "huisvestingsverordening"
DEFAULT_PDF = (
    "/home/klarifai/Documents/Propdex/"
    "Huisvestingsverordening gemeente Venlo 2026 _ Lokale wet- en regelgeving.pdf"
)


async def _run(pdf_path: str) -> int:
    path = Path(pdf_path)
    if not path.is_file():
        logger.error("PDF file not found: %s", pdf_path)
        return 1
    pdf_bytes = path.read_bytes()
    if not pdf_bytes.startswith(b"%PDF"):
        logger.error("File is not a PDF (missing %%PDF header): %s", pdf_path)
        return 1
    logger.info("Read %.1f KB PDF from %s", len(pdf_bytes) / 1024, pdf_path)

    async with async_session_factory() as session:
        user = (
            await session.execute(select(User).where(User.email == HAUZER_EMAIL))
        ).scalar_one_or_none()
        if user is None:
            logger.error(
                "Hauzer user %s not found - run seed_hauzer_demo first", HAUZER_EMAIL
            )
            return 1
        org_id = user.organization_id

        existing = (
            await session.execute(
                select(PolicyDocument).where(
                    PolicyDocument.entity_type == "gemeente",
                    PolicyDocument.entity_code == VENLO_GM,
                    PolicyDocument.source_key == SOURCE_KEY,
                    or_(
                        PolicyDocument.is_global.is_(True),
                        PolicyDocument.organization_id == org_id,
                    ),
                )
            )
        ).scalar_one_or_none()
        if existing is not None:
            logger.info(
                "Huisvestingsverordening already seeded (id=%s) - skipping",
                existing.id,
            )
            return 0

        doc = PolicyDocument(
            entity_type="gemeente",
            entity_code=VENLO_GM,
            source_key=SOURCE_KEY,
            filename="huisvestingsverordening_venlo_2026.pdf",
            content_type="application/pdf",
            file_data=pdf_bytes,
            file_size=len(pdf_bytes),
            uploaded_by_user_id=user.id,
            organization_id=org_id,
            is_global=True,  # vendor-global: gemeente policy docs are shared across orgs
            status="uploaded",
            version_number=1,
        )
        session.add(doc)
        await session.commit()
        logger.info(
            "Seeded huisvestingsverordening PolicyDocument id=%s org=%s",
            doc.id,
            org_id,
        )
    return 0


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
    )
    parser = argparse.ArgumentParser(
        description="Seed the Huisvestingsverordening Venlo 2026 PolicyDocument."
    )
    parser.add_argument(
        "--pdf",
        default=DEFAULT_PDF,
        help="Local PDF path (defaults to the confirmed Venlo 2026 file)",
    )
    raise SystemExit(asyncio.run(_run(parser.parse_args().pdf)))


if __name__ == "__main__":
    main()
