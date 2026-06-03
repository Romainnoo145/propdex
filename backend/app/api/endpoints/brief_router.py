"""M052/S04 — Contact brief-teaser endpoints (genereer + fake-send)."""
import uuid
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_active_user, get_current_organization_id
from app.core.database import get_db
from app.models.area_scan import AreaScan
from app.models.organization import Organization
from app.models.parcel_cache import ParcelCache
from app.models.scan_result import ScanResult
from app.models.user import User
from app.schemas.brief import GenerateBriefRequest, GenerateBriefResponse
from app.services import brief_context
from app.services.brk_read_service import read_for_parcel
from app.services.document_generator import generate_document
from app.services.parcel_project_type_service import get_project_type

router = APIRouter(prefix="/api/parcels", tags=["Brief"])


async def _load_parcel_facts(
    db: AsyncSession, parcel_id: str
) -> tuple[str | None, str | None, float | None]:
    """Adres, gemeente_naam, potentie-score voor een parcel (laatste scan).

    Spiegelt de kansen-query in ``app/api/endpoints/dashboard.py:get_kansen``
    (regels 112-157): ScanResult⋈AreaScan met ROW_NUMBER op laatste scan, dan
    join met ParcelCache. ``ScanResult.parcel_id`` is een FK naar
    ``ParcelCache.id`` (UUID) — niet de kadaster-string. De URL-``parcel_id``
    is de kadaster-string, dus filteren we ``ParcelCache.parcel_id``.

    ``potentie`` is hier de juiste score: de brief-template zegt
    "scoort {{ score }}/100 op ontwikkelpotentieel".

    Returnt (None, None, None) als er geen scan/cache voor het perceel is.
    """
    potentie = ScanResult.flags["scores"]["potentie"].as_float()
    ranked = (
        select(
            ScanResult.parcel_id.label("pc_id"),
            potentie.label("potentie"),
            AreaScan.gemeente_naam.label("gemeente_naam"),
            func.row_number()
            .over(
                partition_by=ScanResult.parcel_id,
                order_by=AreaScan.created_at.desc(),
            )
            .label("rn"),
        )
        .join(AreaScan, AreaScan.id == ScanResult.scan_id)
        .subquery()
    )
    row = (
        await db.execute(
            select(
                ParcelCache.address,
                ranked.c.gemeente_naam,
                ranked.c.potentie,
            )
            .join(ranked, ranked.c.pc_id == ParcelCache.id)
            .where(
                ParcelCache.parcel_id == parcel_id,
                ranked.c.rn == 1,
            )
        )
    ).first()
    if row is None:
        return None, None, None
    return row.address, row.gemeente_naam, row.potentie


@router.post("/{parcel_id}/brief", response_model=GenerateBriefResponse)
async def generate_brief(
    parcel_id: str,
    payload: GenerateBriefRequest,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> GenerateBriefResponse:
    org = (
        await db.execute(
            select(Organization).where(Organization.id == organization_id)
        )
    ).scalar_one()

    # 1. Eigenaar-modus: rechtspersoon/overheid uit BRK → auto; anders manual.
    brk = await read_for_parcel(
        db=db, organization_id=organization_id, parcel_id=parcel_id
    )
    mode = "auto" if brk else "manual"

    # 2. project_type → use_case (fallback laat de template de else-tak nemen).
    pt = await get_project_type(
        db, parcel_id=parcel_id, organization_id=organization_id
    )
    use_case = brief_context.project_type_to_use_case(pt.project_type)

    # 3. Perceel-facts.
    address, gemeente_naam, overall = await _load_parcel_facts(db, parcel_id)
    parcel_data = brief_context.build_brief_parcel_data(
        address=address,
        gemeente_naam=gemeente_naam,
        overall_score=overall,
    )

    # 4. user_context: afzender + eigenaar (auto: uit BRK; manual: uit payload.addressee).
    user_context: dict[str, Any] = {
        "use_case": use_case,
        "bedrijfsnaam": org.name,
        "bedrijfsadres": org.afzender_adres or "[Uw bedrijfsadres]",
        "contactpersoon": org.contactpersoon or "[Uw naam]",
        "contact_email": org.contact_email or "[uw@email.nl]",
        "contact_telefoon": org.contact_telefoon or "[uw telefoonnummer]",
    }
    if mode == "auto":
        rec = brk[0]
        user_context["eigenaar_aanhef"] = f"Geachte {rec.eigenaar_naam}"
        user_context["eigenaar_adres"] = rec.statutaire_zetel or ""
    elif payload.addressee:
        if payload.addressee.eigenaar_aanhef:
            user_context["eigenaar_aanhef"] = payload.addressee.eigenaar_aanhef
        if payload.addressee.eigenaar_adres:
            user_context["eigenaar_adres"] = payload.addressee.eigenaar_adres

    markdown = generate_document("eigenaar_brief", parcel_data, user_context) or ""
    return GenerateBriefResponse(markdown=markdown, mode=mode)
