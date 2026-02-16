# Phase 27: Design System Foundation - Context

**Gathered:** 2026-02-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish Industrial Amber design token system as single source of truth for all UI styling. Deliver design tokens via Tailwind v4 @theme, UI primitives (button, card, badge, input, select), and Lucide-react icons. This phase creates the foundation — actual component migration happens in Phase 31.

**Important pivot from research:** The research assumed light backgrounds with amber accent. User wants **dark mode default** — dark charcoal backgrounds with amber and teal glowing against dark surfaces. All token definitions and primitives must be designed dark-first.

</domain>

<decisions>
## Implementation Decisions

### Color Palette
- Primary amber: **#EBCB4B** (bright gold/mustard) — the signature accent color
- Secondary accent: **Teal #0D9488** — for interactive elements, links, selected states
- Dark mode default — dark grey/charcoal backgrounds, light text
- Amber = primary actions and highlights, teal = secondary interactive elements
- Semantic colors (success/error/info): Claude's discretion, must work on dark backgrounds

### Component Aesthetic
- **Dark & technical** overall vibe — think Bloomberg Terminal, Grafana
- Dark mode default: charcoal backgrounds, light text, amber and teal glow against dark surfaces
- Corner radius: **subtle (4-6px)** — technical but not harsh
- Surface layering: **layered greys** (base #111 → card #1A1A1A → elevated #222), NOT glassmorphism
- Depth through subtle grey stepping, clean layering system

### Typography
- Primary font: **Inter** — clean geometric sans for all UI text
- Data font: **monospace** (JetBrains Mono or similar) for numbers, coordinates, parcel IDs, table data
- Density: **compact/dense** — 13-14px body, tight line-height. See more data at once.
- Monospace data values align in tables and reinforce the technical aesthetic

### Primitive Variants
- Primary button: **solid amber fill** (#EBCB4B background, dark text) — amber IS the action color
- Card/panel surfaces: layered greys system (see Component Aesthetic)
- Primary action = amber, secondary interactive = teal

### Claude's Discretion
- Grey scale temperature (warm vs cool greys) — pick what works best with #EBCB4B on dark backgrounds
- Border treatment on dark surfaces (visible borders vs elevation/shadows)
- Semantic color palette (success green, error red, info blue — chosen for dark mode contrast)
- Font weight scale (likely regular body + semibold headers for dark readability)
- Input field styling (recessed/inset vs bordered — fit the layered grey system)
- Badge/tag treatment (filled muted vs outline — optimize for data-dense dark interface)
- Exact monospace font choice for data values

</decisions>

<specifics>
## Specific Ideas

- "Dark & technical" — Bloomberg Terminal / Grafana aesthetic, not generic dark theme
- Amber and teal should "glow" against dark surfaces — the accent colors are the life of the interface
- Compact/dense layout — this is a professional tool for real estate developers who want to see data, not a consumer app
- Monospace numbers in tables create that technical "command center" feel
- Layered greys over glassmorphism — surfaces are solid and structured, not transparent

**Research pivot note:** The v4.0 research documents assumed light backgrounds with glassmorphism. The dark-first direction supersedes those assumptions for Phase 27 tokens and primitives. Phase 29 (Silver Map Theme) and Phase 31 (Component Migration) will need to account for dark mode context.

</specifics>

<deferred>
## Deferred Ideas

- Light mode toggle — could be added in Phase 35 (Settings Page) as appearance setting
- Map theme adaptation for dark mode — Phase 29 scope (Silver Map Theme)
- Glassmorphism refinement — Phase 29 scope (may become dark glass or be replaced entirely)

</deferred>

---

*Phase: 27-design-system-foundation*
*Context gathered: 2026-02-16*
