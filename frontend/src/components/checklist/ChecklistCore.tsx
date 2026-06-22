/**
 * ChecklistCore — the reusable use-case checklist renderer.
 *
 * Extracted from S8VergunningChecklist (M052/S02, HAAL-01/HAAL-03) so it can mount
 * in two places with the SAME ChecklistProgress persistence (parcel_id + use_case):
 *   1. The report section (`S8VergunningChecklist`) — derives use_cases from
 *      `report_data.use_case_scores` and offers a strategy toggle between them.
 *   2. The Haalbaarheid phase (`HaalbaarheidPhaseView`) — derives a single use_case
 *      from the parcel's projecttype (`projectTypeToUseCase`), no toggle.
 *
 * The component is told WHICH use_cases to offer (already resolved by the caller).
 * All progress/upload/doc-status logic lives here — callers never duplicate it.
 *
 * Visual system: Monochrome amber/slate — no circus colors (DESIGN.md Aura).
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ClipboardCheck,
  Loader2,
  AlertTriangle,
  Check,
  Upload,
  FileText,
  ExternalLink,
  ChevronRight,
  Download,
  Eye,
  X,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import type {
  ChecklistItem,
  ChecklistItemLinks,
  ChecklistLinksBundle,
  ChecklistResponse,
} from '@/lib/types/checklist'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/lib/auth/useAuth'
import { useChecklistProgress, useUpdateChecklistProgress } from '@/hooks/useChecklistProgress'
import { useOrgChecklistLinks } from '@/hooks/useOrgChecklistLinks'
import { useUploadDocument } from '@/hooks/useDocuments'
import { SectionInsightCard } from '@/components/reports/components/SectionInsightCard'
import { PdfViewerDrawer } from '@/components/ui/PdfViewerDrawer'
import { TeamAttributionBadge } from '@/components/checklist/TeamAttributionBadge'

/* ─── Public types ───────────────────────────────────────────── */

/** A selectable use_case the checklist can render. */
export interface ChecklistUseCaseOption {
  id: string
  label: string
}

export interface ChecklistCoreProps {
  /** Use_cases offered to the user. 1 = no toggle (Haalbaarheid); 2+ = strategy toggle (report). */
  useCases: ChecklistUseCaseOption[]
  /** Parcel the progress/upload/doc-status is keyed against. */
  parcelId: string | null | undefined
}

/* ─── Checklist document status types ────────────────────────── */

interface ChecklistItemDocStatus {
  status: 'generated' | 'pending'
  document_id?: string
  document_type?: string
  filename?: string
}

interface ChecklistStatusResponse {
  parcel_id: string
  items: Record<string, ChecklistItemDocStatus>
  generated_count: number
  total_count: number
}

function useChecklistDocuments(parcelId: string | null | undefined) {
  const { accessToken } = useAuth()
  return useQuery<ChecklistStatusResponse, Error>({
    queryKey: ['checklist-doc-status', parcelId],
    queryFn: () =>
      apiFetch<ChecklistStatusResponse>(`/api/documents/${parcelId}/checklist-status`, {
        method: 'GET',
        accessToken,
      }),
    enabled: !!parcelId && !!accessToken,
    staleTime: 1000 * 60 * 5,
  })
}

/* ─── Constants ──────────────────────────────────────────────── */

const PHASE_LABELS: Record<string, string> = {
  voorbereiding: 'Voorbereiding',
  onderzoeken: 'Onderzoeken',
  vergunningen: 'Vergunningen',
  participatie: 'Participatie & Communicatie',
  nazorg: 'Nazorg & Oplevering',
  informatiebronnen: 'Informatiebronnen',
}

const USE_CASE_LABELS: Record<string, string> = {
  optoppen: 'Optoppen',
  splitsen: 'Splitsen',
  transformatie: 'Transformatie',
  nieuwbouw: 'Nieuwbouw',
}

/* ─── Helpers ────────────────────────────────────────────────── */

function groupByPhase(items: ChecklistItem[], phases: string[]): Map<string, ChecklistItem[]> {
  const groups = new Map<string, ChecklistItem[]>()
  for (const phase of phases) {
    const filtered = items.filter((i) => i.phase === phase)
    if (filtered.length > 0) groups.set(phase, filtered)
  }
  return groups
}

/* ─── Hooks ──────────────────────────────────────────────────── */

function useChecklist(useCase: string | null) {
  const { accessToken } = useAuth()

  return useQuery<ChecklistResponse, Error>({
    queryKey: ['vergunning-checklist', useCase],
    queryFn: () =>
      apiFetch<ChecklistResponse>(`/api/gemeente/checklists/${useCase}`, {
        method: 'GET',
        accessToken,
      }),
    enabled: !!useCase && !!accessToken,
    staleTime: 1000 * 60 * 60,
  })
}

/* ─── Item Detail Modal ──────────────────────────────────────── */

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

interface ItemModalProps {
  item: ChecklistItem
  checked: boolean
  onClose: () => void
  onToggle: (id: string) => void
  onUpload: (itemId: string, file: File) => void
  isUploading: boolean
}

function ItemDetailModal({ item, checked, onClose, onToggle, onUpload, isUploading }: ItemModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showBinnenkort, setShowBinnenkort] = useState(false)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopImmediatePropagation()
        if (showBinnenkort) {
          setShowBinnenkort(false)
        } else {
          onClose()
        }
      }
    },
    [onClose, showBinnenkort],
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [handleKeyDown])

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        onUpload(item.id, file)
        e.target.value = ''
      }
    },
    [item.id, onUpload],
  )

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="checklist-item-modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="relative flex w-full max-w-lg flex-col rounded-[32px] bg-white shadow-2xl mx-4 max-h-[calc(100vh-80px)]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between px-8 pt-7 pb-4 shrink-0">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5">
                {item.required ? (
                  <span className="shrink-0 rounded-full border border-aura-amber/30 bg-aura-amber/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-aura-amber-dark">
                    Verplicht
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Aanbevolen
                  </span>
                )}
                {item.estimated_cost && (
                  <span className="text-[12px] font-semibold tabular-nums text-slate-400">
                    {item.estimated_cost}
                  </span>
                )}
              </div>
              <h2 className="mt-2 text-[20px] font-black tracking-tight text-[#0E1111]">
                {item.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="ml-4 mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-[#F2F6F3] text-[#0E1111] transition-colors hover:bg-[#E8EDEB]"
              aria-label="Sluiten"
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 min-h-0 overflow-y-auto px-8 pb-6">
            {/* Description */}
            <p className="text-[14px] leading-relaxed text-slate-600">
              {item.description}
            </p>

            {/* Detail — extended explanation */}
            {item.detail && (
              <div className="mt-4 rounded-2xl border border-[#EAEFEF] bg-[#F8FAFA] px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-1">Wat houdt dit in?</p>
                <p className="text-[13px] leading-relaxed text-slate-600">
                  {item.detail}
                </p>
              </div>
            )}

            {/* Why needed — use-case specific */}
            {item.why_needed && (
              <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50/50 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-700 mb-1">Waarom belangrijk?</p>
                <p className="text-[13px] leading-relaxed text-amber-900/80">
                  {item.why_needed}
                </p>
              </div>
            )}

            {/* Meta: cost + provider */}
            {(item.estimated_cost || item.provider_type) && (
              <div className="mt-3 flex flex-wrap gap-3">
                {item.estimated_cost && (
                  <div className="rounded-xl border border-[#EAEFEF] bg-white px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Kosten</p>
                    <p className="text-[14px] font-semibold tabular-nums text-[#0E1111]">{item.estimated_cost}</p>
                  </div>
                )}
                {item.provider_type && (
                  <div className="rounded-xl border border-[#EAEFEF] bg-white px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Wie levert dit?</p>
                    <p className="text-[14px] font-semibold capitalize text-[#0E1111]">{item.provider_type}</p>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="mt-6 space-y-3">
              {/* Toggle checkbox */}
              <button
                onClick={() => onToggle(item.id)}
                className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 transition-colors ${
                  checked
                    ? 'border-aura-amber/30 bg-aura-amber/10'
                    : 'border-[#EAEFEF] bg-[#F8FAFA] hover:bg-[#F2F6F3]'
                }`}
              >
                <div
                  className={`flex size-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                    checked
                      ? 'border-amber-500 bg-amber-500 text-white'
                      : 'border-slate-300 bg-white'
                  }`}
                >
                  {checked && <Check className="size-3.5" strokeWidth={3} />}
                </div>
                <span className="text-[13px] font-semibold text-[#0E1111]">
                  {checked ? 'Afgerond' : 'Markeer als afgerond'}
                </span>
              </button>

              {/* Upload document */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex w-full items-center gap-3 rounded-2xl border border-[#EAEFEF] bg-[#F8FAFA] px-4 py-3 transition-colors hover:bg-[#F2F6F3] disabled:opacity-50"
              >
                {isUploading ? (
                  <Loader2 className="size-4 animate-spin text-slate-400" />
                ) : (
                  <Upload className="size-4 text-slate-500" />
                )}
                <span className="text-[13px] font-semibold text-[#0E1111]">
                  Document uploaden
                </span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              />

              {/* CTA: Generate document */}
              {item.cta_type === 'generate_document' && (
                <button
                  onClick={() => setShowBinnenkort(true)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-[#EAEFEF] bg-[#F8FAFA] px-4 py-3 transition-colors hover:bg-[#F2F6F3]"
                >
                  <FileText className="size-4 text-slate-500" />
                  <span className="text-[13px] font-semibold text-[#0E1111]">
                    {item.cta_text ?? 'Genereer document'}
                  </span>
                </button>
              )}

              {/* CTA: Request quote */}
              {item.cta_type === 'request_quote' && (
                <button
                  onClick={() => setShowBinnenkort(true)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-[#EAEFEF] bg-[#F8FAFA] px-4 py-3 transition-colors hover:bg-[#F2F6F3]"
                >
                  <FileText className="size-4 text-slate-500" />
                  <span className="text-[13px] font-semibold text-[#0E1111]">
                    {item.cta_text ?? 'Vraag offerte aan'}
                  </span>
                </button>
              )}

              {/* CTA: External link */}
              {item.cta_type === 'external_link' && (
                <a
                  href="#"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center gap-3 rounded-2xl border border-[#EAEFEF] bg-[#F8FAFA] px-4 py-3 transition-colors hover:bg-[#F2F6F3]"
                >
                  <ExternalLink className="size-4 text-slate-500" />
                  <span className="text-[13px] font-semibold text-[#0E1111]">
                    {item.cta_text ?? 'Meer info'}
                  </span>
                </a>
              )}
            </div>
          </div>

          {/* Binnenkort sub-popup */}
          {showBinnenkort && (
            <div
              className="absolute inset-0 z-10 flex items-center justify-center rounded-[32px] bg-black/30"
              onClick={() => setShowBinnenkort(false)}
            >
              <div
                className="mx-6 rounded-2xl border border-[#EAEFEF] bg-white p-6 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-amber-50">
                  <ClipboardCheck className="size-5 text-amber-600" />
                </div>
                <h3 className="text-[15px] font-bold text-[#0E1111]">Binnenkort beschikbaar</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">
                  Deze functie is binnenkort beschikbaar. We werken hard aan het automatisch
                  genereren van documenten en het aanvragen van offertes.
                </p>
                <button
                  onClick={() => setShowBinnenkort(false)}
                  className="mt-4 w-full rounded-xl bg-[#0E1111] px-4 py-2.5 text-[13px] font-semibold text-white transition-shadow hover:shadow-md"
                >
                  Begrepen
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}

/* ─── Compact Item Row (click to open modal) ─────────────────── */

interface CompactRowProps {
  item: ChecklistItem
  checked: boolean
  docStatus?: ChecklistItemDocStatus
  uploadedDocId?: string
  parcelId?: string | null
  onToggle: (id: string) => void
  onOpen: (item: ChecklistItem) => void
  itemLinks?: ChecklistItemLinks
  currentUserId?: string
}

function CompactItemRow({ item, checked, docStatus, uploadedDocId, parcelId, onToggle, onOpen, itemLinks, currentUserId }: CompactRowProps) {
  const isGenerated = docStatus?.status === 'generated'
  const hasDocument = isGenerated || !!uploadedDocId
  const documentId = docStatus?.document_id ?? uploadedDocId
  const { accessToken } = useAuth()
  const [pdfViewer, setPdfViewer] = useState<{ url: string; title: string } | null>(null)

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!parcelId || !documentId) return
    const url = `${import.meta.env.VITE_API_URL ?? ''}/api/documents/${parcelId}/documents/${documentId}`
    fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((res) => res.blob())
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = blobUrl
        a.download = docStatus?.filename ?? `${item.id}.pdf`
        a.click()
        URL.revokeObjectURL(blobUrl)
      })
  }

  const handleView = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!parcelId || !documentId) return
    const url = `${import.meta.env.VITE_API_URL ?? ''}/api/documents/${parcelId}/documents/${documentId}`
    setPdfViewer({ url, title: docStatus?.filename ?? 'Checklist document' })
  }

  return (
    <div className="flex items-center gap-3 border-b border-[#EAEFEF] last:border-b-0">
      {/* Checkbox — stops propagation so clicking it doesn't open the modal */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onToggle(item.id)
        }}
        className={`flex size-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
          checked || hasDocument
            ? 'border-amber-500 bg-amber-500 text-white'
            : 'border-slate-300 bg-white hover:border-slate-400'
        }`}
      >
        {(checked || hasDocument) && <Check className="size-3.5" strokeWidth={3} />}
      </button>

      {/* Clickable row → opens modal */}
      <button
        onClick={() => onOpen(item)}
        className="flex min-w-0 flex-1 items-center gap-2 py-3 text-left transition-colors hover:bg-[#FAFCFA] -mx-1 px-1 rounded-lg"
      >
        <div className="min-w-0 flex-1">
          <span className={`text-[12px] font-semibold ${checked || hasDocument ? 'text-slate-400 line-through' : 'text-[#0E1111]'}`}>
            {item.title}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!hasDocument && (
            item.required ? (
              <span className="rounded-full border border-aura-amber/30 bg-aura-amber/10 px-1.5 py-0 text-[10px] font-medium text-aura-amber-dark">
                Verplicht
              </span>
            ) : (
              <span className="rounded-full border border-[#EAEFEF] bg-[#F8FAFA] px-1.5 py-0 text-[10px] font-medium text-slate-500">
                Aanbevolen
              </span>
            )
          )}
          {hasDocument ? (
            <div className="flex items-center gap-1">
              <button
                onClick={handleView}
                className="flex size-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                title="Bekijk PDF"
              >
                <Eye className="size-3.5" />
              </button>
              <button
                onClick={handleDownload}
                className="flex size-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                title="Download PDF"
              >
                <Download className="size-3.5" />
              </button>
            </div>
          ) : (
            <ChevronRight className="size-3.5 text-slate-300" />
          )}
        </div>
      </button>
      <TeamAttributionBadge itemLinks={itemLinks} currentUserId={currentUserId} />
      {pdfViewer && (
        <PdfViewerDrawer
          url={pdfViewer.url}
          title={pdfViewer.title}
          onClose={() => setPdfViewer(null)}
        />
      )}
    </div>
  )
}

/* ─── Core ───────────────────────────────────────────────────── */

export function ChecklistCore({ useCases, parcelId }: ChecklistCoreProps) {
  const [selectedUseCase, setSelectedUseCase] = useState<string | null>(null)
  const [activeItem, setActiveItem] = useState<ChecklistItem | null>(null)

  // Default to the first offered use_case.
  const activeUseCase = selectedUseCase ?? useCases[0]?.id ?? null

  const { user } = useAuth()
  const { data: checklist, isLoading, error } = useChecklist(activeUseCase)
  const { data: progress } = useChecklistProgress(parcelId ?? undefined, activeUseCase)
  const { data: orgLinks } = useOrgChecklistLinks(parcelId ?? undefined)
  const { data: docStatus } = useChecklistDocuments(parcelId)
  const updateProgress = useUpdateChecklistProgress()
  const uploadDoc = useUploadDocument()

  const checkedSet = new Set(progress?.checked_items ?? [])

  const handleToggle = useCallback(
    (itemId: string) => {
      if (!parcelId || !activeUseCase) return
      const current = progress?.checked_items ?? []
      const next = current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId]
      updateProgress.mutate({
        parcelId,
        useCase: activeUseCase,
        checkedItems: next,
      })
    },
    [parcelId, activeUseCase, progress, updateProgress],
  )

  const handleUpload = useCallback(
    (itemId: string, file: File) => {
      if (!parcelId || !activeUseCase) return
      uploadDoc.mutate(
        { parcelId, documentType: 'checklist', file },
        {
          onSuccess: (doc) => {
            const currentChecked = progress?.checked_items ?? []
            const nextChecked = currentChecked.includes(itemId)
              ? currentChecked
              : [...currentChecked, itemId]
            const currentUploaded = progress?.uploaded_documents ?? {}
            updateProgress.mutate({
              parcelId,
              useCase: activeUseCase,
              checkedItems: nextChecked,
              uploadedDocuments: { ...currentUploaded, [itemId]: doc.id },
            })
          },
        },
      )
    },
    [parcelId, activeUseCase, progress, updateProgress, uploadDoc],
  )

  // No use_case offered (caller resolved nothing).
  if (useCases.length === 0) {
    return (
      <SectionInsightCard kicker="Voorbereiding" title="Haalbaarheidschecklist" Icon={ClipboardCheck}>
        <p className="text-[12px] text-slate-400">
          Geen use-case beschikbaar voor dit perceel.
        </p>
      </SectionInsightCard>
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <SectionInsightCard kicker="Voorbereiding" title="Haalbaarheidschecklist" Icon={ClipboardCheck}>
        <div className="flex items-center gap-2 py-4">
          <Loader2 className="size-4 animate-spin text-slate-400" />
          <p className="text-[12px] text-slate-400">Checklist laden…</p>
        </div>
      </SectionInsightCard>
    )
  }

  // Error state
  if (error || !checklist || checklist.items.length === 0) {
    return (
      <SectionInsightCard kicker="Voorbereiding" title="Haalbaarheidschecklist" Icon={ClipboardCheck}>
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
          <p className="text-[12px] text-slate-500">
            {error
              ? `Kon checklist niet laden: ${error.message}`
              : `Geen checklist beschikbaar voor "${USE_CASE_LABELS[activeUseCase!] ?? activeUseCase}".`}
          </p>
        </div>
      </SectionInsightCard>
    )
  }

  const phases = checklist.phases ?? []
  const groups = groupByPhase(checklist.items, phases)
  const generatedIds = new Set(
    Object.entries(docStatus?.items ?? {})
      .filter(([, v]) => v.status === 'generated')
      .map(([k]) => k),
  )
  const uploadedIds = new Set(Object.keys(progress?.uploaded_documents ?? {}))
  const totalChecked = checklist.items.filter(
    (i) => checkedSet.has(i.id) || generatedIds.has(i.id) || uploadedIds.has(i.id),
  ).length
  const totalItems = checklist.items.length

  const showToggle = useCases.length > 1

  return (
    <div className="space-y-4">
      {/* ── Strategy toggle (only with 2+ use_cases) + progress ── */}
      <div className="flex items-center gap-4">
        {showToggle ? (
          <div className="flex h-[44px] min-w-0 flex-1 rounded-full bg-[#F2F6F3] p-1">
            {useCases.map((uc) => {
              const isActive = uc.id === activeUseCase
              return (
                <button
                  key={uc.id}
                  onClick={() => setSelectedUseCase(uc.id)}
                  className="relative flex-1 h-full rounded-full flex items-center justify-center transition-colors"
                  style={{
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    fontSize: '12px',
                    fontWeight: isActive ? 700 : 600,
                    color: isActive ? undefined : '#94a3b8',
                  }}
                >
                  {isActive && (
                    <motion.div
                      layoutId="checklist-strategy-tab"
                      className="absolute inset-0 rounded-full bg-[#0E1111]"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span className={`relative z-10 ${isActive ? 'text-white' : ''}`}>
                    {USE_CASE_LABELS[uc.id] ?? uc.label}
                  </span>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="min-w-0 flex-1">
            <span className="inline-flex h-[34px] items-center rounded-full bg-[#0E1111] px-4 text-[12px] font-bold text-white">
              {USE_CASE_LABELS[activeUseCase!] ?? useCases[0]?.label}
            </span>
          </div>
        )}

        {/* Progress */}
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-[16px] font-bold tabular-nums text-[#0E1111]">
            {totalChecked}<span className="text-[12px] font-normal text-slate-400">/{totalItems}</span>
          </span>
          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-amber-500 transition-all"
              style={{ width: `${totalItems > 0 ? (totalChecked / totalItems) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Phased checklist — compact rows ───────────────────── */}
      {Array.from(groups.entries()).map(([phase, items]) => {
        const phaseChecked = items.filter(
          (i) => checkedSet.has(i.id) || generatedIds.has(i.id) || uploadedIds.has(i.id),
        ).length

        return (
          <SectionInsightCard
            key={phase}
            kicker={`Fase · ${phaseChecked}/${items.length}`}
            title={PHASE_LABELS[phase] ?? phase}
            Icon={ClipboardCheck}
          >
            {/* Phase progress bar */}
            <div className="mb-3 h-1 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-amber-400 transition-all"
                style={{ width: `${items.length > 0 ? (phaseChecked / items.length) * 100 : 0}%` }}
              />
            </div>

            <div>
              {items.map((item) => (
                <CompactItemRow
                  key={item.id}
                  item={item}
                  checked={checkedSet.has(item.id)}
                  docStatus={docStatus?.items[item.id]}
                  uploadedDocId={progress?.uploaded_documents?.[item.id]}
                  parcelId={parcelId}
                  onToggle={handleToggle}
                  onOpen={setActiveItem}
                  itemLinks={activeUseCase ? orgLinks?.[activeUseCase as keyof ChecklistLinksBundle]?.[item.id] : undefined}
                  currentUserId={user?.id}
                />
              ))}
            </div>
          </SectionInsightCard>
        )
      })}

      {/* ── Item detail modal ─────────────────────────────────── */}
      {activeItem && (
        <ItemDetailModal
          item={activeItem}
          checked={checkedSet.has(activeItem.id)}
          onClose={() => setActiveItem(null)}
          onToggle={handleToggle}
          onUpload={handleUpload}
          isUploading={uploadDoc.isPending}
        />
      )}
    </div>
  )
}
