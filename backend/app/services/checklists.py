"""Vergunning preparation checklists per development use case.

Static templates — no DB, no AI. Returns a checklist of required
documents, checks, and steps for each development strategy.

Each use case has ~20 items across 6 phases that mirror the real
Dutch vergunning workflow.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class ChecklistItem:
    """A single checklist item."""

    id: str
    category: str  # "document", "onderzoek", "vergunning", "overig"
    phase: str  # one of PHASE_ORDER
    title: str
    description: str
    required: bool = True  # false = recommended but not mandatory
    estimated_cost: str | None = None
    cta_text: str | None = None
    cta_type: str | None = None  # generate_document | request_quote | external_link


PHASE_ORDER: list[str] = [
    "voorbereiding",
    "onderzoeken",
    "vergunningen",
    "participatie",
    "nazorg",
    "informatiebronnen",
]


CHECKLISTS: dict[str, list[ChecklistItem]] = {
    # ── OPTOPPEN ──────────────────────────────────────────────
    "optoppen": [
        # voorbereiding
        ChecklistItem("opt-01", "document", "voorbereiding", "Haalbaarheidscheck optoppen",
                       "Controleer of het pand in aanmerking komt: daktype, constructie, bestemmingsplan hoogte",
                       True),
        ChecklistItem("opt-02", "document", "voorbereiding", "Kadastrale gegevens opvragen",
                       "Eigendomssituatie en erfgrenzen verifiëren via Kadaster",
                       True, None, "Bekijk Kadaster", "external_link"),
        ChecklistItem("opt-03", "document", "voorbereiding", "Bouwtekeningen bestaande situatie",
                       "Bestaande plattegronden, doorsneden en geveltekeningen door architect",
                       True, "€3.000–6.000", "Genereer document", "generate_document"),
        ChecklistItem("opt-04", "document", "voorbereiding", "Ontwerp nieuwe situatie",
                       "Architect tekent uitbreiding met extra verdieping(en) inclusief gevels",
                       True, "€4.000–8.000", "Genereer document", "generate_document"),
        # onderzoeken
        ChecklistItem("opt-05", "onderzoek", "onderzoeken", "Constructief rapport",
                       "Beoordeling draagkracht bestaande constructie door constructeur",
                       True, "€2.000–4.000", "Vraag offerte aan", "request_quote"),
        ChecklistItem("opt-06", "onderzoek", "onderzoeken", "Funderingsonderzoek",
                       "Sondering/funderingsinspectie — kan de fundering extra gewicht dragen?",
                       True, "€3.000–8.000", "Vraag offerte aan", "request_quote"),
        ChecklistItem("opt-07", "onderzoek", "onderzoeken", "Asbestinventarisatie",
                       "Verplicht bij bouwjaar vóór 1994 als dakconstructie geraakt wordt",
                       True, "€1.500–3.000", "Vraag offerte aan", "request_quote"),
        ChecklistItem("opt-08", "onderzoek", "onderzoeken", "Daglicht- en bezonningsstudie",
                       "Toets of optopping geen onacceptabele schaduw veroorzaakt bij buren",
                       False, "€500–1.500"),
        # vergunningen
        ChecklistItem("opt-09", "vergunning", "vergunningen", "Bestemmingsplan check",
                       "Maximale bouwhoogte en bouwvlak controleren in het omgevingsplan",
                       True, None, "Bekijk Omgevingsloket", "external_link"),
        ChecklistItem("opt-10", "vergunning", "vergunningen", "Welstandstoets",
                       "Ontwerp moet voldoen aan welstandsnota gemeente — vooroverleg mogelijk",
                       True),
        ChecklistItem("opt-11", "vergunning", "vergunningen", "Omgevingsvergunning bouwen",
                       "Formele aanvraag via het Omgevingsloket online",
                       True, "€500–2.000 leges", "Bekijk Omgevingsloket", "external_link"),
        ChecklistItem("opt-12", "vergunning", "vergunningen", "Bouwveiligheidsplan",
                       "Bij impact op naastgelegen panden: bouwveiligheidsplan vereist",
                       False),
        # participatie
        ChecklistItem("opt-13", "overig", "participatie", "Buren informeren",
                       "Vroegtijdig buren informeren over plannen — voorkomt bezwaren",
                       False),
        ChecklistItem("opt-14", "overig", "participatie", "Participatieverslag opstellen",
                       "Omgevingswet vereist participatie-verslag bij vergunningaanvraag",
                       True, None, "Genereer document", "generate_document"),
        ChecklistItem("opt-15", "overig", "participatie", "VvE-toestemming (indien VvE)",
                       "Bij appartementsrecht: toestemming van de VvE nodig voor dakopbouw",
                       True),
        # nazorg
        ChecklistItem("opt-16", "overig", "nazorg", "Parkeeroplossing",
                       "Extra woningen = extra parkeervraag. Check parkeernormen gemeente",
                       False),
        ChecklistItem("opt-17", "overig", "nazorg", "Energielabel nieuwe woning",
                       "Nieuw gecreëerde woning heeft eigen energielabel nodig",
                       True, "€200–400"),
        ChecklistItem("opt-18", "overig", "nazorg", "Kwaliteitsborger (Wkb)",
                       "Verplicht voor gevolgklasse 1 — onafhankelijk toezicht tijdens bouw",
                       True, "€3.000–6.000"),
        # informatiebronnen
        ChecklistItem("opt-19", "overig", "informatiebronnen", "Handreiking optoppen (BZK)",
                       "Rijksoverheid handleiding voor optopping als verdichtingsstrategie",
                       False, None, "Bekijk handreiking", "external_link"),
        ChecklistItem("opt-20", "overig", "informatiebronnen", "Omgevingsloket",
                       "Centrale plek voor vergunningcheck en aanvraag",
                       False, None, "Naar Omgevingsloket", "external_link"),
    ],
    # ── SPLITSEN ──────────────────────────────────────────────
    "splitsen": [
        # voorbereiding
        ChecklistItem("spl-01", "document", "voorbereiding", "Splitsingscheck gemeente",
                       "Controleer of de gemeente een splitsingsvergunning of -verbod hanteert",
                       True, None, "Bekijk huisvestingsverordening", "external_link"),
        ChecklistItem("spl-02", "document", "voorbereiding", "Kadastrale gegevens opvragen",
                       "Eigendomssituatie en perceelgrenzen verifiëren via Kadaster",
                       True, None, "Bekijk Kadaster", "external_link"),
        ChecklistItem("spl-03", "document", "voorbereiding", "Splitsingstekening",
                       "Plattegrond met nieuwe indeling door architect",
                       True, "€1.500–3.000", "Genereer document", "generate_document"),
        ChecklistItem("spl-04", "document", "voorbereiding", "Technische omschrijving",
                       "Beschrijving van de bouwkundige staat en voorzieningen per eenheid",
                       True, None, "Genereer document", "generate_document"),
        # onderzoeken
        ChecklistItem("spl-05", "onderzoek", "onderzoeken", "Geluidsmeting",
                       "Geluidisolatie tussen wooneenheden moet voldoen aan Bouwbesluit",
                       True, "€500–1.500", "Vraag offerte aan", "request_quote"),
        ChecklistItem("spl-06", "onderzoek", "onderzoeken", "Brandveiligheidsadvies",
                       "Brandcompartimentering, vluchtwegen, rookmelders per eenheid",
                       True, "€800–2.000", "Vraag offerte aan", "request_quote"),
        ChecklistItem("spl-07", "onderzoek", "onderzoeken", "Ventilatietoets",
                       "Elke eenheid moet voldoende ventilatie hebben conform Bouwbesluit",
                       True, "€300–800"),
        ChecklistItem("spl-08", "onderzoek", "onderzoeken", "Daglichttoets",
                       "Minimum daglichttoetreding per verblijfsruimte controleren",
                       True, "€300–600"),
        # vergunningen
        ChecklistItem("spl-09", "vergunning", "vergunningen", "Huisvestingsverordening checken",
                       "Splitsingsvergunning nodig? Minimum oppervlakte per eenheid?",
                       True),
        ChecklistItem("spl-10", "vergunning", "vergunningen", "Omgevingsvergunning",
                       "Vergunning voor bouwen + eventuele splitsingsvergunning",
                       True),
        ChecklistItem("spl-11", "vergunning", "vergunningen", "Bestemmingsplan check",
                       "Controleer of woningsplitsing past binnen het omgevingsplan",
                       True, None, "Bekijk Omgevingsloket", "external_link"),
        ChecklistItem("spl-12", "vergunning", "vergunningen", "Splitsingsakte notaris",
                       "Notariële akte voor kadastraal splitsen (appartementsrecht)",
                       True, "€1.500–3.000"),
        # participatie
        ChecklistItem("spl-13", "overig", "participatie", "Bewoners/huurders informeren",
                       "Zittende huurders vroegtijdig informeren over splitsingsplannen",
                       True),
        ChecklistItem("spl-14", "overig", "participatie", "Participatieverslag opstellen",
                       "Omgevingswet vereist verslag van participatie bij vergunningaanvraag",
                       True, None, "Genereer document", "generate_document"),
        # nazorg
        ChecklistItem("spl-15", "overig", "nazorg", "VvE oprichten",
                       "Vereniging van Eigenaren verplicht bij splitsing in appartementsrechten",
                       True),
        ChecklistItem("spl-16", "overig", "nazorg", "Energielabel per eenheid",
                       "Elk zelfstandig woongedeelte heeft eigen energielabel nodig",
                       True, "€200–400/eenheid"),
        ChecklistItem("spl-17", "overig", "nazorg", "Huisnummerbesluit aanvragen",
                       "Nieuwe eenheden hebben eigen huisnummers nodig via gemeente",
                       True),
        ChecklistItem("spl-18", "overig", "nazorg", "BAG-melding nieuwe adressen",
                       "Nieuwe adressen melden bij Basisregistratie Adressen en Gebouwen",
                       True),
        # informatiebronnen
        ChecklistItem("spl-19", "overig", "informatiebronnen", "Rijksoverheid — splitsen",
                       "Informatie over regels rond woningsplitsing",
                       False, None, "Bekijk info", "external_link"),
        ChecklistItem("spl-20", "overig", "informatiebronnen", "Omgevingsloket",
                       "Vergunningcheck en aanvraag via het Omgevingsloket",
                       False, None, "Naar Omgevingsloket", "external_link"),
    ],
    # ── TRANSFORMATIE ─────────────────────────────────────────
    "transformatie": [
        # voorbereiding
        ChecklistItem("tra-01", "document", "voorbereiding", "Haalbaarheidsanalyse",
                       "Technische + financiële haalbaarheid van transformatie naar wonen",
                       True, "€5.000–15.000"),
        ChecklistItem("tra-02", "document", "voorbereiding", "Kadastrale gegevens opvragen",
                       "Eigendomssituatie, bestemming en erfdienstbaarheden verifiëren",
                       True, None, "Bekijk Kadaster", "external_link"),
        ChecklistItem("tra-03", "document", "voorbereiding", "Transformatieplan architect",
                       "Ontwerp voor nieuwe woonfunctie incl. plattegronden en gevels",
                       True, "€5.000–15.000", "Genereer document", "generate_document"),
        ChecklistItem("tra-04", "document", "voorbereiding", "Vooroverleg gemeente",
                       "Informeel vooroverleg — toets haalbaarheid vóór formele aanvraag",
                       False, "€300–500"),
        # onderzoeken
        ChecklistItem("tra-05", "onderzoek", "onderzoeken", "Bouwkundige inspectie",
                       "Staat van de constructie, dak, gevels, installaties beoordelen",
                       True, "€2.000–5.000", "Vraag offerte aan", "request_quote"),
        ChecklistItem("tra-06", "onderzoek", "onderzoeken", "Bodemonderzoek",
                       "Vooral bij voormalig industrieel/commercieel gebruik — NEN 5740",
                       True, "€2.000–5.000", "Vraag offerte aan", "request_quote"),
        ChecklistItem("tra-07", "onderzoek", "onderzoeken", "Asbestinventarisatie",
                       "Verplicht bij bouwjaar vóór 1994 — type A inventarisatie",
                       True, "€1.500–3.000", "Vraag offerte aan", "request_quote"),
        ChecklistItem("tra-08", "onderzoek", "onderzoeken", "Geluidsonderzoek",
                       "Toets geluidbelasting op gevels — Wet geluidhinder / Omgevingswet",
                       True, "€1.500–3.000"),
        ChecklistItem("tra-09", "onderzoek", "onderzoeken", "Ecologisch onderzoek",
                       "Quickscan flora & fauna — vleermuizen, vogels bij leegstaande panden",
                       True, "€1.000–3.000"),
        # vergunningen
        ChecklistItem("tra-10", "vergunning", "vergunningen", "Bestemmingsplan wijziging / BOPA",
                       "Wijziging van niet-wonen naar wonen — BOPA of planwijziging",
                       True),
        ChecklistItem("tra-11", "vergunning", "vergunningen", "Omgevingsvergunning bouwen",
                       "Vergunning voor verbouw naar woonbestemming via Omgevingsloket",
                       True, None, "Bekijk Omgevingsloket", "external_link"),
        ChecklistItem("tra-12", "vergunning", "vergunningen", "Milieuvergunning/melding",
                       "Bij voormalig bedrijfspand: milieuaspecten afhandelen",
                       False),
        ChecklistItem("tra-13", "vergunning", "vergunningen", "Monumentenvergunning",
                       "Extra vergunning bij rijks- of gemeentelijk monument",
                       False),
        # participatie
        ChecklistItem("tra-14", "overig", "participatie", "Omgevingsdialoog organiseren",
                       "Omgevingswet vereist participatie bij grotere ontwikkelingen",
                       True),
        ChecklistItem("tra-15", "overig", "participatie", "Participatieverslag opstellen",
                       "Vastlegging van participatieproces voor bij vergunningaanvraag",
                       True, None, "Genereer document", "generate_document"),
        # nazorg
        ChecklistItem("tra-16", "overig", "nazorg", "Bouwtoezicht / kwaliteitsborger",
                       "Onafhankelijk toezicht op de bouw conform Wkb",
                       True, "€3.000–8.000"),
        ChecklistItem("tra-17", "overig", "nazorg", "Energielabel aanvragen",
                       "Nieuwe woningen hebben energielabel nodig vóór oplevering",
                       True, "€200–400"),
        ChecklistItem("tra-18", "overig", "nazorg", "BAG-melding functiewijziging",
                       "Nieuwe woonfunctie melden bij Basisregistratie Adressen en Gebouwen",
                       True),
        # informatiebronnen
        ChecklistItem("tra-19", "overig", "informatiebronnen", "Handreiking transformatie (BZK)",
                       "Rijksoverheid handleiding voor kantoortransformatie naar wonen",
                       False, None, "Bekijk handreiking", "external_link"),
        ChecklistItem("tra-20", "overig", "informatiebronnen", "Omgevingsloket",
                       "Vergunningcheck en aanvraag via het Omgevingsloket",
                       False, None, "Naar Omgevingsloket", "external_link"),
    ],
    # ── NIEUWBOUW ─────────────────────────────────────────────
    "nieuwbouw": [
        # voorbereiding
        ChecklistItem("nbw-01", "document", "voorbereiding", "Stedenbouwkundig plan",
                       "Massa-studie en inpassing in de omgeving",
                       True, "€5.000–20.000", "Genereer document", "generate_document"),
        ChecklistItem("nbw-02", "document", "voorbereiding", "Architectonisch ontwerp",
                       "Voorlopig en definitief ontwerp (VO/DO) door architect",
                       True, "€10.000–50.000", "Genereer document", "generate_document"),
        ChecklistItem("nbw-03", "document", "voorbereiding", "Kadastrale gegevens opvragen",
                       "Eigendomssituatie, perceelgrenzen en bestemming verifiëren",
                       True, None, "Bekijk Kadaster", "external_link"),
        ChecklistItem("nbw-04", "document", "voorbereiding", "Constructieberekening",
                       "Constructief ontwerp en berekeningen door constructeur",
                       True, "€3.000–10.000"),
        # onderzoeken
        ChecklistItem("nbw-05", "onderzoek", "onderzoeken", "Geotechnisch grondonderzoek",
                       "Sondering voor funderingsontwerp — draagkracht grond bepalen",
                       True, "€2.000–4.000", "Vraag offerte aan", "request_quote"),
        ChecklistItem("nbw-06", "onderzoek", "onderzoeken", "Bodemonderzoek",
                       "NEN 5740 verkennend bodemonderzoek — verplicht bij bouwvergunning",
                       True, "€2.000–5.000", "Vraag offerte aan", "request_quote"),
        ChecklistItem("nbw-07", "onderzoek", "onderzoeken", "Ecologisch onderzoek",
                       "Flora & fauna quickscan — beschermde soorten op bouwlocatie?",
                       True, "€1.000–3.000", "Vraag offerte aan", "request_quote"),
        ChecklistItem("nbw-08", "onderzoek", "onderzoeken", "Archeologisch onderzoek",
                       "Bureauonderzoek archeologie — bij ligging in verwachtingszone",
                       False, "€1.500–4.000"),
        ChecklistItem("nbw-09", "onderzoek", "onderzoeken", "Watertoets",
                       "Toets waterbeheerder — afvoer, berging, grondwater",
                       True, "€500–1.500"),
        # vergunningen
        ChecklistItem("nbw-10", "vergunning", "vergunningen", "Bestemmingsplan check",
                       "Past nieuwbouw binnen huidige bestemming en omgevingsplan?",
                       True, None, "Bekijk Omgevingsloket", "external_link"),
        ChecklistItem("nbw-11", "vergunning", "vergunningen", "Omgevingsvergunning bouwen",
                       "Volledige vergunningaanvraag via het Omgevingsloket",
                       True, None, "Bekijk Omgevingsloket", "external_link"),
        ChecklistItem("nbw-12", "vergunning", "vergunningen", "Sloopmelding",
                       "4 weken voor start sloop indienen. Asbestinventarisatie bijvoegen.",
                       True),
        ChecklistItem("nbw-13", "vergunning", "vergunningen", "Welstandstoets",
                       "Ontwerp moet voldoen aan gemeentelijk welstandsbeleid",
                       True),
        # participatie
        ChecklistItem("nbw-14", "overig", "participatie", "Participatietraject",
                       "Omgevingswet: initiatiefnemer moet participatie organiseren",
                       True),
        ChecklistItem("nbw-15", "overig", "participatie", "Participatieverslag opstellen",
                       "Vastlegging participatieresultaten voor bij vergunningaanvraag",
                       True, None, "Genereer document", "generate_document"),
        # nazorg
        ChecklistItem("nbw-16", "overig", "nazorg", "Kwaliteitsborger (Wkb)",
                       "Verplicht voor gevolgklasse 1 nieuwbouw — onafhankelijk bouwtoezicht",
                       True, "€3.000–8.000"),
        ChecklistItem("nbw-17", "overig", "nazorg", "Energielabel aanvragen",
                       "Energielabel vóór oplevering — BENG-eisen voor nieuwbouw",
                       True, "€200–400"),
        ChecklistItem("nbw-18", "overig", "nazorg", "Nutsvoorzieningen aanvragen",
                       "Elektra, water, gas/warmte aansluitingen regelen bij netbeheerders",
                       True),
        ChecklistItem("nbw-19", "overig", "nazorg", "BAG-melding nieuw adres",
                       "Nieuw adres melden bij Basisregistratie Adressen en Gebouwen",
                       True),
        # informatiebronnen
        ChecklistItem("nbw-20", "overig", "informatiebronnen", "Omgevingsloket",
                       "Vergunningcheck en aanvraag via het Omgevingsloket",
                       False, None, "Naar Omgevingsloket", "external_link"),
        ChecklistItem("nbw-21", "overig", "informatiebronnen", "Bouwbesluit Online",
                       "Technische voorschriften nieuwbouw — energieprestatie, brandveiligheid",
                       False, None, "Bekijk Bouwbesluit", "external_link"),
    ],
}


def get_checklist(use_case: str) -> list[ChecklistItem]:
    """Get checklist for a development use case."""
    return CHECKLISTS.get(use_case, [])


def get_all_checklists() -> dict[str, list[dict]]:
    """Get all checklists as serializable dicts."""
    from dataclasses import asdict
    return {
        uc: [asdict(item) for item in items]
        for uc, items in CHECKLISTS.items()
    }
