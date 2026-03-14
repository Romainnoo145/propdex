"""Users router: profile update, password change, and preferences CRUD."""

import uuid

from arq.jobs import Job, JobStatus
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import (
    get_current_active_user,
    get_current_organization_id,
)
from app.auth.email import send_verification_email
from app.auth.jwt import create_email_verification_token
from app.auth.password import hash_password, verify_password
from app.auth.schemas import MessageResponse, UserResponse
from app.core.database import get_db
from app.models.organization import Organization
from app.models.user import User
from app.schemas.score_weights import (
    RescoreJobStatus,
    SaveScoreWeightsRequest,
    ScoreWeightsConfig,
    ScoreWeightsResponse,
)
from app.services.score_v3 import DEFAULT_WEIGHTS
from app.users.schemas import (
    PasswordChange,
    UserPreferences,
    UserPreferencesUpdate,
    UserProfileUpdate,
)

router = APIRouter(prefix="/api/users", tags=["users"])


@router.patch("/me", response_model=UserResponse)
async def update_profile(
    data: UserProfileUpdate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """
    Update the current user's profile (name and/or email).

    Email change resets email_verified and sends a new verification email.
    Email uniqueness is checked globally (case-insensitive).
    """
    if data.full_name is not None:
        current_user.full_name = data.full_name

    if data.email is not None and data.email.lower() != current_user.email.lower():
        # Check email uniqueness (case-insensitive, globally unique)
        result = await db.execute(
            select(User).where(func.lower(User.email) == data.email.lower())
        )
        existing = result.scalar_one_or_none()
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="E-mailadres al in gebruik",
            )
        current_user.email = data.email
        current_user.email_verified = False
        current_user.email_verified_at = None

        # Send re-verification email in background
        token = create_email_verification_token(
            str(current_user.id), data.email
        )
        background_tasks.add_task(send_verification_email, data.email, token)

    await db.commit()
    await db.refresh(current_user)
    return UserResponse.model_validate(current_user)


@router.put("/me/password", response_model=MessageResponse)
async def change_password(
    data: PasswordChange,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """
    Change the current user's password.

    Requires the current password for verification.
    OAuth users (Google) cannot use this endpoint.
    """
    if current_user.auth_provider != "email":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Gebruik je Google-account om je wachtwoord te wijzigen",
        )

    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Huidig wachtwoord onjuist",
        )

    current_user.hashed_password = hash_password(data.new_password)
    await db.commit()
    return MessageResponse(message="Wachtwoord gewijzigd")


@router.get("/me/preferences", response_model=UserPreferences)
async def get_preferences(
    current_user: User = Depends(get_current_active_user),
) -> UserPreferences:
    """
    Get the current user's preferences.

    Returns defaults for fields not yet set by the user.
    """
    prefs = current_user.preferences or {}
    return UserPreferences(**prefs)


@router.patch("/me/preferences", response_model=UserPreferences)
async def update_preferences(
    data: UserPreferencesUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> UserPreferences:
    """
    Partially update the current user's preferences.

    Merges provided fields into existing preferences (unset fields preserved).
    """
    current_prefs = current_user.preferences or {}
    update_data = data.model_dump(exclude_unset=True)
    current_user.preferences = {**current_prefs, **update_data}
    await db.commit()
    return UserPreferences(**current_user.preferences)


@router.get("/org/score-weights", response_model=ScoreWeightsResponse)
async def get_score_weights(
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> ScoreWeightsResponse:
    """
    Get current score weight configuration for the organization.

    Returns stored custom weights if set, or DEFAULT_WEIGHTS if not yet customized.
    """
    result = await db.execute(
        select(Organization).where(Organization.id == organization_id)
    )
    org = result.scalar_one_or_none()
    if org is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    if org.score_weights is None:
        # Return defaults — no custom weights saved yet
        weights_config = ScoreWeightsConfig(
            preset="standaard",
            potentie_risico_balance=DEFAULT_WEIGHTS["potentie_risico_balance"],
            potentie_weights=DEFAULT_WEIGHTS["potentie_weights"],
            risico_weights=DEFAULT_WEIGHTS["risico_weights"],
        )
        return ScoreWeightsResponse(weights=weights_config, is_custom=False)

    weights_config = ScoreWeightsConfig(**org.score_weights)
    return ScoreWeightsResponse(weights=weights_config, is_custom=True)


@router.put("/org/score-weights", response_model=ScoreWeightsResponse)
async def save_score_weights(
    request: Request,
    data: SaveScoreWeightsRequest,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> ScoreWeightsResponse:
    """
    Save custom score weights for the organization and enqueue re-score job.

    Validation: at least 3 active (weight > 0) factors per category required.
    Triggers background re-score job that re-applies weights to stored scan_results.
    """
    # Validate minimum active factors per category
    active_potentie = sum(1 for w in data.potentie_weights.values() if w > 0)
    active_risico = sum(1 for w in data.risico_weights.values() if w > 0)

    if active_potentie < 3:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"At least 3 active potentie factors required (got {active_potentie})",
        )
    if active_risico < 3:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"At least 3 active risico factors required (got {active_risico})",
        )

    # Load org and save weights
    result = await db.execute(
        select(Organization).where(Organization.id == organization_id)
    )
    org = result.scalar_one_or_none()
    if org is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    org.score_weights = data.model_dump()
    db.add(org)
    await db.flush()
    await db.commit()

    # Enqueue re-score job
    arq_pool = request.app.state.arq_pool
    job = await arq_pool.enqueue_job(
        "rescore_weights_job",
        organization_id=str(organization_id),
    )

    weights_config = ScoreWeightsConfig(**data.model_dump())
    return ScoreWeightsResponse(
        weights=weights_config,
        is_custom=True,
        job_id=job.job_id if job else None,
    )


@router.get("/org/score-weights/job/{job_id}", response_model=RescoreJobStatus)
async def get_rescore_job_status(
    request: Request,
    job_id: str,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
) -> RescoreJobStatus:
    """
    Poll re-score job status by job_id.

    Returns current status and impact summary once complete.
    """
    arq_pool = request.app.state.arq_pool
    job = Job(job_id, arq_pool)

    try:
        job_status = await job.status()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        ) from e

    if job_status == JobStatus.not_found:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

    if job_status in (JobStatus.complete,):
        try:
            result = await job.result(timeout=0)
            if isinstance(result, dict):
                return RescoreJobStatus(
                    status="complete",
                    processed=result.get("processed", 0),
                    up_count=result.get("up_count", 0),
                    down_count=result.get("down_count", 0),
                    unchanged_count=result.get("unchanged_count", 0),
                    avg_delta=result.get("avg_delta", 0.0),
                )
        except Exception:
            pass
        return RescoreJobStatus(status="complete")

    if job_status == JobStatus.failed:
        return RescoreJobStatus(status="failed")

    if job_status == JobStatus.in_progress:
        return RescoreJobStatus(status="in_progress")

    # queued or deferred
    return RescoreJobStatus(status="queued")
