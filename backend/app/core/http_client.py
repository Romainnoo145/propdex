"""Shared HTTP client factory for government API integrations."""

import httpx


def create_government_api_client() -> httpx.AsyncClient:
    """
    Create a shared httpx AsyncClient for government API requests.

    Configured with connection pooling, timeouts, HTTP/2 support, and redirect following.
    The client instance should be stored on app.state and closed during app shutdown.

    Returns:
        httpx.AsyncClient: Configured async HTTP client with connection pooling
    """
    return httpx.AsyncClient(
        limits=httpx.Limits(
            max_keepalive_connections=20,
            max_connections=100,
            keepalive_expiry=30.0,
        ),
        timeout=httpx.Timeout(
            connect=5.0,
            read=10.0,
            write=5.0,
            pool=5.0,
        ),
        http2=True,
        follow_redirects=True,
    )
