"""Cascade policy resolution helpers for the M045 document bundle query.

Resolves a parcel UUID into its ancestor chain:
  landelijk (NL) → provincie (PV##) → gemeente (GM####)

Used by the for_parcel() service (T03) to fetch policy documents at each
level of the Dutch geographic hierarchy.
"""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.gemeente_provincie_map import GemeenteProvincieMap
from app.models.parcel_cache import ParcelCache


async def _resolve_ancestor_chain(parcel_id: str, db: AsyncSession) -> dict[str, str]:
    """Resolve a parcel_id into its {landelijk, provincie, gemeente} ancestor chain.

    Uses parcel_cache.gemeente_code (GM-prefixed) + gemeente_provincie_map lookup.
    Returns {landelijk: 'NL'} only if parcel not found or gemeente_code is null.

    Args:
        parcel_id: ParcelCache UUID as string (e.g. "3fa85f64-5717-4562-b3fc-2c963f66afa6").
        db: SQLAlchemy async session.

    Returns:
        dict with keys 'landelijk' (always present), 'gemeente' and 'provincie'
        (present when resolved).
    """
    stmt = select(ParcelCache.gemeente_code).where(ParcelCache.id == UUID(parcel_id))
    gemeente_code = (await db.execute(stmt)).scalar_one_or_none()
    if gemeente_code is None:
        return {"landelijk": "NL"}
    chain: dict[str, str] = {"landelijk": "NL", "gemeente": gemeente_code}
    provincie_stmt = select(GemeenteProvincieMap.provincie_code).where(
        GemeenteProvincieMap.gemeente_code == gemeente_code
    )
    provincie_code = (await db.execute(provincie_stmt)).scalar_one_or_none()
    if provincie_code:
        chain["provincie"] = provincie_code
    return chain
