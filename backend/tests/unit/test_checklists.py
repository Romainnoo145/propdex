"""Unit tests for checklist service — data integrity and endpoint shape."""

import pytest

from app.services.checklists import (
    CHECKLISTS,
    PHASE_ORDER,
    get_all_checklists,
    get_checklist,
)

USE_CASES = ["optoppen", "splitsen", "transformatie", "nieuwbouw"]
VALID_CTA_TYPES = {None, "generate_document", "request_quote", "external_link"}
REQUIRED_FIELDS = {"id", "category", "phase", "title", "description"}


class TestChecklistData:
    """Validate static checklist content integrity."""

    @pytest.mark.parametrize("use_case", USE_CASES)
    def test_use_case_returns_items(self, use_case: str) -> None:
        items = get_checklist(use_case)
        assert len(items) > 0, f"{use_case} returned no items"

    @pytest.mark.parametrize("use_case", USE_CASES)
    def test_all_items_have_valid_phase(self, use_case: str) -> None:
        items = get_checklist(use_case)
        for item in items:
            assert item.phase in PHASE_ORDER, (
                f"{item.id} has invalid phase '{item.phase}'"
            )

    @pytest.mark.parametrize("use_case", USE_CASES)
    def test_all_six_phases_present(self, use_case: str) -> None:
        items = get_checklist(use_case)
        phases_present = {item.phase for item in items}
        for phase in PHASE_ORDER:
            assert phase in phases_present, (
                f"{use_case} missing phase '{phase}'"
            )

    @pytest.mark.parametrize("use_case", USE_CASES)
    def test_item_count_in_range(self, use_case: str) -> None:
        items = get_checklist(use_case)
        assert 15 <= len(items) <= 25, (
            f"{use_case} has {len(items)} items (expected 15-25)"
        )

    @pytest.mark.parametrize("use_case", USE_CASES)
    def test_unique_ids(self, use_case: str) -> None:
        items = get_checklist(use_case)
        ids = [item.id for item in items]
        assert len(ids) == len(set(ids)), (
            f"{use_case} has duplicate IDs: {[i for i in ids if ids.count(i) > 1]}"
        )

    @pytest.mark.parametrize("use_case", USE_CASES)
    def test_required_fields_present(self, use_case: str) -> None:
        from dataclasses import asdict
        items = get_checklist(use_case)
        for item in items:
            d = asdict(item)
            for field in REQUIRED_FIELDS:
                assert field in d and d[field] is not None and d[field] != "", (
                    f"{item.id} missing required field '{field}'"
                )

    @pytest.mark.parametrize("use_case", USE_CASES)
    def test_cta_type_valid(self, use_case: str) -> None:
        items = get_checklist(use_case)
        for item in items:
            assert item.cta_type in VALID_CTA_TYPES, (
                f"{item.id} has invalid cta_type '{item.cta_type}'"
            )

    @pytest.mark.parametrize("use_case", USE_CASES)
    def test_id_prefix_matches_use_case(self, use_case: str) -> None:
        prefixes = {"optoppen": "opt-", "splitsen": "spl-", "transformatie": "tra-", "nieuwbouw": "nbw-"}
        expected = prefixes[use_case]
        items = get_checklist(use_case)
        for item in items:
            assert item.id.startswith(expected), (
                f"{item.id} does not start with '{expected}'"
            )

    def test_unknown_use_case_returns_empty(self) -> None:
        assert get_checklist("onbekend") == []

    def test_get_all_checklists_returns_all(self) -> None:
        all_cl = get_all_checklists()
        assert set(all_cl.keys()) == set(USE_CASES)
        for uc, items in all_cl.items():
            assert len(items) > 0
            assert isinstance(items[0], dict)
            assert "phase" in items[0]

    def test_phase_order_has_six_phases(self) -> None:
        assert len(PHASE_ORDER) == 6
        assert PHASE_ORDER[0] == "voorbereiding"
        assert PHASE_ORDER[-1] == "informatiebronnen"

    def test_cta_text_present_when_cta_type_set(self) -> None:
        """If cta_type is set, cta_text should also be set."""
        for uc, items in CHECKLISTS.items():
            for item in items:
                if item.cta_type is not None:
                    assert item.cta_text is not None and item.cta_text != "", (
                        f"{item.id} has cta_type but no cta_text"
                    )
