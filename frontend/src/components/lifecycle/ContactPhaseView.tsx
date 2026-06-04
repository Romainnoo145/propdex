/**
 * ContactPhaseView — fase-2 (Contact) top-level view.
 *
 * Mounted by `routes/_authenticated/opgeslagen.perceel.$parcelId.$phase.tsx`
 * when `phase === '2-contact'`.
 *
 * Rebuilt to FAITHFULLY match the locked Contact.html mockup (three cards):
 *   1. EigenaarCard          — "Eigendom & eigenaar" (ownerhero + 4-tile bidgrid + privacy-note)
 *   2. EigendomssituatieCard — "Eigendomssituatie" (A-list verwervings-aandachtspunten)
 *   3. BriefLetterCard       — "Persoonlijke brief" (.brief2 two-column: acties | letter)
 *
 * Data:
 *   - useBrkRecords(parcelId): persisted rechtspersoon/overheid records (AVG-stripped).
 *   - records[0] drives the eigenaar + eigendomssituatie cards; brief auto-mode.
 *   - No record (particulier / not fetched) → BrkPersistPanel CTA state; the brief
 *     card falls back to manual NAW-input mode.
 *   - RescoreProgressBanner: gated on (pollStartAt !== null && hasRecords) per AD3.
 *
 * Back-link to /opgeslagen/perceel/$parcelId (fase 1, Onderzoek).
 * Aura tokens per DESIGN.md: ResultsShell wrap, Pure Glass cards inside.
 */
import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, Mail } from 'lucide-react'
import ResultsShell from '@/components/layout/ResultsShell'
import { useBrkRecords } from '@/hooks/useBrkRecords'
import { BrkPersistPanel } from './BrkPersistPanel'
import { RescoreProgressBanner } from './RescoreProgressBanner'
import { EigenaarCard } from './EigenaarCard'
import { EigendomssituatieCard } from './EigendomssituatieCard'
import { BriefLetterCard } from './BriefLetterCard'

// ============================================================================
// Pure dispatcher derivation — exported for unit tests
// ============================================================================

export interface ContactDispatchInput {
  isLoading: boolean
  hasRecords: boolean
  pollStartAt: number | null
}

export interface ContactDispatchView {
  showSkeleton: boolean
  showPersistPanel: boolean
  showRecordDisplay: boolean
  showRescoreBanner: boolean
}

/**
 * Pure branching logic for the ContactPhaseView render.
 *
 *   isLoading                                 → skeleton-only
 *   !isLoading && !hasRecords                 → persist-panel CTA (particulier/niet-opgehaald)
 *   !isLoading && hasRecords                  → 3 mockup cards (eigenaar / situatie / brief)
 *   !isLoading && hasRecords && pollStartAt   → rescore banner rendered (AD3)
 *
 * Note: with records present the persist-panel is hidden (the SUCCESS chip is
 * subsumed by the EigenaarCard "Bron: Kadaster" header), so showPersistPanel
 * means "show the standalone CTA/state panel" — only when there are no records.
 */
export function deriveContactDispatch(input: ContactDispatchInput): ContactDispatchView {
  const { isLoading, hasRecords, pollStartAt } = input
  return {
    showSkeleton: isLoading,
    showPersistPanel: !isLoading && !hasRecords,
    showRecordDisplay: !isLoading && hasRecords,
    showRescoreBanner: !isLoading && hasRecords && pollStartAt !== null,
  }
}

// ============================================================================
// Component
// ============================================================================

export interface ContactPhaseViewProps {
  parcelId: string
}

function SkeletonState() {
  return (
    <div className="space-y-4">
      <div className="h-24 w-full animate-pulse bg-white/40 rounded-[24px]" />
      <div className="h-32 w-full animate-pulse bg-white/40 rounded-[24px]" />
    </div>
  )
}

export function ContactPhaseView({ parcelId }: ContactPhaseViewProps) {
  const { data: records, isLoading } = useBrkRecords(parcelId)
  const [pollStartAt, setPollStartAt] = useState<number | null>(null)

  const recs = records ?? []
  const hasRecords = recs.length > 0
  const dispatch = deriveContactDispatch({ isLoading, hasRecords, pollStartAt })

  // record[0] = de primaire eigenaar (rechtspersoon/overheid) voor de auto-modus.
  const primary = recs[0] ?? null

  const onPersistSuccess = () => {
    setPollStartAt(Date.now())
  }

  return (
    <ResultsShell>
      <div className="px-6 pt-6 pb-12 max-w-3xl">
        {/* Back-link to fase 1 (Onderzoek) */}
        <Link
          to="/opgeslagen/perceel/$parcelId"
          params={{ parcelId }}
          search={{ stage: undefined }}
          className="inline-flex items-center gap-2 text-[13px] text-slate-500 hover:text-aura-ink mb-6"
        >
          <ArrowLeft size={14} strokeWidth={1.5} /> Terug naar Onderzoek
        </Link>

        {/* Phase header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/60 backdrop-blur-[24px] border border-white/40">
            <Mail size={22} strokeWidth={1.5} className="text-aura-amber" />
          </div>
          <div>
            <h1 className="text-[22px] font-semibold text-aura-ink">2. Contact</h1>
            <p className="text-[12px] text-slate-500">
              Eigendom-data + outreach voorbereiden
            </p>
          </div>
        </div>

        {dispatch.showSkeleton && <SkeletonState />}

        {dispatch.showRescoreBanner && pollStartAt !== null && (
          <RescoreProgressBanner parcelId={parcelId} pollStartAt={pollStartAt} />
        )}

        {/* Geen record (particulier / niet-opgehaald): BRK persist-CTA + state-machine. */}
        {dispatch.showPersistPanel && (
          <BrkPersistPanel
            parcelId={parcelId}
            records={recs}
            onPersistSuccess={onPersistSuccess}
          />
        )}

        {/* Record aanwezig: card 1 + 2 uit de gelockte mockup. */}
        {dispatch.showRecordDisplay && primary && (
          <>
            <EigenaarCard record={primary} />
            <EigendomssituatieCard record={primary} />
          </>
        )}

        {/* Card 3 — Persoonlijke brief (auto bij record, manual bij particulier). */}
        {!dispatch.showSkeleton && <BriefLetterCard parcelId={parcelId} record={primary} />}
      </div>
    </ResultsShell>
  )
}
