"""Backward-compatibility re-export. GovernmentAPIError lives in base.py."""

from app.government_apis.base import (  # noqa: F401
    APINotFoundError,
    APIRateLimitError,
    APITimeoutError,
    GovernmentAPIError,
)
