"""Beleid-leeslaag: leest gecachte huisvestingsverordening-payload zonder scoring.

Legt de brug tussen de cascade-extractie (FactorExtractionCache) en de
rapport-generatie (reports_v2). Voert GEEN Claude-aanroepen uit — alleen
cache-reads. Als er geen cache-hit is, retourneert read_huisvestingsverordening
None; de aanroepende laag beslist dan of ze moet fallback-en.
"""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.factor_extraction_schemas import DOCUMENT_SENTINEL, SCHEMA_VERSION
from app.ai.factors.splitsingsrisico import HuisvestingsverordeningPayload
from app.models.factor_extraction_cache import FactorExtractionCache
from app.services.cascade_enrichment_service import (
    get_huisvestingsverordening_document,
)

_FACTOR_ID = "splitsingsrisico"


def derive_themas(payload: HuisvestingsverordeningPayload) -> list[str]:
    """Leidt thema's af voor de jurisprudentie-selector uit de payload.

    Retourneert de vergunningplicht-soorten (bv. "splitsing", "omzetting")
    aangevuld met "schaarste" / "leefbaarheid" als die termen in de vrije
    tekstvelden voorkomen. Volgorde wordt bewaard; duplicaten verwijderd.
    """
    themas: list[str] = []
    for vp in payload.voorraad_vergunningplichten:
        themas.append(vp)  # "splitsing" | "omzetting" | "onttrekking" | "woningvorming"

    text = " ".join(
        [payload.voorraad_citaat or ""]
        + [rv.samenvatting for rv in payload.randvoorwaarden]
        + [rv.citaat or "" for rv in payload.randvoorwaarden]
    ).lower()
    if "schaars" in text:
        themas.append("schaarste")
    if "leefbaar" in text:
        themas.append("leefbaarheid")

    # de-dup, keep insertion order
    seen: set[str] = set()
    out: list[str] = []
    for t in themas:
        if t not in seen:
            seen.add(t)
            out.append(t)
    return out


async def read_huisvestingsverordening(
    db: AsyncSession,
    gemeente_code: str,
    organization_id: uuid.UUID,
) -> HuisvestingsverordeningPayload | None:
    """Lees gecachte huisvestingsverordening-payload voor een gemeente.

    Zoekt eerst het PolicyDocument op via cascade_enrichment_service, dan de
    bijbehorende FactorExtractionCache-rij (parcel_id=DOCUMENT_SENTINEL,
    factor_id="splitsingsrisico", schema_version=SCHEMA_VERSION). Retourneert
    None als het document niet bestaat of nog niet is geëxtraheerd.
    """
    doc = await get_huisvestingsverordening_document(
        db, gemeente_code=gemeente_code, organization_id=organization_id
    )
    if doc is None:
        return None

    row = (
        await db.execute(
            select(FactorExtractionCache).where(
                FactorExtractionCache.parcel_id == DOCUMENT_SENTINEL,
                FactorExtractionCache.policy_document_id == doc.id,
                FactorExtractionCache.factor_id == _FACTOR_ID,
                FactorExtractionCache.schema_version == SCHEMA_VERSION,
            )
        )
    ).scalar_one_or_none()
    if row is None:
        return None

    return HuisvestingsverordeningPayload.model_validate(row.extracted_payload)
