"""Vergunning preparation checklists per development use case.

Static templates — no DB, no AI. Returns a checklist of required
documents, checks, and steps for each development strategy.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class ChecklistItem:
    """A single checklist item."""

    id: str
    category: str  # "document", "onderzoek", "vergunning", "overig"
    title: str
    description: str
    required: bool = True  # false = recommended but not mandatory
    estimated_cost: str | None = None


CHECKLISTS: dict[str, list[ChecklistItem]] = {
    "optoppen": [
        ChecklistItem("opt-01", "onderzoek", "Constructief rapport", "Beoordeling draagkracht bestaande constructie door constructeur", True, "€2.000-4.000"),
        ChecklistItem("opt-02", "onderzoek", "Funderingsonderzoek", "Sondering/funderingsinspectie — kan de fundering extra gewicht dragen?", True, "€3.000-8.000"),
        ChecklistItem("opt-03", "document", "Bouwtekeningen", "Bestaande + nieuwe situatie tekeningen door architect", True, "€3.000-6.000"),
        ChecklistItem("opt-04", "onderzoek", "Asbestinventarisatie", "Verplicht bij bouwjaar vóór 1994 als dakconstructie geraakt wordt", True, "€1.500-3.000"),
        ChecklistItem("opt-05", "vergunning", "Omgevingsvergunning bouwen", "Aanvraag via Omgevingsloket", True, "€500-2.000 leges"),
        ChecklistItem("opt-06", "vergunning", "Welstandstoets", "Ontwerp moet voldoen aan welstandsnota gemeente", True),
        ChecklistItem("opt-07", "vergunning", "Bestemmingsplan check", "Maximale bouwhoogte en bouwvlak controleren", True),
        ChecklistItem("opt-08", "overig", "Buren informeren", "Vroegtijdig buren informeren over plannen — voorkomt bezwaren", False),
        ChecklistItem("opt-09", "overig", "Parkeeroplossing", "Extra woningen = extra parkeervraag. Check parkeernormen gemeente", False),
    ],
    "splitsen": [
        ChecklistItem("spl-01", "vergunning", "Huisvestingsverordening checken", "Splitsingsvergunning nodig? Minimum oppervlakte per eenheid?", True),
        ChecklistItem("spl-02", "document", "Splitsingstekening", "Plattegrond met nieuwe indeling door architect", True, "€1.500-3.000"),
        ChecklistItem("spl-03", "onderzoek", "Geluidsmeting", "Geluidisolatie tussen wooneenheden moet voldoen aan Bouwbesluit", True, "€500-1.500"),
        ChecklistItem("spl-04", "onderzoek", "Brandveiligheidsadvies", "Brandcompartimentering, vluchtwegen, rookmelders", True, "€800-2.000"),
        ChecklistItem("spl-05", "vergunning", "Omgevingsvergunning", "Vergunning voor bouwen + splitsingsvergunning (indien vereist)", True),
        ChecklistItem("spl-06", "document", "Splitsingsakte notaris", "Notariële akte voor kadastraal splitsen (appartements­recht)", True, "€1.500-3.000"),
        ChecklistItem("spl-07", "overig", "VvE oprichten", "Vereniging van Eigenaren verplicht bij splitsing in appartementsrechten", True),
        ChecklistItem("spl-08", "overig", "Energielabel per eenheid", "Elk zelfstandig woongedeelte heeft eigen energielabel nodig", True, "€200-400/eenheid"),
    ],
    "transformatie": [
        ChecklistItem("tra-01", "vergunning", "Bestemmingsplan wijziging / BOPA", "Wijziging van niet-wonen naar wonen — BOPA of bestemmingsplanwijziging", True),
        ChecklistItem("tra-02", "onderzoek", "Haalbaarheidsanalyse", "Technische + financiële haalbaarheid van transformatie", True, "€5.000-15.000"),
        ChecklistItem("tra-03", "onderzoek", "Bouwkundige inspectie", "Staat van de constructie, dak, gevels, installaties", True, "€2.000-5.000"),
        ChecklistItem("tra-04", "onderzoek", "Bodemonderzoek", "Vooral bij voormalig industrieel/commercieel gebruik", True, "€2.000-5.000"),
        ChecklistItem("tra-05", "onderzoek", "Asbestinventarisatie", "Verplicht bij bouwjaar vóór 1994", True, "€1.500-3.000"),
        ChecklistItem("tra-06", "document", "Transformatieplan architect", "Ontwerp voor nieuwe woonfunctie incl. plattegronden", True, "€5.000-15.000"),
        ChecklistItem("tra-07", "vergunning", "Omgevingsvergunning bouwen", "Vergunning voor verbouw naar woonbestemming", True),
        ChecklistItem("tra-08", "overig", "Vooroverleg gemeente", "Informeel vooroverleg — toets haalbaarheid vóór formele aanvraag", False, "€300-500"),
        ChecklistItem("tra-09", "overig", "Buurt/participatie", "Omgevingswet vereist participatie bij grotere ontwikkelingen", False),
    ],
    "nieuwbouw": [
        ChecklistItem("nbw-01", "onderzoek", "Geotechnisch grondonderzoek", "Sondering voor funderingsontwerp", True, "€2.000-4.000"),
        ChecklistItem("nbw-02", "onderzoek", "Bodemonderzoek", "NEN 5740 verkennend bodemonderzoek", True, "€2.000-5.000"),
        ChecklistItem("nbw-03", "onderzoek", "Ecologisch onderzoek", "Flora & fauna quickscan — beschermde soorten?", True, "€1.000-3.000"),
        ChecklistItem("nbw-04", "document", "Stedenbouwkundig plan", "Massa-studie, inpassing in omgeving", True, "€5.000-20.000"),
        ChecklistItem("nbw-05", "document", "Architectonisch ontwerp", "VO/DO door architect", True, "€10.000-50.000"),
        ChecklistItem("nbw-06", "vergunning", "Bestemmingsplan check", "Past nieuwbouw binnen huidige bestemming?", True),
        ChecklistItem("nbw-07", "vergunning", "Omgevingsvergunning bouwen", "Volledige vergunningaanvraag via Omgevingsloket", True),
        ChecklistItem("nbw-08", "vergunning", "Sloopmelding", "4 weken voor start sloop indienen. Asbestinventarisatie bijvoegen.", True),
        ChecklistItem("nbw-09", "overig", "Kwaliteitsborger (Wkb)", "Verplicht voor gevolgklasse 1 nieuwbouw sinds 2024", True, "€3.000-8.000"),
        ChecklistItem("nbw-10", "overig", "Participatietraject", "Omgevingswet: initiatiefnemer moet participatie organiseren", False),
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
