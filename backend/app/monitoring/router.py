"""Monitoring API endpoints for change detection and notifications."""

import logging
import re
import uuid
from datetime import datetime, timedelta

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_active_user, get_current_organization_id
from app.core.database import get_db
from app.government_apis.pdok_locatieserver import PDOKLocatieserver
from app.middleware.rate_limit import limiter
from app.models.change_read_state import ChangeReadState
from app.models.change_record import ChangeRecord
from app.models.parcel_cache import ParcelCache
from app.models.project import Project
from app.models.user import User
from app.models.user_notification_state import UserNotificationState
from app.schemas.monitoring import (
    ChangeRecordListResponse,
    ChangeRecordResponse,
    MarkAllReadResponse,
    MatchedParcel,
    MatchedReport,
    MonitoringSubscriptionRequest,
    MonitoringSubscriptionResponse,
    ProjectUnreadCount,
    UnreadDetailResponse,
)
from app.schemas.project import ProjectListResponse, ProjectResponse
from app.services.bekendmaking_matcher import (
    find_changes_for_parcel,
    find_matching_parcels,
    find_matching_reports,
    find_parcel_at_point,
)
from app.services.category_classifier import classify_bekendmaking
from app.services.change_detector import detect_permit_changes
from app.services.postcode_extractor import extract_postcodes

logger = logging.getLogger(__name__)
locatieserver = PDOKLocatieserver()

router = APIRouter(prefix="/api/monitoring", tags=["monitoring"])


def _normalize_postcode(value: str | None) -> str | None:
    if not isinstance(value, str):
        return None
    cleaned = value.upper().replace(" ", "").strip()
    return cleaned if len(cleaned) == 6 else None


def _normalize_gemeente_code(value: str | None) -> str | None:
    if not isinstance(value, str):
        return None
    code = value.strip().upper()
    if not code:
        return None
    if re.fullmatch(r"GM\d{4}", code):
        return code
    digits = code[2:] if code.startswith("GM") else code
    if re.fullmatch(r"\d{4}", digits):
        return f"GM{digits}"
    return None


def _coerce_huisnummer(value: object) -> int | None:
    if isinstance(value, int):
        return value if value > 0 else None
    if isinstance(value, str):
        m = re.search(r"(\d+)", value)
        if m:
            try:
                parsed = int(m.group(1))
                return parsed if parsed > 0 else None
            except ValueError:
                return None
    return None


def _normalize_street_hint(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    street = value.strip()
    if not street:
        return None

    # Some SRU titles leak prefix text into the extracted street:
    # "Verlenging beslistermijn ... - Wylrehofweg" -> "Wylrehofweg"
    if " - " in street:
        parts = [p.strip() for p in street.split(" - ") if p.strip()]
        if parts:
            street = parts[-1]

    return street or None


def _extract_huisnummer_from_address(address: str | None) -> int | None:
    if not address:
        return None
    first_line = address.split(",")[0].strip()
    m = re.search(r"(\d+)", first_line)
    if not m:
        return None
    try:
        return int(m.group(1))
    except ValueError:
        return None


def _extract_street_huisnummer(address_like: str | None) -> tuple[str, int] | None:
    if not address_like:
        return None

    first_line = address_like.split(",")[0].strip()
    if " - " in first_line:
        first_line = first_line.rsplit(" - ", 1)[-1].strip()

    # Match: "<street words> <number>[suffix]"
    m = re.search(r"(.+?)\s+(\d+)(?:[A-Za-z]|-[A-Za-z0-9]+)?\b", first_line)
    if not m:
        return None

    street = _normalize_street_hint(m.group(1))
    if not street:
        return None
    try:
        huisnummer = int(m.group(2))
    except ValueError:
        return None

    if huisnummer <= 0:
        return None
    return street, huisnummer


def _extract_city_from_address_like(address_like: str | None) -> str | None:
    if not isinstance(address_like, str):
        return None

    parts = [p.strip() for p in address_like.split(",") if p.strip()]
    if len(parts) >= 2:
        candidate = parts[-1]
        candidate = re.sub(r"\b\d{4}\s?[A-Z]{2}\b", "", candidate).strip()
        if candidate and not any(ch.isdigit() for ch in candidate):
            words = candidate.split()
            if words and len(words) <= 4 and words[0][0].isupper():
                return " ".join(words)

    # Fallback for "Straat 12 Venlo" style (no comma/postcode).
    match = re.search(
        r"\b\d+[A-Za-z]?(?:-[A-Za-z0-9]+)?\b\s*,?\s*(.+)$",
        address_like.strip(),
    )
    if not match:
        return None

    tail = match.group(1).split(",")[0].strip()
    if not tail:
        return None

    words = [w.strip(" .;:-") for w in tail.split() if w.strip(" .;:-")]
    if not words:
        return None

    permit_words = {
        "omgevingsvergunning",
        "bouwvergunning",
        "sloopvergunning",
        "aanvraag",
        "verleende",
        "verleend",
        "geweigerde",
        "geweigerd",
        "ingetrokken",
        "kennisgeving",
        "besluit",
        "vergunning",
        "bekendmaking",
        "beschikking",
        "reguliere",
        "regulier",
        "ontwerpbesluit",
        "ontwerp",
        "aangevraagde",
        "aangevraagd",
        "mededeling",
    }
    if words[0].lower() in permit_words:
        return None

    connectors = {"aan", "de", "den", "der", "het", "op", "te", "ter", "ten", "van", "bij"}
    picked: list[str] = []
    for idx, word in enumerate(words):
        normalized = word.replace("’", "'").strip()
        if not normalized or any(ch.isdigit() for ch in normalized):
            break
        is_upper_start = normalized.startswith("'") or normalized[0].isupper()
        if idx == 0:
            if not is_upper_start:
                return None
            picked.append(word)
            continue
        if len(picked) >= 4:
            break
        if is_upper_start or normalized.lower() in connectors:
            picked.append(word)
            continue
        break

    if not picked:
        return None
    return " ".join(picked)


def _build_address_from_hints(
    street: str,
    huisnummer: int,
    postcode: str | None,
    city: str | None,
    gemeente_naam: str | None,
) -> str:
    first_line = f"{street} {huisnummer}".strip()
    normalized_postcode = _normalize_postcode(postcode)
    city_hint = city.strip() if isinstance(city, str) and city.strip() else None
    if not city_hint:
        city_hint = gemeente_naam.strip() if isinstance(gemeente_naam, str) and gemeente_naam.strip() else None

    parts = [first_line]
    if normalized_postcode and city_hint:
        parts.append(f"{normalized_postcode} {city_hint}")
    elif normalized_postcode:
        parts.append(normalized_postcode)
    elif city_hint:
        parts.append(city_hint)
    return ", ".join(parts)


def _extract_match_hints(
    change: ChangeRecord,
    effective_postcode: str | None,
) -> tuple[str, int, str | None, str | None] | None:
    components = (change.metadata_json or {}).get("address_components")
    if isinstance(components, dict):
        street = _normalize_street_hint(components.get("street"))
        huisnummer = _coerce_huisnummer(components.get("huisnummer"))
        postcode = _normalize_postcode(
            effective_postcode or components.get("postcode")
        )
        city = _normalize_street_hint(components.get("city"))
        if street and huisnummer:
            return street, huisnummer, postcode, city

    parsed = _extract_street_huisnummer(change.address)
    if parsed:
        return (
            parsed[0],
            parsed[1],
            _normalize_postcode(effective_postcode),
            _extract_city_from_address_like(change.address),
        )

    # Last fallback: try parsing from title tail after last " - "
    title_tail = (
        change.title.rsplit(" - ", 1)[-1]
        if isinstance(change.title, str) and " - " in change.title
        else change.title
    )
    # Guard against non-address numbers in titles (e.g., "sectie A 4807").
    if isinstance(title_tail, str) and re.search(r"\bsectie\b", title_tail, re.IGNORECASE):
        return None
    parsed_from_title = _extract_street_huisnummer(title_tail)
    if parsed_from_title:
        return (
            parsed_from_title[0],
            parsed_from_title[1],
            _normalize_postcode(effective_postcode),
            _extract_city_from_address_like(title_tail),
        )

    return None


async def _find_parcel_by_address_hint(
    street: str,
    huisnummer: int,
    organization_id: uuid.UUID,
    db: AsyncSession,
    postcode: str | None = None,
    city: str | None = None,
) -> uuid.UUID | None:
    """Best-effort parcel lookup from textual address hints in ParcelCache.address."""
    normalized_street = street.strip().lower()
    if not normalized_street:
        return None

    normalized_postcode = _normalize_postcode(postcode)
    normalized_city = city.lower().strip() if isinstance(city, str) and city.strip() else None

    query = select(ParcelCache.id, ParcelCache.address).where(
        ParcelCache.organization_id == organization_id,
        ParcelCache.address.is_not(None),
        func.lower(ParcelCache.address).contains(normalized_street),
    )
    if normalized_postcode:
        query = query.where(
            func.upper(
                func.regexp_replace(ParcelCache.address, r"\s+", "", "g")
            ).contains(normalized_postcode)
        )
    elif normalized_city:
        query = query.where(func.lower(ParcelCache.address).contains(normalized_city))

    rows = (await db.execute(query.limit(60))).all()
    if not rows:
        return None

    exact = [
        row
        for row in rows
        if _extract_huisnummer_from_address(row[1]) == huisnummer
    ]
    if exact:
        return exact[0][0]

    # Safe fallback only when there is exactly one candidate.
    if len(rows) == 1:
        return rows[0][0]
    return None


async def _try_match_parcel_from_metadata(
    change: ChangeRecord,
    organization_id: uuid.UUID,
    client: httpx.AsyncClient,
    db: AsyncSession,
) -> uuid.UUID | None:
    """Try geocode + spatial parcel match using address_components metadata."""
    components = (change.metadata_json or {}).get("address_components")
    if not isinstance(components, dict):
        return None

    street = _normalize_street_hint(components.get("street"))
    huisnummer = _coerce_huisnummer(components.get("huisnummer"))
    if not street or not huisnummer:
        return None

    coords = await locatieserver.geocode_address(
        street=street,
        huisnummer=huisnummer,
        client=client,
        postcode=_normalize_postcode(components.get("postcode")),
        city=components.get("city"),
        gemeente_naam=change.gemeente_naam,
    )

    if coords is not None:
        matched = await find_parcel_at_point(coords[0], coords[1], organization_id, db)
        if matched is not None:
            return matched

    # Fallback when PDOK geocoding returns nothing or point-in-polygon misses.
    return await _find_parcel_by_address_hint(
        street=street,
        huisnummer=huisnummer,
        organization_id=organization_id,
        db=db,
        postcode=_normalize_postcode(components.get("postcode")),
        city=_normalize_street_hint(components.get("city")),
    )


def _build_address_from_components(
    components: dict | None,
    normalized_postcode: str | None = None,
) -> str | None:
    """Build a display address from extracted address components."""
    if not isinstance(components, dict):
        return None

    street = str(components.get("street") or "").strip()
    huisnummer = str(components.get("huisnummer") or "").strip()
    toevoeging = str(components.get("huisnummer_toevoeging") or "").strip()
    city = str(components.get("city") or "").strip()

    if not street or not huisnummer:
        return None

    first_line = f"{street} {huisnummer}{toevoeging}".strip()
    postcode = normalized_postcode or (
        str(components.get("postcode") or "").upper().replace(" ", "")
    )

    address_parts = [first_line]
    if postcode:
        address_parts.append(postcode)
    if city:
        address_parts.append(city)

    return ", ".join(address_parts)


@router.get("/changes", response_model=ChangeRecordListResponse)
@limiter.limit("60/minute")
async def get_changes(
    request: Request,
    project_id: uuid.UUID | None = Query(None),
    gemeente_naam: str | None = Query(None),
    include_matches: bool = False,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> ChangeRecordListResponse:
    """
    Get change history, optionally filtered by project.

    When project_id is provided: returns changes for that project and updates
    the user's last_viewed_at (existing behavior).

    When project_id is omitted: returns all organization changes across all
    projects, with project_name included for feed context. No notification
    side-effect (mark-as-viewed stays per-project via POST /viewed/{id}).

    When include_matches=true, each change record with a postcode will include
    matched_parcels and matched_reports from the organization's data.
    """
    try:
        # Per-project path: verify project + mark as viewed
        if project_id is not None:
            project_query = select(Project).where(
                Project.id == project_id,
                Project.organization_id == organization_id,
            )
            project_result = await db.execute(project_query)
            project = project_result.scalar_one_or_none()

            if project is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Project not found",
                )

        # Query change records
        changes_query = (
            select(ChangeRecord)
            .where(ChangeRecord.organization_id == organization_id)
            .order_by(ChangeRecord.detected_at.desc())
            .limit(limit)
            .offset(offset)
        )
        if project_id is not None:
            changes_query = changes_query.where(
                ChangeRecord.project_id == project_id
            )
        if gemeente_naam is not None:
            changes_query = changes_query.where(
                ChangeRecord.gemeente_naam == gemeente_naam
            )

        changes_result = await db.execute(changes_query)
        changes = changes_result.scalars().all()

        # Count total
        count_query = select(func.count(ChangeRecord.id)).where(
            ChangeRecord.organization_id == organization_id,
        )
        if project_id is not None:
            count_query = count_query.where(
                ChangeRecord.project_id == project_id
            )
        if gemeente_naam is not None:
            count_query = count_query.where(
                ChangeRecord.gemeente_naam == gemeente_naam
            )
        count_result = await db.execute(count_query)
        total = count_result.scalar() or 0

        # Side effect: Update last_viewed_at only for per-project requests
        if project_id is not None:
            notification_query = select(UserNotificationState).where(
                UserNotificationState.user_id == current_user.id,
                UserNotificationState.project_id == project_id,
            )
            notification_result = await db.execute(notification_query)
            notification_state = notification_result.scalar_one_or_none()

            if notification_state is None:
                notification_state = UserNotificationState(
                    organization_id=organization_id,
                    user_id=current_user.id,
                    project_id=project_id,
                    last_viewed_at=datetime.utcnow(),
                )
                db.add(notification_state)
            else:
                notification_state.last_viewed_at = datetime.utcnow()

            await db.flush()
            await db.commit()

        # For all-org feed, pre-load project names
        project_names: dict[uuid.UUID, str] = {}
        if project_id is None and changes:
            project_ids = {c.project_id for c in changes}
            names_query = select(Project.id, Project.name).where(
                Project.id.in_(project_ids)
            )
            names_result = await db.execute(names_query)
            project_names = dict(names_result.all())

        # Build response with optional match enrichment
        change_responses: list[ChangeRecordResponse] = []
        for change in changes:
            matched_parcels = None
            matched_reports = None
            components = (change.metadata_json or {}).get("address_components")
            effective_postcode = change.postcode

            if not effective_postcode:
                if isinstance(components, dict) and components.get("postcode"):
                    effective_postcode = str(components["postcode"]).upper().replace(" ", "")
                else:
                    for text_candidate in (
                        change.address,
                        change.title,
                        change.source_url,
                    ):
                        if not text_candidate:
                            continue
                        extracted = extract_postcodes(text_candidate)
                        if extracted:
                            effective_postcode = extracted[0]
                            break

            effective_address = change.address or _build_address_from_components(
                components, effective_postcode
            )
            resolved_parcel_id = change.matched_parcel_id
            if resolved_parcel_id is None and include_matches:
                hints = _extract_match_hints(change, effective_postcode)
                if hints is not None:
                    resolved_parcel_id = await _find_parcel_by_address_hint(
                        street=hints[0],
                        huisnummer=hints[1],
                        organization_id=organization_id,
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
            hints_for_ui = _extract_match_hints(change, effective_postcode)
            huisnummer_hint = hints_for_ui[1] if hints_for_ui is not None else _extract_huisnummer_from_address(effective_address)

            if include_matches and effective_postcode:
                parcel_matches = await find_matching_parcels(
                    effective_postcode, organization_id, db
                )
                report_matches = await find_matching_reports(
                    effective_postcode, organization_id, db
                )
                if parcel_matches:
                    matched_parcels = [MatchedParcel(**m) for m in parcel_matches]
                if report_matches:
                    matched_reports = [MatchedReport(**m) for m in report_matches]

            change_responses.append(
                ChangeRecordResponse(
                    id=str(change.id),
                    project_id=str(change.project_id),
                    change_type=change.change_type,
                    external_id=change.external_id,
                    title=change.title,
                    detected_at=change.detected_at.isoformat(),
                    change_date=change.change_date.isoformat(),
                    gemeente_naam=change.gemeente_naam,
                    address=effective_address,
                    source_url=change.source_url,
                    postcode=effective_postcode,
                    huisnummer_hint=huisnummer_hint,
                    matched_parcel_id=str(resolved_parcel_id) if resolved_parcel_id else None,
                    matched_parcels=matched_parcels,
                    matched_reports=matched_reports,
                    project_name=project_names.get(change.project_id),
                    category_label=classify_bekendmaking(
                        change.title, change.change_type
                    ),
                )
            )

        # Collect read_change_ids for the current user from this page
        read_change_ids: list[str] | None = None
        if change_responses:
            response_change_uuids = [uuid.UUID(c.id) for c in change_responses]
            read_query = select(ChangeReadState.change_id).where(
                ChangeReadState.user_id == current_user.id,
                ChangeReadState.change_id.in_(response_change_uuids),
            )
            read_result = await db.execute(read_query)
            read_ids = read_result.scalars().all()
            read_change_ids = [str(cid) for cid in read_ids]

        has_more = (offset + limit) < total

        return ChangeRecordListResponse(
            changes=change_responses,
            total=total,
            read_change_ids=read_change_ids,
            has_more=has_more,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get change history",
        ) from e


@router.get(
    "/changes-for-parcel/{parcel_id}",
    response_model=list[ChangeRecordResponse],
)
@limiter.limit("60/minute")
async def get_changes_for_parcel(
    request: Request,
    parcel_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> list[ChangeRecordResponse]:
    """
    Get bekendmakingen matching a specific parcel's postcode.

    Extracts postcode from the parcel's address and finds ChangeRecords
    with the same postcode. Multi-tenant isolated.
    """
    try:
        records = await find_changes_for_parcel(parcel_id, organization_id, db)

        return [
            ChangeRecordResponse(
                id=str(r.id),
                project_id=str(r.project_id),
                change_type=r.change_type,
                external_id=r.external_id,
                title=r.title,
                detected_at=r.detected_at.isoformat(),
                change_date=r.change_date.isoformat(),
                gemeente_naam=r.gemeente_naam,
                address=r.address,
                source_url=r.source_url,
                postcode=r.postcode,
                huisnummer_hint=_extract_huisnummer_from_address(r.address),
                matched_parcel_id=str(r.matched_parcel_id) if r.matched_parcel_id else None,
                category_label=classify_bekendmaking(r.title, r.change_type),
            )
            for r in records
        ]

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get changes for parcel",
        ) from e


@router.get("/unread", response_model=UnreadDetailResponse)
@limiter.limit("120/minute")
async def get_unread(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> UnreadDetailResponse:
    """
    Get unread change counts for current user.

    Returns total unread count and per-project breakdown.
    """
    try:
        # Per-change read state: a change is unread if NO matching row exists
        # in change_read_states for (user_id, change_id).
        # LEFT JOIN against change_read_states; crs.id IS NULL means unread.
        read_subquery = (
            select(ChangeReadState.change_id)
            .where(ChangeReadState.user_id == current_user.id)
            .subquery()
        )

        query = (
            select(
                ChangeRecord.project_id,
                func.count(ChangeRecord.id).label("unread_count"),
            )
            .outerjoin(
                read_subquery,
                read_subquery.c.change_id == ChangeRecord.id,
            )
            .where(
                ChangeRecord.organization_id == organization_id,
                read_subquery.c.change_id.is_(None),
            )
            .group_by(ChangeRecord.project_id)
        )

        result = await db.execute(query)
        rows = result.all()

        per_project_counts: list[ProjectUnreadCount] = []
        total_unread = 0

        for project_id, unread_count in rows:
            if unread_count > 0:
                per_project_counts.append(
                    ProjectUnreadCount(
                        project_id=str(project_id),
                        unread_count=unread_count,
                    )
                )
                total_unread += unread_count

        projects_with_changes = len(per_project_counts)

        return UnreadDetailResponse(
            total_unread=total_unread,
            projects_with_changes=projects_with_changes,
            per_project=per_project_counts,
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get unread counts",
        ) from e


@router.post("/changes/read-all", response_model=MarkAllReadResponse)
@limiter.limit("30/minute")
async def mark_all_read(
    request: Request,
    project_id: uuid.UUID | None = Query(None),
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> MarkAllReadResponse:
    """
    Mark all changes as read for the current user.

    If project_id is provided: marks all changes for that project as read.
    If project_id is omitted: marks all changes across the organization as read.

    Uses ON CONFLICT DO NOTHING for idempotency (safe to call multiple times).
    """
    try:
        changes_query = select(ChangeRecord.id).where(
            ChangeRecord.organization_id == organization_id,
        )
        if project_id is not None:
            # Verify project belongs to organization
            project_check = select(Project.id).where(
                Project.id == project_id,
                Project.organization_id == organization_id,
            )
            project_result = await db.execute(project_check)
            if project_result.scalar_one_or_none() is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Project not found",
                )
            changes_query = changes_query.where(
                ChangeRecord.project_id == project_id
            )

        changes_result = await db.execute(changes_query)
        change_ids = changes_result.scalars().all()

        if not change_ids:
            return MarkAllReadResponse(status="ok", marked_count=0)

        # Bulk insert with ON CONFLICT DO NOTHING for idempotency
        rows = [
            {
                "organization_id": organization_id,
                "user_id": current_user.id,
                "change_id": cid,
            }
            for cid in change_ids
        ]
        stmt = pg_insert(ChangeReadState).values(rows).on_conflict_do_nothing(
            index_elements=None,
            constraint="uq_change_read_states_user_change",
        )
        result = await db.execute(stmt)
        await db.flush()
        await db.commit()

        marked_count = result.rowcount if result.rowcount >= 0 else len(rows)

        return MarkAllReadResponse(status="ok", marked_count=marked_count)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to mark all changes as read",
        ) from e


@router.post("/changes/{change_id}/read")
@limiter.limit("60/minute")
async def mark_change_read(
    request: Request,
    change_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """
    Mark a single change as read for the current user.

    Idempotent: safe to call multiple times (ON CONFLICT DO NOTHING).
    """
    try:
        change_query = select(ChangeRecord.id).where(
            ChangeRecord.id == change_id,
            ChangeRecord.organization_id == organization_id,
        )
        change_result = await db.execute(change_query)
        if change_result.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Change not found",
            )

        stmt = (
            pg_insert(ChangeReadState)
            .values(
                organization_id=organization_id,
                user_id=current_user.id,
                change_id=change_id,
            )
            .on_conflict_do_nothing(
                constraint="uq_change_read_states_user_change",
            )
        )
        await db.execute(stmt)
        await db.flush()
        await db.commit()

        return {"status": "ok"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to mark change as read",
        ) from e


@router.delete("/changes/{change_id}/read")
@limiter.limit("60/minute")
async def mark_change_unread(
    request: Request,
    change_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """
    Mark a single change as unread for the current user.

    Removes the ChangeReadState row if it exists. Idempotent (no error if not found).
    """
    try:
        from sqlalchemy import delete

        stmt = delete(ChangeReadState).where(
            ChangeReadState.user_id == current_user.id,
            ChangeReadState.change_id == change_id,
        )
        await db.execute(stmt)
        await db.flush()
        await db.commit()

        return {"status": "ok"}

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to mark change as unread",
        ) from e


@router.post("/viewed/{project_id}")
@limiter.limit("60/minute")
async def mark_viewed(
    request: Request,
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """
    Mark a project as viewed by the current user.

    Upserts UserNotificationState, clearing the unread badge.
    """
    try:
        project_query = select(Project).where(
            Project.id == project_id,
            Project.organization_id == organization_id,
        )
        project_result = await db.execute(project_query)
        project = project_result.scalar_one_or_none()

        if project is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found",
            )

        notification_query = select(UserNotificationState).where(
            UserNotificationState.user_id == current_user.id,
            UserNotificationState.project_id == project_id,
        )
        notification_result = await db.execute(notification_query)
        notification_state = notification_result.scalar_one_or_none()

        if notification_state is None:
            notification_state = UserNotificationState(
                organization_id=organization_id,
                user_id=current_user.id,
                project_id=project_id,
                last_viewed_at=datetime.utcnow(),
            )
            db.add(notification_state)
        else:
            notification_state.last_viewed_at = datetime.utcnow()

        await db.flush()
        await db.commit()

        return {"status": "ok"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to mark project as viewed",
        ) from e


@router.get("/projects", response_model=ProjectListResponse)
@limiter.limit("60/minute")
async def get_monitored_projects(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> ProjectListResponse:
    """
    Get hierarchical list of monitored projects with unread counts.
    """
    try:
        projects_query = (
            select(Project)
            .where(
                Project.organization_id == organization_id,
                Project.is_monitored == True,  # noqa: E712
            )
            .order_by(Project.name)
        )
        projects_result = await db.execute(projects_query)
        projects = projects_result.scalars().all()

        project_responses = []
        for project in projects:
            notification_query = select(UserNotificationState).where(
                UserNotificationState.user_id == current_user.id,
                UserNotificationState.project_id == project.id,
            )
            notification_result = await db.execute(notification_query)
            notification_state = notification_result.scalar_one_or_none()

            if notification_state is None:
                count_query = select(func.count(ChangeRecord.id)).where(
                    ChangeRecord.project_id == project.id,
                    ChangeRecord.organization_id == organization_id,
                )
            else:
                count_query = select(func.count(ChangeRecord.id)).where(
                    ChangeRecord.project_id == project.id,
                    ChangeRecord.organization_id == organization_id,
                    ChangeRecord.detected_at > notification_state.last_viewed_at,
                )

            count_result = await db.execute(count_query)
            unread_count = count_result.scalar() or 0

            project_response = ProjectResponse(
                id=project.id,
                name=project.name,
                description=project.description,
                created_at=project.created_at,
                updated_at=project.updated_at,
                report_count=0,
                parent_id=str(project.parent_id) if project.parent_id else None,
                gemeente_code=project.gemeente_code,
                wijk_naam=project.wijk_naam,
                is_monitored=project.is_monitored,
                unread_count=unread_count,
                children=[],
            )

            project_responses.append(project_response)

        children_by_parent: dict[uuid.UUID, list[ProjectResponse]] = {}
        root_projects: list[ProjectResponse] = []

        for proj_resp in project_responses:
            if proj_resp.parent_id is not None:
                parent_uuid = uuid.UUID(proj_resp.parent_id)
                children_by_parent.setdefault(parent_uuid, []).append(proj_resp)
            else:
                root_projects.append(proj_resp)

        for root in root_projects:
            root.children = children_by_parent.get(root.id, [])

        return ProjectListResponse(
            projects=root_projects,
            total=len(root_projects),
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get monitored projects",
        ) from e


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

        return MonitoringSubscriptionResponse(
            gemeente_code=gemeente_code,
            gemeente_naam=gemeente_naam,
            enabled=payload.enabled,
            project_id=str(root_project.id) if root_project else None,
            affected_projects=affected_projects,
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
                    change, organization_id, client, db
                )
                if matched_id is None:
                    hints = _extract_match_hints(change, effective_postcode)
                    if hints is not None:
                        matched_id = await _find_parcel_by_address_hint(
                            street=hints[0],
                            huisnummer=hints[1],
                            organization_id=organization_id,
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
                    organization_id=organization_id,
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
