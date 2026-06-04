/**
 * SamenvattingPhaseView — fase-4 "Acquisitie-samenvatting & overdracht".
 *
 * Mounted by `routes/_authenticated/opgeslagen.perceel.$parcelId.$phase.tsx`
 * when `phase === '4-samenvatting'`. Dit is het sluitstuk van de demo-lifecycle:
 * Onderzoek → Contact → Voorbereiding → Samenvatting. Vanaf hier loopt het
 * verder in Realworks (M052/S07 lock, UAT 2026-05-29 — Propdex = voortraject only).
 *
 * Faithful rebuild van de gelockte Summary.html (frame-v3.css §"Summary / overdracht"):
 *   1. Acquisitie-samenvatting card — GO/NO-GO verdict (.verdict) + onderzoeksresultaten
 *      (.A-list verdict-rows, dezelfde styling als EigendomssituatieCard).
 *   2. Dossier card — parcel-documenten (.dosgrid docpills) + "gaat mee naar Realworks".
 *   3. Handoff card — obsidian .handoff met REALWORKS-badge + gated mock-knop.
 *
 * Deelt de workspace-shell met fase 1-3: dezelfde ResultsShell (max-w-5xl centered)
 * + dezelfde ParcelWorkspaceHeader (mirror ContactPhaseView / HaalbaarheidPhaseView).
 *
 * Data (GEEN gefabriceerde cijfers — alles uit echte bronnen, graceful fallbacks):
 *   - useParcelFavorites(): potentie_score / risico_score / project_type / address
 *     / has_report / report_id (workspace-header + verdict + transformatie-rij bron).
 *   - useBrkRecords(parcelId): eigenaar-record → Eigenaar (BRK)-rij; ontbreekt → neutraal.
 *   - useParcelEnrichment(parcel_cache_id): WOZ Waardeloket (evidence in samenvatting).
 *   - useParcelDocuments(parcelId): dossier-lijst; leeg → rapport als enige dossier-item.
 *
 * De Realworks-push is een GATED MOCK (B8 = post-deal, geen Realworks-API): de knop
 * is gegate op user?.hauzer_demo en toont na klik een bevestigingsstate. Geen backend.
 */
import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  ArrowRight,
  FileText,
  Download,
  ExternalLink,
  Check,
} from 'lucide-react'
import ResultsShell from '@/components/layout/ResultsShell'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ParcelWorkspaceHeader } from '@/components/cockpit/ParcelWorkspaceHeader'
import { PotentieModal, RisicoModal } from '@/components/projects/ScoreDetailModal'
import { useParcelFavorites } from '@/hooks/useFavorites'
import { useParcelEnrichment } from '@/hooks/useScans'
import { useBrkRecords } from '@/hooks/useBrkRecords'
import { useParcelDocuments } from '@/hooks/useDocuments'
import { useHauzerDemo } from '@/hooks/useHauzerDemo'
import { PROJECT_TYPE_LABELS, type ProjectType } from '@/lib/types/projectType'
import type { FavoriteResponse } from '@/lib/types/portfolio'
import type { BRKOwnershipRecordRead } from '@/lib/types/brk'

// ============================================================================
// Pure derivations — exported for unit tests, sourced exclusively from real data
// ============================================================================

export type Accent = 'ok' | 'warn' | 'neutral'

export interface AcquisitieVerdict {
  /** Korte badge-tekst: "GO" / "AFWEGEN" / "—" als scores ontbreken. */
  badge: string
  badgeAccent: Accent
  /** Kop boven de samenvatting. */
  kicker: string
  /** Eén-regel titel. */
  title: string
  /** Samenvattende zin (data-driven). */
  summary: string
}

/**
 * Verdict-heuristiek uit ECHTE scan-scores (potentie/risico op de favorite).
 *   hoge potentie (≥60) + beheersbaar risico (≤45)  → GO  "Hoge potentie, beheersbaar risico"
 *   hoge potentie + hoog risico (>45)                → GO met kanttekening
 *   lage potentie                                    → AFWEGEN
 *   geen scores                                      → neutrale fallback, niets verzonnen
 */
export function deriveAcquisitieVerdict(
  favorite: Pick<FavoriteResponse, 'potentie_score' | 'risico_score' | 'project_type'>,
): AcquisitieVerdict {
  const pot = favorite.potentie_score
  const ris = favorite.risico_score
  const typeLabel =
    favorite.project_type && favorite.project_type in PROJECT_TYPE_LABELS
      ? PROJECT_TYPE_LABELS[favorite.project_type as ProjectType]
      : null

  // Geen scores → niets fabriceren.
  if (pot === null || pot === undefined) {
    return {
      badge: '—',
      badgeAccent: 'neutral',
      kicker: 'Voortraject in beeld',
      title: typeLabel ? `${typeLabel} · scores nog niet bekend` : 'Scores nog niet bekend',
      summary:
        'Nog geen scan-scores beschikbaar voor dit perceel. Het dossier kan al worden samengesteld en overgedragen; de afweging volgt zodra de scoring binnen is.',
    }
  }

  const hogePotentie = pot >= 60
  const beheersbaarRisico = ris === null || ris === undefined || ris <= 45
  const typePrefix = typeLabel ? `${typeLabel} ` : ''

  if (hogePotentie && beheersbaarRisico) {
    return {
      badge: 'GO',
      badgeAccent: 'ok',
      kicker: 'Ontwikkelkans bevestigd',
      title: `${typePrefix}haalbaar · sterke positie`.trim(),
      summary:
        'Hoge potentie, beheersbaar risico. Het voortraject is afgerond en het dossier is compleet voor overdracht naar Realworks.',
    }
  }

  if (hogePotentie && !beheersbaarRisico) {
    return {
      badge: 'GO',
      badgeAccent: 'warn',
      kicker: 'Kansrijk met aandachtspunten',
      title: `${typePrefix}kansrijk · risico beheersen`.trim(),
      summary:
        'Sterke ontwikkelpotentie, maar het risicoprofiel vraagt aandacht. Neem de aandachtspunten mee in de afweging vóór overdracht.',
    }
  }

  return {
    badge: 'AFWEGEN',
    badgeAccent: 'warn',
    kicker: 'Beperkte potentie',
    title: `${typePrefix}afweging nodig`.trim(),
    summary:
      'De potentie ligt onder de drempel die we als kansrijk beschouwen. Weeg af of het dossier nu al wordt overgedragen of dat aanvullend onderzoek loont.',
  }
}

export interface ResultRow {
  accent: Accent
  label: string
  verdict: string
  evidence: string
  /** Doel van de "Bekijk X"-link; null = inerte rij (geen link). */
  link: { label: string; kind: 'rapport' | 'scores' | 'inert' } | null
}

/**
 * Onderzoeksresultaten-rijen, ELK uit echte data afgeleid; ontbrekende data →
 * neutrale "onbekend"-rij (nooit verzonnen).
 *   - Transformatie     ← potentie/risico-scores
 *   - Bestemmingsplan   ← rapport aanwezig (has_report) als bron-indicatie
 *   - Woonvisie         ← rapport aanwezig
 *   - Constructief      ← rapport aanwezig (heuristiek: aandachtspunt)
 *   - Energie & milieu  ← rapport aanwezig
 *   - Eigenaar (BRK)    ← persisted BRK-record (anders neutraal)
 */
export function deriveResultRows(
  favorite: Pick<FavoriteResponse, 'potentie_score' | 'risico_score' | 'has_report'>,
  brkRecord: BRKOwnershipRecordRead | null,
): ResultRow[] {
  const rows: ResultRow[] = []
  const pot = favorite.potentie_score
  const ris = favorite.risico_score
  const hasReport = favorite.has_report

  // 1. Transformatie — uit de scores zelf.
  if (pot !== null && pot !== undefined) {
    const hoog = pot >= 60
    const risText = ris !== null && ris !== undefined ? ` / risico ${ris}` : ''
    rows.push({
      accent: hoog ? 'ok' : 'neutral',
      label: 'Transformatie',
      verdict: hoog ? 'Hoog' : 'Gemiddeld',
      evidence: `${hoog ? 'Verticale verdichting kansrijk' : 'Potentie onder de drempel'} · potentie ${pot}${risText}`,
      link: { label: 'Bekijk scores', kind: 'scores' },
    })
  } else {
    rows.push({
      accent: 'neutral',
      label: 'Transformatie',
      verdict: 'Onbekend',
      evidence: 'Nog geen scan-scores beschikbaar voor dit perceel.',
      link: null,
    })
  }

  // 2. Bestemmingsplan — bron-indicatie: in het rapport vastgelegd.
  rows.push({
    accent: hasReport ? 'ok' : 'neutral',
    label: 'Bestemmingsplan',
    verdict: hasReport ? 'In rapport' : 'Onbekend',
    evidence: hasReport
      ? 'Bestemming en bouwregels vastgelegd in het gegenereerde rapport.'
      : 'Geen rapport beschikbaar — bestemmingsplan-toetsing nog niet vastgelegd.',
    link: hasReport ? { label: 'In rapport', kind: 'rapport' } : null,
  })

  // 3. Woonvisie — bron-indicatie via rapport.
  rows.push({
    accent: hasReport ? 'ok' : 'neutral',
    label: 'Woonvisie',
    verdict: hasReport ? 'In rapport' : 'Onbekend',
    evidence: hasReport
      ? 'Aansluiting op de gemeentelijke woonvisie beoordeeld in het rapport.'
      : 'Geen rapport beschikbaar — woonvisie-match nog niet beoordeeld.',
    link: hasReport ? { label: 'In rapport', kind: 'rapport' } : null,
  })

  // 4. Constructief — heuristiek: altijd aandachtspunt bij transformatie/optoppen.
  rows.push({
    accent: hasReport ? 'warn' : 'neutral',
    label: 'Constructief',
    verdict: hasReport ? 'Aandachtspunt' : 'Onbekend',
    evidence: hasReport
      ? 'Constructieve haalbaarheid is locatiespecifiek — laat dit vóór verwerving toetsen.'
      : 'Geen rapport beschikbaar — constructieve toets nog niet uitgevoerd.',
    link: hasReport ? { label: 'Naar checklist', kind: 'inert' } : null,
  })

  // 5. Energie & milieu — bron-indicatie via rapport.
  rows.push({
    accent: hasReport ? 'ok' : 'neutral',
    label: 'Energie & milieu',
    verdict: hasReport ? 'In rapport' : 'Onbekend',
    evidence: hasReport
      ? 'Energielabel, bodem- en milieusignalen opgenomen in het rapport.'
      : 'Geen rapport beschikbaar — energie- en milieusignalen nog niet vastgelegd.',
    link: hasReport ? { label: 'In rapport', kind: 'rapport' } : null,
  })

  // 6. Eigenaar (BRK) — uit het persisted record; anders neutraal.
  if (brkRecord) {
    const naam = brkRecord.eigenaar_naam ?? 'Eigenaar bekend'
    const sinds = brkRecord.koopjaar ? ` · in bezit sinds ${brkRecord.koopjaar}` : ''
    rows.push({
      accent: 'neutral',
      label: 'Eigenaar (BRK)',
      verdict: 'Bekend',
      evidence: `${naam}${sinds} · vastgelegd via Kadaster (BRK-bevragen).`,
      link: { label: 'Bekijk eigenaar', kind: 'inert' },
    })
  } else {
    rows.push({
      accent: 'neutral',
      label: 'Eigenaar (BRK)',
      verdict: 'Onbekend',
      evidence:
        'Geen BRK-eigenaarsrecord opgehaald — haal de eigenaar op in de Contact-fase.',
      link: null,
    })
  }

  return rows
}

// ============================================================================
// Component
// ============================================================================

export interface SamenvattingPhaseViewProps {
  parcelId: string
}

const ACCENT_BAR: Record<Accent, string> = {
  ok: 'bg-aura-green',
  warn: 'bg-aura-amber',
  neutral: 'bg-slate-300',
}
const VERDICT_TEXT: Record<Accent, string> = {
  ok: 'text-[#0f8a5f]',
  warn: 'text-[#B45309]',
  neutral: 'text-aura-ink',
}

export function SamenvattingPhaseView({ parcelId }: SamenvattingPhaseViewProps) {
  const navigate = useNavigate()
  const favoritesQuery = useParcelFavorites()
  const { data: brkRecords } = useBrkRecords(parcelId)
  const { data: documentsData } = useParcelDocuments(parcelId)
  const isHauzerDemo = useHauzerDemo()
  const [scoreModal, setScoreModal] = useState<'potentie' | 'risico' | null>(null)
  const [handoffSent, setHandoffSent] = useState(false)

  const favorite = useMemo(
    () => favoritesQuery.data?.find((f) => f.parcel_id === parcelId),
    [favoritesQuery.data, parcelId],
  )

  // WOZ uit dezelfde enrichment-bron als de EigenaarCard (keyt op parcel_cache_id).
  const enrichmentQuery = useParcelEnrichment(favorite?.parcel_cache_id ?? null)

  const handleClose = () => void navigate({ to: '/opgeslagen', search: { stage: undefined } })
  const handleOpenMap = () => void navigate({ to: '/map' })
  const openRapport = () => {
    if (favorite?.has_report && favorite.report_id) {
      void navigate({ to: '/rapport/$id', params: { id: favorite.report_id } })
    }
  }

  // Favorite-loading shell — matches the Contact/Haalbaarheid route's skeleton.
  if (favoritesQuery.isLoading) {
    return (
      <ResultsShell>
        <div className="h-screen w-full animate-pulse bg-white/40 rounded-[24px]" />
      </ResultsShell>
    )
  }

  if (!favorite) {
    return (
      <ResultsShell>
        <EmptyState
          title="Perceel niet gevonden"
          description="Dit perceel staat niet in je opgeslagen lijst. Terug naar Onderzoek om het opnieuw te openen."
          action={{ label: 'Terug naar Onderzoek', onClick: handleClose }}
        />
      </ResultsShell>
    )
  }

  const primaryBrk = brkRecords?.[0] ?? null
  const verdict = deriveAcquisitieVerdict(favorite)
  const rows = deriveResultRows(favorite, primaryBrk)
  const documents = documentsData?.documents ?? []
  const wozData = enrichmentQuery.data?.woz_data ?? null

  // Verdict-card achtergrond per accent.
  const verdictBox =
    verdict.badgeAccent === 'ok'
      ? 'bg-[#ECFDF5] border-[#A7F3D0]'
      : verdict.badgeAccent === 'warn'
        ? 'bg-aura-amber/[0.07] border-aura-amber/30'
        : 'bg-white/60 border-white/70'
  const badgeRing =
    verdict.badgeAccent === 'ok'
      ? 'border-aura-green text-[#059669]'
      : verdict.badgeAccent === 'warn'
        ? 'border-aura-amber text-[#B45309]'
        : 'border-slate-300 text-slate-500'

  const handleRowLink = (kind: 'rapport' | 'scores' | 'inert') => {
    if (kind === 'rapport') openRapport()
    if (kind === 'scores') setScoreModal('potentie')
    // 'inert' — bewust nog niet bedraad (mockup-pariteit).
  }

  return (
    <ResultsShell>
      <div className="pb-8">
        <ParcelWorkspaceHeader
          favorite={favorite}
          onBack={handleClose}
          onOpenMap={handleOpenMap}
          onScoreClick={setScoreModal}
        />

        {/* ── Card 1: Acquisitie-samenvatting (verdict + onderzoeksresultaten) ── */}
        <div className="bg-white/60 backdrop-blur-[24px] border border-white/50 rounded-[24px] px-[26px] py-6 mb-4 shadow-[0_1px_2px_rgba(14,17,17,0.03),0_8px_24px_rgba(14,17,17,0.04)]">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[16px] font-bold text-aura-ink">Acquisitie-samenvatting</h2>
            <span className="text-[13px] font-bold text-aura-ink">Voortraject afgerond</span>
          </div>

          {/* verdict */}
          <div
            className={`mt-[18px] flex items-center gap-[18px] rounded-[20px] border px-6 py-5 ${verdictBox}`}
          >
            <div
              className={`flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-full border-2 bg-white text-[15px] font-extrabold ${badgeRing}`}
            >
              {verdict.badge}
            </div>
            <div className="min-w-0 flex-1">
              <div
                className={`text-[11px] font-bold uppercase tracking-[0.08em] ${
                  verdict.badgeAccent === 'ok' ? 'text-[#059669]' : VERDICT_TEXT[verdict.badgeAccent]
                }`}
              >
                {verdict.kicker}
              </div>
              <div className="mt-0.5 text-[21px] font-extrabold tracking-[-0.02em] text-aura-ink">
                {verdict.title}
              </div>
              <div className="mt-[3px] text-[13px] leading-[1.45] text-slate-600">
                {verdict.summary}
              </div>
            </div>
            {wozData?.meest_recente_waarde ? (
              <div className="shrink-0 text-right">
                <div className="text-[11px] font-semibold text-slate-500">WOZ-waarde</div>
                <div className="text-[22px] font-extrabold tracking-[-0.02em] text-aura-ink">
                  {`€ ${Math.round(wozData.meest_recente_waarde).toLocaleString('nl-NL')}`}
                </div>
                <div className="text-[11px] text-slate-400">Waardeloket</div>
              </div>
            ) : null}
          </div>

          {/* onderzoeksresultaten — A-list verdict-rows (zelfde styling als EigendomssituatieCard) */}
          <span className="mt-6 block text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
            Onderzoeksresultaten
          </span>
          <div className="mt-2.5">
            {rows.map((row, i) => (
              <div
                key={row.label}
                className={`flex items-center gap-[18px] px-0.5 py-[15px] ${
                  i === 0 ? '' : 'border-t border-black/[0.07]'
                }`}
              >
                <span
                  className={`w-[3px] self-stretch shrink-0 rounded-[2px] ${ACCENT_BAR[row.accent]}`}
                />
                <div
                  className={`w-[165px] shrink-0 text-[17px] font-extrabold leading-[1.15] tracking-[-0.01em] ${VERDICT_TEXT[row.accent]}`}
                >
                  <span className="mb-px block text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                    {row.label}
                  </span>
                  {row.verdict}
                </div>
                <div className="min-w-0 flex-1 text-[13.5px] leading-[1.5] text-slate-600">
                  {row.evidence}
                </div>
                {row.link && (
                  <button
                    type="button"
                    onClick={() => handleRowLink(row.link!.kind)}
                    className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-transparent px-[13px] py-[7px] text-[12px] font-semibold text-aura-amber-hover transition-colors hover:border-aura-amber/40 hover:bg-aura-amber/[0.08]"
                  >
                    {row.link.label} <ArrowRight size={13} strokeWidth={1.8} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Card 2: Dossier ── */}
        <DossierCard
          documents={documents}
          hasReport={favorite.has_report}
          onOpenRapport={openRapport}
        />

        {/* ── Card 3: Handoff naar Realworks (gated mock) ── */}
        <div className="mt-4 flex items-center gap-[18px] rounded-[20px] bg-aura-obsidian px-6 py-[22px] text-white">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-[9px] text-[16px] font-bold">
              Klaar voor overdracht
              <span className="rounded-md bg-white/[0.14] px-[7px] py-[3px] text-[11px] font-bold tracking-[0.02em]">
                REALWORKS
              </span>
            </div>
            <div className="mt-[5px] text-[12.5px] leading-[1.5] text-white/[0.62]">
              Het complete dossier · eigenaar, documenten, scores en samenvatting · wordt als
              relatie + object aangemaakt in Realworks. Daar verloopt verder contact, bod en
              transactie.
            </div>
          </div>
          {/* GATED MOCK — alleen voor de Hauzer-demo-org. De echte Realworks-push (B8)
              is post-deal; die backend-call swapt hier in zodra de integratie live is. */}
          {isHauzerDemo &&
            (handoffSent ? (
              <div className="inline-flex h-12 shrink-0 items-center gap-[9px] whitespace-nowrap rounded-full bg-aura-green px-6 text-[14px] font-bold text-white">
                <Check size={17} strokeWidth={2.2} />
                Dossier naar Realworks gestuurd
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setHandoffSent(true)}
                className="inline-flex h-12 shrink-0 items-center gap-[9px] whitespace-nowrap rounded-full bg-aura-amber px-6 text-[14px] font-bold text-aura-obsidian transition-colors hover:bg-aura-amber-hover"
              >
                Stuur dossier naar Realworks
                <ExternalLink size={17} strokeWidth={1.8} />
              </button>
            ))}
        </div>
      </div>

      <PotentieModal
        open={scoreModal === 'potentie'}
        onClose={() => setScoreModal(null)}
        parcelCacheId={favorite.parcel_cache_id}
      />
      <RisicoModal
        open={scoreModal === 'risico'}
        onClose={() => setScoreModal(null)}
        parcelCacheId={favorite.parcel_cache_id}
      />
    </ResultsShell>
  )
}

// ============================================================================
// Dossier card
// ============================================================================

interface DossierItem {
  name: string
  source: string
}

function DossierCard({
  documents,
  hasReport,
  onOpenRapport,
}: {
  documents: { id: string; filename: string; uploaded_at: string }[]
  hasReport: boolean
  onOpenRapport: () => void
}) {
  // Echte documenten als dossier-items; leeg → het gegenereerde rapport als enige item.
  const items: DossierItem[] = documents.map((d) => ({
    name: d.filename,
    source: 'Geüpload',
  }))
  const showReportFallback = items.length === 0 && hasReport
  if (showReportFallback) {
    items.push({ name: 'Propdex-rapport.pdf', source: 'Gegenereerd' })
  }

  const count = items.length

  return (
    <div className="bg-white/60 backdrop-blur-[24px] border border-white/50 rounded-[24px] px-[26px] py-6 mb-4 shadow-[0_1px_2px_rgba(14,17,17,0.03),0_8px_24px_rgba(14,17,17,0.04)]">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[16px] font-bold text-aura-ink">Dossier</h2>
        <span className="text-[13px] font-bold text-aura-ink">
          {count === 0
            ? 'Nog geen documenten'
            : `${count} ${count === 1 ? 'document' : 'documenten'} · gaat mee naar Realworks`}
        </span>
      </div>

      {count === 0 ? (
        <p className="mt-[18px] text-[13.5px] leading-[1.5] text-slate-500">
          Er staan nog geen documenten in het dossier. Upload stukken in de Voorbereiding-fase of
          genereer een rapport; ze gaan automatisch mee bij de overdracht naar Realworks.
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          {items.map((item, i) => (
            <button
              key={`${item.name}-${i}`}
              type="button"
              onClick={item.source === 'Gegenereerd' ? onOpenRapport : undefined}
              className="flex w-full items-center gap-2.5 rounded-xl border border-[#EAEFEF] bg-white py-[7px] pl-2.5 pr-2 text-left transition-colors hover:border-slate-300"
            >
              <span className="flex h-[30px] w-[26px] shrink-0 items-center justify-center rounded-[5px] border border-[#F7D4D4] bg-[#FDECEC] text-[7px] font-extrabold tracking-[0.02em] text-[#D14343]">
                PDF
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-semibold leading-[1.1] text-aura-ink">
                  {item.name}
                </span>
                <span className="block text-[11px] leading-[1.1] text-slate-400">
                  {item.source}
                </span>
              </span>
              <span className="ml-0.5 flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-[#F4F6F6]">
                {item.source === 'Gegenereerd' ? (
                  <FileText size={15} strokeWidth={1.7} className="text-slate-600" />
                ) : (
                  <Download size={15} strokeWidth={1.7} className="text-slate-600" />
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
