"""Beleidsalignement factor — gemeentelijke omgevingsvisie extraction (M053/S01).

Cloned from woonvisie_match (M048/Phase 6). The omgevingsvisie is gebiedsgericht:
deelgebieden (Hart Centraal Stedelijk Gebied, Transformatiegebieden, Dorpen, ...)
each carry an ontwikkelrichting. GebiedPolicy holds that per-gebied direction +
the literal citaat. Matching a parcel to a deelgebied happens at scoring time via
the gebonden_plaatsen name-list (see score_beleidsalignement).
"""

from typing import Any, Literal

from pydantic import BaseModel, Field

from app.ai.factor_extraction_schemas import FactorDefinition

GebiedKarakter = Literal[
    "centraal_stedelijk",
    "transformatie",
    "stedelijk_wonen",
    "werklocatie",
    "dorp",
    "landschap",
]
Woningbouwprioriteit = Literal["hoog", "gemiddeld", "laag", "niet_benoemd"]

RandvoorwaardeCategorie = Literal[
    "programmering", "financieel", "doelgroep", "duurzaamheid",
    "proces", "ruimtelijk", "markt", "overig",
]


class Randvoorwaarde(BaseModel):
    """Een gemeente-brede randvoorwaarde / toetsingsregel uit de omgevingsvisie.

    Display-only: deze beïnvloeden de score NIET (zie spec — meetbaarheid).
    """

    categorie: RandvoorwaardeCategorie
    titel: str = Field(min_length=1, description="Korte titel van de randvoorwaarde")
    samenvatting: str = Field(min_length=1, description="1-3 zinnen: wat betekent dit voor een ontwikkelaar")
    citaat: str | None = Field(default=None, description="Letterlijk citaat dat het onderbouwt")
    pagina: int | None = Field(default=None, ge=1)


class GebiedPolicy(BaseModel):
    """Per-deelgebied ontwikkelrichting uit een gemeentelijke omgevingsvisie."""

    gebied_naam: str = Field(min_length=1, description="Deelgebied-naam zoals in document")
    karakter: GebiedKarakter
    woningbouwprioriteit: Woningbouwprioriteit = "niet_benoemd"
    transformatie_kansgebied: bool = False
    gebonden_plaatsen: list[str] = Field(
        default_factory=list,
        description="Wijk/plaats-namen die onder dit deelgebied vallen; match-sleutel",
    )
    citaat: str = Field(min_length=1, description="Letterlijk citaat dat de richting onderbouwt")
    pagina: int | None = Field(default=None, ge=1)


class OmgevingsvisiePayload(BaseModel):
    """Gestructureerde extractie van een gemeentelijke omgevingsvisie."""

    tijdshorizon: int = Field(description="Jaar van de visie, bv. 2040")
    gebied_policies: list[GebiedPolicy] = Field(default_factory=list)
    algemeen_citaat: str = Field(
        default="",
        description="Gemeente-brede citaat-fallback als geen deelgebied matcht",
    )
    randvoorwaarden: list[Randvoorwaarde] = Field(
        default_factory=list,
        description="Gemeente-brede randvoorwaarden / toetsingskader (display-only, niet gescoord)",
    )
    confidence: float = Field(ge=0.0, le=1.0, description="0=onzeker, 1=zeker")


_INPUT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "tijdshorizon": {"type": "integer", "description": "Jaar van de visie (bv. 2040)"},
        "gebied_policies": {
            "type": "array",
            "description": (
                "Per deelgebied een object met naam, karakter, woningbouwprioriteit, "
                "transformatie_kansgebied, gebonden_plaatsen (wijk/plaats-namen die eronder "
                "vallen), letterlijk citaat en paginanummer. Laat weg zonder letterlijk citaat."
            ),
            "items": {
                "type": "object",
                "properties": {
                    "gebied_naam": {"type": "string", "description": "Deelgebied exact zoals in document"},
                    "karakter": {
                        "type": "string",
                        "enum": [
                            "centraal_stedelijk",
                            "transformatie",
                            "stedelijk_wonen",
                            "werklocatie",
                            "dorp",
                            "landschap",
                        ],
                    },
                    "woningbouwprioriteit": {
                        "type": "string",
                        "enum": ["hoog", "gemiddeld", "laag", "niet_benoemd"],
                    },
                    "transformatie_kansgebied": {"type": "boolean"},
                    "gebonden_plaatsen": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Wijk/plaats/buurt-namen die onder dit deelgebied vallen",
                    },
                    "citaat": {"type": "string", "minLength": 1, "description": "Letterlijk citaat (1-3 zinnen)"},
                    "pagina": {"type": "integer", "minimum": 1},
                },
                "required": ["gebied_naam", "karakter", "citaat"],
                "additionalProperties": False,
            },
        },
        "algemeen_citaat": {"type": "string", "description": "Gemeente-brede fallback-citaat"},
        "randvoorwaarden": {
            "type": "array",
            "description": (
                "Gemeente-brede randvoorwaarden / toetsingsregels die voor ELKE ontwikkeling "
                "in de gemeente gelden (niet gebied-specifiek): bv. programmerings-eisen, "
                "kostenverhaal, doelgroep/short-stay regels, duurzaamheidseisen, milieucategorie, "
                "proces/toetsingskader. Laat weg zonder letterlijke basis in het document."
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
    "required": ["tijdshorizon", "confidence"],
}


OMGEVINGSVISIE_FACTOR_DEF = FactorDefinition[OmgevingsvisiePayload](
    factor_id="beleidsalignement",
    tool_name="extract_beleidsalignement",
    description=(
        "Extraheer de ruimtelijke deelgebieden en hun ontwikkelrichting uit deze "
        "gemeentelijke omgevingsvisie. Per deelgebied met expliciete beleidsaandacht: "
        "karakter (centraal_stedelijk/transformatie/stedelijk_wonen/werklocatie/dorp/landschap), "
        "woningbouwprioriteit, of het een transformatie-kansgebied is, welke wijken/plaatsen "
        "eronder vallen, en een letterlijk citaat. Minimale velden: tijdshorizon, confidence."
    ),
    input_schema=_INPUT_SCHEMA,
    payload_model=OmgevingsvisiePayload,
    prompt_instructions=(
        "Lees de omgevingsvisie volledig door en beantwoord via het tool:\n"
        "1. Welk jaar is de tijdshorizon (tijdshorizon)?\n"
        "2. Welke ruimtelijke deelgebieden onderscheidt de visie? Voor ELK deelgebied:\n"
        "   - gebied_naam: exact zoals in document (niet parafraseren)\n"
        "   - karakter: centraal_stedelijk (binnenstad/verdichten), transformatie "
        "(herontwikkeling/sloop-nieuwbouw), stedelijk_wonen (bestaande woonwijken), "
        "werklocatie (bedrijventerrein/campus), dorp (kernen), landschap (groen/water)\n"
        "   - woningbouwprioriteit: hoog/gemiddeld/laag/niet_benoemd\n"
        "   - transformatie_kansgebied: true als expliciet aangewezen voor transformatie\n"
        "   - gebonden_plaatsen: welke wijken/plaatsen/buurten vallen onder dit gebied "
        "(bv. Blerick, Tegelen, Arcen)? Lege lijst als niet genoemd.\n"
        "   - citaat: letterlijk citaat dat de richting onderbouwt (1-3 zinnen)\n"
        "   - pagina: paginanummer indien zichtbaar, anders null\n"
        "3. Gemeente-brede tekst zonder deelgebied → algemeen_citaat.\n"
        "4. Welke gemeente-brede randvoorwaarden / toetsingsregels gelden voor ELKE ontwikkeling "
        "(niet gebied-specifiek)? Verzamel ze in randvoorwaarden. Voor ELKE randvoorwaarde:\n"
        "   - categorie: programmering (woningbouw-mix/aantallen), financieel (kostenverhaal/bijdragen), "
        "doelgroep (short-stay/sociaal/senioren), duurzaamheid (energie/klimaat/circulair), "
        "proces (toetsingskader/participatie), ruimtelijk (groen/parkeren/dichtheid), markt, overig\n"
        "   - titel: korte titel van de randvoorwaarde\n"
        "   - samenvatting: 1-3 zinnen, wat betekent dit voor een ontwikkelaar\n"
        "   - citaat: letterlijk citaat dat het onderbouwt, anders null\n"
        "   - pagina: paginanummer indien zichtbaar, anders null\n"
        "5. Confidence: 0.9+ bij heldere gebiedsindeling; 0.5-0.7 bij vage tekst; <0.5 bij twijfel.\n\n"
        "HARDE REGELS:\n"
        "- Laat een GebiedPolicy of randvoorwaarde weg als je geen letterlijke basis kunt vinden. "
        "Geen hallucinaties.\n"
        "- Kopieer citaten letterlijk. Geen parafrases.\n"
        "- Gebruik alleen informatie uit het document."
    ),
)
