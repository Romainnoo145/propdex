"""Authentication router with register, login, refresh, logout, and me endpoints."""

from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.auth_service import (
    build_resend_verification_task,
    confirm_password_reset,
    get_google_auth_url,
    google_callback as google_callback_service,
    login_user,
    logout_user,
    refresh_tokens,
    register_user,
    request_password_reset,
    verify_email,
)
from app.auth.dependencies import get_current_active_user
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
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["Auth"])


# ---------------------------------------------------------------------------
# Cookie helpers (HTTP-layer concern — stays in router)
# ---------------------------------------------------------------------------

def _refresh_cookie_options() -> dict[str, object]:
    """Shared refresh-cookie settings for set and clear operations."""
    options: dict[str, object] = {
        "httponly": True,
        "secure": settings.cookie_secure,
        "samesite": settings.cookie_samesite,
        "path": settings.auth_cookie_path,
    }
    if settings.cookie_domain:
        options["domain"] = settings.cookie_domain
    return options


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    """Set httpOnly refresh token cookie for secure storage."""
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        **_refresh_cookie_options(),
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
    )


def _clear_refresh_cookie(response: Response) -> None:
    """Clear the refresh token cookie on logout."""
    response.delete_cookie(
        key="refresh_token",
        path=settings.auth_cookie_path,
        domain=settings.cookie_domain,
        secure=settings.cookie_secure,
        httponly=True,
        samesite=settings.cookie_samesite,
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/register", response_model=CookieTokenResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("3/hour")
async def register(
    request: Request,
    response: Response,
    user_data: UserCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> CookieTokenResponse:
    """Register a new user and create their organization."""
    result, refresh_token, email_task = await register_user(
        db,
        email=user_data.email,
        password=user_data.password,
        full_name=user_data.full_name,
        organization_name=user_data.organization_name,
    )
    _set_refresh_cookie(response, refresh_token)
    background_tasks.add_task(email_task)
    return result


@router.post("/login", response_model=CookieTokenResponse)
@limiter.limit("10/minute")
async def login(
    request: Request,
    response: Response,
    credentials: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> CookieTokenResponse:
    """Authenticate user with email and password."""
    result, refresh_token = await login_user(db, credentials.email, credentials.password)
    _set_refresh_cookie(response, refresh_token)
    return result


@router.post("/refresh", response_model=CookieTokenResponse)
@limiter.limit("60/minute")
async def refresh(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> CookieTokenResponse:
    """Refresh access token using refresh token from httpOnly cookie."""
    refresh_token_value = request.cookies.get("refresh_token")
    result, new_refresh_token = await refresh_tokens(db, refresh_token_value)
    _set_refresh_cookie(response, new_refresh_token)
    return result


@router.post("/logout", response_model=MessageResponse)
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """Logout user by revoking refresh token from httpOnly cookie."""
    refresh_token_value = request.cookies.get("refresh_token")
    _clear_refresh_cookie(response)
    return await logout_user(db, refresh_token_value)


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_active_user),
) -> UserResponse:
    """Get current authenticated user info."""
    return UserResponse.model_validate(current_user)


@router.post("/verify-email", response_model=MessageResponse)
async def verify_email_endpoint(
    verify_data: EmailVerifyRequest,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """Verify user's email address using verification token."""
    return await verify_email(db, verify_data.token)


@router.post("/resend-verification", response_model=MessageResponse)
@limiter.limit("3/hour")
async def resend_verification(
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_active_user),
) -> MessageResponse:
    """Resend email verification link to authenticated user."""
    result, email_task = build_resend_verification_task(current_user)
    if email_task:
        background_tasks.add_task(email_task)
    return result


@router.post("/password-reset/request", response_model=MessageResponse)
@limiter.limit("3/hour")
async def request_password_reset_endpoint(
    request: Request,
    reset_request: PasswordResetRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """Request password reset email. Always returns success to prevent enumeration."""
    result, email_task = await request_password_reset(db, reset_request.email)
    if email_task:
        background_tasks.add_task(email_task)
    return result


@router.post("/password-reset/confirm", response_model=MessageResponse)
async def confirm_password_reset_endpoint(
    reset_confirm: PasswordResetConfirm,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """Confirm password reset and set new password."""
    return await confirm_password_reset(db, reset_confirm.token, reset_confirm.new_password)


# ---------------------------------------------------------------------------
# Google OAuth
# ---------------------------------------------------------------------------

class GoogleAuthUrlResponse(BaseModel):
    """Response schema for Google OAuth authorization URL."""
    authorization_url: str


class GoogleCallbackRequest(BaseModel):
    """Request schema for Google OAuth callback."""
    code: str
    redirect_uri: str


@router.get("/google", response_model=GoogleAuthUrlResponse)
@limiter.limit("10/minute")
async def google_auth_url(request: Request) -> GoogleAuthUrlResponse:
    """Get Google OAuth authorization URL."""
    url = await get_google_auth_url()
    return GoogleAuthUrlResponse(authorization_url=url)


@router.post("/google/callback", response_model=CookieTokenResponse)
@limiter.limit("10/minute")
async def google_callback_endpoint(
    request: Request,
    response: Response,
    callback_data: GoogleCallbackRequest,
    db: AsyncSession = Depends(get_db),
) -> CookieTokenResponse:
    """Handle Google OAuth callback."""
    result, refresh_token = await google_callback_service(
        db, callback_data.code, callback_data.redirect_uri,
    )
    _set_refresh_cookie(response, refresh_token)
    return result
