"""Pydantic response-schemas voor de splitsings-rapportage (M055/S01)."""

from pydantic import BaseModel

from app.jurisprudentie.models import JurisprudentieCase


class PerceelFeiten(BaseModel):
    parcel_id: str
    adres: str | None
    gemeente_code: str | None
    buurt_code: str | None
    oppervlakte_m2: float | None
    bouwjaar: int | None
    bestemmingen: list[str]


class BeleidBlok(BaseModel):
    vergunningplichten: list[str]
    samenvatting: str  # mensentaal
    randvoorwaarden: list[str]
    bron_geldig_van: str | None
    bron_geldig_tot: str | None
    confidence: float


class SplitsingReport(BaseModel):
    perceel: PerceelFeiten
    beleid: BeleidBlok | None
    jurisprudentie: list[JurisprudentieCase]
    aandachtspunten: list[str]
    aanvraag_url: str
    disclaimers: list[str]


class VergunningOordeel(BaseModel):
    achterdakvlak: str  # conditioneel: "meestal vergunningvrij mits ..."
    voor_zijdakvlak: str  # "vergunningplichtig + welstandstoets"
    bepalende_factoren: list[str]  # Bbl-criteria als checklist


class WelstandBlok(BaseModel):
    samenvatting: str  # gecureerd, mensentaal
    beschermd_gezicht: bool
    bron_geldig_van: str | None
    bron_geldig_tot: str | None
    confidence: float


class DakkapelReport(BaseModel):
    perceel: PerceelFeiten
    oordeel: VergunningOordeel
    welstand: WelstandBlok | None
    jurisprudentie: list[JurisprudentieCase]
    onzekerheden: list[str]
    bronnen: list[str]
    geldigheidsdatum: str  # ISO yyyy-mm-dd
    aanvraag_url: str
    disclaimers: list[str]
