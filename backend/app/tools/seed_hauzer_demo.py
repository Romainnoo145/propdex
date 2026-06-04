"""Seed the Hauzer demo organization + info@hauzer.nl user.

Idempotent: safe to re-run — creates/reconciles the org and user. The org has
`hauzer_demo=True` (gates the M052 demo-surfaces) and a filled afzender/letterhead
so the Contact brief-teaser renders a real Hauzer briefhoofd.

This is the foundation the M052/S06 demo-org seed will extend (favorites in
pipeline stages, projecttype, mock inbox).

Override the demo password via HAUZER_DEMO_PASSWORD env var; rotate the default
post-demo.

Usage (from the backend/ directory):
    PYTHONPATH=. python -m app.tools.seed_hauzer_demo
"""

from __future__ import annotations

import asyncio
import os

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.auth.password import hash_password
from app.core.config import settings
from app.models.organization import Organization
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
            print(f"[seed] User {HAUZER_EMAIL} already existed (id={existing.id}) — password + org reset")
            print(f"[seed] Password: {HAUZER_INITIAL_PASSWORD}")
            return

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
        print(f"[seed] Created user {HAUZER_EMAIL} id={user.id} in org {ORG_NAME} (hauzer_demo=True)")
        print(f"[seed] Password: {HAUZER_INITIAL_PASSWORD}")


if __name__ == "__main__":
    asyncio.run(seed())
