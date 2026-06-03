"""M052/S04 — brief-context: perceel-data + project_type→use_case-mapping."""
from typing import Any

# parcel_project_types levert deze project_type-waarden; map naar de
# use_case-takken van EIGENAAR_BRIEF_TEMPLATE (optoppen/splitsen/transformatie/nieuwbouw).
_PROJECT_TYPE_TO_USE_CASE: dict[str, str] = {
    "optoppen": "optoppen",
    "splitsen": "splitsen",
    "transformatie_wonen": "transformatie",
    "commercieel_naar_wonen": "transformatie",
    "nieuwbouw_wonen": "nieuwbouw",
}


def project_type_to_use_case(project_type: str | None) -> str | None:
    """Map een parcel project_type naar de template-use_case; None bij 'onbepaald'/onbekend."""
    if not project_type:
        return None
    return _PROJECT_TYPE_TO_USE_CASE.get(project_type)


def build_brief_parcel_data(
    *,
    address: str | None,
    gemeente_naam: str | None,
    overall_score: float | None,
    use_case: str | None,
) -> dict[str, Any]:
    """Bouw de parcel_data-dict die document_generator.generate_document verwacht."""
    return {
        "address": address or "Adres onbekend",
        "gemeente_naam": gemeente_naam or "",
        "scores": {"overall": overall_score} if overall_score is not None else {},
        # use_case wordt via user_context doorgegeven (zie brief_router), niet hier.
    }
