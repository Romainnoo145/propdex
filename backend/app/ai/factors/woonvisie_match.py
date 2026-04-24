"""Woonvisie factor extraction schema + FactorDefinition (M047/S06 POC, M048/Phase 6 upgrade).

WoonvisiePayload: gestructureerde extractie uit gemeentelijke woonvisie.
WijkPolicy: per-wijk beleid (M048/Phase 6 WOON-05) — vervangt platte gemeente-brede
  lijsten (growth_wijken/shrink_wijken/etc.) met structured per-wijk objects die
  een letterlijk citaat dragen voor UI-weergave in WoonvisiePopup.
WOONVISIE_MATCH_FACTOR_DEF: FactorDefinition contract voor extract_factor().
"""

from typing import Any, Literal

from pydantic import BaseModel, Field

from app.ai.factor_extraction_schemas import FactorDefinition


class WijkPolicy(BaseModel):
    """Per-wijk beleid uit een gemeentelijke woonvisie (M048/Phase 6).

    Vervangt platte gemeente-brede lijsten (growth_wijken/shrink_wijken/etc.) met
    structured per-wijk policies die een letterlijk citaat dragen voor UI-weergave.
    """

    wijk_naam: str = Field(min_length=1, description="Wijk-naam zoals in woonvisie-tekst")
    prioriteit: Literal["groei", "krimp", "herstructurering", "neutraal"]
    gewenste_segmenten: list[Literal["sociaal", "midden", "duur", "gemengd"]] = Field(
        default_factory=list,
        description="Voorkeurssegmenten voor deze wijk; lege lijst = geen voorkeur uitgesproken",
    )
    citaat: str = Field(
        min_length=1,
        description="Letterlijk citaat uit document dat prioriteit/segmenten onderbouwt",
    )
    pagina: int | None = Field(default=None, ge=1, description="Paginanummer (None als onbekend)")


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

    # --- NEW in Phase 6 (WOON-05): primary wijk-differentiatie source ---
    wijk_policies: list[WijkPolicy] = Field(
        default_factory=list,
        description="Per-wijk beleid; leeg bij vage documenten",
    )
    algemeen_citaat: str = Field(
        default="",
        description="Gemeente-brede citaat-fallback als wijk_policies leeg of geen match",
    )

    # --- DEPRECATED in Phase 6 — retained for cache-roundtrip backwards-compat; Claude niet meer gevraagd te vullen ---
    prioritized_segment: Literal["sociaal", "midden", "duur", "gemengd"] = "gemengd"
    growth_wijken: list[str] = Field(default_factory=list)
    shrink_wijken: list[str] = Field(default_factory=list)
    herstructureringswijken: list[str] = Field(default_factory=list)
    doelgroepen: list[str] = Field(default_factory=list)
    excluded_project_types: list[str] = Field(default_factory=list)

    # Claude-confidence in eigen extractie
    confidence: float = Field(ge=0.0, le=1.0, description="0=onzeker, 1=zeker")


_INPUT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "periode_start": {"type": "integer", "description": "Startjaar woonvisie (bv. 2025)"},
        "periode_einde": {"type": "integer", "description": "Eindjaar woonvisie (bv. 2030)"},
        "document_type": {
            "type": "string",
            "enum": ["woonvisie", "volkshuisvestingsprogramma"],
        },
        "opgave_totaal": {"type": "integer", "description": "Totaal aantal te bouwen woningen over de periode"},
        "pct_sociaal_huur": {"type": "number", "minimum": 0, "maximum": 100},
        "pct_middenhuur": {"type": "number", "minimum": 0, "maximum": 100},
        "pct_dure_huur": {"type": "number", "minimum": 0, "maximum": 100},
        "pct_betaalbare_koop": {"type": "number", "minimum": 0, "maximum": 100},
        "pct_dure_koop": {"type": "number", "minimum": 0, "maximum": 100},
        "wijk_policies": {
            "type": "array",
            "description": (
                "Per wijk een beleidsobject met naam, prioriteit, gewenste segmenten, "
                "letterlijk citaat uit document en paginanummer. Laat weg als geen letterlijk "
                "citaat voor de wijk te vinden is — hallucineer geen beleidstekst."
            ),
            "items": {
                "type": "object",
                "properties": {
                    "wijk_naam": {
                        "type": "string",
                        "description": "Wijk-naam exact zoals in document genoemd",
                    },
                    "prioriteit": {
                        "type": "string",
                        "enum": ["groei", "krimp", "herstructurering", "neutraal"],
                    },
                    "gewenste_segmenten": {
                        "type": "array",
                        "items": {
                            "type": "string",
                            "enum": ["sociaal", "midden", "duur", "gemengd"],
                        },
                    },
                    "citaat": {
                        "type": "string",
                        "minLength": 1,
                        "description": "Letterlijk citaat uit document (1-3 zinnen)",
                    },
                    "pagina": {"type": "integer", "minimum": 1},
                },
                "required": ["wijk_naam", "prioriteit", "gewenste_segmenten", "citaat"],
                "additionalProperties": False,
            },
        },
        "algemeen_citaat": {
            "type": "string",
            "description": "Gemeente-breed citaat als fallback wanneer per-wijk onduidelijk",
        },
        "confidence": {"type": "number", "minimum": 0.0, "maximum": 1.0},
    },
    "required": ["periode_start", "periode_einde", "confidence"],
}


WOONVISIE_MATCH_FACTOR_DEF = FactorDefinition[WoonvisiePayload](
    factor_id="woonvisie_match",
    tool_name="extract_woonvisie_match",
    description=(
        "Extraheer de woningbouwopgave en per-wijk beleidsprioriteiten uit deze woonvisie. "
        "Per wijk met expliciete beleidsaandacht: prioriteit (groei/krimp/herstructurering/neutraal), "
        "gewenste segmenten (sociaal/midden/duur/gemengd) en een letterlijk citaat uit het document. "
        "Minimale velden: periode_start, periode_einde, confidence."
    ),
    input_schema=_INPUT_SCHEMA,
    payload_model=WoonvisiePayload,
    prompt_instructions=(
        "Lees de woonvisie volledig door en beantwoord via het tool:\n"
        "1. Welke periode beslaat het document (periode_start, periode_einde)?\n"
        "2. Welke wijken krijgen expliciete beleidsaandacht? Voor ELKE zo'n wijk:\n"
        "   - wijk_naam: exact zoals in document genoemd (niet parafraseren)\n"
        "   - prioriteit: groei (verdichten/bouwen), krimp (restrictief/afname), "
        "herstructurering (sloop-nieuwbouw/transformatie), neutraal (stabilisatie)\n"
        "   - gewenste_segmenten: welke segmenten (sociaal/midden/duur/gemengd) wil de gemeente "
        "daar toevoegen? Lege lijst als niet genoemd.\n"
        "   - citaat: letterlijk citaat uit document dat bovenstaande onderbouwt (1-3 zinnen, "
        "inclusief cijfers/doelgroepen/percentages als ze in dezelfde passage staan)\n"
        "   - pagina: paginanummer als zichtbaar, anders null\n"
        "3. Als er gemeente-brede tekst is die geen wijk noemt maar wel relevant is: zet in algemeen_citaat.\n"
        "4. Confidence: 0.9+ bij helder document met expliciete wijk-paragrafen; 0.5-0.7 bij vage tekst; <0.5 "
        "als je twijfelt of de extractie klopt.\n\n"
        "HARDE REGELS:\n"
        "- Laat WijkPolicy weg als je geen letterlijk citaat voor die wijk kunt vinden. Geen hallucinaties.\n"
        "- Kopieer citaten letterlijk (incl. leestekens en cijfers). Geen parafrases.\n"
        "- Gebruik alleen informatie uit het document. Vul geen beleidsinvulling in die niet in de tekst staat."
    ),
)
