# T02: 86-trend-statistics 02

**Slice:** S05 — **Milestone:** M001

## Description

Build CSS-only trend visualization and statistics bar, integrate into JurisprudenceSection.

Purpose: Delivers TREND-01 (visual score trend), TREND-02 (stats bar), and TREND-03 (CSS-only, graceful degradation). Completes v13.0 milestone.
Output: Two new components + hook + integration into existing section.

## Must-Haves

- [ ] "GemeenteDetailView shows a rolling 12-month bar chart of klimaat score trend"
- [ ] "Statistics bar shows totaal uitspraken, gemiddelde doorlooptijd, and succespercentage"
- [ ] "When fewer than 3 months have data, shows 'Onvoldoende data voor trendweergave' instead of chart"
- [ ] "No chart library is used -- visualization is CSS-only (flexbox bars)"

## Files

- `frontend/src/lib/api.ts`
- `frontend/src/hooks/useJurisprudence.ts`
- `frontend/src/components/projects/TrendTimeline.tsx`
- `frontend/src/components/projects/StatisticsBar.tsx`
- `frontend/src/components/projects/JurisprudenceSection.tsx`
