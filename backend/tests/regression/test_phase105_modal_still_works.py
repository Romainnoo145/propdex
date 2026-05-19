"""REGRESSION-CRITICAL: Phase 105 ephemeral BRK lookup MUST NOT regress after
Plan 08-01 added new GET /api/parcels/{id}/brk endpoint (M050/S06 read-path).

Schema BRKOwnership (Phase 105 ephemeral) ≠ BRKOwnershipRecordRead
(M050/S02 persist channel) — separate code paths, separate URLs, separate
response shapes. This file pins the route-shadow + schema-distinction
contract.

Companion regression files (DO NOT duplicate, mutual reinforcement):
    - ``tests/regression/test_phase105_brk_modal_still_works.py`` — pins the
      service-layer signature + persist-pad-isolation + D14 schema-disjointness
      (S01 + S02 invariants).
    - ``tests/regression/test_brk_bevragen_signature_drift.py`` — pins the
      BRKBevragenClient.get_eigendom signature (D14 d).
    - ``tests/regression/test_multi_tenant_brk_isolation.py`` — pins the
      AD2 cross-org silent isolation iron-rule.

This file specifically pins:
    1. Phase 105 endpoint URL (/api/parcels/{uuid}/eigendom) is registered
       and resolves to its handler (not shadowed by the new GET).
    2. Phase 105 handler returns BRKOwnership schema (NOT BRKOwnershipRecordRead).
    3. Phase 105 handler signature unchanged kwargs from pre-M050 baseline.
    4. New GET /brk endpoint does NOT shadow the Phase 105 /eigendom route.

Drift-detection procedure (verify by removing pins):
    - Rename Phase 105 endpoint URL → test_phase105_eigendom_route_registered fails.
    - Change response_model on Phase 105 handler → test_phase105_response_model_is_BRKOwnership fails.
    - Refactor get_parcel_eigendom signature → test_phase105_signature_drift_guard fails.

Iron rule (MEMORY.md ``feedback_iron_rule_regression_pattern``):
    encode "Phase 105 must not change" as a test, never as a comment.
"""
from __future__ import annotations

import inspect

from fastapi.routing import APIRoute

from app.main import app
from app.schemas.brk_ownership import BRKOwnership
from app.schemas.brk_ownership_record import BRKOwnershipRecordRead

# ──────────────────────────────────────────────────────────────────────────
# Test 1: Phase 105 endpoint /api/parcels/{parcel_id}/eigendom registered
# ──────────────────────────────────────────────────────────────────────────


def _find_route(path: str, method: str) -> APIRoute | None:
    """Find a registered FastAPI route by path + method."""
    for route in app.routes:
        if not isinstance(route, APIRoute):
            continue
        if route.path == path and method.upper() in route.methods:
            return route
    return None


def test_phase105_eigendom_route_registered() -> None:
    """REGRESSION-CRITICAL: Phase 105 /eigendom URL still registered.

    Plan 08-01 added GET /api/parcels/{parcel_id}/brk. This test proves
    the LEGACY Phase 105 endpoint at /api/parcels/{parcel_id}/eigendom is
    still in the route table — distinct URL, not shadowed.
    """
    route = _find_route("/api/scans/parcels/{parcel_id}/eigendom", "GET")
    assert route is not None, (
        "REGRESSION: Phase 105 endpoint /api/parcels/{parcel_id}/eigendom "
        "is NOT registered. Either the route was removed (AVG re-review "
        "required) or the path was renamed. The BRK Eigendom Modal will break."
    )


def test_new_brk_route_does_not_shadow_phase105() -> None:
    """REGRESSION-CRITICAL: new GET /brk route does NOT collide with Phase 105.

    Both endpoints share the prefix `/api/parcels/{parcel_id}/...` but their
    trailing segments differ:
      - Phase 105: /eigendom (ephemeral, BRKOwnership schema)
      - M050/S02: /brk      (persisted, BRKOwnershipRecordRead schema)
    Distinct URLs → distinct routes → no shadowing. This test pins that fact.
    """
    p105_route = _find_route("/api/scans/parcels/{parcel_id}/eigendom", "GET")
    s02_route = _find_route("/api/parcels/{parcel_id}/brk", "GET")

    assert p105_route is not None, "Phase 105 /eigendom route missing"
    assert s02_route is not None, "M050/S06 /brk route missing"

    # Sanity: distinct route objects, distinct paths
    assert p105_route.path != s02_route.path, (
        "REGRESSION: route paths collided — Phase 105 and M050/S06 GET handlers "
        "now map to the same URL. One will shadow the other."
    )
    assert p105_route.endpoint is not s02_route.endpoint, (
        "REGRESSION: endpoint functions collided — Phase 105 ephemeral and "
        "M050/S06 read paths now resolve to the same Python handler."
    )


# ──────────────────────────────────────────────────────────────────────────
# Test 2: Phase 105 response_model is BRKOwnership (NOT BRKOwnershipRecordRead)
# ──────────────────────────────────────────────────────────────────────────


def test_phase105_response_model_is_BRKOwnership_not_BRKOwnershipRecordRead() -> None:
    """REGRESSION-CRITICAL: Phase 105 returns BRKOwnership shape, NEVER the
    persist-channel schema.

    Iron-rule from ENG-PLAN AD2/D14: the ephemeral channel (BRKOwnership,
    never_cache=True) and the persist channel (BRKOwnershipRecordRead) MUST
    have disjoint shapes. If Phase 105's response_model ever drifts to the
    persist schema, AVG re-review is mandatory (the never_cache=True marker
    is the load-bearing Tier-3 defense).
    """
    route = _find_route("/api/scans/parcels/{parcel_id}/eigendom", "GET")
    assert route is not None, "Phase 105 route missing — see test_phase105_eigendom_route_registered"

    assert route.response_model is BRKOwnership, (
        f"REGRESSION: Phase 105 response_model drifted to "
        f"{route.response_model!r}. Expected BRKOwnership (ephemeral, "
        f"never_cache=True). If this changed intentionally, AVG-Tier-3 "
        f"re-review is required before merge."
    )

    # Negative assertion: the persist schema is NOT the response_model.
    assert route.response_model is not BRKOwnershipRecordRead, (
        "REGRESSION: Phase 105 endpoint now returns the persist schema "
        "BRKOwnershipRecordRead. This conflates the ephemeral and persist "
        "channels — the two MUST stay disjoint per D14 (e)."
    )


def test_new_brk_endpoint_response_model_is_list_BRKOwnershipRecordRead() -> None:
    """Symmetric pin: new GET /brk returns list[BRKOwnershipRecordRead], NOT
    BRKOwnership.

    Pairs with the previous test to prove the two endpoints have disjoint
    response shapes. If anyone "unifies" them, both pins fail loudly.
    """
    route = _find_route("/api/parcels/{parcel_id}/brk", "GET")
    assert route is not None, "M050/S06 /brk route missing"

    # The compiled response_model is list[BRKOwnershipRecordRead] — origin is list,
    # args is (BRKOwnershipRecordRead,).
    response_model = route.response_model
    origin = getattr(response_model, "__origin__", None)
    args = getattr(response_model, "__args__", ())

    assert origin is list, (
        f"REGRESSION: M050/S06 /brk response_model not list[...]: {response_model!r}"
    )
    assert args == (BRKOwnershipRecordRead,), (
        f"REGRESSION: M050/S06 /brk response_model item type drifted: {args!r}"
    )


# ──────────────────────────────────────────────────────────────────────────
# Test 3: Phase 105 handler signature drift guard
# ──────────────────────────────────────────────────────────────────────────


def test_phase105_signature_drift_guard() -> None:
    """REGRESSION-CRITICAL: Phase 105 handler kwargs unchanged.

    Mirrors the M050/S01 P03 signature-drift pattern. If anyone refactors
    get_parcel_eigendom under M050+, this test fails and forces re-review
    of the AVG-Tier-3 ephemeral contract.

    Pinning the service-layer function (NOT the FastAPI route handler) —
    the service is the true contract; the route is a thin wrapper.
    """
    from app.scans.parcels_service import get_parcel_eigendom

    sig = inspect.signature(get_parcel_eigendom)
    params = list(sig.parameters.keys())
    assert params == ["db", "parcel_id"], (
        f"REGRESSION: get_parcel_eigendom signature drift detected: {params}. "
        f"Phase 105 contract requires (db, parcel_id). Re-review AVG "
        f"implications before merging."
    )


def test_phase105_route_param_type_is_uuid() -> None:
    """REGRESSION: Phase 105 route param type pinned to uuid.UUID.

    The new GET /brk endpoint uses `parcel_id: str` (Plan 08-01). Phase 105
    uses `parcel_id: uuid.UUID`. Different parameter types prevent accidental
    confusion at the route-resolution layer; also documents the legacy contract.
    """
    import uuid

    from app.scans.parcels_router import get_parcel_eigendom as handler

    sig = inspect.signature(handler)
    parcel_id_param = sig.parameters.get("parcel_id")
    assert parcel_id_param is not None, (
        "REGRESSION: Phase 105 handler missing parcel_id parameter"
    )
    assert parcel_id_param.annotation is uuid.UUID, (
        f"REGRESSION: Phase 105 parcel_id param type drifted from uuid.UUID "
        f"to {parcel_id_param.annotation!r}. This affects route resolution + "
        f"validation."
    )


# ──────────────────────────────────────────────────────────────────────────
# Test 4: Schema-disjointness sanity (re-pinned here for traceability)
# ──────────────────────────────────────────────────────────────────────────


def test_BRKOwnership_and_BRKOwnershipRecordRead_are_distinct_classes() -> None:
    """REGRESSION-CRITICAL: the two schemas are NOT the same class.

    Cheap sanity check: a future refactor where someone aliases
    `BRKOwnership = BRKOwnershipRecordRead` would silently merge the two
    channels. This test catches that immediately.
    """
    assert BRKOwnership is not BRKOwnershipRecordRead, (
        "REGRESSION: BRKOwnership and BRKOwnershipRecordRead are now the same "
        "class. The ephemeral and persist channels have been conflated — "
        "AVG-Tier-3 re-review required before merge (never_cache defense)."
    )

    # never_cache marker MUST remain on the ephemeral schema only
    assert getattr(BRKOwnership, "never_cache", False) is True, (
        "REGRESSION: BRKOwnership.never_cache is no longer True — AVG Tier-3 "
        "defense weakened."
    )

    # The persist schema MUST NOT have the never_cache marker (it's persisted)
    assert getattr(BRKOwnershipRecordRead, "never_cache", False) is False, (
        "REGRESSION: BRKOwnershipRecordRead now declares never_cache=True. "
        "This would forbid the persist channel from caching, contradicting "
        "M050/S01 30-day retention contract."
    )
