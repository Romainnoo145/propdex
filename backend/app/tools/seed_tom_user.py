"""Seed a Propdex organization + tom@propdex.nl user.

Idempotent: safe to re-run — creates the org and user only if missing.
Prints a summary to stdout.

Usage (from the backend/ directory):
    PYTHONPATH=. python -m app.tools.seed_tom_user
"""

from __future__ import annotations

import asyncio

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.auth.password import hash_password
from app.core.config import settings
from app.models.organization import Organization
from app.models.user import User

TOM_EMAIL = "tom@propdex.nl"
TOM_FULL_NAME = "Tom"
TOM_INITIAL_PASSWORD = "Propdex-Tom#9Zq!mK4x_Vrt"
ORG_NAME = "Propdex"


async def seed() -> None:
    engine = create_async_engine(settings.DATABASE_URL)
    Session = async_sessionmaker(engine, expire_on_commit=False)

    async with Session() as db:
        # 1. Organization — create if missing
        org = (
            await db.execute(select(Organization).where(Organization.name == ORG_NAME))
        ).scalar_one_or_none()
        if org is None:
            org = Organization(name=ORG_NAME)
            db.add(org)
            await db.flush()
            print(f"[seed] Created organization {ORG_NAME} id={org.id}")
        else:
            print(f"[seed] Organization {ORG_NAME} already exists id={org.id}")

        # 2. User — upsert: create if missing, otherwise reconcile the password
        # to the constant above so re-running the script reliably resets it.
        existing = (
            await db.execute(
                select(User).where(func.lower(User.email) == TOM_EMAIL.lower())
            )
        ).scalar_one_or_none()
        if existing is not None:
            existing.hashed_password = hash_password(TOM_INITIAL_PASSWORD)
            existing.organization_id = org.id
            await db.commit()
            print(f"[seed] User {TOM_EMAIL} already existed (id={existing.id}) — password reset")
            print(f"[seed] Password: {TOM_INITIAL_PASSWORD}")
            return

        user = User(
            email=TOM_EMAIL,
            hashed_password=hash_password(TOM_INITIAL_PASSWORD),
            full_name=TOM_FULL_NAME,
            organization_id=org.id,
            email_verified=True,
            auth_provider="email",
            is_active=True,
            is_superuser=False,
        )
        db.add(user)
        await db.commit()
        print(f"[seed] Created user {TOM_EMAIL} id={user.id} in org {ORG_NAME}")
        print(f"[seed] Password: {TOM_INITIAL_PASSWORD}")
        print("[seed] Tom can change it via the app after first login.")


if __name__ == "__main__":
    asyncio.run(seed())
