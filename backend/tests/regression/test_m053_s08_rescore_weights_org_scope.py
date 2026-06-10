"""REGRESSION-CRITICAL — M053/S08 rescore_weights_job org-scope guard (audit CRIT-1).

Pins the ``Project.organization_id == org_uuid`` filter in
``rescore_weights_job``'s batch query. Failure of this test means the job has
lost its org-scope constraint and will overwrite every tenant's scan_result
scores with the triggering org's custom weights — a silent multi-tenant data
corruption bug.

Iron-rule pattern (per MEMORY.md ``feedback_iron_rule_regression_pattern``):
encode 'X must not change' as a regression test, never as a comment.

Drift-detection (source-inspection test):
    Remove ``Project.organization_id == org_uuid`` from the batch query inside
    ``rescore_weights_job`` → this test fails with a clear multi-tenant breach
    message. Restore the filter → test passes.

WHY source-inspection (not behavioral):
    ``rescore_weights_job`` builds its OWN ``create_async_engine`` from
    ``settings.DATABASE_URL`` (line ~156), so it cannot safely run against the
    function-scoped ``test_db`` fixture that wraps the test database. A
    behavioral test would hit the real dev database, creating non-deterministic
    side-effects. The repository already uses this drift-detection pattern for
    the same class of multi-tenant filter bugs (see
    ``tests/regression/test_m050_s03_multitenant.py`` for precedent).

    The source string is stable — the filter ``Project.organization_id == org_uuid``
    is load-bearing business logic, not formatting — so this test is accurate
    and not brittle.

Audit context:
    ``rescore_weights_job(ctx, *, organization_id)`` is triggered by ONE org
    saving custom score weights. The batch query streamed ALL ``scan_results``
    rows across ALL tenants (no org filter). Ownership resolution is via the
    join chain:  scan_results.scan_id → area_scans.id → area_scans.project_id
    → projects.id → projects.organization_id. After the fix the batch query
    carries both joins and the ``Project.organization_id == org_uuid`` WHERE
    predicate. Rows belonging to scans without a linked project are skipped —
    they cannot be attributed to the triggering org and must not be rescored
    with its weights.
"""
from __future__ import annotations

import inspect

from app.jobs.rescore_weights import rescore_weights_job


def test_rescore_batch_query_is_org_scoped() -> None:
    """REGRESSION-CRITICAL CRIT-1: batch query must be scoped to the triggering org.

    Removing ``Project.organization_id == org_uuid`` from the batch query inside
    ``rescore_weights_job`` re-introduces the cross-tenant score-overwrite bug:
    org A saving weights would overwrite every other tenant's scores with org A's
    weights. This test fails the moment that filter is dropped.
    """
    src = inspect.getsource(rescore_weights_job)

    # The batch query must join Project to resolve ownership.
    assert "Project.organization_id" in src, (
        "rescore_weights_job batch query must filter scan_results by the "
        "owning org via Project.organization_id — else it overwrites every "
        "tenant's scores with one org's weights (audit CRIT-1). "
        "Add: .join(Project, Project.id == AreaScan.project_id)"
        ".where(..., Project.organization_id == org_uuid)"
    )

    # org_uuid must still be in scope when the filter is applied.
    assert "org_uuid" in src, (
        "rescore_weights_job must use org_uuid in the batch query filter — "
        "the variable is defined near line 170 and scopes the scan_results "
        "batch to the triggering organization only."
    )

    # The join chain must pass through AreaScan (scan_id linkage).
    assert "AreaScan" in src, (
        "rescore_weights_job batch query must join AreaScan to resolve "
        "scan_results.scan_id → area_scans.project_id — required to reach "
        "Project.organization_id for the org-scope filter."
    )
