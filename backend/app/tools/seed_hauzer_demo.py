"""Seed the Hauzer demo organization + info@hauzer.nl user.

Idempotent: safe to re-run — creates/reconciles the org and user. The org has
`hauzer_demo=True` (gates the M052 demo-surfaces) and a filled afzender/letterhead
so the Contact brief-teaser renders a real Hauzer briefhoofd.

M052/S06 extends this with a pitchable demo dataset for the Hauzer user/org:
6 favorites spread across the pipeline stages, a projecttype per favorite, and
one rechtspersoon BRK-record on the first Contact-stage parcel so the Contact
brief renders in AUTO mode. The demo dataset is fully idempotent — re-running
hard-deletes the prior Hauzer demo rows (scoped strictly to the Hauzer
user_id / org_id) and re-inserts the canonical set.

Override the demo password via HAUZER_DEMO_PASSWORD env var; rotate the default
post-demo.

Usage (from the backend/ directory):
    PYTHONPATH=. python -m app.tools.seed_hauzer_demo
"""

from __future__ import annotations

import asyncio
import os
import uuid
from datetime import datetime

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.auth.password import hash_password
from app.core.config import settings
from app.models.brk_ownership_record import BrkOwnershipRecord
from app.models.organization import Organization
from app.models.parcel_cache import ParcelCache
from app.models.parcel_favorite import ParcelFavorite
from app.models.parcel_project_type import ParcelProjectType
from app.models.scan_result import ScanResult
from app.models.user import User

HAUZER_EMAIL = "info@hauzer.nl"
HAUZER_FULL_NAME = "Hauzer Vastgoed"
HAUZER_INITIAL_PASSWORD = os.environ.get(
    "HAUZER_DEMO_PASSWORD", "Hauzer-Venlo#Demo-2026"
)
ORG_NAME = "Hauzer Vastgoed"

# Briefhoofd (afzender) — mirrors the Contact.html demo mockup.
AFZENDER = {
    "afzender_adres": "Postbus 412, 5900 AK Venlo",
    "contactpersoon": "J. de Vries",
    "contact_email": "info@hauzer.nl",
    "contact_telefoon": "077 351 00 00",
}

# --- M052/S06 demo dataset ---------------------------------------------------

# Fixed pipeline-stage assignment for the 6 favorites (deterministic parcel order).
# The two "Contact" parcels sit at index 2 and 3; index 2 gets the BRK record so
# the Contact brief renders in AUTO mode.
DEMO_PIPELINE_STAGES = [
    "Gesignaleerd",
    "Onderzoek",
    "Contact",
    "Contact",
    "Besluit",
    "Afgerond",
]

# Fixed projecttype assignment per favorite (same order as the parcels).
DEMO_PROJECT_TYPES = [
    "optoppen",
    "transformatie_wonen",
    "commercieel_naar_wonen",
    "splitsen",
    "nieuwbouw_wonen",
    "optoppen",
]

# Index of the favorite that receives the rechtspersoon BRK record (first Contact).
BRK_PARCEL_INDEX = 2

DEMO_BRK_RECORD = {
    "eigenaar_type": "rechtspersoon",
    "eigenaar_naam": "Janssen Vastgoed Beheer B.V.",
    "statutaire_zetel": "Industrieweg 12, 5928 PA Venlo",
    "heeft_hypotheek": False,
    "koopsom": 485000,
    "koopjaar": 2018,
}

GEMEENTE_NAAM = "Venlo"


async def seed_demo_dataset(
    db: AsyncSession,
    *,
    org_id: uuid.UUID,
    user_id: uuid.UUID,
) -> None:
    """Seed the pitchable Hauzer demo dataset (favorites + projecttypes + BRK).

    Idempotent: hard-deletes the Hauzer user's favorites, the Hauzer org's
    parcel_project_types + brk_ownership_records, then re-inserts the canonical
    set. Deletes are scoped strictly to the Hauzer user_id / org_id.
    """
    # 1. Pick 6 real Venlo parcels die ÉCHT gescoord zijn (scan_result met een
    # potentie-score) — zo tonen brief + workspace echte data i.p.v. lege percelen.
    # Filter op het adres (ILIKE '%venlo%'), NIET op gemeente_code: parcel_cache
    # heeft een data-quirk waarbij Reuver-parcels (adres 595x) tóch gemeente_code
    # 'GM0983' (Venlo) dragen. Het adres reflecteert de echte locatie — Hauzer = Venlo.
    parcels = (
        (
            await db.execute(
                select(ParcelCache)
                .join(ScanResult, ScanResult.parcel_id == ParcelCache.id)
                .where(ParcelCache.address.is_not(None))
                .where(ParcelCache.address.ilike("%venlo"))
                .where(ScanResult.flags["scores"]["potentie"].as_float().is_not(None))
                .order_by(ParcelCache.parcel_id)
                .distinct()
                .limit(6)
            )
        )
        .scalars()
        .all()
    )

    if len(parcels) < 6:
        print(
            f"[seed][demo] WARNING: only {len(parcels)} parcel_cache rows with an "
            f"address found (expected 6) — seeding {len(parcels)} favorites."
        )

    # 2. Idempotent cleanup — strictly scoped to the Hauzer user / org.
    await db.execute(
        delete(ParcelFavorite).where(ParcelFavorite.user_id == user_id)
    )
    await db.execute(
        delete(ParcelProjectType).where(
            ParcelProjectType.organization_id == org_id
        )
    )
    await db.execute(
        delete(BrkOwnershipRecord).where(
            BrkOwnershipRecord.organization_id == org_id
        )
    )

    # 3. Insert favorites + projecttypes.
    fav_count = 0
    pt_count = 0
    for idx, parcel in enumerate(parcels):
        stage = DEMO_PIPELINE_STAGES[idx]
        project_type = DEMO_PROJECT_TYPES[idx]

        db.add(
            ParcelFavorite(
                parcel_id=parcel.parcel_id,
                parcel_cache_id=parcel.id,
                user_id=user_id,
                gemeente_code=parcel.gemeente_code,
                gemeente_naam=GEMEENTE_NAAM,
                address=parcel.address,
                pipeline_stage=stage,
            )
        )
        fav_count += 1

        db.add(
            ParcelProjectType(
                parcel_id=parcel.parcel_id,
                organization_id=org_id,
                project_type=project_type,
                set_by_user_id=user_id,
            )
        )
        pt_count += 1

    # 4. Insert the rechtspersoon BRK record on the first Contact parcel.
    brk_count = 0
    if len(parcels) > BRK_PARCEL_INDEX:
        brk_parcel = parcels[BRK_PARCEL_INDEX]
        db.add(
            BrkOwnershipRecord(
                organization_id=org_id,
                parcel_id=brk_parcel.parcel_id,
                eigenaar_type=DEMO_BRK_RECORD["eigenaar_type"],
                eigenaar_naam=DEMO_BRK_RECORD["eigenaar_naam"],
                statutaire_zetel=DEMO_BRK_RECORD["statutaire_zetel"],
                heeft_hypotheek=DEMO_BRK_RECORD["heeft_hypotheek"],
                koopsom=DEMO_BRK_RECORD["koopsom"],
                koopjaar=DEMO_BRK_RECORD["koopjaar"],
                fetched_at=datetime.utcnow(),
            )
        )
        brk_count = 1

    await db.commit()

    print(f"[seed][demo] Favorites seeded: {fav_count}")
    print(f"[seed][demo] Projecttypes seeded: {pt_count}")
    print(f"[seed][demo] BRK records seeded: {brk_count}")
    print("[seed][demo] Pipeline:")
    for idx, parcel in enumerate(parcels):
        marker = "  <- BRK rechtspersoon" if idx == BRK_PARCEL_INDEX else ""
        print(
            f"  {idx}: {parcel.parcel_id} | {parcel.address} | "
            f"{DEMO_PIPELINE_STAGES[idx]} | {DEMO_PROJECT_TYPES[idx]}{marker}"
        )


async def seed() -> None:
    engine = create_async_engine(settings.DATABASE_URL)
    Session = async_sessionmaker(engine, expire_on_commit=False)

    async with Session() as db:
        # 1. Organization — create if missing, always reconcile demo-flag + afzender.
        org = (
            await db.execute(select(Organization).where(Organization.name == ORG_NAME))
        ).scalar_one_or_none()
        if org is None:
            org = Organization(name=ORG_NAME, hauzer_demo=True, **AFZENDER)
            db.add(org)
            await db.flush()
            print(f"[seed] Created organization {ORG_NAME} id={org.id}")
        else:
            org.hauzer_demo = True
            for field, value in AFZENDER.items():
                setattr(org, field, value)
            print(f"[seed] Organization {ORG_NAME} already exists id={org.id} — reconciled demo-flag + afzender")

        # 2. User — upsert: create if missing, otherwise reset password + org.
        existing = (
            await db.execute(
                select(User).where(func.lower(User.email) == HAUZER_EMAIL.lower())
            )
        ).scalar_one_or_none()
        if existing is not None:
            existing.hashed_password = hash_password(HAUZER_INITIAL_PASSWORD)
            existing.organization_id = org.id
            await db.commit()
            user_id = existing.id
            print(f"[seed] User {HAUZER_EMAIL} already existed (id={existing.id}) — password + org reset")
        else:
            user = User(
                email=HAUZER_EMAIL,
                hashed_password=hash_password(HAUZER_INITIAL_PASSWORD),
                full_name=HAUZER_FULL_NAME,
                organization_id=org.id,
                email_verified=True,
                auth_provider="email",
                is_active=True,
                is_superuser=False,
            )
            db.add(user)
            await db.commit()
            user_id = user.id
            print(f"[seed] Created user {HAUZER_EMAIL} id={user.id} in org {ORG_NAME} (hauzer_demo=True)")

        print(f"[seed] Password: {HAUZER_INITIAL_PASSWORD}")

        # 3. M052/S06 demo dataset — favorites + projecttypes + rechtspersoon BRK.
        await seed_demo_dataset(db, org_id=org.id, user_id=user_id)


if __name__ == "__main__":
    asyncio.run(seed())
