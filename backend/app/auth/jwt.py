"""JWT token creation and validation utilities."""

import uuid
from datetime import datetime, timedelta, timezone

import jwt
from jwt.exceptions import InvalidTokenError

from app.core.config import settings


def create_access_token(user_id: str, organization_id: str) -> str:
    """
    Create a JWT access token for authenticated requests.

    Args:
        user_id: User UUID as string
        organization_id: Organization UUID as string

    Returns:
        Encoded JWT access token (15 minutes expiration)
    """
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {
        "sub": user_id,
        "organization_id": organization_id,
        "type": "access",
        "exp": expire,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(user_id: str, organization_id: str) -> tuple[str, str]:
    """
    Create a JWT refresh token with unique JTI for rotation.

    Args:
        user_id: User UUID as string
        organization_id: Organization UUID as string

    Returns:
        Tuple of (encoded token, jti) where jti is stored in database
    """
    jti = str(uuid.uuid4())
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    payload = {
        "sub": user_id,
        "organization_id": organization_id,
        "type": "refresh",
        "jti": jti,
        "exp": expire,
    }
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return token, jti


def decode_token(token: str) -> dict:
    """
    Decode and validate a JWT token.

    Args:
        token: Encoded JWT token string

    Returns:
        Decoded token payload as dictionary

    Raises:
        jwt.ExpiredSignatureError: Token has expired
        jwt.InvalidTokenError: Token is invalid or malformed
    """
    # Explicitly specify algorithms to prevent algorithm confusion attack
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
