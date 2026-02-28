"""Base classes and utilities for government API clients."""

import logging
from collections.abc import Awaitable, Callable

import httpx

logger = logging.getLogger(__name__)


class GovernmentAPIError(Exception):
    """Base exception for government API errors."""

    def __init__(self, source: str, message: str, status_code: int | None = None):
        """
        Initialize government API error.

        Args:
            source: API source name (e.g., "bag", "pdok")
            message: Error message
            status_code: HTTP status code if applicable
        """
        self.source = source
        self.message = message
        self.status_code = status_code
        super().__init__(f"[{source}] {message}")


class APINotFoundError(GovernmentAPIError):
    """Raised when API returns 404 Not Found."""

    def __init__(self, source: str, message: str = "Resource not found"):
        """Initialize not found error."""
        super().__init__(source, message, status_code=404)


class APIRateLimitError(GovernmentAPIError):
    """Raised when API returns 429 Too Many Requests."""

    def __init__(self, source: str, message: str = "Rate limit exceeded"):
        """Initialize rate limit error."""
        super().__init__(source, message, status_code=429)


class APITimeoutError(GovernmentAPIError):
    """Raised when API request times out."""

    def __init__(self, source: str, message: str = "Request timed out"):
        """Initialize timeout error."""
        super().__init__(source, message, status_code=None)


def handle_api_response(response: httpx.Response, source: str) -> dict:
    """
    Handle API response with consistent error handling.

    Args:
        response: httpx Response object
        source: API source name for error reporting

    Returns:
        dict: Parsed JSON response data

    Raises:
        APINotFoundError: If status code is 404
        APIRateLimitError: If status code is 429
        httpx.HTTPStatusError: For other HTTP errors
    """
    if response.status_code == 404:
        raise APINotFoundError(source, f"Resource not found: {response.url}")

    if response.status_code == 429:
        raise APIRateLimitError(source, f"Rate limit exceeded: {response.url}")

    # Wrap other HTTP errors as GovernmentAPIError
    try:
        response.raise_for_status()
    except httpx.HTTPStatusError as e:
        raise GovernmentAPIError(
            source,
            f"HTTP {response.status_code} from {response.url}",
            status_code=response.status_code,
        ) from e

    return response.json()


async def retry_with_backoff(
    fn: Callable[[], Awaitable[httpx.Response]],
    source: str,
    retries: int = 3,
    retry_on_errors: bool = False,
) -> httpx.Response:
    """Retry HTTP request with exponential backoff on 429 responses or errors.

    Args:
        fn: Async callable that returns an httpx.Response
        source: API source name for logging
        retries: Maximum number of retry attempts (default 3)
        retry_on_errors: When True, also retry on 5xx responses and network
            exceptions (httpx.HTTPStatusError, httpx.RequestError). Default False
            preserves existing 429-only behavior.

    Returns:
        httpx.Response: The final response (may still be 429 if all retries exhausted)

    Raises:
        httpx.RequestError: When retry_on_errors=True and all retries are exhausted
            due to network failures.
    """
    import asyncio

    if not retry_on_errors:
        # Original behavior: retry only on 429
        response = await fn()
        for attempt in range(1, retries + 1):
            if response.status_code != 429:
                return response
            delay = 2 ** (attempt - 1)  # 1, 2, 4 seconds
            logger.warning(
                "[%s] Rate limited (429), retry %d/%d in %ds",
                source,
                attempt,
                retries,
                delay,
            )
            await asyncio.sleep(delay)
            response = await fn()
        return response  # Return last response; handle_api_response raises APIRateLimitError

    # Extended behavior: retry on 429, 5xx, and network exceptions
    last_exc: Exception | None = None
    for attempt in range(retries + 1):
        try:
            response = await fn()
        except httpx.RequestError as exc:
            last_exc = exc
            if attempt < retries:
                delay = 2 ** attempt  # 1, 2, 4 seconds
                logger.warning(
                    "[%s] Network error (attempt %d/%d), retrying in %ds: %s",
                    source,
                    attempt + 1,
                    retries,
                    delay,
                    exc,
                )
                await asyncio.sleep(delay)
                continue
            raise

        if response.status_code in (429,) or 500 <= response.status_code <= 599:
            if attempt < retries:
                delay = 2 ** attempt  # 1, 2, 4 seconds
                logger.warning(
                    "[%s] HTTP %d (attempt %d/%d), retrying in %ds",
                    source,
                    response.status_code,
                    attempt + 1,
                    retries,
                    delay,
                )
                await asyncio.sleep(delay)
                continue

        return response

    # Should not be reached, but satisfy type checker
    if last_exc is not None:
        raise last_exc
    raise RuntimeError(f"[{source}] retry_with_backoff exhausted without result")
