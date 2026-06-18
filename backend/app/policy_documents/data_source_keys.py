"""Vendor-managed catalog of data-source keys (M049/S01).

Single source of truth for which data-sources feed Propdex scoring per gemeente.

DELIBERATELY SEPARATE from `app/policy_documents/source_keys.py` (M045 cascade-level
keys). Naming-confusion-risk was the eng-review locked decision 2026-05-14.

KEY CONTRACT:
    - keys are kebab-case unique identifiers
    - source_type "A" = cascade-upload (PDF/document), "B" = open API,
      "C" = paid integration
    - label_nl is Nederlandse displaynaam (REQUIRED, non-empty)
    - voedt_factor lists scoring-factor keys this source feeds (may be empty
      for context-only sources)

Mirror: `frontend/src/lib/constants/dataSourceKeys.ts` -- hand-maintained twin.
Drift caught by
`tests/unit/test_data_source_keys_catalog.py::test_python_ts_catalog_key_sets_match`.
"""

from dataclasses import dataclass, field
from typing import Literal

SourceType = Literal["A", "B", "C"]


@dataclass(frozen=True)
class DataSourceKeyEntry:
    """One data-source entry in the M049 admin catalog."""

    key: str
    label_nl: str
    source_type: SourceType
    description: str
    level: Literal["landelijk", "provincie", "gemeente"] = "gemeente"
    voedt_factor: tuple[str, ...] = field(default_factory=tuple)


# Type A -- cascade-uploads (PDF/document-based, ingested via M045 upload flow).
# Source: .planning/CASCADE-DOCUMENT-MAPPING.md + landscape doc §3.A
_TYPE_A_ENTRIES: list[DataSourceKeyEntry] = [
    DataSourceKeyEntry(
        key="woonvisie",
        label_nl="Woonvisie / Volkshuisvestingsprogramma",
        source_type="A",
        description=(
            "Gemeentelijk woningbouwprogramma per wijk -- segmenten, doelgroepen,"
            " prioriteiten."
        ),
        voedt_factor=("woonvisie_match",),
    ),
    DataSourceKeyEntry(
        key="omgevingsvisie",
        label_nl="Omgevingsvisie (gemeente)",
        source_type="A",
        description=(
            "Langetermijnvisie op leefomgeving -- ontwikkelrichting +"
            " verdichtingsgebieden."
        ),
        voedt_factor=("beleidsalignement",),
    ),
    DataSourceKeyEntry(
        key="huisvestingsverordening",
        label_nl="Huisvestingsverordening",
        source_type="A",
        description="Regels voor woningvorming, splitsing en onttrekking.",
        voedt_factor=("splitsingsrisico",),
    ),
    DataSourceKeyEntry(
        key="welstandsnota",
        label_nl="Welstandsnota",
        source_type="A",
        description="Welstandseisen per gebied: materiaal, kleur, bouwhoogte.",
        voedt_factor=("welstand_beperking",),
    ),
    DataSourceKeyEntry(
        key="parkeerbeleid",
        label_nl="Parkeerbeleid",
        source_type="A",
        description="Parkeernormen per woningtype en stedelijkheidszone.",
        voedt_factor=("parkeerdruk",),
    ),
    DataSourceKeyEntry(
        key="parkeernormen",
        label_nl="Nota parkeernormen",
        source_type="A",
        description="Gemeentelijke parkeernorm-systematiek: auto-/fietsnormen per functie en gebied.",
        voedt_factor=("parkeerdruk",),
    ),
    DataSourceKeyEntry(
        key="duurzaamheidsbeleid",
        label_nl="Duurzaamheidsbeleid",
        source_type="A",
        description="Aanvullende duurzaamheidseisen: gasloos, BENG, groene daken.",
        voedt_factor=("duurzaamheid_kosten",),
    ),
    DataSourceKeyEntry(
        key="erfgoedverordening",
        label_nl="Erfgoedverordening",
        source_type="A",
        description="Lokale gemeentelijke monumenten -- eigen beschermingsregime.",
        voedt_factor=("monument",),
    ),
    DataSourceKeyEntry(
        key="omgevingsverordening-provincie",
        label_nl="Omgevingsverordening (provincie)",
        source_type="A",
        description=(
            "Provinciale regels voor ruimtegebruik, bouwhoogtes, beschermde gebieden."
        ),
        level="provincie",
        voedt_factor=("bestemming",),
    ),
    DataSourceKeyEntry(
        key="provinciale-omgevingsvisie",
        label_nl="Provinciale omgevingsvisie",
        source_type="A",
        description="Langetermijnvisie provincie -- verstedelijking + landschap.",
        level="provincie",
        voedt_factor=("beleidsalignement_provincie",),
    ),
    DataSourceKeyEntry(
        key="woondeals",
        label_nl="Woondeals & woningbouwafspraken",
        source_type="A",
        description=(
            "Regionale afspraken woningbouwaantallen + versnellingslocaties."
        ),
        voedt_factor=("woonvisie_match",),
    ),
    DataSourceKeyEntry(
        key="provinciaal-erfgoed",
        label_nl="Provinciaal erfgoed",
        source_type="A",
        description="Provinciale monumentenlijst + cultuurhistorische waardenkaart.",
        level="provincie",
        voedt_factor=("monument",),
    ),
    DataSourceKeyEntry(
        key="natuur-stikstof-provincie",
        label_nl="Natuur & stikstof (provincie)",
        source_type="A",
        description=(
            "Natura 2000, stikstofbeleid, beperkingen bouw nabij natuurgebieden."
        ),
        level="provincie",
        voedt_factor=("stikstofrisico",),
    ),
    DataSourceKeyEntry(
        key="energietransitie-res",
        label_nl="Regionale Energiestrategie (RES)",
        source_type="A",
        description="Zoekgebieden wind/zon, warmtenetten per regio.",
        level="provincie",
        voedt_factor=("energie_context",),
    ),
    DataSourceKeyEntry(
        key="mobiliteitsbeleid",
        label_nl="Mobiliteitsbeleid",
        source_type="A",
        description="OV-knooppunten, bereikbaarheid, mobiliteitstransitie per regio.",
        level="provincie",
        voedt_factor=("bereikbaarheid",),
    ),
    DataSourceKeyEntry(
        key="raadsinformatie",
        label_nl="Raadsinformatie",
        source_type="A",
        description="Gemeenteraadsvergaderingen, moties, besluiten over RO.",
        voedt_factor=("politiek_klimaat",),
    ),
    DataSourceKeyEntry(
        key="leegstandsverordening",
        label_nl="Leegstandsverordening",
        source_type="A",
        description=(
            "Regels leegstandsmeldplicht -- indicator voor transformatiekansen."
        ),
        voedt_factor=("leegstandsdruk",),
    ),
    DataSourceKeyEntry(
        key="gemeentelijke-subsidies",
        label_nl="Gemeentelijke subsidies",
        source_type="A",
        description="Gemeente-specifieke subsidies voor woningbouw + verduurzaming.",
        voedt_factor=("subsidie_potentie",),
    ),
    DataSourceKeyEntry(
        key="provinciale-subsidies",
        label_nl="Provinciale subsidies",
        source_type="A",
        description=(
            "Subsidies voor verduurzaming, transformatie, woningbouw vanuit provincie."
        ),
        level="provincie",
        voedt_factor=("subsidie_potentie",),
    ),
    DataSourceKeyEntry(
        key="grondprijsbeleid",
        label_nl="Grondprijsbeleid",
        source_type="A",
        description="Gemeentelijke grondprijzen per bestemming (grondprijzenbrief).",
        voedt_factor=("grondwaarde_fit",),
    ),
    DataSourceKeyEntry(
        key="omgevingsplan-bouwregels",
        label_nl="Omgevingsplan bouwregels",
        source_type="A",
        description=(
            "DSO-derived bouwregels per gebied (max_bouwhoogte, max_bouwlagen, FAR)."
        ),
        voedt_factor=("bestemming", "transformatiepotentie"),
    ),
    DataSourceKeyEntry(
        key="omgevingswet-bbl",
        label_nl="Omgevingswet & Bbl (landelijk)",
        source_type="A",
        description="Landelijk wettelijk kader: Omgevingswet + Besluit bouwwerken leefomgeving.",
        level="landelijk",
        voedt_factor=("vergunning_succeskans",),
    ),
]


# Type B -- open APIs (publiek beschikbaar, geen credential nodig).
# Source: landscape doc §3.B + phase99-environmental-apis.md
_TYPE_B_ENTRIES: list[DataSourceKeyEntry] = [
    DataSourceKeyEntry(
        key="bag-panden",
        label_nl="BAG Panden",
        source_type="B",
        description=(
            "Pand-geometrie + bouwjaar + status uit Basisregistratie Adressen en"
            " Gebouwen."
        ),
        voedt_factor=("pand_status", "bouwjaar"),
    ),
    DataSourceKeyEntry(
        key="bag-adressen",
        label_nl="BAG Adressen + PDOK Locatieserver",
        source_type="B",
        description="Adres-lookup via PDOK suggest + lookup endpoints.",
        voedt_factor=(),
    ),
    DataSourceKeyEntry(
        key="3d-bag",
        label_nl="3D BAG (hoogte + bouwlagen)",
        source_type="B",
        description="CityJSON-derived 3D-geometrie: hoogte, bouwlagen, dakvorm.",
        voedt_factor=("transformatiepotentie",),
    ),
    DataSourceKeyEntry(
        key="cbs-statline",
        label_nl="CBS StatLine (wijk- en buurtcijfers)",
        source_type="B",
        description="Demografie, inkomen, woningvoorraad per wijk uit CBS OData v4.",
        voedt_factor=("demografie", "marktcontext"),
    ),
    DataSourceKeyEntry(
        key="bodemloket",
        label_nl="Bodemloket (bodemkwaliteit)",
        source_type="B",
        description="Bodemverontreiniging, asbestrisico, sanering historie.",
        voedt_factor=("bodemkwaliteit",),
    ),
    DataSourceKeyEntry(
        key="pdok-funderingsrisico",
        label_nl="PDOK funderingsrisico (KCAF)",
        source_type="B",
        description="Funderingsrisico per postcode -- paalrot, droogtegevoeligheid.",
        voedt_factor=("funderingsrisico",),
    ),
    DataSourceKeyEntry(
        key="pdok-natura2000",
        label_nl="PDOK Natura 2000 (WFS)",
        source_type="B",
        description="Natura 2000 gebieden + afstand tot beschermd gebied.",
        voedt_factor=("stikstofrisico",),
    ),
    DataSourceKeyEntry(
        key="rws-overstroming-wms",
        label_nl="RWS Overstromingsrisico (WMS)",
        source_type="B",
        description="Overstromingskaart binnendijks / buitendijks per parcel.",
        voedt_factor=("overstromingsrisico",),
    ),
    DataSourceKeyEntry(
        key="rivm-geluid-lden",
        label_nl="RIVM Geluid Lden (WMS)",
        source_type="B",
        description="Geluidsbelasting verkeer/spoor in dB per parcel.",
        voedt_factor=("geluidsbelasting",),
    ),
    DataSourceKeyEntry(
        key="rivm-luchtkwaliteit",
        label_nl="RIVM Luchtkwaliteit NO2 + PM10",
        source_type="B",
        description="Stikstofdioxide + fijnstof concentraties per parcel.",
        voedt_factor=("luchtkwaliteit",),
    ),
    DataSourceKeyEntry(
        key="sru-bekendmakingen",
        label_nl="SRU Bekendmakingen (officielebekendmakingen.nl)",
        source_type="B",
        description="Vergunningen + bekendmakingen via SRU API.",
        voedt_factor=("vergunning_succeskans",),
    ),
    DataSourceKeyEntry(
        key="rechtspraak-jurisprudentie",
        label_nl="Rechtspraak.nl jurisprudentie",
        source_type="B",
        description="Relevante uitspraken bestuursrecht + AI-analyse.",
        voedt_factor=("juridisch_klimaat",),
    ),
    DataSourceKeyEntry(
        key="dso-omgevingsplan",
        label_nl="DSO Omgevingsplan (PLU WMS)",
        source_type="B",
        description="Bestemming + maatvoering via DSO/PLU WMS.",
        voedt_factor=("bestemming",),
    ),
    DataSourceKeyEntry(
        key="koop-sru-cvdr",
        label_nl="KOOP SRU CVDR (decentrale regelgeving)",
        source_type="B",
        description="Verordeningen + beleidsregels van gemeente/provincie/waterschap.",
        voedt_factor=("juridisch_klimaat",),
    ),
    DataSourceKeyEntry(
        key="rce-rijksmonumenten",
        label_nl="RCE Rijksmonumenten + beschermd stadsgezicht",
        source_type="B",
        description="Rijksbeschermd erfgoed via RCE API.",
        voedt_factor=("monument",),
    ),
    DataSourceKeyEntry(
        key="ep-online-energielabel",
        label_nl="EP-Online energielabel",
        source_type="B",
        description="Energielabel + BENG-indicatoren per adres via RVO.",
        voedt_factor=("energielabel",),
    ),
    DataSourceKeyEntry(
        key="kadaster-cadastral-pdok",
        label_nl="Kadastrale percelen (PDOK)",
        source_type="B",
        description="Kadastrale grens + perceeloppervlakte via PDOK BRK-open.",
        voedt_factor=("oppervlakte",),
    ),
]


# Type C -- paid integrations (require credential -- wired up in Phase 5).
# Source: landscape doc §3.C + partner-briefing 2026-05-13 pricing-tier rationale
_TYPE_C_ENTRIES: list[DataSourceKeyEntry] = [
    DataSourceKeyEntry(
        key="brk-eigendom",
        label_nl="BRK Eigendom (Kadaster)",
        source_type="C",
        description=(
            "Eigenaar + zakelijk recht + koopsom via Haal-Centraal BRK bevragen."
        ),
        voedt_factor=("eigendom_context",),
    ),
    DataSourceKeyEntry(
        key="brk-hypotheek",
        label_nl="BRK Hypotheken",
        source_type="C",
        description="Hypotheek-status + geldverstrekker via BRK bevragen.",
        voedt_factor=("financieel_context",),
    ),
    DataSourceKeyEntry(
        key="brk-beslag",
        label_nl="BRK Beslagen + privaatrechtelijke beperkingen",
        source_type="C",
        description="Beslagen, kwalitatieve verplichtingen, erfdienstbaarheden.",
        voedt_factor=("juridisch_klimaat",),
    ),
    DataSourceKeyEntry(
        key="nvm-transactiedata",
        label_nl="NVM transactiedata (Brainbay)",
        source_type="C",
        description="Werkelijke transactieprijzen + doorlooptijden via NVM.",
        voedt_factor=("marktwaarde",),
    ),
    DataSourceKeyEntry(
        key="vindsubsidies",
        label_nl="Vindsubsidies database",
        source_type="C",
        description=(
            "Aggregator van Nederlandse subsidies -- actuele dekking + criteria."
        ),
        voedt_factor=("subsidie_potentie",),
    ),
]


# Public catalog -- order = Type A first, then B, then C (admin UI rendering order).
DATA_SOURCE_KEYS: list[DataSourceKeyEntry] = [
    *_TYPE_A_ENTRIES,
    *_TYPE_B_ENTRIES,
    *_TYPE_C_ENTRIES,
]


def get_entry(key: str) -> DataSourceKeyEntry | None:
    """Return catalog entry for `key`, or None if unknown."""
    for entry in DATA_SOURCE_KEYS:
        if entry.key == key:
            return entry
    return None


def get_entries_by_type(source_type: SourceType) -> list[DataSourceKeyEntry]:
    """Return all entries of a given source_type (A/B/C)."""
    return [e for e in DATA_SOURCE_KEYS if e.source_type == source_type]
