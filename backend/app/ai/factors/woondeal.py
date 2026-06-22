"""Woondeal context cascade — regionale Woondeal-extractie (M054/S06).

De Woondeal is een regionale afspraak (Rijk + provincie + gemeenten) over de
woningbouwopgave tot 2030. Het document is provincie-niveau en noemt per
gemeente een opgave + plancapaciteit, een regio-breed betaalbaar-aandeel,
sleutelprojecten en regelingen.

CONTEXT-ONLY: deze cascade levert GEEN score (geen FACTOR_REGISTRY-entry, geen
gewicht). Elke NL-gemeente zit in een woondeal en het document geeft geen
perceel-granulariteit, dus een gewicht zou de hele kaart uniform kleuren zonder
differentiatie (zie .planning specs 2026-06-22). De waarde is informatie.

Cloned van grondwaarde_fit.py (M054/S01): Pydantic-modellen -> _INPUT_SCHEMA dict
-> FactorDefinition. Randvoorwaarde wordt hergebruikt uit beleidsalignement.
"""

from typing import Any

from pydantic import BaseModel, Field

from app.ai.factor_extraction_schemas import FactorDefinition
from app.ai.factors.beleidsalignement import Randvoorwaarde


class GemeenteOpgave(BaseModel):
    """Per-gemeente woningbouwopgave-rij uit de Woondeal."""

    gemeente_naam: str = Field(min_length=1)
    toevoegingen: int | None = Field(default=None, ge=0, description="Aantal toe te voegen woningen")
    plancapaciteit: int | None = Field(default=None, ge=0, description="Aantal woningen in plancapaciteit")
    sleutelprojecten_aantal: int | None = Field(default=None, ge=0)
    sleutelprojecten_woningen: int | None = Field(default=None, ge=0)


class WoondealPayload(BaseModel):
    """Gestructureerde extractie van een regionale Woondeal."""

    regio_naam: str = Field(default="", description="Woondealregio, bv. Noord-Limburg")
    provincie: str | None = Field(default=None)
    periode: str | None = Field(default=None, description="bv. 2022-2030")
    gemeenten: list[GemeenteOpgave] = Field(default_factory=list)
    aandeel_betaalbaar: float | None = Field(default=None, ge=0.0, le=1.0, description="bv. 0.667 = 2/3")
    betaalbaar_definitie: str | None = Field(default=None)
    regelingen: list[str] = Field(default_factory=list, description="bv. KLC, BIRK, Woningbouwimpuls")
    doelgroepen: list[str] = Field(default_factory=list)
    randvoorwaarden: list[Randvoorwaarde] = Field(default_factory=list)
    algemeen_citaat: str = Field(default="")
    confidence: float = Field(ge=0.0, le=1.0)


_INPUT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "regio_naam": {"type": "string", "description": "Woondealregio (bv. Noord-Limburg)"},
        "provincie": {"type": "string"},
        "periode": {"type": "string", "description": "Looptijd, bv. 2022-2030"},
        "gemeenten": {
            "type": "array",
            "description": (
                "Per gemeente in de regio een rij met opgave + plancapaciteit. Neem ALLEEN "
                "gemeenten op die letterlijk in het document staan."
            ),
            "items": {
                "type": "object",
                "properties": {
                    "gemeente_naam": {"type": "string", "minLength": 1},
                    "toevoegingen": {"type": "integer", "minimum": 0,
                                     "description": "Aantal toe te voegen woningen"},
                    "plancapaciteit": {"type": "integer", "minimum": 0,
                                       "description": "Aantal woningen in plancapaciteit"},
                    "sleutelprojecten_aantal": {"type": "integer", "minimum": 0},
                    "sleutelprojecten_woningen": {"type": "integer", "minimum": 0},
                },
                "required": ["gemeente_naam"],
                "additionalProperties": False,
            },
        },
        "aandeel_betaalbaar": {"type": "number", "minimum": 0.0, "maximum": 1.0,
                               "description": "Regio-breed betaalbaar-aandeel (2/3 = 0.667)"},
        "betaalbaar_definitie": {"type": "string",
                                 "description": "Wat valt onder 'betaalbaar' (huur-/koopgrenzen)"},
        "regelingen": {"type": "array", "items": {"type": "string"},
                       "description": "Genoemde regelingen/financiële instrumenten (KLC, BIRK, Woningbouwimpuls)"},
        "doelgroepen": {"type": "array", "items": {"type": "string"}},
        "randvoorwaarden": {
            "type": "array",
            "description": "Voorwaarden die een ontwikkelaar raken. Laat weg zonder letterlijke basis.",
            "items": {
                "type": "object",
                "properties": {
                    "categorie": {
                        "type": "string",
                        "enum": ["programmering", "financieel", "doelgroep", "duurzaamheid",
                                 "proces", "ruimtelijk", "markt", "overig"],
                    },
                    "titel": {"type": "string", "minLength": 1},
                    "samenvatting": {"type": "string", "minLength": 1},
                    "citaat": {"type": "string"},
                    "pagina": {"type": "integer", "minimum": 1},
                },
                "required": ["categorie", "titel", "samenvatting"],
                "additionalProperties": False,
            },
        },
        "algemeen_citaat": {"type": "string"},
        "confidence": {"type": "number", "minimum": 0.0, "maximum": 1.0},
    },
    "required": ["confidence"],
}


WOONDEAL_FACTOR_DEF = FactorDefinition[WoondealPayload](
    factor_id="woondeal",
    tool_name="extract_woondeal",
    description=(
        "Extraheer uit deze regionale Woondeal: de woondealregio, de looptijd, en PER GEMEENTE "
        "de woningbouwopgave (toevoegingen) + plancapaciteit + aantal sleutelprojecten en "
        "bijbehorende woningen. Verzamel ook het regio-brede betaalbaar-aandeel met definitie, "
        "de genoemde regelingen (bv. KLC, BIRK, Woningbouwimpuls), doelgroepen en eventuele "
        "randvoorwaarden. Minimale velden: confidence."
    ),
    input_schema=_INPUT_SCHEMA,
    payload_model=WoondealPayload,
    prompt_instructions=(
        "Lees de Woondeal volledig door en beantwoord via het tool:\n"
        "1. regio_naam: de woondealregio (bv. 'Noord-Limburg'). periode: looptijd (bv. '2022-2030').\n"
        "2. gemeenten: voor ELKE gemeente met een opgave-rij: gemeente_naam exact zoals in het "
        "document, toevoegingen (aantal toe te voegen woningen), plancapaciteit, en — indien "
        "vermeld — sleutelprojecten_aantal + sleutelprojecten_woningen. Verzin GEEN locaties die "
        "niet letterlijk genoemd zijn.\n"
        "3. aandeel_betaalbaar: het regio-brede betaalbaar-streven als fractie (2/3 = 0.667). "
        "betaalbaar_definitie: de huur-/koopgrenzen die 'betaalbaar' afbakenen.\n"
        "4. regelingen: financiële instrumenten/regelingen die genoemd worden.\n"
        "5. randvoorwaarden: gebruik dezelfde categorieën-enum als beleidsalignement.\n"
        "6. confidence: 0.9+ bij heldere tabellen; <0.5 bij twijfel.\n\n"
        "HARDE REGELS:\n"
        "- Geen hallucinaties: laat een gemeente, getal of regeling weg zonder letterlijke basis.\n"
        "- Kopieer citaten letterlijk. Gebruik alleen informatie uit het document."
    ),
)
