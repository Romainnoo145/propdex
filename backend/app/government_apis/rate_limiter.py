"""Per-API rate limiting module for government API clients.

This module provides rate limiting for external government APIs using both:
- Concurrency control (asyncio.Semaphore) to limit simultaneous requests
- Time-based rate limiting (aiolimiter.AsyncLimiter) to enforce requests-per-hour limits

Each government API has its own rate limiter instance with appropriate limits.
"""

import asyncio
import logging
from types import TracebackType

from aiolimiter import AsyncLimiter

logger = logging.getLogger(__name__)


class APIRateLimiter:
    """Rate limiter combining concurrency control and time-based throttling.

    Uses both a semaphore (for max concurrent requests) and a token bucket
    (for max requests per hour). Works as an async context manager.

    Attributes:
        max_concurrent: Maximum number of simultaneous requests allowed
        max_per_hour: Maximum number of requests per hour
        enabled: If False, rate limiting is disabled (for testing)
    """

    def __init__(self, max_concurrent: int, max_per_hour: int) -> None:
        """Initialize rate limiter.

        Args:
            max_concurrent: Maximum number of simultaneous requests
            max_per_hour: Maximum number of requests per hour
        """
        self.max_concurrent = max_concurrent
        self.max_per_hour = max_per_hour
        self.enabled = True

        self._semaphore = asyncio.Semaphore(max_concurrent)
        self._limiter = AsyncLimiter(max_rate=max_per_hour, time_period=3600)

    async def __aenter__(self) -> "APIRateLimiter":
        """Acquire rate limiter on context entry.

        Returns:
            Self for context manager protocol
        """
        if not self.enabled:
            return self

        # Acquire semaphore first (concurrency control)
        await self._semaphore.acquire()

        # Then acquire token from bucket (time-based limit)
        await self._limiter.acquire()

        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: TracebackType | None,
    ) -> None:
        """Release rate limiter on context exit.

        Args:
            exc_type: Exception type if an exception occurred
            exc_val: Exception value if an exception occurred
            exc_tb: Exception traceback if an exception occurred
        """
        if not self.enabled:
            return

        # Release semaphore (token bucket releases automatically)
        self._semaphore.release()


# Module-level singleton instances for each government API
# BAG WFS (PDOK) is public and has generous limits
bag_wfs_limiter = APIRateLimiter(max_concurrent=5, max_per_hour=1000)

# PLU WFS (PDOK) is public, same limits as BAG WFS
plu_wfs_limiter = APIRateLimiter(max_concurrent=5, max_per_hour=1000)

# SRU (PDOK Search) is less tolerant of heavy usage
sru_limiter = APIRateLimiter(max_concurrent=3, max_per_hour=500)

# PDOK Locatieserver reverse/search — public, no auth required.
# 10 concurrent matches scan semaphore. High hourly cap for batch scans.
pdok_locatieserver_limiter = APIRateLimiter(max_concurrent=10, max_per_hour=50000)

# BRK (Kadaster) is a paid API, use conservative limits
brk_limiter = APIRateLimiter(max_concurrent=2, max_per_hour=200)

# EP-Online (RVO) — API-key-gated, conservative limits
ep_online_limiter = APIRateLimiter(max_concurrent=3, max_per_hour=500)

# RCE Linked Data detail — public API, polite limits
rce_detail_limiter = APIRateLimiter(max_concurrent=3, max_per_hour=300)

# WOZ Waardeloket (Kadaster) — public endpoint, conservative polite limits
woz_waardeloket_limiter = APIRateLimiter(max_concurrent=3, max_per_hour=500)

# Bodemloket (Rijkswaterstaat / ArcGIS) — public endpoint, polite limits
bodemloket_limiter = APIRateLimiter(max_concurrent=3, max_per_hour=300)

# 3D BAG (TU Delft) — authenticated, conservative limits
bag_3d_limiter = APIRateLimiter(max_concurrent=2, max_per_hour=200)

# CBS OData (open data) — polite limits for public endpoint
cbs_odata_limiter = APIRateLimiter(max_concurrent=3, max_per_hour=500)

# Rechtspraak Open Data — public, polite limits
rechtspraak_limiter = APIRateLimiter(max_concurrent=3, max_per_hour=300)

# CBS Crime (dataderden.cbs.nl OData v3) — public, polite limits
cbs_crime_limiter = APIRateLimiter(max_concurrent=3, max_per_hour=500)

# BRO Bodemkaart WMS (PDOK/TNO) — public, polite limits
bro_bodemkaart_limiter = APIRateLimiter(max_concurrent=5, max_per_hour=1000)

# PDOK Funderingsproblematiek WFS (RVO) — public, polite limits
pdok_funderingsrisico_limiter = APIRateLimiter(max_concurrent=5, max_per_hour=1000)

# PDOK Natura2000 WFS (RVO) — public, polite limits
pdok_natura2000_limiter = APIRateLimiter(max_concurrent=5, max_per_hour=1000)

# RWS Overstromingen Risicogebied WMS (PDOK) — public, polite limits
rws_overstromingen_limiter = APIRateLimiter(max_concurrent=5, max_per_hour=1000)

# RIVM Geluidkaart WMS (Atlas Leefomgeving) — public, polite limits
rivm_geluid_limiter = APIRateLimiter(max_concurrent=5, max_per_hour=1000)

# RIVM Luchtkwaliteit WMS (Atlas Leefomgeving) — public, polite limits
rivm_luchtkwaliteit_limiter = APIRateLimiter(max_concurrent=5, max_per_hour=1000)
