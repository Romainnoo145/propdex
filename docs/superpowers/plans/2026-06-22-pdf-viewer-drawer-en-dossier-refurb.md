# PDF-viewer-drawer + Dossier-tab refurb — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vervang de krappe `PDFViewerModal` door één gedeelde brede rechter `PdfViewerDrawer` (A4 fit-to-width + zoom), en trek de Dossier-tab gelijk met Potentie/Risico (toggle eruit → één scroll, Tile-icon 2-koloms cards, documenten inzien via de nieuwe drawer).

**Architecture:** Slice 1 bouwt de gedeelde `PdfViewerDrawer` (chrome uit `FactorDetailDrawer`, breed, blob-fetch uit de oude modal, optionele bestandsrail, zoom via PDF-open-parameters) en migreert de 3 modal-call-sites. Slice 2 herschrijft `BronnenLayer` naar één doorlopende scroll met categorie-secties + een nieuwe `DossierSlotCard`, en opent de viewer-drawer bij een slot-met-documenten.

**Tech Stack:** React + TypeScript, framer-motion, Tailwind v4 (Aura `@theme`), lucide-react, Vitest (node-env), Storybook.

## Global Constraints

- Aura-tokens / Tailwind-utilities; geen nieuwe hardcoded brand-hex buiten de gevestigde (`#0E1111`, `#F2F6F3`, `#9CA3AF`, `#F8FAFA`, amber `#F9A826`/tints, sage `#D1E2D8`). Plus Jakarta Sans. Light mode only.
- Bestanden < 300 regels; nieuwe units in eigen bestanden.
- Tests = **node-env pure-logic Vitest** — GEEN jsdom, GEEN @testing-library/react. Componenten via Storybook + `npm run check` (tsc). Mirror `lib/__tests__/factor-detail.test.ts`.
- Quality-gate per taak: `cd frontend && npm run check` exit 0 + relevante `vitest` groen vóór commit.
- Commit-prefix: **`M054/S04:`** (Slice 1, viewer) · **`M054/S05:`** (Slice 2, dossier). SCHEMA_VERSION onaangeroerd.
- **PdfViewerDrawer breedte:** `w-[52vw] min-w-[840px] max-w-[1100px]`; **fit-to-width only**, geen fit-modus-toggle.
- **git hygiene:** er staan pre-existing untracked files (`.polly/`, `roadmap_documentatie_propdex.md`) — `git add` ALLEEN de genoemde files per taak; NOOIT `git add -A`/`.`/`-a`.
- Drawer-chrome referentie: `frontend/src/components/map/panels/parcel/FactorDetailDrawer.tsx` (portal→body, `AnimatePresence` backdrop `bg-black/30 backdrop-blur-md justify-end`, paneel `x:'100%'→0` `ease [0.4,0,0.2,1]` 0.3s, `rounded-l-[32px]`, close + `Esc`).

---

# SLICE 1 — `PdfViewerDrawer` (M054/S04)

### Task 1: `lib/pdf-zoom.ts` — pure zoom-helpers

**Files:**
- Create: `frontend/src/lib/pdf-zoom.ts`
- Create: `frontend/src/lib/__tests__/pdf-zoom.test.ts`

**Interfaces:**
- Produces: `type ZoomLevel = 'fit' | number`; `ZOOM_SEQUENCE: ZoomLevel[]`; `nextZoom(z: ZoomLevel): ZoomLevel`; `prevZoom(z: ZoomLevel): ZoomLevel`; `zoomLabel(z: ZoomLevel): string`; `zoomToPdfParam(z: ZoomLevel): string`.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/lib/__tests__/pdf-zoom.test.ts
import { describe, expect, it } from 'vitest'
import { ZOOM_SEQUENCE, nextZoom, prevZoom, zoomLabel, zoomToPdfParam } from '../pdf-zoom'

describe('pdf-zoom', () => {
  it('sequence starts at fit and increases', () => {
    expect(ZOOM_SEQUENCE[0]).toBe('fit')
    expect(ZOOM_SEQUENCE).toContain(100)
  })
  it('nextZoom steps up and clamps at the max', () => {
    expect(nextZoom('fit')).toBe(75)
    expect(nextZoom(200)).toBe(200)
  })
  it('prevZoom steps down and clamps at fit', () => {
    expect(prevZoom(75)).toBe('fit')
    expect(prevZoom('fit')).toBe('fit')
  })
  it('zoomLabel renders fit + percentages', () => {
    expect(zoomLabel('fit')).toBe('Passend')
    expect(zoomLabel(100)).toBe('100%')
  })
  it('zoomToPdfParam maps fit to page-width and numbers to the zoom value', () => {
    expect(zoomToPdfParam('fit')).toBe('page-width')
    expect(zoomToPdfParam(125)).toBe('125')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/__tests__/pdf-zoom.test.ts`
Expected: FAIL — "Cannot find module '../pdf-zoom'".

- [ ] **Step 3: Implement `lib/pdf-zoom.ts`**

```ts
/** Zoom model for the PDF viewer. 'fit' = fit-to-width (the default). */
export type ZoomLevel = 'fit' | number

export const ZOOM_SEQUENCE: ZoomLevel[] = ['fit', 75, 100, 125, 150, 200]

function indexOf(z: ZoomLevel): number {
  const i = ZOOM_SEQUENCE.indexOf(z)
  return i === -1 ? 0 : i
}

export function nextZoom(z: ZoomLevel): ZoomLevel {
  const i = indexOf(z)
  return ZOOM_SEQUENCE[Math.min(i + 1, ZOOM_SEQUENCE.length - 1)]!
}

export function prevZoom(z: ZoomLevel): ZoomLevel {
  const i = indexOf(z)
  return ZOOM_SEQUENCE[Math.max(i - 1, 0)]!
}

export function zoomLabel(z: ZoomLevel): string {
  return z === 'fit' ? 'Passend' : `${z}%`
}

/** PDF Open Parameter for the iframe `#zoom=` fragment. */
export function zoomToPdfParam(z: ZoomLevel): string {
  return z === 'fit' ? 'page-width' : `${z}`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/__tests__/pdf-zoom.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/pdf-zoom.ts frontend/src/lib/__tests__/pdf-zoom.test.ts
git commit -m "M054/S04: pdf-zoom pure helpers (fit-to-width + zoom sequence)"
```

---

### Task 2: `PdfViewerDrawer.tsx` — gedeelde brede viewer-drawer

**Files:**
- Create: `frontend/src/components/ui/PdfViewerDrawer.tsx`
- Create: `frontend/src/stories/ui/PdfViewerDrawer.stories.tsx`

**Interfaces:**
- Consumes: `ZoomLevel`, `nextZoom`, `prevZoom`, `zoomLabel`, `zoomToPdfParam` from `@/lib/pdf-zoom`; `useAuth` from `@/lib/auth/useAuth`.
- Produces:
```ts
export interface PdfViewerFile { id: string; filename: string; meta?: string }
export interface PdfViewerDrawerProps {
  url: string                  // authenticated endpoint of the active document
  title: string
  eyebrow?: string             // e.g. "Bouwkundig · Dossier" (default "Document viewer")
  onClose: () => void
  files?: PdfViewerFile[]      // optional left rail
  activeId?: string
  onSelectFile?: (id: string) => void
  onDownload?: () => void
  onDelete?: () => void
  onUpload?: () => void
}
export function PdfViewerDrawer(props: PdfViewerDrawerProps): JSX.Element
```
Rendered when mounted (parent controls visibility — same contract as the old modal; no `isOpen`).

- [ ] **Step 1: Implement `PdfViewerDrawer.tsx`**

Reuse the blob-fetch / object-url / capture-phase-Escape logic verbatim from `PDFViewerModal.tsx` (the `useAuth` token, `fetchPdf` with AbortController, the two cleanup effects, the capture-phase Escape handler). Replace the centered-modal chrome with the wide right-drawer chrome (FactorDetailDrawer family). Detect images by extension for an `<img>` fallback; PDFs use the `<iframe>` with the `#zoom=` fragment; unknown types keep the "open in nieuw tabblad" fallback.

```tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Download, Trash2, Upload, RefreshCw, ExternalLink, Minus, Plus } from 'lucide-react'
import { useAuth } from '@/lib/auth/useAuth'
import { type ZoomLevel, nextZoom, prevZoom, zoomLabel, zoomToPdfParam } from '@/lib/pdf-zoom'

export interface PdfViewerFile {
  id: string
  filename: string
  meta?: string
}

export interface PdfViewerDrawerProps {
  url: string
  title: string
  eyebrow?: string
  onClose: () => void
  files?: PdfViewerFile[]
  activeId?: string
  onSelectFile?: (id: string) => void
  onDownload?: () => void
  onDelete?: () => void
  onUpload?: () => void
}

const IMAGE_RE = /\.(png|jpe?g|webp|gif)$/i

export function PdfViewerDrawer({
  url, title, eyebrow = 'Document viewer', onClose,
  files, activeId, onSelectFile, onDownload, onDelete, onUpload,
}: PdfViewerDrawerProps) {
  const { accessToken } = useAuth()
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [zoom, setZoom] = useState<ZoomLevel>('fit')
  const isImage = IMAGE_RE.test(title)

  const fetchDoc = useCallback(async (signal?: AbortSignal) => {
    if (!accessToken) return
    await Promise.resolve()
    if (signal?.aborted) return
    setLoading(true)
    setError(null)
    try {
      const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, credentials: 'include', signal })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const blob = await r.blob()
      setObjectUrl(URL.createObjectURL(blob))
      setLoading(false)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Kon document niet laden')
      setLoading(false)
    }
  }, [url, accessToken])

  useEffect(() => {
    const c = new AbortController()
    void fetchDoc(c.signal)
    return () => c.abort()
  }, [fetchDoc])

  useEffect(() => {
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [objectUrl])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); onClose() }
    }
    document.addEventListener('keydown', handler, true)
    return () => document.removeEventListener('keydown', handler, true)
  }, [onClose])

  const iframeSrc = objectUrl ? `${objectUrl}#zoom=${zoomToPdfParam(zoom)}&toolbar=0` : ''

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="pdf-drawer-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[60] flex items-stretch justify-end bg-black/30 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="relative flex h-full w-[52vw] min-w-[840px] max-w-[1100px] flex-col rounded-l-[32px] bg-[#F8FAFA] shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-7 py-5">
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400">{eyebrow}</p>
              <h2 className="mt-0.5 truncate text-[18px] font-bold text-[#0E1111]">{title}</h2>
            </div>
            <div className="flex items-center gap-2">
              {!isImage && (
                <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1">
                  <button type="button" aria-label="Uitzoomen" onClick={() => setZoom(prevZoom(zoom))} className="flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-[#0E1111]"><Minus size={15} /></button>
                  <span className="min-w-[58px] text-center text-[12px] font-bold tabular-nums text-slate-600">{zoomLabel(zoom)}</span>
                  <button type="button" aria-label="Inzoomen" onClick={() => setZoom(nextZoom(zoom))} className="flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-[#0E1111]"><Plus size={15} /></button>
                </div>
              )}
              {onDownload && <button type="button" aria-label="Download" onClick={onDownload} className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 hover:text-[#0E1111]"><Download size={16} /></button>}
              {onDelete && <button type="button" aria-label="Verwijderen" onClick={onDelete} className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>}
              <button type="button" aria-label="Sluiten" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0E1111] text-white hover:bg-[#0E1111]/80"><X size={16} /></button>
            </div>
          </div>

          {/* Body: optional rail + viewport */}
          <div className="flex min-h-0 flex-1">
            {files && files.length > 0 && (
              <div className="flex w-[230px] shrink-0 flex-col gap-1.5 overflow-y-auto border-r border-slate-100 p-3.5">
                <p className="mb-1 px-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">{files.length} bestand{files.length > 1 ? 'en' : ''}</p>
                {files.map((f) => (
                  <button
                    key={f.id} type="button" onClick={() => onSelectFile?.(f.id)}
                    className={`flex items-center gap-2.5 rounded-[14px] p-2.5 text-left transition-colors ${f.id === activeId ? 'bg-amber-100' : 'hover:bg-white'}`}
                  >
                    <span className="truncate">
                      <span className={`block truncate text-[12px] font-bold ${f.id === activeId ? 'text-amber-900' : 'text-slate-900'}`}>{f.filename}</span>
                      {f.meta && <span className="block text-[10px] text-slate-400">{f.meta}</span>}
                    </span>
                  </button>
                ))}
                {onUpload && (
                  <button type="button" onClick={onUpload} className="mt-1 flex items-center justify-center gap-1.5 rounded-[14px] border border-dashed border-slate-300 p-2.5 text-[11px] font-extrabold uppercase tracking-wide text-slate-400 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700">
                    <Upload size={13} /> Toevoegen
                  </button>
                )}
              </div>
            )}

            <div className="flex flex-1 justify-center overflow-y-auto bg-[#ECEFF1] p-7">
              {loading && (
                <div className="flex items-center self-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-aura-amber border-t-transparent" />
                  <p className="ml-3 text-[13px] text-slate-500">Document laden…</p>
                </div>
              )}
              {error && !loading && (
                <div className="flex flex-col items-center gap-3 self-center text-center">
                  <p className="text-[13px] text-red-600">Fout bij het laden: {error}</p>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => { if (objectUrl) { URL.revokeObjectURL(objectUrl); setObjectUrl(null) } void fetchDoc() }} className="flex items-center gap-1.5 rounded-full bg-[#0E1111] px-4 py-1.5 text-[12px] font-semibold text-white hover:bg-[#0E1111]/80"><RefreshCw size={14} /> Opnieuw</button>
                    <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-[12px] font-semibold text-slate-500 hover:text-[#0E1111]"><ExternalLink size={14} /> Nieuw tabblad</a>
                  </div>
                </div>
              )}
              {objectUrl && !loading && !error && (
                isImage ? (
                  <img src={objectUrl} alt={title} className="h-fit max-w-full rounded-[4px] bg-white shadow-[0_6px_24px_rgba(0,0,0,0.12)]" />
                ) : (
                  <iframe src={iframeSrc} title={title} className="h-full w-full max-w-[820px] rounded-[4px] border-0 bg-white shadow-[0_6px_24px_rgba(0,0,0,0.12)]" />
                )
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}
```

- [ ] **Step 2: Create Storybook story**

```tsx
// frontend/src/stories/ui/PdfViewerDrawer.stories.tsx
import type { Meta, StoryObj } from '@storybook/react-vite'
import { PdfViewerDrawer } from '@/components/ui/PdfViewerDrawer'

const meta: Meta<typeof PdfViewerDrawer> = { title: 'UI/PdfViewerDrawer', component: PdfViewerDrawer }
export default meta
type Story = StoryObj<typeof PdfViewerDrawer>

export const SingleDoc: Story = {
  args: { url: 'about:blank', title: 'rapport.pdf', onClose: () => {} },
}
export const WithFileRail: Story = {
  args: {
    url: 'about:blank', title: 'keuring-2025.pdf', eyebrow: 'Bouwkundig · Dossier',
    activeId: 'a', onSelectFile: () => {}, onDownload: () => {}, onDelete: () => {}, onUpload: () => {},
    files: [
      { id: 'a', filename: 'keuring-2025.pdf', meta: '2 dagen geleden · 1,2 MB' },
      { id: 'b', filename: 'foto-gevel.jpg', meta: '2 dagen geleden · 480 KB' },
    ],
  },
}
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npm run check`
Expected: exit 0. (If eslint flags the `'use client'` directive or an icon import, fix; all icons used exist in lucide-react.)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ui/PdfViewerDrawer.tsx frontend/src/stories/ui/PdfViewerDrawer.stories.tsx
git commit -m "M054/S04: PdfViewerDrawer — wide right drawer, fit-to-width A4 + zoom + optional file rail"
```

---

### Task 3: Migreer de 3 call-sites + verwijder `PDFViewerModal`

**Files:**
- Modify: `frontend/src/components/checklist/ChecklistCore.tsx` (`:46` import, `:519-522` usage)
- Modify: `frontend/src/components/configuratie/DocumentSourceDetailView.tsx` (`:23` import, `:126-129` usage)
- Modify: `frontend/src/components/cockpit/OnderzoekPhaseView.tsx` (`:21` import, `:272-275` usage)
- Delete: `frontend/src/components/ui/PDFViewerModal.tsx`

**Interfaces:**
- Consumes: `PdfViewerDrawer` (Task 2). The old modal was used as `<PDFViewerModal url=… title=… onClose=… />`; `PdfViewerDrawer` accepts the same three props (drop-in for single-doc).

- [ ] **Step 1: Replace the import + usage in each of the 3 files**

In each file, change the import:
```tsx
// from
import { PDFViewerModal } from '@/components/ui/PDFViewerModal'
// to
import { PdfViewerDrawer } from '@/components/ui/PdfViewerDrawer'
```
and the JSX tag `<PDFViewerModal ... />` → `<PdfViewerDrawer ... />`, keeping the exact same `url` / `title` / `onClose` props already passed (no rail props — single-doc). Leave the surrounding conditional-mount and the viewer-state hooks untouched.

- [ ] **Step 2: Delete the old modal**

```bash
git rm frontend/src/components/ui/PDFViewerModal.tsx
```

- [ ] **Step 3: Verify no dangling references**

Run: `cd frontend && grep -rn "PDFViewerModal" src || echo "clean"`
Expected: `clean` (no matches).

- [ ] **Step 4: Typecheck**

Run: `cd frontend && npm run check`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/checklist/ChecklistCore.tsx \
        frontend/src/components/configuratie/DocumentSourceDetailView.tsx \
        frontend/src/components/cockpit/OnderzoekPhaseView.tsx
git commit -m "M054/S04: migrate 3 call sites to PdfViewerDrawer; remove PDFViewerModal"
```

---

# SLICE 2 — Dossier-tab refurb (M054/S05)

### Task 4: `DossierSlotCard.tsx` — Tile-icon card (3 states)

**Files:**
- Create: `frontend/src/components/map/panels/parcel/DossierSlotCard.tsx`
- Create: `frontend/src/stories/parcel/DossierSlotCard.stories.tsx`

**Interfaces:**
- Consumes: `DossierCard` type from `@/lib/cockpit/dossier-pages` (`{ key, label, Icon, value, sub, filled, documents }`).
- Produces:
```ts
export type DossierSlotState = 'empty' | 'data' | 'docs'
export function dossierSlotState(card: DossierCard): DossierSlotState
export function DossierSlotCard(props: {
  card: DossierCard
  onClick: () => void           // docs → open viewer; empty/data → upload
  onDragFile?: (file: File) => void
}): JSX.Element
```

- [ ] **Step 1: Write the failing test for the state helper**

```ts
// add to a new file frontend/src/components/map/panels/parcel/__tests__/dossier-slot.test.ts
import { describe, expect, it } from 'vitest'
import { dossierSlotState } from '../DossierSlotCard'

const card = (over = {}) => ({ key: 'woz', label: 'WOZ', Icon: (() => null) as never, value: 'LEEG', sub: '', filled: false, documents: [], ...over })

describe('dossierSlotState', () => {
  it('docs when user documents present', () => {
    expect(dossierSlotState(card({ documents: [{ id: '1' }] as never, filled: true }))).toBe('docs')
  })
  it('data when filled by API value (no user docs)', () => {
    expect(dossierSlotState(card({ filled: true, value: '€420K' }))).toBe('data')
  })
  it('empty otherwise', () => {
    expect(dossierSlotState(card())).toBe('empty')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/map/panels/parcel/__tests__/dossier-slot.test.ts`
Expected: FAIL — module/export not found.

- [ ] **Step 3: Implement `DossierSlotCard.tsx`**

```tsx
import { useState, useCallback, createElement } from 'react'
import { Upload } from 'lucide-react'
import type { DossierCard } from '@/lib/cockpit/dossier-pages'

export type DossierSlotState = 'empty' | 'data' | 'docs'

/** docs = has user uploads · data = API-filled value · empty = nothing yet. */
export function dossierSlotState(card: DossierCard): DossierSlotState {
  if (card.documents.length > 0) return 'docs'
  if (card.filled && card.value !== 'LEEG') return 'data'
  return 'empty'
}

interface DossierSlotCardProps {
  card: DossierCard
  onClick: () => void
  onDragFile?: (file: File) => void
}

export function DossierSlotCard({ card, onClick, onDragFile }: DossierSlotCardProps) {
  const state = dossierSlotState(card)
  const [dragOver, setDragOver] = useState(false)
  const iconNode = createElement(card.Icon, { size: 20, strokeWidth: 1.5 })

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && onDragFile) onDragFile(file)
  }, [onDragFile])

  const border = state === 'empty'
    ? 'border border-dashed border-slate-200 bg-white/50'
    : state === 'docs'
      ? 'border border-amber-200 bg-amber-50'
      : 'border border-emerald-200 bg-white'
  const tile = state === 'empty'
    ? 'bg-slate-100 text-slate-300'
    : state === 'docs'
      ? 'bg-amber-100 text-amber-700'
      : 'bg-emerald-50 text-emerald-700'
  const dotColor = state === 'docs' ? 'bg-amber-400' : state === 'data' ? 'bg-emerald-500' : 'bg-slate-300'
  const valColor = state === 'empty' ? 'text-slate-300' : state === 'docs' ? 'text-amber-900' : 'text-slate-900'
  const valText = state === 'empty' ? 'Sleep of klik' : card.value === 'LEEG'
    ? `${card.documents.length} bestand${card.documents.length > 1 ? 'en' : ''}` : card.value

  return (
    <div
      role="button" tabIndex={0}
      aria-label={`${card.label}: ${valText}`}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true) }}
      onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false) }}
      onDrop={handleDrop}
      className={`flex min-h-[128px] cursor-pointer flex-col rounded-[18px] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all ${border} ${dragOver ? 'border-amber-500 ring-2 ring-amber-200' : ''}`}
    >
      <div className="flex items-start justify-between">
        <span className={`flex h-[42px] w-[42px] items-center justify-center rounded-[13px] ${tile}`}>{iconNode}</span>
        {state === 'docs'
          ? <span className="rounded-full bg-amber-200/70 px-2 py-0.5 text-[10px] font-extrabold text-amber-700">{card.documents.length}</span>
          : <span className={`mt-1.5 h-2 w-2 rounded-full ${dotColor}`} />}
      </div>
      <div className="mt-auto pt-3 text-left">
        <p className={`text-[10px] font-extrabold uppercase tracking-[0.13em] ${state === 'docs' ? 'text-amber-900/70' : 'text-slate-400'}`}>{card.label}</p>
        <p className={`mt-0.5 text-[18px] font-extrabold leading-tight tracking-[-0.02em] ${valColor} ${state === 'empty' ? 'text-[12px] uppercase tracking-wide' : ''}`}>{valText}</p>
        {state !== 'empty' && card.sub && <p className="mt-0.5 truncate text-[11px] text-slate-400">{card.sub}</p>}
        {state === 'empty' && (
          <p className="mt-1.5 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-slate-300">
            <Upload size={11} strokeWidth={2} /> {card.sub}
          </p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/map/panels/parcel/__tests__/dossier-slot.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Create Storybook story (3 states)**

```tsx
// frontend/src/stories/parcel/DossierSlotCard.stories.tsx
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Banknote } from 'lucide-react'
import { DossierSlotCard } from '@/components/map/panels/parcel/DossierSlotCard'

const meta: Meta<typeof DossierSlotCard> = { title: 'Parcel/DossierSlotCard', component: DossierSlotCard }
export default meta
type Story = StoryObj<typeof DossierSlotCard>

const base = { key: 'woz', label: 'WOZ', Icon: Banknote, sub: 'WOZ-waarde', documents: [] as never[] }
export const Data: Story = { args: { card: { ...base, value: '€ 420.000', filled: true }, onClick: () => {} } }
export const Empty: Story = { args: { card: { ...base, value: 'LEEG', filled: false }, onClick: () => {} } }
export const Docs: Story = { args: { card: { ...base, value: 'LEEG', filled: true, documents: [{ id: '1' }, { id: '2' }] as never }, onClick: () => {} } }
```

- [ ] **Step 6: Typecheck + commit**

Run: `cd frontend && npm run check`
Expected: exit 0.

```bash
git add frontend/src/components/map/panels/parcel/DossierSlotCard.tsx \
        frontend/src/components/map/panels/parcel/__tests__/dossier-slot.test.ts \
        frontend/src/stories/parcel/DossierSlotCard.stories.tsx
git commit -m "M054/S05: DossierSlotCard — Tile-icon card, 3 states (empty/data/docs)"
```

---

### Task 5: Herschrijf `BronnenLayer` — één scroll + secties + viewer-drawer

**Files:**
- Modify: `frontend/src/components/map/panels/parcel/layers/BronnenLayer.tsx`

**Interfaces:**
- Consumes: `DossierSlotCard` + `dossierSlotState` (Task 4); `PdfViewerDrawer` + `PdfViewerFile` (Task 2); `GHOST_ICONS`, `mergeDocuments`, types `DossierCard`/`DossierPage` from `@/lib/cockpit/dossier-pages`.

This task keeps `BronnenLayer`'s existing data plumbing (its `buildPages` from `ScanResultItem`+enrichment, the upload/download/delete/drop handlers, `useParcelEnrichment`/`useParcelDocuments`/`useUploadDocument`/`useDeleteDocument`, the hidden file input) and replaces only: the pagination + grid render, the hero, and the per-slot click behavior.

- [ ] **Step 1: Dedup the shared bits**

In `BronnenLayer.tsx`: delete the local `GHOST_ICONS`, the local `DossierCard`/`DossierPage` interfaces, and the local `mergeDocuments` function. Import them instead:
```tsx
import { GHOST_ICONS, mergeDocuments, type DossierCard, type DossierPage } from '@/lib/cockpit/dossier-pages'
```
Keep the local `buildPages(parcel, …)` (it has the map-specific data inputs). Add `tabLabel: <title-cased>` to each returned page object so it satisfies the shared `DossierPage` type (e.g. `tabLabel: 'Acquisitie'`). Remove the now-unused `PageTitleToggle` import and `DropzoneCard` component (the whole `DropzoneCard` function and its `GHOST_ICONS`/`MAX_VISIBLE_DOCS`/`ACCEPTED_TYPES`-for-card usage — keep `ACCEPTED_TYPES` for the file input).

- [ ] **Step 2: Replace the render body (hero + scroll) and add viewer state**

Replace the component's `return (…)` block and add an `activeSlot` state. Keep the existing handlers (`handleUploadClick`, `doUpload`, `handleFileChange`, `handleFileDrop`, `handleDelete`, `handleDownload`) and the hidden `<input ref={fileInputRef} … />`.

```tsx
// near the other useState hooks:
const [activeSlot, setActiveSlot] = useState<string | null>(null)

// after `const pages = mergeDocuments(rawPages, userDocs)`:
const allCards = pages.flatMap((p) => p.cards)
const totalSlots = allCards.length
const filledTotal = allCards.filter((c) => c.filled).length
const openCard = activeSlot ? allCards.find((c) => c.key === activeSlot) ?? null : null
const openDocs = openCard?.documents ?? []
const [activeDocId, setActiveDocId] = useState<string | null>(null)
const activeDoc = openDocs.find((d) => d.id === activeDocId) ?? openDocs[0] ?? null

function onSlotClick(card: DossierCard) {
  if (card.documents.length > 0) {
    setActiveSlot(card.key)
    setActiveDocId(card.documents[0]?.id ?? null)
  } else {
    handleUploadClick(card.key) // empty/data → upload
  }
}
```

The `return`:
```tsx
return (
  <div className="flex flex-1 flex-col pt-4 pb-4">
    <input ref={fileInputRef} type="file" accept={ACCEPTED_TYPES} className="hidden" onChange={handleFileChange} />

    {/* Hero — total completeness */}
    <div className="mx-6 rounded-[20px] border border-slate-100 bg-slate-50/50 px-5 py-4">
      <div className="flex items-center justify-between">
        <span className="text-6xl font-black leading-none tracking-tighter text-slate-900 tabular-nums">
          {filledTotal}<span className="text-2xl font-bold text-slate-300">/{totalSlots}</span>
        </span>
        <div className="min-w-0 flex-1 px-5">
          <p className="text-lg font-bold uppercase tracking-wide text-slate-700">Dossier</p>
          <p className="mt-0.5 truncate text-[13px] text-slate-500">{filledTotal} van {totalSlots} bronnen gevuld</p>
        </div>
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-amber-400">
          <FolderOpen className="size-5 text-white" strokeWidth={2.5} />
        </div>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-amber-400 transition-all duration-500" style={{ width: `${totalSlots ? Math.round((filledTotal / totalSlots) * 100) : 0}%` }} />
      </div>
    </div>

    {/* One continuous scroll, grouped by category */}
    <div className="mt-3 flex-1 overflow-y-auto px-6">
      {pages.map((page) => (
        <div key={page.title}>
          <div className="mb-2 mt-4 flex items-center gap-2 first:mt-1">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400">{page.tabLabel}</span>
            <span className="h-px flex-1 bg-slate-100" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {page.cards.map((card) => (
              <DossierSlotCard
                key={card.key}
                card={card}
                onClick={() => onSlotClick(card)}
                onDragFile={(file) => handleFileDrop(card.key, file)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>

    {/* Viewer drawer for a slot with documents */}
    {openCard && activeDoc && (
      <PdfViewerDrawer
        url={getDocumentDownloadUrl(documentParcelId, activeDoc.id)}
        title={activeDoc.filename}
        eyebrow={`${openCard.label} · Dossier`}
        files={openDocs.map((d) => ({ id: d.id, filename: d.filename, meta: formatRelativeNL(d.uploaded_at) }))}
        activeId={activeDoc.id}
        onSelectFile={(id) => setActiveDocId(id)}
        onClose={() => { setActiveSlot(null); setActiveDocId(null) }}
        onDownload={() => handleDownload(activeDoc.id, activeDoc.filename)}
        onDelete={() => { handleDelete(activeDoc.id); setActiveSlot(null); setActiveDocId(null) }}
        onUpload={() => handleUploadClick(openCard.key)}
      />
    )}
  </div>
)
```

Ensure `FolderOpen`, `getDocumentDownloadUrl`, `formatRelativeNL`, `PdfViewerDrawer`, `PdfViewerFile`, `DossierSlotCard` are imported; drop now-unused imports (e.g. `PageTitleToggle`, `TruncatedText` if no longer used, `AnimatePresence`/`motion` if the old animated grid is gone — verify before removing).

- [ ] **Step 3: Verify the coverage/typecheck**

Run: `cd frontend && npm run check`
Expected: exit 0. If `npm run check` flags unused imports/vars, remove them. If the cockpit `DossierPage` type rejects the map pages (missing `tabLabel`), confirm `tabLabel` was added to each page object in Step 1.

- [ ] **Step 4: Run the dossier-related tests**

Run: `cd frontend && npx vitest run src/components/map/panels/parcel/__tests__/dossier-slot.test.ts src/lib/__tests__/pdf-zoom.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/map/panels/parcel/layers/BronnenLayer.tsx
git commit -m "M054/S05: BronnenLayer — one scroll + category sections, DossierSlotCard grid, PdfViewerDrawer for documents"
```

---

### Task 6: Volledige verificatie

**Files:** none (gate only).

- [ ] **Step 1: Full typecheck + test suite**

Run: `cd frontend && npm run check && npx vitest run`
Expected: `npm run check` exit 0; all Vitest suites pass (pdf-zoom, dossier-slot, factor-detail, factor-list, popup suites, layer coverage suites). The known Playwright-browser unhandled error in the browser-mode project is environmental, not a failure.

- [ ] **Step 2: Visual verification (post-deploy, per prod-first workflow)**

After merge + push, open a Venlo parcel on propdex.nl: Dossiers tab shows one scroll with category headers + 2-col tile cards; upload a file → card turns amber; click it → wide PdfViewerDrawer opens with the file rail + large A4; verify a PDF from a policy-doc / checklist still opens in the new drawer. Capture a screenshot to share.

---

## Self-Review

**Spec coverage:**
- PdfViewerDrawer (wide, FactorDetailDrawer chrome, fit-to-width + zoom, optional rail) → Task 2; zoom helpers → Task 1. ✅
- Replace PDFViewerModal everywhere + delete → Task 3. ✅
- Dossier: toggle out → one scroll + category sections → Task 5. ✅
- Tile-icon 2-col card, 3 states, left-aligned, no "+ toevoegen" → Task 4 + 5. ✅
- Hero = total completeness → Task 5. ✅
- Click slot-with-docs → viewer drawer with file rail; empty → upload; drag&drop kept → Task 5. ✅
- Share GHOST_ICONS/mergeDocuments/types, keep own builder → Task 5 Step 1. ✅
- Data-layer linkage with Onderzoek phase preserved (documents unchanged) — no task needed; not modified. ✅
- Tests node-env pure-logic; components via Storybook → Tasks 1/4 unit-test exported helpers; 2/4 add stories. ✅

**Placeholder scan:** No TBD/TODO. Task 5 references existing handlers by name (kept verbatim from the current file) and adds new state — the implementer reads the current BronnenLayer for those bodies (they are not reproduced because they are unchanged). The `as never` casts in test fixtures are deliberate minimal typing for mock cards.

**Type consistency:** `DossierCard` shape (`key/label/Icon/value/sub/filled/documents`) is imported from `lib/cockpit/dossier-pages` and used identically in Tasks 4 & 5. `dossierSlotState`, `PdfViewerDrawerProps`, `PdfViewerFile`, `ZoomLevel` signatures match across tasks. `getDocumentDownloadUrl(documentParcelId, id)` matches the existing BronnenLayer usage.
