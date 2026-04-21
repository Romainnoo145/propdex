"""Woonvisie factor extraction schema + FactorDefinition (M047/S06 POC).

WoonvisiePayload: gestructureerde extractie uit gemeentelijke woonvisie.
WOONVISIE_MATCH_FACTOR_DEF: FactorDefinition contract voor extract_factor().
"""

from typing import Any, Literal

from pydantic import BaseModel, Field

from app.ai.factor_extraction_schemas import FactorDefinition


class WoonvisiePayload(BaseModel):
    """Gestructureerde extractie van een gemeentelijke woonvisie."""

    # Tijdlijn
    periode_start: int = Field(description="Startjaar woonvisie, bv. 2025")
    periode_einde: int = Field(description="Eindjaar woonvisie, bv. 2030")
    document_type: Literal["woonvisie", "volkshuisvestingsprogramma"] = "woonvisie"

    # Kwantitatieve opgave
    opgave_totaal: int | None = Field(
        default=None,
        description="Totaal te realiseren woningen in de periode",
    )

    # Segmentverdeling nieuwbouw (percentages 0-100, optioneel)
    pct_sociaal_huur: float | None = Field(default=None, ge=0.0, le=100.0)
    pct_middenhuur: float | None = Field(default=None, ge=0.0, le=100.0)
    pct_dure_huur: float | None = Field(default=None, ge=0.0, le=100.0)
    pct_betaalbare_koop: float | None = Field(default=None, ge=0.0, le=100.0)
    pct_dure_koop: float | None = Field(default=None, ge=0.0, le=100.0)

    # Prioritair segment (dominant woningbehoefte)
    prioritized_segment: Literal["sociaal", "midden", "duur", "gemengd"] = "gemengd"

    # Ruimtelijke prioriteiten (wijknamen)
    growth_wijken: list[str] = Field(
        default_factory=list,
        description="Wijken waar gemeente nadrukkelijk wil bouwen / verdichten",
    )
    shrink_wijken: list[str] = Field(
        default_factory=list,
        description="Wijken met krimp of restrictief beleid",
    )
    herstructureringswijken: list[str] = Field(
        default_factory=list,
        description="Wijken met sloop/nieuwbouw of transformatie-prioriteit",
    )

    # Doelgroepen als prioriteit benoemd
    doelgroepen: list[str] = Field(
        default_factory=list,
        description="Expliciete doelgroepen bv ['starters', 'ouderen', 'statushouders']",
    )

    # Uitgesloten projecttypen
    excluded_project_types: list[str] = Field(
        default_factory=list,
        description="Propdex projecttype-strings die gemeente niet wenst",
    )

    # Claude-confidence in eigen extractie
    confidence: float = Field(ge=0.0, le=1.0, description="0=onzeker, 1=zeker")


_INPUT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "periode_start": {"type": "integer", "description": "Startjaar woonvisie"},
        "periode_einde": {"type": "integer", "description": "Eindjaar woonvisie"},
        "document_type": {
            "type": "string",
            "enum": ["woonvisie", "volkshuisvestingsprogramma"],
        },
        "opgave_totaal": {"type": "integer", "description": "Totaal te bouwen woningen"},
        "pct_sociaal_huur": {"type": "number", "minimum": 0, "maximum": 100},
        "pct_middenhuur": {"type": "number", "minimum": 0, "maximum": 100},
        "pct_dure_huur": {"type": "number", "minimum": 0, "maximum": 100},
        "pct_betaalbare_koop": {"type": "number", "minimum": 0, "maximum": 100},
        "pct_dure_koop": {"type": "number", "minimum": 0, "maximum": 100},
        "prioritized_segment": {
            "type": "string",
            "enum": ["sociaal", "midden", "duur", "gemengd"],
        },
        "growth_wijken": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Wijken waar gemeente wil verdichten/bouwen",
        },
        "shrink_wijken": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Wijken met krimp of restrictief beleid",
        },
        "herstructureringswijken": {
            "type": "array",
            "items": {"type": "string"},
        },
        "doelgroepen": {
            "type": "array",
            "items": {"type": "string"},
        },
        "excluded_project_types": {
            "type": "array",
            "items": {"type": "string"},
        },
        "confidence": {
            "type": "number",
            "minimum": 0.0,
            "maximum": 1.0,
            "description": "Extractie-zekerheid, 0-1",
        },
    },
    "required": ["periode_start", "periode_einde", "prioritized_segment", "growth_wijken", "confidence"],
}


WOONVISIE_MATCH_FACTOR_DEF = FactorDefinition[WoonvisiePayload](
    factor_id="woonvisie_match",
    tool_name="extract_woonvisie_match",
    description=(
        "Extraheer de woningbouwopgave en ruimtelijke prioriteiten uit deze woonvisie. "
        "Identificeer het prioritaire segment (sociaal/midden/duur/gemengd), "
        "de groei- en krimpwijken, de doelgroepen en de segmentverdeling in percentages. "
        "Minimale velden: periode_start, periode_einde, prioritized_segment, growth_wijken, confidence."
    ),
    input_schema=_INPUT_SCHEMA,
    payload_model=WoonvisiePayload,
    prompt_instructions=(
        "Lees de woonvisie volledig door en beantwoord via het tool:\n"
        "1. Welk woonsegment heeft prioriteit?\n"
        "2. Welke wijken of gebieden worden expliciet als groeigebied of verdichtingslocatie benoemd?\n"
        "3. Welke wijken hebben krimp of restrictief beleid?\n"
        "4. Welke doelgroepen worden prioritair benoemd (starters, ouderen, etc.)?\n"
        "5. Geef segmentverdeling in percentages waar beschikbaar.\n"
        "Gebruik alleen informatie uit het document. Zet confidence laag (<0.5) als het document vaag is."
    ),
)
