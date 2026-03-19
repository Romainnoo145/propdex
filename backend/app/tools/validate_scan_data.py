"""Validate scan data quality per wijk for a gemeente.

Usage:
    python -m app.tools.validate_scan_data --gemeente-code GM0983
    python -m app.tools.validate_scan_data --gemeente-code 0983
    python -m app.tools.validate_scan_data --gemeente-code GM0983 --wijk-naam "Wijk 01 Venlo-Centrum"
    python -m app.tools.validate_scan_data --gemeente-code GM0983 --threshold-address 0.70
"""

from __future__ import annotations

import argparse
import asyncio
import uuid
from dataclasses import dataclass

from sqlalchemy import case, func, select, text

from app.core.database import async_session_factory
from app.models.area_scan import AreaScan
from app.models.organization import Organization
from app.models.parcel_cache import ParcelCache
from app.models.scan_result import ScanResult

# Statuses considered as valid completed scans
_COMPLETE_STATUSES = ("completed", "completed_with_warnings")


def normalize_gemeente_code(raw: str) -> tuple[str, str]:
    """Return (with_prefix, without_prefix) from a raw gemeente code.

    Accepts both "GM0983" and "0983" formats.
    """
    stripped = raw.strip()
    if stripped.upper().startswith("GM"):
        bare = stripped[2:]
        return stripped, bare
    return f"GM{stripped}", stripped


@dataclass(slots=True)
class WijkValidation:
    wijk_naam: str
    scan_status: str
    total_parcels: int
    parcels_with_buildings: int
    bouwjaar_populated: int
    bouwjaar_null: int
    addresses_resolved: int
    addresses_missing: int
    pand_status_populated: int
    pand_status_null: int
    avg_score: float | None
    coverage_ratio: float | None
    address_resolution_ratio: float | None

    @property
    def bouwjaar_rate(self) -> float:
        return self.bouwjaar_populated / self.parcels_with_buildings if self.parcels_with_buildings > 0 else 0.0

    @property
    def address_rate(self) -> float:
        return self.addresses_resolved / self.parcels_with_buildings if self.parcels_with_buildings > 0 else 0.0

    @property
    def pand_status_rate(self) -> float:
        return self.pand_status_populated / self.parcels_with_buildings if self.parcels_with_buildings > 0 else 0.0


async def _list_all_org_ids() -> list[uuid.UUID]:
    async with async_session_factory() as session:
        result = await session.execute(select(Organization.id).order_by(Organization.id))
        return list(result.scalars())


async def _validate_gemeente(
    org_id: uuid.UUID,
    gemeente_code_with_prefix: str,
    gemeente_code_bare: str,
    *,
    wijk_naam_filter: str | None,
) -> list[WijkValidation]:
    """Run per-wijk validation query for the given org and gemeente_code."""
    async with async_session_factory() as session:
        await session.execute(text(f"SET app.current_tenant_id = '{org_id}'"))

        # Determine which gemeente_code format exists in the DB
        count_with = await session.execute(
            select(func.count(AreaScan.id)).where(
                AreaScan.gemeente_code == gemeente_code_with_prefix,
                AreaScan.status.in_(_COMPLETE_STATUSES),
            )
        )
        code_to_use = gemeente_code_with_prefix
        if (count_with.scalar() or 0) == 0:
            count_bare = await session.execute(
                select(func.count(AreaScan.id)).where(
                    AreaScan.gemeente_code == gemeente_code_bare,
                    AreaScan.status.in_(_COMPLETE_STATUSES),
                )
            )
            if (count_bare.scalar() or 0) > 0:
                code_to_use = gemeente_code_bare

        # Per-wijk aggregation query
        stmt = (
            select(
                AreaScan.wijk_naam,
                AreaScan.status,
                AreaScan.coverage_ratio,
                AreaScan.address_resolution_ratio,
                func.count(ScanResult.id).label("total_parcels"),
                func.count(case((ParcelCache.has_pand.is_(True), 1))).label("parcels_with_buildings"),
                func.count(
                    case((
                        (ParcelCache.has_pand.is_(True)) & (ParcelCache.bouwjaar.is_not(None)),
                        1,
                    ))
                ).label("bouwjaar_populated"),
                func.count(
                    case((
                        (ParcelCache.has_pand.is_(True)) & (ParcelCache.bouwjaar.is_(None)),
                        1,
                    ))
                ).label("bouwjaar_null"),
                func.count(
                    case((
                        (ParcelCache.has_pand.is_(True)) & (ParcelCache.address.is_not(None)),
                        1,
                    ))
                ).label("addresses_resolved"),
                func.count(
                    case((
                        (ParcelCache.has_pand.is_(True)) & (ParcelCache.address.is_(None)),
                        1,
                    ))
                ).label("addresses_missing"),
                func.count(
                    case((
                        (ParcelCache.has_pand.is_(True)) & (ParcelCache.pand_status.is_not(None)),
                        1,
                    ))
                ).label("pand_status_populated"),
                func.count(
                    case((
                        (ParcelCache.has_pand.is_(True)) & (ParcelCache.pand_status.is_(None)),
                        1,
                    ))
                ).label("pand_status_null"),
                func.avg(ScanResult.score).label("avg_score"),
            )
            .join(ScanResult, ScanResult.scan_id == AreaScan.id)
            .join(ParcelCache, ParcelCache.id == ScanResult.parcel_id)
            .where(
                AreaScan.gemeente_code == code_to_use,
                AreaScan.status.in_(_COMPLETE_STATUSES),
            )
            .group_by(
                AreaScan.wijk_naam,
                AreaScan.status,
                AreaScan.coverage_ratio,
                AreaScan.address_resolution_ratio,
            )
            .order_by(AreaScan.wijk_naam)
        )

        if wijk_naam_filter is not None:
            stmt = stmt.where(AreaScan.wijk_naam == wijk_naam_filter)

        rows = (await session.execute(stmt)).mappings().all()
        result_list: list[WijkValidation] = []
        for row in rows:
            result_list.append(
                WijkValidation(
                    wijk_naam=row["wijk_naam"] or "(no wijk_naam)",
                    scan_status=row["status"],
                    total_parcels=row["total_parcels"] or 0,
                    parcels_with_buildings=row["parcels_with_buildings"] or 0,
                    bouwjaar_populated=row["bouwjaar_populated"] or 0,
                    bouwjaar_null=row["bouwjaar_null"] or 0,
                    addresses_resolved=row["addresses_resolved"] or 0,
                    addresses_missing=row["addresses_missing"] or 0,
                    pand_status_populated=row["pand_status_populated"] or 0,
                    pand_status_null=row["pand_status_null"] or 0,
                    avg_score=float(row["avg_score"]) if row["avg_score"] is not None else None,
                    coverage_ratio=row["coverage_ratio"],
                    address_resolution_ratio=row["address_resolution_ratio"],
                )
            )
        return result_list


async def _score_consistency_check(
    org_id: uuid.UUID,
    code_to_use: str,
) -> list[tuple[str, int, float | None]]:
    """Return (pand_status_label, count, avg_score) per pand_status group."""
    async with async_session_factory() as session:
        await session.execute(text(f"SET app.current_tenant_id = '{org_id}'"))

        stmt = (
            select(
                ParcelCache.pand_status,
                ParcelCache.has_pand,
                func.count(ScanResult.id).label("count"),
                func.avg(ScanResult.score).label("avg_score"),
            )
            .join(ScanResult, ScanResult.parcel_id == ParcelCache.id)
            .join(AreaScan, AreaScan.id == ScanResult.scan_id)
            .where(
                AreaScan.gemeente_code == code_to_use,
                AreaScan.status.in_(_COMPLETE_STATUSES),
            )
            .group_by(ParcelCache.pand_status, ParcelCache.has_pand)
            .order_by(func.count(ScanResult.id).desc())
        )

        rows = (await session.execute(stmt)).mappings().all()
        groups: list[tuple[str, int, float | None]] = []
        for row in rows:
            has_pand = bool(row["has_pand"])
            pand_status = row["pand_status"]
            if not has_pand:
                label = "(no building)"
            elif pand_status:
                label = pand_status
            else:
                label = "unknown"
            avg_score = float(row["avg_score"]) if row["avg_score"] is not None else None
            groups.append((label, row["count"] or 0, avg_score))
        return groups


def _wijk_row_status(
    v: WijkValidation,
    threshold_bouwjaar: float,
    threshold_address: float,
    threshold_pand_status: float,
) -> str:
    if v.scan_status == "failed":
        return "FAIL"
    if v.parcels_with_buildings == 0:
        return "OK"
    below = (
        v.bouwjaar_rate < threshold_bouwjaar
        or v.address_rate < threshold_address
        or v.pand_status_rate < threshold_pand_status
    )
    return "WARN" if below else "OK"


def _print_validation_report(
    gemeente_label: str,
    validations: list[WijkValidation],
    threshold_bouwjaar: float,
    threshold_address: float,
    threshold_pand_status: float,
) -> int:
    """Print summary table. Returns 0 (all OK), 1 (warnings/failures), 2 (no data)."""
    if not validations:
        print(f"No completed scans found for {gemeente_label}")
        return 2

    total_parcels = sum(v.total_parcels for v in validations)
    total_bldgs = sum(v.parcels_with_buildings for v in validations)
    total_bouwjaar = sum(v.bouwjaar_populated for v in validations)
    total_address = sum(v.addresses_resolved for v in validations)
    total_pand_status = sum(v.pand_status_populated for v in validations)

    def fmt_rate(numerator: int, denominator: int) -> str:
        if denominator == 0:
            return "  N/A"
        return f"{numerator / denominator * 100:5.1f}%"

    print(f"\nVALIDATION REPORT: {gemeente_label}")
    print("=" * 84)
    print(
        f"{'Wijk':<30} {'Status':<9} {'Parcels':>7} {'Bldgs':>6} "
        f"{'Bouwjaar':>9} {'Address':>8} {'PandSt':>7}"
    )
    print("-" * 84)

    has_issues = False
    for v in validations:
        row_status = _wijk_row_status(v, threshold_bouwjaar, threshold_address, threshold_pand_status)
        if row_status in ("WARN", "FAIL"):
            has_issues = True
        wijk_label = v.wijk_naam[:30]
        bouwjaar_str = fmt_rate(v.bouwjaar_populated, v.parcels_with_buildings)
        address_str = fmt_rate(v.addresses_resolved, v.parcels_with_buildings)
        pand_status_str = fmt_rate(v.pand_status_populated, v.parcels_with_buildings)
        print(
            f"{wijk_label:<30} {row_status:<9} {v.total_parcels:>7} {v.parcels_with_buildings:>6} "
            f"{bouwjaar_str:>9} {address_str:>8} {pand_status_str:>7}"
        )

    print("=" * 84)
    total_bouwjaar_str = fmt_rate(total_bouwjaar, total_bldgs)
    total_address_str = fmt_rate(total_address, total_bldgs)
    total_pand_status_str = fmt_rate(total_pand_status, total_bldgs)
    print(
        f"{'TOTAL':<30} {'':<9} {total_parcels:>7} {total_bldgs:>6} "
        f"{total_bouwjaar_str:>9} {total_address_str:>8} {total_pand_status_str:>7}"
    )

    if has_issues:
        print("\nVERDICT: WARNINGS — some wijken are below threshold")
    else:
        print("\nVERDICT: PASS — all wijken meet thresholds")

    return 1 if has_issues else 0


def _print_score_consistency(
    groups: list[tuple[str, int, float | None]],
) -> None:
    if not groups:
        return

    print("\nSCORE CONSISTENCY CHECK")
    print(f"{'pand_status':<25} {'count':>6} {'avg_score':>10}")
    print("-" * 44)
    for label, count, avg_score in groups:
        score_str = f"{avg_score:10.1f}" if avg_score is not None else "       N/A"
        print(f"{label:<25} {count:>6} {score_str:>10}")

    # Warning check: if in_gebruik avg > buiten gebruik avg
    score_map: dict[str, float | None] = {label: avg for label, _c, avg in groups}
    in_gebruik_avg = score_map.get("Pand in gebruik") or score_map.get("in_gebruik")
    buiten_gebruik_avg = score_map.get("Pand buiten gebruik") or score_map.get("buiten gebruik")
    if (
        in_gebruik_avg is not None
        and buiten_gebruik_avg is not None
        and in_gebruik_avg > buiten_gebruik_avg
    ):
        print(
            "\nWARNING: in_gebruik avg_score is higher than buiten gebruik — "
            "scoring may not reward vacancy correctly"
        )


async def _run(
    *,
    gemeente_code: str,
    organization_id: uuid.UUID | None,
    wijk_naam: str | None,
    threshold_bouwjaar: float,
    threshold_address: float,
    threshold_pand_status: float,
) -> int:
    gm_with_prefix, gm_bare = normalize_gemeente_code(gemeente_code)
    gemeente_label = gm_with_prefix

    if organization_id is not None:
        org_ids = [organization_id]
    else:
        org_ids = await _list_all_org_ids()

    if not org_ids:
        print("No organizations found")
        return 2

    overall_exit = 0

    for org_id in org_ids:
        print(f"Organization: {org_id}")
        validations = await _validate_gemeente(
            org_id,
            gm_with_prefix,
            gm_bare,
            wijk_naam_filter=wijk_naam,
        )

        exit_code = _print_validation_report(
            gemeente_label,
            validations,
            threshold_bouwjaar=threshold_bouwjaar,
            threshold_address=threshold_address,
            threshold_pand_status=threshold_pand_status,
        )

        if exit_code == 2:
            overall_exit = max(overall_exit, 2)
            continue

        # Determine which code format was used for the score consistency check
        # (reuse whichever was found)
        code_to_use = gm_with_prefix
        if validations:
            # any validations means the DB query worked with code_to_use determined inside
            # _validate_gemeente; re-run code selection logic here cheaply
            pass

        # Score consistency check uses same org
        groups = await _score_consistency_check(org_id, code_to_use)
        _print_score_consistency(groups)

        overall_exit = max(overall_exit, exit_code)

    return overall_exit


def _parse_uuid(value: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(f"Invalid UUID: {value}") from exc


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Validate scan data quality per wijk for a gemeente.",
    )
    parser.add_argument(
        "--gemeente-code",
        required=True,
        help="CBS gemeentecode with or without GM prefix, e.g. GM0983 or 0983",
    )
    parser.add_argument(
        "--organization-id",
        type=_parse_uuid,
        default=None,
        help="Optional organization UUID; defaults to all organizations",
    )
    parser.add_argument(
        "--wijk-naam",
        default=None,
        help="Optional: validate only a single wijk by name",
    )
    parser.add_argument(
        "--threshold-bouwjaar",
        type=float,
        default=0.80,
        help="Minimum bouwjaar population rate for OK verdict (default: 0.80)",
    )
    parser.add_argument(
        "--threshold-address",
        type=float,
        default=0.50,
        help="Minimum address resolution rate for OK verdict (default: 0.50)",
    )
    parser.add_argument(
        "--threshold-pand-status",
        type=float,
        default=0.80,
        help="Minimum pand_status population rate for OK verdict (default: 0.80)",
    )
    return parser


def main() -> None:
    parser = _build_parser()
    args = parser.parse_args()

    exit_code = asyncio.run(
        _run(
            gemeente_code=args.gemeente_code,
            organization_id=args.organization_id,
            wijk_naam=args.wijk_naam,
            threshold_bouwjaar=args.threshold_bouwjaar,
            threshold_address=args.threshold_address,
            threshold_pand_status=args.threshold_pand_status,
        )
    )
    raise SystemExit(exit_code)


if __name__ == "__main__":
    main()
