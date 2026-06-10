"""REGRESSION-CRITICAL — M053/S08 cancel_scan org-ownership.

POST /api/scans/{id}/cancel is a destructive write. AreaScan is shared
reference data, but cancelling another org's running scan must be blocked.

Drift-detection: remove the org check in `cancel_scan` → this test fails
(returns 200 instead of 403/404).
"""
from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.area_scan import AreaScan
from app.models.organization import Organization
from app.models.project import Project


@pytest.mark.asyncio
async def test_cannot_cancel_other_orgs_scan(
    async_client: AsyncClient,
    test_db: AsyncSession,
    auth_headers: dict[str, str],
):
    # Build a running scan that belongs to a DIFFERENT org (via its project).
    org_b = Organization(name=f"OrgB-{uuid.uuid4()}")
    test_db.add(org_b)
    await test_db.flush()
    project_b = Project(
        organization_id=org_b.id,
        name="OrgB Project",
        gemeente_code="GM9999",
    )
    test_db.add(project_b)
    await test_db.flush()
    scan = AreaScan(
        project_id=project_b.id,
        gemeente_code="GM9999",
        gemeente_naam="Othertown",
        status="running",
        job_id="fake-job-id",
        bbox_minx=0.0,
        bbox_miny=0.0,
        bbox_maxx=1.0,
        bbox_maxy=1.0,
    )
    test_db.add(scan)
    await test_db.commit()

    resp = await async_client.post(f"/api/scans/{scan.id}/cancel", headers=auth_headers)
    assert resp.status_code == 404
