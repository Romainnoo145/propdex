"""One-off: force a live re-extraction of the Venlo woonvisie at the current
SCHEMA_VERSION (M053/S07 — populates the v6 cache incl. randvoorwaarden).

Usage:
    python -m app.tools.reextract_woonvisie [--gemeente GM0983]
"""

import argparse
import asyncio

from sqlalchemy import or_, select

from app.ai.factor_extraction_schemas import DOCUMENT_SENTINEL
from app.ai.factors.woonvisie_match import WOONVISIE_MATCH_FACTOR_DEF
from app.core.config import settings
from app.core.database import async_session_factory
from app.models.policy_document import PolicyDocument
from app.services.factor_extraction_service import extract_factor


async def main(gemeente: str, model: str | None) -> None:
    if model:
        # The cascade document extraction is low-volume + high-value (a large doc,
        # rich structured output). The default AI_MODEL (haiku) returns empty on it; use
        # a stronger model for this one-off.
        settings.AI_MODEL = model
        print(f"Using model override: {model}")
    async with async_session_factory() as db:
        stmt = (
            select(PolicyDocument)
            .where(
                PolicyDocument.entity_type == "gemeente",
                PolicyDocument.entity_code == gemeente,
                PolicyDocument.source_key == "woonvisie",
                or_(PolicyDocument.is_global.is_(True), PolicyDocument.file_data.isnot(None)),
                PolicyDocument.file_data.isnot(None),
            )
            .order_by(PolicyDocument.version_number.desc(), PolicyDocument.created_at.desc())
            .limit(1)
        )
        doc = (await db.execute(stmt)).scalar_one_or_none()
        if doc is None:
            print(f"No woonvisie document found for gemeente={gemeente}")
            return

        print(f"Re-extracting woonvisie doc={doc.id} (force_refresh, live Claude call)…")
        result = await extract_factor(
            db,
            factor_def=WOONVISIE_MATCH_FACTOR_DEF,
            parcel_id=DOCUMENT_SENTINEL,
            policy_document=doc,
            force_refresh=True,
        )
        rv = result.payload.randvoorwaarden
        print(f"Done. wijk_policies={len(result.payload.wijk_policies)} randvoorwaarden={len(rv)}")
        for r in rv:
            print(f"  - [{r.categorie}] {r.titel}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--gemeente", default="GM0983")
    parser.add_argument("--model", default="anthropic/claude-sonnet-4.5")
    args = parser.parse_args()
    asyncio.run(main(args.gemeente, args.model))
