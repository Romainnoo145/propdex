"""Foundation risk engine: pure-function heuristic for bouwjaar x bodemtype risk.

Phase 88 (v14.0 Fysiek Risicoprofiel). Zero I/O, zero async — all functions are
synchronous derivations from pre-fetched data.

Decision matrix (from 88-RESEARCH.md):
- No building or bouwjaar -> onbekend
- bouwjaar >= 1970 -> laag (concrete piles universal post-1970)
- bouwjaar < 1970 + veen/klei -> hoog (wooden piles, paalrot risk)
- bouwjaar < 1970 + leem -> middel (variable bearing capacity)
- bouwjaar < 1970 + zand -> laag (op staal foundation)
- bouwjaar < 1970 + onbekend soil -> onbekend
"""

from __future__ import annotations

from app.schemas.address import BuildingData
from app.schemas.bodem import BodemData
from app.schemas.fysiek_risico import (
    FoundationRisk,
    FunderingsrisicogebiedData,
    FysiekRisicoProfiel,
    KCAFCostIndication,
    SoilProfile,
    rebuild_fysiek_risico_models,
)
from app.schemas.property import AsbestIndicator

# Resolve forward references now that both modules are imported
rebuild_fysiek_risico_models()

# KCAF cost benchmarks (EUR/m2)
_KCAF_RANGES: dict[str, tuple[int, int]] = {
    "hoog": (700, 1000),
    "middel": (400, 700),
}

# Risk severity for worst-of calculation
_RISK_SEVERITY: dict[str, int] = {
    "hoog": 3,
    "middel": 2,
    "laag": 1,
    "geen": 0,
}


def assess_foundation_risk(
    *,
    building: BuildingData | None,
    soil_profile: SoilProfile | None,
    funderingsrisicogebied: FunderingsrisicogebiedData | None,
) -> FoundationRisk:
    """Assess foundation risk from bouwjaar x bodemtype decision matrix.

    Returns FoundationRisk with Dutch-language derivation text.
    funderingsrisicogebied is accepted for future use but does not yet
    influence the risk score (PC6-level data is too coarse).
    """
    if building is None or building.bouwjaar is None:
        return FoundationRisk(
            risk="onbekend",
            bouwjaar=None,
            bodemtype=None,
            reden="Bouwjaar niet beschikbaar — funderingsrisico kan niet worden bepaald.",
        )

    bouwjaar = building.bouwjaar

    if bouwjaar >= 1970:
        return FoundationRisk(
            risk="laag",
            bouwjaar=bouwjaar,
            bodemtype=soil_profile.dominant_type if soil_profile else None,
            reden=(
                f"Bouwjaar {bouwjaar} — na 1970. "
                "Betonnen heipalen waren op dat moment standaard in de bouw. "
                "Risico op funderingsproblemen is zeer klein."
            ),
        )

    # Pre-1970: risk depends on soil type
    if soil_profile is None or soil_profile.dominant_type == "onbekend":
        return FoundationRisk(
            risk="onbekend",
            bouwjaar=bouwjaar,
            bodemtype=soil_profile.dominant_type if soil_profile else None,
            reden=(
                f"Bouwjaar {bouwjaar} — voor 1970, maar bodemtype is onbekend. "
                "Funderingsrisico kan niet worden bepaald zonder bodemgegevens."
            ),
            recommended_action=(
                "Laat een bodemonderzoek uitvoeren of raadpleeg de BRO Bodemkaart "
                "voor de exacte grondsoort op deze locatie."
            ),
        )

    dominant = soil_profile.dominant_type

    if dominant in ("veen", "klei"):
        label = "Veengrond" if dominant == "veen" else "Kleigrond"
        return FoundationRisk(
            risk="hoog",
            bouwjaar=bouwjaar,
            bodemtype=dominant,
            reden=(
                f"Bouwjaar {bouwjaar} (voor 1970) op {label.lower()}. "
                "Gebouwen uit deze periode zijn waarschijnlijk gefundeerd op houten palen. "
                "Op slappe grond (klei/veen) is het risico op paalrot en ongelijkmatige zetting hoog."
            ),
            recommended_action=(
                "Laat een gecertificeerd funderingsonderzoek uitvoeren (F3O). "
                "Raadpleeg het KCAF voor meer informatie over funderingsherstel."
            ),
        )
    elif dominant == "leem":
        return FoundationRisk(
            risk="middel",
            bouwjaar=bouwjaar,
            bodemtype=dominant,
            reden=(
                f"Bouwjaar {bouwjaar} (voor 1970) op leemgrond. "
                "Leemgrond heeft wisselend draagvermogen. Afhankelijk van de waterstand "
                "en grondwaterfluctuaties kan de fundering kwetsbaar zijn."
            ),
            recommended_action=(
                "Overweeg een funderingsonderzoek bij tekenen van verzakking of scheuren. "
                "Raadpleeg het KCAF voor advies."
            ),
        )
    else:
        # zand or any other known type
        return FoundationRisk(
            risk="laag",
            bouwjaar=bouwjaar,
            bodemtype=dominant,
            reden=(
                f"Bouwjaar {bouwjaar} (voor 1970) op zandgrond. "
                "Zandgrond biedt goed draagvermogen. Gebouwen zijn waarschijnlijk "
                "'op staal' gefundeerd (ondiepe fundering). Risico op paalrot is niet van toepassing."
            ),
        )


def estimate_kcaf_cost(
    *,
    risk: str,
    oppervlakte_m2: int | None,
) -> KCAFCostIndication | None:
    """Estimate KCAF reference cost range for foundation repair.

    Returns None for laag/onbekend risk or when oppervlakte is unavailable.
    """
    if risk not in _KCAF_RANGES:
        return None

    if oppervlakte_m2 is None or oppervlakte_m2 <= 0:
        return None

    low_per_m2, high_per_m2 = _KCAF_RANGES[risk]

    return KCAFCostIndication(
        low_eur=low_per_m2 * oppervlakte_m2,
        high_eur=high_per_m2 * oppervlakte_m2,
        low_per_m2=low_per_m2,
        high_per_m2=high_per_m2,
        oppervlakte_m2=oppervlakte_m2,
        disclaimer=(
            f"Indicatieve kostenrange op basis van KCAF-referentiecijfers "
            f"({low_per_m2}\u2013{high_per_m2} EUR/m\u00b2). "
            f"Oppervlakte is gebruiksoppervlakte (BAG): {oppervlakte_m2} m\u00b2. "
            "Werkelijke kosten kunnen lager of hoger uitvallen afhankelijk van "
            "funderingstype, toegankelijkheid en lokale omstandigheden. "
            "Dit is geen offerte."
        ),
    )


def _derive_overall_risk(
    *,
    foundation_risk: FoundationRisk | None,
    asbest_indicator: AsbestIndicator | None,
    bodem_data: BodemData | None,
) -> tuple[str, str]:
    """Derive worst-of overall risk across sub-components.

    Returns (risk_level, explanation).
    'onbekend' risks are excluded from worst-of (don't drag overall down).
    Bodem dossiers presence = at least middel.
    """
    risks: list[tuple[str, int]] = []

    if foundation_risk and foundation_risk.risk in _RISK_SEVERITY:
        risks.append(("Funderingsrisico", _RISK_SEVERITY[foundation_risk.risk]))

    if asbest_indicator and asbest_indicator.risk in _RISK_SEVERITY:
        risks.append(("Asbestrisico", _RISK_SEVERITY[asbest_indicator.risk]))

    # Bodem dossiers: presence = at least middel
    if bodem_data and bodem_data.dossiers:
        risks.append(("Bodemverontreiniging", _RISK_SEVERITY["middel"]))

    if not risks:
        return "onbekend", "Onvoldoende gegevens beschikbaar voor een overall risicobeoordeling."

    worst_label, worst_severity = max(risks, key=lambda x: x[1])

    # Map severity back to risk label
    severity_to_risk = {3: "hoog", 2: "middel", 1: "laag", 0: "laag"}
    overall = severity_to_risk.get(worst_severity, "onbekend")

    # Build explanation
    contributing = [label for label, sev in risks if sev == worst_severity]
    if overall == "hoog":
        explanation = (
            f"Hoog risico op basis van: {', '.join(contributing)}. "
            "Professioneel onderzoek wordt sterk aanbevolen."
        )
    elif overall == "middel":
        explanation = (
            f"Middel risico op basis van: {', '.join(contributing)}. "
            "Nader onderzoek wordt aanbevolen bij aankoop of verbouwing."
        )
    else:
        explanation = "Geen verhoogde fysieke risico's geidentificeerd op basis van beschikbare data."

    return overall, explanation


def build_fysiek_risico_profiel(
    *,
    foundation_risk: FoundationRisk | None,
    soil_profile: SoilProfile | None,
    asbest_indicator: AsbestIndicator | None,
    bodem_data: BodemData | None,
    funderingsrisicogebied: FunderingsrisicogebiedData | None,
    kcaf_cost: KCAFCostIndication | None,
) -> FysiekRisicoProfiel:
    """Compose all sub-risk data into a combined Fysiek Risicoprofiel.

    Uses worst-of logic across foundation/asbest/contamination risks.
    """
    overall_risk, overall_explanation = _derive_overall_risk(
        foundation_risk=foundation_risk,
        asbest_indicator=asbest_indicator,
        bodem_data=bodem_data,
    )

    return FysiekRisicoProfiel(
        overall_risk=overall_risk,
        overall_explanation=overall_explanation,
        foundation_risk=foundation_risk,
        soil_profile=soil_profile,
        asbest_indicator=asbest_indicator,
        bodem_data=bodem_data,
        funderingsrisicogebied=funderingsrisicogebied,
        kcaf_cost=kcaf_cost,
    )
