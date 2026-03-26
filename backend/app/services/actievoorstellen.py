"""Actievoorstellen engine — generates concrete next-step actions per parcel.

Uses parcel data (scores, risk factors, use-case scores, building info)
to produce prioritized, actionable recommendations per development strategy.
Deterministic — no AI calls. Pure rule-based derivation.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal


@dataclass
class ActieVoorstel:
    """A concrete action suggestion for a parcel."""

    id: str
    use_case: str | None  # optoppen/splitsen/transformatie/nieuwbouw or None for general
    priority: Literal["hoog", "gemiddeld", "laag"]
    category: str  # e.g. "onderzoek", "vergunning", "financieel", "juridisch"
    title: str
    description: str
    estimated_effort: str | None = None  # e.g. "1-2 weken", "€2.000-5.000"
    blocking: bool = False  # true if this blocks progress


def compute_actievoorstellen(
    parcel_data: dict[str, Any],
    use_case_scores: dict[str, Any] | None = None,
) -> list[ActieVoorstel]:
    """Compute actionable recommendations for a parcel.

    Args:
        parcel_data: Parcel flags dict (bouwjaar, bestemmingen, scores, etc.)
        use_case_scores: Dict of use_case_id → {score, category, ...}

    Returns:
        Sorted list of ActieVoorstel (highest priority first)
    """
    acties: list[ActieVoorstel] = []
    breakdown = parcel_data.get("score_breakdown", {})

    # ── General actions (apply to all use cases) ────────────────

    # Asbestrisico
    bouwjaar = parcel_data.get("bouwjaar")
    if isinstance(bouwjaar, (int, float)) and bouwjaar < 1994:
        acties.append(ActieVoorstel(
            id="asbest-inventarisatie",
            use_case=None,
            priority="hoog",
            category="onderzoek",
            title="Asbestinventarisatie uitvoeren",
            description=f"Bouwjaar {int(bouwjaar)} — asbesthoudende materialen mogelijk aanwezig. "
            "Type A inventarisatie verplicht voor sloop of ingrijpende verbouwing.",
            estimated_effort="€1.500-3.000",
            blocking=True,
        ))

    # Bodemonderzoek
    bodem = parcel_data.get("bodem")
    if bodem and "verdacht" in str(bodem).lower():
        acties.append(ActieVoorstel(
            id="bodemonderzoek",
            use_case=None,
            priority="hoog",
            category="onderzoek",
            title="Verkennend bodemonderzoek",
            description="Locatie is (historisch) verdacht op bodemverontreiniging. "
            "NEN 5740 onderzoek vereist voor bouwvergunning.",
            estimated_effort="€2.000-5.000",
            blocking=True,
        ))

    # Funderingsrisico
    funderingsrisico = parcel_data.get("funderingsrisico")
    if isinstance(funderingsrisico, dict) and funderingsrisico.get("risico_klasse") in ("hoog", "verhoogd"):
        acties.append(ActieVoorstel(
            id="funderingsonderzoek",
            use_case=None,
            priority="hoog",
            category="onderzoek",
            title="Funderingsonderzoek",
            description="Perceel ligt in gebied met verhoogd funderingsrisico. "
            "Constructief rapport nodig voor optoppen of zware verbouwing.",
            estimated_effort="€3.000-8.000",
            blocking=True,
        ))

    # Monument
    monument = breakdown.get("monument", {})
    if isinstance(monument, dict) and monument.get("genormaliseerde_score", 0) > 0.5:
        acties.append(ActieVoorstel(
            id="monument-overleg",
            use_case=None,
            priority="hoog",
            category="juridisch",
            title="Overleg met monumentenzorg",
            description="Pand heeft monumentstatus of ligt in beschermd stadsgezicht. "
            "Vroegtijdig overleg met gemeente monumentenzorg is essentieel.",
            estimated_effort="2-4 weken",
        ))

    # Bestemmingswijziging nodig
    bestemming_factor = breakdown.get("bestemmingswijziging", {})
    if isinstance(bestemming_factor, dict) and bestemming_factor.get("genormaliseerde_score", 0) > 0.6:
        acties.append(ActieVoorstel(
            id="bestemmingscheck",
            use_case=None,
            priority="gemiddeld",
            category="juridisch",
            title="Bestemmingsplan toetsen",
            description="Huidige bestemming wijkt mogelijk af van gewenst gebruik. "
            "Check of een bestemmingswijziging of BOPA nodig is.",
            estimated_effort="1-2 weken",
        ))

    # Vergunning succeskans laag
    vergunning_factor = breakdown.get("vergunning_succeskans", {})
    if isinstance(vergunning_factor, dict) and vergunning_factor.get("genormaliseerde_score", 0) < 0.3:
        acties.append(ActieVoorstel(
            id="vooroverleg-gemeente",
            use_case=None,
            priority="gemiddeld",
            category="vergunning",
            title="Vooroverleg met gemeente aanvragen",
            description="Vergunning succeskans is laag in deze gemeente. "
            "Vraag vooroverleg aan om haalbaarheid te toetsen vóór formele aanvraag.",
            estimated_effort="€300-500, 4-6 weken",
        ))

    # ── Use-case specific actions ──────────────────────────────

    if use_case_scores:
        # Optoppen
        uc_optoppen = use_case_scores.get("optoppen", {})
        if isinstance(uc_optoppen, dict) and uc_optoppen.get("score", 0) >= 40:
            acties.append(ActieVoorstel(
                id="optoppen-constructief",
                use_case="optoppen",
                priority="gemiddeld",
                category="onderzoek",
                title="Constructief advies optoppen",
                description="Perceel scoort goed op optoppen. Laat de draagkracht van de "
                "bestaande constructie beoordelen door een constructeur.",
                estimated_effort="€2.000-4.000",
            ))

            max_hoogte = breakdown.get("max_hoogte_bereikt", {})
            if isinstance(max_hoogte, dict) and max_hoogte.get("genormaliseerde_score", 0) < 0.5:
                acties.append(ActieVoorstel(
                    id="optoppen-hoogte-check",
                    use_case="optoppen",
                    priority="laag",
                    category="vergunning",
                    title="Maximale bouwhoogte checken",
                    description="Verifieer de maximale bouwhoogte in het bestemmingsplan. "
                    "Mogelijk ruimte voor 1-2 extra bouwlagen.",
                    estimated_effort="1 dag",
                ))

        # Splitsen
        uc_splitsen = use_case_scores.get("splitsen", {})
        if isinstance(uc_splitsen, dict) and uc_splitsen.get("score", 0) >= 40:
            acties.append(ActieVoorstel(
                id="splitsen-verordening",
                use_case="splitsen",
                priority="hoog",
                category="juridisch",
                title="Huisvestingsverordening checken",
                description="Check of de gemeente een splitsingsvergunning vereist, "
                "wat de minimum oppervlakte per eenheid is, en of er een quotum geldt.",
                estimated_effort="1-2 dagen",
            ))
            acties.append(ActieVoorstel(
                id="splitsen-plattegrond",
                use_case="splitsen",
                priority="gemiddeld",
                category="onderzoek",
                title="Indelingsvoorstel laten maken",
                description="Laat een architect een indelingsvoorstel maken "
                "voor de splitsing. Check brandveiligheid en geluidsisolatie-eisen.",
                estimated_effort="€1.500-3.000",
            ))

        # Transformatie
        uc_transformatie = use_case_scores.get("transformatie", {})
        if isinstance(uc_transformatie, dict) and uc_transformatie.get("score", 0) >= 40:
            acties.append(ActieVoorstel(
                id="transformatie-haalbaarheid",
                use_case="transformatie",
                priority="gemiddeld",
                category="onderzoek",
                title="Haalbaarheidsanalyse transformatie",
                description="Laat een haalbaarheidsanalyse uitvoeren: "
                "bouwkundige staat, bestemmingswijziging, parkeeroplossing, financiële doorrekening.",
                estimated_effort="€5.000-15.000",
            ))
            acties.append(ActieVoorstel(
                id="transformatie-bopa",
                use_case="transformatie",
                priority="gemiddeld",
                category="vergunning",
                title="BOPA-mogelijkheid verkennen",
                description="Buitenplanse omgevingsplanactiviteit (BOPA) kan sneller zijn dan "
                "bestemmingsplanwijziging. Check met gemeente of BOPA-route mogelijk is.",
                estimated_effort="2-4 weken",
            ))

        # Nieuwbouw
        uc_nieuwbouw = use_case_scores.get("nieuwbouw", {})
        if isinstance(uc_nieuwbouw, dict) and uc_nieuwbouw.get("score", 0) >= 40:
            acties.append(ActieVoorstel(
                id="nieuwbouw-grondonderzoek",
                use_case="nieuwbouw",
                priority="hoog",
                category="onderzoek",
                title="Geotechnisch grondonderzoek",
                description="Voor nieuwbouw is een sondering/grondonderzoek nodig "
                "voor het funderingsontwerp. Combineer met bodemonderzoek.",
                estimated_effort="€2.000-4.000",
            ))
            acties.append(ActieVoorstel(
                id="nieuwbouw-sloopmelding",
                use_case="nieuwbouw",
                priority="gemiddeld",
                category="vergunning",
                title="Sloopmelding voorbereiden",
                description="Bij sloop-nieuwbouw: sloopmelding indienen (4 weken voor start sloop). "
                "Asbestinventarisatie moet compleet zijn.",
                estimated_effort="€500-1.000",
            ))

    # Sort by priority
    priority_order = {"hoog": 0, "gemiddeld": 1, "laag": 2}
    acties.sort(key=lambda a: priority_order.get(a.priority, 9))

    return acties
