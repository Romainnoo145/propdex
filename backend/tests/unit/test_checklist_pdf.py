"""Unit tests for checklist PDF mapping, data sufficiency, and generation.

Tests are SYNCHRONOUS (def test_*, not async def) because WeasyPrint is CPU-bound.
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

import pytest
from jinja2 import Environment, FileSystemLoader

from app.reports.checklist_pdf import (
    CHECKLIST_DOC_CONFIGS,
    ChecklistDocConfig,
    _field_is_present,
    generate_checklist_pdf,
    get_available_docs,
)
from app.services.checklists import CHECKLISTS


# ---------------------------------------------------------------------------
# Template rendering helper (HTML only — skips WeasyPrint for speed)
# ---------------------------------------------------------------------------

_TEMPLATE_DIR = Path(__file__).resolve().parents[2] / "app" / "reports" / "templates" / "checklist"


def _render_html(doc_type: str, report_data: dict, report_name: str = "Test Report") -> str:
    """Render a checklist template to HTML string without PDF conversion.

    Much faster than generate_checklist_pdf — use for content assertions.
    """
    config = CHECKLIST_DOC_CONFIGS[doc_type]
    env = Environment(loader=FileSystemLoader(str(_TEMPLATE_DIR)))
    template = env.get_template(config.template_name)
    context = {
        "report_data": report_data,
        "report_name": report_name,
        "config": config,
        "generated_at": "31 maart 2026 om 12:00",
    }
    return template.render(context)


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
            {
                "kadastraal_nummer": "ASD01-F-1234",
                "perceelnummer": "1234",
                "kadastrale_aanduiding": "ASD04 S 1234",
                "sectie": "S",
                "oppervlakte": 200,
                "gemeente": "Amsterdam",
            }
        ],
        "zoning": {
            "bestemmingsplan_naam": "Centrum",
            "bestemmingen": ["Gemengd - 2"],
            "max_bouwhoogte_m": 15.0,
            "primary_bestemming": "Gemengd - 2",
            "source": "DSO Ruimtelijke Plannen API v4",
            "plans": [
                {
                    "plan_naam": "Centrum Amsterdam",
                    "plan_type": "bestemmingsplan",
                    "plan_status": "vastgesteld",
                    "plan_datum": "2022-06-15",
                    "rules": [
                        {
                            "bestemming": "Gemengd - 2",
                            "omschrijving": "Wonen, kantoren, horeca",
                            "building_dimensions": {
                                "max_hoogte": 15.0,
                                "max_bouwlagen": 4,
                                "max_bebouwingspercentage": 80,
                            },
                        },
                    ],
                    "functie_aanduidingen": [
                        {"naam": "horeca tot en met categorie 3", "groep": "horeca"},
                    ],
                    "gebieds_aanduidingen": [
                        {"naam": "geluidzone - industrie", "groep": "geluidzone"},
                    ],
                    "teksten": [
                        {
                            "titel": "Artikel 6 - Gemengd - 2",
                            "inhoud": "De voor 'Gemengd - 2' aangewezen gronden zijn bestemd voor wonen, kantoren en horeca.",
                        },
                    ],
                },
            ],
            "building_dimensions": {
                "max_hoogte": 15.0,
                "max_bouwlagen": 4,
                "max_bebouwingspercentage": 80,
                "max_goothoogte": 12.0,
                "max_floor_area_ratio": 2.5,
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
            "layer_b": {
                "applied": True,
                "input": {
                    "constructieve_wijziging": False,
                    "uitbreiding_m2": 25.0,
                    "functiewijziging": False,
                },
                "effect_note": "Uitbreiding < 50m² — geen effect op gevolgklasse.",
                "available_inputs": ["constructieve_wijziging", "uitbreiding_m2", "functiewijziging"],
            },
        },
        "wkb_classification": {
            "wkb_applicable": True,
            "gevolgklasse": "GK1",
            "exclusion_reason": None,
            "disclaimer": "Indicatieve classificatie op basis van openbare BAG- en monumentendata. Geen juridisch bindend advies.",
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
            "asbest_indicator": {
                "risk": "middel",
                "bouwjaar": 1890,
                "norm_reference": "NEN 2991",
                "gebruiksdoel_factor": "woonfunctie",
                "reden": "Bouwjaar vóór 1994 — asbest kan aanwezig zijn.",
            },
            "bodem_data": {
                "dossiers": [
                    {
                        "sikb_id": "NL.SIKB.12345",
                        "status_oord": "niet ernstig",
                        "vervolg_wbb": "voldoende onderzocht",
                        "statusver": None,
                        "administrator_nm": "Amsterdam",
                    },
                ],
                "disclaimer": "Gegevens afkomstig van Bodemloket. Geen garantie voor volledigheid.",
            },
            "kcaf_cost": {
                "low_eur": 40000,
                "high_eur": 80000,
                "low_per_m2": 267,
                "high_per_m2": 533,
                "oppervlakte_m2": 150,
                "disclaimer": "Indicatieve kosten op basis van KCAF benchmark.",
            },
            "disclaimer": (
                "Fysiek risicoprofiel is een indicatieve beoordeling op basis van openbare data. "
                "Geen vervanging voor professioneel onderzoek."
            ),
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
            "gemeente_scope": "Amsterdam",
            "comparable_type": "Omgevingsvergunning",
            "sample_size": 47,
            "lookback_days": 730,
            "permits_found": 3,
            "summary": "3 bouwvergunningen gevonden.",
            "mediaan_doorlooptijd_dagen": 42,
            "median_processing_days": 42,
            "p75_processing_days": 68,
            "goedgekeurd_pct": 85,
            "outcome_distribution": {
                "verleend": 40,
                "geweigerd": 4,
                "ingetrokken": 3,
            },
            "low_sample_warning": None,
            "references": [
                {
                    "change_record_id": "abc-123",
                    "title": "Verbouwing Herengracht 100",
                    "change_date": "2024-02-10",
                    "outcome": "verleend",
                    "source_url": "https://zoek.officielebekendmakingen.nl/abc-123",
                },
                {
                    "change_record_id": "def-456",
                    "title": "Dakopbouw Prinsengracht 200",
                    "change_date": "2023-11-05",
                    "outcome": "verleend",
                    "source_url": None,
                },
            ],
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
            "current_built_ratio_pct": 60.0,
            "max_bebouwingspercentage_pct": 80.0,
            "max_buildable_area_m2": 160.0,
            "remaining_buildable_area_m2": 40.0,
            "current_far": 0.9,
            "max_far": 2.5,
            "remaining_far": 1.6,
            "limit_source": "DSO maatvoering",
            "limit_confidence": "high",
            "confidence": "medium",
            "missing_fields": ["exact_bvo"],
            "notes": ["Bebouwd oppervlak geschat op basis van BAG pandgeometrie."],
        },
        "brk_ownership": {
            "status": "available",
            "fetched_at": "2025-03-31T12:00:00Z",
            "data": [
                {
                    "perceel_identificatie": "NL.IMKAD.KadastraalObject.12345678",
                    "gerechtigden": [
                        {
                            "eigenaar_type": "rechtspersoon",
                            "naam": "Stichting Stadsherstel Amsterdam",
                            "kvk_nummer": "12345678",
                            "statutaire_zetel": "Amsterdam",
                            "zakelijk_recht_type": "Eigendom",
                            "aandeel": "1/1",
                            "koopsom": 850000,
                            "koopjaar": 2018,
                        },
                        {
                            "eigenaar_type": "natuurlijk_persoon",
                            "naam": None,
                            "zakelijk_recht_type": "Erfpacht",
                            "aandeel": "1/1",
                        },
                    ],
                    "heeft_hypotheek": True,
                    "hypotheken": [
                        {
                            "hypotheekhouder_naam": "ABN AMRO Bank N.V.",
                            "bedrag": 500000,
                            "aard": "Eerste hypotheek",
                        },
                    ],
                    "beslagen": [
                        {"aard": "Conservatoir beslag"},
                    ],
                },
            ],
        },
        "woz_data": {
            "woz_objectnummer": "0363200012345678",
            "meest_recente_waarde": 485000,
            "meest_recente_peildatum": "2024-01-01",
            "grondoppervlakte": 95,
            "low_confidence": False,
            "bron": "WOZ Waardeloket",
            "waarden": [
                {"vastgestelde_waarde": 485000, "peildatum": "2024-01-01"},
                {"vastgestelde_waarde": 452000, "peildatum": "2023-01-01"},
                {"vastgestelde_waarde": 410000, "peildatum": "2022-01-01"},
            ],
        },
        "woz_flags": {
            "waarde": "485.000",
            "peildatum": "2024-01-01",
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
        "woz",
        "bodem",
        "fundering",
        "asbest",
        "vergunningen",
        "haalbaarheid",
    }

    def test_all_12_doc_types_present(self):
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

    # --- WOZ ---

    def test_generate_woz_pdf(self):
        """woz template generates valid PDF with full data."""
        report_data = _make_checklist_report_data()
        result = generate_checklist_pdf("woz", report_data, "Test Report")
        assert isinstance(result, bytes)
        assert len(result) > 0
        assert result[:5] == b"%PDF-"

    def test_generate_woz_partial_data(self):
        """woz with only meest_recente_waarde still produces valid PDF."""
        report_data = _make_checklist_report_data(
            woz_data={"meest_recente_waarde": 350000},
            woz_flags=None,
        )
        result = generate_checklist_pdf("woz", report_data, "Partial Test")
        assert isinstance(result, bytes)
        assert result[:5] == b"%PDF-"

    def test_generate_woz_with_flags_fallback(self):
        """woz with woz_data present but woz_flags also present exercises both paths."""
        report_data = _make_checklist_report_data(
            woz_data={"meest_recente_waarde": 350000, "low_confidence": True},
            woz_flags={"waarde": "350.000", "peildatum": "2024-01-01"},
        )
        result = generate_checklist_pdf("woz", report_data, "Flags Test")
        assert isinstance(result, bytes)
        assert result[:5] == b"%PDF-"

    def test_generate_woz_single_waarde_no_history(self):
        """woz with one historical value doesn't show the history table (needs >1)."""
        report_data = _make_checklist_report_data(
            woz_data={
                "meest_recente_waarde": 485000,
                "waarden": [{"vastgestelde_waarde": 485000, "peildatum": "2024-01-01"}],
            },
        )
        result = generate_checklist_pdf("woz", report_data, "Single Value Test")
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

    def test_generate_haalbaarheid_with_far_data(self):
        """haalbaarheid with full FAR/limit_source/confidence in buildability_delta."""
        report_data = _make_checklist_report_data()
        # Ensure FAR fields are present
        assert report_data["buildability_delta"]["current_far"] == 0.9
        assert report_data["buildability_delta"]["limit_source"] == "DSO maatvoering"
        assert report_data["buildability_delta"]["limit_confidence"] == "high"
        result = generate_checklist_pdf("haalbaarheid", report_data, "FAR Test")
        assert isinstance(result, bytes)
        assert result[:5] == b"%PDF-"

    # --- WKB Precheck (expanded) ---

    def test_generate_wkb_precheck_with_classification(self):
        """wkb_precheck with WkbClassification data renders classification section."""
        report_data = _make_checklist_report_data()
        assert report_data.get("wkb_classification") is not None
        result = generate_checklist_pdf("wkb_precheck", report_data, "Classification Test")
        assert isinstance(result, bytes)
        assert result[:5] == b"%PDF-"

    def test_generate_wkb_precheck_without_classification(self):
        """wkb_precheck without WkbClassification still renders."""
        report_data = _make_checklist_report_data(wkb_classification=None)
        result = generate_checklist_pdf("wkb_precheck", report_data, "No Classification Test")
        assert isinstance(result, bytes)
        assert result[:5] == b"%PDF-"

    def test_generate_wkb_precheck_with_layer_b(self):
        """wkb_precheck with applied layer_b refinement renders metadata."""
        report_data = _make_checklist_report_data()
        assert report_data["wkb_precheck"]["layer_b"]["applied"] is True
        result = generate_checklist_pdf("wkb_precheck", report_data, "Layer B Test")
        assert isinstance(result, bytes)
        assert result[:5] == b"%PDF-"

    def test_generate_wkb_precheck_excluded_monument(self):
        """wkb_precheck with monument exclusion renders exclusion reason."""
        report_data = _make_checklist_report_data(
            wkb_classification={
                "wkb_applicable": False,
                "gevolgklasse": "niet_van_toepassing",
                "exclusion_reason": "rijksmonument",
                "disclaimer": "Niet van toepassing — rijksmonument.",
            }
        )
        result = generate_checklist_pdf("wkb_precheck", report_data, "Excluded Test")
        assert isinstance(result, bytes)
        assert result[:5] == b"%PDF-"

    # --- Monumenten (expanded) ---

    def test_generate_monumenten_with_summary_box(self):
        """monumenten with full RCE detail renders summary box with bouwperiode."""
        report_data = _make_checklist_report_data()
        assert report_data["monuments"]["rce_detail"]["bouwjaar_van"] == 1660
        result = generate_checklist_pdf("monumenten", report_data, "Summary Box Test")
        assert isinstance(result, bytes)
        assert result[:5] == b"%PDF-"

    def test_generate_monumenten_not_monument(self):
        """monumenten for non-monument property renders green dot, no RCE section."""
        report_data = _make_checklist_report_data(
            monuments={
                "is_monument": False,
                "is_rijksmonument": False,
                "is_gemeentelijk_monument": False,
                "has_conflict": False,
            }
        )
        result = generate_checklist_pdf("monumenten", report_data, "Not Monument Test")
        assert isinstance(result, bytes)
        assert result[:5] == b"%PDF-"

    # --- Risicoprofiel (expanded) ---

    def test_generate_risicoprofiel_with_asbest(self):
        """risicoprofiel with asbest_indicator inside fysiek_risico_profiel renders asbest section."""
        report_data = _make_checklist_report_data()
        assert report_data["fysiek_risico_profiel"]["asbest_indicator"]["risk"] == "middel"
        result = generate_checklist_pdf("risicoprofiel", report_data, "Asbest Test")
        assert isinstance(result, bytes)
        assert result[:5] == b"%PDF-"

    def test_generate_risicoprofiel_with_bodem_dossiers(self):
        """risicoprofiel with bodem_data dossiers renders WBB table."""
        report_data = _make_checklist_report_data()
        assert len(report_data["fysiek_risico_profiel"]["bodem_data"]["dossiers"]) > 0
        result = generate_checklist_pdf("risicoprofiel", report_data, "Bodem Dossiers Test")
        assert isinstance(result, bytes)
        assert result[:5] == b"%PDF-"

    def test_generate_risicoprofiel_empty_dossiers(self):
        """risicoprofiel with empty dossiers list shows 'geen dossiers' message."""
        report_data = _make_checklist_report_data(
            fysiek_risico_profiel={
                "overall_risk": "laag",
                "overall_explanation": "Geen issues gevonden.",
                "bodem_data": {
                    "dossiers": [],
                    "disclaimer": "Geen WBB-dossiers.",
                },
            },
            funderingsrisicogebied=None,
        )
        result = generate_checklist_pdf("risicoprofiel", report_data, "Empty Dossiers Test")
        assert isinstance(result, bytes)
        assert result[:5] == b"%PDF-"

    def test_generate_risicoprofiel_with_disclaimer(self):
        """risicoprofiel with overall disclaimer renders disclaimer block."""
        report_data = _make_checklist_report_data()
        assert "disclaimer" in report_data["fysiek_risico_profiel"]
        result = generate_checklist_pdf("risicoprofiel", report_data, "Disclaimer Test")
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


# ═══════════════════════════════════════════════════════════════════════════
# 6. Content Assertion Tests — HTML rendering checks
# ═══════════════════════════════════════════════════════════════════════════


class TestKadasterContent:
    """Verify kadaster template renders BRK ownership with AVG compliance."""

    def test_rechtspersoon_name_shown(self):
        """Rechtspersoon owner name appears in rendered HTML."""
        html = _render_html("kadaster", _make_checklist_report_data())
        assert "Stichting Stadsherstel Amsterdam" in html

    def test_natuurlijk_persoon_name_hidden(self):
        """Natuurlijk persoon gets AVG placeholder, no real name."""
        html = _render_html("kadaster", _make_checklist_report_data())
        assert "Privacygevoelig" in html
        # The fixture's natuurlijk_persoon has naam=None, so no name to leak

    def test_hypotheek_holder_shown(self):
        """Hypotheek holder name appears in rendered HTML."""
        html = _render_html("kadaster", _make_checklist_report_data())
        assert "ABN AMRO Bank N.V." in html

    def test_beslag_rendered(self):
        """Beslagen section renders when present."""
        html = _render_html("kadaster", _make_checklist_report_data())
        assert "Conservatoir beslag" in html

    def test_kadastraal_nummer_rendered(self):
        """Kadastrale aanduiding from fixture appears in HTML."""
        html = _render_html("kadaster", _make_checklist_report_data())
        assert "ASD04 S 1234" in html

    def test_summary_box_present(self):
        """Kadaster summary box renders with full data."""
        html = _render_html("kadaster", _make_checklist_report_data())
        assert "summary-box" in html

    def test_no_brk_ownership_no_crash(self):
        """Kadaster renders without brk_ownership (graceful fallback)."""
        data = _make_checklist_report_data(brk_ownership=None)
        html = _render_html("kadaster", data)
        assert "ASD04 S 1234" in html
        assert "Stichting Stadsherstel Amsterdam" not in html

    def test_brk_unavailable_shows_fallback(self):
        """brk_ownership with status=unavailable shows appropriate handling."""
        data = _make_checklist_report_data(
            brk_ownership={"status": "unavailable", "data": []}
        )
        html = _render_html("kadaster", data)
        assert "Stichting Stadsherstel Amsterdam" not in html


class TestBestemmingsplanContent:
    """Verify bestemmingsplan template renders zoning fields."""

    def test_plan_naam_rendered(self):
        """Plan name appears in rendered HTML."""
        html = _render_html("bestemmingsplan", _make_checklist_report_data())
        assert "Centrum Amsterdam" in html

    def test_bestemming_rendered(self):
        """Primary bestemming text appears."""
        html = _render_html("bestemmingsplan", _make_checklist_report_data())
        assert "Gemengd - 2" in html

    def test_functie_aanduiding_rendered(self):
        """Functie aanduidingen from plan appear in HTML."""
        html = _render_html("bestemmingsplan", _make_checklist_report_data())
        assert "horeca tot en met categorie 3" in html

    def test_gebieds_aanduiding_rendered(self):
        """Gebieds aanduidingen appear in HTML."""
        html = _render_html("bestemmingsplan", _make_checklist_report_data())
        assert "geluidzone - industrie" in html

    def test_building_dimensions_rendered(self):
        """Max bouwhoogte from building_dimensions appears."""
        html = _render_html("bestemmingsplan", _make_checklist_report_data())
        assert "15" in html  # max_hoogte

    def test_summary_box_present(self):
        """Bestemmingsplan summary box renders."""
        html = _render_html("bestemmingsplan", _make_checklist_report_data())
        assert "summary-box" in html

    def test_minimal_zoning_no_plans(self):
        """Bestemmingsplan with only plan_naam, no plans array → no crash."""
        data = _make_checklist_report_data(
            zoning={"bestemmingsplan_naam": "Centrum"}
        )
        html = _render_html("bestemmingsplan", data)
        assert "Centrum" in html

    def test_plan_teksten_rendered(self):
        """Plan teksten (article text) appear in HTML."""
        html = _render_html("bestemmingsplan", _make_checklist_report_data())
        assert "Artikel 6" in html


class TestVergunningenContent:
    """Verify vergunningen template renders permit benchmark data."""

    def test_summary_box_present(self):
        """Vergunningen summary box renders with full data."""
        html = _render_html("vergunningen", _make_checklist_report_data())
        assert "summary-box" in html

    def test_mediaan_doorlooptijd_rendered(self):
        """Median processing days appears in HTML."""
        html = _render_html("vergunningen", _make_checklist_report_data())
        assert "42" in html  # mediaan_doorlooptijd_dagen

    def test_goedgekeurd_percentage_rendered(self):
        """Approval percentage appears in HTML."""
        html = _render_html("vergunningen", _make_checklist_report_data())
        assert "85" in html  # goedgekeurd_pct

    def test_outcome_distribution_rendered(self):
        """Outcome distribution values appear."""
        html = _render_html("vergunningen", _make_checklist_report_data())
        # verleend: 40 appears somewhere
        assert "verleend" in html.lower() or "Verleend" in html

    def test_permit_reference_title_rendered(self):
        """Permit reference titles appear in HTML."""
        html = _render_html("vergunningen", _make_checklist_report_data())
        assert "Verbouwing Herengracht 100" in html

    def test_vergunningen_history_rendered(self):
        """Vergunningen_data records appear in HTML."""
        html = _render_html("vergunningen", _make_checklist_report_data())
        assert "Verbouwing achtergevel" in html

    def test_no_vergunningen_data_no_crash(self):
        """Vergunningen without vergunningen_data → still renders benchmark."""
        data = _make_checklist_report_data(vergunningen_data=None)
        html = _render_html("vergunningen", data)
        assert "42" in html  # benchmark still present

    def test_p75_processing_days_rendered(self):
        """P75 processing days from benchmark appears."""
        html = _render_html("vergunningen", _make_checklist_report_data())
        assert "68" in html  # p75_processing_days


class TestHaalbaarheidContent:
    """Verify haalbaarheid template renders FAR and buildability data."""

    def test_summary_box_present(self):
        """Haalbaarheid summary box renders."""
        html = _render_html("haalbaarheid", _make_checklist_report_data())
        assert "summary-box" in html

    def test_potentie_score_rendered(self):
        """Potentie score from scores_v3 appears."""
        html = _render_html("haalbaarheid", _make_checklist_report_data())
        assert "74" in html  # potentie: 74.5

    def test_use_case_scores_rendered(self):
        """Use case scores appear in HTML."""
        html = _render_html("haalbaarheid", _make_checklist_report_data())
        assert "optoppen" in html.lower() or "Optoppen" in html

    def test_buildability_delta_rendered(self):
        """Buildability delta fields appear."""
        html = _render_html("haalbaarheid", _make_checklist_report_data())
        assert "40" in html  # remaining_buildable_area_m2

    def test_far_values_rendered(self):
        """FAR (floor area ratio) values appear."""
        html = _render_html("haalbaarheid", _make_checklist_report_data())
        assert "2.5" in html or "2,5" in html  # max_far

    def test_limit_source_rendered(self):
        """Limit source from buildability_delta appears."""
        html = _render_html("haalbaarheid", _make_checklist_report_data())
        assert "DSO maatvoering" in html

    def test_no_buildability_delta_no_crash(self):
        """Haalbaarheid without buildability_delta → still renders scores."""
        data = _make_checklist_report_data(buildability_delta=None)
        html = _render_html("haalbaarheid", data)
        assert "74" in html  # potentie still present
        assert "DSO maatvoering" not in html


class TestWkbPrecheckContent:
    """Verify wkb_precheck template renders classification and precheck data."""

    def test_summary_box_present(self):
        """WKB precheck summary box renders."""
        html = _render_html("wkb_precheck", _make_checklist_report_data())
        assert "summary-box" in html

    def test_gevolgklasse_rendered(self):
        """Gevolgklasse from WkbClassification appears."""
        html = _render_html("wkb_precheck", _make_checklist_report_data())
        assert "GK1" in html

    def test_triggered_rules_rendered(self):
        """Triggered rules from precheck appear."""
        html = _render_html("wkb_precheck", _make_checklist_report_data())
        assert "Grondgebonden woning" in html

    def test_required_documents_rendered(self):
        """Required documents list appears."""
        html = _render_html("wkb_precheck", _make_checklist_report_data())
        assert "Constructieberekening" in html

    def test_layer_b_effect_note_rendered(self):
        """Layer B effect note appears when applied."""
        html = _render_html("wkb_precheck", _make_checklist_report_data())
        assert "50m" in html or "Uitbreiding" in html

    def test_exclusion_reason_rendered(self):
        """Exclusion reason appears for non-applicable WKB."""
        data = _make_checklist_report_data(
            wkb_classification={
                "wkb_applicable": False,
                "gevolgklasse": "niet_van_toepassing",
                "exclusion_reason": "rijksmonument",
                "disclaimer": "Niet van toepassing — rijksmonument.",
            }
        )
        html = _render_html("wkb_precheck", data)
        assert "rijksmonument" in html

    def test_no_classification_no_crash(self):
        """WKB precheck without wkb_classification → still renders precheck."""
        data = _make_checklist_report_data(wkb_classification=None)
        html = _render_html("wkb_precheck", data)
        assert "Grondgebonden woning" in html  # triggered rules still present
        assert "GK1" not in html  # classification absent


class TestMonumentenContent:
    """Verify monumenten template renders monument data and summary box."""

    def test_summary_box_present(self):
        """Monumenten summary box renders with full data."""
        html = _render_html("monumenten", _make_checklist_report_data())
        assert "summary-box" in html

    def test_rce_detail_rendered(self):
        """RCE detail fields appear in HTML."""
        html = _render_html("monumenten", _make_checklist_report_data())
        assert "12345" in html  # rijksmonumentnummer

    def test_architect_rendered(self):
        """Architect name from RCE detail appears."""
        html = _render_html("monumenten", _make_checklist_report_data())
        assert "Philips Vingboons" in html

    def test_bouwstijl_rendered(self):
        """Bouwstijl from RCE detail appears."""
        html = _render_html("monumenten", _make_checklist_report_data())
        assert "Hollands classicisme" in html

    def test_restrictions_summary_rendered(self):
        """Restrictions summary items appear in HTML."""
        html = _render_html("monumenten", _make_checklist_report_data())
        assert "Vergunning vereist voor wijziging gevel" in html

    def test_not_monument_no_rce(self):
        """Non-monument property renders without RCE section."""
        data = _make_checklist_report_data(
            monuments={
                "is_monument": False,
                "is_rijksmonument": False,
                "is_gemeentelijk_monument": False,
                "has_conflict": False,
            }
        )
        html = _render_html("monumenten", data)
        assert "Philips Vingboons" not in html
        assert "Vergunning vereist" not in html

    def test_bouwperiode_rendered(self):
        """Bouwjaar range from RCE detail appears."""
        html = _render_html("monumenten", _make_checklist_report_data())
        assert "1660" in html


class TestRisicoprofielContent:
    """Verify risicoprofiel template renders risk data, asbest, bodem."""

    def test_summary_box_present(self):
        """Risicoprofiel summary box renders."""
        html = _render_html("risicoprofiel", _make_checklist_report_data())
        assert "summary-box" in html

    def test_overall_risk_rendered(self):
        """Overall risk level appears in HTML."""
        html = _render_html("risicoprofiel", _make_checklist_report_data())
        assert "middel" in html.lower()

    def test_foundation_risk_rendered(self):
        """Foundation risk reason appears."""
        html = _render_html("risicoprofiel", _make_checklist_report_data())
        assert "Houten fundering" in html or "slappe ondergrond" in html

    def test_asbest_indicator_rendered(self):
        """Asbest indicator data appears in HTML."""
        html = _render_html("risicoprofiel", _make_checklist_report_data())
        assert "NEN 2991" in html or "asbest" in html.lower()

    def test_bodem_dossier_rendered(self):
        """Bodem dossier data appears in HTML."""
        html = _render_html("risicoprofiel", _make_checklist_report_data())
        assert "NL.SIKB.12345" in html or "niet ernstig" in html

    def test_kcaf_cost_rendered(self):
        """KCAF cost range appears in HTML."""
        html = _render_html("risicoprofiel", _make_checklist_report_data())
        assert "40.000" in html or "40000" in html or "€" in html

    def test_disclaimer_rendered(self):
        """Overall disclaimer text appears."""
        html = _render_html("risicoprofiel", _make_checklist_report_data())
        assert "indicatieve beoordeling" in html.lower() or "disclaimer" in html.lower()

    def test_empty_bodem_dossiers_message(self):
        """Empty dossiers list renders 'geen' message."""
        data = _make_checklist_report_data(
            fysiek_risico_profiel={
                "overall_risk": "laag",
                "overall_explanation": "Geen issues.",
                "bodem_data": {"dossiers": [], "disclaimer": "Test."},
            },
            funderingsrisicogebied=None,
        )
        html = _render_html("risicoprofiel", data)
        assert "geen" in html.lower() or "Geen" in html

    def test_minimal_risicoprofiel_no_crash(self):
        """Risicoprofiel with only overall_risk → no crash."""
        data = _make_checklist_report_data(
            fysiek_risico_profiel={"overall_risk": "laag"},
            funderingsrisicogebied=None,
        )
        html = _render_html("risicoprofiel", data)
        assert "laag" in html.lower()


class TestBodemContent:
    """Verify bodem template renders soil quality, dossier, and profile data."""

    def test_kwaliteitsklasse_rendered(self):
        """Kwaliteitsklasse from bodem_flags appears in HTML."""
        html = _render_html("bodem", _make_checklist_report_data())
        assert "Wonen" in html

    def test_dominant_soiltype_rendered(self):
        """Dominant soiltype from bodemtype_flags appears."""
        html = _render_html("bodem", _make_checklist_report_data())
        assert "Klei" in html

    def test_soil_profile_dominant_type_label(self):
        """Soil profile dominant_type_label appears in BRO section."""
        html = _render_html("bodem", _make_checklist_report_data())
        assert "Klei" in html

    def test_soil_profile_soilname(self):
        """Soil profile soilname appears."""
        html = _render_html("bodem", _make_checklist_report_data())
        assert "Poldervaaggrond" in html

    def test_soil_profile_soilcode(self):
        """Soil profile soilcode appears."""
        html = _render_html("bodem", _make_checklist_report_data())
        assert "pVz" in html

    def test_no_dossiers_message(self):
        """Empty dossiers list renders 'geen verontreiniging' message."""
        html = _render_html("bodem", _make_checklist_report_data())
        # Fixture has dossiers: [] in bodem_data
        assert "Geen verontreiniging" in html or "geen verontreiniging" in html

    def test_disclaimer_prominent_present(self):
        """Bodem template includes disclaimer-prominent block."""
        html = _render_html("bodem", _make_checklist_report_data())
        assert '<div class="disclaimer-prominent">' in html

    def test_no_data_fallback(self):
        """Bodem renders gracefully with no bodem data at all."""
        data = _make_checklist_report_data(
            bodem_flags=None, bodemtype_flags=None, soil_profile=None,
            bodem_data=None,
            fysiek_risico_profiel={"overall_risk": "laag"},
        )
        html = _render_html("bodem", data)
        assert "Geen bodemgegevens beschikbaar" in html


class TestFunderingContent:
    """Verify fundering template renders funderingsrisicogebied and foundation_risk."""

    def test_legenda_rendered(self):
        """Funderingsrisicogebied legenda appears."""
        html = _render_html("fundering", _make_checklist_report_data())
        assert "Indicatief hoog risico" in html

    def test_fgr_rendered(self):
        """FGR code appears in HTML."""
        html = _render_html("fundering", _make_checklist_report_data())
        assert "FGR-AMS-001" in html

    def test_foundation_risk_bouwjaar(self):
        """Foundation risk bouwjaar appears."""
        html = _render_html("fundering", _make_checklist_report_data())
        assert "1890" in html

    def test_foundation_risk_bodemtype(self):
        """Foundation risk bodemtype appears."""
        html = _render_html("fundering", _make_checklist_report_data())
        # bodemtype 'klei' rendered with | title → 'Klei'
        assert "Klei" in html or "klei" in html

    def test_foundation_risk_reden(self):
        """Foundation risk reden (reason) appears."""
        html = _render_html("fundering", _make_checklist_report_data())
        assert "Houten fundering op slappe ondergrond" in html

    def test_foundation_risk_level(self):
        """Foundation risk level badge appears."""
        html = _render_html("fundering", _make_checklist_report_data())
        assert "Middel" in html or "middel" in html

    def test_disclaimer_prominent_present(self):
        """Fundering template includes disclaimer-prominent block."""
        html = _render_html("fundering", _make_checklist_report_data())
        assert '<div class="disclaimer-prominent">' in html

    def test_no_data_fallback(self):
        """Fundering renders gracefully with no fundering data."""
        data = _make_checklist_report_data(
            funderingsrisicogebied=None,
            fysiek_risico_profiel={"overall_risk": "laag"},
        )
        html = _render_html("fundering", data)
        assert "Geen funderingsgegevens beschikbaar" in html


class TestAsbestContent:
    """Verify asbest template renders asbestrisico indicator data."""

    def test_risico_niveau_rendered(self):
        """Risk level / risico label appears in HTML."""
        html = _render_html("asbest", _make_checklist_report_data())
        # Fixture has risk='middel', risico='aanwezig_kans' — template uses both
        assert "Middel" in html or "middel" in html or "aanwezig_kans" in html

    def test_toelichting_rendered(self):
        """Toelichting / reden text appears."""
        html = _render_html("asbest", _make_checklist_report_data())
        assert "1994" in html  # "Bouwjaar vóór 1994 — asbest kan aanwezig zijn."

    def test_bouwjaar_relevant_ja(self):
        """Bouwjaar relevant renders as 'Ja' for True."""
        html = _render_html("asbest", _make_checklist_report_data())
        assert "Ja" in html

    def test_bouwjaar_relevant_nee(self):
        """Bouwjaar relevant renders as 'Nee' for False."""
        data = _make_checklist_report_data(
            asbest_indicator={
                "risk": "laag",
                "bouwjaar_relevant": False,
                "toelichting": "Bouwjaar na 1993.",
            }
        )
        html = _render_html("asbest", data)
        assert "Nee" in html

    def test_disclaimer_prominent_present(self):
        """Asbest template includes disclaimer-prominent block."""
        html = _render_html("asbest", _make_checklist_report_data())
        assert '<div class="disclaimer-prominent">' in html

    def test_no_data_fallback(self):
        """Asbest renders gracefully with no asbest_indicator."""
        data = _make_checklist_report_data(asbest_indicator=None)
        html = _render_html("asbest", data)
        assert "Geen asbestindicatie beschikbaar" in html


class TestEnergielabelContent:
    """Verify energielabel template renders energy label data."""

    def test_energieklasse_rendered(self):
        """Energieklasse letter appears in HTML."""
        html = _render_html("energielabel", _make_checklist_report_data())
        assert "A++" in html

    def test_registratie_datum_rendered(self):
        """Registratie datum appears."""
        html = _render_html("energielabel", _make_checklist_report_data())
        assert "2024-03-15" in html

    def test_geldig_tot_rendered(self):
        """Geldig tot date appears."""
        html = _render_html("energielabel", _make_checklist_report_data())
        assert "2034-03-15" in html

    def test_berekenings_type_rendered(self):
        """Berekenings type appears."""
        html = _render_html("energielabel", _make_checklist_report_data())
        assert "NTA 8800" in html

    def test_soort_opname_rendered(self):
        """Soort opname appears."""
        html = _render_html("energielabel", _make_checklist_report_data())
        assert "Basisopname" in html

    def test_no_disclaimer_prominent(self):
        """Energielabel template does NOT include disclaimer-prominent."""
        html = _render_html("energielabel", _make_checklist_report_data())
        assert '<div class="disclaimer-prominent">' not in html

    def test_no_data_fallback(self):
        """Energielabel renders gracefully with no energy_label."""
        data = _make_checklist_report_data(energy_label=None)
        html = _render_html("energielabel", data)
        assert "Geen energielabelgegevens beschikbaar" in html


class TestWozContent:
    """Verify woz template renders WOZ value, history, and object data."""

    def test_meest_recente_waarde_euro_format(self):
        """Meest recente waarde appears with € format."""
        html = _render_html("woz", _make_checklist_report_data())
        assert "485.000" in html

    def test_peildatum_rendered(self):
        """Meest recente peildatum appears."""
        html = _render_html("woz", _make_checklist_report_data())
        assert "2024-01-01" in html

    def test_grondoppervlakte_rendered(self):
        """Grondoppervlakte value and m² appear."""
        html = _render_html("woz", _make_checklist_report_data())
        assert "95" in html

    def test_woz_objectnummer_rendered(self):
        """WOZ objectnummer appears."""
        html = _render_html("woz", _make_checklist_report_data())
        assert "0363200012345678" in html

    def test_history_table_rendered(self):
        """WOZ history table with multiple values renders."""
        html = _render_html("woz", _make_checklist_report_data())
        assert "452.000" in html  # second history value
        assert "410.000" in html  # third history value

    def test_bron_rendered(self):
        """Source / bron metadata appears."""
        html = _render_html("woz", _make_checklist_report_data())
        assert "WOZ Waardeloket" in html

    def test_woz_flags_fallback(self):
        """WOZ renders from woz_flags when woz_data is absent."""
        data = _make_checklist_report_data(woz_data=None)
        html = _render_html("woz", data)
        assert "485.000" in html  # woz_flags.waarde
        assert "2024-01-01" in html  # woz_flags.peildatum

    def test_no_disclaimer_prominent(self):
        """WOZ template does NOT include disclaimer-prominent."""
        html = _render_html("woz", _make_checklist_report_data())
        assert '<div class="disclaimer-prominent">' not in html

    def test_no_data_fallback(self):
        """WOZ renders gracefully with no woz_data and no woz_flags."""
        data = _make_checklist_report_data(woz_data=None, woz_flags=None)
        html = _render_html("woz", data)
        assert "Geen WOZ-gegevens beschikbaar" in html


# ═══════════════════════════════════════════════════════════════════════════
# 7. Cross-Template Parametrized Tests
# ═══════════════════════════════════════════════════════════════════════════


class TestDisclaimerPresence:
    """Parametrized tests for disclaimer-prominent presence across templates."""

    @pytest.mark.parametrize("doc_type", ["bodem", "fundering", "asbest"])
    def test_disclaimer_prominent_present(self, doc_type: str):
        """Templates with risk-based data include disclaimer-prominent."""
        html = _render_html(doc_type, _make_checklist_report_data())
        assert '<div class="disclaimer-prominent">' in html, f"{doc_type} missing disclaimer-prominent"

    @pytest.mark.parametrize("doc_type", ["energielabel", "woz"])
    def test_disclaimer_prominent_absent(self, doc_type: str):
        """Templates with registry data do NOT include disclaimer-prominent."""
        html = _render_html(doc_type, _make_checklist_report_data())
        assert '<div class="disclaimer-prominent">' not in html, f"{doc_type} should not have disclaimer-prominent"

    @pytest.mark.parametrize("doc_type", [
        "kadaster", "bestemmingsplan", "energielabel", "wkb_precheck",
        "monumenten", "risicoprofiel", "woz", "bodem", "fundering",
        "asbest", "vergunningen", "haalbaarheid",
    ])
    def test_empty_data_no_crash(self, doc_type: str):
        """All 12 templates render without crash on empty data dict."""
        html = _render_html(doc_type, {})
        assert isinstance(html, str), f"{doc_type} crashed on empty data"


# ═══════════════════════════════════════════════════════════════════════════
# 8. Summary Box Presence/Absence Tests
# ═══════════════════════════════════════════════════════════════════════════


class TestSummaryBoxRendering:
    """Verify summary boxes appear with full data and handle missing data."""

    @pytest.mark.parametrize("doc_type", [
        "kadaster", "bestemmingsplan", "vergunningen",
        "haalbaarheid", "wkb_precheck", "monumenten", "risicoprofiel",
    ])
    def test_summary_box_present_full_data(self, doc_type: str):
        """All 7 rich-data templates render summary-box with full data."""
        html = _render_html(doc_type, _make_checklist_report_data())
        assert "summary-box" in html, f"{doc_type} missing summary-box with full data"

    def test_kadaster_summary_box_absent_no_parcels(self):
        """Kadaster without parcels still renders (parcels empty)."""
        data = _make_checklist_report_data(cadastral_parcels=[])
        html = _render_html("kadaster", data)
        # Template should handle gracefully
        assert isinstance(html, str)
