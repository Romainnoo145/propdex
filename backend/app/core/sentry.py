"""Sentry SDK initialization for FastAPI and ARQ worker."""

import logging

import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.google_genai import GoogleGenAIIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration

from app.core.config import settings

logger = logging.getLogger(__name__)


def _traces_sampler(sampling_context: dict) -> float:
    """Drop health-check and readiness transactions to reduce noise."""
    path = sampling_context.get("asgi_scope", {}).get("path", "")
    if path in ("/", "/api/health", "/api/ready"):
        return 0.0
    return settings.SENTRY_TRACES_SAMPLE_RATE


def init_sentry() -> None:
    """Initialise Sentry SDK if a DSN is configured.

    Safe to call multiple times — sentry_sdk.init is idempotent.
    Silently no-ops when SENTRY_DSN is empty (local dev).
    """
    dsn = settings.SENTRY_DSN
    if not dsn:
        logger.debug("SENTRY_DSN not set — Sentry disabled")
        return

    sentry_sdk.init(
        dsn=dsn,
        environment=settings.ENVIRONMENT,
        traces_sampler=_traces_sampler,
        integrations=[
            FastApiIntegration(),
            StarletteIntegration(),
            GoogleGenAIIntegration(include_prompts=False),
        ],
        send_default_pii=False,
    )
    logger.info("Sentry initialised (env=%s)", settings.ENVIRONMENT)
