"""Tests for address extraction from Dutch SRU bekendmaking titles.

Covers all major bekendmaking title formats from Officiële Bekendmakingen,
based on real-world examples from municipalities like Venlo, Arnhem, Den Haag,
Amersfoort, and others.
"""

import pytest

from app.services.address_extractor import extract_address_from_title, extract_huisnummer


class TestExtractHuisnummer:
    """Tests for the extract_huisnummer helper function."""

    def test_simple_street_with_number(self) -> None:
        assert extract_huisnummer("Kerkstraat 42") == 42

    def test_number_with_letter_suffix(self) -> None:
        assert extract_huisnummer("Laan van Meerdervoort 123-A") == 123

    def test_number_with_lowercase_suffix(self) -> None:
        assert extract_huisnummer("Dorpsstraat 15a") == 15

    def test_no_number_returns_none(self) -> None:
        assert extract_huisnummer("No number here") is None

    def test_empty_string_returns_none(self) -> None:
        assert extract_huisnummer("") is None

    def test_number_at_end_of_multiword_street(self) -> None:
        assert extract_huisnummer("Parkweg 88") == 88

    def test_large_number(self) -> None:
        assert extract_huisnummer("Hoofdweg 1234") == 1234


class TestExtractAddressFromTitle:
    """Tests for the main extract_address_from_title function.

    Tests cover all documented SRU bekendmaking title formats (A through I).
    """

    # -------------------------------------------------------------------
    # Format A: "Address, keyword Type (date)"
    # "Kerkstraat 42, 1234AB Venlo, aangevraagde Omgevingsvergunning (15-02-2026)"
    # -------------------------------------------------------------------

    def test_format_a_basic_aangevraagde(self) -> None:
        title = "Kerkstraat 42, 1234AB Venlo, aangevraagde Omgevingsvergunning (15-02-2026)"
        result = extract_address_from_title(title)
        assert result is not None
        assert result["street"] == "Kerkstraat"
        assert result["huisnummer"] == 42
        assert result["postcode"] == "1234AB"
        assert result["city"] == "Venlo"

    def test_format_a_verleende(self) -> None:
        title = "Marktstraat 5, 5900AA Venlo, verleende Omgevingsvergunning (01-01-2026)"
        result = extract_address_from_title(title)
        assert result is not None
        assert result["street"] == "Marktstraat"
        assert result["huisnummer"] == 5
        assert result["postcode"] == "5900AA"
        assert result["city"] == "Venlo"

    def test_format_a_geweigerde(self) -> None:
        title = "Stationslaan 99, 3800XY Utrecht, geweigerde Omgevingsvergunning (03-03-2026)"
        result = extract_address_from_title(title)
        assert result is not None
        assert result["street"] == "Stationslaan"
        assert result["huisnummer"] == 99
        assert result["postcode"] == "3800XY"

    # -------------------------------------------------------------------
    # Format B: "Keyword Type Address, Postcode City"
    # "Verleende Omgevingsvergunning - Marktplein 7, 5935 BG Steyl"
    # -------------------------------------------------------------------

    def test_format_b_postcode_anchored(self) -> None:
        title = "Verleende Omgevingsvergunning - Marktplein 7, 5935 BG Steyl"
        result = extract_address_from_title(title)
        assert result is not None
        assert result["street"] == "Marktplein"
        assert result["huisnummer"] == 7
        assert result["postcode"] == "5935BG"
        assert result["city"] == "Steyl"

    def test_format_b_postcode_no_space(self) -> None:
        title = "Verleende Omgevingsvergunning - Hoofdstraat 1, 1011AB Amsterdam"
        result = extract_address_from_title(title)
        assert result is not None
        assert result["street"] == "Hoofdstraat"
        assert result["huisnummer"] == 1
        assert result["postcode"] == "1011AB"
        assert result["city"] == "Amsterdam"

    # -------------------------------------------------------------------
    # Format C: "Keyword for activity, Address, Postcode City"
    # "Aanvraag omgevingsvergunning voor het kappen van een boom, Dorpsstraat 15a, 3812 KV Amersfoort"
    # -------------------------------------------------------------------

    def test_format_c_activity_description_with_toevoeging(self) -> None:
        title = "Aanvraag omgevingsvergunning voor het kappen van een boom, Dorpsstraat 15a, 3812 KV Amersfoort"
        result = extract_address_from_title(title)
        assert result is not None
        assert result["street"] == "Dorpsstraat"
        assert result["huisnummer"] == 15
        assert result["huisnummer_toevoeging"] == "a"
        assert result["postcode"] == "3812KV"
        assert result["city"] == "Amersfoort"

    def test_format_c_bouwen_activity(self) -> None:
        title = "Aanvraag omgevingsvergunning voor het bouwen van een aanbouw, Bergweg 22, 6800AA Arnhem"
        result = extract_address_from_title(title)
        assert result is not None
        assert result["street"] == "Bergweg"
        assert result["huisnummer"] == 22
        assert result["postcode"] == "6800AA"

    # -------------------------------------------------------------------
    # Format D: "Address without postcode, keyword Type"
    # "Hoofdweg 123, aangevraagde Omgevingsvergunning"
    # -------------------------------------------------------------------

    def test_format_d_no_postcode_with_keyword(self) -> None:
        title = "Hoofdweg 123, aangevraagde Omgevingsvergunning"
        result = extract_address_from_title(title)
        assert result is not None
        assert result["street"] == "Hoofdweg"
        assert result["huisnummer"] == 123
        assert result["postcode"] is None
        assert result["city"] is None

    # -------------------------------------------------------------------
    # Format E: "Keyword Type Address (no postcode, no comma)"
    # "Omgevingsvergunning Parkweg 88"
    # -------------------------------------------------------------------

    def test_format_e_bare_street_number_after_keyword(self) -> None:
        title = "Omgevingsvergunning Parkweg 88"
        result = extract_address_from_title(title)
        assert result is not None
        assert result["street"] == "Parkweg"
        assert result["huisnummer"] == 88
        assert result["postcode"] is None

    # -------------------------------------------------------------------
    # Format F: "With huisnummer additions"
    # "Reguliere omgevingsvergunning Laan van Meerdervoort 123-A, 2517 AZ Den Haag"
    # -------------------------------------------------------------------

    def test_format_f_huisnummer_with_dash_suffix(self) -> None:
        title = "Reguliere omgevingsvergunning Laan van Meerdervoort 123-A, 2517 AZ Den Haag"
        result = extract_address_from_title(title)
        assert result is not None
        assert result["street"] == "Laan van Meerdervoort"
        assert result["huisnummer"] == 123
        assert result["huisnummer_toevoeging"] == "A"
        assert result["postcode"] == "2517AZ"
        assert result["city"] == "Den Haag"

    def test_format_f_multiword_street_with_toevoeging(self) -> None:
        title = "Omgevingsvergunning Jan van Galenstraat 10b, 1051 KM Amsterdam"
        result = extract_address_from_title(title)
        assert result is not None
        assert result["street"] == "Jan van Galenstraat"
        assert result["huisnummer"] == 10
        assert result["huisnummer_toevoeging"] == "b"
        assert result["postcode"] == "1051KM"

    # -------------------------------------------------------------------
    # Format G: "Bestemmingsplan naam" (no address — should return None)
    # "Bestemmingsplan Buitengebied 2020, herziening 3"
    # -------------------------------------------------------------------

    def test_format_g_bestemmingsplan_returns_none(self) -> None:
        title = "Bestemmingsplan Buitengebied 2020, herziening 3"
        result = extract_address_from_title(title)
        assert result is None

    def test_format_g_wijzigingsplan_returns_none(self) -> None:
        title = "Wijzigingsplan Buitengebied 2022"
        result = extract_address_from_title(title)
        assert result is None

    def test_format_g_inpassingsplan_returns_none(self) -> None:
        title = "Provinciaal Inpassingsplan Stikstof"
        result = extract_address_from_title(title)
        assert result is None

    # -------------------------------------------------------------------
    # Format H: "Gemeente Venlo - Omgevingsvergunning, Address, Postcode City"
    # -------------------------------------------------------------------

    def test_format_h_gemeente_prefix(self) -> None:
        title = "Gemeente Venlo - Omgevingsvergunning, Kaldenkerkerweg 88, 5913AE Venlo"
        result = extract_address_from_title(title)
        assert result is not None
        assert result["street"] == "Kaldenkerkerweg"
        assert result["huisnummer"] == 88
        assert result["postcode"] == "5913AE"
        assert result["city"] == "Venlo"

    def test_format_h_gemeente_prefix_with_spaced_postcode(self) -> None:
        title = "Gemeente Arnhem - Vergunning aanvragen, Kronenburgsingel 100, 6831 GM Arnhem"
        result = extract_address_from_title(title)
        assert result is not None
        assert result["street"] == "Kronenburgsingel"
        assert result["huisnummer"] == 100
        assert result["postcode"] == "6831GM"
        assert result["city"] == "Arnhem"

    # -------------------------------------------------------------------
    # Format I: "ter inzage / ontwerpbesluit patterns"
    # "Ontwerpbesluit omgevingsvergunning Stationsweg 5, 6811 MH Arnhem"
    # -------------------------------------------------------------------

    def test_format_i_ontwerpbesluit(self) -> None:
        title = "Ontwerpbesluit omgevingsvergunning Stationsweg 5, 6811 MH Arnhem"
        result = extract_address_from_title(title)
        assert result is not None
        assert result["street"] == "Stationsweg"
        assert result["huisnummer"] == 5
        assert result["postcode"] == "6811MH"
        assert result["city"] == "Arnhem"

    def test_format_i_ter_inzage(self) -> None:
        title = "Ter inzage omgevingsvergunning Prins Bernhardlaan 3, 7314 BE Apeldoorn"
        result = extract_address_from_title(title)
        assert result is not None
        assert result["street"] == "Prins Bernhardlaan"
        assert result["huisnummer"] == 3
        assert result["postcode"] == "7314BE"
        assert result["city"] == "Apeldoorn"

    # -------------------------------------------------------------------
    # Return value structure tests
    # -------------------------------------------------------------------

    def test_full_address_field_is_populated(self) -> None:
        title = "Kerkstraat 42, 1234AB Venlo, aangevraagde Omgevingsvergunning (15-02-2026)"
        result = extract_address_from_title(title)
        assert result is not None
        assert "full_address" in result
        assert result["full_address"] is not None
        assert len(result["full_address"]) > 0

    def test_postcode_normalized_no_space(self) -> None:
        """Postcodes with space ("5935 BG") must be normalized to "5935BG"."""
        title = "Verleende Omgevingsvergunning - Marktplein 7, 5935 BG Steyl"
        result = extract_address_from_title(title)
        assert result is not None
        assert result["postcode"] == "5935BG"
        assert " " not in result["postcode"]

    def test_no_address_returns_none(self) -> None:
        title = "Kennisgeving terinzagelegging ontwerp"
        result = extract_address_from_title(title)
        assert result is None

    def test_generic_title_returns_none(self) -> None:
        title = "Ingekomen bouwaanvragen week 8"
        result = extract_address_from_title(title)
        assert result is None

    def test_result_has_all_expected_keys(self) -> None:
        title = "Kerkstraat 42, 1234AB Venlo, aangevraagde Omgevingsvergunning (15-02-2026)"
        result = extract_address_from_title(title)
        assert result is not None
        expected_keys = {"street", "huisnummer", "huisnummer_toevoeging", "postcode", "city", "full_address"}
        assert set(result.keys()) == expected_keys

    def test_huisnummer_toevoeging_is_none_when_absent(self) -> None:
        title = "Kerkstraat 42, 1234AB Venlo, aangevraagde Omgevingsvergunning (15-02-2026)"
        result = extract_address_from_title(title)
        assert result is not None
        assert result["huisnummer_toevoeging"] is None

    # -------------------------------------------------------------------
    # Edge cases
    # -------------------------------------------------------------------

    def test_empty_string_returns_none(self) -> None:
        assert extract_address_from_title("") is None

    def test_whitespace_only_returns_none(self) -> None:
        assert extract_address_from_title("   ") is None

    def test_address_with_city_two_words(self) -> None:
        """Den Haag, 's-Hertogenbosch etc. are two-word cities."""
        title = "Reguliere omgevingsvergunning Laan van Meerdervoort 123-A, 2517 AZ Den Haag"
        result = extract_address_from_title(title)
        assert result is not None
        assert result["city"] == "Den Haag"
