# M044/S02 — DocumentSourceDetailView Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a shared `DocumentSourceDetailView` (plus 4 focused sub-components and 1 data file) that replaces the 250-line inline `DocumentSourceDetail` function in `configuratie.tsx` and brings all 24 document-based source detail views into full compliance with `CONFIGURATIE-DESIGN-CONTRACT.md`.

**Architecture:** Approach B (composed): a thin shell component that owns data fetching and state, plus small presentational sub-components (`SourceGuidanceCard`, `DocumentUploadZone`, `DocumentListItem`, `AiSummaryCard`). Reuses the existing `PDFViewerModal` from `@/components/ui/` and the shared `DetailStates` from S01. Entity-type prop (`'gemeente' | 'provincie' | 'landelijk'`) so the component is ready for S03 routing wiring.

**Tech Stack:** React 19, TypeScript strict, Tailwind v4, Plus Jakarta Sans, `@tanstack/react-query`, `framer-motion`, existing `usePolicyDocuments` / `useUploadPolicyDocument` hooks, existing `SectionInsightCard` / `SubCard` / `KVRow` from report components, existing `DetailStates` from `configuratie/DetailStates.tsx` (S01), existing `PDFViewerModal` from `ui/PDFViewerModal.tsx`.

**Spec reference:** `docs/superpowers/specs/2026-04-08-m044-s02-document-source-detail-view-design.md`

---

## File map

New files in `frontend/src/components/configuratie/`:

| File | Purpose | Task |
|---|---|---|
| `sourceGuidance.ts` | Data-only file: `SourceGuidance` interface + `SOURCE_GUIDANCE` map (all 24 sources, deduplicated) | Task 1 |
| `SourceGuidanceCard.tsx` | Contract-conform rewrite of the current guidance card | Task 2 |
| `DocumentListItem.tsx` | One row per uploaded document with view/download buttons | Task 3 |
| `DocumentUploadZone.tsx` | Superuser-only drag-drop upload zone | Task 4 |
| `AiSummaryCard.tsx` | SectionInsightCard wrapping the parsed AI summary | Task 5 |
| `DocumentSourceDetailView.tsx` | Shell that composes all of the above | Task 6 |

Modified:
- `frontend/src/routes/_authenticated/configuratie.tsx` — delete old inline code, wire new component (Task 7)

---

## Task 1: Extract sourceGuidance.ts data file

**Files:**
- Create: `frontend/src/components/configuratie/sourceGuidance.ts`
- Read: `frontend/src/routes/_authenticated/configuratie.tsx` lines 1141–1438 as the source of truth

**Why:** Data separated from UI. Enables the new `SourceGuidanceCard` to import from a stable location, and leaves the door open for other surfaces (workspace, checklisten) to consume the same data later.

- [ ] **Step 1: Read the existing SOURCE_GUIDANCE block**

Use the Read tool on `frontend/src/routes/_authenticated/configuratie.tsx` with `offset: 1141, limit: 300`. Confirm the exact content of:
- The `SourceGuidance` interface at lines 1141–1145
- The `SOURCE_GUIDANCE` map from line 1147 to its closing `}` (line 1438)
- Note the 2 duplicate keys: `gemeentelijke-subsidies` appears at lines 1212 and 1276; `nieuws-monitoring` appears at lines 1264 and 1286.

- [ ] **Step 2: Create `sourceGuidance.ts` with the interface + deduplicated map**

Create the file with exactly this structure:

```ts
/**
 * Configuratie source guidance data.
 *
 * Context, relevance and checklist per document source. Used by
 * SourceGuidanceCard to render an explainer block. Extracted from
 * configuratie.tsx during M044/S02 so the data can be imported from
 * anywhere in the app without pulling in the giant route file.
 *
 * Sources are grouped by level (gemeente, provincie, landelijk) and
 * keyed by their sourceKey (matches the key used in the configuratie
 * source catalog).
 */

export interface SourceGuidance {
  explainer: string
  relevance: string
  checklist: string[]
}

export const SOURCE_GUIDANCE: Record<string, SourceGuidance> = {
  // ── Gemeente (10) ──
  omgevingsvisie: { /* copy verbatim from configuratie.tsx:1148-1160 */ },
  welstandsnota: { /* copy from configuratie.tsx:1161-1173 */ },
  woonvisie: { /* copy from configuratie.tsx:1174-1186 */ },
  parkeerbeleid: { /* copy from configuratie.tsx:1187-1199 */ },
  leegstandsverordening: { /* copy from configuratie.tsx:1200-1211 */ },
  'gemeentelijke-subsidies': { /* copy from configuratie.tsx:1212-1224 — the 5-item checklist version, NOT the 4-item version at 1276 */ },
  grondprijsbeleid: { /* copy from configuratie.tsx:1225-1237 */ },
  duurzaamheidsbeleid: { /* copy from configuratie.tsx:1238-1250 */ },
  erfgoedverordening: { /* copy from configuratie.tsx:1251-1263 */ },
  'nieuws-monitoring': { /* copy from configuratie.tsx:1264-1275 — the version that mentions raadsbesluiten explicitly, NOT the shorter version at 1286 */ },

  // ── Provincie (8) ──
  omgevingsverordening: { /* copy from configuratie.tsx:1297-1306 */ },
  'ruimtelijke-visie': { /* copy from configuratie.tsx:1307-1316 */ },
  woondeals: { /* copy from configuratie.tsx:1317-1326 */ },
  'provinciale-subsidies': { /* copy from configuratie.tsx:1327-1336 */ },
  'natuur-stikstof': { /* copy from configuratie.tsx:1337-1346 */ },
  'erfgoed-provinciaal': { /* copy from configuratie.tsx:1347-1356 */ },
  'energie-transitie': { /* copy from configuratie.tsx:1357-1366 */ },
  mobiliteit: { /* copy from configuratie.tsx:1367-1376 */ },

  // ── Landelijk (6) ──
  'ladder-verstedelijking': { /* copy from configuratie.tsx:1378-1387 */ },
  'nationale-woonagenda': { /* copy from configuratie.tsx:1388-1397 */ },
  woningwet: { /* copy from configuratie.tsx:1398-1407 */ },
  'asbest-sloop': { /* copy from configuratie.tsx:1408-1417 */ },
  'beng-energieprestatie': { /* copy from configuratie.tsx:1418-1427 */ },
  'stikstof-nationaal': { /* copy from configuratie.tsx:1428-1437 */ },
}
```

**Important:** Each comment `/* copy from ... */` must be replaced with the ACTUAL object literal copied verbatim from the indicated line range. Do not paraphrase. Do not drop checklist items. The final file should have zero placeholders.

For the 2 duplicate keys, copy only the version indicated (the more comprehensive one). The comment on those 2 keys explains which version is chosen.

- [ ] **Step 3: Verify the file has exactly 24 keys**

Run:
```bash
grep -cE "^  ['\"a-z]" frontend/src/components/configuratie/sourceGuidance.ts
```
Expected: `24` (10 gemeente + 8 provincie + 6 landelijk).

Run:
```bash
grep -nE "^  (omgevingsvisie|welstandsnota|woonvisie|parkeerbeleid|leegstandsverordening|'gemeentelijke-subsidies'|grondprijsbeleid|duurzaamheidsbeleid|erfgoedverordening|'nieuws-monitoring'|omgevingsverordening|'ruimtelijke-visie'|woondeals|'provinciale-subsidies'|'natuur-stikstof'|'erfgoed-provinciaal'|'energie-transitie'|mobiliteit|'ladder-verstedelijking'|'nationale-woonagenda'|woningwet|'asbest-sloop'|'beng-energieprestatie'|'stikstof-nationaal'):" frontend/src/components/configuratie/sourceGuidance.ts
```
Expected: exactly 24 matches, one per key.

- [ ] **Step 4: Type-check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep sourceGuidance || echo "clean"
```
Expected: `clean`.

- [ ] **Step 5: Prettier**

```bash
cd frontend && npx prettier --write src/components/configuratie/sourceGuidance.ts && npx prettier --check src/components/configuratie/sourceGuidance.ts
```
Expected: "All matched files use Prettier code style!"

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/configuratie/sourceGuidance.ts
git commit -m "M044/S02: extract SOURCE_GUIDANCE to dedicated data file

Moves the SourceGuidance interface + SOURCE_GUIDANCE map (24 sources)
out of the 2053-line configuratie.tsx route file and into a pure data
module. Deduplicates the 2 repeated keys (gemeentelijke-subsidies and
nieuws-monitoring) by keeping the more comprehensive version of each.

Enables other app surfaces (workspace, checklisten, parcel popup) to
import the same guidance data in later milestones without pulling in
the route file."
```

---

## Task 2: Build SourceGuidanceCard.tsx (contract-conform)

**Files:**
- Create: `frontend/src/components/configuratie/SourceGuidanceCard.tsx`

**Why:** Current `SourceGuidanceCard` in `configuratie.tsx` (lines 1440–1469) uses a custom `rounded-[16px] border border-[#EAEFEF] bg-[#F2F6F3]/50` container and an `<h3>` instead of `SectionInsightCard`. Violates contract §2 (containers) and §3 (SectionInsightCard structure). New version uses `SectionInsightCard` wrapper.

- [ ] **Step 1: Read the current implementation to confirm reuse opportunities**

```bash
sed -n '1440,1469p' frontend/src/routes/_authenticated/configuratie.tsx
```

Note: uses `BookOpen` icon (from lucide-react), `CheckCircle2` icon for checklist items (`text-emerald-500`). The new version keeps these icons.

- [ ] **Step 2: Create the file with contract-conform structure**

```tsx
/**
 * SourceGuidanceCard — renders the contextual explainer, relevance
 * and checklist for a configuratie source, wrapped in the contract's
 * standard SectionInsightCard shell.
 *
 * Data comes from sourceGuidance.ts. If the sourceKey has no entry,
 * renders a fallback SectionInsightCard with a generic "Geen
 * begeleidende informatie beschikbaar" message so the section is
 * never silently empty.
 */
import { BookOpen, CheckCircle2 } from 'lucide-react'
import { SectionInsightCard } from '@/components/reports/components/SectionInsightCard'
import { SOURCE_GUIDANCE } from './sourceGuidance'

interface Props {
  sourceKey: string
}

export function SourceGuidanceCard({ sourceKey }: Props) {
  const guidance = SOURCE_GUIDANCE[sourceKey]

  if (!guidance) {
    return (
      <SectionInsightCard
        kicker="Uitleg"
        title="Wat is dit document?"
        Icon={BookOpen}
      >
        <p className="text-[13px] leading-relaxed text-slate-400">
          Geen begeleidende informatie beschikbaar voor deze bron.
        </p>
      </SectionInsightCard>
    )
  }

  return (
    <SectionInsightCard
      kicker="Uitleg"
      title="Wat is dit document?"
      Icon={BookOpen}
    >
      <p className="text-[13px] leading-relaxed text-slate-500">
        {guidance.explainer}
      </p>

      <div className="mt-4">
        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-2">
          Relevant voor vastgoedontwikkeling
        </p>
        <p className="text-[13px] leading-relaxed text-slate-500">
          {guidance.relevance}
        </p>
      </div>

      <div className="mt-4">
        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-2">
          Checklist
        </p>
        <ul className="space-y-1.5">
          {guidance.checklist.map((item) => (
            <li key={item} className="flex items-start gap-2 text-[12px] text-slate-500">
              <CheckCircle2
                size={14}
                className="mt-0.5 shrink-0 text-emerald-500"
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </SectionInsightCard>
  )
}
```

- [ ] **Step 3: Verify no §14 violations**

```bash
F=frontend/src/components/configuratie/SourceGuidanceCard.tsx
grep -nE "(bg|text|border)-(blue|indigo|purple|violet|pink)-" "$F" || echo "no forbidden colors"
grep -nE "rounded-\[16px\] border border-\[#EAEFEF\]" "$F" || echo "no own containers"
grep -nE "text-\[1[4-9]px\].*font-(bold|semibold)" "$F" || echo "no oversized titles"
```
Expected: all three print their respective "no ..." messages.

- [ ] **Step 4: Type-check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep SourceGuidanceCard || echo "clean"
```
Expected: `clean`.

- [ ] **Step 5: Prettier**

```bash
cd frontend && npx prettier --write src/components/configuratie/SourceGuidanceCard.tsx && npx prettier --check src/components/configuratie/SourceGuidanceCard.tsx
```
Expected: "All matched files use Prettier code style!"

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/configuratie/SourceGuidanceCard.tsx
git commit -m "M044/S02: rewrite SourceGuidanceCard against design contract

Replaces custom rounded container + inline h3 with SectionInsightCard
wrapper per §2/§3. Imports SOURCE_GUIDANCE from the new data file.
Pure presentational component — returns null when sourceKey has no
entry, letting the caller decide the fallback."
```

---

## Task 3: Build DocumentListItem.tsx

**Files:**
- Create: `frontend/src/components/configuratie/DocumentListItem.tsx`

**Why:** One row per uploaded document. Shows filename, upload datetime, parse status (via SemanticPill per §5), view button, download button. The download helper is inlined in this file following the pattern established in `S8VergunningChecklist.tsx` lines 423-437.

- [ ] **Step 1: Verify the PolicyDocument type shape**

```bash
grep -A 15 "export interface PolicyDocument" frontend/src/hooks/usePolicyDocuments.ts
```
Confirmed shape: `{ id, entity_type, entity_code, source_key, filename, content_type, file_size, status, ai_summary, created_at, updated_at }`.

- [ ] **Step 2: Create the file**

```tsx
/**
 * DocumentListItem — one row per uploaded policy document.
 *
 * Renders filename, upload timestamp, parse status (SemanticPill),
 * view button (opens PDFViewerModal via shell-owned state), download
 * button (fetches authenticated blob and triggers synthetic download).
 */
import { Eye, Download, FileText } from 'lucide-react'
import { useAuth } from '@/lib/auth/useAuth'
import type { PolicyDocument } from '@/hooks/usePolicyDocuments'

interface Props {
  document: PolicyDocument
  onView: () => void
}

const dateFmt = new Intl.DateTimeFormat('nl-NL', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function formatUploadDate(iso: string): string {
  try {
    return dateFmt.format(new Date(iso))
  } catch {
    return iso
  }
}

function statusPill(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    ready: { label: 'Verwerkt', cls: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
    parsing: { label: 'Verwerken…', cls: 'border-amber-200 bg-amber-50 text-amber-700' },
    error: { label: 'Fout', cls: 'border-red-200 bg-red-50 text-red-700' },
  }
  const entry = map[status] ?? {
    label: status,
    cls: 'border-slate-200 bg-slate-50 text-slate-600',
  }
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${entry.cls}`}
    >
      {entry.label}
    </span>
  )
}

export function DocumentListItem({ document: doc, onView }: Props) {
  const { accessToken } = useAuth()

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation()
    const url = `${import.meta.env.VITE_API_URL ?? ''}/api/policy-documents/${doc.entity_type}/${doc.entity_code}/${doc.id}`
    fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((res) => res.blob())
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob)
        const a = window.document.createElement('a')
        a.href = blobUrl
        a.download = doc.filename
        a.click()
        URL.revokeObjectURL(blobUrl)
      })
  }

  return (
    <div className="flex items-center gap-3 py-3 border-b border-[#EAEFEF] last:border-b-0">
      <FileText size={16} className="shrink-0 text-slate-400" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-[#0E1111] leading-snug truncate">
          {doc.filename}
        </p>
        <p className="text-[11px] text-slate-400">
          Geüpload {formatUploadDate(doc.created_at)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {statusPill(doc.status)}
        <button
          onClick={onView}
          className="flex size-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-[#0E1111]"
          title="Bekijk PDF"
          type="button"
        >
          <Eye className="size-3.5" />
        </button>
        <button
          onClick={handleDownload}
          className="flex size-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-[#0E1111]"
          title="Download PDF"
          type="button"
        >
          <Download className="size-3.5" />
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify no §14 violations**

```bash
F=frontend/src/components/configuratie/DocumentListItem.tsx
grep -nE "(bg|text|border)-(blue|indigo|purple|violet|pink)-" "$F" || echo "no forbidden colors"
grep -nE "rounded-\[16px\] border border-\[#EAEFEF\]" "$F" || echo "no own containers"
grep -nE "bg-slate-100 px-2" "$F" || echo "no non-canonical pills"
```
Expected: all three print their "no ..." messages.

- [ ] **Step 4: Type-check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep DocumentListItem || echo "clean"
```
Expected: `clean`.

- [ ] **Step 5: Prettier**

```bash
cd frontend && npx prettier --write src/components/configuratie/DocumentListItem.tsx && npx prettier --check src/components/configuratie/DocumentListItem.tsx
```
Expected: "All matched files use Prettier code style!"

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/configuratie/DocumentListItem.tsx
git commit -m "M044/S02: add DocumentListItem component

One row per uploaded policy document with filename, upload timestamp,
parse status via §5 SemanticPill, view button (delegates to shell
onView callback), download button (inline authenticated blob fetch
following S8VergunningChecklist pattern). No state of its own."
```

---

## Task 4: Build DocumentUploadZone.tsx

**Files:**
- Create: `frontend/src/components/configuratie/DocumentUploadZone.tsx`

**Why:** Superuser-only drag-drop zone that wraps `useUploadPolicyDocument`. The existing inline version in `configuratie.tsx` line 1569-1604 uses `rounded-[16px] border-2 border-dashed` with amber tinting — the new version keeps the amber tinting (that's the correct "action" color per the Aura palette) but follows contract §2 by not creating a generic `rounded-[16px] border-[#EAEFEF]` container that could be confused with SubCard.

The amber dashed border IS the design language for "upload action", not a neutral container, so it's a legitimate exception to §2's "no own containers" rule. Document this in the commit message.

- [ ] **Step 1: Verify the useUploadPolicyDocument signature**

Confirmed in `frontend/src/hooks/usePolicyDocuments.ts` lines 79-115:
```
useUploadPolicyDocument(): UseMutation<PolicyDocument, Error, { entityType, entityCode, sourceKey, file }>
```

- [ ] **Step 2: Create the file**

```tsx
/**
 * DocumentUploadZone — superuser-only drag-drop upload for a policy
 * document belonging to a given entity + source key.
 *
 * Owns local drag state. Calls useUploadPolicyDocument mutation.
 * The shell decides whether to render this component (superuser gate
 * lives in the shell, not here).
 *
 * The amber dashed border is an intentional exception to contract §2
 * — this is the Aura "action" styling for upload affordances, not a
 * generic neutral container. Matches the pattern from the original
 * configuratie.tsx upload zone at line 1569.
 */
import { useCallback, useRef, useState } from 'react'
import { Upload, Loader2 } from 'lucide-react'
import { useUploadPolicyDocument } from '@/hooks/usePolicyDocuments'

interface Props {
  entityType: 'gemeente' | 'provincie' | 'landelijk'
  entityCode: string
  sourceKey: string
}

export function DocumentUploadZone({ entityType, entityCode, sourceKey }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const uploadMutation = useUploadPolicyDocument()

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      uploadMutation.mutate({ entityType, entityCode, sourceKey, file })
      e.target.value = ''
    },
    [entityType, entityCode, sourceKey, uploadMutation],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (!file) return
      uploadMutation.mutate({ entityType, entityCode, sourceKey, file })
    },
    [entityType, entityCode, sourceKey, uploadMutation],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png"
        className="hidden"
        onChange={handleFileChange}
      />
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`flex flex-col items-center gap-3 rounded-[20px] border-2 border-dashed p-10 text-center transition-colors ${
          isDragging
            ? 'border-aura-amber bg-amber-50/50'
            : 'border-aura-amber/30 bg-amber-50/20'
        }`}
      >
        <div className="flex size-12 items-center justify-center rounded-full bg-amber-50">
          <Upload size={22} className="text-amber-600" />
        </div>
        <p className="text-[14px] font-bold text-[#0E1111]">
          Upload een document om AI-analyse te starten
        </p>
        <p className="text-[12px] text-slate-400">
          Sleep een bestand hierheen of klik op de knop
        </p>
        <button
          onClick={handleUploadClick}
          disabled={uploadMutation.isPending}
          className="mt-2 inline-flex items-center gap-2 rounded-full bg-[#0E1111] px-5 py-2.5 text-[13px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          type="button"
        >
          {uploadMutation.isPending ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Uploaden…
            </>
          ) : (
            <>
              <Upload size={14} />
              Kies bestand
            </>
          )}
        </button>
        <p className="text-[10px] text-slate-300">PDF, DOCX, XLSX, JPG, PNG</p>
        {uploadMutation.isError && (
          <p className="text-[12px] text-red-400">
            {uploadMutation.error?.message ?? 'Upload mislukt'}
          </p>
        )}
      </div>
    </>
  )
}
```

- [ ] **Step 3: Verify no §14 violations (remember the dashed amber is an allowed exception)**

```bash
F=frontend/src/components/configuratie/DocumentUploadZone.tsx
grep -nE "(bg|text|border)-(blue|indigo|purple|violet|pink)-" "$F" || echo "no forbidden colors"
```
Expected: `no forbidden colors`.

- [ ] **Step 4: Type-check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep DocumentUploadZone || echo "clean"
```
Expected: `clean`.

- [ ] **Step 5: Prettier**

```bash
cd frontend && npx prettier --write src/components/configuratie/DocumentUploadZone.tsx && npx prettier --check src/components/configuratie/DocumentUploadZone.tsx
```
Expected: "All matched files use Prettier code style!"

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/configuratie/DocumentUploadZone.tsx
git commit -m "M044/S02: add DocumentUploadZone component

Superuser-only drag-drop upload zone using useUploadPolicyDocument.
Entity-type agnostic (accepts gemeente/provincie/landelijk) so the
shell can pass through whatever level it was invoked at — ready for
S03 routing wiring.

The amber dashed border container is an intentional exception to
§2 — it is the Aura 'action' styling for upload affordances, not a
generic neutral container. Semantic token bg-aura-amber used for
the hover state."
```

---

## Task 5: Build AiSummaryCard.tsx

**Files:**
- Create: `frontend/src/components/configuratie/AiSummaryCard.tsx`

**Why:** Replaces the violet-tinted custom `<div>` in `configuratie.tsx` line 1617 with a contract-conform `SectionInsightCard`. Renders the `DocumentSummary` shape returned by `parseAiSummary`: `{ summary, key_facts, extracted_values }`.

- [ ] **Step 1: Verify the DocumentSummary shape**

From `frontend/src/hooks/usePolicyDocuments.ts` lines 25-29:
```ts
export interface DocumentSummary {
  summary: string
  key_facts: string[]
  extracted_values: Record<string, string>
}
```

- [ ] **Step 2: Create the file**

```tsx
/**
 * AiSummaryCard — wraps a parsed AI summary in a contract-conform
 * SectionInsightCard. Replaces the violet custom div previously used
 * in configuratie.tsx. Amber-on-obsidian styling comes automatically
 * from SectionInsightCard — this component does not pick colors.
 */
import { Sparkles } from 'lucide-react'
import { SectionInsightCard } from '@/components/reports/components/SectionInsightCard'
import { SubCard, KVRow } from '@/components/reports/components'
import type { DocumentSummary } from '@/hooks/usePolicyDocuments'

interface Props {
  summary: DocumentSummary
  documentName: string
}

export function AiSummaryCard({ summary, documentName }: Props) {
  const hasKeyFacts = summary.key_facts.length > 0
  const extractedEntries = Object.entries(summary.extracted_values)
  const hasExtracted = extractedEntries.length > 0

  return (
    <SectionInsightCard
      kicker="AI-samenvatting"
      title={documentName}
      Icon={Sparkles}
    >
      <p className="text-[13px] leading-relaxed text-slate-500">
        {summary.summary}
      </p>

      {hasKeyFacts && (
        <div className="mt-4">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-2">
            Kerncijfers
          </p>
          <ul className="space-y-1.5">
            {summary.key_facts.map((fact) => (
              <li
                key={fact}
                className="flex items-start gap-2 text-[12px] text-slate-500"
              >
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-aura-amber shrink-0" />
                <span>{fact}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasExtracted && (
        <div className="mt-4">
          <SubCard>
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-3">
              Uitgelichte waarden
            </p>
            {extractedEntries.map(([label, value]) => (
              <KVRow key={label} label={label} value={value} />
            ))}
          </SubCard>
        </div>
      )}
    </SectionInsightCard>
  )
}
```

- [ ] **Step 3: Verify no §14 violations**

```bash
F=frontend/src/components/configuratie/AiSummaryCard.tsx
grep -nE "(bg|text|border)-(blue|indigo|purple|violet|pink)-" "$F" || echo "no forbidden colors"
grep -nE "rounded-\[16px\] border border-\[#EAEFEF\]" "$F" || echo "no own containers"
```
Expected: both print their "no ..." messages.

- [ ] **Step 4: Type-check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep AiSummaryCard || echo "clean"
```
Expected: `clean`.

- [ ] **Step 5: Prettier**

```bash
cd frontend && npx prettier --write src/components/configuratie/AiSummaryCard.tsx && npx prettier --check src/components/configuratie/AiSummaryCard.tsx
```
Expected: "All matched files use Prettier code style!"

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/configuratie/AiSummaryCard.tsx
git commit -m "M044/S02: add AiSummaryCard component

Contract-conform replacement for the violet custom div in
configuratie.tsx line 1617. Renders the DocumentSummary shape
(summary + key_facts + extracted_values) inside SectionInsightCard
with Sparkles icon. Colors inherited from the contract — no violet
anywhere. Optional key_facts and extracted_values sections only
render when data is present."
```

---

## Task 6: Build DocumentSourceDetailView.tsx (shell)

**Files:**
- Create: `frontend/src/components/configuratie/DocumentSourceDetailView.tsx`

**Why:** The shell orchestrator. Owns data fetching, polling, "which document is being viewed" state, and composes all 4 sub-components.

- [ ] **Step 1: Create the file**

```tsx
/**
 * DocumentSourceDetailView — shared shell for configuratie document
 * source detail views. Works at all 3 entity levels (gemeente /
 * provincie / landelijk) via the entityType prop.
 *
 * Owns all data fetching and state. Sub-components are pure
 * presentational units that receive props and render.
 *
 * Implements contract §1 (layout), §10 (state containers via shared
 * DetailStates), and composes SectionInsightCard from the reports
 * contract components.
 */
import { useEffect, useMemo, useState } from 'react'
import { FileText } from 'lucide-react'
import { useAuth } from '@/lib/auth/useAuth'
import {
  usePolicyDocuments,
  parseAiSummary,
  type PolicyDocument,
  type DocumentSummary,
} from '@/hooks/usePolicyDocuments'
import { SectionInsightCard } from '@/components/reports/components/SectionInsightCard'
import { PDFViewerModal } from '@/components/ui/PDFViewerModal'
import { DetailLoading, DetailEmpty, DetailError } from './DetailStates'
import { SourceGuidanceCard } from './SourceGuidanceCard'
import { DocumentUploadZone } from './DocumentUploadZone'
import { DocumentListItem } from './DocumentListItem'
import { AiSummaryCard } from './AiSummaryCard'

interface Props {
  entityType: 'gemeente' | 'provincie' | 'landelijk'
  entityCode: string
  sourceKey: string
}

export function DocumentSourceDetailView({
  entityType,
  entityCode,
  sourceKey,
}: Props) {
  const { user } = useAuth()
  const isSuperuser = user?.is_superuser ?? false

  const [polling, setPolling] = useState(false)
  const [viewingDocId, setViewingDocId] = useState<string | null>(null)

  const { data, isLoading, error } = usePolicyDocuments(
    entityType,
    entityCode,
    sourceKey,
    true,
    polling ? 3000 : false,
  )

  const documents = data?.documents ?? []
  const isAnyParsing = documents.some((d) => d.status === 'parsing')

  useEffect(() => {
    setPolling(isAnyParsing)
  }, [isAnyParsing])

  const firstSummary = useMemo<
    { summary: DocumentSummary; document: PolicyDocument } | null
  >(() => {
    for (const doc of documents) {
      const parsed = parseAiSummary(doc.ai_summary)
      if (parsed) return { summary: parsed, document: doc }
    }
    return null
  }, [documents])

  const viewingDoc = documents.find((d) => d.id === viewingDocId) ?? null
  const viewingUrl = viewingDoc
    ? `${import.meta.env.VITE_API_URL ?? ''}/api/policy-documents/${entityType}/${entityCode}/${viewingDoc.id}`
    : null

  if (isLoading) return <DetailLoading />
  if (error) return <DetailError error={error as Error} />

  return (
    <div
      className="space-y-6"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      <SourceGuidanceCard sourceKey={sourceKey} />

      {isSuperuser && (
        <DocumentUploadZone
          entityType={entityType}
          entityCode={entityCode}
          sourceKey={sourceKey}
        />
      )}

      {firstSummary && (
        <AiSummaryCard
          summary={firstSummary.summary}
          documentName={firstSummary.document.filename}
        />
      )}

      {documents.length > 0 && (
        <SectionInsightCard
          kicker="Documenten"
          title="Geüploade bestanden"
          Icon={FileText}
          badge={`${documents.length}`}
        >
          {documents.map((doc) => (
            <DocumentListItem
              key={doc.id}
              document={doc}
              onView={() => setViewingDocId(doc.id)}
            />
          ))}
        </SectionInsightCard>
      )}

      {documents.length === 0 && !isSuperuser && (
        <DetailEmpty message="Nog geen document toegevoegd voor deze bron." />
      )}

      {viewingDoc && viewingUrl && (
        <PDFViewerModal
          url={viewingUrl}
          title={viewingDoc.filename}
          onClose={() => setViewingDocId(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify no §14 violations and correct §1 layout**

```bash
F=frontend/src/components/configuratie/DocumentSourceDetailView.tsx
grep -nE "(bg|text|border)-(blue|indigo|purple|violet|pink)-" "$F" || echo "no forbidden colors"
grep -n "space-y-6" "$F"
grep -n "Plus Jakarta" "$F"
```
Expected:
- `no forbidden colors`
- space-y-6 present on the wrapper
- Plus Jakarta present on the wrapper

- [ ] **Step 3: Type-check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep DocumentSourceDetailView || echo "clean"
```
Expected: `clean`.

- [ ] **Step 4: Prettier**

```bash
cd frontend && npx prettier --write src/components/configuratie/DocumentSourceDetailView.tsx && npx prettier --check src/components/configuratie/DocumentSourceDetailView.tsx
```
Expected: "All matched files use Prettier code style!"

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/configuratie/DocumentSourceDetailView.tsx
git commit -m "M044/S02: add DocumentSourceDetailView shell

Composes SourceGuidanceCard, DocumentUploadZone (superuser only),
AiSummaryCard, and a SectionInsightCard containing DocumentListItems.
Owns data fetching via usePolicyDocuments with auto-polling while any
document is in 'parsing' state. Tracks which document is open in the
PDFViewerModal via local viewingDocId state.

Entity-type agnostic — accepts gemeente/provincie/landelijk via prop
so S03 can wire provincie and landelijk routing without touching this
component.

Early returns for loading and error use the shared DetailStates from
S01. Empty state for non-superusers shows DetailEmpty; empty state
for superusers just shows guidance + upload zone (the zone IS the CTA)."
```

---

## Task 7: Migrate configuratie.tsx — delete old, wire new

**Files:**
- Modify: `frontend/src/routes/_authenticated/configuratie.tsx`

**Why:** Now that the new component exists, delete all the replaced code from the route file and wire the new component into the existing switch statement.

- [ ] **Step 1: Read the current import block (around line 1-50)**

```bash
sed -n '1,50p' frontend/src/routes/_authenticated/configuratie.tsx
```
Confirm the existing imports. You will need to add: `import { DocumentSourceDetailView } from '@/components/configuratie/DocumentSourceDetailView'`. You will need to remove: imports that become unused after deletion (likely `BookOpen`, `CheckCircle2`, `Sparkles`, `Upload`, `Loader2`, possibly `parseAiSummary`, `usePolicyDocuments`, `useUploadPolicyDocument` — verify each before removing).

- [ ] **Step 2: Delete the SourceGuidance interface and SOURCE_GUIDANCE map**

Delete lines 1141-1438 (from `interface SourceGuidance {` to the closing `}` of the SOURCE_GUIDANCE map). Use the Edit tool with sufficient context to make the match unique.

- [ ] **Step 3: Delete the old SourceGuidanceCard function**

Delete lines 1440-1469 (the entire old `function SourceGuidanceCard`).

- [ ] **Step 4: Delete the old DocumentSourceDetail function**

Delete the entire `function DocumentSourceDetail` (starts at line 1471). To find the end: after deleting the SOURCE_GUIDANCE block in Step 2, line numbers will have shifted. Use a grep to find the new start:

```bash
grep -n "^function DocumentSourceDetail" frontend/src/routes/_authenticated/configuratie.tsx
```

Then find the matching closing `}` for that function. Use the Edit tool to delete everything between (inclusive).

- [ ] **Step 5: Delete the old SourceDetail* helper functions**

Delete `function SourceDetailLoading`, `function SourceDetailEmpty`, `function SourceDetailError` (around lines 1078-1104 in the original file). These are replaced by the shared `DetailStates` which the shell already uses.

```bash
grep -nE "^function SourceDetail(Loading|Empty|Error)" frontend/src/routes/_authenticated/configuratie.tsx
```

Delete each function in full.

- [ ] **Step 6: Add the new import**

At the top of the file, after the existing `import { PDFViewerModal } from '@/components/ui/PDFViewerModal'` line (around line 44), add:

```tsx
import { DocumentSourceDetailView } from '@/components/configuratie/DocumentSourceDetailView'
```

- [ ] **Step 7: Replace the switch default case**

Find the `switch (sourceKey)` block inside `SourceDetailWorkspace` (originally around line 1770, now shifted). The current `default:` case renders `<DocumentSourceDetail sourceKey={sourceKey} sourceDescription={source?.description ?? ''} gemeenteCode={gemeenteCode} />`. Replace it with:

```tsx
      default:
        return (
          <DocumentSourceDetailView
            entityType="gemeente"
            entityCode={gemeenteCode}
            sourceKey={sourceKey}
          />
        )
```

- [ ] **Step 8: Remove unused imports**

After all the deletions, some imports will be dead. Run:

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep "is declared but" | head
```

Remove any imports flagged as unused. Common suspects: `BookOpen`, `CheckCircle2`, `Sparkles`, `Upload`, `Loader2`, `parseAiSummary`, `usePolicyDocuments`, `useUploadPolicyDocument`, `PDFViewerModal` (if the shell now handles all PDF viewing for document sources — verify whether any live enriched component still needs it directly). Edit the import statements to remove them.

- [ ] **Step 9: Verify all references to deleted symbols are gone**

```bash
grep -nE "DocumentSourceDetail\b|\\bSOURCE_GUIDANCE\\b|^function SourceGuidanceCard|^function SourceDetail(Loading|Empty|Error)" frontend/src/routes/_authenticated/configuratie.tsx
```
Expected: only matches should be the NEW `DocumentSourceDetailView` import and usage. No matches for `DocumentSourceDetail` (without View), no matches for standalone `SOURCE_GUIDANCE`, no matches for the 4 deleted function signatures.

- [ ] **Step 10: Line count check**

```bash
wc -l frontend/src/routes/_authenticated/configuratie.tsx
```
Expected: significantly lower than 2053 (target: 1300-1500 range). If below 1300 or above 1700, something unexpected happened — investigate before proceeding.

- [ ] **Step 11: Type-check the whole file**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep "configuratie.tsx" | head -20
```
If any errors, fix them. Pre-existing errors in other files are acceptable; errors in configuratie.tsx are not.

- [ ] **Step 12: Prettier**

```bash
cd frontend && npx prettier --write src/routes/_authenticated/configuratie.tsx && npx prettier --check src/routes/_authenticated/configuratie.tsx
```
Expected: "All matched files use Prettier code style!"

- [ ] **Step 13: Commit**

```bash
git add frontend/src/routes/_authenticated/configuratie.tsx
git commit -m "M044/S02: wire DocumentSourceDetailView, delete old inline code

Deletes:
- SourceGuidance interface + SOURCE_GUIDANCE map (moved to sourceGuidance.ts)
- Old SourceGuidanceCard function (replaced by new component)
- DocumentSourceDetail function (replaced by DocumentSourceDetailView)
- SourceDetailLoading / SourceDetailEmpty / SourceDetailError helpers
  (replaced by shared DetailStates from S01)
- Unused imports left behind after deletions

Wires the new DocumentSourceDetailView into the existing gemeente
default case in SourceDetailWorkspace's switch statement. Provincie
and landelijk routing is unchanged — those are S03 scope.

configuratie.tsx line count: 2053 → ~1400."
```

---

## Task 8: Global verification pass

**Files:** None modified unless issues are found.

**Why:** Confirm the full set of changes is clean before UAT.

- [ ] **Step 1: §14 grep across all 6 new files**

```bash
for f in sourceGuidance.ts SourceGuidanceCard.tsx DocumentUploadZone.tsx DocumentListItem.tsx AiSummaryCard.tsx DocumentSourceDetailView.tsx; do
  F=frontend/src/components/configuratie/$f
  echo "--- $f ---"
  hit=$(grep -nE "(bg|text|border)-(blue|indigo|purple|violet|pink)-" "$F")
  if [ -n "$hit" ]; then echo "FAIL: $hit"; else echo "  no forbidden colors"; fi
done
```
Expected: all 6 print "no forbidden colors".

- [ ] **Step 2: Prettier check on all new + modified files**

```bash
cd frontend && npx prettier --check \
  src/components/configuratie/sourceGuidance.ts \
  src/components/configuratie/SourceGuidanceCard.tsx \
  src/components/configuratie/DocumentUploadZone.tsx \
  src/components/configuratie/DocumentListItem.tsx \
  src/components/configuratie/AiSummaryCard.tsx \
  src/components/configuratie/DocumentSourceDetailView.tsx \
  src/routes/_authenticated/configuratie.tsx
```
Expected: "All matched files use Prettier code style!"

- [ ] **Step 3: Global type-check, scoped to S02 files**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -E "sourceGuidance|SourceGuidanceCard|DocumentUploadZone|DocumentListItem|AiSummaryCard|DocumentSourceDetailView|configuratie\\.tsx" || echo "clean"
```
Expected: `clean`.

- [ ] **Step 4: Run `npm run check` for full project state**

```bash
cd frontend && npm run check 2>&1 | tail -20
```
Expected: any remaining errors are pre-existing in unrelated files (verkenner.tsx, stories, report sections) — the same set that was documented at the end of S01 Task 7.

- [ ] **Step 5: Commit only if fixes were needed**

If Steps 1–4 triggered any source edits, commit them with `M044/S02: fix <specific issue>` format. If all passed without changes, skip the commit.

---

## Task 9: Manual UAT + S02 closure

**Files:** Non-code state files only.

**Why:** Same pattern as S01 Task 8. Manual click-through verifies real rendering; verification-before-completion formalizes the closure.

- [ ] **Step 1: Ensure dev servers are running**

```bash
lsof -i :8000 -i :9300 2>&1 | head -5
```
If not running, start them:
```bash
cd backend && source .venv/bin/activate && nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload > /tmp/propdex-backend.log 2>&1 &
cd frontend && nohup npm run dev > /tmp/propdex-frontend.log 2>&1 &
```

- [ ] **Step 2: User UAT click-through**

Ask the user to:
1. Open `http://localhost:9300` and log in
2. Navigate to Configuratie → select gemeente Venlo
3. Click into at least 4 document sources from different categories, e.g.:
   - `welstandsnota` (gemeente, policy text)
   - `parkeerbeleid` (gemeente, tables)
   - `grondprijsbeleid` (gemeente, price lists)
   - `duurzaamheidsbeleid` (gemeente, regulatory)
4. For each: verify
   - SourceGuidanceCard renders with proper kicker/title/Icon/checklist (no paarse/blue colors)
   - If superuser: DocumentUploadZone visible with amber dashed border
   - Empty state (no docs yet) is consistent
   - Upload a test PDF if possible to verify flow
   - AI summary card renders in contract-conform style (no violet)
   - View icon opens PDFViewerModal inline with the uploaded PDF
   - Download icon triggers authenticated download
5. Check browser devtools Console: zero errors

Report any visual or behavioral regressions.

- [ ] **Step 3: Write S02-SUMMARY.md**

Create `~/.gsd/projects/0fbd70b53f1b/milestones/M044/slices/S02/S02-SUMMARY.md` using the S01-SUMMARY.md template from `~/.gsd/projects/0fbd70b53f1b/milestones/M044/slices/S01/S01-SUMMARY.md` as a reference. Include:
- `status: complete`
- `completed_at` ISO timestamp
- key_decisions from brainstorm
- key_files list (all 6 new + modified configuratie.tsx + migration summary)
- lessons_learned
- Task results table (1-9)
- Violations fixed summary (compare line 1565 through 1700+ of original configuratie.tsx to what was rewritten)
- UAT pass statement with any minor findings as backlog items

- [ ] **Step 4: Invoke superpowers:verification-before-completion**

Fresh verification run with concrete evidence:
- Grep outputs from Task 8 Step 1
- tsc output from Task 8 Step 3
- prettier output from Task 8 Step 2
- User UAT confirmation from Step 2
- S02-SUMMARY.md written

Only claim S02 complete after the skill says the evidence is sufficient.

- [ ] **Step 5: Update GSD root STATE.md**

Edit `/home/klarifai/.gsd/projects/0fbd70b53f1b/STATE.md`:

Change:
```
**Active Slice:** S02: Document source basis view — gedeeld component voor alle 22 roadmap sources
**Phase:** ready-to-plan
```
To:
```
**Active Slice:** S03: Provincie + landelijk source workspace routing
**Phase:** ready-to-plan
```

Update the Next Action section to describe starting S03.

- [ ] **Step 6: Final closure commit**

```bash
git commit --allow-empty -m "M044/S02: complete — shared DocumentSourceDetailView across all 24 document sources

N commits on branch m044/s02-document-source-detail-view covering:
- sourceGuidance.ts data extraction
- SourceGuidanceCard contract-conform rewrite
- DocumentListItem + DocumentUploadZone + AiSummaryCard sub-components
- DocumentSourceDetailView shell
- configuratie.tsx migration (line count reduced from 2053 to ~1400)

Verified: tsc clean, prettier clean, §14 grep clean, user UAT passed.
Shell ready for S03 provincie/landelijk routing wiring — entityType
prop is already in place.

Slice advanced to M044/S03."
```

(Replace `N` with the actual commit count when executing.)

---

## Self-Review

**1. Spec coverage:**

Walking through the spec sections:
- §1 Goal — covered by Tasks 1-7 (every sub-component + shell + migration)
- §2 Scope in/out — Tasks stay in scope; provincie/landelijk routing explicitly deferred to S03 (not in any task)
- §3 Architecture — Task 1-6 create exactly the 6 files in the file map
- §4 Component Interfaces — each task implements the interface from the spec
- §5 Data Flow — Task 6 implements the shell's ownership model
- §6 Visible States — all 6 states handled in Task 6 (loading/error early returns + conditional rendering)
- §7 PDF viewing flow — Task 6 wires PDFViewerModal correctly
- §8 Download flow — Task 3 inlines the helper
- §9 AI summary replacement — Task 5 is the replacement; Task 7 deletes the old violet div as part of the DocumentSourceDetail function deletion
- §10 Superuser gating — Task 6 handles isSuperuser conditional
- §11 sourceGuidance.ts structure — Task 1 creates exactly this
- §12 Migration — Task 7 is the migration
- §13 Success criteria — Task 8 verifies the technical criteria, Task 9 verifies the UAT criteria
- §15 Risks — the risks are mitigated in-line by the task design (e.g. Task 1's explicit dedup handling, Task 6's graceful summary handling via parseAiSummary)

No gaps.

**2. Placeholder scan:**

- Task 1 Step 2 contains `{ /* copy verbatim from configuratie.tsx:... */ }` placeholders. This is INTENTIONAL: the content is 300+ lines of verbatim data that would bloat the plan. The comment is explicit about the verbatim copy and gives exact line ranges. The implementer is instructed in Task 1 Step 1 to Read the source range first, and Task 1 Step 2 explicitly says "Each comment must be replaced with the ACTUAL object literal copied verbatim from the indicated line range. Do not paraphrase. The final file should have zero placeholders." This is the ONE place a placeholder-like comment appears, and it is a data-copy instruction, not a missing implementation.
- Task 7 Step 4: "after deleting the SOURCE_GUIDANCE block in Step 2, line numbers will have shifted. Use a grep to find the new start" — this is concrete guidance, not a placeholder.
- Task 7 Step 8 lists "common suspects" for unused imports — this is evidence-based guidance, the grep command in Step 8 is deterministic.
- Task 9 Step 6 says "Replace N with the actual commit count when executing" — this is a runtime value not known at plan-write time.

Conclusion: no meaningful placeholders.

**3. Type consistency:**

- `PolicyDocument` type — imported from `@/hooks/usePolicyDocuments` in Tasks 3, 6 — consistent
- `DocumentSummary` type — imported from the same hook in Tasks 5, 6 — consistent
- `entityType: 'gemeente' | 'provincie' | 'landelijk'` — used consistently in Tasks 4, 6. Note that the underlying `usePolicyDocuments` accepts `entityType: string` (wider) — the stricter union in our components is a deliberate narrowing at the UI boundary.
- `onView: () => void` — declared in DocumentListItem Props (Task 3), called from shell Task 6 — consistent
- `SourceGuidance` interface — declared in Task 1, imported by Task 2 — consistent
- `DetailLoading`, `DetailEmpty`, `DetailError` — imported from `./DetailStates` in Task 6 — those were created in S01, verified to exist

No inconsistencies.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-08-m044-s02-document-source-detail-view.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. This is the pattern that worked well for S01.

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.

**Which approach?**
