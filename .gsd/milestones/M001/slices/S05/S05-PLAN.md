# S05: Trend Statistics

**Goal:** Add a trend endpoint that returns rolling 12-month klimaat score data and aggregated statistics per gemeente.
**Demo:** Add a trend endpoint that returns rolling 12-month klimaat score data and aggregated statistics per gemeente.

## Must-Haves


## Tasks

- [x] **T01: 86-trend-statistics 01** `est:2min`
  - Add a trend endpoint that returns rolling 12-month klimaat score data and aggregated statistics per gemeente.

Purpose: Provides the data layer for TREND-01 (monthly score trend) and TREND-02 (aggregated statistics bar). The frontend plan (86-02) will consume this endpoint.
Output: Single new endpoint in existing jurisprudence router.
- [x] **T02: 86-trend-statistics 02** `est:5min`
  - Build CSS-only trend visualization and statistics bar, integrate into JurisprudenceSection.

Purpose: Delivers TREND-01 (visual score trend), TREND-02 (stats bar), and TREND-03 (CSS-only, graceful degradation). Completes v13.0 milestone.
Output: Two new components + hook + integration into existing section.

## Files Likely Touched

- `backend/app/api/endpoints/jurisprudence.py`
- `frontend/src/lib/api.ts`
- `frontend/src/hooks/useJurisprudence.ts`
- `frontend/src/components/projects/TrendTimeline.tsx`
- `frontend/src/components/projects/StatisticsBar.tsx`
- `frontend/src/components/projects/JurisprudenceSection.tsx`
