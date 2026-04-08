# M044/S02 — DocumentSourceDetailView Design Spec

**Milestone:** M044 Source Detail Views — Design Contract Herziening
**Slice:** S02 Document source basis view — gedeeld component voor alle 22 roadmap sources
**Date:** 2026-04-08
**Status:** approved — ready for implementation plan

---

## 1. Goal

Build a single reusable `DocumentSourceDetailView` component that serves all 24 document-based source detail views in the configuratie page (10 gemeente + 8 provincie + 6 landelijk). The component follows `CONFIGURATIE-DESIGN-CONTRACT.md` exactly and replaces the 250-line inline `DocumentSourceDetail` function currently embedded in the 2053-line `configuratie.tsx` route file.

Every document source (welstandsnota, woonvisie, omgevingsverordening, BENG, etc.) uses the same structural shell — differences between sources flow through data (guidance text, uploaded PDF, AI summary), not through code branching.

## 2. Scope

### In scope

- New component `DocumentSourceDetailView` built per contract §1–§14
- 4 new focused sub-components: `SourceGuidanceCard`, `DocumentUploadZone`, `DocumentListItem`, `AiSummaryCard`
- New data-only file `sourceGuidance.ts` holding the 24 SOURCE_GUIDANCE entries + interface
- Reuses the existing `PDFViewerModal` from `@/components/ui/PDFViewerModal` for PDF viewing (do NOT build a new one)
- Reuses the shared `DetailStates` (DetailLoading/DetailEmpty/DetailError) from S01
- Entity-type prop (`'gemeente' | 'provincie' | 'landelijk'`) so the component is ready for S03 routing
- Delete the existing `DocumentSourceDetail` inline function from `configuratie.tsx`
- Wire the new component into the existing gemeente default case in `SourceDetailWorkspace`'s switch statement
- View + download functionality for uploaded documents

### Out of scope (deferred to later slices)

- Provincie routing (does not exist today) — S03
- Landelijk default-case upgrade from stub to full document view — S03
- Enriched components for `nieuws-monitoring`, `gemeentelijke-subsidies`, `provinciale-subsidies` — tracked as backlog tasks #12, #13; they will use the shared shell in S02 as a temporary baseline
- Further decomposition of `configuratie.tsx` beyond removing the document source code — a later polish pass
- RvoSubsidies + Omgevingswet (the 2 landelijk live enriched) — S04
- New PDF viewer component — do not rebuild, reuse existing

## 3. Architecture

### File structure

All new files in `frontend/src/components/configuratie/`:

| File | Estimated lines | Responsibility |
|---|---|---|
| `DocumentSourceDetailView.tsx` | ~130 | Shell orchestrator. Owns data fetching (usePolicyDocuments), polling state, "which doc is being viewed" state, conditional rendering of sub-components. |
| `SourceGuidanceCard.tsx` | ~70 | Renders the contextual explainer (explainer + relevance + checklist) for a given source key. Uses `SectionInsightCard` wrapper. |
| `DocumentUploadZone.tsx` | ~110 | Drag-drop zone + "Kies bestand" button. Handles `useUploadPolicyDocument` mutation, local drag state, file input. Rendered conditionally by the shell only when the current user is a superuser. |
| `DocumentListItem.tsx` | ~90 | One row per uploaded document: filename, upload datetime, status badge (parsing/ready/error), view icon button, download icon button. Follows contract §6 list item pattern where applicable. |
| `AiSummaryCard.tsx` | ~80 | Renders the parsed AI summary inside a `SectionInsightCard` with kicker "AI-samenvatting". Replaces the current violet-tinted custom `div` with contract-conform amber-on-obsidian styling. |
| `sourceGuidance.ts` | ~300 | Pure data file: `SourceGuidance` interface + `SOURCE_GUIDANCE` constant (all 24 sources). No JSX, no imports from React. Importable from anywhere. |

**Total new files:** 6 (5 components + 1 data file). Each file comfortably under the 300-line CLAUDE.md limit.

### External dependencies

- `@/components/reports/components` — `SectionInsightCard`, `SubCard`, `KVRow` (design contract components from S01)
- `./DetailStates` — `DetailLoading`, `DetailEmpty`, `DetailError` (shared helpers from S01)
- `@/components/ui/PDFViewerModal` — existing reusable modal, imported as-is
- `@/hooks/usePolicyDocuments`, `@/hooks/useUploadPolicyDocument` — existing hooks
- `@/lib/auth/useAuth` — for `isSuperuser` check
- `parseAiSummary` helper — currently in configuratie.tsx; extract to a utility if not already shared

### Why composed instead of monolithic

1. Every file stays under 300 lines (CLAUDE.md contract compliance)
2. Sub-components like `AiSummaryCard`, `DocumentUploadZone`, `DocumentListItem` are pure presentational units that can be reused in later milestones (parcel workspace, checklisten, map popup document integration) without further refactoring
3. Matches the S01 `DetailStates.tsx` extraction pattern for consistency
4. Subagent-driven execution works better with small focused files (one task per file)

## 4. Component Interfaces

### DocumentSourceDetailView (shell)

```tsx
interface Props {
  entityType: 'gemeente' | 'provincie' | 'landelijk'
  entityCode: string   // e.g. "GM0983" for gemeente Venlo, or provincie code, or national identifier
  sourceKey: string    // e.g. "welstandsnota", "beng-energieprestatie"
}
```

### SourceGuidanceCard

```tsx
interface Props {
  sourceKey: string
}
```

Imports `SOURCE_GUIDANCE` from `./sourceGuidance`. If the sourceKey has no entry, renders a fallback `SectionInsightCard` with a generic "Geen begeleidende informatie beschikbaar" message.

### DocumentUploadZone

```tsx
interface Props {
  entityType: 'gemeente' | 'provincie' | 'landelijk'
  entityCode: string
  sourceKey: string
}
```

Owns local drag state (`isDragging`). Calls `useUploadPolicyDocument` mutation. The shell decides whether to render this component at all (only for superusers) via conditional JSX — the component itself does not do the `isSuperuser` check, keeping it a pure presentation concern.

### DocumentListItem

```tsx
interface Props {
  document: PolicyDocument   // existing type from usePolicyDocuments
  onView: () => void         // shell sets viewingDocId
  onDownload: () => void     // shell triggers authenticated blob download
}
```

Renders a row with filename, upload timestamp, status pill (§5 semantic pill — green for ready, amber for parsing, red for error), view button (`<Eye size={14}>`), download button (`<Download size={14}>`).

### AiSummaryCard

```tsx
interface Props {
  summary: ParsedAiSummary   // whatever parseAiSummary returns
  documentName: string       // filename shown in the card title
}
```

Renders inside a `SectionInsightCard kicker="AI-samenvatting" title={documentName} Icon={Sparkles}`. The parsed summary fields are rendered as `SubCard` or `KVRow` children per contract.

## 5. Data Flow & State Ownership

### Shell owns

- Data fetching via `usePolicyDocuments(entityType, entityCode, sourceKey, true, polling ? 3000 : false)`
- `polling` state — automatically activated when any document has `status === 'parsing'`, automatically deactivated when all parsing completes
- `viewingDocId` state — tracks which document is open in the PDFViewerModal
- The parsed `firstSummary` memoization — finds the first document with a parseable AI summary
- `isSuperuser` check (passed down to decide whether to render `DocumentUploadZone`)
- Early returns for loading (`<DetailLoading />`) and error (`<DetailError />`)

### Sub-components own

- `DocumentUploadZone` — local drag state, file input ref, upload mutation call
- `DocumentListItem` — nothing (pure presentational)
- `SourceGuidanceCard` — nothing (pure presentational, reads SOURCE_GUIDANCE)
- `AiSummaryCard` — nothing (pure presentational)
- `PDFViewerModal` — its own internal state for PDF fetching/rendering (unchanged, reused as-is)

### Data flow diagram

```
entityType, entityCode, sourceKey  (props to shell)
        │
        ├──► usePolicyDocuments() ──► documents list
        │                                   │
        │                                   ├──► iterate → DocumentListItem[]
        │                                   ├──► first parsed → AiSummaryCard
        │                                   └──► any parsing? → polling on/off
        │
        ├──► useAuth() ──► isSuperuser ──► conditionally render DocumentUploadZone
        │
        ├──► sourceKey ──► SourceGuidanceCard (reads SOURCE_GUIDANCE)
        │
        └──► viewingDocId + documents ──► resolved doc ──► PDFViewerModal url
```

## 6. Visible States

| Scenario | What the user sees |
|---|---|
| **Loading** | Full-width `DetailLoading` spinner (from S01 shared helpers). No other content. |
| **Error** | Full-width `DetailError` with the actual `error.message` text in `text-red-400`. |
| **Empty — superuser** | SourceGuidanceCard + DocumentUploadZone. No empty state message — the upload zone is the call to action. |
| **Empty — regular user** | SourceGuidanceCard + DetailEmpty ("Nog geen document toegevoegd voor deze bron."). No upload zone visible. |
| **Populated — superuser** | SourceGuidanceCard + DocumentUploadZone + AiSummaryCard (if any ready) + SectionInsightCard containing DocumentListItems. |
| **Populated — regular user** | SourceGuidanceCard + AiSummaryCard (if any) + SectionInsightCard containing DocumentListItems. No upload zone. |

All users (super and regular) can view and download any document that exists. Upload is the only admin-gated action.

## 7. PDF viewing flow

Click eye icon on a DocumentListItem → shell sets `viewingDocId` → `PDFViewerModal` opens with `url={\`/api/policy-documents/${entityType}/${entityCode}/${documentId}\`}` → modal fetches the PDF with the user's Bearer token, renders in an embedded iframe, offers an "Open in nieuw tabblad" button in the header as fallback → click close or ESC → modal dismisses, shell clears `viewingDocId`.

## 8. Download flow

Click download icon → helper function `triggerPolicyDocDownload(entityType, entityCode, documentId, filename)` fetches the same endpoint with the auth header, creates a blob URL, triggers a synthetic `<a download>` click, revokes the object URL. Pattern copied from existing `S8VergunningChecklist.tsx` (lines 423-437). The helper lives inline inside `DocumentListItem.tsx` as a local function for S02. If later slices need the same helper elsewhere, extraction to a shared utility is a trivial follow-up refactor and is not part of S02.

## 9. Replacement of the violet AI summary card

The current code (configuratie.tsx line 1617) uses `border-violet-200 bg-violet-50 p-6` with hardcoded `<h3 className="text-[13px] font-black uppercase tracking-[0.15em] text-violet-600">AI-samenvatting</h3>` and a violet `Sparkles` icon.

The new `AiSummaryCard` uses `SectionInsightCard` with `kicker="AI-samenvatting"`, `title={documentName}`, `Icon={Sparkles}`. The icon inherits the contract's amber-on-obsidian styling from `SectionInsightCard` automatically. The parsed summary body is rendered via `SubCard` or `KVRow` children — whichever matches the structure of `ParsedAiSummary`. No violet anywhere. No custom containers.

## 10. Superuser gating semantics

Per user confirmation during brainstorm 2026-04-08:

- **Upload** is the only admin action. Only superusers see `DocumentUploadZone`.
- **View and download** are available to every authenticated user. Documents are organizational knowledge shared across the team.
- **Delete and edit** are not in S02 scope.
- Currently `is_superuser` on the user record is the admin flag. The project is moving toward SaaS where "admin" will be a distinct role separate from "superuser"; S02 uses `isSuperuser` as-is today with the understanding that the gating predicate will be swapped later without changing the component surface.

## 11. sourceGuidance.ts structure

```ts
export interface SourceGuidance {
  explainer: string
  relevance: string
  checklist: string[]
}

export const SOURCE_GUIDANCE: Record<string, SourceGuidance> = {
  // ── Gemeente (10) ──
  omgevingsvisie: { ... },
  welstandsnota: { ... },
  woonvisie: { ... },
  parkeerbeleid: { ... },
  leegstandsverordening: { ... },
  'gemeentelijke-subsidies': { ... },
  grondprijsbeleid: { ... },
  duurzaamheidsbeleid: { ... },
  erfgoedverordening: { ... },
  'nieuws-monitoring': { ... },

  // ── Provincie (8) ──
  omgevingsverordening: { ... },
  'ruimtelijke-visie': { ... },
  woondeals: { ... },
  'provinciale-subsidies': { ... },
  'natuur-stikstof': { ... },
  'erfgoed-provinciaal': { ... },
  'energie-transitie': { ... },
  mobiliteit: { ... },

  // ── Landelijk (6) ──
  'ladder-verstedelijking': { ... },
  'nationale-woonagenda': { ... },
  woningwet: { ... },
  'asbest-sloop': { ... },
  'beng-energieprestatie': { ... },
  'stikstof-nationaal': { ... },
}
```

Content is copied verbatim from the current SOURCE_GUIDANCE map in configuratie.tsx (lines 1147-1438). During extraction, also fix the known bug where `gemeentelijke-subsidies` and `nieuws-monitoring` appear twice in the current map — keep the more comprehensive version of each.

## 12. Migration — what changes in configuratie.tsx

### Removed

| Current lines | What | Reason |
|---|---|---|
| 1141-1145 | `interface SourceGuidance` | Moves to `sourceGuidance.ts` |
| 1147-1438 | `const SOURCE_GUIDANCE = { ... }` | Moves to `sourceGuidance.ts` (and deduped) |
| 1440-1469 | `function SourceGuidanceCard` | Rewritten in `SourceGuidanceCard.tsx` against contract |
| 1471-~1720 | `function DocumentSourceDetail` | Replaced by `DocumentSourceDetailView.tsx` + sub-components |
| ~1078-1104 | `SourceDetailLoading`, `SourceDetailEmpty`, `SourceDetailError` | Deleted — shell uses shared `DetailStates` from S01 |

### Changed

The switch statement in `SourceDetailWorkspace` (around line 1770):

```tsx
// Before
default:
  return (
    <DocumentSourceDetail
      sourceKey={sourceKey}
      sourceDescription={source?.description ?? ''}
      gemeenteCode={gemeenteCode}
    />
  )

// After
default:
  return (
    <DocumentSourceDetailView
      entityType="gemeente"
      entityCode={gemeenteCode}
      sourceKey={sourceKey}
    />
  )
```

### Unchanged

- The 6 enriched cases for gemeente live sources (from S01) — unchanged
- `LandelijkSourceDetail` with its own switch for rvo-subsidies + omgevingswet — unchanged (S03 will address this)
- All route-level logic, breadcrumbs, source list rendering, transitions

### Expected net impact on configuratie.tsx

From **2053 lines** to roughly **1300-1400 lines**. Still above the 300-line CLAUDE.md guideline but closer. Further decomposition is explicitly deferred to a later slice or milestone.

## 13. Success criteria

- [ ] All 5 new component files exist under `frontend/src/components/configuratie/`, each under 300 lines
- [ ] New `sourceGuidance.ts` holds all 24 sources (deduplicated from the current map)
- [ ] `DocumentSourceDetailView` renders correctly for every source key in `SOURCE_GUIDANCE` when the `entityType` prop is `"gemeente"` and `entityCode` is a valid code
- [ ] All 6 visible states (loading, error, empty-super, empty-user, populated-super, populated-user) render per spec
- [ ] Upload zone visible only to superusers; view/download visible to all users
- [ ] PDF view click opens `PDFViewerModal` with the correct authenticated URL
- [ ] Download click triggers authenticated blob download with the correct filename
- [ ] `configuratie.tsx` has `DocumentSourceDetail`, `SourceGuidance` interface, `SOURCE_GUIDANCE`, `SourceGuidanceCard`, and the 3 SourceDetail* helpers removed
- [ ] `configuratie.tsx` default case in `SourceDetailWorkspace` uses the new component
- [ ] `npx tsc --noEmit` clean for all new files
- [ ] `prettier --check` clean for all new files
- [ ] §14 forbidden patterns grep returns no hits in any new file (no blue/indigo/purple/violet/pink, no custom MetricCard, no own rounded-[16px] containers outside SubCard/SectionInsightCard)
- [ ] Plus Jakarta Sans on the top-level wrapper of `DocumentSourceDetailView`
- [ ] Manual UAT click-through in Venlo: clicking Welstandsnota, Woonvisie, Parkeerbeleid, BENG (ignoring routing since S03 hasn't happened yet — verify from the gemeente level only) shows consistent, contract-conform views

## 14. Success criteria — NOT in S02

These belong to later slices and are explicitly NOT S02 acceptance criteria:

- Provincie sources reachable from the UI (S03)
- Landelijk sources using the shared shell (S03)
- `configuratie.tsx` under 300 lines (later polish slice)
- Enriched versions of nieuws-monitoring, gemeentelijke-subsidies, provinciale-subsidies (backlog)

## 15. Risks & mitigations

| Risk | Mitigation |
|---|---|
| `parseAiSummary` might not return a uniform shape across all documents | Keep the shape-agnostic guard in the shell (`if (parsed) return { summary: parsed, document: doc }`). The `AiSummaryCard` renders whatever fields are present and gracefully skips missing ones. |
| The upload endpoint may not accept provincie/landelijk entity types today | Confirmed in scope: S02 only wires the gemeente default case. Provincie/landelijk upload comes in S03 after the backend is verified. The component itself is entity-type agnostic and ready. |
| Existing `PDFViewerModal` expects a specific URL shape; policy documents endpoint may return a different content-type | Verified in brainstorm: backend endpoint at `GET /api/policy-documents/{entity_type}/{entity_code}/{document_id}` returns the raw file content. `PDFViewerModal` fetches as blob regardless of content-type. Compatible. |
| `useMemo` on `firstSummary` could run on every render if `documents` reference changes | TanStack Query memoizes the array reference by default when data is unchanged. The useMemo dependency is stable. |
| Extracting SOURCE_GUIDANCE loses the 2 duplicate entries' content | During extraction, explicitly inspect and keep the more comprehensive version of `gemeentelijke-subsidies` and `nieuws-monitoring`. |

## 16. Open questions

None — all design decisions resolved during brainstorm 2026-04-08.

## 17. Backlog captured during brainstorm

- Task #11: Fix broken click-through buttons in S01 enriched detail views ("Bekijk alle X" buttons)
- Task #12: Build nieuws-monitoring live-feed enriched component (replaces shell baseline)
- Task #13: Build gemeentelijke + provinciale subsidies enriched components following RVO pattern (replaces shell baseline)
