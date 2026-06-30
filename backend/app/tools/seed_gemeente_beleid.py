"""Seed a gemeente beleidsdocument (PolicyDocument) + run its cascade extraction.

Generic, reusable replacement for the per-document Venlo seed scripts. Given a
gemeente code, a cascade source_key, and a PDF URL it:

  1. fetches the PDF and extracts its TEXT with PyMuPDF (image-heavy gemeente
     PDFs are too large for native-PDF extraction, so we store the text layer),
  2. upserts a vendor-global PolicyDocument (entity_type=gemeente) on the Hauzer
     demo org, and
  3. runs the matching cascade factor extraction inline (live Claude call) so the
     randvoorwaarden populate factor_extraction_cache — which is what makes the
     document appear with its applicable rules in the parcel sources panel /
     beleidscontext card.

Only the four cascade-extractable source_keys are supported (the only ones that
produce randvoorwaarden): omgevingsvisie, woonvisie, huisvestingsverordening,
parkeerbeleid.

Usage:
    cd backend
    python -m app.tools.seed_gemeente_beleid \
      --gemeente GM1507 \
      --source-key omgevingsvisie \
      --url "https://zoek.officielebekendmakingen.nl/gmb-2025-272105.pdf"

    # skip the (paid) extraction, only store the document:
    python -m app.tools.seed_gemeente_beleid ... --no-extract
"""

from __future__ import annotations

import argparse
import asyncio
import logging

import fitz  # type: ignore[import-untyped]  # PyMuPDF — no py.typed marker
import httpx
from sqlalchemy import or_, select

from app.ai.factor_extraction_schemas import DOCUMENT_SENTINEL
from app.ai.factors.beleidsalignement import OMGEVINGSVISIE_FACTOR_DEF
from app.ai.factors.parkeerdruk import PARKEERNORMEN_FACTOR_DEF
from app.ai.factors.splitsingsrisico import HUISVESTINGSVERORDENING_FACTOR_DEF
from app.ai.factors.woonvisie_match import WOONVISIE_MATCH_FACTOR_DEF
from app.core.config import settings
from app.core.database import async_session_factory
from app.models.policy_document import PolicyDocument
from app.models.user import User
from app.services.factor_extraction_service import extract_factor

logger = logging.getLogger(__name__)

HAUZER_EMAIL = "info@hauzer.nl"
MAX_CHARS = 480_000  # ~120k tokens safety cap

# source_key -> (factor_def, filename stem). Only these four are cascade-extracted.
BELEID_REGISTRY = {
    "omgevingsvisie": (OMGEVINGSVISIE_FACTOR_DEF, "omgevingsvisie"),
    "woonvisie": (WOONVISIE_MATCH_FACTOR_DEF, "woonvisie"),
    "huisvestingsverordening": (HUISVESTINGSVERORDENING_FACTOR_DEF, "huisvestingsverordening"),
    "parkeerbeleid": (PARKEERNORMEN_FACTOR_DEF, "parkeerbeleid"),
}


async def _fetch_pdf_text(url: str) -> bytes | None:
    """Fetch a PDF and return its extracted text as UTF-8 bytes (None on failure)."""
    async with httpx.AsyncClient(timeout=120.0, follow_redirects=True) as c:
        resp = await c.get(url, headers={"User-Agent": "propdex-seed/1.0"})
    if resp.status_code != 200 or not resp.content.startswith(b"%PDF"):
        logger.error("URL did not return a PDF (status=%s) — %s", resp.status_code, url)
        return None
    logger.info("Fetched %.1f KB PDF", len(resp.content) / 1024)

    doc_pdf = fitz.open(stream=resp.content, filetype="pdf")
    text = "\n".join(f"[p.{i}]\n{page.get_text()}" for i, page in enumerate(doc_pdf, start=1))
    text = text[:MAX_CHARS]
    text_bytes = text.encode("utf-8")
    logger.info(
        "Extracted %d pages -> %.1f KB text", doc_pdf.page_count, len(text_bytes) / 1024
    )
    if len(text_bytes) < 500:
        logger.error("Extracted text suspiciously small (%d bytes) — image-only PDF?", len(text_bytes))
        return None
    return text_bytes


async def _run(*, gemeente: str, source_key: str, url: str, do_extract: bool, model: str | None) -> int:
    if source_key not in BELEID_REGISTRY:
        logger.error(
            "source_key '%s' is not cascade-extractable. Supported: %s",
            source_key,
            ", ".join(BELEID_REGISTRY),
        )
        return 1
    factor_def, stem = BELEID_REGISTRY[source_key]

    text_bytes = await _fetch_pdf_text(url)
    if text_bytes is None:
        return 1

    if model:
        settings.AI_MODEL = model
        logger.info("Using model override: %s", model)

    async with async_session_factory() as session:
        user = (
            await session.execute(select(User).where(User.email == HAUZER_EMAIL))
        ).scalar_one_or_none()
        if user is None:
            logger.error("Hauzer user %s not found — run seed_hauzer_demo first", HAUZER_EMAIL)
            return 1
        org_id = user.organization_id

        existing = (
            await session.execute(
                select(PolicyDocument).where(
                    PolicyDocument.entity_type == "gemeente",
                    PolicyDocument.entity_code == gemeente,
                    PolicyDocument.source_key == source_key,
                    or_(PolicyDocument.is_global.is_(True), PolicyDocument.organization_id == org_id),
                )
            )
        ).scalar_one_or_none()

        if existing is not None:
            existing.file_data = text_bytes
            existing.file_size = len(text_bytes)
            existing.content_type = "text/plain"
            existing.filename = f"{stem}_{gemeente}.txt"
            existing.status = "uploaded"
            doc = existing
            logger.info("Updated existing %s PolicyDocument id=%s", source_key, doc.id)
        else:
            doc = PolicyDocument(
                entity_type="gemeente",
                entity_code=gemeente,
                source_key=source_key,
                filename=f"{stem}_{gemeente}.txt",
                content_type="text/plain",
                file_data=text_bytes,
                file_size=len(text_bytes),
                uploaded_by_user_id=user.id,
                organization_id=org_id,
                is_global=True,  # gemeente policy docs are shared across orgs
                status="uploaded",
                version_number=1,
            )
            session.add(doc)
            logger.info("Created %s PolicyDocument for %s", source_key, gemeente)
        await session.commit()
        await session.refresh(doc)

        if not do_extract:
            logger.info("Stored document id=%s (extraction skipped via --no-extract)", doc.id)
            return 0

        logger.info("Extracting %s (live call, force_refresh)…", factor_def.factor_id)
        result = await extract_factor(
            session,
            factor_def=factor_def,
            parcel_id=DOCUMENT_SENTINEL,
            policy_document=doc,
            force_refresh=True,
            # We store the text layer, so force the text path (native-PDF returns
            # empty for these on Sonnet via OpenRouter — see reextract_parkeernormen).
            max_pdf_doc_bytes=1,
        )
        rv = getattr(result.payload, "randvoorwaarden", [])
        logger.info("Done. doc=%s randvoorwaarden=%d", doc.id, len(rv))
        for r in rv:
            logger.info("  - [%s] %s", r.categorie, r.titel)
    return 0


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
    )
    parser = argparse.ArgumentParser(description="Seed a gemeente beleidsdocument + cascade extraction.")
    parser.add_argument("--gemeente", required=True, help="CBS gemeente code, e.g. GM1507")
    parser.add_argument(
        "--source-key",
        required=True,
        choices=sorted(BELEID_REGISTRY),
        help="Cascade beleid type",
    )
    parser.add_argument("--url", required=True, help="PDF URL")
    parser.add_argument(
        "--no-extract",
        action="store_true",
        help="Only store the document; skip the (paid) cascade extraction.",
    )
    parser.add_argument(
        "--model",
        default="anthropic/claude-sonnet-4.5",
        help="AI model override for the high-value document extraction.",
    )
    args = parser.parse_args()
    raise SystemExit(
        asyncio.run(
            _run(
                gemeente=args.gemeente,
                source_key=args.source_key,
                url=args.url,
                do_extract=not args.no_extract,
                model=args.model,
            )
        )
    )


if __name__ == "__main__":
    main()
