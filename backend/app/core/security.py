"""Security audit logging utilities for multi-tenant access control."""

import logging
import uuid
from datetime import datetime

# Dedicated audit logger — can be configured independently from application logs
audit_logger = logging.getLogger("audit.security")


async def log_access_denial(
    user_id: uuid.UUID | None,
    organization_id: uuid.UUID,
    resource_type: str,
    resource_id: uuid.UUID | str,
    reason: str,
) -> None:
    """
    Log a security-relevant access denial event.

    Args:
        user_id: UUID of the user attempting access (None for anonymous)
        organization_id: UUID of the organization context
        resource_type: Type of resource (e.g., "property", "report", "organization")
        resource_id: UUID or identifier of the specific resource
        reason: Human-readable reason for denial
    """
    audit_logger.warning(
        "access_denied: user=%s org=%s resource=%s/%s reason=%s",
        str(user_id) if user_id else "anonymous",
        str(organization_id),
        resource_type,
        str(resource_id),
        reason,
        extra={
            "event_type": "access_denied",
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": str(user_id) if user_id else None,
            "organization_id": str(organization_id),
            "resource_type": resource_type,
            "resource_id": str(resource_id),
            "reason": reason,
        },
    )


async def log_rls_context_set(
    organization_id: uuid.UUID,
) -> None:
    """
    Log RLS context being set for a database session (debug level).

    Args:
        organization_id: UUID of the organization for RLS context
    """
    audit_logger.debug(
        "rls_context_set: org=%s",
        str(organization_id),
        extra={
            "event_type": "rls_context_set",
            "organization_id": str(organization_id),
        },
    )
