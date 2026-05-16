"""End-to-end smoke for M049/S06 ActionItems deprecation.

Locks convergence between Plan 04 (upload route), Plan 04.1 (best-effort enqueue),
Plan 06-01 (view_action_item action), Plan 06-02 (frontend deprecation).

Tests:
  T1 — admin upload-to-live flow ends with view_action_item action visible
  T2 — codebase grep: no internal Link/navigate to /instellingen/action-items
  T3 — frontend routeTree.gen.ts contains the redirect route registration
  T4 — ActionItem DB entity preserved (or N/A skip)

T1 uses source_key='welstandsnota' because it IS in ACTION_ITEMS_CATALOG (woonvisie
is not — Plan 06-01 already adopted this correction). The plan's underlying
intent (convergence across upload + status flip + view_action_item) is preserved.
document_summary_job is enqueued for all uploads; rescore_parcels_for_document
is gated to woonvisie and is covered by test_m049_s04_1_upload_rescore.py.
"""
from __future__ import annotations

import subprocess
import uuid
from pathlib import Path
from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import create_access_token
from app.main import app
from app.models.area_scan import AreaScan
from app.services.action_items_catalog import ACTION_ITEMS_CATALOG

# Repo root: <repo>/backend/tests/integration/<file> → parents[3] is repo root.
REPO_ROOT = Path(__file__).resolve().parents[3]

EXPECTED_ACTION_ITEMS_FILES = {
    # Files EXPECTED to contain '/action-items' as a string. Any OTHER occurrence
    # in frontend/src/ is a stray internal link → fail T2.
    "frontend/src/routes/_authenticated/instellingen.action-items.tsx",
    "frontend/src/lib/types/action-items.ts",
    "frontend/src/lib/constants/actionItemsCatalog.ts",
    "frontend/src/routeTree.gen.ts",
    # ActionItemDetailModal imports from lib/types/action-items — type import only,
    # not a navigation link. Whitelisted per Plan 06-02 grep contract.
    "frontend/src/components/settings/data-bronnen/ActionItemDetailModal.tsx",
}

# welstandsnota is Type-A AND in ACTION_ITEMS_CATALOG — see module docstring.
CATALOG_KEY = "welstandsnota"


def _superuser_headers(user_id, org_id) -> dict[str, str]:
    token = create_access_token(str(user_id), str(org_id))
    return {"Authorization": f"Bearer {token}"}


async def _seed_area_scan(
    db: AsyncSession, gemeente_code: str, gemeente_naam: str
) -> None:
    """Seed AreaScan so get_gemeente_name_map resolves code → naam."""
    scan = AreaScan(
        id=uuid.uuid4(),
        gemeente_code=gemeente_code,
        gemeente_naam=gemeente_naam,
        bbox_minx=5.9,
        bbox_miny=51.3,
        bbox_maxx=6.2,
        bbox_maxy=51.5,
        status="completed",
    )
    db.add(scan)
    await db.commit()


# ── T1: full admin flow ──────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_e2e_admin_upload_to_live_with_action_item(
    async_client: AsyncClient,
    test_db: AsyncSession,
    create_test_user,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """T1 — Admin uploads welstandsnota → status flips to live → view_action_item visible."""
    from app.core.config import settings

    assert CATALOG_KEY in ACTION_ITEMS_CATALOG, (
        f"Precondition: {CATALOG_KEY} in ACTION_ITEMS_CATALOG"
    )

    user, org = await create_test_user(email="s06_e2e_t1@test", is_superuser=True)
    monkeypatch.setattr(settings, "VENDOR_ORG_ID", org.id)
    await _seed_area_scan(test_db, "GM0983", "Venlo")

    # Mock arq_pool on app.state — Plan 04.1 try/finally pattern. httpx
    # AsyncClient has no .app attribute (ASGITransport wraps a shared global
    # app); direct mutation with save/restore is the authoritative pattern.
    mock_pool = AsyncMock()
    original_arq_pool = getattr(app.state, "arq_pool", None)
    app.state.arq_pool = mock_pool
    try:
        # ── Step 1: first GET — row is 'missing', view_action_item already present ──
        first_get = await async_client.get(
            "/api/admin/data-sources/GM0983",
            headers=_superuser_headers(user.id, org.id),
        )
        assert first_get.status_code == 200, first_get.text
        first_payload = first_get.json()
        first_row = next(
            (r for r in first_payload["cascade_uploads"]
             if r["source_key"] == CATALOG_KEY),
            None,
        )
        assert first_row is not None, (
            f"{CATALOG_KEY} row missing from initial cascade_uploads"
        )
        assert first_row["status"] == "missing", (
            f"Expected initial status='missing', got {first_row['status']}"
        )
        # view_action_item is present even when missing — Plan 06-01 Task 2 behavior
        first_actions = [a["action"] for a in first_row["available_actions"]]
        assert "view_action_item" in first_actions, (
            f"view_action_item missing from initial actions: {first_actions}"
        )
        first_last_checked = first_row["last_checked"]

        # ── Step 2: POST upload PDF ──
        pdf_bytes = b"%PDF-1.4\n%minimal smoke\n%%EOF"
        upload_resp = await async_client.post(
            f"/api/policy-documents/gemeente/GM0983?source_key={CATALOG_KEY}",
            files={"file": (f"{CATALOG_KEY}.pdf", pdf_bytes, "application/pdf")},
            headers=_superuser_headers(user.id, org.id),
        )
        assert upload_resp.status_code == 201, upload_resp.text
        doc_id = upload_resp.json()["id"]
        assert doc_id, "Upload response missing id"

        # Verify document_summary_job enqueued (Plan 04.1 contract — applies to
        # all uploads, not gated by source_key)
        call_jobs = [c.args[0] for c in mock_pool.enqueue_job.call_args_list]
        assert "document_summary_job" in call_jobs, (
            f"document_summary_job not enqueued; calls={call_jobs}"
        )

        # ── Step 3: POST refresh — flips status to 'live' via probe orchestrator ──
        refresh_resp = await async_client.post(
            f"/api/admin/data-sources/GM0983/{CATALOG_KEY}/refresh",
            headers=_superuser_headers(user.id, org.id),
        )
        assert refresh_resp.status_code == 200, refresh_resp.text
        refreshed_row = refresh_resp.json()
        assert refreshed_row["status"] == "live", (
            f"After refresh expected status='live', got: {refreshed_row}"
        )

        # ── Step 4: second GET — row is 'live', last_checked set, 4 actions exact order ──
        second_get = await async_client.get(
            "/api/admin/data-sources/GM0983",
            headers=_superuser_headers(user.id, org.id),
        )
        assert second_get.status_code == 200, second_get.text
        second_row = next(
            (r for r in second_get.json()["cascade_uploads"]
             if r["source_key"] == CATALOG_KEY),
            None,
        )
        assert second_row is not None
        assert second_row["status"] == "live"
        assert second_row["last_checked"] is not None, (
            f"After refresh expected last_checked set, got None. first={first_last_checked}"
        )

        # Exact-order action assertion — matches Plan 06-01 Task 3 T3 contract
        action_keys = [a["action"] for a in second_row["available_actions"]]
        assert action_keys == [
            "view_versions",
            "upload",
            "refresh",
            "view_action_item",
        ], (
            f"Expected exact order "
            f"[view_versions, upload, refresh, view_action_item], got {action_keys}"
        )
    finally:
        app.state.arq_pool = original_arq_pool


# ── T2: codebase grep enforcement ────────────────────────────────────────────
def test_e2e_grep_no_internal_action_items_links() -> None:
    """T2 — frontend/src/ has NO stray internal links to /instellingen/action-items.

    Allowed files: the redirect route, TS types, TS constants, generated routeTree.
    Anything else with '/action-items' is a stray Link/navigate → fail.
    """
    frontend_src = REPO_ROOT / "frontend" / "src"
    if not frontend_src.exists():
        pytest.skip(
            f"frontend/src not present at {frontend_src} — skip cross-stack grep guard. "
            "This test only runs in environments where the frontend tree is checked out "
            "alongside the backend (full monorepo CI matrix). Backend-only CI lanes "
            "skip it cleanly without false-positive failures."
        )

    # Use rg if available, fall back to grep
    rg_check = subprocess.run(["which", "rg"], capture_output=True, text=True)
    rg_path = rg_check.stdout.strip()
    if rg_path:
        result = subprocess.run(
            ["rg", "-n", "--no-heading", "/action-items", str(frontend_src)],
            capture_output=True,
            text=True,
        )
    else:
        result = subprocess.run(
            ["grep", "-rn", "/action-items", str(frontend_src)],
            capture_output=True,
            text=True,
        )

    if not result.stdout.strip():
        return  # no matches anywhere — best case

    offending: list[str] = []
    for line in result.stdout.splitlines():
        # Line format: "<absolute-path>:<lineno>:<text>"
        path = line.split(":", 1)[0]
        try:
            rel = Path(path).resolve().relative_to(REPO_ROOT)
        except ValueError:
            continue
        if str(rel) not in EXPECTED_ACTION_ITEMS_FILES:
            offending.append(line)

    assert not offending, (
        "Stray internal '/action-items' references in frontend/src/:\n"
        + "\n".join(offending)
    )


# ── T3: redirect route registered ────────────────────────────────────────────
def test_e2e_redirect_route_registered_in_router() -> None:
    """T3 — frontend/src/routeTree.gen.ts has the /instellingen/action-items route."""
    route_tree = REPO_ROOT / "frontend" / "src" / "routeTree.gen.ts"
    if not route_tree.exists():
        pytest.skip(
            f"routeTree.gen.ts not present at {route_tree} — skip frontend-route guard. "
            "Backend-only CI lanes skip cleanly; full monorepo CI runs the assertion."
        )
    content = route_tree.read_text()
    occurrences = content.count("instellingen/action-items")
    assert occurrences >= 4, (
        f"Expected ≥4 occurrences of 'instellingen/action-items' in routeTree.gen.ts "
        f"(id + path + fullPath + type-map), got {occurrences}. "
        "Did Plan 06-02 Task 3 run the TanStack Router codegen?"
    )


# ── T4: ActionItem DB entity audit ───────────────────────────────────────────
def test_e2e_action_item_db_entity_preserved() -> None:
    """T4 — MIG-03 audit: ActionItem DB entity is preserved (or N/A if no model exists).

    Tries to import the legacy ActionItem SQLAlchemy model. If the import fails
    (no such model existed — the legacy ActionItems was a frontend-only construct),
    skip with an explanatory message documenting what was audited.
    """
    candidate_modules = [
        "app.models.action_item",
        "app.models.action_items",
        "app.models",  # last-ditch: maybe ActionItem is exposed at top of package
    ]
    found: type | None = None
    for mod_name in candidate_modules:
        try:
            mod = __import__(mod_name, fromlist=["ActionItem"])
        except ImportError:
            continue
        cls = getattr(mod, "ActionItem", None)
        if cls is not None:
            found = cls
            break

    if found is None:
        pytest.skip(
            "No ActionItem SQLAlchemy model exists in the codebase. "
            "MIG-03 is N/A on backend — the legacy ActionItems page was frontend-only "
            "(content lived in components/documentation/ActionItems.tsx ITEMS array). "
            "M049/S06 migrated that content to backend/app/services/action_items_catalog.py. "
            "No DB entity to preserve; deprecation is UI-paths-only as designed."
        )

    # Found a model — assert it's still a real SQLAlchemy mapping
    assert hasattr(found, "__tablename__") and found.__tablename__, (
        f"ActionItem model {found!r} has no __tablename__ — was it accidentally unmapped?"
    )
