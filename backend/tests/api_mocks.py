"""Shared mock helpers for government API client tests."""

from unittest.mock import AsyncMock, MagicMock

import httpx


def make_mock_response(
    status_code: int = 200,
    json_data: dict | None = None,
    url: str = "https://example.com/test",
    content: bytes | None = None,
) -> MagicMock:
    """Create a mock httpx.Response with controlled attributes.

    Args:
        status_code: HTTP status code (default: 200)
        json_data: JSON data to return from .json() (default: {})
        url: URL of the response (default: test URL)
        content: Raw bytes content for .content attribute (e.g., XML)

    Returns:
        MagicMock: Mock response with spec=httpx.Response
    """
    response = MagicMock(spec=httpx.Response)
    response.status_code = status_code
    response.url = httpx.URL(url)
    response.json.return_value = json_data or {}

    # Set content attribute if provided (for XML/binary responses)
    if content is not None:
        response.content = content

    if status_code >= 400:
        response.raise_for_status.side_effect = httpx.HTTPStatusError(
            message=f"HTTP {status_code}",
            request=MagicMock(spec=httpx.Request),
            response=response,
        )
    else:
        response.raise_for_status.return_value = None

    return response


def make_mock_client(**method_responses: MagicMock) -> AsyncMock:
    """Create a mock httpx.AsyncClient with preset method responses."""
    client = AsyncMock(spec=httpx.AsyncClient)
    for method, response in method_responses.items():
        getattr(client, method).return_value = response
    return client
