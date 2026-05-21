"""Pydantic schemas for authentication API."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserCreate(BaseModel):
    """Schema for user registration."""

    email: EmailStr = Field(..., description="User email address (globally unique)")
    password: str = Field(..., min_length=8, description="Password (min 8 characters)")
    full_name: str | None = Field(None, description="User full name (optional)")
    organization_name: str = Field(
        ..., min_length=1, max_length=255, description="Organization name"
    )


class UserResponse(BaseModel):
    """Schema for user data in API responses."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    full_name: str | None
    organization_id: uuid.UUID
    email_verified: bool
    auth_provider: str
    is_superuser: bool
    created_at: datetime
    hauzer_demo: bool = False


class TokenResponse(BaseModel):
    """Schema for JWT token response."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class CookieTokenResponse(BaseModel):
    """Schema for JWT token response with httpOnly cookie for refresh token."""

    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    """Schema for login request."""

    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    """Schema for token refresh request."""

    refresh_token: str


class MessageResponse(BaseModel):
    """Generic message response schema."""

    message: str


class EmailVerifyRequest(BaseModel):
    """Schema for email verification request."""

    token: str


class PasswordResetRequest(BaseModel):
    """Schema for password reset request."""

    email: EmailStr


class PasswordResetConfirm(BaseModel):
    """Schema for password reset confirmation."""

    token: str
    new_password: str = Field(..., min_length=8, description="New password (min 8 characters)")
