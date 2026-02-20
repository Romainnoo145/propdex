"""Authentication router with register, login, refresh, logout, and me endpoints."""

import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response, status
from jwt.exceptions import ExpiredSignatureError, InvalidTokenError
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_active_user
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
from app.auth.schemas import (
    CookieTokenResponse,
    EmailVerifyRequest,
    LoginRequest,
    MessageResponse,
    PasswordResetConfirm,
    PasswordResetRequest,
    UserCreate,
    UserResponse,
)
from app.core.config import settings
from app.core.database import get_db
from app.middleware.rate_limit import limiter
from app.models.organization import Organization
from app.models.refresh_token import RefreshToken
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    """Set httpOnly refresh token cookie for secure storage."""
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,  # Allow HTTP in development (localhost)
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path="/api/auth",  # Only send cookie to auth endpoints
    )


def _clear_refresh_cookie(response: Response) -> None:
    """Clear the refresh token cookie on logout."""
    response.delete_cookie(key="refresh_token", path="/api/auth")


@router.post("/register", response_model=CookieTokenResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("3/hour")
async def register(
    request: Request,
    response: Response,
    user_data: UserCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> CookieTokenResponse:
    """
    Register a new user and create their organization.

    Creates both organization and user in a single transaction.
    Returns JWT access + refresh token pair immediately.

    Email verification is NOT enforced at registration - user gets 48h grace period.
    Verification email is sent in background.
    """
    # Check if email already exists (case-insensitive, globally unique)
    result = await db.execute(
        select(User).where(func.lower(User.email) == user_data.email.lower())
    )
    existing_user = result.scalar_one_or_none()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Create organization and user in single transaction
    # Create organization
    organization = Organization(name=user_data.organization_name)
    db.add(organization)
    await db.flush()  # Get organization.id

    # Create user with hashed password
    user = User(
        email=user_data.email,
        hashed_password=hash_password(user_data.password),
        full_name=user_data.full_name,
        organization_id=organization.id,
        email_verified=False,
        auth_provider="email",
        is_active=True,
    )
    db.add(user)
    await db.flush()  # Get user.id

    # Create refresh token
    refresh_token, jti = create_refresh_token(
        str(user.id), str(user.organization_id)
    )
    expires_at = datetime.utcnow() + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    refresh_token_record = RefreshToken(
        jti=jti,
        user_id=user.id,
        organization_id=user.organization_id,
        expires_at=expires_at,
    )
    db.add(refresh_token_record)

    # Commit transaction
    await db.commit()

    # Create access token
    access_token = create_access_token(str(user.id), str(user.organization_id))

    # Send verification email in background
    verification_token = create_email_verification_token(str(user.id), user.email)
    background_tasks.add_task(send_verification_email, user.email, verification_token)

    # Set refresh token in httpOnly cookie
    _set_refresh_cookie(response, refresh_token)

    return CookieTokenResponse(
        access_token=access_token,
    )


@router.post("/login", response_model=CookieTokenResponse)
@limiter.limit("10/minute")
async def login(
    request: Request,
    response: Response,
    credentials: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> CookieTokenResponse:
    """
    Authenticate user with email and password.

    Returns JWT access + refresh token pair.
    Enforces 48h grace period for email verification.
    """
    # Find user by email (case-insensitive)
    result = await db.execute(
        select(User).where(func.lower(User.email) == credentials.email.lower())
    )
    user = result.scalar_one_or_none()

    # Verify password (generic error message prevents enumeration)
    if user is None or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    # Check if user has password set (OAuth users might not)
    if user.auth_provider != "email" and user.hashed_password is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please sign in with Google",
        )

    # Check email verification grace period (48 hours)
    if not user.email_verified:
        grace_period_end = user.created_at + timedelta(hours=48)
        if datetime.utcnow() > grace_period_end:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Email verification required",
            )

    # Check if user is active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled",
        )

    # Create refresh token
    refresh_token, jti = create_refresh_token(
        str(user.id), str(user.organization_id)
    )
    expires_at = datetime.utcnow() + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    refresh_token_record = RefreshToken(
        jti=jti,
        user_id=user.id,
        organization_id=user.organization_id,
        expires_at=expires_at,
    )
    db.add(refresh_token_record)
    await db.commit()

    # Create access token
    access_token = create_access_token(str(user.id), str(user.organization_id))

    # Set refresh token in httpOnly cookie
    _set_refresh_cookie(response, refresh_token)

    return CookieTokenResponse(
        access_token=access_token,
    )


@router.post("/refresh", response_model=CookieTokenResponse)
@limiter.limit("60/minute")
async def refresh(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> CookieTokenResponse:
    """
    Refresh access token using refresh token from httpOnly cookie.

    Implements token rotation:
    - Old refresh token is revoked
    - New refresh token is issued
    - Reuse detection triggers full token revocation (security feature)
    """
    # Read refresh token from httpOnly cookie
    refresh_token_value = request.cookies.get("refresh_token")
    if not refresh_token_value:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )

    # Decode refresh token
    try:
        payload = decode_token(refresh_token_value)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )

    # Verify token type
    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )

    # Extract JTI and user_id
    jti = payload.get("jti")
    user_id = payload.get("sub")
    if not jti or not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )

    # Look up refresh token in database
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.jti == jti)
    )
    token_record = result.scalar_one_or_none()

    # TOKEN THEFT DETECTION: JTI not found means token was already used
    if token_record is None:
        # This is a security incident - revoke ALL user tokens
        print(f"SECURITY WARNING: Refresh token reuse detected for user {user_id}")
        # Revoke all non-revoked tokens for this user
        stmt = (
            select(RefreshToken)
            .where(RefreshToken.user_id == uuid.UUID(user_id))
            .where(RefreshToken.revoked == False)
        )
        result = await db.execute(stmt)
        tokens_to_revoke = result.scalars().all()
        for token in tokens_to_revoke:
            token.revoked = True
            token.revoked_at = datetime.utcnow()
        await db.commit()

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )

    # Check if token is revoked or expired
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

    # Get user for organization_id
    result = await db.execute(
        select(User).where(User.id == uuid.UUID(user_id))
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

    # Create new refresh token
    new_refresh_token, new_jti = create_refresh_token(
        str(user.id), str(user.organization_id)
    )
    expires_at = datetime.utcnow() + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    new_token_record = RefreshToken(
        jti=new_jti,
        user_id=user.id,
        organization_id=user.organization_id,
        expires_at=expires_at,
    )
    db.add(new_token_record)
    await db.commit()

    # Create new access token
    access_token = create_access_token(str(user.id), str(user.organization_id))

    # Set new refresh token in httpOnly cookie
    _set_refresh_cookie(response, new_refresh_token)

    return CookieTokenResponse(
        access_token=access_token,
    )


@router.post("/logout", response_model=MessageResponse)
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """
    Logout user by revoking refresh token from httpOnly cookie.

    Idempotent - returns success even if token already revoked or no cookie present.
    """
    # Read refresh token from httpOnly cookie
    refresh_token_value = request.cookies.get("refresh_token")

    # Clear the cookie regardless of whether we process a token
    _clear_refresh_cookie(response)

    # If no cookie, return success (already logged out)
    if not refresh_token_value:
        return MessageResponse(message="Logged out successfully")

    # Decode refresh token (be graceful - if invalid, just return success)
    try:
        payload = decode_token(refresh_token_value)
        jti = payload.get("jti")
    except Exception:
        # Invalid token - consider it already logged out
        return MessageResponse(message="Logged out successfully")

    if not jti:
        return MessageResponse(message="Logged out successfully")

    # Find and revoke token
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.jti == jti)
    )
    token_record = result.scalar_one_or_none()

    if token_record and not token_record.revoked:
        token_record.revoked = True
        token_record.revoked_at = datetime.utcnow()
        await db.commit()

    return MessageResponse(message="Logged out successfully")


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_active_user),
) -> UserResponse:
    """
    Get current authenticated user info.

    Serves as "am I still logged in?" check for frontend.
    """
    return UserResponse.model_validate(current_user)


@router.post("/verify-email", response_model=MessageResponse)
async def verify_email(
    verify_data: EmailVerifyRequest,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """
    Verify user's email address using verification token.

    Idempotent - returns success if already verified.
    """
    # Decode and validate token
    try:
        payload = decode_token(verify_data.token)
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification link expired. Request a new one.",
        )
    except InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification link",
        )

    # Verify token type
    if payload.get("type") != "email_verification":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification link",
        )

    # Extract user_id and email from token
    user_id = payload.get("sub")
    email = payload.get("email")
    if not user_id or not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification link",
        )

    # Find user
    result = await db.execute(
        select(User).where(User.id == uuid.UUID(user_id))
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification link",
        )

    # Verify email matches (security check)
    if user.email.lower() != email.lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification link",
        )

    # If already verified, return success (idempotent)
    if user.email_verified:
        return MessageResponse(message="Email already verified")

    # Mark email as verified
    user.email_verified = True
    user.email_verified_at = datetime.utcnow()
    await db.commit()

    return MessageResponse(message="Email verified successfully")


@router.post("/resend-verification", response_model=MessageResponse)
@limiter.limit("3/hour")
async def resend_verification(
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_active_user),
) -> MessageResponse:
    """
    Resend email verification link to authenticated user.

    Requires authentication. Idempotent if already verified.
    """
    # If already verified, return success
    if current_user.email_verified:
        return MessageResponse(message="Email already verified")

    # Create new verification token and send email
    verification_token = create_email_verification_token(
        str(current_user.id), current_user.email
    )
    background_tasks.add_task(send_verification_email, current_user.email, verification_token)

    return MessageResponse(message="Verification email sent")


@router.post("/password-reset/request", response_model=MessageResponse)
@limiter.limit("3/hour")
async def request_password_reset(
    request: Request,
    reset_request: PasswordResetRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """
    Request password reset email.

    ALWAYS returns success to prevent user enumeration.
    Only sends email if user exists and uses email authentication.
    """
    # Look up user by email (case-insensitive)
    result = await db.execute(
        select(User).where(func.lower(User.email) == reset_request.email.lower())
    )
    user = result.scalar_one_or_none()

    # If user exists and uses email auth, send reset email
    if user is not None and user.auth_provider == "email":
        reset_token = create_password_reset_token(str(user.id))
        background_tasks.add_task(send_password_reset_email, user.email, reset_token)

    # ALWAYS return success (prevent enumeration)
    return MessageResponse(message="If the email exists, a reset link has been sent")


@router.post("/password-reset/confirm", response_model=MessageResponse)
async def confirm_password_reset(
    reset_confirm: PasswordResetConfirm,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """
    Confirm password reset and set new password.

    Revokes all refresh tokens for security (forces re-login everywhere).
    """
    # Decode and validate token
    try:
        payload = decode_token(reset_confirm.token)
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset link expired. Request a new one.",
        )
    except InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid reset link",
        )

    # Verify token type
    if payload.get("type") != "password_reset":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid reset link",
        )

    # Extract user_id
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid reset link",
        )

    # Find user
    result = await db.execute(
        select(User).where(User.id == uuid.UUID(user_id))
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid reset link",
        )

    # Update password
    user.hashed_password = hash_password(reset_confirm.new_password)

    # Revoke ALL refresh tokens for this user (security: force re-login everywhere)
    stmt = (
        select(RefreshToken)
        .where(RefreshToken.user_id == user.id)
        .where(RefreshToken.revoked == False)
    )
    result = await db.execute(stmt)
    tokens_to_revoke = result.scalars().all()
    for token in tokens_to_revoke:
        token.revoked = True
        token.revoked_at = datetime.utcnow()

    await db.commit()

    return MessageResponse(message="Password reset successfully")


# Google OAuth schemas
class GoogleAuthUrlResponse(BaseModel):
    """Response schema for Google OAuth authorization URL."""

    authorization_url: str


class GoogleCallbackRequest(BaseModel):
    """Request schema for Google OAuth callback."""

    code: str
    redirect_uri: str


@router.get("/google", response_model=GoogleAuthUrlResponse)
@limiter.limit("10/minute")
async def google_auth_url(
    request: Request,
) -> GoogleAuthUrlResponse:
    """
    Get Google OAuth authorization URL.

    Returns authorization URL for frontend to redirect user.
    Returns 501 if Google OAuth is not configured.
    """
    if google_oauth_client is None:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Google OAuth not configured",
        )

    # Generate authorization URL
    redirect_uri = f"{settings.FRONTEND_URL}/auth/google/callback"
    authorization_url = await google_oauth_client.get_authorization_url(
        redirect_uri=redirect_uri,
        scope=["email", "profile"],
    )

    return GoogleAuthUrlResponse(authorization_url=authorization_url)


@router.post("/google/callback", response_model=CookieTokenResponse)
@limiter.limit("10/minute")
async def google_callback(
    request: Request,
    response: Response,
    callback_data: GoogleCallbackRequest,
    db: AsyncSession = Depends(get_db),
) -> CookieTokenResponse:
    """
    Handle Google OAuth callback.

    Exchanges authorization code for access token, fetches user info,
    and either logs in existing user or creates new user + organization.

    Does NOT auto-link email accounts (returns error if email exists with different provider).
    """
    if google_oauth_client is None:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Google OAuth not configured",
        )

    # Exchange code for access token
    try:
        token = await google_oauth_client.get_access_token(
            callback_data.code,
            callback_data.redirect_uri,
        )
        access_token = token["access_token"]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to exchange authorization code: {str(e)}",
        )

    # Fetch user info from Google
    try:
        google_user = await get_google_user_info(access_token)
        email = google_user.get("email")
        name = google_user.get("name")
        google_id = google_user.get("id")

        if not email or not google_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to fetch user email from Google",
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to fetch user info from Google: {str(e)}",
        )

    # Check if user exists by email
    result = await db.execute(
        select(User).where(func.lower(User.email) == email.lower())
    )
    existing_user = result.scalar_one_or_none()

    if existing_user:
        # User exists - check auth provider
        if existing_user.auth_provider == "google":
            # Google user logging in - return tokens
            user = existing_user
        else:
            # Email exists with different provider (email/password)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered with email/password. Please sign in with your password.",
            )
    else:
        # New user - create organization and user
        organization = Organization(name=name or email.split("@")[0])
        db.add(organization)
        await db.flush()

        user = User(
            email=email,
            hashed_password=None,  # No password for OAuth users
            full_name=name,
            organization_id=organization.id,
            email_verified=True,  # Google already verified email
            auth_provider="google",
            google_id=google_id,
            is_active=True,
        )
        db.add(user)
        await db.flush()

    # Create refresh token
    refresh_token, jti = create_refresh_token(
        str(user.id), str(user.organization_id)
    )
    expires_at = datetime.utcnow() + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    refresh_token_record = RefreshToken(
        jti=jti,
        user_id=user.id,
        organization_id=user.organization_id,
        expires_at=expires_at,
    )
    db.add(refresh_token_record)
    await db.commit()

    # Create access token
    access_token_jwt = create_access_token(str(user.id), str(user.organization_id))

    # Set refresh token in httpOnly cookie
    _set_refresh_cookie(response, refresh_token)

    return CookieTokenResponse(
        access_token=access_token_jwt,
    )
