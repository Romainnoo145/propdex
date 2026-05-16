"""Admin router for vendor-managed integration credentials (M049/S05 Plan 02).

Eng-review locked 2026-05-14 + 2026-05-16:
- Superuser-only (Depends(get_current_superuser))
- GET never returns plaintext or ciphertext — only ``configured`` boolean and timestamps
- DELETE emits an ``audit_logs`` row before removing the credential
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin.integration_credentials_schemas import (
    CredentialCreate,
    CredentialEntryRead,
)
from app.auth.dependencies import get_current_superuser
from app.core.database import get_db
from app.models.audit_log import AuditLog
from app.models.integration_credential import IntegrationCredential
from app.models.user import User
from app.services.credential_crypto import encrypt
from app.services.credential_fields import CREDENTIAL_FIELDS, valid_names_for

router = APIRouter(
    prefix="/api/admin/integration-credentials",
    tags=["Admin / Integration Credentials"],
)


def _to_read(row: IntegrationCredential) -> CredentialEntryRead:
    """Project an IntegrationCredential row into the public read shape.

    NEVER includes ciphertext or plaintext — only the boolean ``configured``
    plus presence timestamps. Regression-asserted by TEST-03c.
    """
    return CredentialEntryRead(
        id=row.id,
        source_key=row.source_key,
        credential_name=row.credential_name,
        configured=bool(row.encrypted_value),
        configured_at=row.created_at,
        last_rotated_at=row.last_rotated_at,
    )


@router.get("", response_model=list[CredentialEntryRead])
async def list_credentials(
    _: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
) -> list[CredentialEntryRead]:
    """List all credential entries, ordered (source_key ASC, credential_name ASC)."""
    rows = (
        await db.execute(
            select(IntegrationCredential).order_by(
                IntegrationCredential.source_key,
                IntegrationCredential.credential_name,
            )
        )
    ).scalars().all()
    return [_to_read(r) for r in rows]


@router.get("/{source_key}", response_model=list[CredentialEntryRead])
async def list_credentials_for_source(
    source_key: Annotated[str, Path(min_length=1, max_length=64)],
    _: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
) -> list[CredentialEntryRead]:
    """List credential entries for one source_key. 404 if not in registry."""
    if source_key not in CREDENTIAL_FIELDS:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown source_key '{source_key}'",
        )
    rows = (
        await db.execute(
            select(IntegrationCredential)
            .where(IntegrationCredential.source_key == source_key)
            .order_by(IntegrationCredential.credential_name)
        )
    ).scalars().all()
    return [_to_read(r) for r in rows]


@router.post(
    "",
    response_model=CredentialEntryRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_credential(
    payload: CredentialCreate,
    current: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
) -> CredentialEntryRead:
    """Create a new credential entry. Encrypts ``value`` before insert.

    - 422 if source_key not in CREDENTIAL_FIELDS.
    - 422 if credential_name not in CREDENTIAL_FIELDS[source_key].
    - 409 on UQ violation (use DELETE-then-POST to rotate).
    """
    if payload.source_key not in CREDENTIAL_FIELDS:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown source_key '{payload.source_key}'",
        )
    if payload.credential_name not in valid_names_for(payload.source_key):
        raise HTTPException(
            status_code=422,
            detail=(
                f"credential_name '{payload.credential_name}' is not in "
                f"CREDENTIAL_FIELDS['{payload.source_key}']"
            ),
        )

    row = IntegrationCredential(
        source_key=payload.source_key,
        credential_name=payload.credential_name,
        encrypted_value=encrypt(payload.value),
        created_by_user_id=current.id,
        last_rotated_at=datetime.utcnow(),
    )
    db.add(row)
    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail=(
                f"Credential ({payload.source_key}, {payload.credential_name}) "
                f"already exists — DELETE then POST to rotate"
            ),
        ) from exc
    await db.commit()
    await db.refresh(row)
    return _to_read(row)


@router.delete("/{credential_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_credential(
    credential_id: uuid.UUID,
    current: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a credential entry. Emits an ``audit_logs`` row before delete."""
    row = await db.get(IntegrationCredential, credential_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Credential not found")

    audit = AuditLog(
        actor_user_id=current.id,
        action="credential_rotated",
        target_type="integration_credential",
        target_id=str(row.id),
        event_metadata={
            "source_key": row.source_key,
            "credential_name": row.credential_name,
        },
    )
    db.add(audit)
    await db.delete(row)
    await db.commit()
    return None
