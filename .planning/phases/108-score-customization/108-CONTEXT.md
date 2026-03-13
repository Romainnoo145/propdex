# Phase 108: Score Customization - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend Score v3.0 engine with 4 environmental risk factors (natura2000, overstromingsrisico, geluid, luchtkwaliteit) bringing risico from 9→13 factors. Fix the overall score formula so it no longer trends toward 0. Add per-organization score weight customization via a new Settings sub-route so users can toggle factors on/off, adjust weights, and choose presets.

</domain>

<decisions>
## Implementation Decisions

### Score Formula Overhaul
- **Current model broken**: `overall = potentie - risico` pushes most parcels toward 0 because every parcel has some risk
- **New model**: `overall = potentie × (1 - risico_discount)` — risico is a **discount** on potentie, not a subtraction
- **Max discount cap**: 50% — even the riskiest parcel keeps half its potentie score
- **Default overall balance**: 70% potentie / 30% risico — platform is about finding opportunities, risk is a sanity check
- **User-adjustable**: The potentie/risico balance slider lets orgs shift from opportunity-first to risk-averse

### Factor Scope
- **All 21 factors adjustable**: 8 potentie + 13 risico (after adding 4 env factors)
- **4 new risico factors**: natura2000, overstromingsrisico, geluid, luchtkwaliteit (from Phase 99 enrichment data)
- **Toggle on/off**: Users can disable factors entirely (weight = 0)
- **Minimum constraint**: At least 3 factors must remain active per category (potentie/risico)
- **Weight scale**: 1-10 per factor (system normalizes internally)

### Presets
- **Claude designs presets** based on target audience analysis (vastgoedontwikkelaars, kwaliteitsborgers)
- **Preset = starting point**: Selecting a preset fills the table with preconfigured weights, then user can fine-tune
- **UI**: Card-selection with title + description per preset (not dropdown, not pills)

### Settings UI
- **Route**: `/instellingen/score` — own sub-route, separate from account/password/notifications/appearance
- **Layout top-to-bottom**:
  1. Preset cards (card-selection with description)
  2. Overall balance slider (Potentie ◄──────► Risico, default 70/30)
  3. Potentie factor table (compact: Factor | Actief toggle | Gewicht dropdown 1-10)
  4. Risico factor table (same format)
  5. Save button
- **Factor table format**: Compact table rows — factor name, checkbox toggle, gewicht dropdown (1-10). Disabled factors show "-" for weight
- **Save behavior**: Explicit save button that triggers async re-score of all org scan_results + shows impact preview (how many parcels went up/down)

### Organization Scope
- **Per-organization weights**: Stored at org level, not per-user
- **All members can edit**: No role-based access control (no team/role system exists)
- **No custom weights = defaults**: Orgs without custom weights use the standard preset
- **Storage**: New table or JSON column on organizations — weights + active preset name

### Re-scoring
- **Weights-only re-application**: Don't call compute_score_v3() again. Score breakdown (genormaliseerde_score per factor) is already stored in scan_results.flags. Re-scoring = multiply stored normalized scores by new weights + apply new formula
- **Async background job**: Triggered on save, processes all scan_results for the org
- **Impact preview**: After re-score completes, show summary: "X percelen omhoog, Y omlaag, gemiddelde score Δ"
- **Custom profile badge**: Subtiel label bij scores in parcel detail panel when org uses non-default weights

### Claude's Discretion
- Exact preset profiles (names, descriptions, weight distributions) — analyze factor set and target audience
- 4 new environmental factor implementations (normalization, narratieven, gewichten relative to existing 9)
- Rebalancing of existing 9 risico factor weights to accommodate 4 new ones
- Impact preview UI design details
- Tab navigation implementation in /instellingen (sub-route wiring)

</decisions>

<specifics>
## Specific Ideas

- Balance slider should visually show "Potentie [███████···] Risico" with percentage labels
- Factor table should be clean and compact — not card-heavy, closer to a settings table
- Preset cards should have enough description that a vastgoedontwikkelaar understands what each profile optimizes for
- "Opslaan + herbereken" button should show progress while re-scoring runs
- Badge "Custom profiel" appears near score in ParcelDetailPanel — subtle, not prominent

</specifics>

<deferred>
## Deferred Ideas

- Per-scan weight override (different weights for different projects) — future phase
- Role-based access control for settings — when team system is built
- Score history / audit trail (track weight changes over time) — future phase

</deferred>

---

*Phase: 108-score-customization*
*Context gathered: 2026-03-14*
