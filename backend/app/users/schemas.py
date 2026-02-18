"""Pydantic schemas for users API (profile, password, preferences)."""

from pydantic import BaseModel, ConfigDict, EmailStr, Field

# Re-export shared schemas from auth — avoids duplication
from app.auth.schemas import MessageResponse, UserResponse

__all__ = [
    "MessageResponse",
    "PasswordChange",
    "UserPreferences",
    "UserPreferencesUpdate",
    "UserProfileUpdate",
    "UserResponse",
]


class UserProfileUpdate(BaseModel):
    """Schema for partial profile update (name and/or email)."""

    full_name: str | None = None
    email: EmailStr | None = None


class PasswordChange(BaseModel):
    """Schema for changing password (requires current password verification)."""

    current_password: str
    new_password: str = Field(..., min_length=8, description="New password (min 8 characters)")


class UserPreferences(BaseModel):
    """Schema representing the full set of user preferences with defaults."""

    model_config = ConfigDict(extra="ignore")

    notification_email_alerts: bool = True
    map_style: str = "satellite"


class UserPreferencesUpdate(BaseModel):
    """Schema for partial preferences update — all fields optional."""

    notification_email_alerts: bool | None = None
    map_style: str | None = None
