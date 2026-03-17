# T02: 83-geo-contextualization-feed 02

**Slice:** S02 — **Milestone:** M001

## Description

Upgrade the GET /rulings/{gemeente_naam} endpoint with geo-relevance sorting and win/loss aggregation, then replace the search-driven JurisprudenceSection frontend with an auto-populated feed driven by cached rulings.

Purpose: Users see relevant court rulings automatically when viewing a gemeente, sorted by geographic relevance (gemeente-matched first), with win/loss ratio visible at a glance.
Output: Updated feed endpoint, new useGemeenteRulingsFeed hook, feed-driven JurisprudenceSection.

## Must-Haves

- [ ] "Gemeente detail view shows auto-populated chronological ruling feed without manual search"
- [ ] "Gemeente-matched rulings appear above arrondissement-level rulings in the feed"
- [ ] "Win/loss ratio is displayed as aggregate outcome percentages at the top of the feed"
- [ ] "Feed loads from cached rulings endpoint, not from free-text Rechtspraak search"

## Files

- `backend/app/api/endpoints/jurisprudence.py`
- `frontend/src/hooks/useJurisprudence.ts`
- `frontend/src/components/projects/JurisprudenceSection.tsx`
- `frontend/src/lib/api.ts`
