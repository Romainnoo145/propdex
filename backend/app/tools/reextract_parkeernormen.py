"""One-off: force a live re-extraction of the Venlo Nota parkeernormen at the current
SCHEMA_VERSION (M054/S07 — populates the parkeerdruk cache). Forces the text-layer path
(max_pdf_doc_bytes=1) because native-PDF extraction returns empty on Sonnet via OpenRouter.

Usage:
    python -m app.tools.reextract_parkeernormen [--gemeente GM0983]
"""

import argparse
import asyncio

from sqlalchemy import or_, select

from app.ai.factor_extraction_schemas import DOCUMENT_SENTINEL
from app.ai.factors.parkeerdruk import PARKEERNORMEN_FACTOR_DEF
from app.core.config import settings
from app.core.database import async_session_factory
from app.models.policy_document import PolicyDocument
from app.services.factor_extraction_service import extract_factor


async def main(gemeente: str, model: str | None) -> None:
    if model:
        settings.AI_MODEL = model
        print(f"Using model override: {model}")
    async with async_session_factory() as db:
        stmt = (
            select(PolicyDocument)
            .where(
                PolicyDocument.entity_type == "gemeente",
                PolicyDocument.entity_code == gemeente,
                PolicyDocument.source_key == "parkeerbeleid",
                or_(PolicyDocument.is_global.is_(True), PolicyDocument.file_data.isnot(None)),
                PolicyDocument.file_data.isnot(None),
            )
            .order_by(PolicyDocument.version_number.desc(), PolicyDocument.created_at.desc())
            .limit(1)
        )
        doc = (await db.execute(stmt)).scalar_one_or_none()
        if doc is None:
            print(f"No parkeerbeleid document found for gemeente={gemeente}")
            return

        print(f"Re-extracting parkeernormen doc={doc.id} (force_refresh, text-path, live)...")
        result = await extract_factor(
            db,
            factor_def=PARKEERNORMEN_FACTOR_DEF,
            parcel_id=DOCUMENT_SENTINEL,
            policy_document=doc,
            force_refresh=True,
            max_pdf_doc_bytes=1,
        )
        p = result.payload
        print(f"Done. confidence={getattr(p, 'confidence', '?')}")
        for field in ("normbanden", "randvoorwaarden", "gebied_normen"):
            val = getattr(p, field, None)
            if val is not None:
                print(f"  {field}={len(val)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--gemeente", default="GM0983")
    parser.add_argument("--model", default="anthropic/claude-sonnet-4.5")
    args = parser.parse_args()
    asyncio.run(main(args.gemeente, args.model))
