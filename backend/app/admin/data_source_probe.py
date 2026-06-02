"""Type-B (open API) liveness probe for the M049 data-source hub.

Background: the data-hub panel reads `data_source_status`. For type-B (open API)
sources the refresh probe was never wired ("Probe wordt later gewired"), so the
table stayed empty and the panel showed 0/17 — even though every one of those
APIs runs in each scan and has enriched 60k+ Venlo parcels. That UNDER-reports
the platform (a demo-credibility risk).

This probe marks a type-B source `live` for a gemeente ONLY when there is real
evidence it produced data for that gemeente's scans:
  * FLAG_EVIDENCE   — a top-level key in scan_results.flags (the enrichment APIs)
  * PARCEL_COL_EVIDENCE — a non-null parcel_cache column (BAG address, kadaster,
    DSO bestemming come back as parcel fields, not flags)
  * NO_SCAN_EVIDENCE — sources that don't leave per-scan evidence yet
    (rechtspraak, KOOP-CVDR, RCE — RCE has a known 403). Left honestly `missing`
    rather than faked live.

Honest both ways: we don't claim 0/17 when 14 demonstrably work, and we don't
claim 17/17 when 3 can't be proven.
"""

from __future__ import annotations

import uuid

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.data_source_status import DataSourceStatus
from app.policy_documents.data_source_keys import get_entries_by_type

# source_key -> scan_results.flags top-level key proving the API enriched a scan.
FLAG_EVIDENCE: dict[str, str] = {
    "bag-panden": "building_metrics",
    "3d-bag": "building_metrics",
    "cbs-statline": "market_signals",
    "bodemloket": "bodem",
    "pdok-funderingsrisico": "funderingsrisico",
    "pdok-natura2000": "natura2000",
    "rws-overstroming-wms": "overstromingsrisico",
    "rivm-geluid-lden": "geluid",
    "rivm-luchtkwaliteit": "luchtkwaliteit",
    "sru-bekendmakingen": "vergunningen",
    "ep-online-energielabel": "energielabel",
}

# source_key -> parcel_cache column that is non-null when the source ran.
PARCEL_COL_EVIDENCE: dict[str, str] = {
    "bag-adressen": "address",
    "kadaster-cadastral-pdok": "parcel_code",
    "dso-omgevingsplan": "bestemmingen",
}

# Type-B sources with no per-scan evidence yet — left honestly `missing`.
NO_SCAN_EVIDENCE: frozenset[str] = frozenset(
    {"rechtspraak-jurisprudentie", "koop-sru-cvdr", "rce-rijksmonumenten"}
)

# parcel_cache columns the probe is allowed to test (guards against SQL injection
# via the mapping + documents the contract).
_ALLOWED_PARCEL_COLS = frozenset(PARCEL_COL_EVIDENCE.values())


def assert_catalog_covered() -> None:
    """Every type-B catalog key must have exactly one evidence rule.

    Guards against a newly-added source silently defaulting to missing/forgotten.
    """
    keys = {e.key for e in get_entries_by_type("B")}
    covered = set(FLAG_EVIDENCE) | set(PARCEL_COL_EVIDENCE) | set(NO_SCAN_EVIDENCE)
    missing = keys - covered
    extra = covered - keys
    if missing or extra:
        raise AssertionError(
            f"data_source_probe catalog drift — uncovered type-B keys: {missing}; "
            f"rules for unknown keys: {extra}"
        )


def classify(source_key: str, *, evidence_present: bool) -> str:
    """Pure status decision for a type-B source given whether evidence was found."""
    if source_key in NO_SCAN_EVIDENCE:
        return "missing"
    return "live" if evidence_present else "missing"


async def _has_flag(db: AsyncSession, gemeente_code: str, flag_key: str) -> bool:
    sql = text(
        "select exists(select 1 from scan_results sr "
        "join area_scans a on sr.scan_id = a.id "
        "where a.gemeente_code = :g and a.status = 'completed' and sr.flags ? :fk)"
    )
    return bool((await db.execute(sql, {"g": gemeente_code, "fk": flag_key})).scalar())


async def _has_parcel_col(db: AsyncSession, gemeente_code: str, col: str) -> bool:
    if col not in _ALLOWED_PARCEL_COLS:  # defensive — only mapped columns
        raise ValueError(f"parcel_cache column not allowed in probe: {col}")
    sql = text(
        f"select exists(select 1 from scan_results sr "
        f"join area_scans a on sr.scan_id = a.id "
        f"join parcel_cache pc on sr.parcel_id = pc.id "
        f"where a.gemeente_code = :g and a.status = 'completed' and pc.{col} is not null)"
    )
    return bool((await db.execute(sql, {"g": gemeente_code})).scalar())


async def probe_gemeente(db: AsyncSession, gemeente_code: str) -> dict[str, str]:
    """Probe all type-B sources for one gemeente and upsert data_source_status.

    Returns {source_key: status}. Does NOT commit — caller owns the transaction.
    """
    assert_catalog_covered()
    results: dict[str, str] = {}

    for entry in get_entries_by_type("B"):
        key = entry.key
        if key in NO_SCAN_EVIDENCE:
            evidence = False
        elif key in FLAG_EVIDENCE:
            evidence = await _has_flag(db, gemeente_code, FLAG_EVIDENCE[key])
        else:  # PARCEL_COL_EVIDENCE
            evidence = await _has_parcel_col(db, gemeente_code, PARCEL_COL_EVIDENCE[key])

        status = classify(key, evidence_present=evidence)
        results[key] = status

        existing = await db.scalar(
            text(
                "select id from data_source_status "
                "where gemeente_code = :g and source_key = :k"
            ),
            {"g": gemeente_code, "k": key},
        )
        if existing is not None:
            await db.execute(
                text(
                    "update data_source_status set status = :s, last_checked = now(), "
                    "error_message = null where id = :id"
                ),
                {"s": status, "id": existing},
            )
        else:
            db.add(
                DataSourceStatus(
                    id=uuid.uuid4(),
                    gemeente_code=gemeente_code,
                    source_key=key,
                    status=status,
                    error_message=None,
                )
            )

    return results
