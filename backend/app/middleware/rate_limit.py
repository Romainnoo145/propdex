"""Rate limiting middleware using slowapi."""

import logging

from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request

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


def org_rate_key(request: Request) -> str:
    """Per-org rate-limit key (falls back to IP when no auth context).

    Used by endpoints that expose bulk data (e.g. MVT tiles) where a single
    authenticated org could scrape an entire gemeente by hitting the IP cap
    multiple times. Capping per-org instead makes scraping more costly even
    when the attacker rotates IPs.
    """
    org_id = getattr(request.state, "organization_id", None)
    if org_id is not None:
        return f"org:{org_id}"
    return get_remote_address(request)
