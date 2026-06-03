"""M052/S04 — brief-context: project_type→use_case-map + parcel-data assembler."""

from app.services.brief_context import build_brief_parcel_data, project_type_to_use_case


def test_project_type_maps_to_template_use_case():
    assert project_type_to_use_case("optoppen") == "optoppen"
    assert project_type_to_use_case("splitsen") == "splitsen"
    assert project_type_to_use_case("transformatie_wonen") == "transformatie"
    assert project_type_to_use_case("commercieel_naar_wonen") == "transformatie"
    assert project_type_to_use_case("nieuwbouw_wonen") == "nieuwbouw"
    assert project_type_to_use_case("onbepaald") is None


def test_build_parcel_data_shapes_for_generate_document():
    data = build_brief_parcel_data(
        address="Kazernestraat 12",
        gemeente_naam="Venlo",
        overall_score=83.0,
    )
    assert data["address"] == "Kazernestraat 12"
    assert data["gemeente_naam"] == "Venlo"
    assert data["scores"]["overall"] == 83.0
    # _build_template_context leest use_case uit user_context, niet parcel_data;
    # build_brief_parcel_data levert alleen de perceel-kant.
