# Project Research Summary

**Project:** Propdex v4.0 UX Redesign
**Domain:** PropTech Map Application UX Transformation
**Researched:** 2026-02-16
**Confidence:** HIGH

## Executive Summary

Propdex v4.0 is a pure frontend UX redesign milestone—transforming from glassmorphism to an "Industrial Amber" design system with restructured navigation and comprehensive user feedback. This is NOT a data feature milestone. The research reveals a clear path: adopt a shadcn/ui-inspired copy-paste component architecture, leverage Tailwind v4's native @theme directive for design tokens, add minimal dependencies (only lucide-react and motion), and restructure navigation while keeping the MapLibre instance persistent.

The recommended approach is incremental migration: establish design tokens first, build UI primitives, create layout shells, then refactor existing components progressively. The existing React 19 + TanStack Router + MapLibre stack remains unchanged—we're adding UX polish, not replacing infrastructure. This keeps the technical risk low while delivering high visual impact.

The critical risk is MapLibre instance re-mounting during navigation restructure (Pitfall #1). The mitigation is clear: use TanStack Router's layout routes to keep `<MapView>` persistently mounted, letting only the outlet content change. Secondary risks—CSS cascade conflicts during token migration and tablet breakpoint "purgatory"—are well-documented with proven solutions. Overall, this is a well-trodden path in modern React applications with 2026-current best practices.

## Key Findings

### Recommended Stack

Only 2 new dependencies needed: lucide-react for icon library (tree-shakeable, 1,671+ icons) and motion for animations (React 19 compatible successor to framer-motion). Sonner for toast notifications is already installed. Tailwind v4's @theme directive handles design token system natively—no additional tooling (Style Dictionary, Theo) required. MapLibre style customization uses inline paint properties for silver/desaturated theme—no external style JSON dependencies.

**Core technologies:**
- **Tailwind v4 @theme** — Design token system via CSS variables, auto-generates utilities, runtime themeable
- **lucide-react ^0.564.0** — Tree-shakeable icon library, 1,671+ icons, TypeScript native, zero runtime dependencies
- **motion ^12.34.0** — React 19 compatible animation library, 120fps GPU-accelerated, declarative API
- **Sonner 2.0.7** — Toast notifications (already installed, no action needed)
- **MapLibre GL JS 5.x** — Existing, add raster paint properties for silver theme (no new dependencies)

**What NOT to add:** Style Dictionary (Tailwind handles tokens), framer-motion (deprecated for React 19), react-spring (motion is better), Radix/HeadlessUI (not needed for this milestone—no new complex components).

### Expected Features

**Must have (table stakes):**
- Icon-based sidebar navigation — Standard in 2026 professional dashboards
- Loading/empty/error states — Users expect clear feedback in professional tools
- Success confirmations via toasts — Industry standard for async operations
- Settings page — Users expect control over account, appearance, notifications
- Data table sorting/filtering — Core feature for property intelligence platform
- List-map sync (data brushing) — Hovering row highlights marker, standard in map apps
- Progress indicators for scans — Multi-step processes need steppers, users want to know what's ahead

**Should have (competitive differentiators):**
- Inspector slide-over panel — Modern detail disclosure pattern, maintains map context
- Industrial Amber design system — Distinctive mustard/amber accent + desaturated base sets premium tone
- Silver/desaturated map style — Professional neutral base lets data overlays (zoning, boundaries) stand out
- Streamlined scan flow — Fewer clicks than competitors, context preserved throughout
- Real-time scan progress visibility — Transparency builds trust ("Fetching kadaster...", "Analyzing 247 parcels...")
- Multi-select + bulk actions — Power user efficiency feature (export selected, add to project)
- Persistent filter state — Filters survive navigation, reduces frustration

**Defer (v2+):**
- Spatial filter interaction (click-to-define on map) — High complexity, nice-to-have
- Project organization enhancements — If exists, polish later; if not, defer
- Contextual help/tooltips system — Add after core UX is solid
- AI-driven filtering — Adds unpredictability, not needed for professional tool

### Architecture Approach

Use a **shadcn/ui-inspired copy-paste component architecture** layered over existing glassmorphism foundation. Build primitives in `components/ui/` (button, card, badge, input, select) styled with Industrial Amber tokens. Create layout shells (`components/layout/map-shell.tsx`, `results-shell.tsx`, `inspector-panel.tsx`) that wrap page content. Use TanStack Router's layout routes to keep MapLibre instance persistent—`<MapView>` lives in `_authenticated.tsx` layout, only `<Outlet />` content swaps.

Manage cross-view state with NavigationContext (React Context for ephemeral UI state like inspector panel open/closed) + search params (TanStack Router type-safe search params for shareable route state like `gemeente_code`, `scan_id`). MapLibre styling uses inline paint properties (`raster-opacity: 0.6`, `raster-saturation: -0.5`) for silver theme—no external style JSON.

**Major components:**
1. **Design Token System** (`@theme` in `index.css`) — Single source of truth, auto-generates Tailwind utilities, runtime themeable
2. **UI Primitives** (`components/ui/`) — Copy-paste shadcn/ui pattern, full ownership, customized with Industrial Amber
3. **Layout Shells** (`components/layout/`) — Map shell, results shell, inspector panel wrapper—composition layer
4. **Navigation Context** (`lib/navigation-context.tsx`) — Cross-view state management without prop drilling
5. **Persistent MapView** (in `_authenticated.tsx` layout) — Never unmounts during navigation, shared via outlet context

**Key patterns:**
- Tailwind v4 @theme directive for design tokens (primitives → semantic → component tokens)
- shadcn/ui copy-paste for UI primitives (no npm packages, full source ownership)
- TanStack Router layout routes for persistent MapView (avoid re-mount pitfall)
- NavigationContext for ephemeral state + search params for shareable URLs
- Incremental migration strategy (coexist during transition, migrate high-visibility components first)

### Critical Pitfalls

1. **MapLibre instance re-mount on route change** — When restructuring navigation to separate route pages (Map, Results, Projects), MapLibre container gets unmounted/re-mounted, causing full reload (2-5 sec), loss of camera position, memory leaks. **Prevention:** Use TanStack Router layout routes with `<Outlet />`, keep `<MapView>` in persistent `_authenticated.tsx` layout, only outlet content changes.

2. **CSS variable migration breaking cascade specificity** — Replacing hardcoded glassmorphism colors with design token CSS variables causes cascade conflicts. Existing Tailwind utilities override variables, nested components inherit wrong token values from parents. **Prevention:** Incremental migration (one component category at a time), use CSS cascade layers (`@layer`), alias old tokens during transition, ESLint rule to prevent hardcoded colors in new code.

3. **Tablet breakpoint "purgatory" (768px-1024px)** — Tablet renders in broken hybrid state: map too small for desktop patterns, slide-over drawers cover 80% of screen, touch targets too small. **Prevention:** Design for three tiers (mobile/tablet/desktop), keep map visible at all times on tablet, enforce 44px touch targets, test on real iPad devices.

4. **Slide-over panel animations block map interactions** — CSS transitions with `width`/`left` trigger layout recalculation, blocking main thread, making map interactions laggy. **Prevention:** Use GPU-accelerated animations only (`transform`, `opacity`), use `pointer-events: none` during animation, add `will-change` hint.

5. **Design token proliferation (too many tokens)** — Creating hundreds of hyper-specific tokens (`--color-amber-button-hover-border`) makes system rigid and slow. **Prevention:** Three-tier hierarchy (primitive → semantic → component), start with 20-30 tokens, add only when same value appears 3+ times.

## Implications for Roadmap

Based on research, suggested phase structure follows dependency order: design system foundation → layout structure → view separation → component refactoring → polish.

### Phase 1: Design System Foundation
**Rationale:** All subsequent work depends on design tokens being established first. Without tokens, UI primitives can't be built, and migration can't start.
**Delivers:** Industrial Amber color scale + semantic tokens in `@theme`, navigation context for cross-view state, initial UI primitives (button, card, badge).
**Addresses:** Design token system (FEATURES.md: table stakes), visual identity foundation (FEATURES.md: differentiator).
**Avoids:** Token proliferation (PITFALLS.md #5) by starting with minimal 20-30 tokens, three-tier hierarchy.
**Research flag:** SKIP research — Tailwind v4 @theme is well-documented, standard pattern.

### Phase 2: Navigation Structure + Persistent MapView
**Rationale:** Must solve MapLibre re-mount pitfall before splitting routes. This is the critical risk area—get it wrong and map UX breaks.
**Delivers:** `_authenticated.tsx` layout with persistent `<MapView>`, NavigationProvider wrapping outlet, InspectorPanel in layout.
**Addresses:** Inspector slide-over panel (FEATURES.md: differentiator), cross-view state management (ARCHITECTURE.md: Pattern 4).
**Avoids:** MapLibre re-mount (PITFALLS.md #1 CRITICAL) by keeping map in layout, only outlet changes.
**Research flag:** SKIP research — TanStack Router layout routes well-documented, MapLibre persistence pattern proven.

### Phase 3: Silver Map Theme + Layout Shells
**Rationale:** With navigation stable, customize map appearance and build composition layer for views.
**Delivers:** MapLibre silver theme via paint properties, MapShell + ResultsShell wrappers.
**Addresses:** Silver/desaturated map style (FEATURES.md: differentiator), professional neutral base for data overlays.
**Uses:** MapLibre raster paint properties (STACK.md: map styling), no external style JSON.
**Avoids:** External style dependencies, slow load times, limited customization control.
**Research flag:** SKIP research — MapLibre paint properties documented, desaturation approach standard.

### Phase 4: View Separation (Results Route)
**Rationale:** Navigation foundation stable, now extract results logic from monolithic map.tsx to separate route.
**Delivers:** `routes/_authenticated/resultaten.tsx` as separate route, refactored map.tsx using MapShell.
**Addresses:** Streamlined navigation (FEATURES.md: differentiator), separation of concerns (ARCHITECTURE.md: anti-pattern #3).
**Implements:** Results shell wrapper (ARCHITECTURE.md: Pattern 7), TanStack Router search params for scan_id.
**Avoids:** Monolithic map page (PITFALLS.md: prevents testing, poor separation).
**Research flag:** SKIP research — File-based routing is standard TanStack Router pattern.

### Phase 5: Component Migration (High Visibility)
**Rationale:** Design system + navigation stable, now migrate existing glassmorphism components to Industrial Amber.
**Delivers:** Updated Drawer/Modal with Industrial Amber tokens, SideRailNav using ui/button, ReportSidebar using ui/card.
**Addresses:** Design system consistency (FEATURES.md: Industrial Amber as differentiator).
**Avoids:** CSS cascade conflicts (PITFALLS.md #2) via incremental migration, cascade layers, aliased tokens.
**Research flag:** SKIP research — Incremental migration strategies well-documented.

### Phase 6: Feedback Systems
**Rationale:** Core UX structure complete, now add comprehensive user feedback.
**Delivers:** Loading states (spinners + skeletons), error states with recovery, success toasts, empty states, progress indicators for scans.
**Addresses:** All table stakes feedback features (FEATURES.md: loading/error/empty/success/progress).
**Uses:** Sonner for toasts (already installed), motion for skeleton animations.
**Avoids:** Toast notifications for errors (PITFALLS.md: use banners/modals for errors requiring action).
**Research flag:** SKIP research — Feedback patterns well-established (PatternFly, Carbon Design System).

### Phase 7: Data Table Polish
**Rationale:** Feedback systems in place, now enhance core data interaction patterns.
**Delivers:** List-map sync (hover highlighting), multi-select + bulk actions, advanced filters, persistent filter state.
**Addresses:** Table stakes data table features + power user efficiency (FEATURES.md).
**Implements:** TanStack Table integration with MapLibre (ARCHITECTURE.md: data flow).
**Research flag:** SKIP research — Data table patterns documented (Pencil & Paper UX, PatternFly bulk selection).

### Phase 8: Mobile Responsiveness
**Rationale:** Desktop UX polished, now adapt for mobile/tablet field use.
**Delivers:** Three-tier responsive design (mobile/tablet/desktop), 44px touch targets, mobile view-only mode, bottom sheet inspector on mobile.
**Addresses:** Responsive mobile view (FEATURES.md: table stakes), field work support.
**Avoids:** Tablet purgatory (PITFALLS.md #3) via distinct tablet layout, touch target issues (PITFALLS.md #8) via 44px minimum.
**Research flag:** SKIP research — Responsive patterns well-documented (Toptal, Dundas BI, ArcGIS dashboards).

### Phase 9: Settings Page
**Rationale:** Core UX complete, add user preferences and configuration.
**Delivers:** Settings page with categories (account, notifications, appearance, data management).
**Addresses:** Settings page (FEATURES.md: table stakes).
**Research flag:** SKIP research — Settings patterns standard (Material Design, SetProduct examples).

### Phase 10: Polish + Performance Audit
**Rationale:** All features implemented, now optimize and remove legacy code.
**Delivers:** Animation performance tuning, glassmorphism disabled on mobile (PITFALLS.md #7), bundle size optimization, legacy CSS removal, Storybook documentation.
**Avoids:** Glassmorphism performance issues (PITFALLS.md #7) via mobile disable, animation blocking (PITFALLS.md #4) via GPU-only transforms.
**Research flag:** SKIP research — Performance profiling is implementation-specific.

### Phase Ordering Rationale

- **Phase 1-2 are foundational:** Design tokens and navigation structure MUST come first. All other work depends on these.
- **Phase 3-4 stabilize architecture:** Map theme and view separation establish the structural patterns.
- **Phase 5 enables visual migration:** With structure stable, migrate components from glassmorphism to Industrial Amber.
- **Phase 6-7 add UX polish:** Feedback systems and table interactions can run in parallel after Phase 5.
- **Phase 8 adapts for mobile:** Defer until desktop UX is polished to avoid designing twice.
- **Phase 9-10 are optional polish:** Settings and performance can be deferred if timeline pressured.

**Dependencies:**
- Phase 2 requires Phase 1 (needs design tokens)
- Phase 3-4 require Phase 2 (need persistent MapView)
- Phase 5 requires Phase 1 (needs design tokens to migrate to)
- Phase 6-7 can run in parallel after Phase 5
- Phase 8 requires Phase 5 (visual system stable)
- Phase 9-10 require all previous phases

**Critical path:** Phase 1 → Phase 2 → Phase 5 (foundation → navigation → migration)

**Parallelization opportunities:**
- Phase 3 can start while Phase 2 testing completes (map theme independent of navigation)
- Phase 6-7 can run in parallel (feedback systems vs data table interactions)

### Research Flags

**All phases: SKIP research** — This is a well-trodden UX redesign path. All technologies (Tailwind v4, TanStack Router, MapLibre, Motion, Lucide) have current 2026 documentation. All patterns (shadcn/ui copy-paste, layout routes, design tokens, incremental migration, responsive design) are established best practices. The research conducted provides comprehensive guidance—no phase needs deeper research during planning.

**Validation during execution:**
- Phase 2: Test MapLibre persistence with DevTools Profiler (confirm no re-mount)
- Phase 3: Visual QA for silver map theme (ensure data overlays still pop)
- Phase 5: Visual regression testing during component migration
- Phase 8: Real device testing on iPad, iPhone SE, Android mid-range

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All dependencies verified current (npm versions, React 19 compatibility). Tailwind v4 @theme released Jan 2025, widely adopted. Motion is official successor to framer-motion. |
| Features | HIGH | Feature landscape based on 2026 PropTech dashboard trends, established UX patterns (PatternFly, Carbon Design System, NN/g), real-world PropTech examples (LightBox, Transect). Table stakes vs differentiators clearly categorized. |
| Architecture | HIGH | shadcn/ui pattern proven, TanStack Router layout routes documented, MapLibre + React integration patterns established. Incremental migration strategy standard for design system updates. |
| Pitfalls | HIGH | All pitfalls sourced from official docs (MapLibre memory leak issue #4811, TanStack Router render optimization docs, CSS cascade specs) + real-world migration experiences. Prevention strategies proven (cascade layers 2026 best practice, layout routes prevent re-mount). |

**Overall confidence:** HIGH

### Gaps to Address

**Design aesthetic validation:** "Industrial Amber" is a custom interpretation of color trends 2026 (mustard/amber accent + desaturated base). While color psychology and trend research support this, visual design is subjective. **Mitigation:** Create design mockups in Phase 1, validate with stakeholders before full migration.

**MapLibre silver theme specifics:** Desaturation approach (raster-opacity, raster-saturation) is standard, but exact values (0.6 opacity, -0.5 saturation) need visual tuning. **Mitigation:** Start with documented ranges, iterate in Phase 3 based on data overlay visibility.

**Tablet breakpoint values:** Recommended 768px (portrait) and 1024px (landscape) are industry standard, but optimal panel widths on tablet need testing. **Mitigation:** Design for 360px max panel width on tablet, validate with real iPad in Phase 8.

**Animation performance on low-end mobile:** Motion library performs well on modern devices, but older Android (< 2022) may struggle with concurrent animations. **Mitigation:** Test on mid-range Android in Phase 10, add `prefers-reduced-motion` support if needed.

No research gaps require resolution before roadmap creation—all findings are actionable.

## Sources

### Primary (HIGH confidence)

**Stack:**
- [Tailwind CSS v4.0 Release](https://tailwindcss.com/blog/tailwindcss-v4) — @theme directive, design token system
- [Motion for React Official Docs](https://motion.dev/docs/react) — React 19 compatibility, animation API
- [Lucide React Official Docs](https://lucide.dev/guide/packages/lucide-react) — Icon library, tree-shaking
- [MapLibre Style Specification](https://maplibre.org/maplibre-style-spec/) — Paint properties, raster layers
- [Sonner Official Docs (shadcn/ui)](https://ui.shadcn.com/docs/components/radix/sonner) — Toast notifications

**Features:**
- [9 Dashboard Design Principles (2026) | DesignRush](https://www.designrush.com/agency/ui-ux-design/dashboard/trends/dashboard-design-principles)
- [Data Table Design UX Patterns & Best Practices - Pencil & Paper](https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-data-tables)
- [PatternFly Design System](https://www.patternfly.org/) — Empty states, bulk selection, progress stepper
- [UI best practices for loading, error, and empty states - LogRocket](https://blog.logrocket.com/ui-design-best-practices-loading-error-empty-state-react/)
- [Map interaction | Axis Maps](https://www.axismaps.com/guide/map-interaction) — List-map sync patterns

**Architecture:**
- [The anatomy of shadcn/ui | Manupa](https://manupa.dev/blog/anatomy-of-shadcn-ui) — Copy-paste component pattern
- [TanStack Router Layout Routes](https://tanstack.com/router/v1/docs/framework/react/routing/routing-concepts)
- [TanStack Router Search Params](https://tanstack.com/router/v1/docs/framework/react/guide/search-params)
- [Tailwind CSS v4 @theme directive](https://tailwindcss.com/docs/theme)
- [Incremental migration approaches | CircleCI](https://circleci.com/blog/incremental-migration-approaches-for-legacy-applications/)

**Pitfalls:**
- [MapLibre GL JS Memory Leak Issue #4811](https://github.com/maplibre/maplibre-gl-js/issues/4811) — Map re-mount memory issues
- [CSS Custom Properties In The Cascade | Smashing Magazine](https://www.smashingmagazine.com/2019/07/css-custom-properties-cascade/)
- [TanStack Router: Render Optimizations](https://tanstack.com/router/v1/docs/framework/react/guide/render-optimizations)
- [Migrations are the hardest part of design systems work | Mae Capozzi](https://maecapozzi.com/newsletter/75)
- [Breakpoints in Responsive Design - Nielsen Norman Group](https://www.nngroup.com/articles/breakpoints-in-responsive-design/)

### Secondary (MEDIUM confidence)

- [LightBox Vision℠](https://www.lightboxre.com/data/lightbox-vision/) — PropTech design system example
- [Transect Environmental Platform](https://www.transect.com/) — Map-centric PropTech UX patterns
- [Glassmorphism UI Design Trend 2026](https://www.designstudiouiux.com/blog/what-is-glassmorphism-ui-trend/)
- [Mobile-First vs Desktop-First 2026 Strategy](https://www.digittrix.com/blogs/mobile-first-vs-desktop-first-choose-the-right-approach)

---
*Research completed: 2026-02-16*
*Ready for roadmap: YES*
