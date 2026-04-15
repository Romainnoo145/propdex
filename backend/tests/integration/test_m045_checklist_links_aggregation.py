"""Integration tests for _aggregate_checklist_links helper — M045/S04 T02.

Verifies that the helper correctly aggregates ChecklistProgress rows
across org users into a ChecklistLinksBundle with per-item attribution.
"""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.documents.cascade_service import _aggregate_checklist_links
from app.models.checklist_progress import ChecklistProgress
from app.models.organization import Organization
from app.models.user import User

# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

PARCEL_ID = "NL.IMKAD.T02-TEST"


async def _make_org(db: AsyncSession, *, name: str) -> Organization:
    """Create a minimal organization."""
    org = Organization(name=name)
    db.add(org)
    await db.flush()
    return org


async def _make_user(
    db: AsyncSession,
    *,
    email: str,
    org: Organization,
    full_name: str | None = "Test User",
) -> User:
    """Create a minimal user in the given org."""
    user = User(
        email=email,
        hashed_password="hashed_dummy",
        full_name=full_name,
        organization_id=org.id,
        email_verified=True,
        auth_provider="email",
        is_active=True,
    )
    db.add(user)
    await db.flush()
    return user


def _make_progress(
    *,
    user_id: uuid.UUID,
    parcel_id: str = PARCEL_ID,
    use_case: str,
    checked_items: list[str] | None = None,
    uploaded_documents: dict[str, str] | None = None,
) -> ChecklistProgress:
    """Construct a ChecklistProgress ORM object."""
    return ChecklistProgress(
        user_id=user_id,
        parcel_id=parcel_id,
        use_case=use_case,
        checked_items=checked_items or [],
        uploaded_documents=uploaded_documents or {},
    )


# ---------------------------------------------------------------------------
# Test 1 — empty when no progress rows
# ---------------------------------------------------------------------------


async def test_empty_when_no_progress(test_db: AsyncSession) -> None:
    """All 4 use_case keys are present and empty when no ChecklistProgress rows exist."""
    org = await _make_org(test_db, name="Org T02-1")
    await test_db.commit()

    result = await _aggregate_checklist_links(PARCEL_ID, org.id, test_db)

    assert result.optoppen == {}
    assert result.splitsen == {}
    assert result.transformatie == {}
    assert result.nieuwbouw == {}


# ---------------------------------------------------------------------------
# Test 2 — single user, single item checked
# ---------------------------------------------------------------------------


async def test_single_user_single_item_checked(test_db: AsyncSession) -> None:
    """Alice checks opt-03 → checked_by has 1 entry with Alice's id and name."""
    org = await _make_org(test_db, name="Org T02-2")
    alice = await _make_user(
        test_db, email="alice@t02-2.example", org=org, full_name="Alice van Dijk"
    )
    test_db.add(
        _make_progress(user_id=alice.id, use_case="optoppen", checked_items=["opt-03"])
    )
    await test_db.commit()

    result = await _aggregate_checklist_links(PARCEL_ID, org.id, test_db)

    assert "opt-03" in result.optoppen
    checked_by = result.optoppen["opt-03"].checked_by
    assert len(checked_by) == 1
    assert checked_by[0].user_id == alice.id
    assert checked_by[0].user_name.startswith("Alice")


# ---------------------------------------------------------------------------
# Test 3 — multiple users same item checked
# ---------------------------------------------------------------------------


async def test_multiple_users_same_item_checked(test_db: AsyncSession) -> None:
    """Alice and Bob both check opt-03 → checked_by has 2 entries."""
    org = await _make_org(test_db, name="Org T02-3")
    alice = await _make_user(
        test_db, email="alice@t02-3.example", org=org, full_name="Alice van Dijk"
    )
    bob = await _make_user(
        test_db, email="bob@t02-3.example", org=org, full_name="Bob de Vries"
    )
    test_db.add(
        _make_progress(user_id=alice.id, use_case="optoppen", checked_items=["opt-03"])
    )
    test_db.add(
        _make_progress(user_id=bob.id, use_case="optoppen", checked_items=["opt-03"])
    )
    await test_db.commit()

    result = await _aggregate_checklist_links(PARCEL_ID, org.id, test_db)

    assert "opt-03" in result.optoppen
    checked_by = result.optoppen["opt-03"].checked_by
    assert len(checked_by) == 2
    user_ids = {entry.user_id for entry in checked_by}
    assert user_ids == {alice.id, bob.id}


# ---------------------------------------------------------------------------
# Test 4 — cross-org isolation (critical M045 regression test)
# ---------------------------------------------------------------------------


async def test_cross_org_isolation(test_db: AsyncSession) -> None:
    """Alice (Org A) and Carol (Org B) both check opt-03 on the same parcel.

    Each org query returns only its own user — never the other org's.
    """
    org_a = await _make_org(test_db, name="Org A T02-4")
    org_b = await _make_org(test_db, name="Org B T02-4")
    alice = await _make_user(
        test_db, email="alice@t02-4.example", org=org_a, full_name="Alice van Dijk"
    )
    carol = await _make_user(
        test_db, email="carol@t02-4.example", org=org_b, full_name="Carol Janssen"
    )

    test_db.add(
        _make_progress(user_id=alice.id, use_case="optoppen", checked_items=["opt-03"])
    )
    test_db.add(
        _make_progress(user_id=carol.id, use_case="optoppen", checked_items=["opt-03"])
    )
    await test_db.commit()

    result_a = await _aggregate_checklist_links(PARCEL_ID, org_a.id, test_db)
    result_b = await _aggregate_checklist_links(PARCEL_ID, org_b.id, test_db)

    # Org A sees only Alice
    checked_a = result_a.optoppen["opt-03"].checked_by
    assert len(checked_a) == 1, f"Org A must see exactly 1 entry, got {len(checked_a)}"
    assert checked_a[0].user_id == alice.id

    # Org B sees only Carol
    checked_b = result_b.optoppen["opt-03"].checked_by
    assert len(checked_b) == 1, f"Org B must see exactly 1 entry, got {len(checked_b)}"
    assert checked_b[0].user_id == carol.id


# ---------------------------------------------------------------------------
# Test 5 — uploaded_documents appear in linked_documents
# ---------------------------------------------------------------------------


async def test_uploaded_documents_appear_in_linked_documents(
    test_db: AsyncSession,
) -> None:
    """Alice uploads doc D1 → linked_documents has entry with correct document_id."""
    org = await _make_org(test_db, name="Org T02-5")
    alice = await _make_user(
        test_db, email="alice@t02-5.example", org=org, full_name="Alice van Dijk"
    )
    fake_doc_id = uuid.uuid4()

    test_db.add(
        _make_progress(
            user_id=alice.id,
            use_case="optoppen",
            uploaded_documents={"opt-03": str(fake_doc_id)},
        )
    )
    await test_db.commit()

    result = await _aggregate_checklist_links(PARCEL_ID, org.id, test_db)

    assert "opt-03" in result.optoppen
    linked = result.optoppen["opt-03"].linked_documents
    assert len(linked) == 1
    assert linked[0].document_id == fake_doc_id
    assert linked[0].user_id == alice.id


# ---------------------------------------------------------------------------
# Test 6 — checked and linked_document coexist on same item
# ---------------------------------------------------------------------------


async def test_checked_and_linked_document_coexist(test_db: AsyncSession) -> None:
    """Alice has opt-03 in both checked_items AND uploaded_documents → 1 check + 1 doc."""
    org = await _make_org(test_db, name="Org T02-6")
    alice = await _make_user(
        test_db, email="alice@t02-6.example", org=org, full_name="Alice van Dijk"
    )
    fake_doc_id = uuid.uuid4()

    test_db.add(
        _make_progress(
            user_id=alice.id,
            use_case="optoppen",
            checked_items=["opt-03"],
            uploaded_documents={"opt-03": str(fake_doc_id)},
        )
    )
    await test_db.commit()

    result = await _aggregate_checklist_links(PARCEL_ID, org.id, test_db)

    assert "opt-03" in result.optoppen
    item = result.optoppen["opt-03"]
    assert len(item.checked_by) == 1, "Expected 1 checked_by entry"
    assert len(item.linked_documents) == 1, "Expected 1 linked_document entry"
    assert item.checked_by[0].user_id == alice.id
    assert item.linked_documents[0].document_id == fake_doc_id


# ---------------------------------------------------------------------------
# Test 7 — all four use cases rendered
# ---------------------------------------------------------------------------


async def test_all_four_use_cases_rendered(test_db: AsyncSession) -> None:
    """Alice seeded for optoppen + splitsen → both have entries; transformatie + nieuwbouw empty."""
    org = await _make_org(test_db, name="Org T02-7")
    alice = await _make_user(
        test_db, email="alice@t02-7.example", org=org, full_name="Alice van Dijk"
    )

    test_db.add(
        _make_progress(user_id=alice.id, use_case="optoppen", checked_items=["opt-01"])
    )
    test_db.add(
        _make_progress(user_id=alice.id, use_case="splitsen", checked_items=["spl-01"])
    )
    await test_db.commit()

    result = await _aggregate_checklist_links(PARCEL_ID, org.id, test_db)

    assert "opt-01" in result.optoppen, "optoppen must have opt-01 entry"
    assert "spl-01" in result.splitsen, "splitsen must have spl-01 entry"
    assert result.transformatie == {}, "transformatie must be empty"
    assert result.nieuwbouw == {}, "nieuwbouw must be empty"


# ---------------------------------------------------------------------------
# Test 8 — user_name falls back to email when full_name is None
# ---------------------------------------------------------------------------


async def test_user_name_fallback_to_email(test_db: AsyncSession) -> None:
    """User with full_name=None → ChecklistCheck.user_name equals user.email."""
    org = await _make_org(test_db, name="Org T02-8")
    alice = await _make_user(
        test_db,
        email="alice-nofullname@t02-8.example",
        org=org,
        full_name=None,
    )
    test_db.add(
        _make_progress(user_id=alice.id, use_case="optoppen", checked_items=["opt-03"])
    )
    await test_db.commit()

    result = await _aggregate_checklist_links(PARCEL_ID, org.id, test_db)

    checked_by = result.optoppen["opt-03"].checked_by
    assert len(checked_by) == 1
    assert checked_by[0].user_name == alice.email


# ---------------------------------------------------------------------------
# Test 9 — unknown use_case is skipped defensively
# ---------------------------------------------------------------------------


async def test_unknown_use_case_defensive_skip(test_db: AsyncSession) -> None:
    """A row with use_case='legacy-value' (bypassing API validation) is silently skipped."""
    org = await _make_org(test_db, name="Org T02-9")
    alice = await _make_user(
        test_db, email="alice@t02-9.example", org=org, full_name="Alice van Dijk"
    )

    # Direct ORM insert with an unknown use_case — bypasses endpoint validation
    test_db.add(
        ChecklistProgress(
            user_id=alice.id,
            parcel_id=PARCEL_ID,
            use_case="legacy-value",
            checked_items=["old-item-01"],
            uploaded_documents={},
        )
    )
    await test_db.commit()

    result = await _aggregate_checklist_links(PARCEL_ID, org.id, test_db)

    # All 4 valid use_case keys must be empty — the legacy row was skipped
    assert result.optoppen == {}
    assert result.splitsen == {}
    assert result.transformatie == {}
    assert result.nieuwbouw == {}


# ---------------------------------------------------------------------------
# Test 10 — malformed document_id in uploaded_documents is silently skipped
# ---------------------------------------------------------------------------


async def test_malformed_document_id_skipped(test_db: AsyncSession) -> None:
    """Defensive: if uploaded_documents contains a non-UUID string, that
    item is silently skipped (not a 500). Rest of the aggregation proceeds."""
    org = await _make_org(test_db, name="Org T02-10")
    alice = await _make_user(
        test_db, email="alice@t02-10.example", org=org, full_name="Alice van Dijk"
    )
    valid_doc_id = uuid.uuid4()

    test_db.add(
        _make_progress(
            user_id=alice.id,
            use_case="optoppen",
            uploaded_documents={
                "opt-03": "not-a-uuid",
                "opt-05": str(valid_doc_id),
            },
        )
    )
    await test_db.commit()

    result = await _aggregate_checklist_links(PARCEL_ID, org.id, test_db)

    # Malformed opt-03 should produce NO linked_documents entry
    assert "opt-03" not in result.optoppen or len(result.optoppen["opt-03"].linked_documents) == 0
    # Valid opt-05 should succeed
    assert "opt-05" in result.optoppen
    assert len(result.optoppen["opt-05"].linked_documents) == 1
    assert result.optoppen["opt-05"].linked_documents[0].document_id == valid_doc_id
