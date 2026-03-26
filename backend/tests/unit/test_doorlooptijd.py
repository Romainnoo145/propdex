"""Tests for doorlooptijd.py — 3 pure functions.

Covers extract_filing_date (Dutch month regex + numeric date format),
compute_doorlooptijd (ISO date diff), and extract_relevant_sections
(section marker extraction + fallback). Skips async get_doorlooptijd_stats.
"""

import pytest

from app.services.doorlooptijd import (
    compute_doorlooptijd,
    extract_filing_date,
    extract_relevant_sections,
)


# ---------------------------------------------------------------------------
# extract_filing_date
# ---------------------------------------------------------------------------


class TestExtractFilingDate:
    """Filing date extraction from Dutch legal text."""

    def test_beroepschrift_ingediend_pattern(self):
        text = "Het beroepschrift is ingediend op 15 maart 2023 door verzoeker."
        assert extract_filing_date(text) == "2023-03-15"

    def test_beroepschrift_without_is(self):
        text = "Het beroepschrift ingediend op 1 januari 2022 bij de rechtbank."
        assert extract_filing_date(text) == "2022-01-01"

    def test_bezwaarschrift_van_pattern(self):
        text = "Naar aanleiding van het bezwaarschrift van 20 december 2021 is besloten."
        assert extract_filing_date(text) == "2021-12-20"

    def test_ingekomen_op_numeric_pattern(self):
        text = "Het verzoek is ingekomen op 05-07-2024 en geregistreerd."
        assert extract_filing_date(text) == "2024-07-05"

    def test_ontvangen_op_numeric_slash(self):
        text = "Het bezwaar is ontvangen op 12/11/2023 per post."
        assert extract_filing_date(text) == "2023-11-12"

    def test_dutch_month_juni(self):
        text = "beroepschrift ingediend op 3 juni 2020 door reclamant"
        assert extract_filing_date(text) == "2020-06-03"

    def test_dutch_month_augustus(self):
        text = "bezwaarschrift van 28 augustus 2019 ingediend"
        assert extract_filing_date(text) == "2019-08-28"

    def test_no_match_returns_none(self):
        text = "Dit is een willekeurige tekst zonder datumvermelding."
        assert extract_filing_date(text) is None

    def test_empty_string_returns_none(self):
        assert extract_filing_date("") is None

    def test_only_searches_first_3000_chars(self):
        """Filing date beyond 3000 chars should not be found."""
        padding = "x" * 3001
        text = padding + "beroepschrift ingediend op 1 januari 2022"
        assert extract_filing_date(text) is None

    def test_invalid_date_skipped(self):
        """31 februari is invalid — should return None."""
        text = "beroepschrift ingediend op 31 februari 2023 door verzoeker."
        assert extract_filing_date(text) is None

    def test_unknown_month_name_skipped(self):
        text = "beroepschrift ingediend op 15 foobar 2023 door verzoeker."
        assert extract_filing_date(text) is None

    def test_case_insensitive(self):
        text = "Het BEROEPSCHRIFT is INGEDIEND op 10 OKTOBER 2022 door advocaat."
        assert extract_filing_date(text) == "2022-10-10"


# ---------------------------------------------------------------------------
# compute_doorlooptijd
# ---------------------------------------------------------------------------


class TestComputeDoorlooptijd:
    """Procedure duration computation tests."""

    def test_positive_duration(self):
        assert compute_doorlooptijd("2024-06-15", "2024-01-10") == 157

    def test_same_day_returns_none(self):
        assert compute_doorlooptijd("2024-01-01", "2024-01-01") is None

    def test_negative_returns_none(self):
        """Filing date after ruling date is nonsensical."""
        assert compute_doorlooptijd("2024-01-01", "2024-06-15") is None

    def test_truncates_timestamp(self):
        """Accepts datetime strings, only uses first 10 chars."""
        assert compute_doorlooptijd("2024-06-15T12:00:00", "2024-06-10T08:00:00") == 5

    def test_invalid_date_returns_none(self):
        assert compute_doorlooptijd("not-a-date", "2024-01-01") is None

    def test_none_input_returns_none(self):
        assert compute_doorlooptijd(None, "2024-01-01") is None

    def test_one_day_duration(self):
        assert compute_doorlooptijd("2024-01-02", "2024-01-01") == 1


# ---------------------------------------------------------------------------
# extract_relevant_sections
# ---------------------------------------------------------------------------


class TestExtractRelevantSections:
    """Section extraction from Dutch court ruling text."""

    def test_empty_text(self):
        assert extract_relevant_sections("") == ""

    def test_short_text_returned_as_is(self):
        text = "Korte uitspraak tekst"
        assert extract_relevant_sections(text, max_chars=100) == text

    def test_finds_overwegingen_marker(self):
        text = "PROCEDUREVERLOOP blah blah " + "x" * 200 + " OVERWEGINGEN De rechtbank overweegt..."
        result = extract_relevant_sections(text, max_chars=100)
        assert result.startswith("OVERWEGINGEN")

    def test_finds_beoordeling_marker(self):
        text = "Header info " + "x" * 200 + " BEOORDELING De beoordeling luidt als volgt..."
        result = extract_relevant_sections(text, max_chars=100)
        assert result.startswith("BEOORDELING")

    def test_earliest_marker_wins(self):
        text = "Intro " + "x" * 200 + " HET GESCHIL " + "x" * 200 + " BEOORDELING rest"
        result = extract_relevant_sections(text, max_chars=100)
        assert result.startswith("HET GESCHIL")

    def test_fallback_last_60_percent(self):
        """No markers → returns from 40% offset."""
        text = "A" * 100 + "B" * 100  # 200 chars total
        result = extract_relevant_sections(text, max_chars=50)
        # Start at 40% = char 80, so first char should be 'A' (still in first 100)
        assert len(result) == 50
        assert result[0] == "A"  # position 80 is still in the A block

    def test_max_chars_respected(self):
        marker_text = "OVERWEGINGEN " + "x" * 20000
        result = extract_relevant_sections(marker_text, max_chars=500)
        assert len(result) <= 500

    def test_case_insensitive_marker_search(self):
        """Markers are searched in uppercased text."""
        text = "x" * 200 + "overwegingen De rechtbank..." + "x" * 200
        # The function does upper_text.find(MARKER) where MARKER is uppercase
        # and text is uppercased, so this should match
        result = extract_relevant_sections(text, max_chars=100)
        # Found at position 200 — returns from original text at that position
        assert "overwegingen" in result.lower()
