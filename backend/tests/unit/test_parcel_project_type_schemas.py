"""Unit tests voor parcel_project_type Pydantic schemas (M047/S01).

Pure type-checks: geen DB, geen HTTP. Valideren dat de enum exact 6
waardes bevat, default == 'onbepaald', en Pydantic onbekende waardes
afwijst op request-laag (voorkomt silent DB-accept in service-laag).
"""

import pytest
from pydantic import ValidationError


def test_project_type_values_is_exactly_six():
    """Iron-rule: enum moet EXACT deze 6 waardes bevatten."""
    from app.api.endpoints.parcel_project_type_schemas import PROJECT_TYPE_VALUES

    assert PROJECT_TYPE_VALUES == frozenset(
        {
            "nieuwbouw_wonen",
            "transformatie_wonen",
            "optoppen",
            "splitsen",
            "commercieel_naar_wonen",
            "onbepaald",
        }
    )
    assert len(PROJECT_TYPE_VALUES) == 6


def test_default_project_type_is_onbepaald():
    from app.api.endpoints.parcel_project_type_schemas import DEFAULT_PROJECT_TYPE

    assert DEFAULT_PROJECT_TYPE == "onbepaald"


def test_update_request_rejects_unknown_type():
    from app.api.endpoints.parcel_project_type_schemas import ProjectTypeUpdateRequest

    with pytest.raises(ValidationError):
        ProjectTypeUpdateRequest(project_type="kantoor")  # type: ignore[arg-type]
    with pytest.raises(ValidationError):
        ProjectTypeUpdateRequest(project_type="")  # type: ignore[arg-type]


def test_update_request_accepts_all_six_values():
    from app.api.endpoints.parcel_project_type_schemas import (
        PROJECT_TYPE_VALUES,
        ProjectTypeUpdateRequest,
    )

    for value in PROJECT_TYPE_VALUES:
        req = ProjectTypeUpdateRequest(project_type=value)  # type: ignore[arg-type]
        assert req.project_type == value


def test_response_accepts_default_fallback():
    """GET op een parcel zonder assignment retourneert default — set_at/set_by zijn None."""
    from app.api.endpoints.parcel_project_type_schemas import ProjectTypeResponse

    resp = ProjectTypeResponse(
        parcel_id="NL.IMBAG.Pand.0983100000000001",
        project_type="onbepaald",
    )
    assert resp.project_type == "onbepaald"
    assert resp.set_at is None
    assert resp.set_by_user_id is None
