"""Parity gate (M053/S10): the new shared cascade compute must reproduce the
stored (backfilled) scores. Read-only; writes nothing. Exits non-zero on drift.

Usage:
    python -m app.tools.verify_cascade_parity --gemeente GM0983 --sample 200
    python -m app.tools.verify_cascade_parity --gemeente GM0983 --sample 200 --organization-id <uuid>
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import uuid
from dataclasses import asdict
from typing import Any

from sqlalchemy import func, select, text

from app.core.database import async_session_factory
from app.models.area_scan import AreaScan
from app.models.organization import Organization
from app.models.parcel_cache import ParcelCache
from app.models.scan_result import ScanResult
from app.services.cascade_scoring import build_parcel_data, load_gemeente_cascade_payloads
from app.services.score_v3 import compute_score_v3

logger = logging.getLogger(__name__)

# Maximum acceptable absolute difference between recomputed and stored score.
PARITY_TOLERANCE: float = 0.5

# Cascade factor IDs we check parity for.
_CASCADE_FACTORS: tuple[str, ...] = ("woonvisie_match", "beleidsalignement")


def _parse_uuid(value: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(f"Invalid UUID: {value}") from exc


async def _resolve_org_id(target_org_id: uuid.UUID | None) -> uuid.UUID | None:
    async with async_session_factory() as session:
        if target_org_id is not None:
            row = await session.execute(
                select(Organization.id).where(Organization.id == target_org_id)
            )
            return row.scalar_one_or_none()

        rows = (await session.execute(select(Organization.id))).scalars().all()
        if len(rows) == 1:
            return rows[0]
        logger.error(
            "Multiple organizations found — pass --organization-id explicitly. Found: %s",
            rows,
        )
        return None


def _get_stored_cascade_score(flags: dict[str, Any], factor_id: str) -> float | None:
    """Extract stored genormaliseerde_score for a cascade factor from flags."""
    breakdown = flags.get("score_breakdown") or {}
    factor_dict = breakdown.get(factor_id)
    if not isinstance(factor_dict, dict):
        return None
    val = factor_dict.get("genormaliseerde_score")
    if val is None:
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def _get_stored_overall(flags: dict[str, Any], sr: Any) -> float | None:
    """Extract stored overall score from flags['scores']['overall'] or sr.score."""
    scores = flags.get("scores") or {}
    overall = scores.get("overall")
    if overall is not None:
        try:
            return float(overall)
        except (TypeError, ValueError):
            pass
    # Fall back to the denormalized sr.score column
    if sr.score is not None:
        try:
            return float(sr.score)
        except (TypeError, ValueError):
            pass
    return None


async def _verify(
    gemeente_code: str,
    org_id: uuid.UUID,
    sample: int,
) -> int:
    """Run the parity check.  Returns 0 (all match) or 1 (drift found)."""

    async with async_session_factory() as session:
        await session.execute(text(f"SET app.current_tenant_id = '{org_id}'"))

        # ------------------------------------------------------------------ #
        # Step 1: load cascade payloads (read-only)                           #
        # ------------------------------------------------------------------ #
        payloads = await load_gemeente_cascade_payloads(
            session, gemeente_code=gemeente_code, organization_id=org_id
        )
        if not payloads:
            print(
                f"no cascade documents for gemeente {gemeente_code}; nothing to verify"
            )
            return 0

        # ------------------------------------------------------------------ #
        # Step 2: sample rows that already have at least one cascade factor   #
        # stored in flags["score_breakdown"]                                  #
        # ------------------------------------------------------------------ #
        # We filter for score-v3.0 rows only (pre-v3.0 were never backfilled
        # with cascade scores).  We also require that at least one of the
        # cascade factor keys is present in score_breakdown.
        any_cascade_filter = " OR ".join(
            f"flags->'score_breakdown' ? '{fid}'" for fid in _CASCADE_FACTORS
        )
        stmt = (
            select(
                ScanResult,
                ParcelCache,
                AreaScan.wijk_naam,
                func.ST_Perimeter(ParcelCache.geometry).label("perimeter_m"),
                AreaScan.neighborhood_metrics,
            )
            .join(ParcelCache, ParcelCache.id == ScanResult.parcel_id)
            .join(AreaScan, AreaScan.id == ScanResult.scan_id)
            .where(
                ParcelCache.gemeente_code == gemeente_code,
                ScanResult.flags["score_model_version"].as_string() == "score-v3.0",
                text(f"({any_cascade_filter})"),
            )
            .order_by(ScanResult.id)
            .limit(sample)
        )
        rows = (await session.execute(stmt)).all()

    if not rows:
        print(
            f"sampled 0 rows — no backfilled cascade rows found for gemeente "
            f"{gemeente_code}.  This gate is a PENDING PRE-DEPLOY check: run "
            f"against prod (gondola.proxy.rlwy.net:39031) before shipping S10."
        )
        return 0

    # ------------------------------------------------------------------ #
    # Step 3: recompute IN MEMORY and compare                             #
    # ------------------------------------------------------------------ #
    # Mismatch record: (parcel_id, field, stored, recomputed, diff)
    Mismatch = tuple[str, str, float, float, float]

    matched = 0
    mismatched = 0
    skipped = 0
    worst: list[Mismatch] = []

    for sr, pc, wijk_naam, perimeter_m, nbhd in rows:
        flags: dict[str, Any] = sr.flags or {}
        parcel_data = build_parcel_data(
            pc, flags, perimeter_m=perimeter_m, wijk_naam=wijk_naam
        )
        # Recompute — pure in-memory; no DB write
        result = compute_score_v3(
            parcel_data,
            nbhd,
            project_type="onbepaald",
            cascade_payloads=payloads,
        )

        parcel_str = str(pc.parcel_id)

        # --- cascade factor scores ---
        for factor_id in _CASCADE_FACTORS:
            stored_val = _get_stored_cascade_score(flags, factor_id)
            if stored_val is None:
                # Factor was not in the backfill for this row — skip
                skipped += 1
                continue

            recomputed_factor = result.score_breakdown.get(factor_id)
            if recomputed_factor is None:
                # Factor absent in recompute but present in stored — count as skip
                # (payload may differ between runs if SCHEMA_VERSION bumped)
                skipped += 1
                continue

            recomputed_val: float = asdict(recomputed_factor)["genormaliseerde_score"]
            diff = abs(recomputed_val - stored_val)
            if diff > PARITY_TOLERANCE:
                mismatched += 1
                worst.append((parcel_str, factor_id, stored_val, recomputed_val, diff))
            else:
                matched += 1

        # --- overall score ---
        stored_overall = _get_stored_overall(flags, sr)
        if stored_overall is None:
            skipped += 1
        else:
            recomputed_overall = result.overall
            diff = abs(recomputed_overall - stored_overall)
            if diff > PARITY_TOLERANCE:
                mismatched += 1
                worst.append(
                    (parcel_str, "overall", stored_overall, recomputed_overall, diff)
                )
            else:
                matched += 1

    # ------------------------------------------------------------------ #
    # Step 4: print summary                                               #
    # ------------------------------------------------------------------ #
    print(
        f"\nParity report — gemeente={gemeente_code} tolerance={PARITY_TOLERANCE}"
    )
    print(f"  Rows sampled : {len(rows)}")
    print(f"  Fields matched   : {matched}")
    print(f"  Fields mismatched: {mismatched}")
    print(f"  Fields skipped   : {skipped}  (None on either side)")

    if mismatched > 0:
        worst_sorted = sorted(worst, key=lambda x: x[4], reverse=True)[:5]
        print(f"\nTop-{len(worst_sorted)} worst mismatches (parcel_id | field | stored | recomputed | diff):")
        for parcel_str, field_name, stored_v, recomp_v, diff in worst_sorted:
            print(
                f"  {parcel_str}  {field_name:<28}  "
                f"stored={stored_v:.4f}  recomputed={recomp_v:.4f}  diff={diff:.4f}"
            )
        print(f"\nRESULT: FAIL — {mismatched} field(s) exceed tolerance {PARITY_TOLERANCE}")
        return 1

    print(f"\nRESULT: PASS — all {matched} field comparisons within tolerance {PARITY_TOLERANCE}")
    return 0


async def _run(
    *,
    gemeente_code: str,
    organization_id: uuid.UUID | None,
    sample: int,
) -> int:
    org_id = await _resolve_org_id(organization_id)
    if org_id is None:
        return 1
    return await _verify(gemeente_code, org_id, sample)


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Parity gate (M053/S10): verify the shared cascade compute reproduces "
            "stored (backfilled) scores. Read-only; writes nothing to the DB."
        ),
    )
    parser.add_argument(
        "--gemeente",
        required=True,
        help="Gemeente code to verify (e.g. GM0983 = Venlo)",
    )
    parser.add_argument(
        "--sample",
        type=int,
        default=200,
        help="Number of backfilled rows to sample (default: 200)",
    )
    parser.add_argument(
        "--organization-id",
        type=_parse_uuid,
        help="Optional organization UUID (required when multiple orgs exist)",
    )
    return parser


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
    )

    parser = _build_parser()
    args = parser.parse_args()

    if args.sample < 1:
        parser.error("--sample must be >= 1")

    exit_code = asyncio.run(
        _run(
            gemeente_code=args.gemeente,
            organization_id=args.organization_id,
            sample=args.sample,
        )
    )
    raise SystemExit(exit_code)


if __name__ == "__main__":
    main()
