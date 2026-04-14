"""Integration tests for ingest_gemeente_policies — M045/S06 T04.

Exercises the real DB (test_db fixture) but mocks the two external
dependencies (search_policy_document, download_cvdr_pdf) at the
auto_ingest module level — NOT at koop_sru_client level — because
the names are bound at import time.
"""

from __future__ import annotations

from collections.abc import Mapping
from contextlib import AbstractContextManager
from typing import Any
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.organization import Organization
from app.models.policy_document import PolicyDocument
from app.models.user import User
from app.policy_documents.auto_ingest import ingest_gemeente_policies
from app.services.koop_sru_client import VerordeningResult

# ---------------------------------------------------------------------------
# Test helpers
# ---------------------------------------------------------------------------


async def _make_vendor_user(
    db: AsyncSession,
    *,
    email: str = "vendor@auto-ingest.example",
) -> tuple[User, Organization]:
    """Create a vendor org + active user for the auto-ingest tests."""
    org = Organization(name="Vendor Org Auto-Ingest")
    db.add(org)
    await db.flush()

    user = User(
        email=email,
        hashed_password="hashed_dummy",
        full_name="Vendor Auto-Ingest User",
        organization_id=org.id,
        email_verified=True,
        auth_provider="email",
        is_active=True,
    )
    db.add(user)
    await db.flush()
    return user, org


def _verordening(identifier: str, title: str = "Test verordening") -> VerordeningResult:
    """Build a VerordeningResult instance for mock returns."""
    return VerordeningResult(
        title=title,
        identifier=identifier,
        creator="Venlo",
        modified="2025-12-01",
        subject="test",
        url=f"https://zoek.officielebekendmakingen.nl/{identifier}",
    )


def _patch_external_dependencies(
    *,
    sru_results: Mapping[str, VerordeningResult | None],
    pdf_bytes: bytes | None,
) -> tuple[AbstractContextManager[Any], AbstractContextManager[Any]]:
    """Context manager patching search_policy_document + download_cvdr_pdf.

    sru_results: maps the CVDR title (= AUTO_INGESTIBLE_DOCUMENTS key) to the
    VerordeningResult to return for that title. Use None to simulate "not found".

    pdf_bytes: bytes to return from download_cvdr_pdf for ALL identifiers, or
    None to simulate a download failure.
    """

    async def _fake_search(
        title: str, gemeente_naam: str, *, timeout: float = 15.0
    ) -> VerordeningResult | None:
        return sru_results.get(title)

    async def _fake_download(
        identifier: str, *, timeout: float = 30.0
    ) -> bytes | None:
        return pdf_bytes

    return (
        patch(
            "app.policy_documents.auto_ingest.search_policy_document",
            new=AsyncMock(side_effect=_fake_search),
        ),
        patch(
            "app.policy_documents.auto_ingest.download_cvdr_pdf",
            new=AsyncMock(side_effect=_fake_download),
        ),
    )


async def _count_policy_docs(
    db: AsyncSession,
    *,
    entity_code: str,
    source_key: str | None = None,
) -> int:
    stmt = select(PolicyDocument).where(
        PolicyDocument.entity_type == "gemeente",
        PolicyDocument.entity_code == entity_code,
    )
    if source_key:
        stmt = stmt.where(PolicyDocument.source_key == source_key)
    result = await db.execute(stmt)
    return len(list(result.scalars().all()))


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


async def test_ingest_creates_policy_documents_for_both_types(
    test_db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Happy path: both omgevingsvisie and huisvestingsverordening → 2 new rows."""
    _user, vendor_org = await _make_vendor_user(test_db)
    monkeypatch.setattr(settings, "VENDOR_ORG_ID", vendor_org.id)
    await test_db.commit()

    sru_results = {
        "omgevingsvisie": _verordening("gmb-2025-AAA", "Omgevingsvisie Venlo"),
        "huisvestingsverordening": _verordening("gmb-2025-BBB", "Huisvestingsverordening Venlo"),
    }
    fake_pdf = b"%PDF-1.4 fake bytes"

    patches = _patch_external_dependencies(
        sru_results=sru_results, pdf_bytes=fake_pdf
    )
    with patches[0], patches[1]:
        summary = await ingest_gemeente_policies(
            gemeente_code="GM0983",
            gemeente_naam="Venlo",
            db=test_db,
        )

    assert summary == {"omgevingsvisie": 1, "huisvestingsverordening": 1}

    # Verify rows in DB
    stmt = select(PolicyDocument).where(
        PolicyDocument.entity_type == "gemeente",
        PolicyDocument.entity_code == "GM0983",
    )
    rows = list((await test_db.execute(stmt)).scalars().all())
    assert len(rows) == 2

    row_by_source = {r.source_key: r for r in rows}
    assert "omgevingsvisie" in row_by_source
    assert "huisvestingsverordening" in row_by_source

    for row in rows:
        assert row.is_global is True
        assert row.version_number == 1
        assert row.organization_id == vendor_org.id
        assert row.content_type == "application/pdf"
        assert row.file_data == fake_pdf
        assert row.filename.endswith(".pdf")
        # Filename starts with the CVDR identifier prefix
        identifier = row.filename.split("__")[0]
        assert identifier in {"gmb-2025-AAA", "gmb-2025-BBB"}


async def test_ingest_is_idempotent_skips_already_ingested(
    test_db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Re-running with the same CVDR identifier returns None and creates no new rows."""
    _user, vendor_org = await _make_vendor_user(
        test_db, email="vendor2@auto-ingest.example"
    )
    monkeypatch.setattr(settings, "VENDOR_ORG_ID", vendor_org.id)
    await test_db.commit()

    sru_results = {
        "omgevingsvisie": _verordening("gmb-2025-IDEM-OV"),
        "huisvestingsverordening": _verordening("gmb-2025-IDEM-HV"),
    }

    patches = _patch_external_dependencies(
        sru_results=sru_results, pdf_bytes=b"%PDF-1.4 fake"
    )

    # First run
    with patches[0], patches[1]:
        first = await ingest_gemeente_policies("GM0983", "Venlo", test_db)
    assert first == {"omgevingsvisie": 1, "huisvestingsverordening": 1}

    # Second run — fresh patches because the AsyncMock side_effects can be reused
    patches2 = _patch_external_dependencies(
        sru_results=sru_results, pdf_bytes=b"%PDF-1.4 fake"
    )
    with patches2[0], patches2[1]:
        second = await ingest_gemeente_policies("GM0983", "Venlo", test_db)

    assert second == {"omgevingsvisie": None, "huisvestingsverordening": None}

    # DB still only has the original 2 rows
    count = await _count_policy_docs(test_db, entity_code="GM0983")
    assert count == 2


async def test_ingest_skips_when_search_returns_none(
    test_db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """If search_policy_document returns None, summary is None and no row is created."""
    _user, vendor_org = await _make_vendor_user(
        test_db, email="vendor3@auto-ingest.example"
    )
    monkeypatch.setattr(settings, "VENDOR_ORG_ID", vendor_org.id)
    await test_db.commit()

    patches = _patch_external_dependencies(
        sru_results={"omgevingsvisie": None, "huisvestingsverordening": None},
        pdf_bytes=b"should not be reached",
    )
    with patches[0], patches[1]:
        summary = await ingest_gemeente_policies("GM0983", "Venlo", test_db)

    assert summary == {"omgevingsvisie": None, "huisvestingsverordening": None}
    assert await _count_policy_docs(test_db, entity_code="GM0983") == 0


async def test_ingest_skips_when_pdf_download_fails(
    test_db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """If download_cvdr_pdf returns None, summary is None and no row is created."""
    _user, vendor_org = await _make_vendor_user(
        test_db, email="vendor4@auto-ingest.example"
    )
    monkeypatch.setattr(settings, "VENDOR_ORG_ID", vendor_org.id)
    await test_db.commit()

    sru_results = {
        "omgevingsvisie": _verordening("gmb-2025-DLFAIL-OV"),
        "huisvestingsverordening": _verordening("gmb-2025-DLFAIL-HV"),
    }

    patches = _patch_external_dependencies(
        sru_results=sru_results, pdf_bytes=None  # Download fails for all
    )
    with patches[0], patches[1]:
        summary = await ingest_gemeente_policies("GM0983", "Venlo", test_db)

    assert summary == {"omgevingsvisie": None, "huisvestingsverordening": None}
    assert await _count_policy_docs(test_db, entity_code="GM0983") == 0


async def test_ingest_increments_version_when_identifier_changes(
    test_db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """If CVDR republishes (new identifier), the next ingest creates version 2."""
    _user, vendor_org = await _make_vendor_user(
        test_db, email="vendor5@auto-ingest.example"
    )
    monkeypatch.setattr(settings, "VENDOR_ORG_ID", vendor_org.id)
    await test_db.commit()

    # First run: identifiers A
    patches_a = _patch_external_dependencies(
        sru_results={
            "omgevingsvisie": _verordening("gmb-2025-VER-A1"),
            "huisvestingsverordening": _verordening("gmb-2025-VER-A2"),
        },
        pdf_bytes=b"%PDF first version",
    )
    with patches_a[0], patches_a[1]:
        first = await ingest_gemeente_policies("GM0983", "Venlo", test_db)
    assert first == {"omgevingsvisie": 1, "huisvestingsverordening": 1}

    # Second run: NEW identifiers B (CVDR republished)
    patches_b = _patch_external_dependencies(
        sru_results={
            "omgevingsvisie": _verordening("gmb-2025-VER-B1"),
            "huisvestingsverordening": _verordening("gmb-2025-VER-B2"),
        },
        pdf_bytes=b"%PDF second version",
    )
    with patches_b[0], patches_b[1]:
        second = await ingest_gemeente_policies("GM0983", "Venlo", test_db)

    # version_number should increment to 2 for both source_keys
    assert second == {"omgevingsvisie": 2, "huisvestingsverordening": 2}

    # DB now has 4 rows total — 2 source_keys × 2 versions
    assert await _count_policy_docs(test_db, entity_code="GM0983") == 4
    assert await _count_policy_docs(
        test_db, entity_code="GM0983", source_key="omgevingsvisie"
    ) == 2
    assert await _count_policy_docs(
        test_db, entity_code="GM0983", source_key="huisvestingsverordening"
    ) == 2
