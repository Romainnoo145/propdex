# Propdex -- Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-10)

**Core value:** Area -> Opportunity Intelligence -- scan any Dutch municipality and instantly find development opportunities
**Current focus:** v15.0 Aura -- Phase 93 in progress

---

## Current Position

Phase: 93 (3 of 7 in v15.0) -- Parcel Detail Panel
Plan: 2 of 3 complete
Status: In Progress
Last activity: 2026-03-10 -- 93-02 LEFT-side parcel detail panel with Framer Motion

Progress: [#########░] 85% (11/13 plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 11 (v15.0)
- Average duration: 4min
- Total execution time: 39min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 91 | 2 | 8min | 4min |
| 92 | 2 | 6min | 3min |
| 93 | 3 | 15min | 5min |
| Phase 93 P02 | 2min | 2 tasks | 5 files |
| Phase 93 P03 | 5min | 2 tasks | 5 files |

## Accumulated Context

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

**Last Session:** 2026-03-10T13:34:36Z
**Stopped At:** Completed 93-02-PLAN.md (LEFT-side parcel detail panel with Framer Motion)

**Next Action:** Execute 93-03-PLAN.md

---

*State updated: 2026-03-10 -- Phase 93-02 complete (Parcel Detail Panel)*
