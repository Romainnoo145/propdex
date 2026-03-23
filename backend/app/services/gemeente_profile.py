"""Gemeente profile aggregation service.

Aggregates existing permit (ChangeRecord) and ruling (RulingCache) data
into a municipality-level regulatory posture profile. No new external APIs.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.change_record import ChangeRecord
from app.schemas.gemeente import GemeenteProfile
from app.services.category_classifier import classify_bekendmaking
from app.services.doorlooptijd import get_doorlooptijd_stats

logger = logging.getLogger(__name__)

# Severity thresholds — matches frontend JuridischKlimaatCard.tsx
_MIN_SAMPLE_FOR_SEVERITY = 5


def _permit_outcome(category_label: str) -> str:
    """Classify a bekendmaking category into a permit outcome."""
    lower = category_label.lower()
    if "verleend" in lower:
        return "granted"
    if "geweigerd" in lower or "buiten behandeling" in lower:
        return "rejected"
    if "ingetrokken" in lower:
        return "withdrawn"
    if "aangevraagd" in lower:
        return "requested"
    return "other"


def _derive_severity(granted: int, rejected: int) -> str:
    """Derive severity label from approval/rejection counts.

    Thresholds match frontend JuridischKlimaatCard:
      <15% rejected → Gunstig
      15-35% → Gemiddeld
      35-55% → Ongunstig
      >55% → Zeer ongunstig
    """
    total_decided = granted + rejected
    if total_decided < _MIN_SAMPLE_FOR_SEVERITY:
        return "Onbekend"
    pct_rejected = (rejected / total_decided) * 100
    if pct_rejected < 15:
        return "Gunstig"
    if pct_rejected <= 35:
        return "Gemiddeld"
    if pct_rejected <= 55:
        return "Ongunstig"
    return "Zeer ongunstig"


def _data_coverage(sample_size: int) -> str:
    if sample_size == 0:
        return "none"
    if sample_size < 10:
        return "low"
    if sample_size <= 50:
        return "medium"
    return "high"


async def build_gemeente_profile(
    gemeente_naam: str,
    db: AsyncSession,
) -> GemeenteProfile:
    """Build regulatory posture profile for a municipality.

    Aggregates:
    - Permit outcomes (granted/rejected) from ChangeRecords
    - Bekendmakingen counts by period (30d/90d/365d)
    - Permit type distribution
    - Court procedure doorlooptijd from RulingCache (via get_doorlooptijd_stats)
    """
    now = datetime.utcnow()

    # ── Query all permit ChangeRecords for this gemeente ─────
    stmt = select(ChangeRecord).where(
        func.lower(ChangeRecord.gemeente_naam) == gemeente_naam.lower(),
        ChangeRecord.change_type == "permit",
    )
    result = await db.execute(stmt)
    records = result.scalars().all()

    # ── Classify outcomes and count by period ────────────────
    granted = 0
    rejected = 0
    total_decided = 0
    permit_types: dict[str, int] = {}
    bekendmakingen_30d = 0
    bekendmakingen_90d = 0
    bekendmakingen_365d = 0

    cutoff_30 = now - timedelta(days=30)
    cutoff_90 = now - timedelta(days=90)
    cutoff_365 = now - timedelta(days=365)

    for record in records:
        category = classify_bekendmaking(record.title, record.change_type)
        outcome = _permit_outcome(category)

        # Count outcomes (exclude "requested" and "other" from ratio)
        if outcome == "granted":
            granted += 1
            total_decided += 1
        elif outcome == "rejected":
            rejected += 1
            total_decided += 1

        # Permit type distribution (from title content, not just category)
        permit_type = _simplified_type(category, record.title or "")
        permit_types[permit_type] = permit_types.get(permit_type, 0) + 1

        # Bekendmakingen by period
        detected = record.detected_at
        if detected >= cutoff_30:
            bekendmakingen_30d += 1
        if detected >= cutoff_90:
            bekendmakingen_90d += 1
        if detected >= cutoff_365:
            bekendmakingen_365d += 1

    # ── Compute rates ────────────────────────────────────────
    approval_rate = (granted / total_decided * 100) if total_decided > 0 else None
    rejection_rate = (rejected / total_decided * 100) if total_decided > 0 else None
    severity = _derive_severity(granted, rejected)

    # ── Doorlooptijd from RulingCache ────────────────────────
    avg_doorlooptijd: int | None = None
    try:
        doorlooptijd_stats = await get_doorlooptijd_stats(db, gemeente_naam)
        avg_days = doorlooptijd_stats.get("overall_avg_dagen")
        if avg_days is not None:
            avg_doorlooptijd = round(avg_days)
    except Exception:
        logger.debug("Doorlooptijd stats unavailable for %s", gemeente_naam)

    return GemeenteProfile(
        gemeente_naam=gemeente_naam,
        severity_label=severity,
        approval_rate_pct=round(approval_rate, 1) if approval_rate is not None else None,
        rejection_rate_pct=round(rejection_rate, 1) if rejection_rate is not None else None,
        avg_doorlooptijd_days=avg_doorlooptijd,
        bekendmakingen_30d=bekendmakingen_30d,
        bekendmakingen_90d=bekendmakingen_90d,
        bekendmakingen_365d=bekendmakingen_365d,
        permit_type_distribution=permit_types,
        sample_size=len(records),
        data_coverage=_data_coverage(len(records)),
    )


def _simplified_type(category: str, title: str) -> str:
    """Derive permit sub-type from the bekendmaking title.

    The category_label (from classify_bekendmaking) is too coarse — almost
    everything becomes "Omgevingsvergunning". The title contains the actual
    activity: kappen, splitsen, dakkapel, inrit, sloop, etc.

    We classify based on title keywords first, then fall back to category.
    """
    t = title.lower()

    # Specific activity types (check title first — most informative)
    if "kappen" in t or "kapvergunning" in t or "bomen" in t:
        return "Kap"
    if "sloop" in t:
        return "Sloop"
    if "splitsen" in t or "splitsing" in t:
        return "Splitsen"
    if "dakkapel" in t:
        return "Dakkapel"
    if "inrit" in t or "uitweg" in t:
        return "Inrit/uitweg"
    if "milieu" in t or "milieugevaarlijk" in t:
        return "Milieu"
    if "brandveilig" in t:
        return "Brandveiligheid"
    if "reclame" in t or "uiting" in t:
        return "Reclame"
    if "bestemmingsplan" in t or "inpassingsplan" in t:
        return "Bestemmingsplan"
    if "monument" in t or "erfgoed" in t:
        return "Monument"

    # Building activity sub-types
    if any(k in t for k in ("oprichten van een woning", "bouwen van een woning", "nieuwbouw woning")):
        return "Nieuwbouw woning"
    if any(k in t for k in ("herontwikkeling", "transformatie", "verbouw", "veranderen")):
        return "Verbouw/transformatie"
    if any(k in t for k in ("oprichten van", "bouwen van", "bouw van", "realiseren van")):
        return "Bouw"
    if any(k in t for k in ("plaatsen van", "aanbouw", "uitbouw")):
        return "Aanbouw/plaatsing"
    if any(k in t for k in ("vervangen van", "wijzigen van", "renovatie", "herstellen")):
        return "Renovatie/wijziging"

    # Status-only entries (no specific activity in title)
    if any(k in t for k in ("verleende omgevingsvergunning", "verlenging beslistermijn")):
        return "Omgevingsvergunning"

    # Fall back to category-based classification
    lower = category.lower()
    if "bestemmingsplan" in lower or "inpassingsplan" in lower:
        return "Bestemmingsplan"
    if "sloop" in lower:
        return "Sloop"
    if "kapvergunning" in lower:
        return "Kap"
    if "milieu" in lower:
        return "Milieu"

    return "Overig"
