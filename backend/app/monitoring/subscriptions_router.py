"""Subscription and refresh endpoints for monitoring."""

import logging
import uuid
from datetime import datetime, timedelta

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_active_user, get_current_organization_id
from app.core.database import get_db
from app.middleware.rate_limit import limiter
from app.models.change_record import ChangeRecord
from app.models.funda_listing_snapshot import FundaListingSnapshot
from app.models.project import Project
from app.models.user import User
from app.monitoring._helpers import (
    _build_address_from_components,
    _build_address_from_hints,
    _extract_match_hints,
    _find_parcel_by_address_hint,
    _normalize_gemeente_code,
    _try_match_parcel_from_metadata,
)
from app.schemas.monitoring import (
    FundaSnapshotRequest,
    FundaSnapshotResponse,
    FundaSnapshotStatsResponse,
    MonitoringSubscriptionRequest,
    MonitoringSubscriptionResponse,
)
from app.services.change_detector import detect_permit_changes
from app.services.postcode_extractor import extract_postcodes

logger = logging.getLogger(__name__)

router = APIRouter(tags=["monitoring"])


@router.post("/subscriptions", response_model=MonitoringSubscriptionResponse)
@limiter.limit("30/minute")
async def set_gemeente_subscription(
    request: Request,
    payload: MonitoringSubscriptionRequest,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> MonitoringSubscriptionResponse:
    """
    Enable or disable monitoring for a single gemeente.

    If enabling and no gemeente-level project exists yet, creates one.
    Applies the monitoring flag to all projects in the organization with the
    same gemeente_code, so daily monitoring can be controlled centrally.
    """
    try:
        gemeente_code = _normalize_gemeente_code(payload.gemeente_code)
        if not gemeente_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid gemeente_code",
            )

        gemeente_naam = payload.gemeente_naam.strip() or gemeente_code

        project_query = (
            select(Project)
            .where(
                Project.organization_id == organization_id,
                Project.gemeente_code == gemeente_code,
            )
            .order_by(Project.created_at.asc())
        )
        project_result = await db.execute(project_query)
        projects = list(project_result.scalars().all())

        root_project = next((p for p in projects if p.parent_id is None), None)
        affected_projects = 0

        if payload.enabled and root_project is None:
            root_project = Project(
                organization_id=organization_id,
                name=gemeente_naam,
                description=f"Monitoring voor gemeente {gemeente_naam}",
                parent_id=None,
                gemeente_code=gemeente_code,
                wijk_naam=None,
                is_monitored=True,
            )
            db.add(root_project)
            await db.flush()
            projects.append(root_project)
            affected_projects += 1

        for project in projects:
            if project.is_monitored == payload.enabled:
                continue
            project.is_monitored = payload.enabled
            affected_projects += 1

        await db.commit()

        monitored_projects = sum(1 for project in projects if project.is_monitored)

        return MonitoringSubscriptionResponse(
            gemeente_code=gemeente_code,
            gemeente_naam=gemeente_naam,
            enabled=payload.enabled,
            project_id=str(root_project.id) if root_project else None,
            affected_projects=affected_projects,
            monitored_projects=monitored_projects,
            total_projects=len(projects),
            has_root_project=root_project is not None,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to update gemeente monitoring subscription: %s", e)
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update gemeente monitoring subscription",
        ) from e


@router.get(
    "/subscriptions/{gemeente_code}",
    response_model=MonitoringSubscriptionResponse,
)
@limiter.limit("60/minute")
async def get_gemeente_subscription(
    request: Request,
    gemeente_code: str,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> MonitoringSubscriptionResponse:
    """Get current monitoring status for one gemeente code."""
    normalized_code = _normalize_gemeente_code(gemeente_code)
    if not normalized_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid gemeente_code",
        )

    project_query = (
        select(Project)
        .where(
            Project.organization_id == organization_id,
            Project.gemeente_code == normalized_code,
        )
        .order_by(Project.created_at.asc())
    )
    project_result = await db.execute(project_query)
    projects = list(project_result.scalars().all())

    root_project = next((p for p in projects if p.parent_id is None), None)
    enabled = any(project.is_monitored for project in projects)
    monitored_projects = sum(1 for project in projects if project.is_monitored)

    gemeente_naam = (
        root_project.name
        if root_project and root_project.name
        else normalized_code
    )

    return MonitoringSubscriptionResponse(
        gemeente_code=normalized_code,
        gemeente_naam=gemeente_naam,
        enabled=enabled,
        project_id=str(root_project.id) if root_project else None,
        affected_projects=0,
        monitored_projects=monitored_projects,
        total_projects=len(projects),
        has_root_project=root_project is not None,
    )


@router.post("/refresh/{project_id}")
@limiter.limit("5/minute")
async def refresh_monitoring(
    request: Request,
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    On-demand monitoring refresh for a single gemeente project.

    Triggers permit change detection for the project's gemeente,
    stores new changes, and returns the count of new changes found.
    Rate-limited to 5/min to avoid API abuse.
    """
    try:
        # Load project and verify ownership
        project_query = select(Project).where(
            Project.id == project_id,
            Project.organization_id == organization_id,
            Project.is_monitored == True,  # noqa: E712
        )
        project_result = await db.execute(project_query)
        project = project_result.scalar_one_or_none()

        if project is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Monitored project not found",
            )

        # Use project name as gemeente_naam for SRU query
        # For wijk projects, find the parent gemeente project
        if project.parent_id is not None:
            parent_query = select(Project).where(
                Project.id == project.parent_id,
                Project.organization_id == organization_id,
            )
            parent_result = await db.execute(parent_query)
            parent_project = parent_result.scalar_one_or_none()
            gemeente_naam = parent_project.name if parent_project else project.name
            target_project = parent_project or project
        else:
            gemeente_naam = project.name
            target_project = project

        # Determine last_checked from most recent change
        last_checked_query = (
            select(ChangeRecord.detected_at)
            .where(ChangeRecord.project_id == target_project.id)
            .order_by(ChangeRecord.detected_at.desc())
            .limit(1)
        )
        result = await db.execute(last_checked_query)
        last_detected = result.scalar_one_or_none()
        last_checked = last_detected or (datetime.utcnow() - timedelta(days=7))

        # Detect permit changes via SRU Bekendmakingen API
        async with httpx.AsyncClient(timeout=60.0) as client:
            permit_changes = await detect_permit_changes(
                gemeente_naam=gemeente_naam,
                last_checked=last_checked,
                client=client,
                session=db,
            )

        # Store new changes
        stored = 0
        async with httpx.AsyncClient(timeout=60.0) as client:
            for change in permit_changes:
                components = (change.metadata_json or {}).get("address_components")
                effective_postcode = change.postcode
                if not effective_postcode:
                    if isinstance(components, dict) and components.get("postcode"):
                        effective_postcode = str(components["postcode"]).upper().replace(
                            " ", ""
                        )
                    else:
                        for text_candidate in (change.address, change.title, change.source_url):
                            if not text_candidate:
                                continue
                            extracted = extract_postcodes(text_candidate)
                            if extracted:
                                effective_postcode = extracted[0]
                                break

                effective_address = change.address or _build_address_from_components(
                    components, effective_postcode
                )
                matched_id = await _try_match_parcel_from_metadata(
                    change, client, db
                )
                if matched_id is None:
                    hints = _extract_match_hints(change, effective_postcode)
                    if hints is not None:
                        matched_id = await _find_parcel_by_address_hint(
                            street=hints[0],
                            huisnummer=hints[1],
                            db=db,
                            postcode=hints[2],
                            city=hints[3],
                        )
                        if effective_address is None:
                            effective_address = _build_address_from_hints(
                                street=hints[0],
                                huisnummer=hints[1],
                                postcode=hints[2],
                                city=hints[3],
                                gemeente_naam=change.gemeente_naam,
                            )

                change_record = ChangeRecord(
                    project_id=target_project.id,
                    change_type=change.change_type,
                    external_id=change.external_id,
                    gemeente_naam=change.gemeente_naam,
                    title=change.title,
                    change_date=change.change_date,
                    detected_at=change.detected_at,
                    address=effective_address,
                    metadata_json=change.metadata_json,
                    source_url=change.source_url,
                    postcode=effective_postcode,
                    matched_parcel_id=matched_id or change.matched_parcel_id,
                )

                try:
                    async with db.begin_nested():
                        db.add(change_record)
                        await db.flush()
                    stored += 1
                except IntegrityError:
                    continue

        await db.commit()

        logger.info(
            f"On-demand refresh for {gemeente_naam}: "
            f"{stored} new changes from {len(permit_changes)} detected"
        )

        return {
            "status": "ok",
            "new_changes": stored,
            "total_detected": len(permit_changes),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"On-demand monitoring refresh failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to refresh monitoring",
        ) from e


@router.post(
    "/listings/funda/snapshot",
    response_model=FundaSnapshotResponse,
)
@limiter.limit("3/minute")
async def trigger_funda_snapshot(
    request: Request,
    payload: FundaSnapshotRequest,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
) -> FundaSnapshotResponse:
    """Queue a manual Funda snapshot ingestion job for this organization."""
    area_names = [name.strip() for name in payload.area_names if isinstance(name, str) and name.strip()]
    if not area_names:
        area_names = ["arcen"]
    max_listings = max(1, min(payload.max_listings, 200))

    arq_pool = request.app.state.arq_pool
    job = await arq_pool.enqueue_job(
        "funda_snapshot_job",
        str(organization_id),
        area_names,
        max_listings,
    )

    return FundaSnapshotResponse(
        status="queued",
        job_id=job.job_id,
        area_names=area_names,
        max_listings=max_listings,
    )


@router.get(
    "/listings/funda/stats",
    response_model=FundaSnapshotStatsResponse,
)
@limiter.limit("30/minute")
async def get_funda_snapshot_stats(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> FundaSnapshotStatsResponse:
    """Return coarse ingestion stats for Funda snapshots."""
    total_snapshots, unique_listings, matched_parcels, latest_snapshot_date = (
        await db.execute(
            select(
                func.count(FundaListingSnapshot.id),
                func.count(func.distinct(FundaListingSnapshot.listing_external_id)),
                func.count(func.distinct(FundaListingSnapshot.matched_parcel_id)),
                func.max(FundaListingSnapshot.snapshot_date),
            ).where(
                FundaListingSnapshot.source == "funda",
            )
        )
    ).one()

    return FundaSnapshotStatsResponse(
        total_snapshots=int(total_snapshots or 0),
        unique_listings=int(unique_listings or 0),
        matched_parcels=int(matched_parcels or 0),
        latest_snapshot_date=(
            latest_snapshot_date.isoformat()
            if latest_snapshot_date is not None
            else None
        ),
    )
