# rescore_cascade_job drops cascade payloads → omgevingsvisie/woonvisie go missing

**Created:** 2026-06-08
**Type:** bug / cascade-scoring
**Severity:** medium (can make a saved parcel's omgevingsvisie card vanish after a projecttype change)

## Diagnosis
`app/jobs/rescore_cascade_job.py:348` re-scores a single parcel with its real projecttype:

```python
project_type_value = pt_response.project_type
score_result = compute_score_v3(flags, project_type=project_type_value)   # <-- no cascade_payloads
```

It calls `compute_score_v3(...)` **without** `cascade_payloads`. So `_cascade = {}` →
`score_beleidsalignement(None, ...)` and `score_woonvisie_match(None, ...)` both return
`missing=True`. The rebuilt `score_breakdown` then has beleidsalignement/woonvisie as
missing — i.e. setting a projecttype on a saved parcel strips its omgevingsvisie + woonvisie
factors (and the OmgevingsvisiePopup loses its data).

## Why it matters now (M053/S03)
The beleidsalignement verdict is the onbepaald baseline from `backfill_cascade_scores`.
The projecttype-lens is supposed to refine it (verdict is now projecttype-aware as of
S03), but this job can't because it never loads the cascade payloads. Two consequences:
1. The projecttype lens never actually re-computes the beleidsalignement verdict.
2. Worse: a re-score under this path *removes* the factor.

## Fix sketch
Before the `compute_score_v3` call, load the gemeente cascade payloads (reuse
`get_cascade_payloads(db, parcel_id=..., gemeente_code=..., organization_id=...)` from
`app/services/cascade_enrichment_service.py`, the same helper the backfill/area_scan use)
and pass `cascade_payloads=...`. Then the lens recomputes woonvisie + beleidsalignement
with the real projecttype.

## Status
Flagged during M053/S03 (verdict-lens design). Not fixed in S03 (scope). Verify the
"card vanishes after projecttype set" repro on a saved Hauzer parcel before/after the fix.
