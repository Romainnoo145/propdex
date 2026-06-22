"""Cascade enrichment service — LLM factor extraction per gemeente (M047/S06).

get_woonvisie_document() = gemeente-woonvisie PolicyDocument opzoeken →
extract_factor() aanroepen (cache-aware) → WoonvisiePayload teruggeven.

Callers (area_scan.py, backfill tools) roepen get_cascade_payloads() aan
vóór compute_score_v3() om het `cascade_payloads` dict te vullen.
"""

import logging
import uuid
from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.factor_extraction_schemas import DOCUMENT_SENTINEL, FactorExtractionError
from app.ai.factors.beleidsalignement import OMGEVINGSVISIE_FACTOR_DEF
from app.ai.factors.grondwaarde_fit import GRONDPRIJS_FACTOR_DEF
from app.ai.factors.parkeerdruk import PARKEERNORMEN_FACTOR_DEF
from app.ai.factors.splitsingsrisico import HUISVESTINGSVERORDENING_FACTOR_DEF
from app.ai.factors.woonvisie_match import WOONVISIE_MATCH_FACTOR_DEF
from app.models.gemeente_provincie_map import GemeenteProvincieMap
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
            or_(
                PolicyDocument.is_global.is_(True),
                PolicyDocument.organization_id == organization_id,
            ),
            PolicyDocument.file_data.isnot(None),
        )
        .order_by(
            PolicyDocument.is_global.asc(),
            PolicyDocument.version_number.desc(),
            PolicyDocument.created_at.desc(),
        )
        .limit(1)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def get_omgevingsvisie_document(
    db: AsyncSession,
    *,
    gemeente_code: str,
    organization_id: uuid.UUID,
) -> PolicyDocument | None:
    """Zoek de meest recente actieve omgevingsvisie op voor een gemeente (M053/S01)."""
    stmt = (
        select(PolicyDocument)
        .where(
            PolicyDocument.entity_type == "gemeente",
            PolicyDocument.entity_code == gemeente_code,
            PolicyDocument.source_key == "omgevingsvisie",
            or_(
                PolicyDocument.is_global.is_(True),
                PolicyDocument.organization_id == organization_id,
            ),
            PolicyDocument.file_data.isnot(None),
        )
        .order_by(
            PolicyDocument.is_global.asc(),
            PolicyDocument.version_number.desc(),
            PolicyDocument.created_at.desc(),
        )
        .limit(1)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def get_huisvestingsverordening_document(
    db: AsyncSession,
    *,
    gemeente_code: str,
    organization_id: uuid.UUID,
) -> PolicyDocument | None:
    """Zoek de meest recente actieve huisvestingsverordening op voor een gemeente (M053/S12).

    source_key="huisvestingsverordening" matcht AUTO_INGESTIBLE_DOCUMENTS in
    app/policy_documents/auto_ingest.py, zodat toekomstige CVDR-versies
    automatisch in dezelfde cascade landen.
    """
    stmt = (
        select(PolicyDocument)
        .where(
            PolicyDocument.entity_type == "gemeente",
            PolicyDocument.entity_code == gemeente_code,
            PolicyDocument.source_key == "huisvestingsverordening",
            or_(
                PolicyDocument.is_global.is_(True),
                PolicyDocument.organization_id == organization_id,
            ),
            PolicyDocument.file_data.isnot(None),
        )
        .order_by(
            PolicyDocument.is_global.asc(),
            PolicyDocument.version_number.desc(),
            PolicyDocument.created_at.desc(),
        )
        .limit(1)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def get_grondprijs_document(
    db: AsyncSession,
    *,
    gemeente_code: str,
    organization_id: uuid.UUID,
) -> PolicyDocument | None:
    """Zoek de meest recente actieve grondprijzenbrief op voor een gemeente (M054/S01).

    source_key="grondprijsbeleid" matcht data_source_keys.py (voedt_factor=
    grondwaarde_fit), zodat toekomstige jaarversies in dezelfde cascade landen.
    """
    stmt = (
        select(PolicyDocument)
        .where(
            PolicyDocument.entity_type == "gemeente",
            PolicyDocument.entity_code == gemeente_code,
            PolicyDocument.source_key == "grondprijsbeleid",
            or_(
                PolicyDocument.is_global.is_(True),
                PolicyDocument.organization_id == organization_id,
            ),
            PolicyDocument.file_data.isnot(None),
        )
        .order_by(
            PolicyDocument.is_global.asc(),
            PolicyDocument.version_number.desc(),
            PolicyDocument.created_at.desc(),
        )
        .limit(1)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def get_woondeal_document(
    db: AsyncSession,
    *,
    gemeente_code: str,
    organization_id: uuid.UUID,
) -> PolicyDocument | None:
    """Zoek de regionale Woondeal op voor een gemeente (M054/S06, context-only).

    De Woondeal is provincie-niveau: resolve gemeente_code -> provincie_code via
    GemeenteProvincieMap, zoek dan het meest recente provincie-document met
    source_key="woondeals". Geeft None als er geen provincie-mapping of document is.
    """
    prov_stmt = select(GemeenteProvincieMap.provincie_code).where(
        GemeenteProvincieMap.gemeente_code == gemeente_code
    )
    provincie_code = (await db.execute(prov_stmt)).scalar_one_or_none()
    if not provincie_code:
        return None

    stmt = (
        select(PolicyDocument)
        .where(
            PolicyDocument.entity_type == "provincie",
            PolicyDocument.entity_code == provincie_code,
            PolicyDocument.source_key == "woondeals",
            or_(
                PolicyDocument.is_global.is_(True),
                PolicyDocument.organization_id == organization_id,
            ),
            PolicyDocument.file_data.isnot(None),
        )
        .order_by(
            PolicyDocument.is_global.asc(),
            PolicyDocument.version_number.desc(),
            PolicyDocument.created_at.desc(),
        )
        .limit(1)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def get_parkeernormen_document(
    db: AsyncSession,
    *,
    gemeente_code: str,
    organization_id: uuid.UUID,
) -> PolicyDocument | None:
    """Zoek de meest recente actieve Nota parkeernormen op voor een gemeente (M054/S02).

    source_key="parkeerbeleid" matcht de bestaande catalogus-key (data_source_keys.py
    voedt_factor=parkeerdruk), zodat toekomstige jaarversies in dezelfde cascade landen.
    De canonieke key is parkeerbeleid; er is geen aparte 'parkeernormen'-key.
    """
    stmt = (
        select(PolicyDocument)
        .where(
            PolicyDocument.entity_type == "gemeente",
            PolicyDocument.entity_code == gemeente_code,
            PolicyDocument.source_key == "parkeerbeleid",
            or_(
                PolicyDocument.is_global.is_(True),
                PolicyDocument.organization_id == organization_id,
            ),
            PolicyDocument.file_data.isnot(None),
        )
        .order_by(
            PolicyDocument.is_global.asc(),
            PolicyDocument.version_number.desc(),
            PolicyDocument.created_at.desc(),
        )
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

    # beleidsalignement (omgevingsvisie)
    try:
        ov_doc = await get_omgevingsvisie_document(
            db, gemeente_code=gemeente_code, organization_id=organization_id
        )
        if ov_doc is not None:
            ov_extracted = await extract_factor(
                db,
                factor_def=OMGEVINGSVISIE_FACTOR_DEF,
                parcel_id=DOCUMENT_SENTINEL,
                policy_document=ov_doc,
            )
            payloads["beleidsalignement"] = ov_extracted.payload
    except FactorExtractionError as exc:
        logger.warning(
            "cascade_enrich beleidsalignement failed parcel=%s gemeente=%s: %s",
            parcel_id, gemeente_code, exc,
        )

    # splitsingsrisico (huisvestingsverordening) — M053/S12
    try:
        hv_doc = await get_huisvestingsverordening_document(
            db, gemeente_code=gemeente_code, organization_id=organization_id
        )
        if hv_doc is not None:
            hv_extracted = await extract_factor(
                db,
                factor_def=HUISVESTINGSVERORDENING_FACTOR_DEF,
                parcel_id=DOCUMENT_SENTINEL,
                policy_document=hv_doc,
            )
            payloads["splitsingsrisico"] = hv_extracted.payload
    except FactorExtractionError as exc:
        logger.warning(
            "cascade_enrich splitsingsrisico failed parcel=%s gemeente=%s: %s",
            parcel_id, gemeente_code, exc,
        )

    # grondwaarde_fit (grondprijzenbrief) — M054/S01
    try:
        gp_doc = await get_grondprijs_document(
            db, gemeente_code=gemeente_code, organization_id=organization_id
        )
        if gp_doc is not None:
            gp_extracted = await extract_factor(
                db,
                factor_def=GRONDPRIJS_FACTOR_DEF,
                parcel_id=DOCUMENT_SENTINEL,
                policy_document=gp_doc,
            )
            payloads["grondwaarde_fit"] = gp_extracted.payload
    except FactorExtractionError as exc:
        logger.warning(
            "cascade_enrich grondwaarde_fit failed parcel=%s gemeente=%s: %s",
            parcel_id, gemeente_code, exc,
        )

    # parkeerdruk (Nota parkeernormen) — M054/S02
    try:
        pk_doc = await get_parkeernormen_document(
            db, gemeente_code=gemeente_code, organization_id=organization_id
        )
        if pk_doc is not None:
            pk_extracted = await extract_factor(
                db,
                factor_def=PARKEERNORMEN_FACTOR_DEF,
                parcel_id=DOCUMENT_SENTINEL,
                policy_document=pk_doc,
            )
            payloads["parkeerdruk"] = pk_extracted.payload
    except FactorExtractionError as exc:
        logger.warning(
            "cascade_enrich parkeerdruk failed parcel=%s gemeente=%s: %s",
            parcel_id, gemeente_code, exc,
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
