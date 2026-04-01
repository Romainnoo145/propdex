"""Authentication service layer — user registration, login, token management, and OAuth logic."""

import uuid
from datetime import datetime, timedelta
from typing import Any, Callable

from fastapi import HTTPException, status
from jwt.exceptions import ExpiredSignatureError, InvalidTokenError
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.email import send_password_reset_email, send_verification_email
from app.auth.jwt import (
    create_access_token,
    create_email_verification_token,
    create_password_reset_token,
    create_refresh_token,
    decode_token,
)
from app.auth.oauth import get_google_user_info, google_oauth_client
from app.auth.password import hash_password, verify_password
from app.auth.schemas import CookieTokenResponse, MessageResponse
from app.core.config import settings
from app.core.security import audit_logger
from app.models.organization import Organization
from app.models.refresh_token import RefreshToken
from app.models.user import User


async def _create_token_pair(
    db: AsyncSession, user: User,
) -> tuple[str, str]:
    """Create access + refresh token pair and persist the refresh token.

    Returns (access_token, refresh_token).
    """
    refresh_token, jti = create_refresh_token(
        str(user.id), str(user.organization_id),
    )
    expires_at = datetime.utcnow() + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS,
    )
    refresh_token_record = RefreshToken(
        jti=jti,
        user_id=user.id,
        organization_id=user.organization_id,
        expires_at=expires_at,
    )
    db.add(refresh_token_record)

    access_token = create_access_token(str(user.id), str(user.organization_id))
    return access_token, refresh_token


async def register_user(
    db: AsyncSession,
    email: str,
    password: str,
    full_name: str,
    organization_name: str,
) -> tuple[CookieTokenResponse, str, Callable[[], Any]]:
    """Register a new user and organisation.

    Returns (response, refresh_token, verification_email_task).
    The caller should schedule the task via BackgroundTasks and set the cookie.
    """
    # Check if email already exists (case-insensitive, globally unique)
    result = await db.execute(
        select(User).where(func.lower(User.email) == email.lower()),
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Create organization and user in single transaction
    organization = Organization(name=organization_name)
    db.add(organization)
    await db.flush()

    user = User(
        email=email,
        hashed_password=hash_password(password),
        full_name=full_name,
        organization_id=organization.id,
        email_verified=False,
        auth_provider="email",
        is_active=True,
    )
    db.add(user)
    await db.flush()

    access_token, refresh_token = await _create_token_pair(db, user)
    await db.commit()

    # Build verification email task (caller schedules it)
    verification_token = create_email_verification_token(str(user.id), user.email)

    def _email_task() -> None:
        send_verification_email(user.email, verification_token)

    return (
        CookieTokenResponse(access_token=access_token),
        refresh_token,
        _email_task,
    )


async def login_user(
    db: AsyncSession,
    email: str,
    password: str,
) -> tuple[CookieTokenResponse, str]:
    """Authenticate user with email + password.

    Returns (response, refresh_token).
    """
    result = await db.execute(
        select(User).where(func.lower(User.email) == email.lower()),
    )
    user = result.scalar_one_or_none()

    if user is None or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    if user.auth_provider != "email" and user.hashed_password is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please sign in with Google",
        )

    if not user.email_verified:
        grace_period_end = user.created_at + timedelta(hours=48)
        if datetime.utcnow() > grace_period_end:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Email verification required",
            )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled",
        )

    access_token, refresh_token = await _create_token_pair(db, user)
    await db.commit()

    return CookieTokenResponse(access_token=access_token), refresh_token


async def refresh_tokens(
    db: AsyncSession,
    refresh_token_value: str | None,
) -> tuple[CookieTokenResponse, str]:
    """Rotate refresh token and issue new access token.

    Implements reuse-detection: if a JTI is missing (already used), revoke ALL
    tokens for the user (theft mitigation).

    Returns (response, new_refresh_token).
    """
    if not refresh_token_value:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )

    try:
        payload = decode_token(refresh_token_value)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        ) from None

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )

    jti = payload.get("jti")
    user_id = payload.get("sub")
    if not jti or not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )

    # Look up refresh token in database
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.jti == jti),
    )
    token_record = result.scalar_one_or_none()

    # TOKEN THEFT DETECTION
    if token_record is None:
        audit_logger.warning(
            "token_reuse_detected: Refresh token reuse detected for user %s",
            user_id,
        )
        stmt = (
            select(RefreshToken)
            .where(RefreshToken.user_id == uuid.UUID(user_id))
            .where(RefreshToken.revoked.is_(False))
        )
        result = await db.execute(stmt)
        for token in result.scalars().all():
            token.revoked = True
            token.revoked_at = datetime.utcnow()
        await db.commit()

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )

    if token_record.revoked:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )

    if token_record.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )

    # Get user
    result = await db.execute(
        select(User).where(User.id == uuid.UUID(user_id)),
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )

    # Revoke old token
    token_record.revoked = True
    token_record.revoked_at = datetime.utcnow()

    # Issue new pair
    access_token, new_refresh_token = await _create_token_pair(db, user)
    await db.commit()

    return CookieTokenResponse(access_token=access_token), new_refresh_token


async def logout_user(
    db: AsyncSession,
    refresh_token_value: str | None,
) -> MessageResponse:
    """Revoke refresh token. Idempotent — returns success even if token is missing or invalid."""
    if not refresh_token_value:
        return MessageResponse(message="Logged out successfully")

    try:
        payload = decode_token(refresh_token_value)
        jti = payload.get("jti")
    except Exception:
        return MessageResponse(message="Logged out successfully")

    if not jti:
        return MessageResponse(message="Logged out successfully")

    result = await db.execute(
        select(RefreshToken).where(RefreshToken.jti == jti),
    )
    token_record = result.scalar_one_or_none()

    if token_record and not token_record.revoked:
        token_record.revoked = True
        token_record.revoked_at = datetime.utcnow()
        await db.commit()

    return MessageResponse(message="Logged out successfully")


async def verify_email(
    db: AsyncSession,
    token: str,
) -> MessageResponse:
    """Verify user email address using verification token. Idempotent."""
    try:
        payload = decode_token(token)
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification link expired. Request a new one.",
        ) from None
    except InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification link",
        ) from None

    if payload.get("type") != "email_verification":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification link",
        )

    user_id = payload.get("sub")
    email = payload.get("email")
    if not user_id or not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification link",
        )

    result = await db.execute(
        select(User).where(User.id == uuid.UUID(user_id)),
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification link",
        )

    if user.email.lower() != email.lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification link",
        )

    if user.email_verified:
        return MessageResponse(message="Email already verified")

    user.email_verified = True
    user.email_verified_at = datetime.utcnow()
    await db.commit()

    return MessageResponse(message="Email verified successfully")


def build_resend_verification_task(user: User) -> tuple[MessageResponse, Callable[[], Any] | None]:
    """Build resend-verification response and optional email task.

    Returns (response, email_task_or_None). Caller schedules the task if present.
    """
    if user.email_verified:
        return MessageResponse(message="Email already verified"), None

    verification_token = create_email_verification_token(str(user.id), user.email)

    def _task() -> None:
        send_verification_email(user.email, verification_token)

    return MessageResponse(message="Verification email sent"), _task


async def request_password_reset(
    db: AsyncSession,
    email: str,
) -> tuple[MessageResponse, Callable[[], Any] | None]:
    """Request password reset email.

    ALWAYS returns success to prevent enumeration.
    Returns (response, email_task_or_None).
    """
    result = await db.execute(
        select(User).where(func.lower(User.email) == email.lower()),
    )
    user = result.scalar_one_or_none()

    email_task: Callable[[], Any] | None = None
    if user is not None and user.auth_provider == "email":
        reset_token = create_password_reset_token(str(user.id))

        def _task() -> None:
            send_password_reset_email(user.email, reset_token)  # type: ignore[union-attr]

        email_task = _task

    return (
        MessageResponse(message="If the email exists, a reset link has been sent"),
        email_task,
    )


async def confirm_password_reset(
    db: AsyncSession,
    token: str,
    new_password: str,
) -> MessageResponse:
    """Confirm password reset. Revokes all refresh tokens for the user (force re-login)."""
    try:
        payload = decode_token(token)
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset link expired. Request a new one.",
        ) from None
    except InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid reset link",
        ) from None

    if payload.get("type") != "password_reset":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid reset link",
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid reset link",
        )

    result = await db.execute(
        select(User).where(User.id == uuid.UUID(user_id)),
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid reset link",
        )

    user.hashed_password = hash_password(new_password)

    stmt = (
        select(RefreshToken)
        .where(RefreshToken.user_id == user.id)
        .where(RefreshToken.revoked.is_(False))
    )
    result = await db.execute(stmt)
    for token_rec in result.scalars().all():
        token_rec.revoked = True
        token_rec.revoked_at = datetime.utcnow()

    await db.commit()

    return MessageResponse(message="Password reset successfully")


async def get_google_auth_url() -> str:
    """Return Google OAuth authorization URL. Raises 501 if not configured."""
    if google_oauth_client is None:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Google OAuth not configured",
        )

    redirect_uri = f"{settings.FRONTEND_URL}/auth/google/callback"
    return await google_oauth_client.get_authorization_url(
        redirect_uri=redirect_uri,
        scope=["email", "profile"],
    )


async def google_callback(
    db: AsyncSession,
    code: str,
    redirect_uri: str,
) -> tuple[CookieTokenResponse, str]:
    """Handle Google OAuth callback. Returns (response, refresh_token)."""
    if google_oauth_client is None:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Google OAuth not configured",
        )

    # Exchange code for access token
    try:
        token = await google_oauth_client.get_access_token(code, redirect_uri)
        access_token_str = token["access_token"]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to exchange authorization code: {e!s}",
        ) from e

    # Fetch user info from Google
    try:
        google_user = await get_google_user_info(access_token_str)
        email = google_user.get("email")
        name = google_user.get("name")
        google_id = google_user.get("id")

        if not email or not google_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to fetch user email from Google",
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to fetch user info from Google: {e!s}",
        ) from e

    # Check if user exists by email
    result = await db.execute(
        select(User).where(func.lower(User.email) == email.lower()),
    )
    existing_user = result.scalar_one_or_none()

    if existing_user:
        if existing_user.auth_provider == "google":
            user = existing_user
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered with email/password. Please sign in with your password.",
            )
    else:
        organization = Organization(name=name or email.split("@")[0])
        db.add(organization)
        await db.flush()

        user = User(
            email=email,
            hashed_password=None,
            full_name=name,
            organization_id=organization.id,
            email_verified=True,
            auth_provider="google",
            google_id=google_id,
            is_active=True,
        )
        db.add(user)
        await db.flush()

    access_token, refresh_token = await _create_token_pair(db, user)
    await db.commit()

    return CookieTokenResponse(access_token=access_token), refresh_token
