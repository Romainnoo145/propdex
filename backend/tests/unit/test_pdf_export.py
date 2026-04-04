"""Unit tests for PDF export module (Jinja2 template + WeasyPrint).

Tests are SYNCHRONOUS (def test_*, not async def) because WeasyPrint is CPU-bound.
"""

import asyncio
from unittest.mock import patch

from app.reports.pdf_export import generate_report_pdf


def _make_report_data(**overrides):
    """Create complete PropertyReportResponse-compatible dict with sensible defaults.

    Includes all 13 enrichment fields added in M016-S02 (T01/T02):
    energy_label, woz_data, brk_ownership, buildability_delta,
    wkb_classification, wkb_precheck, soil_profile, funderingsrisicogebied,
    fysiek_risico_profiel, use_case_scores, market_signals,
    scores_v3, score_breakdown_v3.
    """
    base = {
        "address": {
            "nummeraanduiding_id": "0363200000406628",
            "straat": "Keizersgracht",
            "straatnaam": "Keizersgracht",
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
        "completeness_score": 0.85,
        "resolved_at": "2026-02-07T12:00:00Z",
        "cadastral_parcels": [],
        "data_sources": [],
        "errors": [],
        "zoning": None,
        "monuments": None,
        "map_data": None,
        "section_sources": [],
        "ai_parsing": None,
        # --- Fields added in M016-S02 T01 ---
        "energy_label": {
            "is_geregistreerd": True,
            "energieklasse": "A++",
            "registratie_datum": "2024-03-15",
            "geldig_tot": "2034-03-15",
            "is_geldig": True,
            "berekenings_type": "NTA 8800",
        },
        "woz_data": {
            "meest_recente_waarde": 685000,
            "meest_recente_peildatum": "2024-01-01",
            "grondoppervlakte": 120,
            "low_confidence": False,
            "bron": "WOZ Waardeloket",
            "waarden": [
                {"peildatum": "2024-01-01", "vastgestelde_waarde": 685000},
                {"peildatum": "2023-01-01", "vastgestelde_waarde": 620000},
            ],
        },
        "brk_ownership": {
            "status": "available",
            "fetched_at": "2026-03-20T10:00:00Z",
            "data": [
                {
                    "perceel_identificatie": "ASD01-F-1234",
                    "gerechtigden": [
                        {
                            "eigenaar_type": "rechtspersoon",
                            "naam": "Propdex Vastgoed B.V.",
                            "kvk_nummer": "12345678",
                            "zakelijk_recht_type": "Eigendom",
                            "aandeel": "1/1",
                            "koopsom": 450000,
                            "koopjaar": 2019,
                        },
                        {
                            "eigenaar_type": "natuurlijk_persoon",
                            "naam": "Jan de Geheime Eigenaar",
                            "zakelijk_recht_type": "Hypotheek",
                            "aandeel": "1/1",
                            "koopsom": None,
                            "koopjaar": None,
                        },
                    ],
                    "heeft_hypotheek": False,
                    "hypotheken": [],
                    "beslagen": [],
                }
            ],
        },
        "buildability_delta": {
            "parcel_area_m2": 200.0,
            "current_built_area_m2": 120.0,
            "current_built_ratio_pct": 60.0,
            "max_bebouwingspercentage_pct": 80.0,
            "max_buildable_area_m2": 160.0,
            "remaining_buildable_area_m2": 40.0,
            "current_far": 0.75,
        },
        "wkb_classification": {
            "wkb_applicable": True,
            "gevolgklasse": "GK1",
            "exclusion_reason": None,
            "disclaimer": "Deze indicatie is niet-bindend.",
        },
        "wkb_precheck": {
            "status": "likely_required",
            "confidence": "medium",
            "triggered_rules": [
                {
                    "title": "Grondgebonden woning",
                    "impact": "increase",
                    "reason": "BAG gebruiksdoel is woonfunctie",
                }
            ],
            "missing_inputs": ["omgevingsvergunning_type"],
            "required_documents": ["Constructieberekening", "Geotechnisch rapport"],
            "disclaimer": "Deze precheck is indicatief.",
        },
        # --- Fields added in M016-S02 T02 ---
        "soil_profile": {
            "dominant_type_label": "Klei",
            "soilname": "Poldervaaggrond",
            "soilcode": "Mv51A",
            "disclaimer": "Bron: BRO Bodemkaart 1:50.000 (PDOK)",
        },
        "funderingsrisicogebied": {
            "legenda": "Indicatief hoog risico",
            "fgr": "FGR-AMS-001",
            "pc6": "1015CS",
            "percvoor1970": 85,
            "gemeente": "Amsterdam",
            "disclaimer": "Bron: PDOK Indicatieve Gebieden Funderingsproblematiek",
        },
        "fysiek_risico_profiel": {
            "overall_risk": "middel",
            "overall_explanation": "Combinatie van kleibodem en oud bouwjaar geeft matig funderingsrisico.",
            "foundation_risk": {
                "risk": "middel",
                "bouwjaar": 1890,
                "bodemtype": "klei",
                "reden": "Bouwjaar voor 1970 op kleigrond",
                "recommended_action": "Funderingsonderzoek aanbevolen",
            },
            "soil_profile": {
                "dominant_type_label": "Klei",
                "soilname": "Poldervaaggrond",
                "soilcode": "Mv51A",
            },
            "funderingsrisicogebied": {
                "legenda": "Indicatief hoog risico",
                "fgr": "FGR-AMS-001",
                "percvoor1970": 85,
            },
            "disclaimer": "Dit profiel is samengesteld uit meerdere bronnen en is indicatief.",
        },
        "use_case_scores": {
            "woningbouw": {"score": 72, "total": 72},
            "kantoor": {"score": 45, "total": 45},
            "retail": 38,
        },
        "market_signals": {
            "listing_duration_days": 45,
            "price_change_count": 2,
            "listing_snapshots_count": 5,
            "days_since_last_seen": 3,
            "source": "funda",
        },
        "scores_v3": {
            "potentie": 74.5,
            "risico": 32.1,
        },
        # --- Flags fields used by section 9 (Risicovlaggen) ---
        "bodem_flags": {"bodemkwaliteit": "Licht verontreinigd", "bron": "Bodemloket"},
        "bodemtype_flags": {"bodemtype": "Klei", "grondwaterstand": "Hoog"},
        "funderingsrisico_flags": {"risico": "Hoog", "bouwjaar_range": "< 1970"},
        "natura2000_flags": {"in_natura2000": False, "afstand_m": 2500},
        "overstromingsrisico_flags": {"risico_klasse": "Midden", "dijkring": "14"},
        "geluid_flags": {"geluidbelasting_dB": 58, "bron": "Rijkswaterstaat"},
        "luchtkwaliteit_flags": {"no2_ug_m3": 28.5, "pm10_ug_m3": 22.0},
        "energielabel_flags": {"energieklasse": "C", "registratie_datum": "2020-01-01"},
        "woz_flags": {"waarde": 450000, "peiljaar": 2023},
        "score_breakdown_v3": {
            "bouwjaar": {
                "waarde": 1890,
                "genormaliseerde_score": 0.65,
                "gewicht": 15,
                "bijdrage": 9.75,
                "toelichting_kort": "Historisch pand",
                "toelichting_lang": None,
                "categorie": "potentie",
                "missing": False,
            },
            "bodemrisico": {
                "waarde": "klei",
                "genormaliseerde_score": 0.4,
                "gewicht": 10,
                "bijdrage": 4.0,
                "toelichting_kort": "Kleigrond met matig risico",
                "toelichting_lang": None,
                "categorie": "risico",
                "missing": False,
            },
        },
    }
    base.update(overrides)
    return base


def _render_html(report_data, report_name="Test Report"):
    """Render the template and return the HTML string (mocks WeasyPrint)."""
    with patch("app.reports.due_diligence_export.HTML") as mock_html:
        mock_html.return_value.write_pdf.return_value = b"%PDF-1.4 test"
        generate_report_pdf(report_data, report_name)
        call_kwargs = mock_html.call_args.kwargs
        html_string = (
            call_kwargs.get("string")
            or mock_html.call_args[1].get("string")
            or (mock_html.call_args[0][0] if mock_html.call_args[0] else None)
        )
        assert html_string is not None, "HTML string not captured from mock"
        return html_string


class TestTemplateRendering:
    """Test Jinja2 template rendering with mocked WeasyPrint."""

    def test_template_renders_address_section(self):
        """Test template renders address section with all fields."""
        html = _render_html(_make_report_data())
        assert "Keizersgracht" in html
        assert "1015 CS" in html
        assert "Amsterdam" in html

    def test_template_renders_building_section(self):
        """Test template renders building section with all fields."""
        html = _render_html(_make_report_data())
        assert "1890" in html
        assert "Pand in gebruik" in html

    def test_template_renders_completeness_percentage(self):
        """Test template renders successfully with completeness data."""
        html = _render_html(_make_report_data(completeness_score=0.85))
        assert html is not None
        assert "Due Diligence" in html

    def test_template_handles_missing_zoning(self):
        """Test template renders Dutch fallback text when zoning is None."""
        html = _render_html(_make_report_data(zoning=None))
        assert "Geen bestemmingsplangegevens beschikbaar" in html

    def test_template_handles_missing_monuments(self):
        """Test template renders when monuments is None."""
        html = _render_html(_make_report_data(monuments=None))
        assert html is not None

    def test_template_has_clickable_toc(self):
        """Verify v2 template contains clickable TOC anchor links and matching section IDs."""
        html = _render_html(_make_report_data())
        assert 'href="#section-1"' in html, "TOC link to section-1 missing"
        assert 'id="section-1"' in html, "Section-1 id attribute missing"
        # Spot-check a middle section too
        assert 'href="#section-5"' in html, "TOC link to section-5 missing"
        assert 'id="section-5"' in html, "Section-5 id attribute missing"

    def test_template_has_all_sections(self):
        """Verify v2 template contains sections 8 and 9 with real content."""
        html = _render_html(_make_report_data())
        assert 'id="section-8"' in html, "Section-8 missing"
        assert 'id="section-9"' in html, "Section-9 missing"
        assert "Vergunning-Checklists" in html, "Section 8 title missing"
        assert "Ruwe Data Appendix" in html, "Section 9 title missing"
        # Verify no stub text remains anywhere
        assert "Inhoud wordt toegevoegd" not in html, "Stub placeholder text still present"


class TestNewFieldRendering:
    """Test rendering of fields added in M016-S02 (T01/T02)."""

    def test_template_renders_energy_label(self):
        """Verify energielabel fields appear in rendered HTML."""
        html = _render_html(_make_report_data())
        assert "Energielabel" in html
        assert "A++" in html
        assert "2024-03-15" in html
        assert "NTA 8800" in html

    def test_template_renders_energy_label_fallback(self):
        """Verify energielabel_flags fallback renders when energy_label is absent."""
        html = _render_html(_make_report_data(
            energy_label=None,
            energielabel_flags={"energieklasse": "C", "registratie_datum": "2020-01-01"},
        ))
        assert "Energielabel" in html
        assert "C" in html  # fallback label value rendered

    def test_template_renders_woz_data(self):
        """Verify WOZ waarde appears in rendered HTML."""
        html = _render_html(_make_report_data())
        assert "WOZ-waarde" in html
        assert "685.000" in html  # formatted with Dutch thousands separator
        assert "2024-01-01" in html

    def test_template_renders_woz_history(self):
        """Verify WOZ history table renders when multiple waarden present."""
        html = _render_html(_make_report_data())
        assert "WOZ-waardenhistorie" in html
        assert "620.000" in html

    def test_template_renders_brk_ownership_rechtspersoon(self):
        """Verify rechtspersoon name is shown in BRK ownership section."""
        html = _render_html(_make_report_data())
        assert "Propdex Vastgoed B.V." in html
        assert "12345678" in html  # KvK number
        assert "Eigendom" in html  # zakelijk recht type
        assert "450.000" in html  # koopsom formatted

    def test_brk_avoids_natuurlijk_persoon_names(self):
        """AVG compliance: verify natuurlijk_persoon naam is NOT in rendered HTML."""
        html = _render_html(_make_report_data())
        assert "Jan de Geheime Eigenaar" not in html
        assert "Niet getoond (AVG)" in html

    def test_template_renders_buildability_delta(self):
        """Verify buildability delta section renders."""
        html = _render_html(_make_report_data())
        assert "Bouwenvelop-analyse" in html
        assert "40" in html  # remaining_buildable_area_m2
        assert "uitbreidingsruimte" in html

    def test_template_renders_wkb_classification(self):
        """Verify Wkb gevolgklasse section renders."""
        html = _render_html(_make_report_data())
        assert "Wkb Gevolgklasse" in html
        assert "GK1" in html

    def test_template_renders_wkb_precheck(self):
        """Verify Wkb precheck section renders with rules and documents."""
        html = _render_html(_make_report_data())
        assert "Wkb Startdossier Precheck" in html
        assert "Grondgebonden woning" in html
        assert "Constructieberekening" in html

    def test_template_renders_fysiek_risico_profiel(self):
        """Verify fysiek_risico_profiel composite block renders."""
        html = _render_html(_make_report_data())
        assert "Fysiek Risicoprofiel" in html
        assert "Funderingsrisico" in html
        assert "Funderingsonderzoek aanbevolen" in html
        assert "Poldervaaggrond" in html  # soil sub-block

    def test_fysiek_risico_profiel_suppresses_standalone_soil(self):
        """When fysiek_risico_profiel present, standalone soil_profile section is suppressed."""
        html = _render_html(_make_report_data())
        # The standalone "4.1b Bodemtype (BRO)" should NOT appear when
        # fysiek_risico_profiel is present (overlap suppression)
        assert "4.1b Bodemtype (BRO)" not in html

    def test_template_renders_use_case_scores(self):
        """Verify use-case scores table appears with score values."""
        html = _render_html(_make_report_data())
        assert "Use-case scores" in html
        assert "Woningbouw" in html
        assert "Kantoor" in html
        assert "Hoog potentieel" in html  # woningbouw score 72 >= 70

    def test_template_renders_market_signals(self):
        """Verify market signals section renders."""
        html = _render_html(_make_report_data())
        assert "Marktsignalen" in html
        assert "45" in html  # listing_duration_days
        assert "Funda" in html  # source capitalized by title filter

    def test_template_renders_scores_v3_cover(self):
        """Verify scores_v3 renders on cover page circles."""
        html = _render_html(_make_report_data())
        assert "74" in html  # potentie rounded
        assert "32" in html  # risico rounded

    def test_template_renders_score_factors(self):
        """Verify score_breakdown_v3 factors render in section 5."""
        html = _render_html(_make_report_data())
        assert "Potentiefactoren" in html
        assert "Risicofactoren" in html
        assert "Historisch pand" in html  # bouwjaar toelichting_kort
        assert "Kleigrond met matig risico" in html  # bodemrisico toelichting_kort


class TestPartialData:
    """Test template resilience with missing/partial data."""

    def test_partial_data_only_address(self):
        """Minimal data (only address) generates valid PDF without crash."""
        minimal = {
            "address": {
                "straat": "Teststraat",
                "huisnummer": 1,
                "postcode": "1000 AA",
                "woonplaats": "Teststad",
            },
            "building": None,
            "completeness_score": 0.0,
            "resolved_at": None,
            "cadastral_parcels": [],
            "data_sources": [],
            "errors": [],
            "zoning": None,
            "monuments": None,
            "map_data": None,
            "section_sources": [],
            "ai_parsing": None,
        }
        # Real WeasyPrint — must not crash
        result = generate_report_pdf(minimal, "Minimal Report")
        assert result.startswith(b"%PDF")
        assert len(result) > 100

    def test_partial_no_new_fields(self):
        """Report without any M016-S02 fields still renders correctly."""
        html = _render_html(_make_report_data(
            energy_label=None,
            woz_data=None,
            brk_ownership=None,
            buildability_delta=None,
            wkb_classification=None,
            wkb_precheck=None,
            soil_profile=None,
            funderingsrisicogebied=None,
            fysiek_risico_profiel=None,
            use_case_scores=None,
            market_signals=None,
            scores_v3=None,
            score_breakdown_v3=None,
        ))
        assert "Due Diligence" in html
        assert "Keizersgracht" in html
        # Sections with no data should not render their data tables
        assert "A++" not in html  # no energy label value
        assert "685.000" not in html  # no WOZ value
        assert "Woningbouw" not in html  # no use-case score entries
        assert "Marktsignalen" not in html  # no market signals heading

    def test_partial_brk_unavailable(self):
        """BRK ownership with status=unavailable renders info box."""
        html = _render_html(_make_report_data(
            brk_ownership={"status": "unavailable", "reason": "Geen API-sleutel geconfigureerd."},
        ))
        assert "Geen API-sleutel geconfigureerd" in html

    def test_partial_brk_error(self):
        """BRK ownership with status=error renders warning box."""
        html = _render_html(_make_report_data(
            brk_ownership={"status": "error", "reason": "Timeout bij Kadaster API."},
        ))
        assert "Timeout bij Kadaster API" in html

    def test_partial_energy_label_not_registered(self):
        """Energy label with is_geregistreerd=False shows reason."""
        html = _render_html(_make_report_data(
            energy_label={
                "is_geregistreerd": False,
                "niet_geregistreerd_reden": "Geen label gevonden bij EP-Online",
            },
        ))
        assert "Geen label gevonden bij EP-Online" in html


class TestPDFGeneration:
    """Test WeasyPrint PDF generation (real execution, no mocks)."""

    def test_generates_valid_pdf_bytes(self):
        """Test WeasyPrint generates valid PDF with magic bytes."""
        result = generate_report_pdf(_make_report_data(), "Test Report")
        assert result.startswith(b"%PDF")
        assert len(result) > 100

    def test_generates_pdf_with_minimal_data(self):
        """Test PDF generation handles minimal data without errors."""
        minimal_data = _make_report_data(
            completeness_score=0.0,
            zoning=None,
            monuments=None,
            cadastral_parcels=[],
            section_sources=[],
            energy_label=None,
            woz_data=None,
            brk_ownership=None,
            buildability_delta=None,
            wkb_classification=None,
            wkb_precheck=None,
            soil_profile=None,
            funderingsrisicogebied=None,
            fysiek_risico_profiel=None,
            use_case_scores=None,
            market_signals=None,
            scores_v3=None,
            score_breakdown_v3=None,
        )
        result = generate_report_pdf(minimal_data, "Minimal Report")
        assert result.startswith(b"%PDF")
        assert len(result) > 100

    def test_generates_pdf_with_all_new_fields(self):
        """Real WeasyPrint test with full enrichment data (all M016-S02 fields)."""
        result = generate_report_pdf(_make_report_data(), "Full Enrichment Report")
        assert result.startswith(b"%PDF")
        # Full enrichment report should be substantially larger than minimal
        assert len(result) > 500

    def test_returns_bytes_not_none(self):
        """Test generate_report_pdf returns bytes type, never None."""
        result = generate_report_pdf(_make_report_data(), "Test Report")
        assert result is not None
        assert isinstance(result, bytes)


class TestSection8Checklists:
    """Test section 8 vergunning-checklist rendering and edge cases."""

    def test_section8_renders_checklist_items(self):
        """Positive case: checklist items render with phase grouping for top use case."""
        html = _render_html(_make_report_data(
            use_case_scores={
                "optoppen": {"score": 75, "category": "Hoog"},
                "splitsen": {"score": 50, "category": "Gemiddeld"},
            },
        ))
        assert "Vergunning-Checklists" in html, "Section 8 header missing"
        # Top use case selected (optoppen has highest score)
        assert "Optoppen" in html, "Top use case name not rendered"
        # Phase headers should appear (voorbereiding is first phase)
        assert "Voorbereiding" in html, "First phase header missing"
        # Data table present in the checklist section
        assert "data-table" in html, "Checklist data-table missing"
        # No-data fallback should NOT appear
        assert "Geen vergunning-checklists beschikbaar" not in html

    def test_section8_no_data_when_no_scores(self):
        """No-data fallback renders when use_case_scores is None."""
        html = _render_html(_make_report_data(use_case_scores=None))
        assert "Geen vergunning-checklists beschikbaar" in html
        # Phase headers should not appear
        assert "Voorbereiding" not in html

    def test_section8_no_data_when_empty_scores(self):
        """No-data fallback renders when use_case_scores is empty dict."""
        html = _render_html(_make_report_data(use_case_scores={}))
        assert "Geen vergunning-checklists beschikbaar" in html
        assert "Voorbereiding" not in html

    def test_section8_handles_plain_number_scores(self):
        """Checklist renders when scores are plain numbers (not dicts)."""
        html = _render_html(_make_report_data(
            use_case_scores={"optoppen": 80, "splitsen": 60},
        ))
        assert "Optoppen" in html, "Top use case not selected from plain numbers"
        assert "Voorbereiding" in html, "Phase headers missing with plain number scores"
        assert "Geen vergunning-checklists beschikbaar" not in html

    def test_section8_non_checklist_use_case_falls_back(self):
        """Graceful fallback when only non-checklist use cases present."""
        html = _render_html(_make_report_data(
            use_case_scores={"woningbouw": {"score": 90, "category": "Hoog"}},
        ))
        # woningbouw is not in CHECKLISTS keys, so fallback should render
        assert "Geen vergunning-checklists beschikbaar" in html


class TestSection9RawDataAppendix:
    """Test section 9 raw data appendix rendering."""

    def test_section9_renders_score_breakdown(self):
        """Score breakdown table renders factor names and values from score_breakdown_v3."""
        html = _render_html(_make_report_data())
        assert "9.1 Score Breakdown" in html
        assert "bouwjaar" in html  # factor name
        assert "bodemrisico" in html  # factor name
        assert "0.65" in html  # genormaliseerde_score for bouwjaar
        assert "9.75" in html  # bijdrage for bouwjaar
        assert "Historisch pand" in html  # toelichting_kort

    def test_section9_renders_flags(self):
        """Flags field values appear in section 9.3 Risicovlaggen."""
        html = _render_html(_make_report_data())
        assert "9.3 Risicovlaggen" in html
        assert "Licht verontreinigd" in html  # bodem_flags.bodemkwaliteit
        assert "Hoog" in html  # funderingsrisico_flags.risico
        assert "Bodemloket" in html  # bodem_flags.bron
        assert "2500" in html  # natura2000_flags.afstand_m
        assert "28.5" in html  # luchtkwaliteit_flags.no2_ug_m3

    def test_section9_renders_completeness(self):
        """Completeness score value appears in section 9.4 Datakwaliteit."""
        html = _render_html(_make_report_data(completeness_score=0.85))
        assert "9.4 Datakwaliteit" in html
        assert "85.0%" in html  # 0.85 * 100 rounded to 1 decimal

    def test_section9_renders_errors(self):
        """Error messages appear when errors list is populated."""
        html = _render_html(_make_report_data(
            errors=["API timeout", "Kadaster onbereikbaar"],
        ))
        assert "API timeout" in html
        assert "Kadaster onbereikbaar" in html
        assert "Fouten" in html

    def test_section9_no_data_fallback(self):
        """No-data fallbacks render when all section-9 specific fields are None/empty."""
        html = _render_html(_make_report_data(
            score_breakdown_v3=None,
            scores_v3=None,
            use_case_scores=None,
            bodem_flags=None,
            bodemtype_flags=None,
            funderingsrisico_flags=None,
            natura2000_flags=None,
            overstromingsrisico_flags=None,
            geluid_flags=None,
            luchtkwaliteit_flags=None,
            energielabel_flags=None,
            woz_flags=None,
            completeness_score=None,
            errors=[],
        ))
        assert "Geen data beschikbaar" in html
        # Flag-specific values should NOT appear
        assert "Licht verontreinigd" not in html
        assert "9.75" not in html


class TestFunctionSignature:
    """Test function signature requirements."""

    def test_is_synchronous_function(self):
        """Test generate_report_pdf is NOT a coroutine function."""
        assert not asyncio.iscoroutinefunction(generate_report_pdf)
