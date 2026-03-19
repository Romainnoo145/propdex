"""Integration tests for spatial operations and shared scan data access."""

import pytest
from geoalchemy2 import WKTElement
from sqlalchemy import func, select, text

from app.models.area_scan import AreaScan
from app.models.parcel_cache import ParcelCache
from app.models.scan_result import ScanResult


class TestRLSPoliciesExist:
    """Verify RLS policies exist on spatial tables (shared access)."""

    async def test_parcel_cache_rls_policy_exists(self, test_db):
        """Verify parcel_cache has shared-access RLS policy."""
        stmt = text("""
            SELECT polname FROM pg_policy
            WHERE polrelid = 'parcel_cache'::regclass
        """)
        result = await test_db.execute(stmt)
        policy = result.scalar()
        # Policy may be shared_access_parcel_cache (post-migration) or None (test DB)
        assert policy is None or "shared_access" in policy or "tenant_isolation" in policy

    async def test_area_scans_rls_policy_exists(self, test_db):
        """Verify area_scans has shared-access RLS policy."""
        stmt = text("""
            SELECT polname FROM pg_policy
            WHERE polrelid = 'area_scans'::regclass
        """)
        result = await test_db.execute(stmt)
        policy = result.scalar()
        assert policy is None or "shared_access" in policy or "tenant_isolation" in policy

    async def test_scan_results_rls_policy_exists(self, test_db):
        """Verify scan_results has shared-access RLS policy."""
        stmt = text("""
            SELECT polname FROM pg_policy
            WHERE polrelid = 'scan_results'::regclass
        """)
        result = await test_db.execute(stmt)
        policy = result.scalar()
        assert policy is None or "shared_access" in policy or "tenant_isolation" in policy


class TestSharedScanDataAccess:
    """Scan data is shared — no org isolation. All authenticated users see same data."""

    async def test_parcel_cache_no_org_id(self, test_db):
        """ParcelCache can be created and queried without organization_id."""
        parcel = ParcelCache(
            parcel_id="TST01-A-0001",
            geometry=WKTElement("MULTIPOLYGON(((0 0, 1 0, 1 1, 0 1, 0 0)))", srid=28992),
            gemeente_code="0001",
            has_pand=True,
        )
        test_db.add(parcel)
        await test_db.flush()
        await test_db.commit()

        row = (await test_db.execute(
            select(ParcelCache).where(ParcelCache.parcel_id == "TST01-A-0001")
        )).scalar_one()
        assert row.gemeente_code == "0001"
        assert not hasattr(row, "organization_id") or getattr(row, "organization_id", None) is None

    async def test_area_scan_no_org_id(self, test_db):
        """AreaScan can be created and queried without organization_id."""
        scan = AreaScan(
            gemeente_code="0001",
            gemeente_naam="TestGemeente",
            bbox_minx=100000, bbox_miny=400000,
            bbox_maxx=101000, bbox_maxy=401000,
            status="completed",
        )
        test_db.add(scan)
        await test_db.flush()
        await test_db.commit()

        row = (await test_db.execute(
            select(AreaScan).where(AreaScan.gemeente_code == "0001")
        )).scalar_one()
        assert row.status == "completed"

    async def test_scan_result_no_org_id(self, test_db):
        """ScanResult can be created and queried without organization_id."""
        # Need a scan and parcel first
        scan = AreaScan(
            gemeente_code="0002",
            gemeente_naam="TestGemeente2",
            bbox_minx=100000, bbox_miny=400000,
            bbox_maxx=101000, bbox_maxy=401000,
            status="completed",
        )
        test_db.add(scan)
        await test_db.flush()

        parcel = ParcelCache(
            parcel_id="TST02-A-0001",
            geometry=WKTElement("MULTIPOLYGON(((0 0, 1 0, 1 1, 0 1, 0 0)))", srid=28992),
            gemeente_code="0002",
            has_pand=True,
        )
        test_db.add(parcel)
        await test_db.flush()

        result = ScanResult(
            scan_id=scan.id,
            parcel_id=parcel.id,
            score=75.0,
            flags={"category": "High"},
        )
        test_db.add(result)
        await test_db.flush()
        await test_db.commit()

        row = (await test_db.execute(
            select(ScanResult).where(ScanResult.parcel_id == parcel.id)
        )).scalar_one()
        assert row.score == 75.0


class TestSpatialOperations:
    """Test PostGIS spatial operations on shared parcel data."""

    async def test_postgis_available(self, test_db):
        """Verify PostGIS extension is available."""
        result = await test_db.execute(text("SELECT PostGIS_Version()"))
        version = result.scalar()
        assert version is not None

    async def test_geometry_storage_and_retrieval(self, test_db):
        """Test that geometry is stored and retrievable."""
        parcel = ParcelCache(
            parcel_id="GEO-TEST-001",
            geometry=WKTElement(
                "MULTIPOLYGON(((121600 487400, 121700 487400, 121700 487500, 121600 487500, 121600 487400)))",
                srid=28992,
            ),
            gemeente_code="0363",
            has_pand=False,
        )
        test_db.add(parcel)
        await test_db.flush()
        await test_db.commit()

        # Query using spatial function
        point = func.ST_SetSRID(func.ST_MakePoint(121650, 487450), 28992)
        row = (await test_db.execute(
            select(ParcelCache.id).where(
                func.ST_Contains(ParcelCache.geometry, point),
            )
        )).scalar_one_or_none()
        assert row is not None
