"""Users router: profile update, password change, and preferences CRUD."""

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_active_user
from app.auth.email import send_verification_email
from app.auth.jwt import create_email_verification_token
from app.auth.password import hash_password, verify_password
from app.auth.schemas import MessageResponse, UserResponse
from app.core.database import get_db
from app.models.user import User
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
