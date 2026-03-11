# Propdex -- Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-10)

**Core value:** Area -> Opportunity Intelligence -- scan any Dutch municipality and instantly find development opportunities
**Current focus:** v16.0 Score Intelligence -- Phase 100 (Score v3.0 Engine) in progress

---

## Current Position

Phase: 100 -- Score v3.0 Engine
Plan: 2 of 3 complete
Status: In Progress
Last activity: 2026-03-11 -- Plan 100-02 complete (Pipeline integration)

Progress: [######----] 67% (2/3 plans in phase 100)

## Performance Metrics

**Velocity:**
- Total plans completed: 15 (12 v15.0 + 3 v16.0)
- Average duration: 4min
- Total execution time: 57min

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

## Accumulated Context

### Roadmap Evolution
- Phase 93.1 inserted after Phase 93: Potentie Dashboard — no-scroll investor dashboard (URGENT)

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

**Last Session:** 2026-03-11T07:16:29Z
**Stopped At:** Completed 100-02-PLAN.md

**Next Action:** Execute 100-03-PLAN.md (Frontend types)

---

*State updated: 2026-03-11 -- Phase 100 Plan 02 complete (Pipeline integration)*
