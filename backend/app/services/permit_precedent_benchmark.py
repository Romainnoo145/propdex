"""Municipality-scoped permit precedent benchmark aggregation."""

from __future__ import annotations

import math
import re
from collections import Counter
from datetime import datetime, timedelta
from statistics import median

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.change_record import ChangeRecord
from app.schemas.property import PermitPrecedentBenchmark, PermitPrecedentReference
from app.services.category_classifier import classify_bekendmaking

_HOUSE_NUMBER_RE = re.compile(r"(\d+)")


def _normalize_postcode(value: str | None) -> str | None:
    if not isinstance(value, str):
        return None
    cleaned = value.upper().replace(" ", "").strip()
    return cleaned if len(cleaned) == 6 else None


def _extract_huisnummer(value: object) -> int | None:
    if isinstance(value, int):
        return value if value > 0 else None
    if isinstance(value, str):
        match = _HOUSE_NUMBER_RE.search(value)
        if match:
            try:
                number = int(match.group(1))
            except ValueError:
                return None
            return number if number > 0 else None
    return None


def _extract_address_key(change: ChangeRecord) -> tuple[str, int] | None:
    metadata = change.metadata_json or {}
    components = metadata.get("address_components")
    if isinstance(components, dict):
        street = components.get("street")
        huisnummer = _extract_huisnummer(components.get("huisnummer"))
        if isinstance(street, str) and street.strip() and huisnummer is not None:
            return street.strip().lower(), huisnummer

    if isinstance(change.address, str) and change.address.strip():
        first = change.address.split(",")[0].strip()
        match = re.search(r"(.+?)\s+(\d+)(?:[A-Za-z]|-[A-Za-z0-9]+)?\b", first)
        if match:
            street = match.group(1).strip().lower()
            huisnummer = _extract_huisnummer(match.group(2))
            if street and huisnummer is not None:
                return street, huisnummer
    return None


def _permit_outcome(category_label: str) -> str:
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


def _comparable_type_from_category(category_label: str) -> str:
    lower = category_label.lower()
    if "kapvergunning" in lower:
        return "Kapvergunning"
    if "sloop" in lower or "brandveilig" in lower:
        return "Sloop-/brandveiligheidmelding"
    if "bezwaar" in lower:
        return "Bezwaar / besluitvorming"
    return "Omgevingsvergunning"


def _p75(values: list[int]) -> int | None:
    if not values:
        return None
    sorted_values = sorted(values)
    idx = max(0, math.ceil(0.75 * len(sorted_values)) - 1)
    return sorted_values[idx]


async def _resolve_gemeente_scope(
    *,
    session: AsyncSession,
    postcode: str | None,
    huisnummer: int | None,
    city: str | None,
    lookback_since: datetime,
) -> str | None:
    postcode_norm = _normalize_postcode(postcode)
    if postcode_norm:
        rows = (
            await session.execute(
                select(ChangeRecord)
                .where(
                    ChangeRecord.change_type == "permit",
                    ChangeRecord.change_date >= lookback_since,
                    func.upper(
                        func.replace(func.coalesce(ChangeRecord.postcode, ""), " ", "")
                    )
                    == postcode_norm,
                )
                .order_by(desc(ChangeRecord.change_date))
                .limit(150)
            )
        ).scalars().all()
        if rows:
            if huisnummer is not None:
                for row in rows:
                    key = _extract_address_key(row)
                    if key and key[1] == huisnummer:
                        return row.gemeente_naam
            return rows[0].gemeente_naam

    if isinstance(city, str) and city.strip():
        city_clean = city.strip().lower()
        row = (
            await session.execute(
                select(ChangeRecord.gemeente_naam)
                .where(
                    ChangeRecord.change_type == "permit",
                    func.lower(ChangeRecord.gemeente_naam) == city_clean,
                    ChangeRecord.change_date >= lookback_since,
                )
                .order_by(desc(ChangeRecord.change_date))
                .limit(1)
            )
        ).first()
        if row:
            return row[0]

    fallback = (
        await session.execute(
            select(ChangeRecord.gemeente_naam)
            .where(
                ChangeRecord.change_type == "permit",
            )
            .order_by(desc(ChangeRecord.change_date))
            .limit(1)
        )
    ).first()
    return fallback[0] if fallback else None


async def build_permit_precedent_benchmark(
    *,
    session: AsyncSession,
    postcode: str | None,
    huisnummer: int | None,
    city: str | None,
    lookback_days: int = 730,
) -> PermitPrecedentBenchmark | None:
    """Build municipality-scoped permit precedent benchmark from stored change records."""
    lookback_since = datetime.utcnow() - timedelta(days=max(30, lookback_days))
    gemeente_scope = await _resolve_gemeente_scope(
        session=session,
        postcode=postcode,
        huisnummer=huisnummer,
        city=city,
        lookback_since=lookback_since,
    )
    if not gemeente_scope:
        return None

    all_rows = (
        await session.execute(
            select(ChangeRecord)
            .where(
                ChangeRecord.change_type == "permit",
                func.lower(ChangeRecord.gemeente_naam) == gemeente_scope.lower(),
                ChangeRecord.change_date >= lookback_since,
            )
            .order_by(desc(ChangeRecord.change_date))
            .limit(2000)
        )
    ).scalars().all()

    if not all_rows:
        return PermitPrecedentBenchmark(
            gemeente_scope=gemeente_scope,
            comparable_type="Omgevingsvergunning",
            sample_size=0,
            lookback_days=lookback_days,
            median_processing_days=None,
            p75_processing_days=None,
            outcome_distribution={},
            low_sample_warning=(
                "Onvoldoende vergunninghistorie in dit venster voor een benchmark."
            ),
            references=[],
        )

    subject_types: list[str] = []
    postcode_norm = _normalize_postcode(postcode)
    for row in all_rows:
        key = _extract_address_key(row)
        if key and huisnummer is not None and key[1] == huisnummer:
            if postcode_norm is None or _normalize_postcode(row.postcode) == postcode_norm:
                category = classify_bekendmaking(row.title, "permit")
                subject_types.append(_comparable_type_from_category(category))

    comparable_type = (
        Counter(subject_types).most_common(1)[0][0]
        if subject_types
        else "Omgevingsvergunning"
    )

    rows = [
        row
        for row in all_rows
        if _comparable_type_from_category(classify_bekendmaking(row.title, "permit"))
        == comparable_type
    ]

    sample_size = len(rows)
    if sample_size == 0:
        return PermitPrecedentBenchmark(
            gemeente_scope=gemeente_scope,
            comparable_type=comparable_type,
            sample_size=0,
            lookback_days=lookback_days,
            median_processing_days=None,
            p75_processing_days=None,
            outcome_distribution={},
            low_sample_warning=(
                "Geen vergelijkbare vergunningcasussen gevonden in geselecteerd venster."
            ),
            references=[],
        )

    outcomes = Counter()
    durations: list[int] = []
    pending_requests: dict[tuple[str, int], datetime] = {}

    for row in sorted(rows, key=lambda item: item.change_date):
        category = classify_bekendmaking(row.title, "permit")
        outcome = _permit_outcome(category)
        outcomes[outcome] += 1

        key = _extract_address_key(row)
        if key is None:
            continue

        if outcome == "requested":
            pending_requests[key] = row.change_date
            continue

        if outcome in {"granted", "rejected", "withdrawn"} and key in pending_requests:
            start = pending_requests.pop(key)
            if row.change_date >= start:
                delta_days = (row.change_date - start).days
                if 0 <= delta_days <= 3650:
                    durations.append(delta_days)

    median_days = int(round(median(durations))) if durations else None
    p75_days = _p75(durations)

    references = [
        PermitPrecedentReference(
            change_record_id=str(row.id),
            title=row.title,
            change_date=row.change_date.date().isoformat(),
            outcome=_permit_outcome(classify_bekendmaking(row.title, "permit")),
            source_url=row.source_url,
        )
        for row in rows[:5]
    ]

    low_sample_warning = None
    if sample_size < 15:
        low_sample_warning = (
            "Lage steekproef: benchmark is indicatief, combineer met handmatige check."
        )

    return PermitPrecedentBenchmark(
        gemeente_scope=gemeente_scope,
        comparable_type=comparable_type,
        sample_size=sample_size,
        lookback_days=lookback_days,
        median_processing_days=median_days,
        p75_processing_days=p75_days,
        outcome_distribution=dict(outcomes),
        low_sample_warning=low_sample_warning,
        references=references,
    )
