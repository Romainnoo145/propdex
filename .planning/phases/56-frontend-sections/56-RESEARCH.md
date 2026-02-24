# Phase 56: Frontend Sections - Research

**Researched:** 2026-02-24
**Domain:** React/TypeScript frontend — property report UI, section components
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Section ordering & prominence**
- Reorder sections by theme: Gebouw → Energielabel → WOZ → Kadaster → Eigendom → Bestemming → Monument → AI Interpretatie → Bronnen
- Groups: physical property data together, then legal/ownership, then zoning/heritage
- Quick metrics grid expands from 4 to 6 cards: Bouwjaar, Vloeroppervlak, Gebruiksdoel, Energielabel badge, WOZ-waarde, Compleetheid
- PropertyDetailPanel (side panel on map) gets condensed versions of all new sections, consistent with existing Kadaster/Bestemming/Monument pattern

**Energielabel presentation**
- EU arrow diagram style (stacked colored arrows with pointer highlighting the property's class)
- Compact size (~200px wide), inline within section — not full-width hero
- Standard EU colors: A++=dark green through G=red
- No label state: amber/warning styled call-to-action — "Geen energielabel geregistreerd" with context about when one is required (bij verkoop/verhuur)
- Monument without label: prominent amber alert banner within EnergieLabelSection — "Monumenten moeten vóór mei 2026 een energielabel hebben." Time-sensitive, actionable for developers
- Expired label: show registratiedatum and 10-year validity status (valid/expired)

**BRK eigendom presentation**
- Detailed cards per owner: type, zakelijk recht type, aandeel (share)
- Natural persons show "Particulier eigenaar" — NEVER show personal names (BRK Tier 3 privacy)
- Rechtspersoon names ARE shown (public info)
- Hypotheek: simple boolean badge per perceel ("Hypotheek: Ja/Nee")
- Live-data indicator: subtle timestamp badge in section header ("Actueel opgevraagd om 14:32") plus brief note that data is not stored — clear but minimal
- When BRK unconfigured: section visible but greyed out with explanation "Eigendomsgegevens niet beschikbaar — BRK-koppeling wordt geconfigureerd"

**WOZ presentation**
- WOZ-waarde always displayed with waardepeildatum (mandatory context pair)
- Per-m² calculation shown when building oppervlakte data available
- Low-confidence disclaimer when using unofficial waardeloket endpoint

**Monument detail depth**
- Non-monument properties: keep existing minimal green "Geen monument" badge
- Monument properties: metadata grid (status badge + bouwperiode + functie) as compact 3-column row
- Below grid: existing restrictions list
- Below restrictions: collapsible redengevende omschrijving — first ~150 words visible, "Lees meer" expand button for full text
- RCE added as source row in verification table: "Rijksdienst Cultureel Erfgoed" with status badge

### Claude's Discretion
- Exact Tailwind styling, spacing, and responsive breakpoints
- How the EU arrow diagram is implemented (SVG vs CSS)
- WOZ section layout (follows existing section patterns)
- Loading states and skeleton patterns for sections
- Error state handling per section
- Side panel condensed layout specifics

### Deferred Ideas (OUT OF SCOPE)
- **Eigenaar brief-automatisering**: User wants to build automation to send letters to property owners using BRK ownership data. This is a new capability requiring its own phase (involves storing/processing personal data, letter templates, mailing integration). Noted for future milestone.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| NRG-02 | Display registratiedatum and 10-year geldigheid status (valid/expired) | EnergyLabel schema has `registratie_datum`, `geldig_tot`, `is_geldig` — all Optional strings; expiry is 10 years from registration |
| NRG-04 | Monument properties without label show compliance warning (May 2026 obligation) | Requires cross-referencing `energy_label.is_geregistreerd === false` AND `monuments.is_monument === true` in EnergieLabelSection |
| NRG-05 | Frontend EnergieLabelSection with EU color-coded badge (A=green to G=red) | EU colors are well-known; no library needed — pure SVG/CSS implementation |
| WOZ-02 | WOZ-waarde always displayed together with waardepeildatum (mandatory context) | WOZData schema: `meest_recente_waarde` + `meest_recente_peildatum` — always display as a pair |
| WOZ-03 | WOZ per m² derived from `woz_waarde / oppervlakte` when building data available | Computed in frontend: `woz_data.meest_recente_waarde / building.oppervlakte` — both may be null |
| WOZ-05 | Frontend WOZSection with value, peildatum, and per-m² calculation | New Section component following existing `Section` wrapper pattern |
| BRK-02 | Display eigenaar type (natuurlijk persoon / rechtspersoon / overheid) — never show personal names | BRKOwnership schema has `eigenaar_type` as a discriminated union literal — map to Dutch display strings |
| BRK-03 | Display zakelijk recht type and hypotheek indicator (boolean) | PerceelOwnership has `heeft_hypotheek: bool`; ZakelijkGerechtigde has `zakelijk_recht_type` and `aandeel` |
| BRK-06 | Frontend EigendomSection with "Actueel opgevraagd" timestamp, owner list, rights | BRKOwnership.fetched_at is ISO 8601 UTC — format with `Intl.DateTimeFormat` for "om HH:MM" display |
| RCE-02 | Display redengevende omschrijving in collapsible section (can be 1,000-5,000 words) | `monuments.rce_detail.redengevende_omschrijving` — truncate at ~150 words, useState expand toggle |
</phase_requirements>

## Summary

Phase 56 is a pure frontend phase: add four new data sections to the property report UI using data already returned by the backend (Phases 52-55). No backend changes are needed. The frontend TypeScript types (`property.ts`) must first be extended to include the new fields (`energy_label`, `woz_data`, `brk_ownership`, and `monuments.rce_detail`). Then four new section components (EnergieLabelSection, WOZSection, EigendomSection, enhanced MonumentSection) are created following the established `Section` wrapper pattern in `ReportDetailPage.tsx`. The `PropertyDetailPanel` side panel needs condensed versions of all new sections. Finally, the section order in ReportDetailPage is updated and the quick metrics grid expands from 4 to 6 cards.

The existing codebase provides an excellent template: all sections follow the `Section` wrapper component with a title header and content area; the theme is purely CSS variables via Tailwind 4.x `@theme` blocks (no hardcoded colors allowed); the `PropertyDetailPanel` uses `PropertySection` collapsibles; and all state management is local React `useState` (no TanStack Query involvement for section display).

**Primary recommendation:** Follow the existing `Section` + `Row` component patterns from `ReportDetailPage.tsx` exactly. Create new section components as co-located functions in the same file (matching current architecture). Extend `PropertyReportResponse` TypeScript interface in `property.ts` before writing any components.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.0 | Component rendering, useState for expand/collapse | Already installed |
| TypeScript | 5.9.3 | Type safety for new schema fields | Already installed |
| Tailwind CSS v4 | 4.1.18 | Styling via CSS variables, `@theme` block | Project standard |
| lucide-react | 0.564.0 | Icons (already used extensively) | Already installed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Intl.DateTimeFormat | native | Date formatting in Dutch locale | `fetched_at` for "Actueel opgevraagd om 14:32" |
| clsx | 2.1.1 | Conditional class merging | Complex conditional Tailwind classes |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SVG EU arrow diagram | External chart library | SVG is zero-dependency, matches ~200px compact size requirement |
| Inline `details`/`summary` HTML | Custom useState expand | Project uses `useState` for expand (PropertySection), not `details` element; stay consistent |

**Installation:** No new packages required — this phase is pure UI composition.

## Architecture Patterns

### Current ReportDetailPage Structure

```
ReportDetailPage.tsx (single file, ~970 lines)
├── ReportDetailPage (main export)
│   ├── MetricCard (quick facts grid)
│   ├── Section (wrapper for all content sections)
│   ├── Row (key-value display row)
│   ├── GebouwSection
│   ├── KadasterSection
│   ├── BestemmingSection
│   ├── MonumentSection       ← enhance this
│   ├── PDFUploadSection / AIInterpretatieSection
│   └── BronnenSection
└── Icons (ArrowLeftIcon, MapPinIcon, AlertIcon, MonumentIcon)
```

All section components are **module-private functions** in the same file — they are NOT exported. This is the established pattern. New sections (EnergieLabelSection, WOZSection, EigendomSection) follow this same pattern.

### Pattern 1: Section Wrapper

Every content area uses the `Section` function:

```typescript
// From ReportDetailPage.tsx
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-overlay/5 bg-grey-900">
      <div className="border-b border-overlay/5 px-5 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-grey-600">{title}</h2>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  )
}
```

New sections must use this `Section` wrapper — do not create custom wrappers.

### Pattern 2: Key-Value Row

```typescript
function Row({ label, value, mono, muted }: { label: string; value: string | null | undefined; mono?: boolean; muted?: boolean }) {
  if (!value) return null
  return (
    <div className="flex items-baseline justify-between py-2">
      <span className="text-sm text-grey-600">{label}</span>
      <span className={`text-sm font-medium ${muted ? 'text-grey-600' : 'text-grey-300'} ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  )
}
```

Use `Row` for simple label-value pairs. If `value` is null/undefined, `Row` renders nothing automatically.

### Pattern 3: PropertySection (Side Panel)

The `PropertyDetailPanel` uses `PropertySection` (from `property/PropertySection.tsx`), a collapsible accordion with `useState(defaultOpen=false)`. Pattern:

```typescript
<PropertySection title="Eigendom">
  <EigendomContent data={data} />
</PropertySection>
```

Content components for the panel are co-located in `PropertyDetailPanel.tsx`.

### Pattern 4: Color Tokens (NO hardcoded colors)

```
amber-accent       → monument alerts, actionable warnings
success            → confirmed positive state (geen monument)
error              → critical failures
info               → zoning/informational
overlay            → subtle borders and backgrounds (white in dark, black in light)
grey-{100..950}    → text and surface hierarchy
```

For the EU energy label colors, use inline styles or custom CSS classes with oklch values — the theme does not have energy label color variables. These are data-display colors (not UI semantic colors), so inline style is appropriate for the dynamic color selection.

### EU Energy Label Colors

These are the standard EU energy label colors (official EU Regulation 2021/340):

```typescript
const EU_ENERGY_COLORS: Record<string, string> = {
  'A++++': '#009037',  // Very dark green
  'A+++':  '#009037',
  'A++':   '#009037',
  'A+':    '#009037',
  'A':     '#2dab52',  // Mid green
  'B':     '#74c24a',  // Light green
  'C':     '#bed72e',  // Yellow-green
  'D':     '#feec00',  // Yellow
  'E':     '#f4af00',  // Amber
  'F':     '#e7721a',  // Orange
  'G':     '#e21a1a',  // Red
}
```

### Pattern 5: Null/Unavailable Guard

Every section guards on null data:

```typescript
function WOZSection({ data }: { data: PropertyReportResponse }) {
  const { woz_data } = data
  if (!woz_data) {
    return (
      <Section title="WOZ-waarde">
        <p className="text-sm italic text-grey-600">Geen WOZ-waarde beschikbaar</p>
      </Section>
    )
  }
  // ... render data
}
```

### Pattern 6: Nederlandse Getalnotatie

Currency formatting uses `Intl.NumberFormat`:

```typescript
const euroFmt = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
// Result: "€ 425.000"
```

### Pattern 7: Collapsible Text (redengevende omschrijving)

Use `useState` for expand — NOT HTML `<details>`. The existing BestemmingSection uses `<details>` for plan teksten, but CONTEXT.md specifies "Lees meer" button pattern. Implementation:

```typescript
function CollapsibleText({ text, wordLimit = 150 }: { text: string; wordLimit?: number }) {
  const [expanded, setExpanded] = useState(false)
  const words = text.split(/\s+/)
  const isLong = words.length > wordLimit
  const preview = isLong && !expanded ? words.slice(0, wordLimit).join(' ') + '…' : text

  return (
    <div>
      <p className="text-sm text-grey-400 leading-relaxed">{preview}</p>
      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-xs text-grey-600 underline hover:text-grey-300"
        >
          {expanded ? 'Lees minder' : 'Lees meer'}
        </button>
      )}
    </div>
  )
}
```

### Anti-Patterns to Avoid

- **Hardcoding brand colors:** Use CSS variables via Tailwind tokens only (exception: EU energy label data colors use inline style)
- **Creating new exported components:** All section functions stay module-private in their respective files
- **External chart/diagram libraries:** The EU arrow diagram is a custom SVG — no library needed
- **Showing BRK personal data:** `eigenaar_type === 'natuurlijk_persoon'` always renders "Particulier eigenaar"
- **Calling API from section component:** BRK data is already in `PropertyReportResponse.brk_ownership` — no re-fetch from section component

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| EU energy label arrow diagram | Full vector diagram from scratch | Compact SVG pattern (~30 lines) | Well-understood geometry; ~200px compact |
| Date formatting | Custom date parser | `Intl.DateTimeFormat('nl-NL', ...)` | Already used in file (dateFmt, dateFmtFull) |
| Currency display | Manual formatting | `Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' })` | Dutch locale: "€ 425.000" |
| Collapsible text | External library | `useState` + word-split | Simple, already pattern used in codebase |

## Common Pitfalls

### Pitfall 1: TypeScript types not extended before components
**What goes wrong:** TypeScript errors on `data.energy_label`, `data.woz_data`, `data.brk_ownership` — fields don't exist on the interface yet.
**Why it happens:** `PropertyReportResponse` in `frontend/src/lib/types/property.ts` does not yet include the v7.0 fields.
**How to avoid:** Add TypeScript interfaces FIRST in `property.ts`, THEN write the section components.
**Warning signs:** TS error "Property 'energy_label' does not exist on type 'PropertyReportResponse'"

### Pitfall 2: CadastralParcel missing identificatie field
**What goes wrong:** The frontend `CadastralParcel` interface in `property.ts` lacks the `identificatie` field (present in backend schema). This was added in Phase 54 for BRK lookups.
**How to avoid:** Add `identificatie: string | null` to `CadastralParcel` interface when updating `property.ts`.

### Pitfall 3: Monument rce_detail field missing from MonumentStatus type
**What goes wrong:** `data.monuments.rce_detail` doesn't exist on the TypeScript type.
**Why it happens:** `MonumentStatus` interface in `property.ts` doesn't have `rce_detail` yet.
**How to avoid:** Add `rce_detail: RCEMonumentDetail | null` to `MonumentStatus` interface.

### Pitfall 4: brk_ownership.fetched_at timezone mismatch
**What goes wrong:** `fetched_at` is ISO 8601 UTC (e.g., "2026-02-24T14:32:00Z"). Displaying with `toLocaleTimeString()` without TZ option shows wrong local time.
**How to avoid:** Use `Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' })` for "14:32" display.

### Pitfall 5: Section order change breaks nothing but must be intentional
**What goes wrong:** The `div.space-y-5` section list in ReportDetailPage currently orders sections differently from the locked decision.
**Why it happens:** New sections are added at end instead of at correct position.
**How to avoid:** New order is explicit: Gebouw → Energielabel → WOZ → Kadaster → Eigendom → Bestemming → Monument → AI → Bronnen. The whole section list must be rewritten in correct order.

### Pitfall 6: Quick metrics grid — 6 cards overflow on mobile
**What goes wrong:** `grid-cols-4` (current 4 cards) expanding to 6 cards without responsive update breaks layout.
**How to avoid:** Use `grid-cols-2 sm:grid-cols-3 lg:grid-cols-6` or `grid-cols-3 sm:grid-cols-6` — 3 per row on mobile, 6 on large screens.

### Pitfall 7: BRK unavailable state still renders a section
**What goes wrong:** When `brk_ownership.status === 'unavailable'`, the section should still render but greyed-out — NOT return null.
**Why it happens:** Standard guard pattern `if (!data) return null` would hide the section entirely.
**How to avoid:** EigendomSection renders in all three states (available, unavailable, error) with different content per state. `unavailable` shows the "BRK-koppeling wordt geconfigureerd" message.

### Pitfall 8: WOZ-03 per-m² requires null guards on both values
**What goes wrong:** Division when `meest_recente_waarde` or `building.oppervlakte` is null/zero causes NaN or division-by-zero.
**How to avoid:**
```typescript
const perM2 = woz_data.meest_recente_waarde && building?.oppervlakte
  ? Math.round(woz_data.meest_recente_waarde / building.oppervlakte)
  : null
```

## Code Examples

### New TypeScript Interfaces (add to property.ts)

```typescript
// Add new interfaces
export interface EnergyLabel {
  energieklasse: string | null
  registratie_datum: string | null
  geldig_tot: string | null
  is_geldig: boolean | null
  berekenings_type: string | null
  soort_opname: string | null
  opname_datum: string | null
  bag_vbo_id: string | null
  is_geregistreerd: boolean
  niet_geregistreerd_reden: string | null
}

export interface WOZWaarde {
  vastgestelde_waarde: number | null
  peildatum: string | null
  toestandspeildatum: string | null
}

export interface WOZData {
  woz_objectnummer: string | null
  meest_recente_waarde: number | null
  meest_recente_peildatum: string | null
  waarden: WOZWaarde[]
  grondoppervlakte: number | null
  low_confidence: boolean
  low_confidence_reden: string | null
  bron: string
}

export interface ZakelijkGerechtigde {
  eigenaar_type: 'natuurlijk_persoon' | 'rechtspersoon' | 'overheid' | 'onbekend'
  zakelijk_recht_type: string | null
  aandeel: string | null
}

export interface PerceelOwnership {
  perceel_identificatie: string
  gerechtigden: ZakelijkGerechtigde[]
  heeft_hypotheek: boolean
}

export interface BRKOwnership {
  status: 'available' | 'unavailable' | 'error'
  data: PerceelOwnership[] | null
  reason: string | null
  fetched_at: string | null
  admin_hint: string | null
}

export interface RCEMonumentDetail {
  rijksmonumentnummer: string | null
  redengevende_omschrijving: string | null
  oorspronkelijke_functie: string | null
  bouwjaar_van: number | null
  bouwjaar_tot: number | null
  architect: string | null
  bouwstijl: string | null
  monument_register_url: string | null
}
```

### Extend CadastralParcel (add identificatie field)

```typescript
export interface CadastralParcel {
  identificatie: string | null  // ADD THIS — used by BRK lookup
  kadastrale_aanduiding: string | null
  perceelnummer: string | null
  sectie: string | null
  oppervlakte: number | null
  geometry: GeoJSONGeometry | null
}
```

### Extend MonumentStatus (add rce_detail field)

```typescript
export interface MonumentStatus {
  sources: MonumentSourceResult[]
  has_conflict: boolean
  conflict_note: string | null
  consensus_status: string | null
  restrictions_summary: string[]
  is_monument: boolean
  rce_detail: RCEMonumentDetail | null  // ADD THIS
}
```

### Extend PropertyReportResponse (add v7.0 fields)

```typescript
export interface PropertyReportResponse {
  // ... existing fields ...

  // v7.0 additions
  energy_label: EnergyLabel | null
  woz_data: WOZData | null
  brk_ownership: BRKOwnership
}
```

### EU Energy Label Arrow Diagram (SVG pattern)

```typescript
const EU_ENERGY_CLASSES = ['A++++', 'A+++', 'A++', 'A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G'] as const
const EU_ENERGY_COLORS: Record<string, string> = {
  'A++++': '#009037', 'A+++': '#009037', 'A++': '#009037', 'A+': '#009037',
  'A':     '#2dab52', 'B': '#74c24a', 'C': '#bed72e',
  'D':     '#feec00', 'E': '#f4af00', 'F': '#e7721a', 'G': '#e21a1a',
}

function EnergyArrowDiagram({ klasse }: { klasse: string }) {
  const arrowHeight = 22
  const maxWidth = 160
  const indent = 8

  return (
    <svg width="200" height={EU_ENERGY_CLASSES.length * arrowHeight + 4} aria-label={`Energielabel ${klasse}`}>
      {EU_ENERGY_CLASSES.map((cls, idx) => {
        const isActive = cls === klasse
        const y = idx * arrowHeight
        const w = maxWidth - idx * indent  // narrower as we go down
        const color = EU_ENERGY_COLORS[cls] ?? '#999'
        return (
          <g key={cls} transform={`translate(${idx * indent}, ${y})`}>
            <polygon
              points={`0,0 ${w},0 ${w + 10},${arrowHeight / 2} ${w},${arrowHeight} 0,${arrowHeight}`}
              fill={color}
              opacity={isActive ? 1 : 0.35}
            />
            <text x="6" y="14" fontSize="11" fontWeight={isActive ? 700 : 400} fill="white">
              {cls}
            </text>
            {isActive && (
              <polygon
                points={`${w + 10},${arrowHeight / 2 - 8} ${w + 22},${arrowHeight / 2} ${w + 10},${arrowHeight / 2 + 8}`}
                fill="white"
              />
            )}
          </g>
        )
      })}
    </svg>
  )
}
```

### EigendomSection — eigenaar_type display map

```typescript
const EIGENAAR_TYPE_LABELS: Record<string, string> = {
  'natuurlijk_persoon': 'Particulier eigenaar',
  'rechtspersoon':      'Rechtspersoon',
  'overheid':           'Overheid',
  'onbekend':           'Onbekend',
}
```

### WOZ Per-m² Calculation

```typescript
function WOZSection({ data }: { data: PropertyReportResponse }) {
  const { woz_data, building } = data
  if (!woz_data) {
    return <Section title="WOZ-waarde"><p className="text-sm italic text-grey-600">Geen WOZ-waarde beschikbaar</p></Section>
  }

  const waarde = woz_data.meest_recente_waarde
  const perM2 = waarde && building?.oppervlakte && building.oppervlakte > 0
    ? Math.round(waarde / building.oppervlakte)
    : null

  const euroFmt = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

  return (
    <Section title="WOZ-waarde">
      {/* Primary value + peildatum — always together (WOZ-02) */}
      <div className="divide-y divide-overlay/[0.03]">
        <Row label="WOZ-waarde" value={waarde ? euroFmt.format(waarde) : null} />
        <Row label="Peildatum" value={woz_data.meest_recente_peildatum
          ? new Date(woz_data.meest_recente_peildatum).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
          : null} />
        {perM2 && <Row label="Waarde per m²" value={euroFmt.format(perM2)} />}
      </div>
      {/* Low-confidence disclaimer (WOZ-04) */}
      {woz_data.low_confidence && woz_data.low_confidence_reden && (
        <div className="mt-3 rounded-lg border border-overlay/5 bg-overlay/[0.02] px-3 py-2">
          <p className="text-xs text-grey-600">{woz_data.low_confidence_reden}</p>
        </div>
      )}
    </Section>
  )
}
```

### BRK fetched_at timestamp formatting

```typescript
const timeFmtNL = new Intl.DateTimeFormat('nl-NL', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Amsterdam',
})

function formatFetchedAt(fetchedAt: string | null): string | null {
  if (!fetchedAt) return null
  try {
    return `Actueel opgevraagd om ${timeFmtNL.format(new Date(fetchedAt))}`
  } catch {
    return null
  }
}
```

### Section Order (updated div.space-y-5 in ReportDetailPage)

```tsx
<div className="space-y-5">
  <GebouwSection data={data} />
  <EnergieLabelSection data={data} />
  <WOZSection data={data} />
  <KadasterSection data={data} />
  <EigendomSection data={data} />
  <BestemmingSection data={data} />
  <MonumentSection data={data} />
  {ai_parsing?.parsed_plan && ai_parsing.status === 'complete' ? (
    <AIInterpretatieSection data={data} />
  ) : (
    <PDFUploadSection data={data} />
  )}
  <BronnenSection data={data} />
</div>
```

### Quick Metrics Grid (6 cards)

```tsx
{/* Quick facts — expanded to 6 cards (v7.0) */}
<div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
  <MetricCard label="Bouwjaar" value={building?.bouwjaar?.toString() ?? '–'} ... />
  <MetricCard label="Vloeroppervlak" value={building?.oppervlakte ? `${building.oppervlakte} m²` : '–'} ... />
  <MetricCard label="Gebruiksdoel" value={building?.gebruiksdoel?.[0] ?? '–'} />
  <MetricCard label="Energielabel" value={data.energy_label?.energieklasse ?? '–'} />
  <MetricCard label="WOZ-waarde" value={data.woz_data?.meest_recente_waarde ? euroFmt.format(data.woz_data.meest_recente_waarde) : '–'} />
  <MetricCard label="Compleetheid" value={`${Math.round(completeness_score * 100)}%`} bar={completeness_score} />
</div>
```

### PropertyDetailPanel — DataState additions

```tsx
function DataState({ data }: { data: PropertyReportResponse }) {
  return (
    <>
      <PropertySummary data={data} />
      <PropertySection title="Energielabel"><EnergieLabelContent data={data} /></PropertySection>
      <PropertySection title="WOZ-waarde"><WOZContent data={data} /></PropertySection>
      <PropertySection title="Kadaster"><KadasterContent data={data} /></PropertySection>
      <PropertySection title="Eigendom"><EigendomContent data={data} /></PropertySection>
      <PropertySection title="Bestemming"><BestemmingContent data={data} /></PropertySection>
      <PropertySection title="Monument"><MonumentContent data={data} /></PropertySection>
      <PropertySection title="Bronnen"><BronnenContent data={data} /></PropertySection>
    </>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 4 quick metric cards | 6 quick metric cards | Phase 56 | Energielabel + WOZ at a glance |
| MonumentSection shows only status + restrictions | MonumentSection adds rce_detail (bouwperiode, functie, redengevende omschrijving) | Phase 56 | RCE enrichment now surfaced |
| Section order: Gebouw → Kadaster → Bestemming → Monument | Gebouw → Energielabel → WOZ → Kadaster → Eigendom → Bestemming → Monument | Phase 56 | Thematic grouping |

**No deprecated patterns in this phase** — all new sections follow existing patterns.

## Open Questions

1. **RCE redengevende omschrijving field name confidence**
   - What we know: Backend schema uses `redengevende_omschrijving`; the RCE Linked Data client uses `ceo:omschrijving` predicate from Omschrijving nodes
   - What's unclear: Whether Phase 53 live validation confirmed the field actually populates with content in practice (field may be null for some monuments)
   - Recommendation: Always guard on `rce_detail?.redengevende_omschrijving` being non-null; show collapsible only when content exists

2. **BRK rechtspersoon name — where is it in the schema?**
   - What we know: CONTEXT.md says "Rechtspersoon names ARE shown (public info)" but `ZakelijkGerechtigde` only has `eigenaar_type`, `zakelijk_recht_type`, `aandeel` — no name field
   - What's unclear: The backend BRK schema (Phase 54) may not return a name field since it wasn't in the defined schema
   - Recommendation: Display rechtspersoon type as-is without a name; if the backend adds a `naam` field in future it can be added then. Do NOT assume data that isn't in the schema.

3. **PropertySummary — does it need updating?**
   - What we know: `PropertySummary.tsx` currently shows Bouwjaar, Opp, Bestemming, Monument badge, Compleetheid in the side panel header
   - What's unclear: Should the side panel header also show Energielabel or WOZ at a glance?
   - Recommendation: Keep PropertySummary unchanged (3 metric grid + monument badge + completeness bar). The new `PropertySection` items handle detail display below the summary.

## Sources

### Primary (HIGH confidence)
- Direct codebase read of `frontend/src/components/reports/ReportDetailPage.tsx` — section pattern, Section/Row components, MetricCard, existing order
- Direct codebase read of `frontend/src/lib/types/property.ts` — current TypeScript interfaces, what's missing
- Direct codebase read of `backend/app/schemas/energy_label.py` — EnergyLabel fields
- Direct codebase read of `backend/app/schemas/woz.py` — WOZData/WOZWaarde fields
- Direct codebase read of `backend/app/schemas/brk_ownership.py` — BRKOwnership/PerceelOwnership/ZakelijkGerechtigde fields
- Direct codebase read of `backend/app/schemas/monument.py` — MonumentStatus, RCEMonumentDetail fields
- Direct codebase read of `backend/app/schemas/property.py` — PropertyReportResponse with v7.0 fields confirmed
- Direct codebase read of `frontend/src/styles/index.css` — CSS variables, Tailwind 4 @theme tokens
- Direct codebase read of `frontend/package.json` — all installed dependencies confirmed

### Secondary (MEDIUM confidence)
- EU energy label color scheme based on EU Regulation 2021/340 (well-established public standard)
- Dutch locale currency/date formatting via `Intl` browser APIs (platform standard)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified from package.json and codebase
- Architecture: HIGH — patterns read directly from existing section components
- TypeScript types: HIGH — read from both backend schemas and frontend types file
- EU arrow diagram: MEDIUM — SVG approach confirmed as zero-dependency; exact dimensions are Claude's discretion
- Pitfalls: HIGH — identified from direct comparison of backend schemas vs. frontend types

**Research date:** 2026-02-24
**Valid until:** 2026-03-25 (stable frontend codebase, 30-day window)
