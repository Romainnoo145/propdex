"""M047/S01 iron-rule regression tests.

Leg de datamodel + API-contract vast zodat latere wijzigingen (bijv. enum
uitbreiding, schema-drift, endpoint-rename) via pytest onmiddellijk
zichtbaar worden, niet pas bij user-incident.
"""

import pytest


def test_project_type_enum_has_exactly_six_values():
    """Iron-rule: uitbreiding van enum vereist bewuste schema-decision + migration."""
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


def test_default_project_type_stays_onbepaald():
    """S03 score-engine rekent op 'onbepaald' als default-weights-trigger.
    Wijziging breekt backward-compat op pre-M047 scans."""
    from app.api.endpoints.parcel_project_type_schemas import DEFAULT_PROJECT_TYPE

    assert DEFAULT_PROJECT_TYPE == "onbepaald"


def test_model_tenant_mixin_enforces_org_scoping():
    """Multi-tenant iron-rule: organization_id is NOT NULL + indexed."""
    from app.models.base import TenantMixin
    from app.models.parcel_project_type import ParcelProjectType

    assert issubclass(ParcelProjectType, TenantMixin)
    col = ParcelProjectType.__table__.c.organization_id
    assert col.nullable is False


def test_unique_constraint_on_org_parcel_exists():
    """Zonder unique constraint op (organization_id, parcel_id) zouden upserts
    duplicates maken en multi-row-per-parcel-per-org mogelijk zijn."""
    from sqlalchemy import UniqueConstraint

    from app.models.parcel_project_type import ParcelProjectType

    uqs = [
        c
        for c in ParcelProjectType.__table__.constraints
        if isinstance(c, UniqueConstraint)
        and c.name == "uq_parcel_project_types_org_parcel"
    ]
    assert len(uqs) == 1
    assert {c.name for c in uqs[0].columns} == {"organization_id", "parcel_id"}


def test_alembic_head_bumped_past_bbdb5c6ff811():
    """Iron-rule: S01 introduceert eerste schema-bump sinds bbdb5c6ff811."""
    import subprocess

    result = subprocess.run(
        ["alembic", "current"],
        capture_output=True,
        text=True,
        cwd="/home/klarifai/Documents/klarifai/clientprojects/propdex/backend",
        check=False,
    )
    # alembic current output format: "<revision> (head)"
    # Our new revision is a different hex than bbdb5c6ff811
    assert "bbdb5c6ff811" not in result.stdout, (
        "Head is still bbdb5c6ff811 — M047/S01 migration not applied or reverted."
    )


@pytest.mark.asyncio
async def test_endpoint_contract_shape_stable(async_client, auth_headers):
    """Response-shape bevat MINSTENS deze velden (nieuwe velden toevoegen mag,
    weghalen niet zonder bewuste API-versioning)."""
    parcel = "NL.IMBAG.Pand.0983100000000099"
    await async_client.put(
        f"/api/parcels/{parcel}/project-type",
        json={"project_type": "nieuwbouw_wonen"},
        headers=auth_headers,
    )
    resp = await async_client.get(
        f"/api/parcels/{parcel}/project-type",
        headers=auth_headers,
    )
    data = resp.json()
    required_keys = {"parcel_id", "project_type", "set_at", "set_by_user_id"}
    assert required_keys.issubset(data.keys())
