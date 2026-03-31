"""Unit tests for checklist PDF mapping, data sufficiency, and generation.

Tests are SYNCHRONOUS (def test_*, not async def) because WeasyPrint is CPU-bound.
"""

from __future__ import annotations

import pytest

from app.reports.checklist_pdf import (
    CHECKLIST_DOC_CONFIGS,
    ChecklistDocConfig,
    _field_is_present,
    generate_checklist_pdf,
    get_available_docs,
)
from app.services.checklists import CHECKLISTS


# ---------------------------------------------------------------------------
# Test helper
# ---------------------------------------------------------------------------


def _make_checklist_report_data(**overrides) -> dict:
    """Create a complete PropertyReportResponse-compatible dict.

    Includes all fields referenced by CHECKLIST_DOC_CONFIGS.required_fields
    with sensible, non-empty defaults.
    """
    base: dict = {
        "address": {
            "straat": "Keizersgracht",
            "huisnummer": 42,
            "postcode": "1015 CS",
            "woonplaats": "Amsterdam",
        },
        "building": {
            "pand_id": "0363100012345678",
            "bouwjaar": 1890,
            "status": "Pand in gebruik",
            "oppervlakte": 150,
            "gebruiksdoel": ["woonfunctie"],
        },
        # --- Fields required by CHECKLIST_DOC_CONFIGS ---
        "cadastral_parcels": [
            {"kadastraal_nummer": "ASD01-F-1234", "oppervlakte": 200}
        ],
        "zoning": {
            "bestemmingsplan_naam": "Centrum",
            "bestemmingen": ["Gemengd - 2"],
            "max_bouwhoogte_m": 15.0,
            "primary_bestemming": "Gemengd - 2",
            "plans": [
                {
                    "plan_naam": "Centrum Amsterdam",
                    "plan_status": "vastgesteld",
                    "plan_datum": "2022-06-15",
                },
            ],
            "building_dimensions": {
                "max_hoogte": 15.0,
                "max_bouwlagen": 4,
                "max_bebouwingspercentage": 80,
                "max_goothoogte": 12.0,
            },
        },
        "energy_label": {
            "is_geregistreerd": True,
            "energieklasse": "A++",
            "registratie_datum": "2024-03-15",
            "geldig_tot": "2034-03-15",
            "is_geldig": True,
            "berekenings_type": "NTA 8800",
            "soort_opname": "Basisopname",
        },
        "wkb_precheck": {
            "status": "likely_required",
            "confidence": "medium",
            "triggered_rules": [
                {
                    "title": "Grondgebonden woning",
                    "impact": "increase",
                    "reason": "Gevolgklasse 1 bouwwerk",
                },
            ],
            "missing_inputs": ["gebruiksoppervlakte", "verbouwingstype"],
            "required_documents": ["Constructieberekening", "Borgingsplan"],
            "disclaimer": "Deze precheck is indicatief en vervangt geen juridisch advies.",
        },
        "monuments": {
            "is_rijksmonument": False,
            "is_gemeentelijk_monument": False,
            "is_monument": True,
            "consensus_status": "rijksmonument",
            "has_conflict": False,
            "conflict_note": None,
            "restrictions_summary": [
                "Vergunning vereist voor wijziging gevel",
                "Interieur deels beschermd",
            ],
            "sources": [
                {
                    "source": "RCE",
                    "is_monument": True,
                    "monument_type": "rijksmonument",
                    "monument_nummer": "12345",
                },
            ],
            "rce_detail": {
                "rijksmonumentnummer": "12345",
                "redengevende_omschrijving": "Grachtenpand uit de 17e eeuw.",
                "oorspronkelijke_functie": "Woonhuis",
                "bouwjaar_van": 1660,
                "bouwjaar_tot": 1665,
                "architect": "Philips Vingboons",
                "bouwstijl": "Hollands classicisme",
                "monument_register_url": "https://monumentenregister.cultureelerfgoed.nl/monumenten/12345",
            },
        },
        "fysiek_risico_profiel": {
            "overall_risk": "middel",
            "overall_explanation": "Combinatie van kleibodem en oud bouwjaar.",
            "foundation_risk": {
                "risk": "middel",
                "bouwjaar": 1890,
                "bodemtype": "klei",
                "reden": "Houten fundering op slappe ondergrond.",
            },
            "soil_profile": {
                "dominant_type_label": "Klei",
                "soilname": "Poldervaaggrond",
                "soilcode": "pVz",
            },
            "kcaf_cost": {
                "low_eur": 40000,
                "high_eur": 80000,
                "low_per_m2": 267,
                "high_per_m2": 533,
                "oppervlakte_m2": 150,
                "disclaimer": "Indicatieve kosten op basis van KCAF benchmark.",
            },
        },
        "bodem_data": {
            "dominant_type_label": "Klei",
            "soilname": "Poldervaaggrond",
            "dossiers": [],
        },
        "bodem_flags": {
            "kwaliteitsklasse": "Wonen",
        },
        "bodemtype_flags": {
            "dominant_soiltype": "Klei",
        },
        "soil_profile": {
            "dominant_type_label": "Klei",
            "soilname": "Poldervaaggrond",
            "soilcode": "pVz",
        },
        "funderingsrisicogebied": {
            "legenda": "Indicatief hoog risico",
            "fgr": "FGR-AMS-001",
        },
        "asbest_indicator": {
            "risico": "aanwezig_kans",
            "risk": "middel",
            "bouwjaar_relevant": True,
            "toelichting": "Bouwjaar vóór 1994 — asbest kan aanwezig zijn.",
            "reden": "Bouwjaar vóór 1994 — asbest kan aanwezig zijn.",
        },
        "permit_precedents": {
            "permits_found": 3,
            "summary": "3 bouwvergunningen gevonden.",
            "mediaan_doorlooptijd_dagen": 42,
            "goedgekeurd_pct": 85,
        },
        "vergunningen_data": {
            "records": [
                {"datum": "2024-01-15", "type": "Omgevingsvergunning", "titel": "Verbouwing achtergevel"},
                {"datum": "2023-06-20", "type": "Omgevingsvergunning", "titel": "Dakopbouw"},
                {"datum": "2022-11-03", "type": "Sloopmelding", "titel": "Slopen asbesthoudende dakbedekking"},
            ],
        },
        "scores_v3": {
            "potentie": 74.5,
            "risico": 32.1,
        },
        "use_case_scores": {
            "optoppen": {"score": 72, "total": 100},
            "splitsen": {"score": 45, "total": 100},
            "transformatie": {"score": 28, "total": 100},
        },
        "buildability_delta": {
            "parcel_area_m2": 200.0,
            "current_built_area_m2": 120.0,
            "remaining_buildable_area_m2": 40.0,
        },
        "brk_ownership": {
            "status": "available",
            "data": [],
        },
    }
    base.update(overrides)
    return base


# ═══════════════════════════════════════════════════════════════════════════
# 1. Mapping Completeness Tests
# ═══════════════════════════════════════════════════════════════════════════


class TestMappingCompleteness:
    """Verify the CHECKLIST_DOC_CONFIGS mapping is complete and consistent."""

    EXPECTED_DOC_TYPES = {
        "kadaster",
        "bestemmingsplan",
        "energielabel",
        "wkb_precheck",
        "monumenten",
        "risicoprofiel",
        "bodem",
        "fundering",
        "asbest",
        "vergunningen",
        "haalbaarheid",
    }

    def test_all_11_doc_types_present(self):
        """All expected document types are present in the config."""
        assert set(CHECKLIST_DOC_CONFIGS.keys()) == self.EXPECTED_DOC_TYPES

    def test_every_checklist_item_id_exists_in_checklists(self):
        """Every checklist_item_id referenced in configs exists in CHECKLISTS."""
        all_valid_ids: set[str] = set()
        for items in CHECKLISTS.values():
            for item in items:
                all_valid_ids.add(item.id)

        for doc_type, config in CHECKLIST_DOC_CONFIGS.items():
            for item_id in config.checklist_item_ids:
                assert item_id in all_valid_ids, (
                    f"{doc_type} references non-existent checklist item '{item_id}'"
                )

    def test_every_required_field_is_a_known_report_field(self):
        """Every required_field name maps to a key in our test fixture."""
        fixture = _make_checklist_report_data()
        for doc_type, config in CHECKLIST_DOC_CONFIGS.items():
            for field_name in config.required_fields:
                assert field_name in fixture, (
                    f"{doc_type} requires unknown field '{field_name}' — "
                    "add it to _make_checklist_report_data"
                )

    def test_high_confidence_types_have_no_disclaimer(self):
        """HIGH confidence doc types must NOT have a disclaimer."""
        for doc_type, config in CHECKLIST_DOC_CONFIGS.items():
            if config.confidence == "high":
                assert config.disclaimer is None, (
                    f"HIGH confidence type '{doc_type}' should not have a disclaimer"
                )

    def test_medium_confidence_types_have_disclaimer(self):
        """MEDIUM confidence doc types must have a non-empty disclaimer."""
        for doc_type, config in CHECKLIST_DOC_CONFIGS.items():
            if config.confidence == "medium":
                assert config.disclaimer and len(config.disclaimer) > 0, (
                    f"MEDIUM confidence type '{doc_type}' must have a disclaimer"
                )

    def test_no_duplicate_checklist_item_ids(self):
        """Each checklist_item_id maps to exactly one doc type."""
        seen: dict[str, str] = {}
        for doc_type, config in CHECKLIST_DOC_CONFIGS.items():
            for item_id in config.checklist_item_ids:
                assert item_id not in seen, (
                    f"Duplicate checklist_item_id '{item_id}': "
                    f"found in both '{seen[item_id]}' and '{doc_type}'"
                )
                seen[item_id] = doc_type

    def test_configs_are_frozen_dataclasses(self):
        """Each config entry is a frozen ChecklistDocConfig."""
        for doc_type, config in CHECKLIST_DOC_CONFIGS.items():
            assert isinstance(config, ChecklistDocConfig)
            with pytest.raises(AttributeError):
                config.title = "mutated"  # type: ignore[misc]

    def test_every_config_has_template_name(self):
        """Every config has a non-empty template_name ending in .html."""
        for doc_type, config in CHECKLIST_DOC_CONFIGS.items():
            assert config.template_name.endswith(".html"), (
                f"{doc_type} template_name must end in .html"
            )


# ═══════════════════════════════════════════════════════════════════════════
# 2. Data Sufficiency Tests (get_available_docs)
# ═══════════════════════════════════════════════════════════════════════════


class TestDataSufficiency:
    """Test get_available_docs determines which docs can be generated."""

    def test_full_data_returns_all_11_types(self):
        """Complete report data → all 11 doc types available."""
        report_data = _make_checklist_report_data()
        available = get_available_docs(report_data)
        assert set(available) == TestMappingCompleteness.EXPECTED_DOC_TYPES

    def test_empty_data_returns_empty_list(self):
        """Empty dict → no docs available."""
        available = get_available_docs({})
        assert available == []

    def test_partial_data_only_cadastral_parcels(self):
        """Only cadastral_parcels present → only 'kadaster' available."""
        report_data = {"cadastral_parcels": [{"kadastraal_nummer": "X"}]}
        available = get_available_docs(report_data)
        assert available == ["kadaster"]

    def test_brk_ownership_unavailable_not_counted(self):
        """brk_ownership with status='unavailable' is not considered present."""
        report_data = _make_checklist_report_data(
            brk_ownership={"status": "unavailable", "data": []}
        )
        # brk_ownership isn't a required field for any current doc type,
        # so all 11 should still be available.  But _field_is_present should
        # return False for it.
        assert _field_is_present(report_data, "brk_ownership") is False

    def test_brk_ownership_available_counted(self):
        """brk_ownership with status='available' is considered present."""
        report_data = _make_checklist_report_data()
        assert _field_is_present(report_data, "brk_ownership") is True

    def test_empty_list_field_treated_as_insufficient(self):
        """Empty list field → treated as not present."""
        report_data = _make_checklist_report_data(cadastral_parcels=[])
        assert _field_is_present(report_data, "cadastral_parcels") is False
        available = get_available_docs(report_data)
        assert "kadaster" not in available

    def test_none_field_treated_as_insufficient(self):
        """None value → field not present."""
        report_data = _make_checklist_report_data(zoning=None)
        assert _field_is_present(report_data, "zoning") is False
        available = get_available_docs(report_data)
        assert "bestemmingsplan" not in available
        assert "haalbaarheid" not in available  # requires zoning + scores_v3

    def test_haalbaarheid_requires_both_zoning_and_scores(self):
        """Haalbaarheid needs both zoning AND scores_v3."""
        # zoning present, scores_v3 missing
        report_data = _make_checklist_report_data(scores_v3=None)
        available = get_available_docs(report_data)
        assert "haalbaarheid" not in available

        # scores_v3 present, zoning missing
        report_data2 = _make_checklist_report_data(zoning=None)
        available2 = get_available_docs(report_data2)
        assert "haalbaarheid" not in available2

    def test_missing_key_treated_as_insufficient(self):
        """Key not in dict at all → not present."""
        report_data = _make_checklist_report_data()
        del report_data["monuments"]
        assert _field_is_present(report_data, "monuments") is False


# ═══════════════════════════════════════════════════════════════════════════
# 3. PDF Generation Tests
# ═══════════════════════════════════════════════════════════════════════════


class TestPDFGeneration:
    """Test generate_checklist_pdf produces valid PDFs."""

    def test_kadaster_pdf_returns_bytes(self):
        """generate_checklist_pdf('kadaster', ...) → bytes, len > 0."""
        report_data = _make_checklist_report_data()
        result = generate_checklist_pdf("kadaster", report_data, "Test Report")
        assert isinstance(result, bytes)
        assert len(result) > 0

    def test_kadaster_pdf_starts_with_pdf_magic(self):
        """PDF output starts with %PDF magic bytes."""
        report_data = _make_checklist_report_data()
        result = generate_checklist_pdf("kadaster", report_data, "Test Report")
        assert result[:5] == b"%PDF-"

    def test_unknown_doc_type_raises_key_error(self):
        """Unknown doc_type → KeyError."""
        report_data = _make_checklist_report_data()
        with pytest.raises(KeyError):
            generate_checklist_pdf("nonexistent_type", report_data, "Test")

    def test_partial_data_produces_pdf_with_fallbacks(self):
        """Generating with missing fields still produces a PDF (with fallbacks)."""
        # Minimal data — many fields None/missing
        report_data = {
            "cadastral_parcels": [{"kadastraal_nummer": "X"}],
            "address": {"straat": "Test", "huisnummer": 1},
        }
        result = generate_checklist_pdf("kadaster", report_data, "Fallback Test")
        assert isinstance(result, bytes)
        assert len(result) > 0
        assert result[:5] == b"%PDF-"

    def test_all_existing_templates_generate_valid_pdf(self):
        """Every doc type whose template exists on disk produces valid PDF bytes."""
        from pathlib import Path

        template_dir = Path(__file__).resolve().parents[2] / "app" / "reports" / "templates" / "checklist"
        report_data = _make_checklist_report_data()
        tested = 0
        for doc_type, config in CHECKLIST_DOC_CONFIGS.items():
            if not (template_dir / config.template_name).exists():
                continue
            result = generate_checklist_pdf(doc_type, report_data, "Test Report")
            assert isinstance(result, bytes), f"{doc_type} did not return bytes"
            assert len(result) > 0, f"{doc_type} returned empty bytes"
            assert result[:5] == b"%PDF-", f"{doc_type} missing PDF magic bytes"
            tested += 1
        assert tested >= 1, "At least one template must exist for this test"

    def test_missing_templates_raise_template_not_found(self):
        """Doc types without templates on disk raise TemplateNotFound."""
        from pathlib import Path

        from jinja2.exceptions import TemplateNotFound

        template_dir = Path(__file__).resolve().parents[2] / "app" / "reports" / "templates" / "checklist"
        report_data = _make_checklist_report_data()
        for doc_type, config in CHECKLIST_DOC_CONFIGS.items():
            if (template_dir / config.template_name).exists():
                continue
            with pytest.raises(TemplateNotFound):
                generate_checklist_pdf(doc_type, report_data, "Test Report")

    # --- Bestemmingsplan ---

    def test_generate_bestemmingsplan_pdf(self):
        """bestemmingsplan template generates valid PDF with full data."""
        report_data = _make_checklist_report_data()
        result = generate_checklist_pdf("bestemmingsplan", report_data, "Test Report")
        assert isinstance(result, bytes)
        assert len(result) > 0
        assert result[:5] == b"%PDF-"

    def test_generate_bestemmingsplan_partial_data(self):
        """bestemmingsplan with minimal zoning data still produces valid PDF."""
        report_data = _make_checklist_report_data(
            zoning={"bestemmingsplan_naam": "Centrum"}
        )
        result = generate_checklist_pdf("bestemmingsplan", report_data, "Partial Test")
        assert isinstance(result, bytes)
        assert result[:5] == b"%PDF-"

    # --- Energielabel ---

    def test_generate_energielabel_pdf(self):
        """energielabel template generates valid PDF with full data."""
        report_data = _make_checklist_report_data()
        result = generate_checklist_pdf("energielabel", report_data, "Test Report")
        assert isinstance(result, bytes)
        assert len(result) > 0
        assert result[:5] == b"%PDF-"

    def test_generate_energielabel_partial_data(self):
        """energielabel with unregistered label still produces valid PDF."""
        report_data = _make_checklist_report_data(
            energy_label={
                "is_geregistreerd": False,
                "niet_geregistreerd_reden": "Niet aangevraagd",
            }
        )
        result = generate_checklist_pdf("energielabel", report_data, "Partial Test")
        assert isinstance(result, bytes)
        assert result[:5] == b"%PDF-"

    # --- WKB Precheck ---

    def test_generate_wkb_precheck_pdf(self):
        """wkb_precheck template generates valid PDF with full data."""
        report_data = _make_checklist_report_data()
        result = generate_checklist_pdf("wkb_precheck", report_data, "Test Report")
        assert isinstance(result, bytes)
        assert len(result) > 0
        assert result[:5] == b"%PDF-"

    def test_generate_wkb_precheck_partial_data(self):
        """wkb_precheck with only status/confidence still produces valid PDF."""
        report_data = _make_checklist_report_data(
            wkb_precheck={"status": "unknown", "confidence": "low"}
        )
        result = generate_checklist_pdf("wkb_precheck", report_data, "Partial Test")
        assert isinstance(result, bytes)
        assert result[:5] == b"%PDF-"

    # --- Monumenten ---

    def test_generate_monumenten_pdf(self):
        """monumenten template generates valid PDF with full data (including RCE detail)."""
        report_data = _make_checklist_report_data()
        result = generate_checklist_pdf("monumenten", report_data, "Test Report")
        assert isinstance(result, bytes)
        assert len(result) > 0
        assert result[:5] == b"%PDF-"

    def test_generate_monumenten_partial_data(self):
        """monumenten with sparse data (no RCE detail, no restrictions) still produces valid PDF."""
        report_data = _make_checklist_report_data(
            monuments={
                "is_monument": False,
                "is_rijksmonument": False,
                "is_gemeentelijk_monument": False,
            }
        )
        result = generate_checklist_pdf("monumenten", report_data, "Partial Test")
        assert isinstance(result, bytes)
        assert result[:5] == b"%PDF-"

    # --- Risicoprofiel ---

    def test_generate_risicoprofiel_pdf(self):
        """risicoprofiel template generates valid PDF with full data."""
        report_data = _make_checklist_report_data()
        result = generate_checklist_pdf("risicoprofiel", report_data, "Test Report")
        assert isinstance(result, bytes)
        assert len(result) > 0
        assert result[:5] == b"%PDF-"

    def test_generate_risicoprofiel_partial_data(self):
        """risicoprofiel with only overall_risk still produces valid PDF."""
        report_data = _make_checklist_report_data(
            fysiek_risico_profiel={"overall_risk": "laag"},
            funderingsrisicogebied=None,
        )
        result = generate_checklist_pdf("risicoprofiel", report_data, "Partial Test")
        assert isinstance(result, bytes)
        assert result[:5] == b"%PDF-"

    def test_generate_risicoprofiel_with_env_flags(self):
        """risicoprofiel with environmental flags renders all flag sections."""
        report_data = _make_checklist_report_data(
            natura2000_flags={"in_natura2000": "Ja", "gebied_naam": "Veluwe"},
            overstromingsrisico_flags={"risico_klasse": "middel", "dijkring": "43"},
            geluid_flags={"lden_db": 58, "categorie": "stil"},
            luchtkwaliteit_flags={"no2_klasse": "laag", "pm10_klasse": "laag"},
        )
        result = generate_checklist_pdf("risicoprofiel", report_data, "Env Flags Test")
        assert isinstance(result, bytes)
        assert len(result) > 0
        assert result[:5] == b"%PDF-"

    # --- Bodem ---

    def test_generate_bodem_pdf(self):
        """bodem template generates valid PDF with full data."""
        report_data = _make_checklist_report_data()
        result = generate_checklist_pdf("bodem", report_data, "Test Report")
        assert isinstance(result, bytes)
        assert len(result) > 0
        assert result[:5] == b"%PDF-"

    def test_generate_bodem_partial_data(self):
        """bodem with only bodem_data={} still produces valid PDF."""
        report_data = _make_checklist_report_data(
            bodem_data={"dominant_type_label": "Zand"},
            bodem_flags=None,
            bodemtype_flags=None,
            soil_profile=None,
        )
        result = generate_checklist_pdf("bodem", report_data, "Partial Test")
        assert isinstance(result, bytes)
        assert result[:5] == b"%PDF-"

    # --- Fundering ---

    def test_generate_fundering_pdf(self):
        """fundering template generates valid PDF with full data."""
        report_data = _make_checklist_report_data()
        result = generate_checklist_pdf("fundering", report_data, "Test Report")
        assert isinstance(result, bytes)
        assert len(result) > 0
        assert result[:5] == b"%PDF-"

    def test_generate_fundering_partial_data(self):
        """fundering with only legenda='Onbekend' still produces valid PDF."""
        report_data = _make_checklist_report_data(
            funderingsrisicogebied={"legenda": "Onbekend"},
            fysiek_risico_profiel=None,
        )
        result = generate_checklist_pdf("fundering", report_data, "Partial Test")
        assert isinstance(result, bytes)
        assert result[:5] == b"%PDF-"

    # --- Asbest ---

    def test_generate_asbest_pdf(self):
        """asbest template generates valid PDF with full data."""
        report_data = _make_checklist_report_data()
        result = generate_checklist_pdf("asbest", report_data, "Test Report")
        assert isinstance(result, bytes)
        assert len(result) > 0
        assert result[:5] == b"%PDF-"

    def test_generate_asbest_partial_data(self):
        """asbest with only risk='onbekend' still produces valid PDF."""
        report_data = _make_checklist_report_data(
            asbest_indicator={"risk": "onbekend"},
        )
        result = generate_checklist_pdf("asbest", report_data, "Partial Test")
        assert isinstance(result, bytes)
        assert result[:5] == b"%PDF-"

    # --- Vergunningen ---

    def test_generate_vergunningen_pdf(self):
        """vergunningen template generates valid PDF with full data."""
        report_data = _make_checklist_report_data()
        result = generate_checklist_pdf("vergunningen", report_data, "Test Report")
        assert isinstance(result, bytes)
        assert len(result) > 0
        assert result[:5] == b"%PDF-"

    def test_generate_vergunningen_partial_data(self):
        """vergunningen with only permit_precedents, no vergunningen_data → valid PDF."""
        report_data = _make_checklist_report_data(
            vergunningen_data=None,
        )
        result = generate_checklist_pdf("vergunningen", report_data, "Partial Test")
        assert isinstance(result, bytes)
        assert result[:5] == b"%PDF-"

    def test_generate_vergunningen_list_data(self):
        """vergunningen_data as a plain list (not mapping) still renders."""
        report_data = _make_checklist_report_data(
            vergunningen_data=[
                {"datum": "2024-01-15", "type": "Omgevingsvergunning", "titel": "Test"},
            ],
        )
        result = generate_checklist_pdf("vergunningen", report_data, "List Test")
        assert isinstance(result, bytes)
        assert result[:5] == b"%PDF-"

    # --- Haalbaarheid ---

    def test_generate_haalbaarheid_pdf(self):
        """haalbaarheid template generates valid PDF with full data."""
        report_data = _make_checklist_report_data()
        result = generate_checklist_pdf("haalbaarheid", report_data, "Test Report")
        assert isinstance(result, bytes)
        assert len(result) > 0
        assert result[:5] == b"%PDF-"

    def test_generate_haalbaarheid_partial_data(self):
        """haalbaarheid with zoning + scores_v3 only, no use_case_scores/buildability_delta → valid PDF."""
        report_data = _make_checklist_report_data(
            use_case_scores=None,
            buildability_delta=None,
        )
        result = generate_checklist_pdf("haalbaarheid", report_data, "Partial Test")
        assert isinstance(result, bytes)
        assert result[:5] == b"%PDF-"


# ═══════════════════════════════════════════════════════════════════════════
# 4. VALID_DOCUMENT_TYPES Expansion Test
# ═══════════════════════════════════════════════════════════════════════════


class TestValidDocumentTypes:
    """Verify the 5 new checklist doc types are in the router."""

    def test_new_checklist_types_in_valid_document_types(self):
        """All 5 new checklist-generated types are in VALID_DOCUMENT_TYPES."""
        from app.documents.router import VALID_DOCUMENT_TYPES

        new_types = {
            "wkb_precheck",
            "monumenten",
            "vergunningen",
            "risicoprofiel",
            "haalbaarheid",
        }
        for doc_type in new_types:
            assert doc_type in VALID_DOCUMENT_TYPES, (
                f"'{doc_type}' missing from VALID_DOCUMENT_TYPES"
            )


# ═══════════════════════════════════════════════════════════════════════════
# 5. _field_is_present edge cases
# ═══════════════════════════════════════════════════════════════════════════


class TestFieldIsPresent:
    """Test the _field_is_present helper directly."""

    def test_empty_dict_value(self):
        """Empty dict → False (considered insufficient)."""
        assert _field_is_present({"zoning": {}}, "zoning") is False

    def test_non_empty_dict_value(self):
        """Non-empty dict → True."""
        assert _field_is_present({"zoning": {"x": 1}}, "zoning") is True

    def test_scalar_string_value(self):
        """Non-None string → True."""
        assert _field_is_present({"energy_label": "A"}, "energy_label") is True

    def test_scalar_zero_value(self):
        """Zero is a valid scalar → True."""
        assert _field_is_present({"score": 0}, "score") is True

    def test_scalar_false_value(self):
        """False is a valid scalar → True (not None)."""
        assert _field_is_present({"flag": False}, "flag") is True

    def test_brk_ownership_dict_without_status(self):
        """brk_ownership dict without status key → True (not 'unavailable')."""
        assert _field_is_present({"brk_ownership": {"data": []}}, "brk_ownership") is True

    def test_brk_ownership_non_dict(self):
        """brk_ownership as non-dict → False."""
        assert _field_is_present({"brk_ownership": "string"}, "brk_ownership") is False
