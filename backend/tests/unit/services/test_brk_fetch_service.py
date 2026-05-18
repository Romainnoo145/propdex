"""Unit tests for brk_fetch_service helpers (M050/S02 D3 + D5 + D9).

Closes ENG-PLAN §Test coverage diagram unit GAPS for the fetch orchestration:
- _parse_brk_response_into_records: AVG defense layer 1 — drops natuurlijk_persoon,
  extracts rechtspersoon + overheid, handles empty input + natuurlijk-only.
- _is_cache_fresh: D3 — 30-day TTL boundary checks.
- _acquire_advisory_lock: D5 — try-acquire on free lock, returns False under
  contention (real Postgres advisory lock against two sessions).
- _lock_key: D5 — stable hashlib.sha256-based derivation (NOT Python hash()).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta

import pytest

from app.schemas.brk_ownership_record import BRKOwnershipRecordRead
from app.services.brk_fetch_service import (
    CACHE_TTL_DAYS,
    _acquire_advisory_lock,
    _is_cache_fresh,
    _lock_key,
    _parse_brk_response_into_records,
)

# Anonymized crafted BRK Bevragen v2 response. Mirrors the
# property_aggregator._parse_perceel_ownership shape — see
# app/services/property_aggregator.py for the canonical parser this mirrors.
MIXED_RAW = {
    "_embedded": {
        "zakelijkGerechtigden": [
            {  # natuurlijk_persoon — MUST be dropped (AVG layer 1)
                "persoon": {
                    "type": "NatuurlijkPersoon",
                    "voornamen": "Geheim",
                    "geslachtsnaam": "X",
                },
                "type": "Eigendom",
            },
            {  # rechtspersoon — MUST produce a record
                "persoon": {
                    "type": "NietNatuurlijkPersoon",
                    "statutaireNaam": "BV Voorbeeld",
                    "kvkNummer": "12345678",
                    "statutaireZetel": "Amsterdam",
                },
                "type": "Eigendom",
                "aandeel": {"teller": 1, "noemer": 1},
                "stukken": [{"koopsom": {"koopsom": 250000, "koopjaar": 2023}}],
            },
            {  # overheid — detected via beschikkingsbevoegdheid code
                "persoon": {
                    "type": "NietNatuurlijkPersoon",
                    "statutaireNaam": "Gemeente Venlo",
                },
                "beschikkingsbevoegdheid": {"code": "PubliekrechtelijkRechtspersoon"},
                "type": "Eigendom",
            },
        ]
    }
}


# ──────────────────────────────────────────────────────────────────────────
# _parse_brk_response_into_records — AVG layer 1
# ──────────────────────────────────────────────────────────────────────────


def test_parse_brk_response_drops_natuurlijk_persoon() -> None:
    """Records returned MUST exclude any natuurlijk_persoon entry."""
    records = _parse_brk_response_into_records(MIXED_RAW, "NL.IMKAD.Test.1")
    eigenaar_types = {r.eigenaar_type for r in records}
    assert "natuurlijk_persoon" not in eigenaar_types
    assert len(records) == 2  # rechtspersoon + overheid


def test_parse_brk_response_extracts_rechtspersoon_fields() -> None:
    records = _parse_brk_response_into_records(MIXED_RAW, "NL.IMKAD.Test.1")
    bv = next(r for r in records if r.eigenaar_type == "rechtspersoon")
    assert bv.eigenaar_naam == "BV Voorbeeld"
    assert bv.kvk_nummer == "12345678"
    assert bv.statutaire_zetel == "Amsterdam"
    assert bv.aandeel == "1/1"
    assert bv.koopsom == 250000
    assert bv.koopjaar == 2023


def test_parse_brk_response_extracts_overheid() -> None:
    records = _parse_brk_response_into_records(MIXED_RAW, "NL.IMKAD.Test.1")
    gem = next(r for r in records if r.eigenaar_type == "overheid")
    assert gem.eigenaar_naam == "Gemeente Venlo"


def test_parse_brk_response_empty_input() -> None:
    raw = {"_embedded": {"zakelijkGerechtigden": []}}
    assert _parse_brk_response_into_records(raw, "NL.IMKAD.Test.X") == []


def test_parse_brk_response_only_natuurlijk_persoon() -> None:
    """D9 empty-list semantic: natuurlijk-only response → 0 records persisted."""
    raw = {
        "_embedded": {
            "zakelijkGerechtigden": [
                {
                    "persoon": {
                        "type": "NatuurlijkPersoon",
                        "voornamen": "X",
                        "geslachtsnaam": "Y",
                    },
                    "type": "Eigendom",
                },
            ]
        }
    }
    assert _parse_brk_response_into_records(raw, "NL.IMKAD.Test.NP") == []


def test_parse_brk_response_missing_embedded_returns_empty() -> None:
    """Defensive: malformed/missing _embedded should not crash."""
    assert _parse_brk_response_into_records({}, "NL.IMKAD.X") == []


# ──────────────────────────────────────────────────────────────────────────
# _is_cache_fresh — D3 30-day TTL
# ──────────────────────────────────────────────────────────────────────────


def _read(fetched_at: datetime) -> BRKOwnershipRecordRead:
    """Build a minimal BRKOwnershipRecordRead for cache-freshness tests."""
    return BRKOwnershipRecordRead(
        id=uuid.uuid4(),
        organization_id=uuid.uuid4(),
        parcel_id="NL.IMKAD.Test.1",
        eigenaar_type="rechtspersoon",
        eigenaar_naam="BV",
        kvk_nummer=None,
        statutaire_zetel=None,
        zakelijk_recht_type=None,
        aandeel=None,
        koopsom=None,
        koopjaar=None,
        heeft_hypotheek=False,
        fetched_at=fetched_at,
        soft_deleted_at=None,
        hard_delete_after=None,
        created_at=fetched_at,
        updated_at=fetched_at,
    )


def test_is_cache_fresh_empty_list() -> None:
    assert _is_cache_fresh([]) is False


def test_is_cache_fresh_within_30_days() -> None:
    rec = _read(datetime.utcnow() - timedelta(days=1))
    assert _is_cache_fresh([rec]) is True


def test_is_cache_fresh_past_30_days() -> None:
    rec = _read(datetime.utcnow() - timedelta(days=CACHE_TTL_DAYS + 1))
    assert _is_cache_fresh([rec]) is False


def test_is_cache_fresh_picks_newest_when_mixed() -> None:
    """Multiple historical rows — freshness uses the NEWEST fetched_at."""
    old = _read(datetime.utcnow() - timedelta(days=400))
    recent = _read(datetime.utcnow() - timedelta(days=2))
    assert _is_cache_fresh([old, recent]) is True


# ──────────────────────────────────────────────────────────────────────────
# _lock_key — D5 stable hashlib-based derivation
# ──────────────────────────────────────────────────────────────────────────


def test_lock_key_derivation_is_stable() -> None:
    """Same (org, parcel) → same int across calls (hashlib NOT Python hash())."""
    org = uuid.UUID("12345678-1234-5678-1234-567812345678")
    parcel = "NL.IMKAD.Stable.1"
    k1 = _lock_key(org, parcel)
    k2 = _lock_key(org, parcel)
    assert k1 == k2
    # Signed 64-bit int fits Postgres bigint
    assert -(2**63) <= k1 < 2**63


def test_lock_key_different_inputs_produce_different_keys() -> None:
    org_a = uuid.UUID("11111111-1111-1111-1111-111111111111")
    org_b = uuid.UUID("22222222-2222-2222-2222-222222222222")
    parcel = "NL.IMKAD.X.1"
    assert _lock_key(org_a, parcel) != _lock_key(org_b, parcel)
    assert _lock_key(org_a, parcel) != _lock_key(org_a, "NL.IMKAD.X.2")


# ──────────────────────────────────────────────────────────────────────────
# _acquire_advisory_lock — D5 real-Postgres dedup
# ──────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_acquire_advisory_lock_returns_true_on_free_lock(
    test_db, create_test_user
) -> None:
    """Free lock → True (winner)."""
    _, org = await create_test_user()
    got = await _acquire_advisory_lock(test_db, org.id, "NL.IMKAD.Lock.Free")
    assert got is True
    await test_db.commit()  # release


@pytest.mark.asyncio
async def test_acquire_advisory_lock_returns_false_when_contended(
    test_engine, create_test_user
) -> None:
    """Two real DB sessions, same (org, parcel) — second call returns False.

    pg_try_advisory_xact_lock against an already-held lock returns False
    immediately. Lock is xact-scoped: auto-released at commit.
    """
    from sqlalchemy.ext.asyncio import async_sessionmaker

    _, org = await create_test_user()

    factory = async_sessionmaker(test_engine, expire_on_commit=False)
    parcel = "NL.IMKAD.Lock.Contended.1"

    async with factory() as s1, factory() as s2:
        got1 = await _acquire_advisory_lock(s1, org.id, parcel)
        got2 = await _acquire_advisory_lock(s2, org.id, parcel)
        try:
            assert got1 is True
            assert got2 is False, "second session must NOT acquire contended lock"
        finally:
            await s1.commit()  # release advisory lock
            await s2.rollback()
