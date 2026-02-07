"""Rate limiting middleware using slowapi."""

import logging

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings

logger = logging.getLogger(__name__)

# Initialize rate limiter
# Use in-memory storage for MVP (can switch to Redis later)
# If Redis URL is configured in settings, use Redis backend
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["100/minute"],
    storage_uri="memory://",  # In-memory storage for MVP
)

logger.info("Rate limiter initialized with in-memory storage")
