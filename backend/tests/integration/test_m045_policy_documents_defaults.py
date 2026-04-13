"""Regression test — M045/S01 T08: policy_documents column defaults.

Iron rule: every pre-M045 policy_document must remain visible after the
is_global migration. The migration backfills all existing rows via
server_default='true', and the SQLAlchemy model's application-layer
default is False (defense in depth — service layer must explicitly set
is_global=True on vendor uploads).

This test verifies the DB-level column defaults work correctly by
inserting a row without specifying is_global or version_number and
asserting both get populated. If a future cleanup changes the migration
default to False, this test fails — catching the M045 data-loss bug
that was caught during design review.
"""


import pytest
from sqlalchemy import select, text

from app.models.organization import Organization
from app.models.policy_document import PolicyDocument
from app.models.user import User


@pytest.fixture
async def test_vendor_user(test_db):
    """Create a test vendor org + user for policy_documents inserts."""
    org = Organization(name="Test Vendor Org")
    test_db.add(org)
    await test_db.flush()

    user = User(
        email="vendor@test.example",
        hashed_password="hashed",
        full_name="Test Vendor",
        organization_id=org.id,
        email_verified=True,
        auth_provider="email",
        is_active=True,
    )
    test_db.add(user)
    await test_db.commit()
    return user, org


async def test_policy_documents_is_global_default_is_true(test_db, test_vendor_user):
    """
    Inserting a policy_document via raw SQL WITHOUT specifying is_global
    must get is_global=true from the DB server_default.

    This is the regression test for the data-loss bug: if the migration's
    column default was changed to false, existing pre-M045 rows would
    become invisible to the cascade query (WHERE is_global=true).
    """
    user, org = test_vendor_user

    # Insert via raw SQL, omitting is_global and version_number to force defaults
    result = await test_db.execute(
        text(
            """
            INSERT INTO policy_documents (
                id, entity_type, entity_code, source_key,
                filename, content_type, file_data, file_size,
                uploaded_by_user_id, organization_id, status
            ) VALUES (
                gen_random_uuid(), 'gemeente', 'GM0983', 'welstandsnota',
                'test.pdf', 'application/pdf', :file_data, :file_size,
                :user_id, :org_id, 'uploaded'
            ) RETURNING id, is_global, version_number
            """
        ),
        {
            "file_data": b"dummy pdf content",
            "file_size": 17,
            "user_id": user.id,
            "org_id": org.id,
        },
    )
    row = result.one()
    await test_db.commit()

    assert row.is_global is True, (
        "is_global server_default must be true — otherwise pre-M045 rows "
        "become invisible to the cascade query and the M045 data-loss bug returns"
    )
    assert row.version_number == 1, (
        "version_number server_default must be 1 — first upload of a source"
    )

    # Also verify via the ORM that the row is readable with is_global=true filter
    stmt = select(PolicyDocument).where(
        PolicyDocument.id == row.id,
        PolicyDocument.is_global.is_(True),
    )
    fetched = (await test_db.execute(stmt)).scalar_one_or_none()
    assert fetched is not None, "row must be visible through is_global=true filter"
    assert fetched.version_number == 1


async def test_policy_documents_model_application_default_is_false(test_db, test_vendor_user):
    """
    The SQLAlchemy model's application-layer default is False even though
    the DB-level server_default is true. This is defense in depth: any
    write path using the ORM constructor MUST explicitly set is_global=True.

    This test proves the split by constructing a PolicyDocument in Python
    without setting is_global — the Python default is False, which would
    be overridden by the service layer's explicit is_global=True.
    """
    user, org = test_vendor_user

    doc = PolicyDocument(
        entity_type="gemeente",
        entity_code="GM0983",
        source_key="welstandsnota",
        filename="test.pdf",
        content_type="application/pdf",
        file_data=b"dummy pdf content",
        file_size=17,
        uploaded_by_user_id=user.id,
        organization_id=org.id,
        # NO is_global, NO version_number — rely on defaults
    )

    # Application-layer defaults BEFORE insert:
    # SQLAlchemy uses Python default for attribute access before flush.
    # is_global = False (application layer), version_number = 1 (application layer)
    assert doc.is_global is False or doc.is_global is None, (
        "Python-level default must NOT be True — service layer must opt in"
    )

    # But AFTER commit, the DB server_default kicks in for columns where
    # no value was provided. The application layer default=False is what
    # pydantic/SQLAlchemy uses unless overwritten. Let's verify the committed
    # row has the values we expect.
    test_db.add(doc)
    await test_db.commit()
    await test_db.refresh(doc)

    # After refresh, is_global will reflect whatever was actually stored.
    # Since the application layer set False explicitly (via the default),
    # False overrides the server_default. This is the defense-in-depth
    # contract: forgetting to set is_global=True in the service layer
    # produces a row that is INVISIBLE to the cascade query — intentional
    # failure mode that forces the service layer to opt in.
    assert doc.is_global is False, (
        "Defense in depth: constructing PolicyDocument without explicit "
        "is_global=True must yield is_global=False (cascade-invisible). "
        "This forces the service layer to opt in on every write."
    )
    assert doc.version_number == 1, "version_number application default is 1"
