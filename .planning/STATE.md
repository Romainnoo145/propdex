# Propdex -- Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-10)

**Core value:** Area -> Opportunity Intelligence -- scan any Dutch municipality and instantly find development opportunities
**Current focus:** v15.0 Aura -- Phase 92 complete, ready for Phase 93

---

## Current Position

Phase: 93 (3 of 7 in v15.0) -- Parcel Detail Panel
Plan: 1 of 3 complete
Status: In Progress
Last activity: 2026-03-10 -- 93-01 Aerial crop API + useAerialCrop hook complete

Progress: [####░░░░░░] 38% (5/13 plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 5 (v15.0)
- Average duration: 3min
- Total execution time: 16min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 91 | 2 | 8min | 4min |
| 92 | 2 | 6min | 3min |
| 93 | 1 | 2min | 2min |

## Accumulated Context

### Decisions
- SideRailNav renders after <main> in DOM so it floats on top without z-index conflicts
- ResultsShell owns its left padding (112px) rather than _authenticated handling conditional padding
- WorkspaceSwitcher replaced with P monogram (bg-aura-obsidian circle)
- Active nav state uses bg-aura-amber/20 text-aura-amber for warm highlight
- Aura glass-white defined as #ffffff (pure hex) so Tailwind opacity modifiers work
- Satoshi via Fontshare CDN, AppearanceSection kept with map style only
- Badge teal variant uses aura-green but kept variant name for backward compat
- BentoPod explicitly excluded from backdrop-blur (locked design decision)
- Reduced-motion uses [class*=backdrop-blur] selector for generic blur detection
- Differentiated hover scales: 1.02 for pods, 1.05 for nav icons
- Gradient legend extracted from LayerToggle to map.tsx (Option B) for cleaner separation
- aura-hover-glow class uses box-shadow only (no transform) to avoid shadow-glass conflicts
- PDOK WMS proxied through backend for auth boundary and CORS avoidance
- fetchAerialCrop uses raw fetch (not apiFetch) since response is binary JPEG
- 760x320 retina aerial crop with 150m x 63m BBOX for parcel hero context

### Key Patterns (carry forward)

- Aura design: glass blur ONLY on 3 surfaces (SideRailNav, search bar, bottom sheet containers)
- Inner pods: solid translucent bg-white/40 WITHOUT blur
- Palette: Morning Mist #F2F6F3, Pure Glass white/60+blur, Deep Obsidian #0E1111, Warm Amber #F9A826, Sage Mint #D1E2D8
- Font: Satoshi from Fontshare (replaces Inter)
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

**Last Session:** 2026-03-09T23:41:18Z
**Stopped At:** Completed 93-01-PLAN.md

**Next Action:** Execute 93-02-PLAN.md (Parcel Detail Panel components)

---

*State updated: 2026-03-10 -- Phase 93 plan 01 complete (Aerial Crop API)*
