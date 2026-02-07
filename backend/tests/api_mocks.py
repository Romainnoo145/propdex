"""Shared mock helpers for government API client tests."""

from unittest.mock import AsyncMock, MagicMock

import httpx


def make_mock_response(
    status_code: int = 200,
    json_data: dict | None = None,
    url: str = "https://example.com/test",
) -> MagicMock:
    """Create a mock httpx.Response with controlled attributes."""
    response = MagicMock(spec=httpx.Response)
    response.status_code = status_code
    response.url = httpx.URL(url)
    response.json.return_value = json_data or {}

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
