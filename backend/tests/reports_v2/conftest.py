"""Fixtures voor reports_v2 tests (M055/S01).

Patroon: function-scoped, direct commit (conform bestaand project-patroon).
db_session = alias voor test_db uit root conftest.
"""

from __future__ import annotations

import uuid
from collections.abc import AsyncGenerator, Callable, Coroutine
from typing import Any

import pytest
from geoalchemy2 import WKTElement
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.factor_extraction_schemas import DOCUMENT_SENTINEL, SCHEMA_VERSION
from app.auth.password import hash_password
from app.models.factor_extraction_cache import FactorExtractionCache
from app.models.organization import Organization
from app.models.parcel_cache import ParcelCache
from app.models.policy_document import PolicyDocument
from app.models.user import User

# ---------------------------------------------------------------------------
# db_session alias (tests in this package use 'db_session' per brief)
# ---------------------------------------------------------------------------


@pytest.fixture
async def db_session(test_db: AsyncSession) -> AsyncGenerator[AsyncSession, None]:
    """Alias voor test_db — geeft dezelfde session door."""
    yield test_db


# ---------------------------------------------------------------------------
# seed_parcel
# ---------------------------------------------------------------------------


@pytest.fixture
def seed_parcel(
    db_session: AsyncSession,
) -> Callable[..., Coroutine[Any, Any, ParcelCache]]:
    """Factory-fixture: maak een ParcelCache-rij en commit direct.

    Usage:
        parcel = await seed_parcel(gemeente_code="0983", buurt_code="BU09831401")
    """

    async def _create(
        *,
        gemeente_code: str = "0983",
        buurt_code: str | None = None,
        bestemmingen: list[dict[str, Any]] | None = None,
        address: str = "Teststraat 1",
        area_m2: float = 120.0,
        bouwjaar: int | None = 1970,
        x: int = 155000,
        y: int = 463000,
    ) -> ParcelCache:
        parcel_id = f"TEST-{uuid.uuid4().hex[:8].upper()}"
        parcel = ParcelCache(
            parcel_id=parcel_id,
            parcel_code=parcel_id,
            geometry=WKTElement(
                f"MULTIPOLYGON((({x} {y},{x+10} {y},{x+10} {y+10},{x} {y+10},{x} {y})))",
                srid=28992,
            ),
            address=address,
            gemeente_code=gemeente_code,
            buurt_code=buurt_code,
            area_m2=area_m2,
            bouwjaar=bouwjaar,
            has_pand=True,
            bestemmingen=bestemmingen or [],
        )
        db_session.add(parcel)
        await db_session.commit()
        await db_session.refresh(parcel)
        return parcel

    return _create  # type: ignore[return-value]


# ---------------------------------------------------------------------------
# seed_huisvestingsverordening
# ---------------------------------------------------------------------------


@pytest.fixture
def seed_huisvestingsverordening(
    db_session: AsyncSession,
) -> Callable[..., Coroutine[Any, Any, None]]:
    """Factory-fixture: maak PolicyDocument + FactorExtractionCache (DOCUMENT_SENTINEL).

    Seeded payload bevat standaard "leefbaarheid" in voorraad_citaat zodat
    derive_themas het thema toevoegt en select_cases overlap vindt met de
    gecureerde splitsing-cases.

    Usage:
        await seed_huisvestingsverordening(
            gemeente_code="0983", vergunningplichten=["splitsing", "omzetting"]
        )
    """

    async def _create(
        *,
        gemeente_code: str = "0983",
        vergunningplichten: list[str] | None = None,
        organization_id: uuid.UUID | None = None,
    ) -> None:
        org_id = organization_id or uuid.UUID(int=1)

        # --- Zorg voor Organization + User (FK-verplichtingen) ---
        # Gebruik een stabiele org-UUID zodat hergebruik in dezelfde test
        # geen dubbele rijen aanmaakt.
        org = Organization(id=org_id, name="Test Org")

        exists = (
            await db_session.execute(
                text("SELECT 1 FROM organizations WHERE id = :oid"),
                {"oid": str(org_id)},
            )
        ).scalar_one_or_none()
        if not exists:
            db_session.add(org)
            await db_session.flush()

        # Minimale user (voor uploaded_by_user_id FK)
        user_id = uuid.uuid4()

        user = User(
            id=user_id,
            email=f"seed_{user_id.hex[:6]}@test.invalid",
            hashed_password=hash_password("x"),
            full_name="Seed User",
            organization_id=org_id,
            email_verified=True,
            auth_provider="email",
            is_active=True,
        )
        db_session.add(user)
        await db_session.flush()

        # --- PolicyDocument ---
        doc_id = uuid.uuid4()
        doc = PolicyDocument(
            id=doc_id,
            organization_id=org_id,
            entity_type="gemeente",
            entity_code=gemeente_code,
            source_key="huisvestingsverordening",
            filename="test-huisvestingsverordening.pdf",
            content_type="application/pdf",
            file_data=b"%PDF-1.4\n%fake\n%%EOF",
            file_size=22,
            uploaded_by_user_id=user_id,
            status="parsed",
            is_global=True,
            version_number=1,
        )
        db_session.add(doc)
        await db_session.flush()

        # --- FactorExtractionCache (DOCUMENT_SENTINEL) ---
        payload: dict[str, Any] = {
            "geldig_van": "2026-01-01",
            "geldig_tot": None,
            "voorraad_vergunningplichten": vergunningplichten or ["splitsing"],
            # "leefbaarheid" in citaat zorgt dat derive_themas het als thema pikt,
            # waardoor select_cases overlap vindt met de gecureerde splitsing-cases.
            "voorraad_citaat": (
                "Ter bescherming van een goede leefbaarheid en schaarste op "
                "de woningmarkt is een vergunning vereist."
            ),
            "huisvestingsvergunning_scope": "corporatie_sociale_huur",
            "opkoopbescherming": None,
            "randvoorwaarden": [],
            "confidence": 0.9,
        }
        cache_row = FactorExtractionCache(
            parcel_id=DOCUMENT_SENTINEL,
            policy_document_id=doc_id,
            factor_id="splitsingsrisico",
            schema_version=SCHEMA_VERSION,
            extracted_payload=payload,
        )
        db_session.add(cache_row)
        await db_session.commit()

    return _create  # type: ignore[return-value]
