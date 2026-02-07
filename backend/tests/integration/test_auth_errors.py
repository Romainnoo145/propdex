"""Integration tests for auth error cases and security features."""

import uuid
from datetime import datetime, timedelta

import jwt as jwt_module
import pytest
from httpx import AsyncClient

from app.auth.jwt import create_email_verification_token, create_password_reset_token
from app.core.config import settings


@pytest.mark.parametrize(
    "email,password,expected_status,expected_detail",
    [
        ("wrong@example.com", "TestPass123!", 401, "Incorrect email or password"),
        ("test@example.com", "WrongPass!", 401, "Incorrect email or password"),
    ],
)
async def test_login_invalid_credentials(
    async_client: AsyncClient,
    create_test_user,
    email: str,
    password: str,
    expected_status: int,
    expected_detail: str,
):
    """Test login with invalid credentials returns same error (prevents enumeration)."""
    # Create test user with known credentials
    await create_test_user(email="test@example.com", password="TestPass123!")

    # Attempt login with invalid credentials
    response = await async_client.post(
        "/auth/login",
        json={"email": email, "password": password},
    )

    assert response.status_code == expected_status
    assert expected_detail in response.json()["detail"]


async def test_register_duplicate_email(async_client: AsyncClient):
    """Test that registering with duplicate email returns 400."""
    # Register first user
    first_response = await async_client.post(
        "/auth/register",
        json={
            "email": "duplicate@example.com",
            "password": "FirstPass123!",
            "full_name": "First User",
            "organization_name": "First Org",
        },
    )
    assert first_response.status_code == 201

    # Try to register again with same email
    second_response = await async_client.post(
        "/auth/register",
        json={
            "email": "duplicate@example.com",
            "password": "SecondPass123!",
            "full_name": "Second User",
            "organization_name": "Second Org",
        },
    )

    assert second_response.status_code == 400
    assert "Email already registered" in second_response.json()["detail"]


async def test_register_short_password(async_client: AsyncClient):
    """Test that registration with short password returns 422."""
    response = await async_client.post(
        "/auth/register",
        json={
            "email": "shortpass@example.com",
            "password": "short",  # Less than 8 characters
            "full_name": "Short Pass User",
            "organization_name": "Short Pass Org",
        },
    )

    assert response.status_code == 422  # Pydantic validation error


async def test_register_invalid_email(async_client: AsyncClient):
    """Test that registration with invalid email returns 422."""
    response = await async_client.post(
        "/auth/register",
        json={
            "email": "not-an-email",  # Invalid email format
            "password": "ValidPass123!",
            "full_name": "Invalid Email User",
            "organization_name": "Invalid Email Org",
        },
    )

    assert response.status_code == 422  # Pydantic validation error


async def test_register_missing_organization_name(async_client: AsyncClient):
    """Test that registration without organization_name returns 422."""
    response = await async_client.post(
        "/auth/register",
        json={
            "email": "noorg@example.com",
            "password": "ValidPass123!",
            "full_name": "No Org User",
            # organization_name missing
        },
    )

    assert response.status_code == 422  # Pydantic validation error


async def test_refresh_token_reuse_detection(async_client: AsyncClient):
    """Test that refresh token reuse returns 401 (token already revoked)."""
    # Register to get tokens
    register_response = await async_client.post(
        "/auth/register",
        json={
            "email": "reusetest@example.com",
            "password": "ReusePass123!",
            "full_name": "Reuse Test User",
            "organization_name": "Reuse Test Org",
        },
    )
    assert register_response.status_code == 201
    original_refresh_token = register_response.json()["refresh_token"]

    # Refresh once (revokes original_refresh_token, creates new tokens)
    first_refresh_response = await async_client.post(
        "/auth/refresh",
        json={"refresh_token": original_refresh_token},
    )
    assert first_refresh_response.status_code == 200
    new_refresh_token = first_refresh_response.json()["refresh_token"]

    # Try to reuse the OLD token (should fail - token is revoked)
    reuse_response = await async_client.post(
        "/auth/refresh",
        json={"refresh_token": original_refresh_token},
    )
    assert reuse_response.status_code == 401

    # Verify the NEW refresh token still works (not affected)
    new_token_response = await async_client.post(
        "/auth/refresh",
        json={"refresh_token": new_refresh_token},
    )
    assert new_token_response.status_code == 200  # New token still valid


async def test_access_token_expired_returns_401(async_client: AsyncClient):
    """Test that expired access token returns 401."""
    # Create an expired access token manually
    payload = {
        "sub": str(uuid.uuid4()),
        "organization_id": str(uuid.uuid4()),
        "type": "access",
        "exp": datetime.utcnow() - timedelta(minutes=1),  # Expired 1 minute ago
    }
    expired_token = jwt_module.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

    # Try to use expired token
    response = await async_client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {expired_token}"},
    )

    assert response.status_code == 401


async def test_refresh_token_used_as_access_returns_401(async_client: AsyncClient):
    """Test that using refresh token as access token returns 401."""
    # Register to get tokens
    register_response = await async_client.post(
        "/auth/register",
        json={
            "email": "wrongtype@example.com",
            "password": "WrongTypePass123!",
            "full_name": "Wrong Type User",
            "organization_name": "Wrong Type Org",
        },
    )
    assert register_response.status_code == 201
    refresh_token = register_response.json()["refresh_token"]

    # Try to use refresh token as Bearer token for /me endpoint
    response = await async_client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {refresh_token}"},
    )

    assert response.status_code == 401  # Token type mismatch


async def test_login_blocked_after_grace_period(async_client: AsyncClient, create_test_user, test_db):
    """Test that login is blocked after 48h grace period for unverified email."""
    # Create user with email_verified=False
    user, org = await create_test_user(
        email="graceperiod@example.com",
        password="GracePass123!",
        email_verified=False,
    )

    # Manually set created_at to 3 days ago (past 48h grace period)
    user.created_at = datetime.utcnow() - timedelta(days=3)
    await test_db.commit()

    # Attempt login (should be blocked)
    response = await async_client.post(
        "/auth/login",
        json={
            "email": "graceperiod@example.com",
            "password": "GracePass123!",
        },
    )

    assert response.status_code == 403
    assert "Email verification required" in response.json()["detail"]


async def test_login_disabled_user_returns_403(async_client: AsyncClient, create_test_user):
    """Test that disabled user cannot login."""
    # Create disabled user
    await create_test_user(
        email="disabled@example.com",
        password="DisabledPass123!",
        is_active=False,
    )

    # Attempt login
    response = await async_client.post(
        "/auth/login",
        json={
            "email": "disabled@example.com",
            "password": "DisabledPass123!",
        },
    )

    assert response.status_code == 403
    assert "User account is disabled" in response.json()["detail"]


async def test_password_reset_request_unknown_email_still_200(async_client: AsyncClient):
    """Test that password reset request with unknown email returns 200 (prevents enumeration)."""
    response = await async_client.post(
        "/auth/password-reset/request",
        json={"email": "unknown@example.com"},
    )

    # Always returns 200 to prevent user enumeration
    assert response.status_code == 200
    assert "If the email exists" in response.json()["message"]


async def test_password_reset_expired_token(async_client: AsyncClient, create_test_user):
    """Test that expired password reset token returns 400."""
    # Create user
    user, org = await create_test_user(email="resetexpired@example.com")

    # Create expired reset token manually
    payload = {
        "sub": str(user.id),
        "type": "password_reset",
        "exp": datetime.utcnow() - timedelta(minutes=1),  # Expired
    }
    expired_token = jwt_module.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

    # Try to reset password with expired token
    response = await async_client.post(
        "/auth/password-reset/confirm",
        json={
            "token": expired_token,
            "new_password": "NewPass123!",
        },
    )

    assert response.status_code == 400
    assert "expired" in response.json()["detail"].lower()


async def test_password_reset_revokes_all_sessions(async_client: AsyncClient, create_test_user):
    """Test that password reset revokes all refresh tokens (all sessions)."""
    # Create user and get initial tokens
    user, org = await create_test_user(email="resetsessions@example.com", password="OldPass123!")

    # Login to get first refresh token
    login1_response = await async_client.post(
        "/auth/login",
        json={"email": "resetsessions@example.com", "password": "OldPass123!"},
    )
    assert login1_response.status_code == 200
    refresh_token_1 = login1_response.json()["refresh_token"]

    # Login again to get second refresh token (simulating multiple devices)
    login2_response = await async_client.post(
        "/auth/login",
        json={"email": "resetsessions@example.com", "password": "OldPass123!"},
    )
    assert login2_response.status_code == 200
    refresh_token_2 = login2_response.json()["refresh_token"]

    # Reset password
    reset_token = create_password_reset_token(str(user.id))
    reset_response = await async_client.post(
        "/auth/password-reset/confirm",
        json={
            "token": reset_token,
            "new_password": "NewPass123!",
        },
    )
    assert reset_response.status_code == 200

    # Verify both refresh tokens are now invalid
    refresh1_response = await async_client.post(
        "/auth/refresh",
        json={"refresh_token": refresh_token_1},
    )
    assert refresh1_response.status_code == 401

    refresh2_response = await async_client.post(
        "/auth/refresh",
        json={"refresh_token": refresh_token_2},
    )
    assert refresh2_response.status_code == 401


async def test_verify_email_expired_token(async_client: AsyncClient, create_test_user):
    """Test that expired email verification token returns 400."""
    # Create user
    user, org = await create_test_user(email="verifyexpired@example.com")

    # Create expired verification token manually
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "type": "email_verification",
        "exp": datetime.utcnow() - timedelta(hours=1),  # Expired
    }
    expired_token = jwt_module.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

    # Try to verify email with expired token
    response = await async_client.post(
        "/auth/verify-email",
        json={"token": expired_token},
    )

    assert response.status_code == 400
    assert "expired" in response.json()["detail"].lower()


async def test_verify_email_invalid_token(async_client: AsyncClient):
    """Test that invalid verification token returns 400."""
    response = await async_client.post(
        "/auth/verify-email",
        json={"token": "garbage-invalid-token"},
    )

    assert response.status_code == 400


async def test_logout_invalid_token_still_200(async_client: AsyncClient):
    """Test that logout with invalid token returns 200 (idempotent)."""
    response = await async_client.post(
        "/auth/logout",
        json={"refresh_token": "invalid-garbage-token"},
    )

    # Logout is idempotent - always returns 200
    assert response.status_code == 200
    assert response.json()["message"] == "Logged out successfully"


async def test_logout_already_revoked_still_200(async_client: AsyncClient):
    """Test that logout with already-revoked token returns 200 (idempotent)."""
    # Register to get token
    register_response = await async_client.post(
        "/auth/register",
        json={
            "email": "logouttwice@example.com",
            "password": "LogoutTwicePass123!",
            "full_name": "Logout Twice User",
            "organization_name": "Logout Twice Org",
        },
    )
    assert register_response.status_code == 201
    refresh_token = register_response.json()["refresh_token"]

    # Logout once
    first_logout = await async_client.post(
        "/auth/logout",
        json={"refresh_token": refresh_token},
    )
    assert first_logout.status_code == 200

    # Logout again with same token (already revoked)
    second_logout = await async_client.post(
        "/auth/logout",
        json={"refresh_token": refresh_token},
    )

    # Still returns 200 (idempotent)
    assert second_logout.status_code == 200
    assert second_logout.json()["message"] == "Logged out successfully"
