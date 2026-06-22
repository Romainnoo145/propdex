/**
 * BrkPersistPanel — fase-2 BRK persist CTA + 5-state machine.
 *
 * Renders the BRK fetch/persist trigger and per-state UX feedback:
 *   - IDLE    → CTA button "Vraag BRK eigendom op" (records empty + no mutation activity)
 *   - LOADING → spinner + disabled button (mutation isPending)
 *   - ERROR   → mapBrkError(status, detail) → title/body, retry button when retryable
 *   - EMPTY   → AD4 "Particuliere eigenaar" infoblok (success returned [] — AVG-stripped)
 *   - SUCCESS → confirmation chip; main display lives in BrkOwnerCard etc.
 *
 * Pure state derivation `derivePersistPanelState` is exported so unit tests in
 * the node-env unit project can pin behaviour without RTL — matches Plan 08-02
 * (deviation #2) precedent.
 *
 * Aura tokens per DESIGN.md: Pure Glass surfaces, Warm Amber CTA (intelligence),
 * Plus Jakarta Sans inherited.
 */
import { useCallback } from 'react'
import { Loader2, RefreshCw, FileSearch, AlertTriangle } from 'lucide-react'
import { usePersistBrk } from '@/hooks/usePersistBrk'
import { mapBrkError, type BrkErrorView } from '@/lib/brk/errorMapping'
import { ApiError } from '@/lib/api'
import type { BRKOwnershipRecordRead } from '@/lib/types/brk'

// ============================================================================
// Pure state-machine derivation — exported for tests
// ============================================================================

/**
 * Minimal mutation-shape needed to derive panel state.
 * Mirrors the relevant TanStack Query UseMutationResult fields; declared here
 * so tests don't depend on @tanstack/react-query types.
 */
export interface PersistPanelMutationView {
  isPending: boolean
  isError: boolean
  isSuccess: boolean
  error: Error | null
  errorStatus?: number
  errorDetail?: string | null
}

export type PersistPanelState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; view: BrkErrorView }
  | { kind: 'empty' }
  | { kind: 'success' }

/**
 * Pure 5-state machine derivation:
 *
 *   records.length === 0 && !pending && !error && !success → IDLE
 *   pending                                                → LOADING
 *   error                                                  → ERROR (mapped copy)
 *   success && records.length === 0                        → EMPTY (AD4)
 *   records.length > 0                                     → SUCCESS
 */
export function derivePersistPanelState(
  records: BRKOwnershipRecordRead[],
  mutation: PersistPanelMutationView,
): PersistPanelState {
  if (mutation.isPending) return { kind: 'loading' }
  if (mutation.isError) {
    return {
      kind: 'error',
      view: mapBrkError(mutation.errorStatus, mutation.errorDetail ?? null),
    }
  }
  if (records.length > 0) return { kind: 'success' }
  if (mutation.isSuccess) return { kind: 'empty' }
  return { kind: 'idle' }
}

// ============================================================================
// Component
// ============================================================================

export interface BrkPersistPanelProps {
  parcelId: string
  records: BRKOwnershipRecordRead[]
  onPersistSuccess?: () => void
}

export function BrkPersistPanel({
  parcelId,
  records,
  onPersistSuccess,
}: BrkPersistPanelProps) {
  const mutation = usePersistBrk(parcelId)

  const errorStatus = mutation.error instanceof ApiError ? mutation.error.status : undefined
  const errorDetail = mutation.error?.message ?? null

  const state = derivePersistPanelState(records, {
    isPending: mutation.isPending,
    isError: mutation.isError,
    isSuccess: mutation.isSuccess,
    error: mutation.error,
    errorStatus,
    errorDetail,
  })

  const handlePersist = useCallback(() => {
    mutation.mutate(undefined, {
      onSuccess: () => {
        onPersistSuccess?.()
      },
    })
  }, [mutation, onPersistSuccess])

  if (state.kind === 'loading') {
    return (
      <div className="bg-white/60 backdrop-blur-[24px] border border-slate-200 rounded-[24px] p-6 mb-4">
        <div className="flex items-center gap-3">
          <Loader2 size={20} strokeWidth={1.5} className="text-aura-amber animate-spin" />
          <p className="text-[14px] text-aura-ink font-medium">
            Kadaster BRK wordt opgehaald…
          </p>
        </div>
        <p className="text-[12px] text-slate-500 mt-2">
          Dit kan tot 30 seconden duren.
        </p>
      </div>
    )
  }

  if (state.kind === 'error') {
    return (
      <div className="bg-white/60 backdrop-blur-[24px] border border-slate-200 rounded-[24px] p-6 mb-4">
        <div className="flex items-start gap-3">
          <AlertTriangle size={20} strokeWidth={1.5} className="text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-[15px] font-semibold text-aura-ink mb-1">
              {state.view.title}
            </h3>
            <p className="text-[13px] text-slate-600 mb-3">{state.view.body}</p>
            {state.view.retryable && (
              <button
                type="button"
                onClick={handlePersist}
                disabled={mutation.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-aura-ink text-white text-[12px] font-medium hover:bg-black disabled:opacity-50"
              >
                <RefreshCw size={14} strokeWidth={1.5} />
                Opnieuw proberen
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (state.kind === 'empty') {
    return (
      <div className="bg-white/60 backdrop-blur-[24px] border border-slate-200 rounded-[24px] p-6 mb-4">
        <h3 className="text-[16px] font-semibold text-aura-ink mb-2">Particuliere eigenaar</h3>
        <p className="text-[13px] text-slate-600 mb-3">
          Dit perceel is in handen van een natuurlijk persoon. Per AVG worden persoonsgegevens
          van particulieren NIET opgeslagen door Propdex. Het Kadaster heeft de aanvraag verwerkt,
          maar de eigenaar-gegevens zijn gestript.
        </p>
        <p className="text-[13px] text-slate-600 mb-4">
          Outreach-suggestie: gebruik het BAG-adres voor brief-verzending of zoek de eigenaar
          via een makelaar/woningcorporatie als die het perceel beheert.
        </p>
        {/* TODO Plan 08-07: link naar brief-flow placeholder */}
      </div>
    )
  }

  if (state.kind === 'success') {
    return (
      <div className="bg-emerald-50/80 border border-emerald-100 rounded-[24px] p-5 mb-4 flex items-center gap-3">
        <FileSearch size={18} strokeWidth={1.5} className="text-emerald-600" />
        <p className="text-[13px] text-emerald-800 font-medium">
          BRK-eigendom opgehaald · {records.length} {records.length === 1 ? 'eigenaar' : 'eigenaars'}
        </p>
      </div>
    )
  }

  // IDLE — show CTA
  return (
    <div className="bg-white/60 backdrop-blur-[24px] border border-slate-200 rounded-[24px] p-6 mb-4">
      <h3 className="text-[16px] font-semibold text-aura-ink mb-2">BRK eigendom</h3>
      <p className="text-[13px] text-slate-600 mb-4">
        Vraag de huidige eigendom-gegevens op bij Kadaster BRK. Resultaat wordt opgeslagen en
        triggert een rescore van fase 1 (Onderzoek).
      </p>
      <button
        type="button"
        onClick={handlePersist}
        disabled={mutation.isPending}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-aura-amber text-aura-ink text-[13px] font-semibold hover:bg-aura-amber-hover disabled:opacity-50"
      >
        <FileSearch size={16} strokeWidth={1.5} />
        Vraag BRK eigendom op
      </button>
    </div>
  )
}
