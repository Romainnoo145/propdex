"""Unit tests for download_cvdr_pdf — M045/S06 T02."""

from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import httpx

from app.services.koop_sru_client import download_cvdr_pdf

# ---------------------------------------------------------------------------
# Helpers — build a mock httpx response
# ---------------------------------------------------------------------------


def _mock_response(*, status_code: int, content_type: str, content: bytes) -> MagicMock:
    resp = MagicMock(spec=httpx.Response)
    resp.status_code = status_code
    resp.headers = {"content-type": content_type}
    resp.content = content
    return resp


def _patch_async_client_returning(response: MagicMock) -> Any:
    """Patch httpx.AsyncClient so .get(...) returns the given response."""
    mock_client = MagicMock()
    mock_client.get = AsyncMock(return_value=response)
    mock_cm = MagicMock()
    mock_cm.__aenter__ = AsyncMock(return_value=mock_client)
    mock_cm.__aexit__ = AsyncMock(return_value=None)
    return patch("httpx.AsyncClient", return_value=mock_cm)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


async def test_download_cvdr_pdf_returns_bytes_on_success() -> None:
    """200 OK + application/pdf returns the response bytes."""
    fake_pdf = b"%PDF-1.4\nfake content\n%%EOF"
    resp = _mock_response(
        status_code=200,
        content_type="application/pdf",
        content=fake_pdf,
    )

    with _patch_async_client_returning(resp):
        result = await download_cvdr_pdf("gmb-2025-552274")

    assert result == fake_pdf


async def test_download_cvdr_pdf_returns_none_on_404() -> None:
    """A 404 response returns None instead of raising."""
    resp = _mock_response(
        status_code=404,
        content_type="text/html",
        content=b"<html>Not Found</html>",
    )

    with _patch_async_client_returning(resp):
        result = await download_cvdr_pdf("gmb-2999-000000")

    assert result is None


async def test_download_cvdr_pdf_returns_none_on_non_pdf_content_type() -> None:
    """A 200 response with text/html content-type (viewer page) returns None."""
    resp = _mock_response(
        status_code=200,
        content_type="text/html; charset=utf-8",
        content=b"<html>This is the viewer page, not the PDF</html>",
    )

    with _patch_async_client_returning(resp):
        result = await download_cvdr_pdf("gmb-2025-552274")

    assert result is None
