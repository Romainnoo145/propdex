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
