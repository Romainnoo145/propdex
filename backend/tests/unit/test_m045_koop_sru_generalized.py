"""Unit tests for generalized koop_sru_client.search_policy_document (M045/S06 T01)."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import httpx

import app.services.koop_sru_client as koop
from app.services.koop_sru_client import (
    search_huisvestingsverordening,
    search_policy_document,
)

# Minimal SRU XML template with one recordData block
_SRU_ONE_RECORD = """\
<?xml version="1.0" encoding="UTF-8"?>
<srw:searchRetrieveResponse xmlns:srw="http://www.loc.gov/zing/srw/">
  <srw:numberOfRecords>1</srw:numberOfRecords>
  <srw:records>
    <srw:record>
      <srw:recordData>
        <dc:title xmlns:dc="http://purl.org/dc/terms/">Omgevingsvisie 2030 Amsterdam</dc:title>
        <dc:identifier xmlns:dc="http://purl.org/dc/terms/">gmb-2024-12345</dc:identifier>
        <dc:creator xmlns:dc="http://purl.org/dc/terms/">Amsterdam</dc:creator>
        <dc:modified xmlns:dc="http://purl.org/dc/terms/">2024-01-15</dc:modified>
      </srw:recordData>
    </srw:record>
  </srw:records>
</srw:searchRetrieveResponse>
"""

# Minimal SRU XML with empty records
_SRU_EMPTY_RECORDS = """\
<?xml version="1.0" encoding="UTF-8"?>
<srw:searchRetrieveResponse xmlns:srw="http://www.loc.gov/zing/srw/">
  <srw:numberOfRecords>0</srw:numberOfRecords>
  <srw:records/>
</srw:searchRetrieveResponse>
"""


def _make_mock_client(status_code: int, text: str) -> MagicMock:
    """Return a mock AsyncClient context manager with a canned response."""
    mock_resp = MagicMock(spec=httpx.Response)
    mock_resp.status_code = status_code
    mock_resp.text = text

    mock_client = AsyncMock(spec=httpx.AsyncClient)
    mock_client.get = AsyncMock(return_value=mock_resp)

    cm = MagicMock()
    cm.__aenter__ = AsyncMock(return_value=mock_client)
    cm.__aexit__ = AsyncMock(return_value=False)
    return cm


async def test_search_policy_document_returns_first_result_on_match() -> None:
    """search_policy_document returns a VerordeningResult on a 200 response with records."""
    koop._cache.clear()

    with patch("httpx.AsyncClient", return_value=_make_mock_client(200, _SRU_ONE_RECORD)):
        result = await search_policy_document("omgevingsvisie", "Amsterdam")

    assert result is not None
    assert result.title == "Omgevingsvisie 2030 Amsterdam"
    assert result.identifier == "gmb-2024-12345"
    assert result.url.endswith("gmb-2024-12345")


async def test_search_policy_document_returns_none_when_zero_records() -> None:
    """search_policy_document returns None when SRU returns zero records."""
    koop._cache.clear()

    with patch("httpx.AsyncClient", return_value=_make_mock_client(200, _SRU_EMPTY_RECORDS)):
        result = await search_policy_document("omgevingsvisie", "Venlo")

    assert result is None


async def test_search_policy_document_returns_none_on_http_error() -> None:
    """search_policy_document returns None when SRU returns non-200 status."""
    koop._cache.clear()

    with patch("httpx.AsyncClient", return_value=_make_mock_client(500, "")):
        result = await search_policy_document("huisvestingsverordening", "Rotterdam")

    assert result is None


async def test_huisvestingsverordening_wrapper_uses_correct_title() -> None:
    """search_huisvestingsverordening delegates to search_policy_document with the right title."""
    koop._cache.clear()

    mock_fn = AsyncMock(return_value=None)
    with patch("app.services.koop_sru_client.search_policy_document", mock_fn):
        await search_huisvestingsverordening("Amsterdam")

    mock_fn.assert_called_once_with(
        "huisvestingsverordening",
        "Amsterdam",
        timeout=15.0,
    )
