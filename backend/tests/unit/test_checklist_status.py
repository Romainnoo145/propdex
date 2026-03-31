"""Unit tests for the checklist-status endpoint logic.

Tests the mapping from generated documents to checklist item statuses.
"""

from __future__ import annotations

import uuid

import pytest

from app.documents.schemas import ChecklistItemStatus, ChecklistStatusResponse
from app.reports.checklist_pdf import CHECKLIST_DOC_CONFIGS


class TestChecklistStatusMapping:
    """Test the checklist item → document mapping logic."""

    def test_all_item_ids_covered_by_configs(self):
        """Every checklist_item_id in configs produces a status entry."""
        all_item_ids: set[str] = set()
        for config in CHECKLIST_DOC_CONFIGS.values():
            all_item_ids.update(config.checklist_item_ids)

        # Simulate: no documents exist → all items pending
        items: dict[str, ChecklistItemStatus] = {}
        for doc_type, config in CHECKLIST_DOC_CONFIGS.items():
            for item_id in config.checklist_item_ids:
                items[item_id] = ChecklistItemStatus(status="pending")

        assert set(items.keys()) == all_item_ids
        assert all(v.status == "pending" for v in items.values())

    def test_generated_doc_marks_items_as_generated(self):
        """When a doc exists for a type, all its checklist_item_ids are 'generated'."""
        doc_id = uuid.uuid4()
        doc_type = "kadaster"
        config = CHECKLIST_DOC_CONFIGS[doc_type]

        items: dict[str, ChecklistItemStatus] = {}
        for item_id in config.checklist_item_ids:
            items[item_id] = ChecklistItemStatus(
                status="generated",
                document_id=doc_id,
                document_type=doc_type,
                filename="test.pdf",
            )

        assert len(items) == len(config.checklist_item_ids)
        for item in items.values():
            assert item.status == "generated"
            assert item.document_id == doc_id

    def test_mixed_status_partial_docs(self):
        """Some doc types generated, others not → mixed statuses."""
        generated_types = {"kadaster", "energielabel"}
        items: dict[str, ChecklistItemStatus] = {}

        for doc_type, config in CHECKLIST_DOC_CONFIGS.items():
            for item_id in config.checklist_item_ids:
                if doc_type in generated_types:
                    items[item_id] = ChecklistItemStatus(
                        status="generated",
                        document_id=uuid.uuid4(),
                        document_type=doc_type,
                    )
                else:
                    items[item_id] = ChecklistItemStatus(status="pending")

        generated_items = [v for v in items.values() if v.status == "generated"]
        pending_items = [v for v in items.values() if v.status == "pending"]
        assert len(generated_items) > 0
        assert len(pending_items) > 0

    def test_response_model_serializes(self):
        """ChecklistStatusResponse serializes correctly."""
        response = ChecklistStatusResponse(
            parcel_id="ASD01-F-1234",
            items={
                "opt-02": ChecklistItemStatus(
                    status="generated",
                    document_id=uuid.uuid4(),
                    document_type="kadaster",
                    filename="kadaster_ASD01-F-1234.pdf",
                ),
                "opt-06": ChecklistItemStatus(status="pending"),
            },
            generated_count=1,
            total_count=2,
        )
        data = response.model_dump()
        assert data["parcel_id"] == "ASD01-F-1234"
        assert data["generated_count"] == 1
        assert data["total_count"] == 2
        assert data["items"]["opt-02"]["status"] == "generated"
        assert data["items"]["opt-06"]["status"] == "pending"

    def test_doc_types_without_item_ids_excluded(self):
        """Doc types with empty checklist_item_ids don't create status entries."""
        # risicoprofiel has checklist_item_ids=[]
        config = CHECKLIST_DOC_CONFIGS["risicoprofiel"]
        assert config.checklist_item_ids == []

        items: dict[str, ChecklistItemStatus] = {}
        for item_id in config.checklist_item_ids:
            items[item_id] = ChecklistItemStatus(status="pending")

        assert len(items) == 0
