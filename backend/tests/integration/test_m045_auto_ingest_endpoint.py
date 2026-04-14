"""E2E tests for POST /api/policy-documents/auto-ingest — M045/S06 T06.

Verifies the on-demand auto-ingest endpoint via httpx ASGITransport:
- Vendor user → 200 with summary
- Customer user → 403
- No auth → 401
- Idempotent re-call → all-None summary
- Cascade integration: auto-ingested doc appears in /api/parcels/{id}/documents/bundle
"""

from __future__ import annotations

import uuid
from collections.abc import Mapping
from contextlib import AbstractContextManager
from typing import Any
from unittest.mock import AsyncMock, patch

import pytest
from geoalchemy2 import WKTElement
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import create_access_token
from app.core.config import settings
from app.models.gemeente_provincie_map import GemeenteProvincieMap
from app.models.organization import Organization
from app.models.parcel_cache import ParcelCache
from app.models.policy_document import PolicyDocument
from app.models.user import User
from app.services.koop_sru_client import VerordeningResult

_DUMMY_GEOMETRY = WKTElement(
    "MULTIPOLYGON(((155000 463000, 155010 463000, 155010 463010, 155000 463010, 155000 463000)))",
    srid=28992,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _make_user(
    db: AsyncSession,
    *,
    email: str,
    org_name: str,
) -> tuple[User, Organization]:
    org = Organization(name=org_name)
    db.add(org)
    await db.flush()

    user = User(
        email=email,
        hashed_password="hashed_dummy",
        full_name="Auto-Ingest E2E",
        organization_id=org.id,
        email_verified=True,
        auth_provider="email",
        is_active=True,
    )
    db.add(user)
    await db.flush()
    return user, org


def _auth_headers(user: User, org: Organization) -> dict[str, str]:
    token = create_access_token(str(user.id), str(org.id))
    return {"Authorization": f"Bearer {token}"}


def _verordening(identifier: str, title: str = "Test verordening") -> VerordeningResult:
    return VerordeningResult(
        title=title,
        identifier=identifier,
        creator="Venlo",
        modified="2025-12-01",
        subject="test",
        url=f"https://zoek.officielebekendmakingen.nl/{identifier}",
    )


def _patch_external(
    *,
    sru_results: Mapping[str, VerordeningResult | None],
    pdf_bytes: bytes | None,
) -> tuple[AbstractContextManager[Any], AbstractContextManager[Any]]:
    """Return a (search_patch, download_patch) pair — both targeting auto_ingest module."""

    async def _fake_search(title: str, gemeente_naam: str, *, timeout: float = 15.0) -> VerordeningResult | None:
        return sru_results.get(title)

    async def _fake_download(identifier: str, *, timeout: float = 30.0) -> bytes | None:
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


async def _count_policy_docs_for(
    db: AsyncSession, *, entity_code: str
) -> int:
    stmt = select(PolicyDocument).where(
        PolicyDocument.entity_type == "gemeente",
        PolicyDocument.entity_code == entity_code,
    )
    return len(list((await db.execute(stmt)).scalars().all()))


# ---------------------------------------------------------------------------
# Test 1 — vendor user happy path
# ---------------------------------------------------------------------------


async def test_endpoint_vendor_user_succeeds_with_summary(
    async_client: AsyncClient,
    test_db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    vendor_user, vendor_org = await _make_user(
        test_db, email="vendor1@e2e.example", org_name="Vendor Org"
    )
    monkeypatch.setattr(settings, "VENDOR_ORG_ID", vendor_org.id)
    await test_db.commit()

    sru_results = {
        "omgevingsvisie": _verordening("gmb-2025-VENDOR-OV"),
        "huisvestingsverordening": _verordening("gmb-2025-VENDOR-HV"),
    }

    patches = _patch_external(sru_results=sru_results, pdf_bytes=b"%PDF fake")
    with patches[0], patches[1]:
        response = await async_client.post(
            "/api/policy-documents/auto-ingest",
            json={"gemeente_code": "GM0983", "gemeente_naam": "Venlo"},
            headers=_auth_headers(vendor_user, vendor_org),
        )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["gemeente_code"] == "GM0983"
    assert body["gemeente_naam"] == "Venlo"
    assert body["summary"] == {"omgevingsvisie": 1, "huisvestingsverordening": 1}


# ---------------------------------------------------------------------------
# Test 2 — customer user → 403
# ---------------------------------------------------------------------------


async def test_endpoint_customer_user_returns_403(
    async_client: AsyncClient,
    test_db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Seed a vendor org so settings.VENDOR_ORG_ID is set, but the calling user
    # is in a different org → should get 403.
    _vu, vendor_org = await _make_user(
        test_db, email="vendor2@e2e.example", org_name="Vendor Org Two"
    )
    customer_user, customer_org = await _make_user(
        test_db, email="customer@e2e.example", org_name="Customer Org"
    )
    monkeypatch.setattr(settings, "VENDOR_ORG_ID", vendor_org.id)
    await test_db.commit()

    response = await async_client.post(
        "/api/policy-documents/auto-ingest",
        json={"gemeente_code": "GM0983", "gemeente_naam": "Venlo"},
        headers=_auth_headers(customer_user, customer_org),
    )

    assert response.status_code == 403, response.text
    # No rows should have been created (guard fires before any DB writes)
    assert await _count_policy_docs_for(test_db, entity_code="GM0983") == 0


# ---------------------------------------------------------------------------
# Test 3 — no auth → 401
# ---------------------------------------------------------------------------


async def test_endpoint_no_auth_returns_401(
    async_client: AsyncClient,
    test_db: AsyncSession,  # noqa: ARG001 — pulled in for clean schema
) -> None:
    response = await async_client.post(
        "/api/policy-documents/auto-ingest",
        json={"gemeente_code": "GM0983", "gemeente_naam": "Venlo"},
    )
    assert response.status_code == 401


# ---------------------------------------------------------------------------
# Test 4 — idempotency on re-call
# ---------------------------------------------------------------------------


async def test_endpoint_idempotent_second_call_returns_nones(
    async_client: AsyncClient,
    test_db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    vendor_user, vendor_org = await _make_user(
        test_db, email="vendor3@e2e.example", org_name="Vendor Org Three"
    )
    monkeypatch.setattr(settings, "VENDOR_ORG_ID", vendor_org.id)
    await test_db.commit()

    sru_results = {
        "omgevingsvisie": _verordening("gmb-2025-IDEM-OV-E2E"),
        "huisvestingsverordening": _verordening("gmb-2025-IDEM-HV-E2E"),
    }

    # First call
    patches1 = _patch_external(sru_results=sru_results, pdf_bytes=b"%PDF fake")
    with patches1[0], patches1[1]:
        first = await async_client.post(
            "/api/policy-documents/auto-ingest",
            json={"gemeente_code": "GM0983", "gemeente_naam": "Venlo"},
            headers=_auth_headers(vendor_user, vendor_org),
        )
    assert first.status_code == 200
    assert first.json()["summary"] == {
        "omgevingsvisie": 1,
        "huisvestingsverordening": 1,
    }

    # Second call — same identifiers
    patches2 = _patch_external(sru_results=sru_results, pdf_bytes=b"%PDF fake")
    with patches2[0], patches2[1]:
        second = await async_client.post(
            "/api/policy-documents/auto-ingest",
            json={"gemeente_code": "GM0983", "gemeente_naam": "Venlo"},
            headers=_auth_headers(vendor_user, vendor_org),
        )
    assert second.status_code == 200
    assert second.json()["summary"] == {
        "omgevingsvisie": None,
        "huisvestingsverordening": None,
    }

    # Total rows still 2
    assert await _count_policy_docs_for(test_db, entity_code="GM0983") == 2


# ---------------------------------------------------------------------------
# Test 5 — auto-ingested doc appears in S02 cascade bundle
# ---------------------------------------------------------------------------


async def test_endpoint_ingested_doc_appears_in_cascade_bundle(
    async_client: AsyncClient,
    test_db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """End-to-end proof: S06 writes are picked up by the S02 cascade query
    without any code coupling — both share policy_documents as canonical store.
    """
    vendor_user, vendor_org = await _make_user(
        test_db, email="vendor4@e2e.example", org_name="Vendor Org Four"
    )
    monkeypatch.setattr(settings, "VENDOR_ORG_ID", vendor_org.id)

    # Seed gemeente_provincie_map + parcel_cache for Venlo
    test_db.add(GemeenteProvincieMap(gemeente_code="GM0983", provincie_code="PV31"))
    test_db.add(
        ParcelCache(
            id=uuid.uuid4(),
            parcel_id="NL.IMKAD.E2E-AUTOINGEST",
            geometry=_DUMMY_GEOMETRY,
            gemeente_code="GM0983",
        )
    )
    await test_db.commit()

    sru_results = {
        "omgevingsvisie": _verordening(
            "gmb-2025-CASCADE-OV", "Omgevingsvisie Venlo"
        ),
        "huisvestingsverordening": _verordening(
            "gmb-2025-CASCADE-HV", "Huisvestingsverordening Venlo"
        ),
    }

    patches = _patch_external(sru_results=sru_results, pdf_bytes=b"%PDF fake")
    with patches[0], patches[1]:
        ingest_resp = await async_client.post(
            "/api/policy-documents/auto-ingest",
            json={"gemeente_code": "GM0983", "gemeente_naam": "Venlo"},
            headers=_auth_headers(vendor_user, vendor_org),
        )
    assert ingest_resp.status_code == 200

    # Now query the S02 cascade bundle endpoint
    bundle_resp = await async_client.get(
        "/api/parcels/NL.IMKAD.E2E-AUTOINGEST/documents/bundle",
        headers=_auth_headers(vendor_user, vendor_org),
    )
    assert bundle_resp.status_code == 200, bundle_resp.text
    body = bundle_resp.json()

    gemeente_docs = body["cascade_policy_docs"]["gemeente"]
    assert len(gemeente_docs) == 2, (
        f"expected 2 auto-ingested gemeente docs, got {gemeente_docs}"
    )

    source_keys = {doc["source_key"] for doc in gemeente_docs}
    assert source_keys == {"omgevingsvisie", "huisvestingsverordening"}

    # Each row should have version_number = 1 and a filename starting with the CVDR identifier
    for doc in gemeente_docs:
        assert doc["version_number"] == 1
        identifier = doc["filename"].split("__")[0]
        assert identifier in {"gmb-2025-CASCADE-OV", "gmb-2025-CASCADE-HV"}
