# Propdex -- Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-10)

**Core value:** Area -> Opportunity Intelligence -- scan any Dutch municipality and instantly find development opportunities
**Current focus:** v16.0 Score Intelligence -- Phase 106 (Perceel Dossier Upload)

---

## Current Position

Phase: 106 -- Perceel Dossier Upload
Plan: 2 of 2 complete
Status: Complete
Last activity: 2026-03-12 -- Plan 106-02 complete (frontend document upload UI)

Progress: [##########] 100% (2/2 plans in phase 106)

## Performance Metrics

**Velocity:**
- Total plans completed: 19 (12 v15.0 + 7 v16.0)
- Average duration: 4min
- Total execution time: 71min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 91 | 2 | 8min | 4min |
| 92 | 2 | 6min | 3min |
| 93 | 3 | 15min | 5min |
| Phase 93 P02 | 2min | 2 tasks | 5 files |
| Phase 93 P03 | 2min | 2 tasks | 2 files |
| Phase 99 P01 | 5min | 2 tasks | 2 files |
| Phase 99 P03 | 3min | 2 tasks | 4 files |
| Phase 100 P01 | 7min | 2 tasks | 3 files |
| Phase 100 P02 | 4min | 2 tasks | 2 files |
| Phase 100 P03 | 3min | 2 tasks | 3 files |
| Phase 101 P01 | 3min | 1 task | 1 file |
| Phase 101 P02 | 2min | 2 tasks | 4 files |
| Phase 101.1 P01 | 2min | 2 tasks | 1 file |
| Phase 106 P01 | 4min | 2 tasks | 7 files |
| Phase 106 P02 | 7min | 2 tasks | 4 files |

## Accumulated Context

### Roadmap Evolution
- Phase 93.1 inserted after Phase 93: Potentie Dashboard — no-scroll investor dashboard (URGENT)
- Phase 101.1 inserted after Phase 101: Enrichment Backfill Venlo — backfill all 10 Phase 99 data sources for 137k Venlo parcels, then re-score (URGENT)

### Decisions
- SideRailNav renders after <main> in DOM so it floats on top without z-index conflicts
- ResultsShell owns its left padding (112px) rather than _authenticated handling conditional padding
- WorkspaceSwitcher replaced with P monogram (bg-aura-obsidian circle)
- Active nav state uses bg-aura-amber/20 text-aura-amber for warm highlight
- Aura glass-white defined as #ffffff (pure hex) so Tailwind opacity modifiers work
- Plus Jakarta Sans via Google Fonts CDN replaces Satoshi (92-01)
- Separate layoutId per section (base/view/intel) so toggle indicator slides within section only (92-02)
- Bestemmingsplan always visible in toggle pill (not conditional on showParcels) (92-02)
- Toggle pill at top-8, search pill at top-6 for visual separation (92-02)
- Badge teal variant uses aura-green but kept variant name for backward compat
- BentoPod explicitly excluded from backdrop-blur (locked design decision)
- Reduced-motion uses [class*=backdrop-blur] selector for generic blur detection
- Differentiated hover scales: 1.02 for pods, 1.05 for nav icons
- Gradient legend extracted from LayerToggle to map.tsx (Option B) for cleaner separation
- aura-hover-glow class uses box-shadow only (no transform) to avoid shadow-glass conflicts
- PDOK WMS proxied through backend for auth boundary and CORS avoidance
- fetchAerialCrop uses raw fetch (not apiFetch) since response is binary JPEG
- 840x360 retina aerial crop with 150m x 64m BBOX for 420px parcel hero (updated from 760x320)
- Score badge is Deep Obsidian circle (h-12 w-12) with Amber text on satellite hero
- Map re-center shifts rightward (+210px) since panel is on LEFT side
- Address header lives in ParcelDetailPanel (persists across overview/detail views)
- Glass material uses inline bg-white/60 backdrop-blur-[24px] instead of GlassPanel primitive
- Bestemming folded into Juridisch pod (no separate status bar)
- [Phase 93]: Derived state pattern (tracked parcel ID) for view reset instead of useEffect
- [Phase 93]: JuridischLayer fetches vergunningen/meldingen via hooks directly (not passed as props)
- [Phase 93]: Accordion uses local useState toggle with BentoPod interactive for consistent Aura styling
- [Phase 93]: AnimatePresence mode=wait for overview-to-detail layer transitions
- [Phase 93]: Green PillBadge for kansen, amber for aandachtspunten
- [Phase 93]: Module-level prefers-reduced-motion detection with opacity-only fallback
- [Phase 99]: Bodemloket deduplicates at 1m rounding, BRO at 50m rounding (matching API scale)
- [Phase 99]: Funderingsrisico function prepared but NOT integrated in area_scan yet (depends on Plan 99-02)
- [Phase 99]: Bodem data stored as flags_dict keys 'bodem' and 'bodemtype' alongside existing flags
- [Phase 99]: Flags-first lookup: endpoints check scan_results.flags before external API calls
- [Phase 99]: useParcelEnrichment uses placeholderData pattern for zero-fetch flags path
- [Phase 100]: Score v3.0 split into score_v3.py (engine) + score_v3_factors.py (17 factor functions with narratives)
- [Phase 100]: FactorResult pattern: waarde, genormaliseerde_score, gewicht, bijdrage, categorie, toelichting_kort/lang, data_bronnen, missing
- [Phase 100]: Missing data: non-critical=0.5 neutral, critical risk=0.6 (+10% penalty), >20% missing triggers weight redistribution
- [Phase 100]: Deferred scoring pattern: parcels persist with score=0 in Phase 4, v3.0 scores computed in Phase 6 after all enrichment
- [Phase 100]: Phase 6 scoring non-fatal: failure leaves score=0, scan still completes
- [Phase 100]: extractScoreSubscores returns null for v3.0 (no vacancy/buildability in 17-factor model)
- [Phase 100]: PotentieLayer one-liner picks highest-bijdrage toelichting_kort for v3.0, generateOneLiner for v2.1
- [Phase 100]: v3.0 factor display grouped as POTENTIE (green) / RISICO (red) sections with bijdrage values
- [Phase 101]: Skip-unchanged optimization checks score_model_version == "score-v3.0" AND score value match
- [Phase 101]: Batch-load neighborhood_metrics from AreaScan for unique scan_ids per batch (avoids N+1)
- [Phase 101]: v3.0 detection uses categorie key presence in first score_breakdown value to distinguish from v2.1
- [Phase 101]: potentie/risico scores extracted with strict type validation (int/float, not bool)
- [Phase 101.1]: Enrichment backfill uses centroid-based address resolution (not BAG building overlap) for bulk speed
- [Phase 101.1]: Three-pass enrichment: coordinate -> address resolution -> address enrichment -> re-score
- [Phase 101.1]: Skip flags (--skip-coordinate/--skip-address/--skip-rescore) for granular resume after partial runs
- [Phase 106]: String(50) document_type instead of PG ENUM for easy category evolution without migrations
- [Phase 106]: validation_alias maps created_at to uploaded_at in DocumentResponse API
- [Phase 106]: 20 document_type keys matching BronnenLayer card categories for frontend consistency
- [Phase 106]: Upload uses raw fetch (not apiFetch) for FormData multipart compatibility
- [Phase 106]: Download uses authenticated blob fetch with temporary anchor click pattern
- [Phase 106]: mergeDocuments pattern overlays user docs onto static DossierCard pages by document_type key

### Key Patterns (carry forward)

- Aura design: glass blur ONLY on 3 surfaces (SideRailNav, search bar, bottom sheet containers)
- Inner pods: solid translucent bg-white/40 WITHOUT blur
- Palette: Morning Mist #F2F6F3, Pure Glass white/60+blur, Deep Obsidian #0E1111, Warm Amber #F9A826, Sage Mint #D1E2D8
- Font: Plus Jakarta Sans from Google Fonts (replaces Satoshi/Inter)
- Desktop only, light mode only -- drop dark mode entirely
- Industrial Amber tokens fully replaced with Aura tokens (91-01 complete)
- Aura token naming: --color-aura-canvas, --color-aura-ink, --color-aura-amber, --color-aura-obsidian
- Glass hierarchy: bg-aura-glass-white/60 (panel), /40 (pod), /25 (deep)
- Button command variant: bg-aura-obsidian text-white for authoritative CTAs

### Pending Todos

- Phase 81 (Locatie Score Investeringsprofiel) deferred from v12.0
- 268 unanalyzed rulings need AI analysis (~$2 cost)

### Blockers/Concerns

None.

---

## Session Continuity

**Last Session:** 2026-03-11T17:48:36Z
**Stopped At:** Completed 106-02-PLAN.md (Phase 106 complete)

**Next Action:** Begin next phase execution.

---

*State updated: 2026-03-12 -- Phase 106 complete (perceel dossier upload, backend + frontend)*
