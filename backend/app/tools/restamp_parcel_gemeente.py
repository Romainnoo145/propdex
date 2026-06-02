"""Re-stamp parcel_cache.gemeente_code to each parcel's TRUE gemeente.

Background (resolves .planning todo 2026-05-21-parcel-cache-count-integrity):
Area scans stamp every parcel they pull with the *scan's* gemeente_code. Because
wijk scan bounding boxes spill across the municipal border, parcels from
neighbouring gemeenten ended up labelled GM0983 (Venlo) — inflating the Venlo
count (e.g. 63k) to numbers a local makelaar would immediately know are wrong.

This tool re-derives gemeente_code from each parcel's own identity, NOT the scan:
  * BAG objects (16-digit parcel_id): the first 4 digits ARE the CBS gemeente
    code → gemeente_code = 'GM' + prefix. Authoritative.
  * BRK kadaster objects (14-digit, with parcel_code "<KadGemeente> <sectie> <nr>"):
    map the kadastrale gemeente name → CBS municipality via KAD_GEMEENTE_TO_GM.
    Unmapped names are SKIPPED and reported (never guessed).

Non-destructive: only updates the gemeente_code column. Writes a full backup of
every changed row to a timestamped table first, so it is reversible.

Usage:
    python -m app.tools.restamp_parcel_gemeente --dry-run
    python -m app.tools.restamp_parcel_gemeente            # apply
    python -m app.tools.restamp_parcel_gemeente --backup-suffix 20260602
"""

from __future__ import annotations

import argparse
import asyncio
import logging

from sqlalchemy import text

from app.core.database import async_session_factory

logger = logging.getLogger(__name__)

# Kadastrale gemeente (first token of parcel_code) -> CBS municipality code.
# Only the regional set we actually carry; extend as coverage grows. Anything
# not listed here is skipped + reported rather than mis-assigned.
KAD_GEMEENTE_TO_GM: dict[str, str] = {
    # Venlo (GM0983)
    "Venlo": "GM0983",
    "Tegelen": "GM0983",
    "Belfeld": "GM0983",
    "Arcen": "GM0983",
    "Velden": "GM0983",
    "Blerick": "GM0983",
    "Lomm": "GM0983",
    # Horst aan de Maas (GM1507)
    "Grubbenvorst": "GM1507",
    "Sevenum": "GM1507",
    "Broekhuizen": "GM1507",
    "Horst": "GM1507",
    # Peel en Maas (GM1894)
    "Maasbree": "GM1894",
    "Kessel": "GM1894",
    # Beesel (GM0889)
    "Beesel": "GM0889",
    # Bergen L (GM0893)
    "Bergen": "GM0893",
}


async def _scalar(conn, sql: str, **params) -> int:
    return (await conn.execute(text(sql), params)).scalar() or 0


async def restamp(dry_run: bool, backup_suffix: str) -> None:
    async with async_session_factory() as session:
        conn = session

        # --- BAG (16-digit): gemeente_code should be 'GM' + first 4 digits ---
        bag_wrong = await _scalar(
            conn,
            "select count(*) from parcel_cache "
            "where length(parcel_id)=16 "
            "and gemeente_code is distinct from ('GM' || substr(parcel_id,1,4))",
        )

        # --- BRK (14-digit): gemeente_code should match KAD_GEMEENTE_TO_GM ---
        brk_rows = (
            await conn.execute(
                text(
                    "select split_part(parcel_code,' ',1) kg, gemeente_code, count(*) n "
                    "from parcel_cache "
                    "where length(parcel_id)=14 and parcel_code is not null "
                    "group by 1,2 order by 1"
                )
            )
        ).all()

        brk_changes: dict[str, int] = {}   # target_code -> rows changed
        brk_unmapped: dict[str, int] = {}
        for kg, current, n in brk_rows:
            target = KAD_GEMEENTE_TO_GM.get(kg)
            if target is None:
                brk_unmapped[kg] = brk_unmapped.get(kg, 0) + n
            elif current != target:
                brk_changes[target] = brk_changes.get(target, 0) + n

        brk_total = sum(brk_changes.values())

        logger.info("BAG 16-digit rows needing re-stamp: %d", bag_wrong)
        logger.info("BRK 14-digit rows needing re-stamp: %d  by-target=%s", brk_total, brk_changes)
        if brk_unmapped:
            logger.warning("BRK kadastrale gemeenten NOT in mapping (skipped): %s", brk_unmapped)

        if dry_run:
            logger.info("DRY-RUN — no writes. Would change %d rows total.", bag_wrong + brk_total)
            return

        if bag_wrong + brk_total == 0:
            logger.info("Nothing to re-stamp. Exiting.")
            return

        # --- Backup every row that will change (reversible) ---
        backup_tbl = f"parcel_cache_gemeente_backup_{backup_suffix}"
        await conn.execute(text(f'drop table if exists "{backup_tbl}"'))
        await conn.execute(
            text(
                f'create table "{backup_tbl}" as '
                "select id, parcel_id, parcel_code, gemeente_code as old_gemeente_code, now() as backed_up_at "
                "from parcel_cache "
                "where (length(parcel_id)=16 and gemeente_code is distinct from ('GM' || substr(parcel_id,1,4))) "
                "   or (length(parcel_id)=14 and parcel_code is not null "
                "       and split_part(parcel_code,' ',1) = any(:kgs))"
            ),
            {"kgs": [k for k, v in KAD_GEMEENTE_TO_GM.items()]},
        )
        backed = await _scalar(conn, f'select count(*) from "{backup_tbl}"')
        logger.info("Backed up %d rows to %s", backed, backup_tbl)

        # --- Apply BAG re-stamp ---
        res_bag = await conn.execute(
            text(
                "update parcel_cache set gemeente_code = ('GM' || substr(parcel_id,1,4)), updated_at = now() "
                "where length(parcel_id)=16 "
                "and gemeente_code is distinct from ('GM' || substr(parcel_id,1,4))"
            )
        )
        logger.info("BAG re-stamped: %d rows", res_bag.rowcount)

        # --- Apply BRK re-stamp (one UPDATE per target code) ---
        brk_applied = 0
        for target_code in sorted(set(KAD_GEMEENTE_TO_GM.values())):
            names = [k for k, v in KAD_GEMEENTE_TO_GM.items() if v == target_code]
            res = await conn.execute(
                text(
                    "update parcel_cache set gemeente_code = :tc, updated_at = now() "
                    "where length(parcel_id)=14 and parcel_code is not null "
                    "and split_part(parcel_code,' ',1) = any(:names) "
                    "and gemeente_code is distinct from :tc"
                ),
                {"tc": target_code, "names": names},
            )
            brk_applied += res.rowcount
        logger.info("BRK re-stamped: %d rows", brk_applied)

        await session.commit()

        # --- Verify: new per-gemeente distribution ---
        rows = (
            await conn.execute(
                text("select gemeente_code, count(*) from parcel_cache group by 1 order by 2 desc")
            )
        ).all()
        logger.info("New parcel_cache gemeente distribution:")
        for gc, n in rows:
            logger.info("   %-10s %d", gc, n)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="report only, no writes")
    ap.add_argument("--backup-suffix", default="restamp", help="suffix for the backup table name")
    args = ap.parse_args()
    asyncio.run(restamp(dry_run=args.dry_run, backup_suffix=args.backup_suffix))


if __name__ == "__main__":
    main()
