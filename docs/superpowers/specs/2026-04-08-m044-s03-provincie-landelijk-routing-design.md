# M044/S03 — Provincie + Landelijk Source Routing Design Spec

**Milestone:** M044 Source Detail Views — Design Contract Herziening
**Slice:** S03 Provincie + landelijk source workspace routing
**Date:** 2026-04-08
**Status:** approved — ready for implementation plan

---

## 1. Goal

Wire the 14 currently-unreachable document sources (8 provincie + 6 landelijk document) into the application so clicking a tile opens a full detail workspace backed by the S02 `DocumentSourceDetailView` shared shell. No new components — pure routing + dispatch wiring on top of the shell that is already entity-type agnostic.

## 2. Scope

### In scope

- `DataSourceCard` props extension (add `provincieCode?: string`)
- `DataSourceCard.handleCardClick` 3-branch routing (gemeente / provincie / landelijk)
- `ProvincieDetail` passes `provincieCode` through to `DataSourceCard` children
- New inline function `ProvincieSourceDetailWorkspace` in `beleid.tsx` (no enriched cases, always renders `DocumentSourceDetailView entityType="provincie"`)
- `LandelijkSourceDetail` default case upgraded from stub (guidance card + description paragraph) to `DocumentSourceDetailView entityType="landelijk" entityCode="NL"`
- Main route dispatch: new `activeProvincie && activeSource` branch
- Main route dispatch: landelijk branch condition tightened to `activeSource && !activeGemeente && !activeProvincie`
- Landelijk click routing: drop the `source.status === "live"` check (all landelijk sources click through, not just enriched ones)
- Provincie breadcrumb: resolve provincie name from `useProvincieGeoJSON` (consistent with how gemeente breadcrumb does it)
- `entityCode="NL"` convention for all landelijk policy documents

### Out of scope (deferred)

- RvoSubsidies + Omgevingswet enriched component cleanup → S04
- Further splitting of `beleid.tsx` (will grow from 2060 to ~2140 lines) → later polish slice
- The pre-existing violet §14 violations in `BeleidscontextCard.tsx` → backlog task #24
- The 3 source types reserved for future enrichment (nieuws-monitoring, gemeentelijke-subsidies, provinciale-subsidies) — they use the shared shell as baseline via the default case → backlog tasks #12, #13
- Entity union refactor of `DataSourceCard` props (replacing `gemeenteCode` + `provincieCode` with a single discriminated union) — larger refactor, later polish

## 3. Architecture

**Files touched:** 1 — `frontend/src/routes/_authenticated/beleid.tsx`

**No new files.** No new components. No new hooks. No new dependencies.

**Why so small:** S02 already built the shared shell (`DocumentSourceDetailView`) with a 3-value entity type prop. S03 just points the existing provincie and landelijk code paths at it. The routing table is the primary deliverable.

## 4. Routing Table

**URL state map after S03:**

| URL | Main dispatch branch | Renders |
|---|---|---|
| `/beleid` | default | Main landing (niveau chooser + inline landelijk tiles) |
| `/beleid?gemeente=GM0983` | `activeGemeente` | `GemeenteDetail` tile grid |
| `/beleid?gemeente=GM0983&source=welstandsnota` | `activeGemeente && activeSource` | `SourceDetailWorkspace` (gemeente) — 6 enriched cases + default `DocumentSourceDetailView` |
| `/beleid?provincie=PV31` | `activeProvincie` | `ProvincieDetail` tile grid |
| **`/beleid?provincie=PV31&source=omgevingsverordening`** | **`activeProvincie && activeSource`** (NEW) | **`ProvincieSourceDetailWorkspace`** — always `DocumentSourceDetailView entityType="provincie"` |
| `/beleid?source=beng-energieprestatie` | `activeSource && !activeGemeente && !activeProvincie` (tightened) | `LandelijkSourceDetail` — 2 enriched (rvo-subsidies, omgevingswet) + default now `DocumentSourceDetailView entityType="landelijk" entityCode="NL"` |

**New dispatch order in main route** (insertion + condition tightening):

```tsx
if (activeGemeente && activeSource) return <SourceDetailWorkspace ... />        // 1. existing
if (activeProvincie && activeSource) return <ProvincieSourceDetailWorkspace ... /> // 2. NEW
if (activeGemeente) return <GemeenteDetail ... />                                 // 3. existing
if (activeProvincie) return <ProvincieDetail ... />                               // 4. existing
if (activeSource && !activeGemeente && !activeProvincie)                          // 5. tightened
  return <LandelijkSourceDetail ... />
return <MainLanding ... />                                                        // 6. default
```

The order matters: `activeProvincie && activeSource` must come BEFORE `activeProvincie` alone, otherwise a URL with both params would hit the tile grid instead of the source detail. Same rule as gemeente.

## 5. Component Wiring Changes

### 5.1 `DataSourceCard` props interface

```tsx
interface DataSourceCardProps {
  source: DataSource
  entityType?: 'gemeente' | 'provincie' | 'landelijk'
  entityCode?: string
  gemeenteData?: GemeenteIntelligenceData
  gemeenteCode?: string
  provincieCode?: string   // NEW — additive, non-breaking
}
```

Rationale for additive approach: the existing codebase passes `gemeenteCode` to DataSourceCard from multiple call sites, and the `entityType`/`entityCode` props already exist but are used inconsistently. A proper refactor to a discriminated union (`{ type, code } | { type: 'landelijk' }`) would touch every call site. That refactor is valuable but out of S03's minimal-routing scope.

### 5.2 `DataSourceCard.handleCardClick`

```tsx
const handleCardClick = useCallback(() => {
  if (gemeenteCode) {
    navigate({
      to: '/beleid',
      search: {
        gemeente: gemeenteCode,
        source: source.key,
        category: source.category,
      },
    })
  } else if (provincieCode) {
    navigate({
      to: '/beleid',
      search: {
        provincie: provincieCode,
        source: source.key,
        category: source.category,
      },
    })
  } else {
    // Landelijk — no gemeente, no provincie
    navigate({
      to: '/beleid',
      search: { source: source.key, category: source.category },
    })
  }
}, [gemeenteCode, provincieCode, navigate, source.key, source.category])
```

The `source.status === 'live'` check is dropped from the landelijk branch — we want all landelijk sources (including the 6 document ones) to navigate to their detail view, not just the 2 live-enriched ones.

### 5.3 `ProvincieDetail` — pass `provincieCode` through

`ProvincieDetail` (at `beleid.tsx:1461`) currently renders the entity detail shared wrapper with `PROVINCIE_DATA_SOURCES`. The wrapper renders `DataSourceCard` for each source. The wiring must ensure `provincieCode` reaches the cards.

The implementer should inspect the shared wrapper (`EntityDetail` or similar) and either:
- Extend it to accept a `provincieCode` prop and pass through to children
- Map over `PROVINCIE_DATA_SOURCES` inline in `ProvincieDetail` and render `DataSourceCard` with `provincieCode` directly

The implementer picks the cleaner path based on how `EntityDetail` currently abstracts over gemeente/provincie.

### 5.4 `ProvincieSourceDetailWorkspace` — new inline function

Added to `beleid.tsx` directly after `SourceDetailWorkspace`. Structure mirrors `SourceDetailWorkspace` but simpler (no enriched switch, no gemeente-specific hooks):

```tsx
function ProvincieSourceDetailWorkspace({
  sourceKey,
  provincieCode,
  onBack,
}: {
  sourceKey: string
  provincieCode: string
  onBack: () => void
}) {
  const source = PROVINCIE_DATA_SOURCES.find((s) => s.key === sourceKey)

  // Resolve provincie naam from geojson for breadcrumb consistency
  const { data: provincieGeoJSON } = useProvincieGeoJSON(true)
  const provincieNaam = useMemo(() => {
    if (!provincieGeoJSON) return null
    const feature = provincieGeoJSON.features.find(
      (f) =>
        String((f.properties as Record<string, unknown>)?.statcode ?? '') ===
        provincieCode,
    )
    return feature
      ? String(
          (feature.properties as Record<string, unknown>)?.statnaam ??
            provincieCode,
        )
      : provincieCode
  }, [provincieGeoJSON, provincieCode])

  if (!source) {
    return (
      <div className="space-y-6">
        <motion.button ... onClick={onBack}>
          <ArrowLeft size={14} />
          Terug naar {provincieNaam ?? 'provincie'}
        </motion.button>
        <div className="rounded-[20px] border border-[#EAEFEF] bg-white p-8 text-center">
          <p className="text-[13px] text-slate-400">
            Databron &ldquo;{sourceKey}&rdquo; niet gevonden.
          </p>
        </div>
      </div>
    )
  }

  const Icon = source.icon

  return (
    <div className="space-y-6">
      <motion.button ... onClick={onBack}>
        <ArrowLeft size={14} />
        Terug naar {provincieNaam ?? 'provincie'}
      </motion.button>

      <motion.div variants={fadeUp} initial="hidden" animate="show" className="flex items-center gap-4">
        <div className="flex size-14 items-center justify-center rounded-full bg-[#0E1111]">
          <Icon className="size-7 text-[#F9A826]" strokeWidth={2} />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            Databron · {source.category}
          </p>
          <h1 className="text-[28px] font-black leading-none tracking-tight text-[#0E1111]">
            {source.label}
          </h1>
          <p className="mt-1 text-[12px] text-slate-500">{source.description}</p>
        </div>
      </motion.div>

      <motion.div variants={fadeUp} initial="hidden" animate="show">
        <DocumentSourceDetailView
          entityType="provincie"
          entityCode={provincieCode}
          sourceKey={sourceKey}
        />
      </motion.div>
    </div>
  )
}
```

Imports needed (most already present in `beleid.tsx`): `useMemo` from React, `useProvincieGeoJSON` from hooks, `DocumentSourceDetailView` already imported, `PROVINCIE_DATA_SOURCES` already in scope.

### 5.5 `LandelijkSourceDetail` default case upgrade

Current stub (approximately line ~1863 of beleid.tsx post-S02):

```tsx
default:
  return (
    <div className="space-y-4">
      <SourceGuidanceCard sourceKey={sourceKey} />
      <div className="rounded-[16px] border border-[#EAEFEF] bg-white p-6">
        <p className="text-[13px] text-slate-500">{source.description}</p>
      </div>
    </div>
  )
```

Replacement:

```tsx
default:
  return (
    <DocumentSourceDetailView
      entityType="landelijk"
      entityCode="NL"
      sourceKey={sourceKey}
    />
  )
```

The 2 enriched cases (`rvo-subsidies`, `omgevingswet`) stay unchanged — those belong to S04 scope.

### 5.6 Main route dispatch — new branch + condition update

Insert new branch immediately after the gemeente+source branch (line ~1949):

```tsx
// After line 1949 (gemeente+source), before line 1951 (gemeente alone):
if (activeProvincie && activeSource) {
  return (
    <ResultsShell>
      <div className="mx-auto max-w-4xl">
        <ProvincieSourceDetailWorkspace
          sourceKey={activeSource}
          provincieCode={activeProvincie}
          onBack={() =>
            navigate({
              to: '/beleid',
              search: { provincie: activeProvincie },
            })
          }
        />
      </div>
    </ResultsShell>
  )
}
```

Tighten the landelijk condition:

```tsx
// Line ~1981
// Before
if (activeSource && !activeGemeente) { ... }
// After
if (activeSource && !activeGemeente && !activeProvincie) { ... }
```

## 6. Success Criteria

- [ ] Clicking a provincie tile (e.g. Omgevingsverordening Limburg) navigates to `/beleid?provincie=PV31&source=omgevingsverordening&category=...`
- [ ] The provincie source detail page renders: breadcrumb "Terug naar Limburg" + source heading + DocumentSourceDetailView (SourceGuidanceCard + conditional upload zone + empty state or document list)
- [ ] Back button returns to the Limburg tile grid
- [ ] Clicking a landelijk document tile (e.g. BENG energieprestatie) navigates to `/beleid?source=beng-energieprestatie&category=...`
- [ ] The landelijk document detail page renders the same DocumentSourceDetailView layout (not the old stub)
- [ ] Clicking rvo-subsidies or omgevingswet (landelijk enriched) still renders their existing custom components, unchanged
- [ ] Clicking any of the 6 gemeente enriched sources still routes to their existing enriched components, unchanged
- [ ] Clicking any of the 10 gemeente document sources still routes to DocumentSourceDetailView, unchanged
- [ ] `npx tsc --noEmit` clean for `beleid.tsx`
- [ ] `prettier --check` clean for `beleid.tsx`
- [ ] §14 grep clean in the new ProvincieSourceDetailWorkspace function
- [ ] Manual UAT (non-admin path): click through provincie Limburg + a few sources, click through landelijk BENG + a few sources, verify visual consistency with gemeente flow

## 7. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Landelijk entityCode "NL" is arbitrary — might conflict with future convention | Zero rows in policy_documents table today (checked). Full flexibility. If convention changes later, simple migration UPDATE statement. |
| `ProvincieDetail` might not have an `entityCode` accessible at the tile map level | The implementer will inspect the shared EntityDetail wrapper and route `provincieCode` through either a new prop or by inlining the map in ProvincieDetail. Either path works. |
| Dropping `source.status === 'live'` check could break landelijk navigation for sources without detail views | Verified: every source in LANDELIJK_DATA_SOURCES has either an enriched case (rvo-subsidies, omgevingswet) or a default DocumentSourceDetailView path. No dead-end clicks possible. |
| `useProvincieGeoJSON` might not be exported or available in scope | Already imported and used in main route dispatch at line ~1901 — it IS in scope in beleid.tsx. Verified during brainstorm. |
| Tile `onDrop` drag-drop upload handler in DataSourceCard currently checks `entityType && entityCode` — provincie tiles might not have these set | Implementer should verify `entityType`/`entityCode` are passed to DataSourceCard from ProvincieDetail. If not, the drag-drop path is also broken for provincie and needs a fix in the same task. The `handleCardClick` routing fix alone isn't enough if drag-drop is also desired. |
| beleid.tsx reaches 2140+ lines after this change, further from the 300-line CLAUDE.md guideline | Explicitly deferred to a later polish slice. M044/S05 or a dedicated file-splitting slice. Not blocking S03. |

## 8. Implementation Notes for the Plan

- The `ProvincieDetail` inspection (§5.3) is the one ambiguous piece. The plan should include a Task that starts with reading lines 1461-1510 of beleid.tsx to understand how tiles are rendered, then implements the prop pass-through accordingly.
- The drag-drop upload risk mentioned in §7 must be resolved **in-scope for S03**: investigate during the first task whether `DataSourceCard` receives `entityType`/`entityCode` for provincie/landelijk today. If not, extend the ProvincieDetail wiring to pass them through alongside `provincieCode`. Drag-drop should work consistently across all 3 levels before S03 closes — it is the "upload" side of the "click and upload" flow that this slice unlocks.
- The plan should structure tasks as: (1) ProvincieDetail wiring inspection + fix, (2) DataSourceCard interface + handleCardClick update, (3) ProvincieSourceDetailWorkspace function added, (4) LandelijkSourceDetail default upgrade, (5) main route dispatch update, (6) verification + UAT.

## 9. Open Questions

None — all design decisions resolved during brainstorm 2026-04-08 across 3 approved sections + scope clarifications.

## 10. Backlog Captured

- **Task #24:** Fix violet §14 violations in BeleidscontextCard.tsx (pre-existing, discovered during M044/S02.1 rename; out of S03 scope)
- **Future polish:** split beleid.tsx into smaller focused files (currently 2060 lines, will be 2140 after S03)
- **Future refactor:** replace `gemeenteCode` + `provincieCode` optional props in DataSourceCard with a discriminated union entity prop
- **S04 dependency:** RvoSubsidies + Omgevingswet enriched components still have forbidden-color violations (documented during S02 brainstorm) — S04 will fix them
