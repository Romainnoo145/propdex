"""Backfill parcel addresses using BAG building overlap instead of parcel centroid.

Usage:
    python -m app.tools.backfill_parcel_addresses --gemeente-code GM0983
    python -m app.tools.backfill_parcel_addresses --gemeente-code GM0983 --dry-run
    python -m app.tools.backfill_parcel_addresses --organization-id <uuid> --scan-id <uuid>
"""

from __future__ import annotations

import argparse
import asyncio
import json
import uuid
from dataclasses import dataclass

from sqlalchemy import bindparam, func, select, text
from sqlalchemy import update as sa_update

from app.core.database import async_session_factory
from app.core.http_client import create_government_api_client
from app.models.area_scan import AreaScan
from app.models.organization import Organization
from app.models.parcel_cache import ParcelCache
from app.models.scan_result import ScanResult
from app.services.parcel_addressing import (
    find_bag_building_lookup_point,
    reverse_geocode_rd_point,
)


@dataclass(slots=True)
class BackfillStats:
    organization_id: uuid.UUID
    inspected: int = 0
    emptied: int = 0
    resolved: int = 0
    unresolved: int = 0
    unchanged: int = 0


def _parse_uuid(value: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(f"Invalid UUID: {value}") from exc


async def _list_target_orgs(target_org_id: uuid.UUID | None) -> list[uuid.UUID]:
    async with async_session_factory() as session:
        if target_org_id is not None:
            found = await session.execute(
                select(Organization.id).where(Organization.id == target_org_id)
            )
            org_id = found.scalar_one_or_none()
            return [org_id] if org_id else []

        result = await session.execute(select(Organization.id).order_by(Organization.id))
        return list(result.scalars())


async def _parcel_scope_rows(
    org_id: uuid.UUID,
    *,
    gemeente_code: str | None,
    scan_id: uuid.UUID | None,
    only_scanned_parcels: bool,
    scan_status: str | None,
    batch_size: int,
    last_id: uuid.UUID | None,
):
    async with async_session_factory() as session:
        await session.execute(text(f"SET app.current_tenant_id = '{org_id}'"))

        stmt = (
            select(
                ParcelCache.id,
                ParcelCache.address,
                ParcelCache.has_pand,
                func.ST_AsGeoJSON(ParcelCache.geometry).label("geometry_raw"),
            )
            .where(ParcelCache.organization_id == org_id)
            .where(
                ((ParcelCache.has_pand.is_(True)) & (ParcelCache.address.is_(None)))
                | ((ParcelCache.has_pand.is_(False)) & (ParcelCache.address.is_not(None)))
            )
            .order_by(ParcelCache.id)
            .limit(batch_size)
        )
        if gemeente_code is not None:
            stmt = stmt.where(ParcelCache.gemeente_code == gemeente_code)
        if scan_id is not None:
            stmt = stmt.where(
                select(ScanResult.id)
                .where(
                    ScanResult.organization_id == org_id,
                    ScanResult.scan_id == scan_id,
                    ScanResult.parcel_id == ParcelCache.id,
                )
                .exists()
            )
        elif only_scanned_parcels:
            scanned_exists = (
                select(ScanResult.id)
                .join(AreaScan, AreaScan.id == ScanResult.scan_id)
                .where(
                    ScanResult.organization_id == org_id,
                    AreaScan.organization_id == org_id,
                    ScanResult.parcel_id == ParcelCache.id,
                )
            )
            if gemeente_code is not None:
                scanned_exists = scanned_exists.where(AreaScan.gemeente_code == gemeente_code)
            if scan_status is not None:
                scanned_exists = scanned_exists.where(AreaScan.status == scan_status)
            stmt = stmt.where(scanned_exists.exists())
        if last_id is not None:
            stmt = stmt.where(ParcelCache.id > last_id)

        rows = (await session.execute(stmt)).mappings().all()
        return rows


async def _backfill_org(
    org_id: uuid.UUID,
    *,
    gemeente_code: str | None,
    scan_id: uuid.UUID | None,
    only_scanned_parcels: bool,
    scan_status: str | None,
    batch_size: int,
    dry_run: bool,
) -> BackfillStats:
    stats = BackfillStats(organization_id=org_id)
    client = create_government_api_client()
    try:
        last_id: uuid.UUID | None = None
        while True:
            rows = await _parcel_scope_rows(
                org_id,
                gemeente_code=gemeente_code,
                scan_id=scan_id,
                only_scanned_parcels=only_scanned_parcels,
                scan_status=scan_status,
                batch_size=batch_size,
                last_id=last_id,
            )
            if not rows:
                break

            updates: list[dict[str, object]] = []
            for row in rows:
                parcel_id = row["id"]
                current_address = row["address"]
                has_pand = bool(row["has_pand"])
                geometry_raw = row["geometry_raw"]
                stats.inspected += 1

                if not has_pand:
                    if current_address:
                        updates.append({"parcel_id": parcel_id, "address": None})
                        stats.emptied += 1
                    else:
                        stats.unchanged += 1
                    continue

                if current_address and str(current_address).strip():
                    stats.unchanged += 1
                    continue

                if not isinstance(geometry_raw, str) or not geometry_raw.strip():
                    stats.unresolved += 1
                    continue
                try:
                    geometry = json.loads(geometry_raw)
                except json.JSONDecodeError:
                    stats.unresolved += 1
                    continue
                if not isinstance(geometry, dict):
                    stats.unresolved += 1
                    continue

                lookup_point = await find_bag_building_lookup_point(geometry, client)
                if lookup_point is None:
                    stats.unresolved += 1
                    continue

                resolved_address = await reverse_geocode_rd_point(lookup_point, client)
                if not resolved_address:
                    stats.unresolved += 1
                    continue

                updates.append({"parcel_id": parcel_id, "address": resolved_address})
                stats.resolved += 1

            if updates and not dry_run:
                async with async_session_factory() as session:
                    await session.execute(text(f"SET app.current_tenant_id = '{org_id}'"))
                    await session.execute(
                        sa_update(ParcelCache)
                        .where(
                            ParcelCache.id == bindparam("parcel_id"),
                            ParcelCache.organization_id == org_id,
                        )
                        .values(address=bindparam("address")),
                        updates,
                    )
                    await session.commit()

            last_id = rows[-1]["id"]

    finally:
        await client.aclose()

    return stats


async def _run(
    *,
    organization_id: uuid.UUID | None,
    gemeente_code: str | None,
    scan_id: uuid.UUID | None,
    only_scanned_parcels: bool,
    scan_status: str | None,
    batch_size: int,
    dry_run: bool,
) -> int:
    org_ids = await _list_target_orgs(organization_id)
    if not org_ids:
        print("No organizations found for target scope")
        return 1

    print(
        "Starting parcel address backfill: "
        f"orgs={len(org_ids)}, gemeente_code={gemeente_code}, scan_id={scan_id}, "
        f"only_scanned_parcels={only_scanned_parcels}, scan_status={scan_status}, "
        f"batch_size={batch_size}, dry_run={dry_run}"
    )

    total = BackfillStats(organization_id=org_ids[0])
    for index, org_id in enumerate(org_ids, start=1):
        print(f"[{index}/{len(org_ids)}] org={org_id}")
        stats = await _backfill_org(
            org_id,
            gemeente_code=gemeente_code,
            scan_id=scan_id,
            only_scanned_parcels=only_scanned_parcels,
            scan_status=scan_status,
            batch_size=batch_size,
            dry_run=dry_run,
        )
        total.inspected += stats.inspected
        total.emptied += stats.emptied
        total.resolved += stats.resolved
        total.unresolved += stats.unresolved
        total.unchanged += stats.unchanged
        print(
            f"  inspected={stats.inspected}, emptied={stats.emptied}, "
            f"resolved={stats.resolved}, unresolved={stats.unresolved}, "
            f"unchanged={stats.unchanged}"
        )

    print("Backfill completed")
    print(
        f"Totals: inspected={total.inspected}, emptied={total.emptied}, "
        f"resolved={total.resolved}, unresolved={total.unresolved}, "
        f"unchanged={total.unchanged}"
    )
    return 0


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Backfill parcel addresses from BAG building overlap and clear "
            "misleading addresses for empty parcels."
        )
    )
    parser.add_argument(
        "--organization-id",
        type=_parse_uuid,
        help="Optional organization UUID scope",
    )
    parser.add_argument(
        "--gemeente-code",
        help="Optional gemeentecode scope, e.g. GM0983",
    )
    parser.add_argument(
        "--scan-id",
        type=_parse_uuid,
        help="Optional scan UUID scope",
    )
    parser.add_argument(
        "--only-scanned-parcels",
        action="store_true",
        help="Restrict scope to parcels that already occur in scan_results",
    )
    parser.add_argument(
        "--scan-status",
        choices=["pending", "running", "completed", "failed", "cancelled"],
        help="Optional area_scan status filter when using --only-scanned-parcels",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=500,
        help="Batch size for parcel pagination (default: 500)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Calculate updates without writing to the database",
    )
    return parser


def main() -> None:
    parser = _build_parser()
    args = parser.parse_args()

    if args.batch_size < 1:
        parser.error("--batch-size must be >= 1")

    exit_code = asyncio.run(
        _run(
            organization_id=args.organization_id,
            gemeente_code=args.gemeente_code,
            scan_id=args.scan_id,
            only_scanned_parcels=args.only_scanned_parcels,
            scan_status=args.scan_status,
            batch_size=args.batch_size,
            dry_run=args.dry_run,
        )
    )
    raise SystemExit(exit_code)


if __name__ == "__main__":
    main()
