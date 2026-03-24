import { useEffect, useState } from 'react'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/feedback/Skeleton'
import {
  useGemeenteRulingsFeed,
  useJurisprudenceDoc,
  useGemeenteAnalysis,
  useDoorlooptijdStats,
  useTrendData,
} from '@/hooks/useJurisprudence'
import { JuridischKlimaatCard } from './JuridischKlimaatCard'
import { TrendTimeline } from './TrendTimeline'
import { StatisticsBar } from './StatisticsBar'
import {
  GeoRelevanceBadge,
  OUTCOME_STYLES,
  RulingAiSummaryBadge,
  formatDateLabel,
  formatRulingTitle,
  parseCourtFromTitle,
} from './jurisprudenceShared'
import { X, Scale, FileText, Loader2 } from 'lucide-react'

interface JurisprudenceSectionProps {
  gemeenteNaam: string
  wijkNaam: string | null
}

export function JurisprudenceSection({ gemeenteNaam, wijkNaam: _wijkNaam }: JurisprudenceSectionProps) {
  const [selectedEcli, setSelectedEcli] = useState<string | null>(null)

  useEffect(() => {
    setSelectedEcli(null)
  }, [gemeenteNaam])

  const { data: feedData, isLoading, isError, error, refetch } = useGemeenteRulingsFeed(gemeenteNaam)

  const { analysis: analysisResult, isAnalyzing } = useGemeenteAnalysis(
    gemeenteNaam,
    !!(feedData?.rulings?.length)
  )

  const doorlooptijdQuery = useDoorlooptijdStats(gemeenteNaam)
  const { data: trendData, isLoading: isTrendLoading } = useTrendData(gemeenteNaam)

  const isPending = feedData?.ingestion_status === 'pending'
  const isRefreshing = feedData?.ingestion_status === 'refreshing'
  const feedErrorMessage = error instanceof Error ? error.message : 'Onbekende fout'

  return (
    <section className="overflow-hidden rounded-xl border border-neutral-200 bg-aura-glass-white/60">
      <div className="flex items-center gap-2 border-b border-neutral-200 px-4 py-2.5">
        <Scale className="h-3.5 w-3.5 text-aura-amber/70" />
        <span className="text-xs font-medium uppercase tracking-wide text-aura-amber/70">
          Juridisch klimaat
        </span>
        {feedData?.rulings && (
          <span className="ml-auto flex items-center gap-1.5 rounded-full bg-neutral-200/60 px-2 py-0.5 text-[10px] font-medium text-neutral-600">
            {feedData.count} uitspraken
          </span>
        )}
      </div>

      <div className="flex max-h-[80vh] flex-col gap-4 p-4 md:flex-row md:items-stretch">
        <div className={`flex min-h-0 flex-col gap-3 transition-all duration-300 ${selectedEcli ? 'md:w-1/3' : 'w-full'}`}>
          {(feedData?.win_loss || isAnalyzing) && (
            <JuridischKlimaatCard
              isLoading={isAnalyzing && !feedData?.win_loss}
              doorlooptijd={doorlooptijdQuery.data ?? null}
              winLoss={feedData?.win_loss ?? null}
              analyzedCount={analysisResult?.analyzed_count}
              totalCount={analysisResult?.total_count}
              pendingCount={analysisResult?.pending_count}
            />
          )}

          {isTrendLoading ? (
            <div className="rounded-xl border border-neutral-200 bg-aura-glass-white/60 p-4">
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
          ) : trendData ? (
            <div className="space-y-4 rounded-xl border border-neutral-200 bg-aura-glass-white/60 p-4">
              <StatisticsBar summary={trendData.summary} />
              <TrendTimeline months={trendData.months} />
            </div>
          ) : null}

          {isPending && (
            <div className="flex items-center gap-2 rounded-lg border border-aura-amber/20 bg-aura-amber/5 px-3 py-2 text-xs text-aura-amber-dark">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Uitspraken worden opgehaald...
            </div>
          )}

          {isRefreshing && (
            <div className="flex items-center gap-1.5 text-xs text-neutral-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              Verversing actief
            </div>
          )}

          <span className="inline-flex w-fit items-center gap-1 rounded-full border border-aura-amber/20 bg-aura-amber/10 px-2 py-0.5 text-[10px] font-medium text-aura-amber-dark">
            <Scale className="h-2.5 w-2.5" />
            Omgevingsrecht filter actief
          </span>

          <div className="flex flex-1 flex-col gap-2 overflow-y-auto scrollbar-hidden">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="space-y-2 rounded-xl border border-neutral-200 bg-aura-glass-white/40 p-3">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ))
            ) : isError ? (
              <div className="rounded-xl border border-neutral-200 bg-aura-glass-white/60">
                <ErrorState
                  message={`Fout bij het laden van jurisprudentie: ${feedErrorMessage}`}
                  actions={[{ label: 'Opnieuw proberen', onClick: () => refetch() }]}
                  className="py-8"
                />
              </div>
            ) : feedData?.rulings && feedData.rulings.length > 0 ? (
              feedData.rulings.map((res) => (
                <button
                  key={res.ecli}
                  type="button"
                  onClick={() => setSelectedEcli(res.ecli)}
                  className={`group flex w-full flex-col gap-1.5 rounded-xl border p-3 text-left transition-colors ${
                    selectedEcli === res.ecli
                      ? 'border-aura-amber/35 bg-aura-amber/[0.06]'
                      : 'border-neutral-200 bg-aura-glass-white/40 hover:bg-neutral-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 text-[11px] text-neutral-500">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-medium text-neutral-600">
                        {parseCourtFromTitle(res.ecli, res.title)}
                      </span>
                      <GeoRelevanceBadge relevance={res.geo_relevance} />
                    </div>
                    <span className="tabular-nums">{formatDateLabel(res.datum_uitspraak)}</span>
                  </div>
                  <span className="font-mono text-[10px] text-neutral-500">
                    {res.ecli.split(':').slice(2).join(':')}
                  </span>
                  <h4 className="text-sm font-medium leading-snug text-aura-ink transition-colors group-hover:text-aura-amber-dark">
                    {formatRulingTitle(res.ecli, res.title)}
                  </h4>
                  <p className="line-clamp-2 text-xs text-neutral-600">
                    {res.summary && res.summary !== '-' ? res.summary : 'Geen korte samenvatting beschikbaar in archief.'}
                  </p>

                  <div className="flex flex-wrap gap-1.5">
                    {res.uitkomst && (
                      <span
                        className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-medium ${OUTCOME_STYLES[res.uitkomst] ?? OUTCOME_STYLES.onbekend}`}
                      >
                        {res.uitkomst}
                      </span>
                    )}
                    {res.vergunningstype && (
                      <span className="inline-flex w-fit rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-medium text-neutral-600">
                        {res.vergunningstype}
                      </span>
                    )}
                  </div>

                  <RulingAiSummaryBadge ecli={res.ecli} analysis={analysisResult} />
                </button>
              ))
            ) : (
              <div className="rounded-xl border border-neutral-200 bg-aura-glass-white/60">
                <EmptyState
                  title={isPending ? 'Uitspraken worden opgehaald' : 'Geen uitspraken gevonden'}
                  description={
                    isPending
                      ? 'Even geduld terwijl we jurisprudentie voor deze gemeente ophalen.'
                      : 'Er zijn nog geen jurisprudentie-resultaten voor deze gemeente.'
                  }
                  className="py-8"
                />
              </div>
            )}
          </div>

          {isAnalyzing && (
            <div className="flex items-center justify-center gap-2 py-2 text-xs text-aura-amber/70">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              AI-analyse wordt uitgevoerd...
            </div>
          )}
        </div>

        {selectedEcli && (
          <div className="min-h-0 overflow-hidden rounded-xl border border-neutral-200 bg-aura-glass-white/60 md:w-2/3">
            <JurisprudenceViewer ecli={selectedEcli} onClose={() => setSelectedEcli(null)} />
          </div>
        )}
      </div>
    </section>
  )
}

function JurisprudenceViewer({ ecli, onClose }: { ecli: string; onClose: () => void }) {
  const { data, isLoading, isError, refetch } = useJurisprudenceDoc(ecli)

  return (
    <>
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium text-aura-ink">
          <FileText className="h-4 w-4 text-neutral-600" />
          <span className="truncate">{ecli}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-aura-ink"
          aria-label="Sluiten"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 text-sm leading-relaxed text-neutral-700">
        {isLoading ? (
          <div className="space-y-4 rounded-xl border border-neutral-200 bg-aura-glass-white/40 p-4">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[90%]" />
            <Skeleton className="h-4 w-[95%]" />
          </div>
        ) : isError ? (
          <div className="rounded-xl border border-neutral-200 bg-aura-glass-white/60">
            <ErrorState
              message="Document kan momenteel niet worden geladen."
              actions={[{ label: 'Opnieuw proberen', onClick: () => refetch() }]}
              className="py-8"
            />
          </div>
        ) : (
          <div className="space-y-4">
            {data?.document && (
              <div className="rounded-xl border border-neutral-200 bg-aura-glass-white/40 p-4">
                {data.document.instantie && (
                  <h1 className="text-lg font-semibold text-aura-ink">{data.document.instantie}</h1>
                )}
                {data.document.datum_uitspraak && (
                  <p className="mt-1 text-xs text-neutral-500">
                    Gewezen op: {formatDateLabel(data.document.datum_uitspraak)}
                  </p>
                )}
              </div>
            )}

            <div className="rounded-xl border border-neutral-200 bg-aura-glass-white/40 p-4">
              <div className="whitespace-pre-wrap text-sm leading-7 text-neutral-700">
                {data?.document.text || 'Document is leeg of inhoud werd afgeschermd.'}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
