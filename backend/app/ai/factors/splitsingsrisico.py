"""Splitsingsrisico factor — gemeentelijke huisvestingsverordening extraction (M053/S12).

De huisvestingsverordening regelt de woonruimtevoorraad (onttrekking, splitsing,
omzetting, woningvorming) en — sinds de Wet opkoopbescherming — eventueel een
opkoopbescherming per buurt (zelfbewoningsplicht onder een WOZ-grens). Voor een
ontwikkelaar is dit het juridische klimaat dat splitsen/transformeren van bezit
beperkt: vandaar factor_id 'splitsingsrisico'.

Cloned van beleidsalignement.py (M053/S01): zelfde structuur (Pydantic-modellen →
_INPUT_SCHEMA dict → FactorDefinition). Randvoorwaarde wordt hergebruikt zodat de
cache-shape identiek blijft en de display-laag dezelfde rendering kan gebruiken.
"""

from typing import Any, Literal

from pydantic import BaseModel, Field

from app.ai.factor_extraction_schemas import FactorDefinition
from app.ai.factors.beleidsalignement import Randvoorwaarde

VoorraadVergunningplicht = Literal["onttrekking", "splitsing", "omzetting", "woningvorming"]


class OpkoopBuurt(BaseModel):
    """Een buurt waarop de opkoopbescherming van toepassing is."""

    buurt_naam: str = Field(min_length=1, description="Buurtnaam exact zoals in document")
    cbs_buurt_code: str | None = Field(
        default=None, description="CBS-code BU + 8 cijfers indien in document genoemd"
    )


class Opkoopbescherming(BaseModel):
    """Opkoopbescherming-regime (Wet opkoopbescherming) uit de huisvestingsverordening."""

    van_kracht: bool
    duur_jaren: int | None = None
    woz_grens_eur: int | None = Field(default=None, description="WOZ-bovengrens in euro's")
    woz_peiljaar: int | None = None
    buurten: list[OpkoopBuurt] = Field(default_factory=list)
    citaat: str | None = None
    pagina: int | None = Field(default=None, ge=1)


class HuisvestingsverordeningPayload(BaseModel):
    """Gestructureerde extractie van een gemeentelijke huisvestingsverordening."""

    geldig_van: str | None = Field(default=None, description="ISO-datum, bv. 2026-07-01")
    geldig_tot: str | None = None
    voorraad_vergunningplichten: list[VoorraadVergunningplicht] = Field(default_factory=list)
    voorraad_citaat: str | None = None
    huisvestingsvergunning_scope: str = Field(
        default="", description="Bv. corporatie_sociale_huur — display-context"
    )
    opkoopbescherming: Opkoopbescherming | None = None
    randvoorwaarden: list[Randvoorwaarde] = Field(default_factory=list)
    confidence: float = Field(ge=0.0, le=1.0, description="0=onzeker, 1=zeker")


_INPUT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "geldig_van": {"type": "string", "description": "ISO-datum, bv. 2026-07-01"},
        "geldig_tot": {"type": "string", "description": "ISO-datum, bv. 2030-06-30"},
        "voorraad_vergunningplichten": {
            "type": "array",
            "description": (
                "Welke vergunningplichten kent de woonruimtevoorraad-regeling? ALLEEN "
                "opnemen als de verordening een vergunningstelsel bevat (hoofdstuk "
                "'woonruimtevoorraad'). Lege lijst als er geen voorraadbeheer-stelsel is."
            ),
            "items": {
                "type": "string",
                "enum": ["onttrekking", "splitsing", "omzetting", "woningvorming"],
            },
        },
        "voorraad_citaat": {
            "type": "string",
            "description": "Letterlijk citaat dat het voorraad-vergunningstelsel onderbouwt",
        },
        "huisvestingsvergunning_scope": {
            "type": "string",
            "description": "Reikwijdte huisvestingsvergunning, bv. corporatie_sociale_huur (display-context)",
        },
        "opkoopbescherming": {
            "type": "object",
            "description": (
                "Opkoopbescherming-regime (Wet opkoopbescherming): zelfbewoningsplicht onder "
                "een WOZ-grens in aangewezen buurten. Laat weg als de verordening hier niets "
                "over regelt; zet anders van_kracht en vul de details in."
            ),
            "properties": {
                "van_kracht": {"type": "boolean"},
                "duur_jaren": {"type": "integer", "minimum": 0},
                "woz_grens_eur": {"type": "integer", "description": "WOZ-bovengrens in euro's"},
                "woz_peiljaar": {"type": "integer"},
                "buurten": {
                    "type": "array",
                    "description": "Alle buurten waarop de opkoopbescherming geldt",
                    "items": {
                        "type": "object",
                        "properties": {
                            "buurt_naam": {
                                "type": "string",
                                "minLength": 1,
                                "description": "Buurtnaam exact zoals in document",
                            },
                            "cbs_buurt_code": {
                                "type": "string",
                                "description": "CBS-code BU + 8 cijfers indien genoemd (bv. BU09831401)",
                            },
                        },
                        "required": ["buurt_naam"],
                        "additionalProperties": False,
                    },
                },
                "citaat": {"type": "string", "description": "Letterlijk citaat"},
                "pagina": {"type": "integer", "minimum": 1},
            },
            "required": ["van_kracht"],
            "additionalProperties": False,
        },
        "randvoorwaarden": {
            "type": "array",
            "description": (
                "Uitzonderingen en voorwaarden die een ontwikkelaar raken (bv. nieuwbouw de "
                "eerste maanden vrijgesteld, moet-verlening bij verhuur aan een woningcorporatie). "
                "Laat weg zonder letterlijke basis in het document."
            ),
            "items": {
                "type": "object",
                "properties": {
                    "categorie": {
                        "type": "string",
                        "enum": ["programmering", "financieel", "doelgroep", "duurzaamheid",
                                 "proces", "ruimtelijk", "markt", "overig"],
                    },
                    "titel": {"type": "string", "minLength": 1},
                    "samenvatting": {"type": "string", "minLength": 1,
                                     "description": "1-3 zinnen, wat betekent dit voor een ontwikkelaar"},
                    "citaat": {"type": "string", "description": "Letterlijk citaat"},
                    "pagina": {"type": "integer", "minimum": 1},
                },
                "required": ["categorie", "titel", "samenvatting"],
                "additionalProperties": False,
            },
        },
        "confidence": {"type": "number", "minimum": 0.0, "maximum": 1.0},
    },
    "required": ["confidence"],
}


HUISVESTINGSVERORDENING_FACTOR_DEF = FactorDefinition[HuisvestingsverordeningPayload](
    factor_id="splitsingsrisico",
    tool_name="extract_huisvestingsverordening",
    description=(
        "Extraheer het juridische woonruimte-regime uit deze gemeentelijke "
        "huisvestingsverordening: geldigheidsperiode, eventuele vergunningplichten op de "
        "woonruimtevoorraad (onttrekking/splitsing/omzetting/woningvorming), de "
        "opkoopbescherming (zelfbewoningsplicht onder een WOZ-grens met alle aangewezen "
        "buurten en CBS-codes), en randvoorwaarden/uitzonderingen die een ontwikkelaar raken. "
        "Minimale velden: confidence."
    ),
    input_schema=_INPUT_SCHEMA,
    payload_model=HuisvestingsverordeningPayload,
    prompt_instructions=(
        "Lees de huisvestingsverordening volledig door en beantwoord via het tool:\n"
        "1. Geldigheid: bepaal geldig_van en geldig_tot uit de intitulé of slotbepalingen "
        "(inwerkingtredings- en vervaldatum). Null als niet vermeld.\n"
        "2. voorraad_vergunningplichten: neem ALLEEN waarden op als de verordening een "
        "vergunningstelsel voor de woonruimtevoorraad bevat (meestal hoofdstuk "
        "'woonruimtevoorraad'): onttrekking, splitsing, omzetting, woningvorming. Bevat de "
        "verordening geen voorraadbeheer-stelsel → lege lijst. Vul voorraad_citaat met het "
        "letterlijke citaat dat het stelsel onderbouwt.\n"
        "3. opkoopbescherming: vul dit object alleen als de verordening opkoopbescherming "
        "regelt. Geef:\n"
        "   - van_kracht: true als opkoopbescherming geldt\n"
        "   - duur_jaren: de zelfbewoningsperiode in jaren\n"
        "   - woz_grens_eur + woz_peiljaar: de WOZ-bovengrens en het peiljaar\n"
        "   - buurten: ALLE genoemde buurten met hun CBS-code. De CBS-code staat doorgaans "
        "tussen haakjes achter de naam, bv. 'Craneveld (BU09831401)'. Geen code genoemd → "
        "cbs_buurt_code null.\n"
        "   - citaat: letterlijk citaat van de kernbepaling\n"
        "   - pagina: paginanummer indien zichtbaar, anders null\n"
        "4. randvoorwaarden: verzamel uitzonderingen en voorwaarden die een ontwikkelaar raken "
        "(bv. 'nieuwbouw is de eerste 3 maanden vrijgesteld', 'moet-verlening bij verhuur aan een "
        "woningcorporatie'). Gebruik dezelfde categorieën-enum als beleidsalignement: "
        "programmering, financieel, doelgroep, duurzaamheid, proces, ruimtelijk, markt, overig. "
        "Voor ELKE randvoorwaarde: titel, samenvatting (1-3 zinnen), letterlijk citaat (anders null) "
        "en pagina (anders null).\n"
        "5. huisvestingsvergunning_scope: korte aanduiding van de reikwijdte van de "
        "huisvestingsvergunning (bv. corporatie_sociale_huur). Leeg laten als niet van toepassing.\n"
        "6. Confidence: 0.9+ bij heldere bepalingen; 0.5-0.7 bij vage tekst; <0.5 bij twijfel.\n\n"
        "HARDE REGELS:\n"
        "- Geen hallucinaties: laat een veld, buurt of randvoorwaarde weg als je geen letterlijke "
        "basis kunt vinden.\n"
        "- Kopieer citaten letterlijk. Geen parafrases.\n"
        "- Gebruik alleen informatie uit het document."
    ),
)
