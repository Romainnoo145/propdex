"""REGRESSION — M053/S08 auto-ingest requires superuser.

POST /api/policy-documents/auto-ingest must not be reachable by an
ordinary authenticated user. The endpoint is gated by get_current_superuser;
no secondary vendor-org check is involved.
"""
from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_auto_ingest_blocked_for_non_superuser(
    async_client: AsyncClient,
    auth_headers: dict[str, str],  # plain user (is_superuser=False by default)
):
    """Non-superuser must get 403 from the superuser dependency check."""
    resp = await async_client.post(
        "/api/policy-documents/auto-ingest",
        headers=auth_headers,
        json={"gemeente_code": "GM0983", "gemeente_naam": "Venlo"},
    )
    assert resp.status_code == 403
    assert "superuser" in resp.json()["detail"].lower()
