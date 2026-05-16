# Deferred (pre-existing) — Phase 07

## TypeScript errors in unrelated files (out of scope)

- **Discovered during:** Plan 07-01 Task 1 (`npm run check`)
- **Pre-existing baseline:** 91 TS errors across 30+ unrelated files (rapporten.tsx, resultaten.tsx, verkenner.tsx, PortfolioBreadcrumb.tsx, WijkMapPanel.tsx, etc.)
- **Verified:** Stashed Task 1 change, re-ran `npm run check` → still 91 errors. Reapplied change → still 91. My change introduces ZERO new errors.
- **Reason deferred:** Pre-existing tech debt; this plan's scope is the gemeente-aware Link only. Plan 07-01 acceptance criterion `npm run check exits 0` is impossible without scoping a separate cleanup phase.
- **Recommendation:** Schedule a dedicated TS-strict-cleanup phase. Most errors trace to TanStack Router required `search` typing + framer-motion `Variants` type tightening — mechanical to fix.

