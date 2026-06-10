"""REGRESSION — M053/S08 auto-ingest requires superuser.

POST /api/policy-documents/auto-ingest must not be reachable by an
ordinary authenticated user. Previously it used get_current_active_user
and relied on _assert_vendor_org, which is a no-op when VENDOR_ORG_ID is
unset (dev/test) — so any user could trigger bulk CVDR ingestion.

This test simulates the vulnerable state by temporarily clearing
VENDOR_ORG_ID (making _assert_vendor_org a no-op), then confirms the
endpoint is still blocked by the dependency-level superuser check.
"""
from __future__ import annotations

from unittest.mock import patch

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_auto_ingest_blocked_for_non_superuser(
    async_client: AsyncClient,
    auth_headers: dict[str, str],  # plain user (is_superuser=False by default)
):
    """Non-superuser must get 403 even when VENDOR_ORG_ID is unset.

    Patches settings.VENDOR_ORG_ID to None to disable _assert_vendor_org,
    ensuring the 403 comes from the superuser dependency check — not the
    vendor-org guard.
    """
    from app.core.config import settings

    with patch.object(settings, "VENDOR_ORG_ID", None):
        resp = await async_client.post(
            "/api/policy-documents/auto-ingest",
            headers=auth_headers,
            json={"gemeente_code": "GM0983", "gemeente_naam": "Venlo"},
        )
    assert resp.status_code == 403
