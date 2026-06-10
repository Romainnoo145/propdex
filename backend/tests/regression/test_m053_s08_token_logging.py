"""REGRESSION — M053/S08: auth token URLs must NOT appear in logs when ENVIRONMENT=production.

In send_verification_email and send_password_reset_email the full token URL
(containing a raw JWT) is emitted via print() + logger.info().  In production
these lines would land in Railway log-drain and are an account-takeover risk
(CRIT-5).  The fix gates those lines behind
  `if settings.ENVIRONMENT.lower() in ("development", "test", "testing")`

This test confirms that when ENVIRONMENT is "production" the token URL is
absent from the captured log records, and that it IS present when ENVIRONMENT
is "development".
"""
from __future__ import annotations

import logging

import pytest

from app.core.config import settings

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _url_in_caplog(caplog_records: list[logging.LogRecord], url: str) -> bool:
    return any(url in (r.getMessage()) for r in caplog_records)


# ---------------------------------------------------------------------------
# Verification email
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_verification_email_no_token_log_in_production(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Token URL must NOT appear in logger records when ENVIRONMENT=production."""
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "MAIL_USERNAME", "")  # triggers early return after guard

    from app.auth.email import send_verification_email  # noqa: PLC0415

    token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.testpayload.sig"
    expected_url = f"{settings.FRONTEND_URL}/verify-email?token={token}"

    with caplog.at_level(logging.INFO, logger="app.auth.email"):
        await send_verification_email("user@example.com", token)

    assert not _url_in_caplog(caplog.records, expected_url), (
        "Token URL must not appear in logs when ENVIRONMENT=production"
    )


@pytest.mark.asyncio
async def test_verification_email_token_log_in_development(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Token URL MUST appear in logger records when ENVIRONMENT=development."""
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    monkeypatch.setattr(settings, "MAIL_USERNAME", "")  # triggers early return after the log block

    from app.auth.email import send_verification_email  # noqa: PLC0415

    token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.testpayload.sig"
    expected_url = f"{settings.FRONTEND_URL}/verify-email?token={token}"

    with caplog.at_level(logging.INFO, logger="app.auth.email"):
        await send_verification_email("user@example.com", token)

    assert _url_in_caplog(caplog.records, expected_url), (
        "Token URL must appear in logs when ENVIRONMENT=development"
    )


# ---------------------------------------------------------------------------
# Password reset email
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_reset_email_no_token_log_in_production(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Token URL must NOT appear in logger records when ENVIRONMENT=production."""
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "MAIL_USERNAME", "")

    from app.auth.email import send_password_reset_email  # noqa: PLC0415

    token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.resetpayload.sig"
    expected_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"

    with caplog.at_level(logging.INFO, logger="app.auth.email"):
        await send_password_reset_email("user@example.com", token)

    assert not _url_in_caplog(caplog.records, expected_url), (
        "Token URL must not appear in logs when ENVIRONMENT=production"
    )


@pytest.mark.asyncio
async def test_reset_email_token_log_in_development(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Token URL MUST appear in logger records when ENVIRONMENT=development."""
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    monkeypatch.setattr(settings, "MAIL_USERNAME", "")

    from app.auth.email import send_password_reset_email  # noqa: PLC0415

    token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.resetpayload.sig"
    expected_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"

    with caplog.at_level(logging.INFO, logger="app.auth.email"):
        await send_password_reset_email("user@example.com", token)

    assert _url_in_caplog(caplog.records, expected_url), (
        "Token URL must appear in logs when ENVIRONMENT=development"
    )
