"""Parkeerdruk factor — gemeentelijke Nota parkeernormen extraction (M054/S02).

De Nota parkeernormen legt vast welke parkeernorm-systematiek de gemeente
hanteert: auto- en fietsnormen per functie/gebied, de gebiedsindeling, de
parkeerregulering, de oplos-cascade (eigen terrein → privaat elders → openbare
ruimte) en de grenzen daarvan. Voor een ontwikkelaar bepaalt dit hoe zwaar de
parkeereis is gegeven zijn functie en ligging, en hoe ingeklemd hij is in het
oplossen ervan: vandaar factor_id 'parkeerdruk' (risico).

Cloned van splitsingsrisico.py (M053/S12): zelfde structuur (Pydantic-modellen →
_INPUT_SCHEMA dict → FactorDefinition). Randvoorwaarde wordt hergebruikt uit
beleidsalignement zodat de cache-shape identiek blijft en de display-laag
dezelfde rendering kan gebruiken.
"""

from typing import Any, Literal

from pydantic import BaseModel, Field

from app.ai.factor_extraction_schemas import FactorDefinition
from app.ai.factors.beleidsalignement import Randvoorwaarde

Gebied = Literal["centrum", "schil_centrum", "rest_bebouwde_kom", "buitengebied"]
Functiecategorie = Literal[
    "wonen", "winkelen", "werken", "sport_cultuur",
    "horeca_recreatie", "zorg_voorzieningen", "onderwijs", "overig",
]


class NormBand(BaseModel):
    """Een parkeernorm-band per functie × gebied uit de Nota parkeernormen."""

    functie: str = Field(min_length=1, description="Bv. koop appartement >100 m² bvo")
    functiecategorie: Functiecategorie
    bestemming_trefwoorden: list[str] = Field(
        default_factory=list,
        description="Bestemming-/zoning-trefwoorden waarop deze band geldt; match-sleutel",
    )
    gebied: Gebied
    auto_norm_per_eenheid: float | None = Field(default=None, ge=0)
    eenheid: str = Field(default="", description="Bv. per woning, pp per 100 m² bvo")
    fiets_norm_per_eenheid: float | None = Field(default=None, ge=0)
    bezoekers_aandeel: float | None = Field(default=None, ge=0)
    citaat: str | None = Field(default=None, description="Letterlijk citaat dat de band onderbouwt")
    pagina: int | None = Field(default=None, ge=1)


class Correctie(BaseModel):
    """Een mobiliteitscorrectie die de parkeereis kan dempen (stap 3)."""

    type: str = Field(min_length=1, description="Bv. hov_station, autodeel, hub_parkeren_op_afstand")
    max_reductie_pct: float | None = Field(default=None, ge=0, le=100)
    voorwaarde: str | None = Field(
        default=None, description="Voorwaarde, bv. alleen in gereguleerd gebied"
    )
    citaat: str | None = None


class ParkeernormenPayload(BaseModel):
    """Gestructureerde extractie van een gemeentelijke Nota parkeernormen."""

    peiljaar: int | None = Field(default=None, description="Peiljaar van de nota, bv. 2026")
    parkeerregulering_van_toepassing: bool | None = Field(
        default=None,
        description="Is het gebied gereguleerd (poort naar correcties + 0-norm)",
    )
    normbanden: list[NormBand] = Field(default_factory=list)
    openbare_ruimte_drempel_pct: float | None = Field(
        default=None,
        ge=0,
        le=100,
        description="Parkeerdruk-drempel waaronder openbare ruimte mag (beleids-default 70)",
    )
    centrum_uitgesloten: bool = Field(
        default=False,
        description="True als de openbare-ruimte-escape in het centrum is uitgesloten",
    )
    mobiliteitscorrecties: list[Correctie] = Field(default_factory=list)
    nul_norm_sociale_huur_mogelijk: bool | None = Field(
        default=None,
        description="Kan sociale huur door een corporatie kosteloos van de parkeereis af",
    )
    fietsnorm_harde_eis: bool = Field(
        default=False,
        description="True als de fietsnorm een harde eis is (weigeringsgrond bij niet-oplosbaar)",
    )
    algemeen_citaat: str = Field(
        default="",
        description="Gemeente-brede citaat-fallback als geen band matcht",
    )
    randvoorwaarden: list[Randvoorwaarde] = Field(default_factory=list)
    confidence: float = Field(ge=0.0, le=1.0, description="0=onzeker, 1=zeker")


_INPUT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "peiljaar": {"type": "integer", "description": "Peiljaar van de nota (bv. 2026)"},
        "parkeerregulering_van_toepassing": {
            "type": "boolean",
            "description": (
                "Is het gebied gereguleerd (betaald parkeren / vergunninggebied)? "
                "Bepaalt of mobiliteitscorrecties en de 0-norm benutbaar zijn."
            ),
        },
        "normbanden": {
            "type": "array",
            "description": (
                "Per functie × gebied een parkeernorm-band. Neem ALLEEN banden op die "
                "letterlijk in de nota staan; lege lijst als er geen normen zijn."
            ),
            "items": {
                "type": "object",
                "properties": {
                    "functie": {
                        "type": "string",
                        "minLength": 1,
                        "description": "Bv. 'koop, appartement >100 m² bvo' of 'fullservice supermarkt'",
                    },
                    "functiecategorie": {
                        "type": "string",
                        "enum": ["wonen", "winkelen", "werken", "sport_cultuur",
                                 "horeca_recreatie", "zorg_voorzieningen", "onderwijs", "overig"],
                    },
                    "bestemming_trefwoorden": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": (
                            "Bestemming-/zoning-trefwoorden waarop deze band slaat "
                            "(bv. wonen, gemengd, centrum, bedrijf). Match-sleutel."
                        ),
                    },
                    "gebied": {
                        "type": "string",
                        "enum": ["centrum", "schil_centrum", "rest_bebouwde_kom", "buitengebied"],
                    },
                    "auto_norm_per_eenheid": {"type": "number", "minimum": 0,
                                              "description": "Autonorm per eenheid (pp)"},
                    "eenheid": {"type": "string",
                                "description": "Bv. 'per woning' of 'pp per 100 m² bvo'"},
                    "fiets_norm_per_eenheid": {"type": "number", "minimum": 0,
                                               "description": "Fietsparkeernorm per eenheid"},
                    "bezoekers_aandeel": {"type": "number", "minimum": 0,
                                          "description": "Bezoekersdeel van de norm (bv. 0.3)"},
                    "citaat": {"type": "string", "description": "Letterlijk citaat"},
                    "pagina": {"type": "integer", "minimum": 1},
                },
                "required": ["functie", "functiecategorie", "gebied"],
                "additionalProperties": False,
            },
        },
        "openbare_ruimte_drempel_pct": {
            "type": "number",
            "minimum": 0,
            "maximum": 100,
            "description": (
                "Parkeerdruk-percentage waaronder parkeren in de openbare ruimte is "
                "toegestaan (Venlo beleids-default 70; 70-85% via B&W-besluit)."
            ),
        },
        "centrum_uitgesloten": {
            "type": "boolean",
            "description": "True als de openbare-ruimte-escape in het centrum is uitgesloten",
        },
        "mobiliteitscorrecties": {
            "type": "array",
            "description": (
                "Optionele correcties die de parkeereis dempen (HOV-ligging, autodeel, "
                "hubs/parkeren op afstand). Laat weg zonder letterlijke basis."
            ),
            "items": {
                "type": "object",
                "properties": {
                    "type": {"type": "string", "minLength": 1,
                             "description": "Bv. hov_station, autodeel, hub_parkeren_op_afstand"},
                    "max_reductie_pct": {"type": "number", "minimum": 0, "maximum": 100,
                                         "description": "Maximale reductie in procenten"},
                    "voorwaarde": {"type": "string",
                                   "description": "Bv. 'alleen in gereguleerd gebied, ≥2 deelauto's'"},
                    "citaat": {"type": "string", "description": "Letterlijk citaat"},
                },
                "required": ["type"],
                "additionalProperties": False,
            },
        },
        "nul_norm_sociale_huur_mogelijk": {
            "type": "boolean",
            "description": "True als sociale huur door een corporatie kosteloos van de parkeereis kan",
        },
        "fietsnorm_harde_eis": {
            "type": "boolean",
            "description": "True als de fietsnorm een harde eis is (niet oplosbaar = weigeringsgrond)",
        },
        "algemeen_citaat": {"type": "string", "description": "Gemeente-brede fallback-citaat"},
        "randvoorwaarden": {
            "type": "array",
            "description": (
                "Voorwaarden die een ontwikkelaar raken (kwaliteitseisen parkeerplaats, "
                "laadinfra-eis, rekenwaarden eigen terrein). Laat weg zonder letterlijke basis."
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


PARKEERNORMEN_FACTOR_DEF = FactorDefinition[ParkeernormenPayload](
    factor_id="parkeerdruk",
    tool_name="extract_parkeernormen",
    description=(
        "Extraheer de parkeernorm-systematiek uit deze gemeentelijke Nota parkeernormen: "
        "het peiljaar, of het gebied gereguleerd is, per functie × gebied een norm-band met "
        "auto- en fietsnorm (+ eenheid en bezoekersdeel), de openbare-ruimte-drempel en of het "
        "centrum is uitgesloten, de mobiliteitscorrecties (HOV/autodeel/hubs), of de 0-norm voor "
        "sociale huur mogelijk is, of de fietsnorm een harde eis is, en de randvoorwaarden die een "
        "ontwikkelaar raken. Minimale velden: confidence."
    ),
    input_schema=_INPUT_SCHEMA,
    payload_model=ParkeernormenPayload,
    prompt_instructions=(
        "Lees de Nota parkeernormen volledig door en beantwoord via het tool:\n"
        "1. peiljaar: het peiljaar van de nota (bv. 2026). Null als niet vermeld.\n"
        "2. parkeerregulering_van_toepassing: true als (een deel van) het gebied gereguleerd is "
        "(betaald parkeren / vergunninggebied) — dit is de poort naar correcties en de 0-norm.\n"
        "3. normbanden: voor ELKE functie × gebied met een norm in de nota:\n"
        "   - functie: exact zoals in de nota (bv. 'koop, appartement >100 m² bvo')\n"
        "   - functiecategorie: wonen/winkelen/werken/sport_cultuur/horeca_recreatie/"
        "zorg_voorzieningen/onderwijs/overig\n"
        "   - bestemming_trefwoorden: zoning-trefwoorden waarop deze band slaat (bv. wonen, "
        "gemengd, centrum, bedrijf) — de match-sleutel naar een perceel.\n"
        "   - gebied: centrum/schil_centrum/rest_bebouwde_kom/buitengebied\n"
        "   - auto_norm_per_eenheid + eenheid: de autonorm (pp) en de eenheid (per woning / pp "
        "per 100 m² bvo)\n"
        "   - fiets_norm_per_eenheid: de fietsparkeernorm per eenheid\n"
        "   - bezoekers_aandeel: het bezoekersdeel (bv. 0.3) indien apart genoemd\n"
        "   - citaat + pagina: letterlijk citaat en paginanummer indien zichtbaar, anders null\n"
        "4. openbare_ruimte_drempel_pct: het parkeerdruk-percentage waaronder parkeren in de "
        "openbare ruimte mag (Venlo: 70). centrum_uitgesloten: true als die escape in het centrum "
        "niet bestaat.\n"
        "5. mobiliteitscorrecties: HOV-ligging, autodeel, hubs/parkeren op afstand — met type, "
        "max_reductie_pct, voorwaarde en citaat.\n"
        "6. nul_norm_sociale_huur_mogelijk: true als sociale huur via een corporatie kosteloos van "
        "de parkeereis kan. fietsnorm_harde_eis: true als de fietsnorm een harde eis is.\n"
        "7. randvoorwaarden: kwaliteitseisen parkeerplaats, laadinfra-eis, rekenwaarden eigen "
        "terrein. Gebruik dezelfde categorieën-enum als beleidsalignement. Voor ELKE: titel, "
        "samenvatting (1-3 zinnen), citaat, pagina.\n"
        "8. algemeen_citaat: gemeente-brede tekst zonder specifieke band.\n"
        "9. Confidence: 0.9+ bij heldere normtabellen; 0.5-0.7 bij vage tekst; <0.5 bij twijfel.\n\n"
        "HARDE REGELS:\n"
        "- Geen hallucinaties: laat een band, norm of randvoorwaarde weg zonder letterlijke basis.\n"
        "- Kopieer citaten letterlijk. Geen parafrases.\n"
        "- Gebruik alleen informatie uit het document."
    ),
)
