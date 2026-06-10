"""Background re-score job: re-apply custom org weights to stored scan_results.

This job reads genormaliseerde_score from stored score_breakdown and re-multiplies
by new custom weights. It does NOT call compute_score_v3() — factor computations
are never re-run. Only bijdrage, gewicht, and overall scores are updated.

Only processes rows with score_model_version == "score-v3.0".
"""

import logging
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.models.area_scan import AreaScan
from app.models.organization import Organization
from app.models.project import Project
from app.models.scan_result import ScanResult
from app.services.score_v3 import CASCADE_GATED_FACTORS, DEFAULT_WEIGHTS

logger = logging.getLogger(__name__)

# Process in batches to avoid loading all scan_results at once
BATCH_SIZE = 500

# Default max weights per category (used when no custom weights provided)
_DEFAULT_POTENTIE_MAX = 80
_DEFAULT_RISICO_MAX = 87
_MAX_DISCOUNT = 0.5


def _rescore_from_breakdown(
    flags: dict[str, Any],
    custom_weights: dict[str, Any],
    balance: float,
) -> tuple[float, float, float] | None:
    """Re-apply custom weights to a stored score_breakdown.

    Reads genormaliseerde_score from each factor, multiplies by new custom weight
    (or default if not overridden), then recomputes potentie/risico/overall.

    Args:
        flags: The scan_result.flags dict (must contain score_breakdown and score_model_version)
        custom_weights: Dict with potentie_weights, risico_weights (factor -> weight int)
        balance: potentie_risico_balance float (0.0-1.0)

    Returns:
        Tuple of (potentie_score, risico_score, overall) or None if not v3.0
    """
    # Only process v3.0 rows
    if flags.get("score_model_version") != "score-v3.0":
        return None

    breakdown: dict[str, Any] = flags.get("score_breakdown") or {}
    if not breakdown:
        return None

    # Ensure at least one factor has 'categorie' key (confirms it's a real v3.0 breakdown)
    first = next(iter(breakdown.values()), {})
    if not isinstance(first, dict) or "categorie" not in first:
        return None

    potentie_weights_override = custom_weights.get("potentie_weights") or {}
    risico_weights_override = custom_weights.get("risico_weights") or {}

    # Use DEFAULT_WEIGHTS as fallback for any factor not in custom_weights
    default_potentie = DEFAULT_WEIGHTS["potentie_weights"]
    default_risico = DEFAULT_WEIGHTS["risico_weights"]

    raw_potentie = 0.0
    raw_risico = 0.0
    potentie_max = 0.0
    risico_max = 0.0

    updated_breakdown: dict[str, dict[str, Any]] = {}

    for factor_name, factor_data in breakdown.items():
        if not isinstance(factor_data, dict):
            continue

        categorie = factor_data.get("categorie", "")
        gen_score = factor_data.get("genormaliseerde_score")
        if gen_score is None or isinstance(gen_score, bool):
            continue
        gen_score = float(gen_score)

        if categorie == "potentie":
            # Verdict-gated cascade factors keep the weight compute_score_v3 assigned
            # (stored in the breakdown); neither override nor default may bypass the gate.
            if factor_name in CASCADE_GATED_FACTORS:
                new_weight = float(factor_data.get("gewicht", 0))
            elif factor_name in potentie_weights_override:
                new_weight = float(potentie_weights_override[factor_name])
            else:
                new_weight = float(default_potentie.get(factor_name, 0))
            bijdrage = round(gen_score * new_weight, 4)
            raw_potentie += bijdrage
            potentie_max += new_weight

        elif categorie == "risico":
            if factor_name in risico_weights_override:
                new_weight = float(risico_weights_override[factor_name])
            else:
                new_weight = float(default_risico.get(factor_name, 0))
            bijdrage = round(gen_score * new_weight, 4)
            raw_risico += bijdrage
            risico_max += new_weight

        else:
            # Unknown category — carry through unchanged
            new_weight = float(factor_data.get("gewicht", 0))
            bijdrage = round(gen_score * new_weight, 4)

        # Build updated factor data
        updated_factor = dict(factor_data)
        updated_factor["gewicht"] = new_weight
        updated_factor["bijdrage"] = bijdrage
        updated_breakdown[factor_name] = updated_factor

    # Compute normalized scores (use actual sums as denominators for custom weights)
    if potentie_max > 0:
        potentie_score = min(100.0, max(0.0, round((raw_potentie / potentie_max) * 100, 1)))
    else:
        potentie_score = 0.0

    if risico_max > 0:
        risico_score = min(100.0, max(0.0, round((raw_risico / risico_max) * 100, 1)))
    else:
        risico_score = 0.0

    # Discount formula: overall = potentie × (1 - risico_discount)
    risico_discount = min(_MAX_DISCOUNT, (risico_score / 100.0) * (1.0 - balance))
    overall = round(potentie_score * (1.0 - risico_discount), 1)
    overall = max(0.0, min(100.0, overall))

    return potentie_score, risico_score, overall


async def rescore_weights_job(ctx: dict, *, organization_id: str) -> dict:
    """Re-apply custom org score weights to all stored scan_results.

    Reads genormaliseerde_score from stored score_breakdown per factor,
    multiplies by new custom weights, updates scores in-place.

    Does NOT call compute_score_v3() — no API calls, no factor re-computation.
    Only processes rows with score_model_version == "score-v3.0".

    Args:
        ctx: ARQ worker context
        organization_id: UUID string of the organization to rescore

    Returns:
        Summary dict: {processed, up_count, down_count, unchanged_count, avg_delta}
    """
    engine = create_async_engine(
        settings.DATABASE_URL,
        pool_size=5,
        max_overflow=10,
        echo=False,
    )
    session_factory = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )

    org_uuid = uuid.UUID(organization_id)

    processed = 0
    up_count = 0
    down_count = 0
    unchanged_count = 0
    total_delta = 0.0

    try:
        async with session_factory() as session:
            # Load org to get custom weights
            result = await session.execute(
                select(Organization).where(Organization.id == org_uuid)
            )
            org = result.scalar_one_or_none()

            if org is None or org.score_weights is None:
                logger.info(f"No custom weights for org {organization_id} — nothing to rescore")
                return {"processed": 0}

            weights_config: dict[str, Any] = org.score_weights
            custom_weights = {
                "potentie_weights": weights_config.get("potentie_weights") or {},
                "risico_weights": weights_config.get("risico_weights") or {},
            }
            balance = float(weights_config.get("potentie_risico_balance", 0.7))

            # Stream scan_results in batches
            offset = 0
            while True:
                # Org-scope (audit CRIT-1): only rescore rows whose owning scan
                # belongs to THIS org's projects. scan_results is shared reference
                # data with no organization_id; ownership is resolved via
                # scan_id -> area_scans.project_id -> projects.organization_id.
                # Rows from scans without an org project are intentionally skipped
                # — they are not this org's data and must not be overwritten with
                # this org's custom weights.
                stmt = (
                    select(ScanResult)
                    .join(AreaScan, AreaScan.id == ScanResult.scan_id)
                    .join(Project, Project.id == AreaScan.project_id)
                    .where(
                        ScanResult.flags.isnot(None),
                        Project.organization_id == org_uuid,
                    )
                    .order_by(ScanResult.id)
                    .offset(offset)
                    .limit(BATCH_SIZE)
                )
                batch_result = await session.execute(stmt)
                rows = list(batch_result.scalars().all())

                if not rows:
                    break

                for sr in rows:
                    if sr.flags is None:
                        continue

                    old_score = sr.score or 0.0
                    scores = _rescore_from_breakdown(sr.flags, custom_weights, balance)

                    if scores is None:
                        # Not a v3.0 row — skip
                        continue

                    pot_score, ris_score, new_overall = scores

                    # Update flags in-place
                    updated_flags = dict(sr.flags)
                    updated_flags["scores"] = {
                        "potentie_score": pot_score,
                        "risico_score": ris_score,
                        "overall": new_overall,
                    }
                    # Update score_breakdown with new bijdrage/gewicht values
                    # (already computed inside _rescore_from_breakdown — rebuild from stored data)
                    # Re-run to get updated_breakdown for flags update
                    _update_breakdown_in_flags(updated_flags, custom_weights, balance)

                    sr.score = new_overall
                    sr.flags = updated_flags

                    # Track delta
                    delta = new_overall - old_score
                    total_delta += delta
                    processed += 1

                    if delta > 0.05:
                        up_count += 1
                    elif delta < -0.05:
                        down_count += 1
                    else:
                        unchanged_count += 1

                await session.flush()
                logger.info(f"Rescored batch offset={offset}, rows={len(rows)}, processed={processed}")
                offset += BATCH_SIZE

                if len(rows) < BATCH_SIZE:
                    break

            await session.commit()
            logger.info(
                f"Rescore complete for org {organization_id}: "
                f"processed={processed}, up={up_count}, down={down_count}, unchanged={unchanged_count}"
            )

    except Exception:
        logger.exception(f"Rescore job failed for org {organization_id}")
        raise
    finally:
        await engine.dispose()

    avg_delta = round(total_delta / processed, 2) if processed > 0 else 0.0

    return {
        "processed": processed,
        "up_count": up_count,
        "down_count": down_count,
        "unchanged_count": unchanged_count,
        "avg_delta": avg_delta,
    }


def _update_breakdown_in_flags(
    flags: dict[str, Any],
    custom_weights: dict[str, Any],
    balance: float,
) -> None:
    """Update score_breakdown bijdrage/gewicht values in-place within flags dict.

    Mutates flags["score_breakdown"] to reflect new custom weights.
    """
    breakdown = flags.get("score_breakdown")
    if not isinstance(breakdown, dict):
        return

    potentie_weights_override = custom_weights.get("potentie_weights") or {}
    risico_weights_override = custom_weights.get("risico_weights") or {}

    default_potentie = DEFAULT_WEIGHTS["potentie_weights"]
    default_risico = DEFAULT_WEIGHTS["risico_weights"]

    for factor_name, factor_data in breakdown.items():
        if not isinstance(factor_data, dict):
            continue

        categorie = factor_data.get("categorie", "")
        gen_score = factor_data.get("genormaliseerde_score")
        if gen_score is None or isinstance(gen_score, bool):
            continue
        gen_score = float(gen_score)

        if categorie == "potentie":
            # Verdict-gated cascade factors keep the weight compute_score_v3 assigned;
            # neither override nor default may bypass the gate.
            if factor_name in CASCADE_GATED_FACTORS:
                new_weight = float(factor_data.get("gewicht", 0))
            elif factor_name in potentie_weights_override:
                new_weight = float(potentie_weights_override[factor_name])
            else:
                new_weight = float(default_potentie.get(factor_name, 0))
        elif categorie == "risico":
            if factor_name in risico_weights_override:
                new_weight = float(risico_weights_override[factor_name])
            else:
                new_weight = float(default_risico.get(factor_name, 0))
        else:
            new_weight = float(factor_data.get("gewicht", 0))

        factor_data["gewicht"] = new_weight
        factor_data["bijdrage"] = round(gen_score * new_weight, 4)
