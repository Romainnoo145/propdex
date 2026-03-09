# Phase 91: Aura Design System Foundation - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish the Aura visual DNA: design tokens (colors, typography, spacing), glass component primitives (GlassPanel, BentoPod, PillBadge), micro-interaction system, full dark mode removal, and performance fallbacks. No views are rebuilt — this phase creates the foundation that all subsequent phases draw from.

</domain>

<decisions>
## Implementation Decisions

### Color Token Migration
- **Full swap in Phase 91** — replace ALL color variables and references with Aura tokens in one pass. Components may look transitional until their phase rebuilds them, but the token layer is clean.
- **CSS custom properties as single source of truth** — define all Aura tokens in `index.css`, Tailwind references them via `theme.extend`.
- **New Aura variable names** — replace old `--color-primary`, `--color-bg-primary` etc. with semantic names like `--aura-canvas`, `--aura-glass`, `--aura-amber`, `--aura-obsidian`. Clean break from old system.
- **:root level, no class gating** — Aura is the only theme, no `html.light` or `html.aura` class needed.

### Semantic Color Roles (Three-Layer System)
1. **Warm Amber (#F9A826) = "Intelligence" Layer**
   - Scores: Potentiescore, wijkscores
   - Active states: selected SideRailNav icon, active filter chips
   - Highlights: Kansen tags (e.g., "Herontwikkeling potentie")
2. **Vitality Green (#22C55E) = "Validation" Layer**
   - Positive status: Bestemmingsplan groen, beschikbaar status, positive trends
   - Success CTAs: Confirmation buttons ("Bevestig selectie")
3. **Deep Obsidian (#0E1111) = "Command" Layer**
   - Primary CTA: "Genereer Rapport" button — Obsidian bg + white text, authoritative feel
   - Headers: Titles and important text labels

### Tactile Glass Hierarchy (4-Layer Depth System)
| Layer | Element | Styling | Effect |
|-------|---------|---------|--------|
| **Layer 0** | Canvas | `#F2F6F3` (Morning Mist) | Calm base everything rests on |
| **Layer 1** | Main Panels | `bg-white/60` + `backdrop-blur` + `border-white/40` + `shadow-[0_20px_50px_rgba(0,0,0,0.1)]` | Floating glass containers (SideRailNav, Bottom Sheet, ParcelDetailPanel) |
| **Layer 2** | Inner Pods | `bg-white/40` + `border-white/40` + `shadow-sm` + `rounded-2xl` + `p-4` | Bento data blocks within panels |
| **Layer 3** | Deep Cards | `bg-white/25` or `bg-black/5` | Tags, metadata, input fields within pods |

### Glass Blur Budget (4 surfaces, max 3 active)
- **SideRailNav**: `backdrop-blur-xl` bg-white/60 (always on)
- **Search/Top Bar**: `backdrop-blur-md` bg-white/60 (always on)
- **Bottom Sheet**: `backdrop-blur-2xl` bg-white/60 (active on wijk selection)
- **ParcelDetailPanel**: `backdrop-blur-2xl` bg-white/60 (active on parcel selection)
- **Contextual budgeting**: Bottom Sheet and ParcelDetailPanel are rarely both fully visible — wijk view hides parcel panel, parcel view minimizes wijk info. Max 3 active blur surfaces at any moment.
- **Activation pattern**: Apply backdrop-filter via active CSS class only when panel is in view.

### Border Treatment
- **Unified border-white/40** on all glass surfaces (Layer 1 and Layer 2)
- Depth hierarchy comes from blur + shadow, NOT border thickness
- Layer 1 containers: `shadow-[0_20px_50px_rgba(0,0,0,0.1)]` for dramatic lift
- Layer 2 pods: `shadow-sm` for subtle lift within panel

### Dark Mode Removal
- **Full removal** — delete ThemeProvider, useTheme hook, all `dark:` variants, settings toggle, localStorage `propdex-theme` key handling
- Zero dead code — Aura is the only theme
- Settings Appearance section: Claude's discretion on whether to keep or remove

### Micro-Interaction Feel
- **Subtle professional** — `scale-[1.02]` with soft amber glow on hover
- **Transition timing**: 250ms `cubic-bezier(0.4, 0, 0.2, 1)` — smooth and measured, Material-style glide
- **Hover vocabulary per element type**: Claude's discretion to differentiate (pods vs nav icons vs buttons) based on hierarchy

### Accessibility Fallback (prefers-reduced-motion)
- **Full flat fallback** — "Better a perfect flat interface than a stuttering glass interface"
- When `prefers-reduced-motion: reduce` is active:
  1. Backgrounds: All Layer 1 panels → `bg-white` (100% opacity)
  2. Blur: `backdrop-filter: none`
  3. Animations: All transitions → `duration-0` or simple opacity-in
  4. Borders: Switch to `border-slate-200` (visible on white, since edge-lighting on white bg doesn't work)

### Claude's Discretion
- Settings Appearance section: keep or remove after dark mode toggle gone
- Hover vocabulary differentiation per element type (consistent vs differentiated)
- Exact Satoshi font loading strategy (self-hosted vs Fontshare CDN)
- PillBadge specific styling details

</decisions>

<specifics>
## Specific Ideas

- **"Gelaagd glas, niet gestapeld karton"** — the interface should feel like layered glass, not stacked cardboard. Opacity steps create depth, not hard shadows.
- **"Edge lighting"** — the white border-white/40 acts as light catching the edge of glass, inspired by Behance examples
- **Amber verliest zijn kracht als je het overal gebruikt** — amber is reserved for intelligence/data signals. CTAs use Obsidian for authoritative "command" feel.
- **"Op elk gegeven moment maximaal 3 actieve blur-oppervlakken"** — contextual budgeting, not static limitation
- **Reference style**: High-end SaaS like Linear's clean cards, premium real estate dashboards from Behance refs

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 91-aura-design-system-foundation*
*Context gathered: 2026-03-10*
