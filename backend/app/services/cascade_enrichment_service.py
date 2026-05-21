"""Cascade enrichment service — LLM factor extraction per gemeente (M047/S06).

get_woonvisie_document() = gemeente-woonvisie PolicyDocument opzoeken →
extract_factor() aanroepen (cache-aware) → WoonvisiePayload teruggeven.

Callers (area_scan.py, backfill tools) roepen get_cascade_payloads() aan
vóór compute_score_v3() om het `cascade_payloads` dict te vullen.
"""

import logging
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.factor_extraction_schemas import DOCUMENT_SENTINEL, FactorExtractionError
from app.ai.factors.woonvisie_match import WOONVISIE_MATCH_FACTOR_DEF
from app.models.policy_document import PolicyDocument
from app.services.factor_extraction_service import extract_factor

logger = logging.getLogger(__name__)


async def get_woonvisie_document(
    db: AsyncSession,
    *,
    gemeente_code: str,
    organization_id: uuid.UUID,
) -> PolicyDocument | None:
    """Zoek de meest recente actieve woonvisie op voor een gemeente.

    Multi-tenant: filtert op organization_id. Sorteert op version_number DESC
    zodat bij meerdere uploads altijd de nieuwste gebruikt wordt.
    """
    stmt = (
        select(PolicyDocument)
        .where(
            PolicyDocument.entity_type == "gemeente",
            PolicyDocument.entity_code == gemeente_code,
            PolicyDocument.source_key == "woonvisie",
            PolicyDocument.organization_id == organization_id,
            PolicyDocument.file_data.isnot(None),
        )
        .order_by(PolicyDocument.version_number.desc(), PolicyDocument.created_at.desc())
        .limit(1)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def get_cascade_payloads(
    db: AsyncSession,
    *,
    parcel_id: str,
    gemeente_code: str | None,
    organization_id: uuid.UUID,
) -> dict[str, Any]:
    """Fetch all cascade-extracted payloads for a parcel + gemeente combo.

    Returns dict keyed by factor_id (bv. "woonvisie_match") with the
    Pydantic payload object as value. Absent = factor not available.

    Error-tolerant: FactorExtractionError is caught and logged; factor
    will be missing=True in compute_score_v3 (sparse factor, not meegewogen).
    """
    payloads: dict[str, Any] = {}

    if not gemeente_code:
        return payloads

    # woonvisie_match
    try:
        doc = await get_woonvisie_document(
            db, gemeente_code=gemeente_code, organization_id=organization_id
        )
        if doc is not None:
            extracted = await extract_factor(
                db,
                factor_def=WOONVISIE_MATCH_FACTOR_DEF,
                parcel_id=DOCUMENT_SENTINEL,  # document-level: cache shared across all parcels in gemeente
                policy_document=doc,
            )
            payloads["woonvisie_match"] = extracted.payload
    except FactorExtractionError as exc:
        logger.warning(
            "cascade_enrich woonvisie_match failed parcel=%s gemeente=%s: %s",
            parcel_id,
            gemeente_code,
            exc,
        )

    return payloads


async def get_affected_parcel_ids(
    db: AsyncSession,
    *,
    document_id: uuid.UUID,
    organization_id: uuid.UUID,
) -> list[str]:
    """Return Kadaster parcel_id strings for all parcels in the document's gemeente.

    Multi-tenant: document must belong to organization_id.
    Only gemeente-level documents are supported (entity_type == "gemeente").
    PolicyDocument.entity_code en ParcelCache.gemeente_code delen het "GM0983"-
    formaat, dus een directe match volstaat (geen normalisatie nodig).

    Returns empty list if document not found, wrong org, or no parcels cached.
    """
    from app.models.parcel_cache import ParcelCache

    stmt = select(PolicyDocument).where(
        PolicyDocument.id == document_id,
        PolicyDocument.organization_id == organization_id,
    )
    result = await db.execute(stmt)
    doc = result.scalar_one_or_none()

    if doc is None or doc.entity_type != "gemeente":
        return []

    gemeente_code = doc.entity_code  # "GM0983"-formaat, matcht parcel_cache.gemeente_code

    parcel_stmt = select(ParcelCache.parcel_id).where(
        ParcelCache.gemeente_code == gemeente_code,
    )
    parcel_result = await db.execute(parcel_stmt)
    return list(parcel_result.scalars().all())
