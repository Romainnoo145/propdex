"""Unit tests for checklist progress API — schema validation and edge cases."""

import pytest

from app.api.endpoints.checklist_progress import (
    VALID_USE_CASES,
    ChecklistProgressResponse,
    ChecklistProgressUpdate,
)


class TestChecklistProgressSchemas:
    """Validate Pydantic schemas for checklist progress API."""

    def test_response_empty(self) -> None:
        resp = ChecklistProgressResponse(checked_items=[])
        assert resp.checked_items == []

    def test_response_with_items(self) -> None:
        items = ["nbw-01", "nbw-05", "nbw-12"]
        resp = ChecklistProgressResponse(checked_items=items)
        assert resp.checked_items == items
        assert len(resp.checked_items) == 3

    def test_update_body_valid(self) -> None:
        body = ChecklistProgressUpdate(checked_items=["opt-01", "opt-02"])
        assert body.checked_items == ["opt-01", "opt-02"]

    def test_update_body_empty(self) -> None:
        body = ChecklistProgressUpdate(checked_items=[])
        assert body.checked_items == []

    def test_response_serializes_to_dict(self) -> None:
        resp = ChecklistProgressResponse(checked_items=["spl-03"])
        d = resp.model_dump()
        assert d == {"checked_items": ["spl-03"], "uploaded_documents": {}}


class TestValidUseCases:
    """Validate that VALID_USE_CASES matches the checklist service."""

    def test_contains_all_four_use_cases(self) -> None:
        expected = {"optoppen", "splitsen", "transformatie", "nieuwbouw"}
        assert VALID_USE_CASES == expected

    @pytest.mark.parametrize(
        "use_case",
        ["optoppen", "splitsen", "transformatie", "nieuwbouw"],
    )
    def test_valid_use_case_accepted(self, use_case: str) -> None:
        assert use_case in VALID_USE_CASES

    @pytest.mark.parametrize(
        "use_case",
        ["invalid", "", "sloop", "OPTOPPEN", "nieuwbouw "],
    )
    def test_invalid_use_case_rejected(self, use_case: str) -> None:
        assert use_case not in VALID_USE_CASES


class TestChecklistProgressModel:
    """Validate the SQLAlchemy model structure."""

    def test_model_tablename(self) -> None:
        from app.models.checklist_progress import ChecklistProgress

        assert ChecklistProgress.__tablename__ == "checklist_progress"

    def test_model_has_required_columns(self) -> None:
        from app.models.checklist_progress import ChecklistProgress

        columns = {c.name for c in ChecklistProgress.__table__.columns}
        expected = {
            "id",
            "user_id",
            "parcel_id",
            "use_case",
            "checked_items",
            "created_at",
            "updated_at",
        }
        assert expected.issubset(columns)

    def test_unique_constraint_exists(self) -> None:
        from app.models.checklist_progress import ChecklistProgress

        constraints = {
            c.name for c in ChecklistProgress.__table__.constraints
        }
        assert "uq_checklist_progress_user_parcel_usecase" in constraints

    def test_checked_items_default(self) -> None:
        from app.models.checklist_progress import ChecklistProgress

        col = ChecklistProgress.__table__.columns["checked_items"]
        assert col.server_default is not None
