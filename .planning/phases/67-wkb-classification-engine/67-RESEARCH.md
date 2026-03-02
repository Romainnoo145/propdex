# Phase 67: Wkb Classification Engine - Research

**Researched:** 2026-03-02
**Domain:** Dutch building regulations (Wkb), asbestos risk, service classification, frontend report sections
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
All implementation decisions deferred to Claude based on completed research and clear success criteria.

### Claude's Discretion
- **Wkb section layout** — Follow existing report section patterns. Show gevolgklasse result (GK1 or "Niet van toepassing") with "Indicatief" label. Include reasoning factors from wkb_precheck scoring where available.
- **Asbest risk presentation** — Color-coded risk level (Hoog/Geen) following existing report visual patterns. NEN 2991 reference as inline text, not external link. Match severity tone to existing report section styling.
- **Indicatief disclaimer positioning** — Section-level subtitle label, consistent with how other data-confidence indicators appear in reports. Not a modal or banner — subtle but always visible.
- **Exclusion state rendering** — When wkb_applicable is false (monument or verbouwing), replace the classification content with the specific exclusion message from success criteria. Keep the section present but with distinct "niet van toepassing" styling rather than hiding it entirely.
- **Service architecture** — Extend existing wkb_precheck.py pattern. Asbest indicator as separate function/module given distinct logic (bouwjaar-based) vs gevolgklasse (building-type-based).
- **Schema extension** — Add wkb fields to PropertyReportResponse following established Pydantic model patterns with Optional fields for graceful degradation.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| WKB-01 | User can see gevolgklasse classification (1/2/3) for any property in the report, labeled as "indicatief" | New `wkb_classifier.py` pure function; WkbClassification Pydantic model; WkbClassificatieSection React component in ReportDetailPage |
| WKB-02 | User can see asbest risk indicator based on bouwjaar (hoog: 1963-1993, middel: pre-1963, geen: post-1993) in the report | New `asbest_indicator.py` pure function; AsbestIndicator Pydantic model; AsbestSection React component |
| WKB-03 | Verbouwing projects are flagged with "Wkb niet van toepassing" notice (Dec 2024 ministerial ruling) | BAG status "Verbouwing pand" is the trigger; wkb_applicable=False in schema; special exclusion rendering |
| WKB-04 | Wkb classification excludes rijksmonumenten (monument status from existing RCE data) | MonumentStatus.is_monument + consensus_status "rijksmonument" is the trigger; wkb_applicable=False in schema |
</phase_requirements>

---

## Summary

Phase 67 adds deterministic, rule-based Wkb gevolgklasse classification and asbest risk assessment to property reports, with correct exclusions for monuments and verbouwingen. The domain is pure business logic — no new external APIs are required.

The key insight is that this phase builds a **classification layer on top of existing data** already in `PropertyReportResponse`. `building.status`, `building.bouwjaar`, and `monuments.is_monument` are already fetched and available. Phase 67 interprets this data via two new service functions and exposes results through three schema additions: `wkb_classification`, `asbest_indicator`, and the `wkb_applicable` boolean.

The requirements contain a small inconsistency: the success criteria (from CONTEXT.md phase description) says asbest "Hoog" for 1963-1993 and "Geen" for post-1993, while REQUIREMENTS.md WKB-02 adds a third band: "middel: pre-1963". The correct three-band model should be implemented to satisfy WKB-02 as written.

**Primary recommendation:** Create `wkb_classifier.py` and `asbest_indicator.py` as pure synchronous functions following the `wkb_precheck.py` pattern, extend `PropertyReportResponse` with three Optional fields, call both classifiers at the same point where `evaluate_wkb_precheck` is called in `property_aggregator.py`, then add `WkbClassificatieSection` and `AsbestSection` components in `ReportDetailPage.tsx`.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Pydantic | Already in use (v2.x) | Schema models for WkbClassification, AsbestIndicator | Project standard — all schemas are Pydantic BaseModels |
| Python typing | stdlib | Literal types for gevolgklasse, asbest risk levels | Used throughout property.py already |
| React + TypeScript | Already in use | Frontend section components | Project standard |
| Tailwind CSS | Already in use | Section layout and conditional styling | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pytest (sync) | Already in use | Unit tests for pure classification functions | All new service logic is synchronous and pure |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Pure function in separate module | Inline in property_aggregator.py | Separate module matches wkb_precheck.py pattern, easier to test |
| Single combined classifier | Separate wkb_classifier + asbest_indicator | Separate functions are smaller, independently testable, and the context says "asbest indicator as separate function/module" |

**Installation:** No new dependencies required.

---

## Architecture Patterns

### Recommended Project Structure
```
backend/app/services/
├── wkb_precheck.py          # EXISTS — Layer A/B precheck scoring
├── wkb_classifier.py        # NEW — gevolgklasse + wkb_applicable determination
├── asbest_indicator.py      # NEW — bouwjaar-based asbest risk bands

backend/app/schemas/
├── property.py              # EXTEND — add WkbClassification, AsbestIndicator, wkb_applicable to PropertyReportResponse

frontend/src/components/reports/
├── ReportDetailPage.tsx     # EXTEND — add WkbClassificatieSection + AsbestSection functions
```

### Pattern 1: Pure Synchronous Classification Function
**What:** Single-responsibility function accepting typed inputs, returning a Pydantic model. No I/O.
**When to use:** All business rule evaluation — mirrors how `evaluate_wkb_precheck()` is structured.
**Example (based on existing wkb_precheck.py pattern):**
```python
# Source: backend/app/services/wkb_precheck.py (lines 112-408)
def classify_wkb(
    *,
    building: BuildingData | None,
    monuments: MonumentStatus | None,
) -> WkbClassification:
    """Classify Wkb gevolgklasse for a property."""
    # Check exclusions first (verbouwing, monument)
    ...
    return WkbClassification(...)
```

### Pattern 2: Schema Extension via Optional Fields
**What:** Add Optional fields to `PropertyReportResponse` with a descriptive comment marking the phase.
**When to use:** Every time the report is extended — established pattern in property.py.
**Example (from property.py lines 489-495):**
```python
# Phase 7 additions (v7.0 Deep Property Data)
wkb_precheck: WkbPrecheck | None = Field(
    default=None,
    description="Layer A automatic Wkb precheck with optional Layer B refinement metadata",
)
```

### Pattern 3: Section Component in ReportDetailPage
**What:** A standalone function component accepting `data: PropertyReportResponse`, rendering a `<Section>` wrapper.
**When to use:** All report sections — every section in ReportDetailPage follows this pattern.
**Example (from lines 663-786):**
```tsx
function WkbPrecheckSection({ data }: { data: PropertyReportResponse }) {
  const precheck = data.wkb_precheck
  if (!precheck) {
    return (
      <Section title="Wkb Startdossier" icon={<WkbIcon />}>
        <p className="text-sm text-grey-600">...</p>
      </Section>
    )
  }
  // render content
}
```

### Pattern 4: Classifier Call in property_aggregator.py
**What:** Call classifiers synchronously (no await) immediately after `evaluate_wkb_precheck()` at lines 960-965.
**When to use:** All non-async enrichment — buildability_delta, wkb_precheck, permit_precedents all follow this pattern.

### Pattern 5: Exclusion Logic — Verbouwing Detection
**What:** BAG `building.status` lowercased == "verbouwing pand" triggers Wkb exclusion.
**Basis:** `_ACTIVE_BOUW_STATUS` set in `wkb_precheck.py` line 16-21 already includes "verbouwing pand" (lowercase). The STATUS_EXPLANATIONS dict in ReportDetailPage also shows 'Verbouwing pand' as a known status.
**Context:** December 2024 ministerial ruling excluded verbouwingen from Wkb scope. This must be the first check in `classify_wkb()` — if excluded, `wkb_applicable=False` and gevolgklasse is not determined.

### Pattern 6: Exclusion Logic — Monument Detection
**What:** `MonumentStatus.is_monument == True` (computed from any source) triggers Wkb exclusion.
**Basis:** `monuments.is_monument` is a computed property on `MonumentStatus` (monument.py line 126-129) that is True if ANY source indicates monument status.
**Note:** Requirements say "rijksmonumenten" specifically, but `is_monument` is the reliable field. Only rijksmonumenten are out of scope per v9.0 (gemeentelijke monumenten NOT out of scope per REQUIREMENTS.md "Out of Scope" section). The classifier should check `consensus_status == "rijksmonument"` to be precise.

### Pattern 7: Asbest Risk Bands
**What:** Three-band classification from `building.bouwjaar`:
- `bouwjaar >= 1994` → "geen"
- `bouwjaar >= 1963 and bouwjaar <= 1993` → "hoog" (NEN 2991 applies)
- `bouwjaar < 1963` → "middel" (pre-industrial asbestos, less common but possible)
- `bouwjaar is None` → "onbekend"

**Basis:** WKB-02 in REQUIREMENTS.md ("hoog: 1963-1993, middel: pre-1963, geen: post-1993"). The success criteria in the phase description only mentions "Hoog" and "Geen asbest risico" as test cases — but the three-band model from REQUIREMENTS.md is the authoritative spec.
**Cutoff:** January 1, 1994 = bouwjaar < 1994 for asbestos risk. `bouwjaar <= 1993` is equivalent.

### Pattern 8: Frontend Indicatief Label
**What:** Small badge/label at section header level reading "Indicatief", not a modal or banner.
**Basis:** CONTEXT.md specifies "Section-level subtitle label, consistent with how other data-confidence indicators appear in reports." The existing confidence badge pattern in `WkbPrecheckSection` (line 717-719) provides the template:
```tsx
<span className="rounded-full border border-overlay/[0.08] bg-overlay/[0.04] px-2.5 py-1 text-xs font-medium text-grey-400">
  Confidence: {confidenceLabel}
</span>
```

### Anti-Patterns to Avoid
- **Checking `building.status.lower()` without `.strip()`:** BAG data can have trailing spaces. Always `.strip().lower()`.
- **Hiding the section when wkb_applicable is false:** CONTEXT says "Keep the section present but with distinct 'niet van toepassing' styling rather than hiding it entirely."
- **Using `monuments.is_monument` for rijksmonument exclusion directly:** Use `monuments.consensus_status == "rijksmonument"` OR the source-level check because `is_monument` is True for ANY monument type (including gemeentelijke), but only rijksmonumenten are excluded per the requirements.
- **Async classifiers:** Both `wkb_classifier.py` and `asbest_indicator.py` should be synchronous pure functions — no I/O, no awaits.
- **Hardcoding TypeScript types as `any`:** All new fields must have proper TS interfaces in `property.ts`.
- **Adding new items to `section_sources` without an icon:** Not strictly required — section_sources are informational metadata, not display sections.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Gevolgklasse boundary lookup | Custom lookup table | Simple `if/elif` logic | GK1 boundary is simple: ground-level single-family dwellings only in v9.0 — GK2/3 out of scope |
| Asbest year boundary | Date parsing | Integer comparison on bouwjaar | bouwjaar is already `int | None` in BuildingData |
| Monument type check | String parsing | `monuments.consensus_status` field | Already computed by monument_aggregator.py |

**Key insight:** All required data already exists in the PropertyReportResponse object tree. No new government API calls are needed.

---

## Common Pitfalls

### Pitfall 1: GK2/GK3 Scope Creep
**What goes wrong:** Implementing partial GK2/3 classification that produces wrong results for non-GK1 properties.
**Why it happens:** Wkb has three gevolgklassen, but v9.0 only mandates GK1 (per REQUIREMENTS.md "Out of Scope: GK2/GK3 detailed classification — Not yet mandated as of 2026; GK1 only in v9.0").
**How to avoid:** Return `gevolgklasse = "GK1"` only for ground-level single-family dwellings; return `"Niet van toepassing"` or `"Onbekend"` for everything else. Do NOT attempt GK2/3 scoring.

### Pitfall 2: Verbouwing vs. Verbouwing BAG Status
**What goes wrong:** Conflating the December 2024 verbouwing exclusion (a legal concept) with the BAG "Verbouwing pand" status (a data signal).
**Why it happens:** The requirements say to flag verbouwingen, and the BAG status happens to be named similarly.
**How to avoid:** The classifier should use BAG status "verbouwing pand" as the *proxy* for "this is a verbouwing project" since there is no other structured field. This is intentionally using the available signal. Document the approximation clearly in the schema description.

### Pitfall 3: Asbest Risk Display at Different Bouwjaar
**What goes wrong:** The existing `computeWarnings()` in `ActieVereistSection.tsx` already triggers an asbest warning for `bouwjaar < 1994`. The new `AsbestSection` must not duplicate this or contradict it.
**Why it happens:** Phase 65 added asbestrisico to the action warnings based on the same bouwjaar logic.
**How to avoid:** The new `AsbestSection` shows the full three-band indicator with NEN 2991 reference as a dedicated section. `ActieVereistSection` keeps its shorter warning. These serve different purposes (action banner vs. detailed section) — they coexist by design.

### Pitfall 4: wkb_applicable Field Inconsistency
**What goes wrong:** `wkb_applicable` could be computed differently in the backend vs. frontend, creating logic bugs in downstream CTA code (Phase 71).
**Why it happens:** Two places could interpret exclusion conditions differently.
**How to avoid:** `wkb_applicable` must be computed ONLY in the backend (in `wkb_classifier.py`) and returned as part of `WkbClassification`. Frontend reads it as authoritative — never recomputes from raw data.

### Pitfall 5: Missing TypeScript Interface Update
**What goes wrong:** Backend returns new fields but `property.ts` doesn't declare them — TypeScript treats them as `unknown` / `undefined` at runtime, causing subtle UI bugs.
**Why it happens:** Forgetting to update the frontend type file after schema extension.
**How to avoid:** After extending `PropertyReportResponse` in Python, immediately update `frontend/src/lib/types/property.ts` with matching interfaces following the `snake_case` convention used throughout.

### Pitfall 6: Bouwjaar None Handling
**What goes wrong:** `asbest_indicator()` raises or returns wrong result when `building is None` or `building.bouwjaar is None`.
**Why it happens:** Many properties lack bouwjaar data (especially older BAG records).
**How to avoid:** Return `AsbestIndicator(risk="onbekend", reden="Bouwjaar niet beschikbaar")` when bouwjaar is None. This is distinct from "geen" (confirmed post-1993). Frontend must handle this fourth state.

---

## Code Examples

### Backend: WkbClassification Schema (new Pydantic model)
```python
# Add to backend/app/schemas/property.py after WkbPrecheck

class WkbClassification(BaseModel):
    """Deterministic Wkb gevolgklasse classification block."""

    wkb_applicable: bool = Field(
        description="False when monument or verbouwing exclusion applies",
    )
    gevolgklasse: Literal["GK1", "niet_van_toepassing", "onbekend"] = Field(
        description="Determined gevolgklasse — GK1 for ground-level single-family; 'niet_van_toepassing' when excluded",
    )
    exclusion_reason: Literal["rijksmonument", "verbouwing", None] = Field(
        default=None,
        description="Why Wkb is not applicable, or None if applicable",
    )
    disclaimer: str = Field(
        default="Indicatieve classificatie op basis van openbare BAG- en monumentendata. Geen juridisch bindend advies.",
    )
```

### Backend: AsbestIndicator Schema (new Pydantic model)
```python
class AsbestIndicator(BaseModel):
    """Bouwjaar-based asbest risk indicator."""

    risk: Literal["hoog", "middel", "geen", "onbekend"] = Field(
        description="hoog: bouwjaar 1963-1993; middel: pre-1963; geen: post-1993; onbekend: bouwjaar missing",
    )
    bouwjaar: int | None = Field(
        default=None,
        description="Bouwjaar used in determination",
    )
    norm_reference: str | None = Field(
        default=None,
        description="Applicable norm (e.g. 'NEN 2991') when risk is hoog or middel",
    )
    reden: str = Field(
        description="Human-readable explanation of the risk level",
    )
```

### Backend: PropertyReportResponse Extension
```python
# Phase 9 additions (v9.0 Professional Marketplace)
wkb_classification: WkbClassification | None = Field(
    default=None,
    description="Deterministic gevolgklasse classification with exclusion flags",
)
asbest_indicator: AsbestIndicator | None = Field(
    default=None,
    description="Bouwjaar-based asbest risk indicator per NEN 2991",
)
```

### Backend: wkb_classifier.py (new service)
```python
"""Deterministic Wkb gevolgklasse classification."""
from __future__ import annotations

from app.schemas.address import BuildingData
from app.schemas.monument import MonumentStatus
from app.schemas.property import WkbClassification

_VERBOUWING_STATUS = "verbouwing pand"

def classify_wkb(
    *,
    building: BuildingData | None,
    monuments: MonumentStatus | None,
) -> WkbClassification:
    # Exclusion 1: rijksmonument
    if monuments is not None and monuments.consensus_status == "rijksmonument":
        return WkbClassification(
            wkb_applicable=False,
            gevolgklasse="niet_van_toepassing",
            exclusion_reason="rijksmonument",
        )

    # Exclusion 2: verbouwing (December 2024 ruling)
    if building is not None:
        status_lower = (building.status or "").strip().lower()
        if status_lower == _VERBOUWING_STATUS:
            return WkbClassification(
                wkb_applicable=False,
                gevolgklasse="niet_van_toepassing",
                exclusion_reason="verbouwing",
            )

    # GK1: ground-level single-family dwellings (woonfunctie, gebruiksdoel)
    if building is not None:
        gebruiksdoel_lower = [g.lower() for g in (building.gebruiksdoel or [])]
        if "woonfunctie" in gebruiksdoel_lower:
            return WkbClassification(
                wkb_applicable=True,
                gevolgklasse="GK1",
            )

    # Default: cannot determine
    return WkbClassification(
        wkb_applicable=True,  # optimistic: don't suppress CTA
        gevolgklasse="onbekend",
    )
```

### Backend: asbest_indicator.py (new service)
```python
"""Bouwjaar-based asbest risk indicator per NEN 2991."""
from __future__ import annotations

from app.schemas.address import BuildingData
from app.schemas.property import AsbestIndicator

_NEN_2991 = "NEN 2991"

def assess_asbest_risk(*, building: BuildingData | None) -> AsbestIndicator:
    if building is None or building.bouwjaar is None:
        return AsbestIndicator(
            risk="onbekend",
            bouwjaar=None,
            reden="Bouwjaar niet beschikbaar — asbestrisico kan niet worden bepaald.",
        )

    bouwjaar = building.bouwjaar

    if bouwjaar >= 1994:
        return AsbestIndicator(
            risk="geen",
            bouwjaar=bouwjaar,
            reden=f"Bouwjaar {bouwjaar} — na 1 januari 1994. Asbest was op dat moment al verboden in bouwmaterialen.",
        )
    elif bouwjaar >= 1963:
        return AsbestIndicator(
            risk="hoog",
            bouwjaar=bouwjaar,
            norm_reference=_NEN_2991,
            reden=f"Bouwjaar {bouwjaar} — periode 1963–1993. Asbesthoudende materialen zijn waarschijnlijk aanwezig. Asbestinventarisatie verplicht voor sloop of ingrijpende verbouwing (NEN 2991).",
        )
    else:
        return AsbestIndicator(
            risk="middel",
            bouwjaar=bouwjaar,
            norm_reference=_NEN_2991,
            reden=f"Bouwjaar {bouwjaar} — voor 1963. Asbest was minder gangbaar maar kan aanwezig zijn in oudere materialen.",
        )
```

### Frontend: TypeScript types to add to property.ts
```typescript
export interface WkbClassification {
  wkb_applicable: boolean
  gevolgklasse: 'GK1' | 'niet_van_toepassing' | 'onbekend'
  exclusion_reason: 'rijksmonument' | 'verbouwing' | null
  disclaimer: string
}

export interface AsbestIndicator {
  risk: 'hoog' | 'middel' | 'geen' | 'onbekend'
  bouwjaar: number | null
  norm_reference: string | null
  reden: string
}
```

### Frontend: PropertyReportResponse additions in property.ts
```typescript
// Phase 9 additions (v9.0 Professional Marketplace)
wkb_classification?: WkbClassification | null
asbest_indicator?: AsbestIndicator | null
```

### Frontend: WkbClassificatieSection pattern (in ReportDetailPage.tsx)
```tsx
function WkbClassificatieSection({ data }: { data: PropertyReportResponse }) {
  const classification = data.wkb_classification

  if (!classification) {
    return (
      <Section title="Wkb Classificatie" icon={<WkbIcon />}>
        <p className="text-sm text-grey-600">Classificatie niet beschikbaar</p>
      </Section>
    )
  }

  if (!classification.wkb_applicable) {
    const msg = classification.exclusion_reason === 'rijksmonument'
      ? 'Wkb niet van toepassing — rijksmonumenten zijn vrijgesteld'
      : 'Wkb niet van toepassing — verbouwingen zijn uitgesloten'
    return (
      <Section title="Wkb Classificatie" icon={<WkbIcon />}>
        <p className="text-sm text-grey-400">{msg}</p>
        <p className="mt-2 text-[11px] text-grey-600">{classification.disclaimer}</p>
      </Section>
    )
  }

  return (
    <Section title="Wkb Classificatie" icon={<WkbIcon />}>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-amber-accent/30 bg-amber-accent/10 px-3 py-1 text-xs font-semibold text-amber-accent">
            {classification.gevolgklasse === 'GK1' ? 'Gevolgklasse 1' : classification.gevolgklasse}
          </span>
          <span className="rounded-full border border-overlay/[0.08] bg-overlay/[0.04] px-2.5 py-1 text-xs font-medium text-grey-400">
            Indicatief
          </span>
        </div>
        <p className="text-[11px] text-grey-600">{classification.disclaimer}</p>
      </div>
    </Section>
  )
}
```

### Frontend: AsbestSection pattern (in ReportDetailPage.tsx)
```tsx
const ASBEST_RISK_STYLES = {
  hoog: 'border-error/30 bg-error/10 text-error',
  middel: 'border-warning/30 bg-warning/10 text-warning',
  geen: 'border-success/25 bg-success/[0.08] text-success',
  onbekend: 'border-overlay/[0.08] bg-overlay/[0.04] text-grey-400',
}

function AsbestSection({ data }: { data: PropertyReportResponse }) {
  const asbest = data.asbest_indicator
  if (!asbest) return null

  const riskLabel = { hoog: 'Hoog', middel: 'Middel', geen: 'Geen', onbekend: 'Onbekend' }[asbest.risk]
  const badgeClass = ASBEST_RISK_STYLES[asbest.risk]

  return (
    <Section title="Asbestrisico" icon={<AsbestIcon />}>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass}`}>
            {riskLabel}
          </span>
          {asbest.norm_reference && (
            <span className="text-xs text-grey-500">{asbest.norm_reference}</span>
          )}
        </div>
        <p className="text-sm text-grey-400">{asbest.reden}</p>
      </div>
    </Section>
  )
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No Wkb classification in report | New `wkb_classifier.py` + section | Phase 67 | Report shows deterministic GK1/exclusion |
| Asbest only in ActieVereistSection banner | Full AsbestSection with three bands + NEN ref | Phase 67 | More complete, satisfies WKB-02 |
| wkb_applicable unknown | `wkb_applicable: bool` in WkbClassification | Phase 67 | Phase 71 CTA can use single truth source |

**Deprecated/outdated:**
- `_ACTIVE_BOUW_STATUS` in wkb_precheck.py includes "verbouwing pand" as a scoring signal. In the new classifier, "verbouwing pand" becomes an exclusion trigger (wkb_applicable=False), not just a +2 score. These serve different purposes and both remain correct in their context.

---

## Integration Points: property_aggregator.py

The two new classifier calls go immediately after `evaluate_wkb_precheck()` at line 960 in `property_aggregator.py`:

```python
# Add imports at top
from app.services.wkb_classifier import classify_wkb
from app.services.asbest_indicator import assess_asbest_risk
from app.schemas.property import WkbClassification, AsbestIndicator

# After evaluate_wkb_precheck call (line 960-965):
wkb_classification = classify_wkb(
    building=building,
    monuments=monument_status,
)
asbest_result = assess_asbest_risk(building=building)
```

And in the `PropertyReportResponse(...)` constructor call (~line 1214):
```python
wkb_classification=wkb_classification,
asbest_indicator=asbest_result,
```

No section_sources entries are strictly needed for pure-logic classifiers (no external API), but can be added as "Wkb classifier (rule-based)" / "Asbest indicator (bouwjaar)" if completeness reporting requires it.

---

## Section Placement in ReportDetailPage

Current section order (locked in Phase 65 Plan 01):
```
Bestemmingsplan → Kadaster → BRK → Gebouw → WOZ → Energielabel → Buildability → Wkb → Permits → Market → AI
```

New sections should be placed **inside or adjacent to the existing "Wkb Startdossier" block**. Options:
1. **Before WkbPrecheckSection**: `WkbClassificatieSection` → `AsbestSection` → `WkbPrecheckSection`
2. **After WkbPrecheckSection**: `WkbPrecheckSection` → `WkbClassificatieSection` → `AsbestSection`

Recommended: Place `WkbClassificatieSection` immediately **before** `WkbPrecheckSection` (the classification result is the headline, precheck is the detailed scoring). Place `AsbestSection` immediately **after** `WkbClassificatieSection` since both are Wkb-related risk indicators. This groups all Wkb intelligence together.

---

## Open Questions

1. **GK1 boundary precision — BAG gebruiksdoel vs. building type**
   - What we know: GK1 is ground-level single-family dwellings. BAG `gebruiksdoel` contains "Woonfunctie" for residential use.
   - What's unclear: Multi-family apartment buildings also have "Woonfunctie" — is floor count needed? (Floor count not in current BAG data.)
   - Recommendation: For v9.0, classify `"Woonfunctie"` gebruiksdoel as GK1 and accept the approximation. The disclaimer "Indicatief" covers this. GK2/GK3 are out of scope entirely.

2. **wkb_applicable for "onbekend" gevolgklasse — should it be True or False?**
   - What we know: When building data is absent and no exclusion applies, gevolgklasse = "onbekend".
   - What's unclear: For Phase 71 CTA logic, should unknown = show CTA or hide CTA?
   - Recommendation: Set `wkb_applicable=True` for "onbekend" (optimistic) — show the CTA if exclusion doesn't apply. This is conservative from a legal compliance perspective.

3. **Asbest warning in ActieVereistSection vs. AsbestSection — duplicate?**
   - What we know: `computeWarnings()` triggers asbestrisico warning for `bouwjaar < 1994` already.
   - What's unclear: Should the ActieVereistSection warning be updated to use the new three-band model?
   - Recommendation: Keep ActieVereistSection as-is for Phase 67 (it uses `bouwjaar < 1994` which is fine). The new `AsbestSection` provides the detailed three-band view. This is complementary, not redundant.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis — `backend/app/services/wkb_precheck.py`, `property_aggregator.py`, `schemas/property.py`, `schemas/monument.py` — all patterns verified by reading source
- `frontend/src/components/reports/ReportDetailPage.tsx` — Section component patterns, WkbPrecheckSection implementation, ActieVereistSection
- `frontend/src/lib/types/property.ts` — Current TS interface structure
- `.planning/REQUIREMENTS.md` — WKB-01 through WKB-04 specifications
- `.planning/phases/67-wkb-classification-engine/67-CONTEXT.md` — User decisions

### Secondary (MEDIUM confidence)
- December 2024 ministerial ruling on verbouwing exclusion — documented in project CONTEXT.md as established fact. Not independently verified via web search but treated as authoritative project context.
- NEN 2991 as the applicable norm for asbest inventarisatie — standard Dutch building practice knowledge; bouwjaar 1993 cutoff is the widely-accepted date asbestos was banned in construction materials in the Netherlands (Asbestbesluit 1993).

### Tertiary (LOW confidence)
- GK1 boundary as "ground-level single-family dwellings only" — from CONTEXT.md "specifics" section. Exact GK1 statutory definition requires consulting Bbl 2022 for precision, but v9.0 is explicitly limited to GK1 with `gebruiksdoel=woonfunctie` as the proxy.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, all patterns verified in existing code
- Architecture: HIGH — service patterns, schema extension, aggregator integration all directly verified
- Pitfalls: HIGH — verbouwing/asbest interaction with existing ActieVereistSection verified by code reading
- GK1 classification logic: MEDIUM — approximation using BAG gebruiksdoel acknowledged; GK2/3 out of scope

**Research date:** 2026-03-02
**Valid until:** 2026-04-02 (30 days; stable domain — regulatory law doesn't change rapidly)
