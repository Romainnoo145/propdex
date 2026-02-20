"""Integration tests for auth happy-path flows."""

from httpx import AsyncClient

from app.auth.jwt import create_email_verification_token, create_password_reset_token, decode_token


def _extract_refresh_cookie(response) -> str:
    """Extract refresh_token value from Set-Cookie header."""
    for header_value in response.headers.get_list("set-cookie"):
        if header_value.startswith("refresh_token="):
            # Extract value between = and first ;
            return header_value.split("=", 1)[1].split(";")[0]
    raise AssertionError("No refresh_token cookie in response")


async def test_register_success(async_client: AsyncClient):
    """Test successful user registration."""
    response = await async_client.post(
        "/auth/register",
        json={
            "email": "newuser@example.com",
            "password": "SecurePass123!",
            "full_name": "New User",
            "organization_name": "New Organization",
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" not in data  # refresh_token is in httpOnly cookie only
    assert data["token_type"] == "bearer"

    # Verify refresh_token is set as a cookie
    refresh_token = _extract_refresh_cookie(response)
    assert refresh_token  # cookie must be present

    # Verify access token contains correct claims
    payload = decode_token(data["access_token"])
    assert "sub" in payload  # user_id
    assert "organization_id" in payload
    assert payload["type"] == "access"


async def test_register_creates_organization(async_client: AsyncClient):
    """Test that registration creates organization and links user."""
    # Register user
    response = await async_client.post(
        "/auth/register",
        json={
            "email": "orgtest@example.com",
            "password": "SecurePass123!",
            "full_name": "Org Test User",
            "organization_name": "Test Organization Inc.",
        },
    )

    assert response.status_code == 201
    access_token = response.json()["access_token"]

    # Verify user has organization_id
    me_response = await async_client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )

    assert me_response.status_code == 200
    me_data = me_response.json()
    assert me_data["organization_id"] is not None
    assert me_data["email"] == "orgtest@example.com"


async def test_login_success(async_client: AsyncClient):
    """Test successful login with correct credentials."""
    # Register user first
    register_response = await async_client.post(
        "/auth/register",
        json={
            "email": "logintest@example.com",
            "password": "LoginPass123!",
            "full_name": "Login Test User",
            "organization_name": "Login Test Org",
        },
    )
    assert register_response.status_code == 201

    # Login with same credentials
    login_response = await async_client.post(
        "/auth/login",
        json={
            "email": "logintest@example.com",
            "password": "LoginPass123!",
        },
    )

    assert login_response.status_code == 200
    data = login_response.json()
    assert "access_token" in data
    assert "refresh_token" not in data  # refresh_token is in httpOnly cookie only
    assert data["token_type"] == "bearer"

    # Verify refresh_token cookie is set
    refresh_token = _extract_refresh_cookie(login_response)
    assert refresh_token


async def test_login_case_insensitive_email(async_client: AsyncClient):
    """Test that login is case-insensitive for email."""
    # Register with mixed case
    register_response = await async_client.post(
        "/auth/register",
        json={
            "email": "Test@Example.com",
            "password": "CaseTest123!",
            "full_name": "Case Test User",
            "organization_name": "Case Test Org",
        },
    )
    assert register_response.status_code == 201

    # Login with lowercase email
    login_response = await async_client.post(
        "/auth/login",
        json={
            "email": "test@example.com",
            "password": "CaseTest123!",
        },
    )

    assert login_response.status_code == 200


async def test_refresh_token_rotation(async_client: AsyncClient):
    """Test that token refresh rotates both access and refresh tokens."""
    # Register to get initial tokens
    register_response = await async_client.post(
        "/auth/register",
        json={
            "email": "refreshtest@example.com",
            "password": "RefreshPass123!",
            "full_name": "Refresh Test User",
            "organization_name": "Refresh Test Org",
        },
    )
    assert register_response.status_code == 201
    original_access_token = register_response.json()["access_token"]
    original_refresh_token = _extract_refresh_cookie(register_response)

    # Refresh tokens — send refresh_token via cookie (explicit, path may not match)
    refresh_response = await async_client.post(
        "/auth/refresh",
        cookies={"refresh_token": original_refresh_token},
    )

    assert refresh_response.status_code == 200
    data = refresh_response.json()
    new_access_token = data["access_token"]
    new_refresh_token = _extract_refresh_cookie(refresh_response)

    # Verify tokens are different (rotated)
    # Note: access tokens may be identical if created in same second (no JTI)
    # But refresh tokens MUST differ (they have unique JTI)
    assert new_refresh_token != original_refresh_token
    # Both tokens should be valid JWTs
    assert new_access_token.startswith("eyJ")
    assert original_access_token.startswith("eyJ")


async def test_refresh_revokes_old_token(async_client: AsyncClient):
    """Test that refresh revokes the old refresh token."""
    # Register to get initial tokens
    register_response = await async_client.post(
        "/auth/register",
        json={
            "email": "revoketest@example.com",
            "password": "RevokePass123!",
            "full_name": "Revoke Test User",
            "organization_name": "Revoke Test Org",
        },
    )
    assert register_response.status_code == 201
    original_refresh_token = _extract_refresh_cookie(register_response)

    # Refresh once to get new tokens
    refresh_response = await async_client.post(
        "/auth/refresh",
        cookies={"refresh_token": original_refresh_token},
    )
    assert refresh_response.status_code == 200

    # Try to refresh again with OLD token (should fail)
    old_token_response = await async_client.post(
        "/auth/refresh",
        cookies={"refresh_token": original_refresh_token},
    )

    assert old_token_response.status_code == 401


async def test_logout_success(async_client: AsyncClient):
    """Test successful logout."""
    # Register to get tokens
    register_response = await async_client.post(
        "/auth/register",
        json={
            "email": "logouttest@example.com",
            "password": "LogoutPass123!",
            "full_name": "Logout Test User",
            "organization_name": "Logout Test Org",
        },
    )
    assert register_response.status_code == 201
    refresh_token = _extract_refresh_cookie(register_response)

    # Logout — send refresh_token via cookie
    logout_response = await async_client.post(
        "/auth/logout",
        cookies={"refresh_token": refresh_token},
    )

    assert logout_response.status_code == 200
    data = logout_response.json()
    assert data["message"] == "Logged out successfully"


async def test_logout_then_refresh_fails(async_client: AsyncClient):
    """Test that refresh fails after logout."""
    # Register to get tokens
    register_response = await async_client.post(
        "/auth/register",
        json={
            "email": "logoutrefresh@example.com",
            "password": "LogoutRefreshPass123!",
            "full_name": "Logout Refresh Test User",
            "organization_name": "Logout Refresh Test Org",
        },
    )
    assert register_response.status_code == 201
    refresh_token = _extract_refresh_cookie(register_response)

    # Logout — send refresh_token via cookie
    logout_response = await async_client.post(
        "/auth/logout",
        cookies={"refresh_token": refresh_token},
    )
    assert logout_response.status_code == 200

    # Try to refresh with logged-out token (should fail)
    refresh_response = await async_client.post(
        "/auth/refresh",
        cookies={"refresh_token": refresh_token},
    )

    assert refresh_response.status_code == 401


async def test_get_me_returns_user_info(async_client: AsyncClient):
    """Test that /me returns authenticated user information."""
    # Register to get tokens
    register_response = await async_client.post(
        "/auth/register",
        json={
            "email": "metest@example.com",
            "password": "MeTestPass123!",
            "full_name": "Me Test User",
            "organization_name": "Me Test Org",
        },
    )
    assert register_response.status_code == 201
    access_token = register_response.json()["access_token"]

    # Get user info
    me_response = await async_client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )

    assert me_response.status_code == 200
    data = me_response.json()
    assert data["email"] == "metest@example.com"
    assert data["full_name"] == "Me Test User"
    assert "organization_id" in data
    assert "email_verified" in data
    assert data["auth_provider"] == "email"


async def test_get_me_without_token_returns_401(async_client: AsyncClient):
    """Test that /me returns 401 without authorization."""
    me_response = await async_client.get("/auth/me")

    assert me_response.status_code == 401


async def test_full_auth_lifecycle(async_client: AsyncClient):
    """Test complete auth lifecycle: register -> login -> /me -> refresh -> /me -> logout."""
    # Step 1: Register
    register_response = await async_client.post(
        "/auth/register",
        json={
            "email": "lifecycle@example.com",
            "password": "LifecyclePass123!",
            "full_name": "Lifecycle Test User",
            "organization_name": "Lifecycle Test Org",
        },
    )
    assert register_response.status_code == 201
    initial_access = register_response.json()["access_token"]
    initial_refresh = _extract_refresh_cookie(register_response)

    # Step 2: Login
    login_response = await async_client.post(
        "/auth/login",
        json={
            "email": "lifecycle@example.com",
            "password": "LifecyclePass123!",
        },
    )
    assert login_response.status_code == 200

    # Step 3: Get user info with initial token
    me_response_1 = await async_client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {initial_access}"},
    )
    assert me_response_1.status_code == 200

    # Step 4: Refresh tokens — send refresh_token via cookie
    refresh_response = await async_client.post(
        "/auth/refresh",
        cookies={"refresh_token": initial_refresh},
    )
    assert refresh_response.status_code == 200
    new_access = refresh_response.json()["access_token"]
    new_refresh = _extract_refresh_cookie(refresh_response)

    # Step 5: Get user info with new token
    me_response_2 = await async_client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {new_access}"},
    )
    assert me_response_2.status_code == 200

    # Step 6: Logout — send refresh_token via cookie
    logout_response = await async_client.post(
        "/auth/logout",
        cookies={"refresh_token": new_refresh},
    )
    assert logout_response.status_code == 200


async def test_verify_email_success(async_client: AsyncClient, test_db):
    """Test email verification flow."""
    # Register user (starts unverified)
    register_response = await async_client.post(
        "/auth/register",
        json={
            "email": "verifytest@example.com",
            "password": "VerifyPass123!",
            "full_name": "Verify Test User",
            "organization_name": "Verify Test Org",
        },
    )
    assert register_response.status_code == 201
    access_token = register_response.json()["access_token"]

    # Decode access token to get user_id
    payload = decode_token(access_token)
    user_id = payload["sub"]

    # Create verification token manually
    verification_token = create_email_verification_token(user_id, "verifytest@example.com")

    # Verify email
    verify_response = await async_client.post(
        "/auth/verify-email",
        json={"token": verification_token},
    )

    assert verify_response.status_code == 200
    data = verify_response.json()
    assert "verified" in data["message"].lower()

    # Check that email_verified is now True
    me_response = await async_client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert me_response.status_code == 200
    assert me_response.json()["email_verified"] is True


async def test_password_reset_flow(async_client: AsyncClient):
    """Test password reset flow."""
    # Register with original password
    register_response = await async_client.post(
        "/auth/register",
        json={
            "email": "resettest@example.com",
            "password": "OldPass123!",
            "full_name": "Reset Test User",
            "organization_name": "Reset Test Org",
        },
    )
    assert register_response.status_code == 201
    access_token = register_response.json()["access_token"]

    # Decode access token to get user_id
    payload = decode_token(access_token)
    user_id = payload["sub"]

    # Create reset token manually
    reset_token = create_password_reset_token(user_id)

    # Reset password
    reset_response = await async_client.post(
        "/auth/password-reset/confirm",
        json={
            "token": reset_token,
            "new_password": "NewPass123!",
        },
    )

    assert reset_response.status_code == 200
    data = reset_response.json()
    assert "reset" in data["message"].lower()

    # Login with new password (should succeed)
    new_login_response = await async_client.post(
        "/auth/login",
        json={
            "email": "resettest@example.com",
            "password": "NewPass123!",
        },
    )
    assert new_login_response.status_code == 200

    # Login with old password (should fail)
    old_login_response = await async_client.post(
        "/auth/login",
        json={
            "email": "resettest@example.com",
            "password": "OldPass123!",
        },
    )
    assert old_login_response.status_code == 401
