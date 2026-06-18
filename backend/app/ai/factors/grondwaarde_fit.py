"""Grondwaarde-fit factor — gemeentelijke grondprijzenbrief extraction (M054/S01).

De grondprijzenbrief (en/of nota grondbeleid) legt vast welke methodiek de
gemeente hanteert voor gronduitgifte en welke prijzen / prijsbanden per
functiecategorie horen. Voor een ontwikkelaar bepaalt dit of een residuele
grondwaarde reëel is gegeven het gemeentelijke prijsniveau, en of zijn
bestemming + perceelgrootte passen bij een residueel-aantrekkelijke band:
vandaar factor_id 'grondwaarde_fit' (potentie).

Cloned van splitsingsrisico.py (M053/S12): zelfde structuur (Pydantic-modellen →
_INPUT_SCHEMA dict → FactorDefinition). Randvoorwaarde wordt hergebruikt uit
beleidsalignement zodat de cache-shape identiek blijft en de display-laag
dezelfde rendering kan gebruiken.
"""

from typing import Any, Literal

from pydantic import BaseModel, Field

from app.ai.factor_extraction_schemas import FactorDefinition
from app.ai.factors.beleidsalignement import Randvoorwaarde

Prijsgrondslag = Literal["residueel", "comparatief", "vaste_prijs"]
Functiecategorie = Literal[
    "sociaal", "midden", "vrij", "commercieel", "maatschappelijk",
    "bedrijventerrein", "overig",
]
Grondbeleidstype = Literal["actief", "faciliterend", "passief"]


class PrijsBand(BaseModel):
    """Een prijsband per grondproduct / functiecategorie uit de grondprijzenbrief."""

    grondproduct: str = Field(min_length=1, description="Bv. bouwkavel wonen vrije sector")
    functiecategorie: Functiecategorie
    bestemming_trefwoorden: list[str] = Field(
        default_factory=list,
        description="Bestemming-/zoning-trefwoorden waarop deze band geldt; match-sleutel",
    )
    prijs_per_m2_min: float | None = Field(default=None, ge=0)
    prijs_per_m2_max: float | None = Field(default=None, ge=0)
    prijsgrondslag: Prijsgrondslag
    erfpacht_mogelijk: bool = False
    sociale_huur_afwijking: str | None = Field(
        default=None, description="Bijzondere (lagere) grondprijs voor sociale huur"
    )
    citaat: str | None = Field(default=None, description="Letterlijk citaat dat de band onderbouwt")
    pagina: int | None = Field(default=None, ge=1)


class GrondprijzenPayload(BaseModel):
    """Gestructureerde extractie van een gemeentelijke grondprijzenbrief."""

    peiljaar: int | None = Field(default=None, description="Prijsjaar, bv. 2026")
    grondbeleidstype: Grondbeleidstype | None = Field(
        default=None,
        description="Actief (gemeente is grondeigenaar) / faciliterend / passief",
    )
    prijsbanden: list[PrijsBand] = Field(default_factory=list)
    algemeen_citaat: str = Field(
        default="",
        description="Gemeente-brede citaat-fallback als geen band matcht",
    )
    randvoorwaarden: list[Randvoorwaarde] = Field(default_factory=list)
    confidence: float = Field(ge=0.0, le=1.0, description="0=onzeker, 1=zeker")


_INPUT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "peiljaar": {"type": "integer", "description": "Prijsjaar van de brief (bv. 2026)"},
        "grondbeleidstype": {
            "type": "string",
            "enum": ["actief", "faciliterend", "passief"],
            "description": (
                "actief = gemeente geeft zelf grond uit (band is normstellend); "
                "faciliterend/passief = gemeente geeft geen grond uit (band is context)."
            ),
        },
        "prijsbanden": {
            "type": "array",
            "description": (
                "Per grondproduct/functiecategorie een prijsband. Neem ALLEEN banden op "
                "die letterlijk in het document staan; lege lijst als er geen prijzen zijn."
            ),
            "items": {
                "type": "object",
                "properties": {
                    "grondproduct": {
                        "type": "string",
                        "minLength": 1,
                        "description": "Bv. bouwkavel wonen vrije sector, bedrijventerrein, maatschappelijk",
                    },
                    "functiecategorie": {
                        "type": "string",
                        "enum": ["sociaal", "midden", "vrij", "commercieel",
                                 "maatschappelijk", "bedrijventerrein", "overig"],
                    },
                    "bestemming_trefwoorden": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": (
                            "Bestemming-/zoning-trefwoorden waarop deze band slaat "
                            "(bv. wonen, gemengd, bedrijf, maatschappelijk). Match-sleutel."
                        ),
                    },
                    "prijs_per_m2_min": {"type": "number", "minimum": 0,
                                         "description": "Ondergrens €/m² (of vaste prijs)"},
                    "prijs_per_m2_max": {"type": "number", "minimum": 0,
                                         "description": "Bovengrens €/m² indien een band"},
                    "prijsgrondslag": {
                        "type": "string",
                        "enum": ["residueel", "comparatief", "vaste_prijs"],
                    },
                    "erfpacht_mogelijk": {"type": "boolean"},
                    "sociale_huur_afwijking": {
                        "type": "string",
                        "description": "Bijzondere (lagere) grondprijsstelling voor sociale huur",
                    },
                    "citaat": {"type": "string", "description": "Letterlijk citaat"},
                    "pagina": {"type": "integer", "minimum": 1},
                },
                "required": ["grondproduct", "functiecategorie", "prijsgrondslag"],
                "additionalProperties": False,
            },
        },
        "algemeen_citaat": {"type": "string", "description": "Gemeente-brede fallback-citaat"},
        "randvoorwaarden": {
            "type": "array",
            "description": (
                "Voorwaarden die een ontwikkelaar raken (bv. erfpacht verplicht, "
                "kostenverhaal, sociale-huur korting, snippergroen-regeling). Laat weg "
                "zonder letterlijke basis in het document."
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


GRONDPRIJS_FACTOR_DEF = FactorDefinition[GrondprijzenPayload](
    factor_id="grondwaarde_fit",
    tool_name="extract_grondwaarde_fit",
    description=(
        "Extraheer het gemeentelijke grondprijsbeleid uit deze grondprijzenbrief / nota "
        "grondbeleid: het peiljaar, het grondbeleidstype (actief/faciliterend/passief), en "
        "per grondproduct/functiecategorie een prijsband met €/m², prijsgrondslag "
        "(residueel/comparatief/vaste_prijs), erfpacht-mogelijkheid, eventuele sociale-huur-"
        "afwijking en een letterlijk citaat. Verzamel ook de randvoorwaarden die een "
        "ontwikkelaar raken. Minimale velden: confidence."
    ),
    input_schema=_INPUT_SCHEMA,
    payload_model=GrondprijzenPayload,
    prompt_instructions=(
        "Lees de grondprijzenbrief / nota grondbeleid volledig door en beantwoord via het tool:\n"
        "1. peiljaar: het prijsjaar van de brief (bv. 2026). Null als niet vermeld.\n"
        "2. grondbeleidstype: actief (gemeente geeft zelf grond uit), faciliterend "
        "(gemeente werkt mee maar geeft geen grond uit) of passief. Null bij twijfel.\n"
        "3. prijsbanden: voor ELK grondproduct/functiecategorie met een prijs in het document:\n"
        "   - grondproduct: exact zoals in document (bv. 'bouwkavel wonen vrije sector')\n"
        "   - functiecategorie: sociaal/midden/vrij/commercieel/maatschappelijk/"
        "bedrijventerrein/overig\n"
        "   - bestemming_trefwoorden: zoning-trefwoorden waarop deze band slaat "
        "(bv. wonen, gemengd, bedrijf, maatschappelijk) — de match-sleutel naar een perceel.\n"
        "   - prijs_per_m2_min en prijs_per_m2_max: de €/m² (vul alleen min bij een vaste prijs)\n"
        "   - prijsgrondslag: residueel (volgt het programma), comparatief (marktvergelijking) "
        "of vaste_prijs\n"
        "   - erfpacht_mogelijk: true als erfpacht als alternatief wordt aangeboden\n"
        "   - sociale_huur_afwijking: korte tekst als sociale huur een afwijkende prijs krijgt\n"
        "   - citaat: letterlijk citaat; pagina: paginanummer indien zichtbaar, anders null\n"
        "4. randvoorwaarden: voorwaarden die een ontwikkelaar raken (erfpacht verplicht, "
        "kostenverhaal, sociale-huur korting, snippergroen). Gebruik dezelfde categorieën-enum "
        "als beleidsalignement. Voor ELKE: titel, samenvatting (1-3 zinnen), citaat, pagina.\n"
        "5. algemeen_citaat: gemeente-brede tekst zonder specifieke band.\n"
        "6. Confidence: 0.9+ bij heldere prijstabellen; 0.5-0.7 bij vage tekst; <0.5 bij twijfel.\n\n"
        "HARDE REGELS:\n"
        "- Geen hallucinaties: laat een band, prijs of randvoorwaarde weg zonder letterlijke basis.\n"
        "- Kopieer citaten letterlijk. Geen parafrases.\n"
        "- Gebruik alleen informatie uit het document."
    ),
)
