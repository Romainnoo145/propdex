"""Re-extract the regional Woondeal for a provincie (M054/S06).

Document-level extraction (force_refresh) that warms FactorExtractionCache so the
read-only /woondeal endpoint serves the structured payload. Run once after
uploading the Woondeal PDF as an entity_type=provincie, source_key=woondeals doc.

Usage:
    cd backend
    python -m app.tools.reextract_woondeal --provincie PV31
"""

import argparse
import asyncio

from sqlalchemy import or_, select

from app.ai.factor_extraction_schemas import DOCUMENT_SENTINEL
from app.ai.factors.woondeal import WOONDEAL_FACTOR_DEF
from app.core.config import settings
from app.core.database import async_session_factory
from app.models.policy_document import PolicyDocument
from app.services.factor_extraction_service import extract_factor


async def main(provincie: str, model: str | None) -> None:
    if model:
        settings.AI_MODEL = model
        print(f"Using model override: {model}")
    async with async_session_factory() as db:
        stmt = (
            select(PolicyDocument)
            .where(
                PolicyDocument.entity_type == "provincie",
                PolicyDocument.entity_code == provincie,
                PolicyDocument.source_key == "woondeals",
                or_(PolicyDocument.is_global.is_(True), PolicyDocument.file_data.isnot(None)),
                PolicyDocument.file_data.isnot(None),
            )
            .order_by(PolicyDocument.version_number.desc(), PolicyDocument.created_at.desc())
            .limit(1)
        )
        doc = (await db.execute(stmt)).scalar_one_or_none()
        if doc is None:
            print(f"No woondeals document found for provincie={provincie}")
            return

        print(f"Re-extracting woondeal doc={doc.id} (force_refresh, live Claude call)...")
        result = await extract_factor(
            db,
            factor_def=WOONDEAL_FACTOR_DEF,
            parcel_id=DOCUMENT_SENTINEL,
            policy_document=doc,
            force_refresh=True,
        )
        p = result.payload
        print(f"  regio={p.regio_naam} periode={p.periode} confidence={p.confidence}")
        print(f"  gemeenten={len(p.gemeenten)} regelingen={p.regelingen}")
        for g in p.gemeenten:
            print(f"    {g.gemeente_naam}: opgave={g.toevoegingen} plancap={g.plancapaciteit}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--provincie", default="PV31", help="Provincie code, e.g. PV31 (Limburg)")
    parser.add_argument("--model", default=None, help="Optional AI_MODEL override")
    args = parser.parse_args()
    asyncio.run(main(args.provincie, args.model))
