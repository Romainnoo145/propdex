# Phase 57: Codebase Globalization - Research

**Researched:** 2026-02-26  
**Domain:** Frontend architecture consolidation  
**Confidence:** HIGH

---

## Summary

The current frontend is feature-rich but repeats critical logic in multiple files. This increases regression risk, makes fixes slower, and causes subtle behavior drift between views.

Globalization should happen now, before further UX work, so the upcoming dedicated developer workspace is built on stable shared primitives and selectors.

The duplication is concentrated in six clear clusters:
1. Domain normalization helpers
2. Wijk bbox resolution helper
3. Metric chip + icon implementations
4. Map deep-link parameter assembly
5. GeoJSON fetching/caching patterns
6. Search-input anti-password-manager attribute sets

All clusters are low-to-medium risk refactors with high maintenance payoff.

---

## Standard Stack

| Layer | Standard | Notes |
|------|----------|------|
| Shared domain utils | `frontend/src/lib/*` | pure functions, zero React dependencies |
| Shared UI primitives | `frontend/src/components/primitives/*` | style and behavior parity |
| Shared data hooks | `frontend/src/hooks/*` | TanStack Query-driven caching |
| Route navigation builders | `frontend/src/lib/navigation/*` | typed map search param builders |
| Validation | `npm run -s typecheck`, `npm run -s build` | mandatory per plan |

---

## Findings and Globalization Targets

### 1) Duplicated domain helper functions

- `normalizeAreaName` and `normalizeGemeenteCode` appear in multiple routes/components.
- Risk: slightly diverging normalization rules across map/projects/meldingen.
- Target: one shared source in `frontend/src/lib/geo/normalizers.ts`.

### 2) Duplicated wijk-bbox resolution

- `resolveWijkBbox` implemented twice with same matching rules.
- Risk: inconsistent wijk focus behavior.
- Target: move to `frontend/src/lib/geo-utils.ts` or dedicated `lib/geo/wijk.ts`.

### 3) Duplicated metric chips/icons

- Visual chip logic (`zero` vs highlighted tone) repeats across gemeente/wijk cards.
- Risk: style drift and repeated class strings.
- Target: reusable `MetricChip` and shared icon exports.

### 4) Duplicated map deep-link construction

- Multiple places build `/map` search params manually (`parcel_id`, `postcode/huisnummer`, `gemeente_code`, `wijk_naam`, `_t`).
- Risk: inconsistent behavior and stale map state.
- Target: centralized typed builders in `frontend/src/lib/navigation/mapSearch.ts`.

### 5) Duplicated GeoJSON lifecycle

- Manual `fetchGemeenteGeoJSON` / `fetchProvincieGeoJSON` usage in routes/components.
- Risk: repeated network calls and inconsistent loading behavior.
- Target: `useGemeenteGeoJSON` and `useProvincieGeoJSON` query hooks.

### 6) Duplicated search input attributes

- LastPass/autofill suppression attributes are copy-pasted.
- Risk: one screen regresses while others stay fixed.
- Target: shared `SearchInput` primitive with default anti-autofill props.

---

## Recommended Execution Order

1. Plan 57-01: shared domain helpers + map builders (highest logic risk reduction)
2. Plan 57-02: shared UI primitives (metric chips/icons/search input)
3. Plan 57-03: shared GeoJSON hooks + workspace selectors
4. Plan 57-04: repo guardrails + cleanup verification + phase closure

---

## Success Signal

This phase is successful when new UX work can be implemented by composing shared modules, without adding duplicated utility logic in feature routes.
