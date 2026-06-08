"""One-off: ingest the Omgevingsvisie Venlo 2040 as a PolicyDocument (M053/S01).

The source PDF is ~30 MB (image-heavy) — too large for the extraction API — so we
store the fitz-extracted TEXT (text/plain). The shared extractor auto-detects text.
Stored on the Hauzer demo org (info@hauzer.nl) so cascade enrichment can extract
beleidsalignement for Venlo parcels.

Usage:
    cd backend
    python -m app.tools.seed_omgevingsvisie_venlo \
      --url "https://gemeenteraad.venlo.nl/Vergaderingen/Agendacommissie/2025/02-april/17:30/Concept-agenda-s-commissies/381324-Bijl01-Omgevingsvisie-Venlo-2040.pdf"
"""
from __future__ import annotations

import argparse
import asyncio
import logging

import fitz  # type: ignore[import-untyped]  # PyMuPDF — no py.typed marker
import httpx
from sqlalchemy import or_, select

from app.core.database import async_session_factory
from app.models.policy_document import PolicyDocument
from app.models.user import User

logger = logging.getLogger(__name__)

VENLO_GM = "GM0983"
HAUZER_EMAIL = "info@hauzer.nl"
DEFAULT_URL = (
    "https://gemeenteraad.venlo.nl/Vergaderingen/Agendacommissie/2025/02-april/17:30/"
    "Concept-agenda-s-commissies/381324-Bijl01-Omgevingsvisie-Venlo-2040.pdf"
)
MAX_CHARS = 480_000  # ~120k tokens safety cap


async def _run(url: str) -> int:
    async with httpx.AsyncClient(timeout=120.0, follow_redirects=True) as c:
        resp = await c.get(url, headers={"User-Agent": "propdex-seed/1.0"})
    if resp.status_code != 200 or not resp.content.startswith(b"%PDF"):
        logger.error("URL did not return a PDF (status=%s)", resp.status_code)
        return 1
    pdf = resp.content
    logger.info("Fetched %.1f KB PDF", len(pdf) / 1024)

    doc_pdf = fitz.open(stream=pdf, filetype="pdf")
    text = "\n".join(
        f"[p.{i}]\n{page.get_text()}" for i, page in enumerate(doc_pdf, start=1)
    )
    text = text[:MAX_CHARS]
    text_bytes = text.encode("utf-8")
    logger.info(
        "Extracted %d pages -> %.1f KB text", doc_pdf.page_count, len(text_bytes) / 1024
    )

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
                    PolicyDocument.source_key == "omgevingsvisie",
                    or_(
                        PolicyDocument.is_global.is_(True),
                        PolicyDocument.organization_id == org_id,
                    ),
                )
            )
        ).scalar_one_or_none()
        if existing is not None:
            logger.info(
                "Omgevingsvisie already seeded (id=%s) - skipping", existing.id
            )
            return 0

        doc = PolicyDocument(
            entity_type="gemeente",
            entity_code=VENLO_GM,
            source_key="omgevingsvisie",
            filename="omgevingsvisie_venlo_2040.txt",
            content_type="text/plain",
            file_data=text_bytes,
            file_size=len(text_bytes),
            uploaded_by_user_id=user.id,
            organization_id=org_id,
            is_global=True,  # vendor-global: gemeente policy docs are shared across orgs
            status="uploaded",
            version_number=1,
        )
        session.add(doc)
        await session.commit()
        logger.info(
            "Seeded omgevingsvisie PolicyDocument id=%s org=%s", doc.id, org_id
        )
    return 0


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
    )
    parser = argparse.ArgumentParser(
        description="Seed the Omgevingsvisie Venlo 2040 PolicyDocument."
    )
    parser.add_argument(
        "--url",
        default=DEFAULT_URL,
        help="PDF URL (defaults to the confirmed Venlo 2040 URL)",
    )
    raise SystemExit(asyncio.run(_run(parser.parse_args().url)))


if __name__ == "__main__":
    main()
