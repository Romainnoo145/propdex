import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, FileText, Loader2, Scale } from 'lucide-react'
import { Skeleton } from '@/components/feedback/Skeleton'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { JuridischKlimaatCard } from '@/components/projects/JuridischKlimaatCard'
import { StatisticsBar } from '@/components/projects/StatisticsBar'
import { TrendTimeline } from '@/components/projects/TrendTimeline'
import {
  GeoRelevanceBadge,
  OUTCOME_STYLES,
  RulingAiSummaryBadge,
  formatDateLabel,
  formatRulingTitle,
  parseCourtFromTitle,
} from '@/components/projects/jurisprudenceShared'
import {
  useGemeenteAnalysis,
  useGemeenteRulingsFeed,
  useDoorlooptijdStats,
  useTrendData,
  useJurisprudenceDoc,
} from '@/hooks/useJurisprudence'

interface JuridischKlimaatModalContentProps {
  gemeenteNaam: string
}

function JurisprudentieViewer({
  ecli,
}: {
  ecli: string
}) {
  const { data, isLoading, isError, refetch } = useJurisprudenceDoc(ecli)

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="space-y-3 rounded-xl border border-neutral-200 bg-aura-glass-white/40 p-4">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-10/12" />
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-neutral-200 bg-aura-glass-white/60">
          <ErrorState
            message="Document kan niet worden geladen."
            actions={[{ label: 'Opnieuw proberen', onClick: () => refetch() }]}
            className="py-10"
          />
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-neutral-200 bg-aura-glass-white/40 p-4">
            <div className="min-w-0">
              <p className="text-label text-aura-amber/80">
                Uitsprakendetail
              </p>
              <div className="mt-1 flex items-center gap-2 text-sm font-medium text-aura-ink">
                <FileText className="h-4 w-4 shrink-0 text-neutral-500" />
                <span className="truncate">{ecli}</span>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {data?.document.instantie && (
                <span className="rounded-full border border-aura-amber/20 bg-aura-amber/10 px-2.5 py-1 text-xs font-medium text-aura-amber-dark">
                  {data.document.instantie}
                </span>
              )}
              {data?.document.datum_uitspraak && (
                <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-600">
                  {formatDateLabel(data.document.datum_uitspraak)}
                </span>
              )}
            </div>

            <div className="mt-3 space-y-2">
              <p className="text-sm leading-6 text-neutral-700">
                Jurisprudentie-document met de volledige uitspraaktekst en bronmetadata.
              </p>
              {data?.document.ecli && (
                <a
                  href={`https://uitspraken.rechtspraak.nl/details?id=${encodeURIComponent(data.document.ecli)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-aura-amber hover:text-aura-amber-hover"
                >
                  Open op Rechtspraak.nl
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-aura-glass-white/40 p-4">
            <div className="whitespace-pre-wrap text-sm leading-7 text-neutral-700">
              {data?.document.text || 'Document is leeg of inhoud werd afgeschermd.'}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export function JuridischKlimaatModalContent({ gemeenteNaam }: JuridischKlimaatModalContentProps) {
  const [selectedEcli, setSelectedEcli] = useState<string | null>(null)

  const { data: feedData, isLoading, isError, error, refetch } = useGemeenteRulingsFeed(gemeenteNaam)
  const { analysis: analysisResult, isAnalyzing } = useGemeenteAnalysis(
    gemeenteNaam,
    !!(feedData?.rulings?.length),
  )
  const { data: doorlooptijdData } = useDoorlooptijdStats(gemeenteNaam)
  const { data: trendData, isLoading: isTrendLoading } = useTrendData(gemeenteNaam)

  const rulings = feedData?.rulings ?? []
  const feedErrorMessage = error instanceof Error ? error.message : 'Onbekende fout'
  const selectedRuling = useMemo(
    () => rulings.find((r) => r.ecli === selectedEcli) ?? rulings[0] ?? null,
    [rulings, selectedEcli],
  )

  useEffect(() => {
    setSelectedEcli(null)
  }, [gemeenteNaam])

  useEffect(() => {
    if (!selectedEcli && rulings.length > 0) {
      setSelectedEcli(rulings[0]!.ecli)
    }
    if (selectedEcli && !rulings.some((r) => r.ecli === selectedEcli)) {
      setSelectedEcli(rulings[0]?.ecli ?? null)
    }
  }, [rulings, selectedEcli])

  const isPending = feedData?.ingestion_status === 'pending'
  const isRefreshing = feedData?.ingestion_status === 'refreshing'
  const succeskans = analysisResult?.vergunnings_succeskans ?? null
  const aantalUitspraken = feedData?.count ?? 0
  const actieveTijdlijn = trendData?.months?.length ?? 0

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-neutral-200 bg-aura-glass-white/60 px-4 py-3">
          <p className="text-label text-neutral-500">
            Uitspraken
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-aura-ink tabular-nums">
            {aantalUitspraken}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-aura-glass-white/60 px-4 py-3">
          <p className="text-label text-neutral-500">
            Winkans bezwaar
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-aura-amber-dark tabular-nums">
            {succeskans != null ? `${Math.round(succeskans)}%` : '—'}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-aura-glass-white/60 px-4 py-3">
          <p className="text-label text-neutral-500">
            Trend
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-aura-ink tabular-nums">
            {actieveTijdlijn > 0 ? `${actieveTijdlijn}` : '—'}
          </p>
        </div>
      </div>

      {(feedData?.win_loss || isAnalyzing) && (
        <JuridischKlimaatCard
          isLoading={isAnalyzing && !feedData?.win_loss}
          doorlooptijd={doorlooptijdData ?? null}
          winLoss={feedData?.win_loss ?? null}
          analyzedCount={analysisResult?.analyzed_count}
          totalCount={analysisResult?.total_count}
          pendingCount={analysisResult?.pending_count}
        />
      )}

      {isTrendLoading ? (
        <div className="rounded-xl border border-neutral-200 bg-aura-glass-white/60 p-4">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="mt-4 h-20 w-full" />
        </div>
      ) : trendData ? (
        <div className="space-y-4 rounded-xl border border-neutral-200 bg-aura-glass-white/60 p-4">
          <StatisticsBar summary={trendData.summary} />
          <TrendTimeline months={trendData.months} />
        </div>
      ) : null}

      {isPending && (
        <div className="flex items-center gap-2 rounded-lg border border-aura-amber/20 bg-aura-amber/5 px-4 py-3 text-sm text-aura-amber-dark">
          <Loader2 className="h-4 w-4 animate-spin" />
          Uitspraken worden opgehaald...
        </div>
      )}

      {isRefreshing && (
        <div className="flex items-center gap-2 text-xs font-medium text-neutral-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Verversing actief
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-aura-glass-white/60">
          <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3">
            <div>
              <p className="text-label text-aura-amber/80">
                Uitsprakenfeed
              </p>
              <p className="mt-1 text-xs text-neutral-600">
                Klik een uitspraak om de detailweergave rechts te openen.
              </p>
            </div>
            <button
              type="button"
              onClick={() => refetch()}
              className="rounded-lg border border-neutral-200 bg-aura-glass-white/40 px-3 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-50"
            >
              Vernieuwen
            </button>
          </div>

          <div className="max-h-[36rem] overflow-y-auto p-3">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="space-y-2 rounded-xl border border-neutral-200 bg-aura-glass-white/40 p-3">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-1/3" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-[88%]" />
                  </div>
                ))}
              </div>
            ) : isError ? (
              <div className="rounded-xl border border-neutral-200 bg-aura-glass-white/60">
                <ErrorState
                  message={`Fout bij het laden van jurisprudentie: ${feedErrorMessage}`}
                  actions={[{ label: 'Opnieuw proberen', onClick: () => refetch() }]}
                  className="py-8"
                />
              </div>
            ) : rulings.length > 0 ? (
              <div className="space-y-3">
                {rulings.map((ruling) => {
                  const isActive = selectedRuling?.ecli === ruling.ecli
                  const summary = ruling.summary && ruling.summary !== '-' ? ruling.summary : 'Geen korte samenvatting beschikbaar.'

                  return (
                    <button
                      key={ruling.ecli}
                      type="button"
                      onClick={() => setSelectedEcli(ruling.ecli)}
                      className={`group w-full rounded-xl border p-3 text-left transition-colors ${
                        isActive
                          ? 'border-aura-amber/35 bg-aura-amber/[0.06]'
                          : 'border-neutral-200 bg-aura-glass-white/40 hover:bg-neutral-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-aura-ink">
                              {parseCourtFromTitle(ruling.ecli, ruling.title)}
                            </span>
                            <GeoRelevanceBadge relevance={ruling.geo_relevance} />
                          </div>
                          <p className="mt-1 font-mono text-xs text-neutral-500">
                            {ruling.ecli.split(':').slice(2).join(':')}
                          </p>
                        </div>
                        <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-600">
                          {formatDateLabel(ruling.datum_uitspraak)}
                        </span>
                      </div>

                      <h4 className="mt-3 text-sm font-medium leading-snug text-aura-ink transition-colors group-hover:text-aura-amber-dark">
                        {formatRulingTitle(ruling.ecli, ruling.title)}
                      </h4>
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-neutral-600">
                        {summary}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {ruling.uitkomst && (
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${OUTCOME_STYLES[ruling.uitkomst] ?? OUTCOME_STYLES.onbekend}`}>
                            {ruling.uitkomst}
                          </span>
                        )}
                        {ruling.vergunningstype && (
                          <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-medium text-neutral-600">
                            {ruling.vergunningstype}
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-neutral-200 bg-aura-glass-white/60">
                <EmptyState
                  icon={<Scale className="h-8 w-8 text-aura-amber" />}
                  title="Geen uitspraken gevonden"
                  description={`Er zijn nog geen jurisprudentie-resultaten voor ${gemeenteNaam}.`}
                  className="py-8"
                />
              </div>
            )}
          </div>
        </div>

        <div className="min-h-[28rem] overflow-hidden rounded-xl border border-neutral-200 bg-aura-glass-white/60">
          {selectedRuling ? (
            <div className="flex h-full min-h-[28rem] flex-col">
              <div className="border-b border-neutral-200 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-aura-amber/20 bg-aura-amber/10 px-2.5 py-1 text-[11px] font-medium text-aura-amber-dark">
                        {parseCourtFromTitle(selectedRuling.ecli, selectedRuling.title)}
                      </span>
                      {selectedRuling.uitkomst && (
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${OUTCOME_STYLES[selectedRuling.uitkomst] ?? OUTCOME_STYLES.onbekend}`}>
                          {selectedRuling.uitkomst}
                        </span>
                      )}
                      {selectedRuling.vergunningstype && (
                        <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[11px] font-medium text-neutral-600">
                          {selectedRuling.vergunningstype}
                        </span>
                      )}
                    </div>

                    <div className="mt-4 space-y-2">
                      <p className="text-lg font-semibold tracking-tight text-aura-ink">
                        {formatRulingTitle(selectedRuling.ecli, selectedRuling.title)}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                        <span>{formatDateLabel(selectedRuling.datum_uitspraak)}</span>
                        <span>•</span>
                        <span>{selectedRuling.summary && selectedRuling.summary !== '-' ? 'Samenvatting beschikbaar' : 'Geen samenvatting beschikbaar'}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedEcli(null)}
                    className="rounded-full border border-neutral-200 bg-aura-glass-white/40 px-3 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-50"
                  >
                    Sluiten
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-4">
                  <RulingAiSummaryBadge ecli={selectedRuling.ecli} analysis={analysisResult} />
                  <JurisprudentieViewer ecli={selectedRuling.ecli} />
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              title="Selecteer een uitspraak"
              description="De detailweergave opent hier zodra je een uitspraak kiest."
              className="h-full min-h-[28rem] py-8"
            />
          )}
        </div>
      </div>
    </div>
  )
}
