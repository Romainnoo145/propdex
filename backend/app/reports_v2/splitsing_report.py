"""Splitsing-rapport assembler: combineert perceelfeiten, beleid en jurisprudentie.

Stelt een SplitsingReport samen uit:
- ParcelCache (perceelfeiten)
- gecachte HuisvestingsverordeningPayload (beleid)
- gecureerde jurisprudentie (select_cases)

Voert GEEN Claude-aanroepen uit — alleen cache-reads + in-memory selectie.
"""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.jurisprudentie.selector import select_cases
from app.models.parcel_cache import ParcelCache
from app.reports_v2.beleid_reader import derive_themas, read_huisvestingsverordening
from app.reports_v2.schemas import BeleidBlok, PerceelFeiten, SplitsingReport

_OMGEVINGSLOKET = "https://omgevingswet.overheid.nl/aanvraag"
_DISCLAIMER = (
    "Indicatief. Gebaseerd op de gepubliceerde huisvestingsverordening en "
    "openbare jurisprudentie, geen juridisch advies. Toetsing per geval door "
    "de gemeente blijft leidend."
)


def _bestemming_types(bestemmingen: list[dict] | None) -> list[str]:  # type: ignore[type-arg]
    if not bestemmingen:
        return []
    out: list[str] = []
    for b in bestemmingen:
        t = b.get("type") if isinstance(b, dict) else None
        if t:
            out.append(str(t))
    return out


async def build_splitsing_report(
    db: AsyncSession,
    parcel_id: str,
    organization_id: uuid.UUID,
) -> SplitsingReport:
    """Stel het splitsings-rapport samen voor een perceel.

    Raises:
        LookupError: als het perceel niet bestaat in parcel_cache.
    """
    parcel = (
        await db.execute(select(ParcelCache).where(ParcelCache.parcel_id == parcel_id))
    ).scalar_one_or_none()
    if parcel is None:
        raise LookupError(f"parcel {parcel_id!r} not found")

    feiten = PerceelFeiten(
        parcel_id=parcel.parcel_id,
        adres=parcel.address,
        gemeente_code=parcel.gemeente_code,
        buurt_code=parcel.buurt_code,
        oppervlakte_m2=parcel.area_m2,
        bouwjaar=parcel.bouwjaar,
        bestemmingen=_bestemming_types(parcel.bestemmingen),
    )

    beleid: BeleidBlok | None = None
    themas: list[str] = []
    if parcel.gemeente_code:
        payload = await read_huisvestingsverordening(
            db, gemeente_code=parcel.gemeente_code, organization_id=organization_id
        )
        if payload is not None:
            themas = derive_themas(payload)
            beleid = BeleidBlok(
                vergunningplichten=list(payload.voorraad_vergunningplichten),
                samenvatting=(
                    payload.voorraad_citaat
                    or "Zie de gemeentelijke huisvestingsverordening voor de exacte voorwaarden."
                ),
                randvoorwaarden=[rv.titel for rv in payload.randvoorwaarden],
                bron_geldig_van=payload.geldig_van,
                bron_geldig_tot=payload.geldig_tot,
                confidence=payload.confidence,
            )

    cases = select_cases("splitsing", themas, parcel.gemeente_code, limit=4)

    aandachtspunten: list[str] = []
    if beleid and "splitsing" in beleid.vergunningplichten:
        aandachtspunten.append(
            "Splitsing is in deze gemeente vergunningplichtig. Vraag de "
            "vergunning aan vóór je aankoop- of verbouwbeslissing."
        )
    if beleid and "omzetting" in beleid.vergunningplichten:
        aandachtspunten.append(
            "Omzetting naar kamerverhuur is vergunningplichtig; let op het "
            "leefbaarheidscriterium per wijk."
        )
    if not beleid:
        aandachtspunten.append(
            "Geen actuele huisvestingsverordening gevonden voor deze gemeente; "
            "verifieer de vergunningplicht handmatig."
        )

    return SplitsingReport(
        perceel=feiten,
        beleid=beleid,
        jurisprudentie=cases,
        aandachtspunten=aandachtspunten,
        aanvraag_url=_OMGEVINGSLOKET,
        disclaimers=[_DISCLAIMER],
    )
