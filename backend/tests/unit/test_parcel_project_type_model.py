"""Model-shape unit tests voor ParcelProjectType (M047/S01).

Pure introspectie — geen DB. Valideren: TenantMixin inheritance,
UniqueConstraint op (organization_id, parcel_id), FK ondelete SET NULL
op set_by_user_id, set_at onupdate-configuratie.
"""

from sqlalchemy import UniqueConstraint


def test_model_tablename_is_plural():
    from app.models.parcel_project_type import ParcelProjectType

    assert ParcelProjectType.__tablename__ == "parcel_project_types"


def test_model_has_tenant_mixin():
    """Multi-tenant guard: model MOET organization_id hebben (via TenantMixin)."""
    from app.models.base import TenantMixin
    from app.models.parcel_project_type import ParcelProjectType

    assert issubclass(ParcelProjectType, TenantMixin)
    # Column present + not nullable + indexed
    col = ParcelProjectType.__table__.c.organization_id
    assert col.nullable is False
    assert any(
        "organization_id" in [c.name for c in idx.columns]
        for idx in ParcelProjectType.__table__.indexes
    )


def test_model_has_unique_org_parcel_constraint():
    """Iron-rule: (organization_id, parcel_id) is UNIQUE — één projecttype per org-per-parcel."""
    from app.models.parcel_project_type import ParcelProjectType

    unique_constraints = [
        c
        for c in ParcelProjectType.__table__.constraints
        if isinstance(c, UniqueConstraint)
    ]
    names = {c.name for c in unique_constraints}
    assert "uq_parcel_project_types_org_parcel" in names
    cols = next(
        c
        for c in unique_constraints
        if c.name == "uq_parcel_project_types_org_parcel"
    ).columns
    col_names = {c.name for c in cols}
    assert col_names == {"organization_id", "parcel_id"}


def test_set_by_user_id_is_nullable_set_null():
    """User-delete preserveert projecttype-historie."""
    from app.models.parcel_project_type import ParcelProjectType

    col = ParcelProjectType.__table__.c.set_by_user_id
    assert col.nullable is True
    fk = next(iter(col.foreign_keys))
    assert fk.ondelete == "SET NULL"


def test_set_at_auto_updates_on_change():
    """Model-shape: set_at heeft onupdate=CURRENT_TIMESTAMP."""
    from app.models.parcel_project_type import ParcelProjectType

    col = ParcelProjectType.__table__.c.set_at
    assert col.nullable is False
    # onupdate is server-side — check dat het geconfigureerd is (niet None)
    assert col.server_onupdate is not None or col.onupdate is not None
