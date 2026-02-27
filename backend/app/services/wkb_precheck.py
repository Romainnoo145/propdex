"""Rule-based Wkb startdossier precheck (Layer A + optional Layer B refinement)."""

from __future__ import annotations

from app.schemas.address import BuildingData
from app.schemas.monument import MonumentStatus
from app.schemas.property import (
    BuildabilityDelta,
    WkbLayerBResult,
    WkbPrecheck,
    WkbRefinementInput,
    WkbRuleHit,
)
from app.schemas.zoning import ZoningData

_ACTIVE_BOUW_STATUS = {
    "bouw gestart",
    "bouwvergunning verleend",
    "verbouwing pand",
    "sloopvergunning verleend",
}

_DEV_FRIENDLY_BESTEMMING_TERMS = (
    "woon",
    "gemengd",
    "bedrijf",
    "kantoor",
    "detailhandel",
)


def _is_layer_b_provided(refinement_input: WkbRefinementInput | None) -> bool:
    if refinement_input is None:
        return False
    return (
        refinement_input.constructieve_wijziging is not None
        or refinement_input.uitbreiding_m2 is not None
        or refinement_input.functiewijziging is not None
    )


def _classify_status(score: int, has_context: bool) -> str:
    if not has_context:
        return "not_applicable"
    if score >= 3:
        return "likely_required"
    if score <= -1:
        return "likely_not_required"
    return "uncertain"


def _degrade_confidence(level: str) -> str:
    if level == "high":
        return "medium"
    if level == "medium":
        return "low"
    return "low"


def _upgrade_confidence(level: str) -> str:
    if level == "low":
        return "medium"
    if level == "medium":
        return "high"
    return "high"


def _derive_confidence(
    *,
    rule_hits: list[WkbRuleHit],
    missing_inputs: list[str],
    layer_b_applied: bool,
    provided_layer_b_fields: int,
) -> str:
    signal_hits = [hit for hit in rule_hits if hit.impact in {"increase", "decrease"}]
    if len(signal_hits) >= 3:
        confidence = "high"
    elif len(signal_hits) >= 1:
        confidence = "medium"
    else:
        confidence = "low"

    if len(missing_inputs) >= 4:
        confidence = _degrade_confidence(confidence)
    elif len(missing_inputs) >= 2:
        confidence = _degrade_confidence(confidence)

    if layer_b_applied and provided_layer_b_fields >= 2:
        confidence = _upgrade_confidence(confidence)

    return confidence


def _required_documents(status: str, is_monument: bool, has_constructive_change: bool) -> list[str]:
    if status == "not_applicable":
        return []

    docs: list[str] = [
        "Projectomschrijving (beoogde ingreep en scope)",
        "Bouwkundige tekeningen bestaande en nieuwe situatie",
    ]
    if status in {"likely_required", "uncertain"} or has_constructive_change:
        docs.append("Constructieve onderbouwing / berekening (indien dragende delen wijzigen)")
        docs.append("Indicatieve risicobeoordeling en borgingsplan (Wkb)")
    if is_monument:
        docs.append("Monumentenonderbouwing en afstemming bevoegd gezag")
    if status == "likely_not_required":
        docs.append("Controle gemeente/kwaliteitsborger op uitzonderingen")
    return list(dict.fromkeys(docs))


def evaluate_wkb_precheck(
    *,
    building: BuildingData | None,
    monuments: MonumentStatus | None,
    zoning_data: ZoningData | None,
    buildability_delta: BuildabilityDelta | None,
    refinement_input: WkbRefinementInput | None = None,
) -> WkbPrecheck:
    """
    Evaluate Wkb precheck from available dossier context.

    Layer A is always evaluated from existing report data.
    Layer B is optional and can refine status/confidence when input is provided.
    """
    rule_hits: list[WkbRuleHit] = []
    score = 0
    missing_inputs = {
        "project_scope",
        "constructieve_wijziging",
        "uitbreiding_m2",
        "functiewijziging",
    }

    has_context = any(
        [
            building is not None,
            monuments is not None,
            zoning_data is not None,
            buildability_delta is not None,
        ]
    )

    if not has_context:
        return WkbPrecheck(
            status="not_applicable",
            confidence="low",
            triggered_rules=[
                WkbRuleHit(
                    code="NO_CONTEXT",
                    title="Onvoldoende dossiercontext",
                    impact="uncertainty",
                    reason="Geen bruikbare BAG/plan/monument/bouwruimte data aanwezig.",
                )
            ],
            missing_inputs=[
                "bag_building_status",
                "zoning_primary_bestemming",
                "buildability_delta",
            ],
            required_documents=[],
        )

    if building is not None:
        status_label = (building.status or "").strip().lower()
        if status_label in _ACTIVE_BOUW_STATUS:
            score += 2
            rule_hits.append(
                WkbRuleHit(
                    code="ACTIVE_BOUWSTATUS",
                    title="Actieve bouwstatus",
                    impact="increase",
                    reason="BAG-status wijst op lopende bouw/verbouwing of recente vergunning.",
                )
            )
        elif status_label == "pand in gebruik":
            score -= 1
            rule_hits.append(
                WkbRuleHit(
                    code="IN_USE_STATUS",
                    title="Pand in gebruik",
                    impact="decrease",
                    reason="Geen directe indicator van lopende bouwactiviteit.",
                )
            )
        else:
            rule_hits.append(
                WkbRuleHit(
                    code="STATUS_UNCERTAIN",
                    title="Onzekere BAG-status",
                    impact="uncertainty",
                    reason="BAG-status geeft geen eenduidige aanwijzing over Wkb-plicht.",
                )
            )
    else:
        missing_inputs.add("bag_building_status")

    if monuments is not None and monuments.is_monument:
        score += 1
        rule_hits.append(
            WkbRuleHit(
                code="MONUMENT_CONTEXT",
                title="Monumentale context",
                impact="increase",
                reason="Monumentale status verhoogt toetsingscomplexiteit en dossierplicht.",
            )
        )
    elif monuments is None:
        missing_inputs.add("monument_status")

    if zoning_data is not None:
        bestemming = (zoning_data.primary_bestemming or "").lower()
        if any(term in bestemming for term in _DEV_FRIENDLY_BESTEMMING_TERMS):
            score += 1
            rule_hits.append(
                WkbRuleHit(
                    code="DEV_FRIENDLY_BESTEMMING",
                    title="Bestemming ondersteunt ontwikkeling",
                    impact="increase",
                    reason="Bestemming past bij veelvoorkomende ontwikkel- en transformatiescenario's.",
                )
            )
        elif bestemming:
            score -= 1
            rule_hits.append(
                WkbRuleHit(
                    code="RESTRICTIVE_BESTEMMING",
                    title="Bestemming beperkt ontwikkeling",
                    impact="decrease",
                    reason="Primaire bestemming lijkt minder geschikt voor standaard ontwikkelscenario's.",
                )
            )

        if zoning_data.fallback_used:
            rule_hits.append(
                WkbRuleHit(
                    code="PLAN_FALLBACK",
                    title="Planregels via fallback",
                    impact="uncertainty",
                    reason="Plancontext is deels afgeleid; handmatige validatie blijft nodig.",
                )
            )
    else:
        missing_inputs.add("zoning_primary_bestemming")

    if buildability_delta is not None:
        remaining = buildability_delta.remaining_buildable_area_m2
        if remaining is None:
            rule_hits.append(
                WkbRuleHit(
                    code="DELTA_MISSING_LIMIT",
                    title="Bouwruimte deels onbekend",
                    impact="uncertainty",
                    reason="Bouwruimte-delta mist dimensie-inputs voor volledige zekerheidsinschatting.",
                )
            )
        elif remaining >= 100:
            score += 2
            rule_hits.append(
                WkbRuleHit(
                    code="LARGE_REMAINING_CAPACITY",
                    title="Grote resterende bouwruimte",
                    impact="increase",
                    reason="Significante resterende bouwruimte maakt Wkb-traject waarschijnlijker.",
                )
            )
        elif remaining >= 25:
            score += 1
            rule_hits.append(
                WkbRuleHit(
                    code="MEDIUM_REMAINING_CAPACITY",
                    title="Resterende bouwruimte aanwezig",
                    impact="increase",
                    reason="Er is bruikbare resterende bouwruimte, mogelijk met Wkb-impact.",
                )
            )
        elif remaining < 0:
            score -= 1
            rule_hits.append(
                WkbRuleHit(
                    code="NO_REMAINING_CAPACITY",
                    title="Geen resterende bouwruimte",
                    impact="decrease",
                    reason="Delta suggereert weinig ruimte voor uitbreiding binnen huidige limieten.",
                )
            )

        if buildability_delta.confidence == "low":
            rule_hits.append(
                WkbRuleHit(
                    code="DELTA_LOW_CONFIDENCE",
                    title="Lage delta-confidence",
                    impact="uncertainty",
                    reason="Bouwruimte-delta is berekend met beperkte inputdekking.",
                )
            )
    else:
        missing_inputs.add("buildability_delta")

    layer_b_applied = _is_layer_b_provided(refinement_input)
    provided_layer_b_fields = 0
    layer_b_notes: list[str] = []
    has_constructive_change = False

    if layer_b_applied and refinement_input is not None:
        if refinement_input.constructieve_wijziging is not None:
            provided_layer_b_fields += 1
            missing_inputs.discard("constructieve_wijziging")
            has_constructive_change = bool(refinement_input.constructieve_wijziging)
            if refinement_input.constructieve_wijziging:
                score += 3
                layer_b_notes.append("Constructieve wijziging verhoogt Wkb-kans sterk.")
                rule_hits.append(
                    WkbRuleHit(
                        code="LAYER_B_CONSTRUCTIVE_CHANGE",
                        title="Constructieve wijziging opgegeven",
                        impact="increase",
                        reason="Dragende aanpassing is vaak Wkb-relevant.",
                    )
                )
            else:
                score -= 1
                layer_b_notes.append("Geen constructieve wijziging verlaagt Wkb-kans.")
                rule_hits.append(
                    WkbRuleHit(
                        code="LAYER_B_NO_CONSTRUCTIVE_CHANGE",
                        title="Geen constructieve wijziging",
                        impact="decrease",
                        reason="Minder kans op Wkb-relevante technische toetsing.",
                    )
                )

        if refinement_input.uitbreiding_m2 is not None:
            provided_layer_b_fields += 1
            missing_inputs.discard("uitbreiding_m2")
            if refinement_input.uitbreiding_m2 >= 50:
                score += 2
                layer_b_notes.append("Grote uitbreiding opgegeven (>= 50 m²).")
            elif refinement_input.uitbreiding_m2 > 0:
                score += 1
                layer_b_notes.append("Uitbreiding opgegeven (> 0 m²).")
            else:
                score -= 1
                layer_b_notes.append("Geen uitbreiding opgegeven.")
            rule_hits.append(
                WkbRuleHit(
                    code="LAYER_B_EXTENSION",
                    title="Uitbreidingsomvang",
                    impact="increase" if refinement_input.uitbreiding_m2 > 0 else "decrease",
                    reason=(
                        f"Opgegeven uitbreiding: {refinement_input.uitbreiding_m2:.1f} m²."
                    ),
                )
            )

        if refinement_input.functiewijziging is not None:
            provided_layer_b_fields += 1
            missing_inputs.discard("functiewijziging")
            if refinement_input.functiewijziging:
                score += 2
                layer_b_notes.append("Functiewijziging verhoogt toetsingsdruk.")
                rule_hits.append(
                    WkbRuleHit(
                        code="LAYER_B_FUNCTION_CHANGE",
                        title="Functiewijziging opgegeven",
                        impact="increase",
                        reason="Functiewijziging vraagt vaak aanvullende onderbouwing.",
                    )
                )
            else:
                rule_hits.append(
                    WkbRuleHit(
                        code="LAYER_B_NO_FUNCTION_CHANGE",
                        title="Geen functiewijziging",
                        impact="decrease",
                        reason="Geen functiewijziging beperkt aanvullende eisen.",
                    )
                )

    status = _classify_status(score, has_context=has_context)
    confidence = _derive_confidence(
        rule_hits=rule_hits,
        missing_inputs=sorted(missing_inputs),
        layer_b_applied=layer_b_applied,
        provided_layer_b_fields=provided_layer_b_fields,
    )
    docs = _required_documents(
        status=status,
        is_monument=bool(monuments and monuments.is_monument),
        has_constructive_change=has_constructive_change,
    )

    effect_note = None
    if layer_b_applied:
        effect_note = " ".join(layer_b_notes) if layer_b_notes else "Layer B toegepast."

    return WkbPrecheck(
        status=status,  # type: ignore[arg-type]
        confidence=confidence,  # type: ignore[arg-type]
        triggered_rules=rule_hits,
        missing_inputs=sorted(missing_inputs),
        required_documents=docs,
        layer_b=WkbLayerBResult(
            applied=layer_b_applied,
            input=refinement_input if layer_b_applied else None,
            effect_note=effect_note,
        ),
    )
