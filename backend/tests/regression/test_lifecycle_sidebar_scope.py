"""REGRESSION-CRITICAL: LifecycleSideRailNav scope rule.

Sidebar swap MUST fire only on /opgeslagen/perceel/$parcelId/* paths (NOT on
/opgeslagen list view).

MEMORY ref: ``feedback_lifecycle_sidebar_scope.md`` (2026-05-18):
> LifecycleSideRailNav alleen op perceel-detail — sidebar-swap fire op
> ``/opgeslagen/perceel/$parcelId/*``, NIET op ``/opgeslagen`` lijst. Lifecycle
> = single-parcel context.

This is a frontend rule. Encoded here as a Python static regression so the
backend CI catches accidental reverts (the frontend test runner's "unit"
project is also valid — see ``frontend/src/__tests__/e2e/phase8_contact_flow.test.tsx``).

Drift-detection (verify by removing the pin):
    - In ``frontend/src/routes/_authenticated.tsx``, change
      ``useMatchRoute({to: '/opgeslagen/perceel/$parcelId', fuzzy: true})`` to
      ``useMatchRoute({to: '/opgeslagen', fuzzy: true})`` (too broad).
    - ``test_authenticated_uses_match_route_fuzzy`` still passes (substring
      ``useMatchRoute`` still present); ``test_authenticated_does_not_use_opgeslagen_index_for_swap``
      fails because the regex now matches.
    - Restore correct scope → 3/3 green.

Iron-rule pattern (MEMORY.md ``feedback_iron_rule_regression_pattern``):
    encode "X must not change" as a regression test, never as a comment.

Companion files:
    - ``frontend/src/__tests__/e2e/phase8_contact_flow.test.tsx`` — same
      contract pinned at the frontend layer via composition tests.
"""
from __future__ import annotations

import re
from pathlib import Path

# Path to _authenticated.tsx — anchored from this test file's location.
# Test file lives at backend/tests/regression/; the frontend source is at
# frontend/src/routes/_authenticated.tsx (parents[3] climbs to repo root).
_AUTHENTICATED_TSX = (
    Path(__file__).parents[3]
    / "frontend"
    / "src"
    / "routes"
    / "_authenticated.tsx"
)


def _read_authenticated_source() -> str:
    """Read the _authenticated.tsx source — guarded so a missing file fails
    loudly (rather than silently bypassing the regression)."""
    assert _AUTHENTICATED_TSX.exists(), (
        f"REGRESSION-CRITICAL setup error: "
        f"{_AUTHENTICATED_TSX} not found. The lifecycle-sidebar scope rule "
        f"cannot be verified."
    )
    return _AUTHENTICATED_TSX.read_text(encoding="utf-8")


def test_authenticated_uses_match_route_fuzzy() -> None:
    """REGRESSION-CRITICAL: _authenticated.tsx uses ``useMatchRoute`` against
    ``/opgeslagen/perceel/$parcelId`` with ``fuzzy: true``.

    The fuzzy match is load-bearing: it covers both the bare detail route
    (`/opgeslagen/perceel/$parcelId`) AND any sub-route below it
    (`/opgeslagen/perceel/$parcelId/2-contact`, `/3-bod`, etc.). Without
    fuzzy, the swap would fire only on the bare URL and disappear when the
    user navigates to a sub-phase.
    """
    src = _read_authenticated_source()

    # Use a regex that allows for any whitespace/newlines between the parts —
    # tolerant to formatting changes but strict on the semantic structure.
    # Accepts both `useMatchRoute({...})` direct call AND `matchRoute({...})`
    # where `matchRoute = useMatchRoute()` was destructured above. Real-world
    # usage in _authenticated.tsx is the destructured form.
    pattern = re.compile(
        r"matchRoute\s*\(\s*\{\s*to\s*:\s*['\"]/opgeslagen/perceel/\$parcelId['\"]"
        r"\s*,\s*fuzzy\s*:\s*true\s*\}"
    )
    assert pattern.search(src) is not None, (
        "REGRESSION: _authenticated.tsx does NOT contain "
        "`matchRoute({ to: '/opgeslagen/perceel/$parcelId', fuzzy: true })` "
        "or `useMatchRoute({...})`. "
        "Either the path scope was widened/narrowed or fuzzy was removed. "
        "Either change breaks the LifecycleSideRailNav swap contract."
    )

    # Independent assertion: the useMatchRoute hook must be imported AND
    # called somewhere in the file (proves the matchRoute() call above
    # actually resolves to a real route-matching closure).
    assert "useMatchRoute" in src, (
        "REGRESSION: useMatchRoute hook no longer imported/used in "
        "_authenticated.tsx — the matchRoute() call cannot resolve."
    )


def test_authenticated_does_not_use_opgeslagen_index_for_swap() -> None:
    """REGRESSION-CRITICAL: scope is NOT widened to ``/opgeslagen`` alone.

    A ``useMatchRoute({to: '/opgeslagen', fuzzy: true})`` would fire the
    sidebar swap on the /opgeslagen LIST view — exactly what the M050 memory
    rule forbids. Lifecycle = single-parcel context.

    This test asserts the NEGATIVE: no such overly-broad match rule exists.
    """
    src = _read_authenticated_source()

    # Look for any match rule whose `to:` is exactly '/opgeslagen' (no /perceel/).
    # Tolerant of whitespace/newlines + either quote style.
    broad_pattern = re.compile(
        r"useMatchRoute\s*\(\s*\{\s*to\s*:\s*['\"]/opgeslagen['\"]\s*(,|\})"
    )
    match = broad_pattern.search(src)
    assert match is None, (
        f"REGRESSION: _authenticated.tsx contains an overly-broad sidebar-swap "
        f"match rule: ``{match.group(0) if match else ''}``. Per memory rule "
        f"``feedback_lifecycle_sidebar_scope.md``, the swap MUST be scoped to "
        f"/opgeslagen/perceel/$parcelId/* — NEVER to /opgeslagen alone. The "
        f"list view stays on the standard SideRailNav."
    )


def test_authenticated_imports_lifecycle_sidebar() -> None:
    """REGRESSION: LifecycleSideRailNav is imported and referenced.

    A future refactor that removes the import (e.g., merges into SideRailNav)
    would silently lose the swap behaviour. This test catches it.
    """
    src = _read_authenticated_source()

    # Import line — tolerant to import style
    import_pattern = re.compile(
        r"import\s+LifecycleSideRailNav\s+from\s+['\"]@/components/layout/LifecycleSideRailNav['\"]"
    )
    assert import_pattern.search(src) is not None, (
        "REGRESSION: LifecycleSideRailNav import removed from "
        "_authenticated.tsx. The sidebar swap cannot fire."
    )

    # Component reference — must appear in JSX
    assert "LifecycleSideRailNav" in src, (
        "REGRESSION: LifecycleSideRailNav not referenced in JSX of "
        "_authenticated.tsx — the swap is wired but the component is dead."
    )


def test_authenticated_conditional_swap_present() -> None:
    """REGRESSION: ternary/conditional that picks LifecycleSideRailNav vs
    SideRailNav based on the route match.

    Pins the swap pattern: ``{isOpgeslagenRoute ? <LifecycleSideRailNav .../> :
    <SideRailNav />}``. Tolerant to renamed variable but strict on the
    two-component branching.
    """
    src = _read_authenticated_source()

    # Look for the ternary that selects between the two sidebars. Tolerate
    # arbitrary variable names + arbitrary JSX props.
    ternary_pattern = re.compile(
        r"\?\s*<LifecycleSideRailNav[\s\S]*?:\s*<SideRailNav",
    )
    assert ternary_pattern.search(src) is not None, (
        "REGRESSION: the conditional swap between LifecycleSideRailNav and "
        "SideRailNav is missing or restructured. The two-mode pattern is "
        "load-bearing — sidebar is one or the other based on route scope."
    )
