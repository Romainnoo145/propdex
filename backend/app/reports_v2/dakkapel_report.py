"""Dakkapel-rapport assembler: perceelfeiten + landelijke Bbl-toets +
gecureerde welstand + gecureerde jurisprudentie. Geen Claude, geen scoring."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.jurisprudentie.selector import select_cases
from app.models.parcel_cache import ParcelCache
from app.reports_v2.bbl_dakkapel import bbl_vergunningvrij_toets
from app.reports_v2.schemas import DakkapelReport, PerceelFeiten
from app.reports_v2.splitsing_report import _bestemming_types
from app.reports_v2.welstand_dakkapel import welstand_dakkapel

_OMGEVINGSLOKET = "https://omgevingswet.overheid.nl/aanvragen"
_DISCLAIMER = (
    "Indicatief. Gebaseerd op de landelijke vergunningvrij-criteria (Bbl), de "
    "gemeentelijke welstandsnota en openbare jurisprudentie. Geen "
    "vergunningsgarantie en geen juridisch advies; bevestig altijd via het "
    "Omgevingsloket. Toetsing per geval door de gemeente blijft leidend."
)


async def build_dakkapel_report(
    db: AsyncSession, parcel_id: str, *, today: str
) -> DakkapelReport:
    """Stel het dakkapel-rapport samen. Raises LookupError als perceel ontbreekt."""
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

    oordeel = bbl_vergunningvrij_toets()
    welstand = welstand_dakkapel(parcel.gemeente_code)
    cases = select_cases("dakkapel", ["welstand"], parcel.gemeente_code, limit=4)

    onzekerheden = [
        "De exacte maten en plaatsing van de geplande dakkapel zijn hier niet "
        "bekend; die bepalen of de Bbl-criteria worden gehaald.",
    ]
    if welstand is None:
        onzekerheden.append(
            "De welstandseisen voor deze gemeente zijn nog niet beschikbaar; "
            "controleer de gemeentelijke welstandsnota."
        )
    else:
        onzekerheden.append(
            "Welstand is deels een beoordeling van de welstandscommissie; "
            "de uitkomst kan per geval verschillen."
        )

    bronnen = ["Besluit bouwwerken leefomgeving (Bbl) — landelijke criteria"]
    if welstand is not None:
        bronnen.append("Gemeentelijke welstandsnota")
    if cases:
        bronnen.append("Openbare jurisprudentie (rechtspraak.nl)")

    return DakkapelReport(
        perceel=feiten,
        oordeel=oordeel,
        welstand=welstand,
        jurisprudentie=cases,
        onzekerheden=onzekerheden,
        bronnen=bronnen,
        geldigheidsdatum=today,
        aanvraag_url=_OMGEVINGSLOKET,
        disclaimers=[_DISCLAIMER],
    )
