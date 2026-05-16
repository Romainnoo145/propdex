"""Pydantic v2 schemas for M049/S02 admin data-sources API."""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# REUSED from S01 (do NOT redefine)
from app.models.data_source_status import DataSourceStatusValue

SourceType = Literal["A", "B", "C"]
ActionType = Literal[
    "upload",
    "configure_credential",
    "view_versions",
    "refresh",
    "view_action_item",
]


class Action(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    action: ActionType
    enabled: bool
    label_nl: str
    reason_disabled: str | None = None


class DataSourceRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    source_key: str
    label_nl: str
    source_type: SourceType
    status: DataSourceStatusValue
    last_checked: datetime | None = None
    error_message: str | None = None
    configuratie: dict | None = None
    available_actions: list[Action]


class GemeenteDataSourcesPayload(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    gemeente_code: str = Field(pattern=r"^GM\d{4}$")
    gemeente_naam: str
    cascade_uploads: list[DataSourceRow]
    open_apis: list[DataSourceRow]
    paid_integrations: list[DataSourceRow]


class GemeenteSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    gemeente_code: str
    gemeente_naam: str
    total_sources: int
    status_counts: dict[DataSourceStatusValue, int]
    last_activity_at: datetime | None = None
