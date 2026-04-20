"""Pydantic schemas voor per-parcel projecttype (M047/S01).

Definieert de 6-waardes Literal-enum, de default, en de request/response
modellen voor `GET/PUT /api/parcels/{parcel_id}/project-type`. Dit is de
SINGLE SOURCE OF TRUTH voor de projecttype-enum — nergens anders
dupliceren (migration, tests en toekomstige registry verwijzen hierheen).
"""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

ProjectType = Literal[
    "nieuwbouw_wonen",
    "transformatie_wonen",
    "optoppen",
    "splitsen",
    "commercieel_naar_wonen",
    "onbepaald",
]

PROJECT_TYPE_VALUES: frozenset[str] = frozenset(
    {
        "nieuwbouw_wonen",
        "transformatie_wonen",
        "optoppen",
        "splitsen",
        "commercieel_naar_wonen",
        "onbepaald",
    }
)
"""Canonical list van projecttypen. Mirror van ProjectType Literal voor
runtime-checks (migration + tests). Single source of truth — NIET elders
dupliceren."""

DEFAULT_PROJECT_TYPE: ProjectType = "onbepaald"
"""Default wanneer user niets heeft gekozen. Score-engine (M047/S03)
interpreteert dit als 'gebruik default_weight per factor, geen conditional
shift'."""


class ProjectTypeUpdateRequest(BaseModel):
    """PUT body voor project_type assignment."""

    project_type: ProjectType = Field(
        description="Projecttype voor dit perceel binnen huidige organization.",
    )


class ProjectTypeResponse(BaseModel):
    """GET/PUT response. Ontbrekende record retourneert DEFAULT_PROJECT_TYPE."""

    model_config = ConfigDict(from_attributes=True)

    parcel_id: str
    project_type: ProjectType
    set_at: datetime | None = Field(
        default=None,
        description=(
            "Moment van laatste assignment; None wanneer default wordt "
            "teruggegeven."
        ),
    )
    set_by_user_id: uuid.UUID | None = Field(
        default=None,
        description=(
            "User die deze assignment heeft gezet; None bij default-return."
        ),
    )
