"""Tenant context middleware for multi-tenant request handling."""

import uuid

from fastapi import Request
from jwt.exceptions import InvalidTokenError
from starlette.middleware.base import BaseHTTPMiddleware

from app.auth.jwt import decode_token


class TenantContextMiddleware(BaseHTTPMiddleware):
    """
    Middleware that extracts organization_id from JWT and stores in request state.

    This middleware runs on EVERY request before route handlers. It:
    1. Extracts Bearer token from Authorization header (if present)
    2. Decodes JWT to get organization_id (if valid)
    3. Stores organization_id in request.state for use by dependencies

    Important:
    - Does NOT fail on missing/invalid tokens (public endpoints must work)
    - Does NOT query database (happens in auth dependencies)
    - Lightweight - only JWT decoding

    The organization_id is used by:
    - get_current_organization_id() dependency for protected endpoints
    - get_db() to set RLS context (SET LOCAL app.current_tenant_id)
    """

    async def dispatch(self, request: Request, call_next):
        """Process request to extract tenant context."""
        # Initialize organization_id to None
        request.state.organization_id = None
        request.state.user_id = None

        # Extract Authorization header
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.replace("Bearer ", "")

            try:
                # Decode JWT to extract organization/user context
                payload = decode_token(token)
                org_id = payload.get("organization_id")
                user_id = payload.get("sub")
                if org_id:
                    request.state.organization_id = uuid.UUID(org_id)
                if user_id:
                    request.state.user_id = uuid.UUID(user_id)
            except (InvalidTokenError, ValueError):
                # Silently ignore invalid tokens - public endpoints should work
                # Auth dependencies will handle validation for protected endpoints
                pass

        response = await call_next(request)
        return response
