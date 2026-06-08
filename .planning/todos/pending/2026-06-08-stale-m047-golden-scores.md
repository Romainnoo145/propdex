# Stale golden values in test_m047_s03_factor_registry (onbepaald scores drifted ~20pt)

**Created:** 2026-06-08
**Type:** test-debt / regression-guard
**Severity:** low (pre-existing; not a product bug — a frozen golden no longer matches)

## Symptom
`backend/tests/test_m047_s03_factor_registry.py::test_factor_registry_backward_compat`
fails: `F01 overall: got 71.6, expected 91.6 (±2.0)`.

## Diagnosis
Verified PRE-EXISTING: the test fails identically at commit `9b1807d7` (before any
M053/S03 change). The golden fixtures freeze `compute_score_v3(..., project_type="onbepaald")`
overall/potentie/risico from before M053/S01's potentie rebalance (S01 added
`beleidsalignement` at weight 10 and "rebalanced 6 potentie weights" + bumped the factor
count 25→26). That rebalance shifts the `onbepaald` baseline for fixtures scored without
cascade payloads, but the golden values were never updated.

## Why not fixed in S03
A ~20-point swing is large. Before rubber-stamping new golden values, confirm the S01
rebalance produces the *intended* onbepaald scores (i.e. that 71.6 is correct, not a
symptom of an S01 weight bug). That verification belongs with whoever owns the S01
rebalance, not this UI/matching slice.

## Fix sketch
1. Confirm the post-S01 onbepaald scores are intentional (eyeball a couple of GOLDEN_FIXTURES
   against the current potentie weight table).
2. If correct: regenerate the golden tuples in `GOLDEN_FIXTURES` and note the rebalance in
   the test docstring.
3. If a fixture exposes an actual S01 weighting bug: fix the weights, not the golden.

## Status
Flagged during M053/S03 validation. The S03 factor-count guard (26) and all
beleidsalignement/cascade tests pass; only this frozen golden is stale.
