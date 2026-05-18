"""ARQ pool FastAPI dependency — M050/S03 D7 hook target.

Reuses the `app.state.arq_pool` set by `main.py` lifespan (the same pool the
M049/S04.1 manual-upload-rescore + scans/reports/properties routers consume).

`get_arq_pool` is a thin FastAPI dependency wrapper so endpoints can declare
the pool via `Depends(get_arq_pool)` instead of reaching into
`request.app.state` directly. New code (M050/S03 onward) should prefer this
explicit dependency for testability — `app.state.arq_pool = AsyncMock(...)` in
test setup already works without monkeypatching the dependency.
"""
from __future__ import annotations

from arq.connections import ArqRedis
from fastapi import Request


async def get_arq_pool(request: Request) -> ArqRedis:
    """Return the ARQ pool stored on `app.state` during startup.

    M050/S03 D7 — pattern mirrors `request.app.state.arq_pool` access already
    used by `scans/router.py`, `reports/router.py`, etc.; this dependency only
    centralises the lookup + a defensive guard.
    """
    pool = getattr(request.app.state, "arq_pool", None)
    if pool is None:
        raise RuntimeError(
            "arq_pool not initialised on app.state — check lifespan event"
        )
    return pool
