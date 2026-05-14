"""Shared gemeente_code → gemeente_naam resolver (M049/S02).

Wave-0 stub. Implementation extracted from policy_documents/service.py:332 in Wave 1.
"""
from sqlalchemy.ext.asyncio import AsyncSession


async def get_gemeente_name_map(db: AsyncSession) -> dict[str, str]:
    raise NotImplementedError("Wave-1 implementation pending — see 02-01-PLAN.md Task 2")
