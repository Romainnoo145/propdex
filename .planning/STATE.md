# Propdex -- Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-10)

**Core value:** Area -> Opportunity Intelligence -- scan any Dutch municipality and instantly find development opportunities
**Current focus:** v18.0 Score Customization -- Phase 108 (Per-org weight overrides and environmental scoring)

---

## Current Position

Phase: 108 -- Score Customization
Plan: 4 of 4 complete
Status: Complete
Last activity: 2026-03-14 -- Phase 108 Plan 04 complete (Custom profiel badge, useScoreWeights hooks, uses_custom_weights API field)

Progress: [##########] 100% (4/4 plans in phase 108)

## Performance Metrics

**Velocity:**
- Total plans completed: 21 (12 v15.0 + 9 v16.0)
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
| Phase 105 P01 | 3min | 1 tasks | 1 files |
| Phase 105 P02 | 4min | 2 tasks | 4 files |
| Phase 104 P01 | 3min | 2 tasks | 3 files |
| Phase 107 P01 | 5min | 3 tasks | 8 files |
| Phase 107 P02 | 14min | 2 tasks | 6 files |
| Phase 108 P01 | 3min | 2 tasks | 2 files |
| Phase 108 P02 | 3min | 2 tasks | 6 files |
| Phase 108 P03 | -- | -- | -- |
| Phase 108 P04 | 5min | 1 task | 5 files |

## Accumulated Context

### Roadmap Evolution
- Phase 93.1 inserted after Phase 93: Potentie Dashboard — no-scroll investor dashboard (URGENT)
- Phase 101.1 inserted after Phase 101: Enrichment Backfill Venlo — backfill all 10 Phase 99 data sources for 137k Venlo parcels, then re-score (URGENT)
- Phase 107 added: Due Diligence Dashboard — rebuild ReportDetailPage as interactive dossier workspace

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
- [Phase 105]: Ephemeral BRK eigendom endpoint uses PDOK centroid resolution + existing fetch_brk_ownership, no new schemas needed
- [Phase 105]: Ephemeral gcTime:0 query ensures BRK data discarded on modal close (Kadaster Tier 3)
- [Phase 105]: SecondaryField onClick prop is optional — vergunningen field remains non-clickable
- [Phase 105]: Portal-based EigendomModal (createPortal to document.body) renders above parcel panel z-index
- [Phase 104]: Flags overlay applied on top of aggregator output for address/building data continuity
- [Phase 104]: PropertyReportResponse extended with 13 optional fields — all default=None for backward compat
- [Phase 104-02]: generate_report_pdf delegates to generate_due_diligence_pdf — same signature, zero router/frontend changes
- [Phase 104-02]: score_breakdown_v3 pre-processed into potentie_factors/risico_factors sorted by bijdrage before template render
- [Phase 107]: parseNotes handles JSON object and plain-text migration (legacy notes field)
- [Phase 107]: navigate search updated via window.history + navigate to . to avoid TanStack Router generic type conflict
- [Phase 107-02]: renderSectionContent defined as module-level function (not inline) for switch-based section dispatch
- [Phase 107-02]: S4 environmental flags use Record<string, unknown> cast — flags are untyped JSONB from Phase 99
- [Phase 107-02]: Upload zones use documentTypes[0] ?? 'overig' fallback for TypeScript strict null safety
- [Phase 107-03]: sectionUtils.ts extracted from DueDiligenceDashboard for parseNotes + computeSectionStatuses (keeps dashboard under 300 lines)
- [Phase 107-03]: S5 FactorsTable component DRYs up identical table header markup for potentie/risico factor breakdown
- [Phase 107-03]: S7 source deduplication uses same statusPriority merge logic as legacy BronnenSection in ReportDetailPage
- [Phase 108-01]: Discount model replaces potentie-risico subtraction: overall = potentie × (1 - risico_discount), always 0-100
- [Phase 108-01]: potentie_risico_balance=0.7 default — risico discounts potentie at most 30% of its score (capped at 50%)
- [Phase 108-01]: Environmental missing defaults to 0.3 (not 0.5) — NL baseline is quiet/clean for most parcels
- [Phase 108-01]: DEFAULT_WEIGHTS exported from score_v3.py as module-level dict — single source of truth for 21 factors
- [Phase 108-01]: Category thresholds updated to >60=Hoog, >30=Gemiddeld (was >40/>10 for old subtraction model)
- [Phase 108-02]: Dynamic max weight denominator in rescore job (sum of active weights, not fixed _POTENTIE_MAX=80) keeps percentages meaningful when factors disabled
- [Phase 108-02]: Min 3 active factors per category enforced at PUT endpoint level (cross-field, can't use field_validator alone)
- [Phase 108-02]: rescore_weights_job uses 500-row offset pagination for 137k scan_results; skips non-v3.0 rows
- [Phase 108-03]: ScoreForm inner component pattern: outer ScoreSection handles loading gate, inner ScoreForm receives initialConfig as prop — avoids React Compiler error for setState-in-useEffect
- [Phase 108-03]: key prop remount strategy on ScoreForm with key=loadedData?.weights.preset — forces clean remount when server data changes after save+invalidate
- [Phase 108-03]: BalanceSlider uses inline background gradient style (CSS pseudo-elements can't be styled via Tailwind class attr)
- [Phase 108-04]: Custom profiel badge uses client-side useOrgScoreWeights hook (not per-parcel API field) — decouples weight display from scan_result storage
- [Phase 108-04]: uses_custom_weights derived at read time in parcel-at-point (org.score_weights IS NOT NULL) — not stored per scan_result

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

**Last Session:** 2026-03-14T05:35:42Z
**Stopped At:** Completed 108-04-PLAN.md — Custom profiel badge, useScoreWeights hooks, uses_custom_weights API field

**Next Action:** Phase 108 complete. Review 108-03 (weight presets API) — may have been executed separately. Next phase TBD.

---

*State updated: 2026-03-12 -- Phase 105 complete (BRK eigendom modal)*
