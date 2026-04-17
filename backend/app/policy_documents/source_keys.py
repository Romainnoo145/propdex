"""Python mirror of frontend/src/lib/constants/dataSources.ts — M045/S05 T00.

Keep these arrays in sync with the frontend shared file. Drift is caught by
test_m045_source_keys_validation.py which enforces at least one canonical key
per level exists and rejects unknown keys.

KEY CONTRACT: keys are kebab-case (e.g. 'beng-energieprestatie'), matching
the existing usePolicyDocuments callers and production DB values.
"""

from dataclasses import dataclass
from typing import Literal

SourceCategory = Literal[
    "ruimtelijk", "juridisch", "financieel", "duurzaamheid", "monitoring"
]
SourceStatus = Literal["live", "roadmap"]


@dataclass(frozen=True)
class SourceKeyEntry:
    key: str
    label: str
    category: SourceCategory
    status: SourceStatus


LANDELIJK_DATA_SOURCES: list[SourceKeyEntry] = [
    # Ruimtelijk
    SourceKeyEntry("omgevingswet", "Omgevingswet & Bbl", "ruimtelijk", "live"),
    SourceKeyEntry(
        "ladder-verstedelijking",
        "Ladder duurzame verstedelijking",
        "ruimtelijk",
        "roadmap",
    ),
    SourceKeyEntry(
        "nationale-woonagenda",
        "Nationale Woonagenda",
        "ruimtelijk",
        "roadmap",
    ),
    # Juridisch
    SourceKeyEntry(
        "woningwet",
        "Woningwet & corporatieregels",
        "juridisch",
        "roadmap",
    ),
    SourceKeyEntry(
        "asbest-sloop",
        "Asbest & sloopregels",
        "juridisch",
        "roadmap",
    ),
    # Financieel
    SourceKeyEntry(
        "rvo-subsidies",
        "RVO subsidies & financiering",
        "financieel",
        "live",
    ),
    # Duurzaamheid
    SourceKeyEntry(
        "beng-energieprestatie",
        "BENG & energieprestatie",
        "duurzaamheid",
        "roadmap",
    ),
    SourceKeyEntry(
        "stikstof-nationaal",
        "Stikstof & Natura 2000",
        "duurzaamheid",
        "roadmap",
    ),
    # Monitoring
    SourceKeyEntry(
        "rijksbeleid-monitoring",
        "Rijksbeleid monitoring",
        "monitoring",
        "roadmap",
    ),
]

PROVINCIE_DATA_SOURCES: list[SourceKeyEntry] = [
    # Ruimtelijk
    SourceKeyEntry(
        "omgevingsverordening",
        "Omgevingsverordening",
        "ruimtelijk",
        "roadmap",
    ),
    SourceKeyEntry(
        "ruimtelijke-visie",
        "Provinciale omgevingsvisie",
        "ruimtelijk",
        "roadmap",
    ),
    SourceKeyEntry(
        "woondeals",
        "Woondeals & woningbouwafspraken",
        "ruimtelijk",
        "roadmap",
    ),
    # Financieel
    SourceKeyEntry(
        "provinciale-subsidies",
        "Provinciale subsidies",
        "financieel",
        "roadmap",
    ),
    # Duurzaamheid
    SourceKeyEntry(
        "natuur-stikstof",
        "Natuur & stikstof",
        "duurzaamheid",
        "roadmap",
    ),
    SourceKeyEntry(
        "erfgoed-provinciaal",
        "Provinciaal erfgoed",
        "duurzaamheid",
        "roadmap",
    ),
    SourceKeyEntry(
        "energie-transitie",
        "Energietransitie",
        "duurzaamheid",
        "roadmap",
    ),
    # Monitoring
    SourceKeyEntry(
        "mobiliteit",
        "Mobiliteitsbeleid",
        "monitoring",
        "roadmap",
    ),
]

GEMEENTE_DATA_SOURCES: list[SourceKeyEntry] = [
    # Ruimtelijk
    SourceKeyEntry("omgevingsvisie", "Omgevingsvisie", "ruimtelijk", "roadmap"),
    SourceKeyEntry("welstandsnota", "Welstandsnota", "ruimtelijk", "roadmap"),
    SourceKeyEntry("woonvisie", "Woonvisie", "ruimtelijk", "roadmap"),
    SourceKeyEntry("parkeerbeleid", "Parkeerbeleid", "ruimtelijk", "roadmap"),
    SourceKeyEntry(
        "huisvestingsverordening",
        "Huisvestingsverordening",
        "ruimtelijk",
        "live",
    ),
    # Juridisch
    SourceKeyEntry(
        "vergunning-klimaat",
        "Vergunning-klimaat",
        "juridisch",
        "live",
    ),
    SourceKeyEntry(
        "jurisprudentie",
        "Jurisprudentie & AI-analyse",
        "juridisch",
        "live",
    ),
    SourceKeyEntry("raadsinformatie", "Raadsinformatie", "juridisch", "live"),
    SourceKeyEntry(
        "leegstandsverordening",
        "Leegstandsverordening",
        "juridisch",
        "roadmap",
    ),
    # Financieel
    SourceKeyEntry(
        "gemeentelijke-subsidies",
        "Gemeentelijke subsidies",
        "financieel",
        "roadmap",
    ),
    SourceKeyEntry(
        "grondprijsbeleid",
        "Grondprijsbeleid",
        "financieel",
        "roadmap",
    ),
    # Duurzaamheid
    SourceKeyEntry(
        "duurzaamheidsbeleid",
        "Duurzaamheidsbeleid",
        "duurzaamheid",
        "roadmap",
    ),
    SourceKeyEntry(
        "beschermd-erfgoed",
        "Beschermd erfgoed",
        "duurzaamheid",
        "live",
    ),
    SourceKeyEntry(
        "erfgoedverordening",
        "Erfgoedverordening",
        "duurzaamheid",
        "roadmap",
    ),
    # Monitoring
    SourceKeyEntry(
        "bekendmakingen",
        "Bekendmakingen monitoring",
        "monitoring",
        "live",
    ),
    SourceKeyEntry(
        "nieuws-monitoring",
        "Nieuws & beleidsmonitoring",
        "monitoring",
        "roadmap",
    ),
]

_CATALOG: dict[str, list[SourceKeyEntry]] = {
    "landelijk": LANDELIJK_DATA_SOURCES,
    "provincie": PROVINCIE_DATA_SOURCES,
    "gemeente": GEMEENTE_DATA_SOURCES,
}


def is_valid_source_key(entity_type: str, source_key: str) -> bool:
    """True iff source_key is registered for entity_type."""
    return any(e.key == source_key for e in _CATALOG.get(entity_type, []))


def get_source_key_label(entity_type: str, source_key: str) -> str | None:
    """Return display label for a (entity_type, source_key) pair, or None if unknown."""
    for e in _CATALOG.get(entity_type, []):
        if e.key == source_key:
            return e.label
    return None
