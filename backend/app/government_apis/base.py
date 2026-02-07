"""Base classes and utilities for government API clients."""

import logging

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

    # Raise for other HTTP errors (4xx, 5xx)
    response.raise_for_status()

    return response.json()
