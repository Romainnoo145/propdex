"""Seed the Hauzer demo organization + info@hauzer.nl user.

Idempotent: safe to re-run — creates/reconciles the org and user. The org has
`hauzer_demo=True` (gates the M052 demo-surfaces) and a filled afzender/letterhead
so the Contact brief-teaser renders a real Hauzer briefhoofd.

M052/S06 extends this with a pitchable demo dataset for the Hauzer user/org:
6 favorites spread across the pipeline stages, a projecttype per favorite, and
one rechtspersoon BRK-record on EACH of the 6 favorites so the Contact brief
renders in AUTO mode for every parcel. The demo dataset is fully idempotent — re-running
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
import re
import uuid
from datetime import datetime
from typing import Any

import httpx
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.auth.password import hash_password
from app.core.config import settings
from app.government_apis.woz_waardeloket import woz_waardeloket_client
from app.models.brk_ownership_record import BrkOwnershipRecord
from app.models.organization import Organization
from app.models.parcel_cache import ParcelCache
from app.models.parcel_favorite import ParcelFavorite
from app.models.parcel_project_type import ParcelProjectType
from app.models.scan_result import ScanResult
from app.models.user import User
from app.schemas.address import AddressInput
from app.services.address_resolver import resolve_address

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
# Two "Contact" parcels sit at index 1 and 2; the BRK record + real WOZ land on
# whichever Contact parcel has a Waardeloket object so the Contact brief renders
# in AUTO mode AND the EigenaarCard WOZ tile shows a real value. Index 1
# (Sevenumseweg 41) is a Contact parcel because it has a real Waardeloket WOZ.
DEMO_PIPELINE_STAGES = [
    "Gesignaleerd",
    "Contact",
    "Contact",
    "Onderzoek",
    "Besluit",
    "Afgerond",
]

# Fixed projecttype assignment per favorite (same order as the parcels).
DEMO_PROJECT_TYPES = [
    "optoppen",
    "commercieel_naar_wonen",
    "transformatie_wonen",
    "splitsen",
    "nieuwbouw_wonen",
    "optoppen",
]

# One rechtspersoon BRK record per favorite (same order as the parcels) so the
# Contact-fase brief renders in AUTO mode for EVERY demo parcel. Varied company
# names + statutaire zetel (all Venlo-ish) + varied koopsom/koopjaar + a mix of
# heeft_hypotheek. eigenaar_type stays "rechtspersoon" (CHECK constraint + D8
# non-null naam). The real-WOZ fetch still targets the Contact parcels only.
DEMO_BRK_RECORDS = [
    {
        "eigenaar_type": "rechtspersoon",
        "eigenaar_naam": "Janssen Vastgoed Beheer B.V.",
        "statutaire_zetel": "Industrieweg 12, 5928 PA Venlo",
        "heeft_hypotheek": False,
        "koopsom": 485000,
        "koopjaar": 2018,
    },
    {
        "eigenaar_type": "rechtspersoon",
        "eigenaar_naam": "Maaszicht Investeringen B.V.",
        "statutaire_zetel": "Kazernestraat 8, 5914 XR Venlo",
        "heeft_hypotheek": True,
        "koopsom": 620000,
        "koopjaar": 2021,
    },
    {
        "eigenaar_type": "rechtspersoon",
        "eigenaar_naam": "Venlo Stadsontwikkeling B.V.",
        "statutaire_zetel": "Nolensplein 22, 5912 BH Venlo",
        "heeft_hypotheek": False,
        "koopsom": 1_150_000,
        "koopjaar": 2016,
    },
    {
        "eigenaar_type": "rechtspersoon",
        "eigenaar_naam": "Peelhorst Vastgoed Holding B.V.",
        "statutaire_zetel": "Roermondsestraat 145, 5916 PJ Venlo",
        "heeft_hypotheek": True,
        "koopsom": 395000,
        "koopjaar": 2019,
    },
    {
        "eigenaar_type": "rechtspersoon",
        "eigenaar_naam": "De Weerd Bouwgroep B.V.",
        "statutaire_zetel": "Hogeweg 60, 5911 EC Venlo",
        "heeft_hypotheek": False,
        "koopsom": 875000,
        "koopjaar": 2022,
    },
    {
        "eigenaar_type": "rechtspersoon",
        "eigenaar_naam": "Limburg Real Estate Partners B.V.",
        "statutaire_zetel": "Keulsepoort 31, 5911 BX Venlo",
        "heeft_hypotheek": True,
        "koopsom": 540000,
        "koopjaar": 2020,
    },
]

GEMEENTE_NAAM = "Venlo"

# Indices that sit in the "Contact" pipeline-stage (see DEMO_PIPELINE_STAGES).
# The BRK record + real WOZ land on the first Contact parcel that actually has a
# Waardeloket WOZ object — so the Contact-fase EigenaarCard shows a real value.
CONTACT_PARCEL_INDICES = [1, 2]

# Postcode + huisnummer parsed from a "Straat 12, 1234 AB Plaats" address string.
_ADDRESS_RE = re.compile(r"^(.*?)\s+(\d+)[A-Za-z\-]*,\s*(\d{4}\s?[A-Za-z]{2})", re.UNICODE)


def _parse_postcode_huisnummer(address: str | None) -> tuple[str, int] | None:
    """Extract (postcode, huisnummer) from a ParcelCache.address string."""
    if not address:
        return None
    m = _ADDRESS_RE.match(address.strip())
    if not m:
        return None
    huisnummer = int(m.group(2))
    postcode = m.group(3).upper().replace(" ", "")
    return postcode, huisnummer


async def _fetch_real_woz(
    db: AsyncSession,
    client: httpx.AsyncClient,
    address: str | None,
) -> dict[str, Any] | None:
    """Resolve address -> nummeraanduiding_id -> WOZ Waardeloket.

    Returns a scan-flags-shaped woz dict only when Waardeloket has a real value;
    None when there is no object (404) or no usable value. Never fabricates.
    """
    parsed = _parse_postcode_huisnummer(address)
    if parsed is None:
        return None
    postcode, huisnummer = parsed
    try:
        res = await resolve_address(
            input_data=AddressInput(postcode=postcode, huisnummer=huisnummer),
            client=client,
            session=db,
        )
        na_id = res.address.nummeraanduiding_id
        woz = await woz_waardeloket_client.get_by_nummeraanduiding_id(na_id, client)
    except Exception as exc:  # noqa: BLE001 — seed must never crash on upstream hiccup
        print(f"[seed][demo] WOZ probe failed for {address!r}: {type(exc).__name__}: {exc}")
        return None
    if woz is None or woz.meest_recente_waarde is None:
        return None
    return {
        "meest_recente_waarde": woz.meest_recente_waarde,
        "meest_recente_peildatum": woz.meest_recente_peildatum,
        "low_confidence": woz.low_confidence,
        "low_confidence_reden": woz.low_confidence_reden,
        "bron": woz.bron,
    }


async def _cache_woz_into_scan_flags(
    db: AsyncSession, parcel_cache_id: uuid.UUID, woz_flag: dict[str, Any]
) -> int:
    """Merge the real WOZ dict into scan_results.flags['woz'] for a parcel.

    Read-modify-write the JSONB flags via the ORM (asyncpg cannot bind a
    parameter immediately followed by a ``::jsonb`` cast in a raw text query).
    """
    rows = (
        (
            await db.execute(
                select(ScanResult).where(ScanResult.parcel_id == parcel_cache_id)
            )
        )
        .scalars()
        .all()
    )
    for row in rows:
        flags = dict(row.flags) if isinstance(row.flags, dict) else {}
        flags["woz"] = woz_flag
        row.flags = flags
    return len(rows)


async def seed_demo_dataset(
    db: AsyncSession,
    *,
    org_id: uuid.UUID,
    user_id: uuid.UUID,
    client: httpx.AsyncClient | None = None,
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

    # 4. Insert ONE rechtspersoon BRK record per favorite so the Contact-fase
    # brief renders in AUTO mode for EVERY parcel. Each record gets its own
    # varied demo data (company name, statutaire zetel, koopsom/koopjaar,
    # heeft_hypotheek) from DEMO_BRK_RECORDS, same order as the parcels.
    brk_count = 0
    for idx, parcel in enumerate(parcels):
        rec = DEMO_BRK_RECORDS[idx % len(DEMO_BRK_RECORDS)]
        db.add(
            BrkOwnershipRecord(
                organization_id=org_id,
                parcel_id=parcel.parcel_id,
                eigenaar_type=rec["eigenaar_type"],
                eigenaar_naam=rec["eigenaar_naam"],
                statutaire_zetel=rec["statutaire_zetel"],
                heeft_hypotheek=rec["heeft_hypotheek"],
                koopsom=rec["koopsom"],
                koopjaar=rec["koopjaar"],
                fetched_at=datetime.utcnow(),
            )
        )
        brk_count += 1

    # 5. Real-WOZ enrichment: prefer a Contact-stage parcel that has a REAL WOZ
    # (Waardeloket object) so the Contact-fase EigenaarCard shows a real value
    # next to the BRK eigenaar. WOZ is fetched live and cached into
    # scan_results.flags['woz'] — never fabricated.
    woz_index = CONTACT_PARCEL_INDICES[0] if CONTACT_PARCEL_INDICES else 0
    brk_woz: dict[str, Any] | None = None
    if client is not None:
        for idx in CONTACT_PARCEL_INDICES:
            if idx >= len(parcels):
                continue
            woz = await _fetch_real_woz(db, client, parcels[idx].address)
            if woz is not None:
                woz_index = idx
                brk_woz = woz
                break

    # Cache the real WOZ (if any) into the chosen Contact parcel's scan flags so
    # the enrich endpoint surfaces it to the EigenaarCard WOZ tile.
    woz_rows = 0
    if brk_woz is not None and len(parcels) > woz_index:
        woz_rows = await _cache_woz_into_scan_flags(db, parcels[woz_index].id, brk_woz)

    await db.commit()

    print(f"[seed][demo] Favorites seeded: {fav_count}")
    print(f"[seed][demo] Projecttypes seeded: {pt_count}")
    print(f"[seed][demo] BRK records seeded: {brk_count}")
    if brk_woz is not None:
        print(
            f"[seed][demo] Real WOZ cached on BRK parcel: "
            f"EUR {brk_woz['meest_recente_waarde']:,} "
            f"(peildatum {brk_woz['meest_recente_peildatum']}) "
            f"into {woz_rows} scan_results row(s)"
        )
    else:
        print(
            "[seed][demo] No Waardeloket WOZ object for any Contact parcel — "
            "WOZ tile shows honest '—' state."
        )
    print("[seed][demo] Pipeline:")
    for idx, parcel in enumerate(parcels):
        rec = DEMO_BRK_RECORDS[idx % len(DEMO_BRK_RECORDS)]
        woz_marker = "  <- real WOZ" if idx == woz_index and brk_woz is not None else ""
        print(
            f"  {idx}: {parcel.parcel_id} | {parcel.address} | "
            f"{DEMO_PIPELINE_STAGES[idx]} | {DEMO_PROJECT_TYPES[idx]} | "
            f"BRK: {rec['eigenaar_naam']}{woz_marker}"
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

        # 3. M052/S06 demo dataset — favorites + projecttypes + rechtspersoon BRK
        # + real WOZ on the BRK Contact parcel (fetched live from Waardeloket).
        async with httpx.AsyncClient(timeout=30.0) as client:
            await seed_demo_dataset(
                db, org_id=org.id, user_id=user_id, client=client
            )


if __name__ == "__main__":
    asyncio.run(seed())
