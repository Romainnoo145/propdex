"""Pydantic DTOs for admin-facing policy document endpoints — M045/S05."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AdminPolicyOverviewRow(BaseModel):
    """One row per unique (entity_type, entity_code, source_key). Latest version only."""

    model_config = ConfigDict(from_attributes=True)

    entity_type: str
    entity_code: str
    entity_display_name: str  # e.g. "Nederland", "Limburg", "Venlo"
    source_key: str
    source_key_label: str  # from SOURCE_KEY_CATALOG
    latest_version_id: UUID
    latest_version_number: int
    latest_filename: str
    latest_uploaded_at: datetime
    latest_uploader_name: str
    version_count: int
    auto_ingest: bool  # True iff filename starts with 'koop-cvdr-'


class AdminPolicyOverviewTotals(BaseModel):
    total_docs: int
    total_gemeenten: int  # count DISTINCT gemeente entity_codes in result
    latest_upload_at: datetime | None


class AdminPolicyOverviewResponse(BaseModel):
    landelijk: list[AdminPolicyOverviewRow] = []
    provinciaal: list[AdminPolicyOverviewRow] = []
    gemeentelijk: list[AdminPolicyOverviewRow] = []
    totals: AdminPolicyOverviewTotals


class AdminPolicyVersionRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    version_number: int
    filename: str
    file_size: int
    content_type: str
    uploaded_at: datetime
    uploader_name: str


class AdminPolicyVersionsResponse(BaseModel):
    entity_type: str
    entity_code: str
    source_key: str
    source_key_label: str
    versions: list[AdminPolicyVersionRow] = []  # newest first


class AdminGemeenteEntry(BaseModel):
    """One gemeente option for the admin upload dropdown."""

    code: str  # e.g. "GM0983"
    naam: str  # best-effort display name, falls back to code if never scanned
    provincie_code: str  # e.g. "PV31"
