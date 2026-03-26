"""Unit tests for JWT token creation and validation."""

from datetime import datetime, timedelta

import jwt as jwt_module
import pytest

from app.auth.jwt import (
    create_access_token,
    create_email_verification_token,
    create_password_reset_token,
    create_refresh_token,
    decode_token,
)
from app.core.config import settings

# Access token tests


def test_create_access_token_contains_correct_claims():
    """Test access token creation with correct claims."""
    user_id = "123e4567-e89b-12d3-a456-426614174000"
    org_id = "org-123"

    token = create_access_token(user_id, org_id)
    payload = decode_token(token)

    assert payload["sub"] == user_id
    assert payload["organization_id"] == org_id
    assert payload["type"] == "access"
    assert "exp" in payload
    assert isinstance(payload["exp"], int)


def test_create_access_token_different_users_different_tokens():
    """Test that different users produce different tokens."""
    user1_id = "user-1"
    user2_id = "user-2"
    org_id = "org-123"

    token1 = create_access_token(user1_id, org_id)
    token2 = create_access_token(user2_id, org_id)

    assert token1 != token2

    payload1 = decode_token(token1)
    payload2 = decode_token(token2)

    assert payload1["sub"] == user1_id
    assert payload2["sub"] == user2_id


# Refresh token tests


def test_create_refresh_token_returns_token_and_jti():
    """Test refresh token creation returns token and JTI."""
    user_id = "123e4567-e89b-12d3-a456-426614174000"
    org_id = "org-123"

    token, jti = create_refresh_token(user_id, org_id)

    assert isinstance(token, str)
    assert isinstance(jti, str)
    assert len(jti) > 20  # UUID string

    payload = decode_token(token)
    assert payload["sub"] == user_id
    assert payload["organization_id"] == org_id
    assert payload["type"] == "refresh"
    assert payload["jti"] == jti


def test_create_refresh_token_jti_is_unique():
    """Test that multiple refresh token calls produce unique JTIs."""
    user_id = "user-123"
    org_id = "org-123"

    token1, jti1 = create_refresh_token(user_id, org_id)
    token2, jti2 = create_refresh_token(user_id, org_id)

    assert jti1 != jti2
    assert token1 != token2


# Email verification token tests


def test_create_email_verification_token_contains_email():
    """Test email verification token contains email and correct claims."""
    user_id = "user-123"
    email = "test@example.com"

    token = create_email_verification_token(user_id, email)
    payload = decode_token(token)

    assert payload["sub"] == user_id
    assert payload["email"] == email
    assert payload["type"] == "email_verification"
    assert "exp" in payload


# Password reset token tests


def test_create_password_reset_token_contains_user_id():
    """Test password reset token contains user ID and correct claims."""
    user_id = "user-123"

    token = create_password_reset_token(user_id)
    payload = decode_token(token)

    assert payload["sub"] == user_id
    assert payload["type"] == "password_reset"
    assert "exp" in payload


# Decode token tests


def test_decode_valid_token():
    """Test decoding a valid token succeeds with correct payload."""
    user_id = "user-123"
    org_id = "org-123"

    token = create_access_token(user_id, org_id)
    payload = decode_token(token)

    assert payload["sub"] == user_id
    assert payload["organization_id"] == org_id
    assert payload["type"] == "access"


def test_decode_expired_token_raises():
    """Test that expired tokens raise ExpiredSignatureError."""
    # Create token that expired 1 hour ago
    payload = {
        "sub": "user-123",
        "type": "access",
        "exp": datetime.utcnow() - timedelta(hours=1),
    }
    expired_token = jwt_module.encode(payload, settings.SECRET_KEY, algorithm="HS256")

    with pytest.raises(jwt_module.ExpiredSignatureError):
        decode_token(expired_token)


def test_decode_invalid_token_raises():
    """Test that invalid tokens raise InvalidTokenError."""
    invalid_token = "not.a.valid.token"

    with pytest.raises(jwt_module.InvalidTokenError):
        decode_token(invalid_token)


def test_decode_wrong_secret_raises():
    """Test that tokens signed with wrong secret raise InvalidTokenError."""
    # Create token with different secret
    payload = {
        "sub": "user-123",
        "type": "access",
        "exp": datetime.utcnow() + timedelta(minutes=15),
    }
    wrong_secret_token = jwt_module.encode(payload, "wrong_secret_key", algorithm="HS256")

    with pytest.raises(jwt_module.InvalidTokenError):
        decode_token(wrong_secret_token)


# Type enforcement tests


@pytest.mark.parametrize(
    "create_func,expected_type",
    [
        (lambda: create_access_token("user-1", "org-1"), "access"),
        (lambda: create_refresh_token("user-1", "org-1")[0], "refresh"),
        (lambda: create_email_verification_token("user-1", "test@example.com"), "email_verification"),
        (lambda: create_password_reset_token("user-1"), "password_reset"),
    ],
)
def test_token_types_are_distinct(create_func, expected_type):
    """Test that different token creation functions produce correct type claims."""
    token = create_func()
    payload = decode_token(token)

    assert payload["type"] == expected_type
