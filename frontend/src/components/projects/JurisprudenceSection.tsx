import { useState } from 'react'
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
import { X, Scale, FileText, Sparkles, ChevronDown, Loader2 } from 'lucide-react'
import type { AnalyzeGemeenteResponse, RulingAnalysis } from '@/lib/api'

interface JurisprudenceSectionProps {
    gemeenteNaam: string
    wijkNaam: string | null
}

/**
 * Extract the court name from a Rechtspraak title string.
 *
 * Title format: "ECLI:NL:RVS:2023:1234, Raad van State, 15-03-2023, 202301234/1/R4"
 * Returns the court name (e.g. "Raad van State") by stripping the ECLI prefix
 * and taking the first comma-delimited segment.
 */
function parseCourtFromTitle(ecli: string, title: string): string {
    const withoutEcli = title.replace(ecli, '').replace(/^,\s*/, '')
    const parts = withoutEcli.split(', ')
    return parts[0] ?? ''
}

const DISCLAIMER_TEXT = 'Indicatief -- gebaseerd op historische uitspraken, geen juridisch advies'

/**
 * Geo-relevance badge shown next to court name.
 */
function GeoRelevanceBadge({ relevance }: { relevance: 'gemeente' | 'arrondissement' }) {
    if (relevance === 'gemeente') {
        return (
            <span className="inline-flex items-center gap-1 text-[10px] text-neutral-600">
                <span className="w-1.5 h-1.5 rounded-full bg-aura-amber/60" />
                Gemeente
            </span>
        )
    }
    return (
        <span className="inline-flex items-center gap-1 text-[10px] text-neutral-500">
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
            Arrondissement
        </span>
    )
}

/** Muted uitkomst colors — only afgewezen gets a subtle rust tint */
const uitkomstColors: Record<string, string> = {
    toegewezen: 'bg-neutral-200 text-neutral-700',
    afgewezen: 'bg-amber-900/30 text-amber-700',
    gedeeltelijk: 'bg-neutral-200 text-neutral-600',
    onbekend: 'bg-neutral-200 text-neutral-500',
}

/**
 * Collapsible AI summary badge rendered inside each ruling card.
 */
function RulingAiSummaryBadge({
    ecli,
    analysis,
}: {
    ecli: string
    analysis: AnalyzeGemeenteResponse | null
}) {
    const [isOpen, setIsOpen] = useState(false)

    if (!analysis) return null

    const ruling: RulingAnalysis | undefined = analysis.ruling_analyses.find((r) => r.ecli === ecli)
    if (!ruling) return null

    return (
        <div className="mt-2 rounded-lg border border-neutral-200 bg-aura-canvas/60">
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation()
                    setIsOpen(!isOpen)
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-[11px] hover:bg-neutral-100/[0.02] transition-colors rounded-lg"
            >
                <Sparkles className="w-3 h-3 text-aura-amber shrink-0" />
                <span className="font-medium text-aura-ink">AI Samenvatting</span>
                {ruling.vergunningstype && ruling.vergunningstype !== 'overig' && (
                    <span className="rounded-full px-1.5 py-0.5 text-[9px] font-medium bg-neutral-200 text-neutral-600">
                        {ruling.vergunningstype}
                    </span>
                )}
                <ChevronDown className={`w-3 h-3 ml-auto text-neutral-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div
                    className="px-3 pb-3 pt-1 space-y-2.5 border-t border-neutral-200"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Bezwaargrond */}
                    <div>
                        <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">
                            Bezwaargrond
                        </span>
                        <p className="text-xs text-neutral-700 mt-0.5">{ruling.bezwaargrond}</p>
                    </div>

                    {/* Uitkomst badge */}
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">
                            Uitkomst
                        </span>
                        <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${uitkomstColors[ruling.uitkomst] ?? uitkomstColors.onbekend}`}
                        >
                            {ruling.uitkomst}
                        </span>
                    </div>

                    {/* Relevantie */}
                    <div>
                        <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">
                            Relevantie
                        </span>
                        <p className="text-xs text-neutral-700 mt-0.5">{ruling.relevantie}</p>
                    </div>

                    {/* Disclaimer */}
                    <p className="text-[10px] italic text-neutral-500 pt-1.5 border-t border-neutral-200">
                        {DISCLAIMER_TEXT}
                    </p>
                </div>
            )}
        </div>
    )
}

export function JurisprudenceSection({ gemeenteNaam, wijkNaam: _wijkNaam }: JurisprudenceSectionProps) {
    const [selectedEcli, setSelectedEcli] = useState<string | null>(null)
    const [prevGemeente, setPrevGemeente] = useState(gemeenteNaam)

    // Track gemeente changes: reset selection when switching gemeente
    if (prevGemeente !== gemeenteNaam) {
        setPrevGemeente(gemeenteNaam)
        setSelectedEcli(null)
    }

    const { data: feedData, isLoading, isError, error } = useGemeenteRulingsFeed(gemeenteNaam)

    // Auto-triggering analysis -- no manual button needed
    const { analysis: analysisResult, isAnalyzing } = useGemeenteAnalysis(
        gemeenteNaam,
        !!(feedData?.rulings?.length)
    )

    // Doorlooptijd stats from dedicated endpoint
    const doorlooptijdQuery = useDoorlooptijdStats(gemeenteNaam)

    // Rolling 12-month trend data
    const { data: trendData, isLoading: isTrendLoading } = useTrendData(gemeenteNaam)

    const isPending = feedData?.ingestion_status === 'pending'
    const isRefreshing = feedData?.ingestion_status === 'refreshing'

    return (
        <section className="rounded-xl border border-neutral-200 bg-aura-glass-white/60 overflow-hidden">
            <div className="flex items-center gap-2 border-b border-neutral-200 px-4 py-2.5">
                <Scale className="w-3.5 h-3.5 text-aura-amber/70" />
                <span className="text-xs font-medium uppercase tracking-wide text-aura-amber/70">
                    Juridisch Klimaat
                </span>
                {feedData?.rulings && (
                    <span className="ml-auto flex items-center gap-1.5 rounded-full bg-neutral-200/60 px-2 py-0.5 text-[10px] font-medium text-neutral-600">
                        {feedData.count} uitspraken
                    </span>
                )}
            </div>

            <div className="p-4 flex flex-col md:flex-row md:items-stretch gap-4 max-h-[80vh]">
                {/* Left Side: Feed */}
                <div className={`flex flex-col gap-3 min-h-0 transition-all duration-300 ${selectedEcli ? 'md:w-1/3' : 'w-full'}`}>
                    {/* Klimaat dashboard card — afwijzingspercentage + verdeling */}
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

                    {/* Trend statistics + timeline */}
                    {isTrendLoading ? (
                        <Skeleton className="h-16 w-full rounded-lg" />
                    ) : trendData ? (
                        <div className="space-y-3">
                            <StatisticsBar summary={trendData.summary} />
                            <TrendTimeline months={trendData.months} />
                        </div>
                    ) : null}

                    {/* Ingestion status indicators */}
                    {isPending && (
                        <div className="flex items-center gap-2 rounded-md bg-aura-amber/5 border border-aura-amber/10 px-3 py-2 text-xs text-aura-amber/80">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Uitspraken worden opgehaald...
                        </div>
                    )}
                    {isRefreshing && (
                        <div className="flex items-center gap-1.5 text-[10px] text-neutral-500">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Verversing actief
                        </div>
                    )}

                    <span className="inline-flex items-center gap-1 rounded-full bg-aura-amber/10 px-2 py-0.5 text-[10px] font-medium text-aura-amber/80 w-fit">
                        <Scale className="w-2.5 h-2.5" />
                        Omgevingsrecht filter actief
                    </span>

                    <div className="flex flex-col gap-2 flex-1 overflow-y-auto scrollbar-hidden">
                        {isLoading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="rounded-lg border border-neutral-200 bg-aura-glass-white/40 p-3 space-y-2">
                                    <Skeleton className="h-4 w-3/4" />
                                    <Skeleton className="h-3 w-1/2" />
                                </div>
                            ))
                        ) : isError ? (
                            <div className="p-4 bg-red-900/20 text-red-400 border border-red-900/40 rounded-lg text-sm">
                                Fout bij het laden van jurisprudentie: {error.message}
                            </div>
                        ) : feedData?.rulings && feedData.rulings.length > 0 ? (
                            feedData.rulings.map((res) => (
                                <button
                                    key={res.ecli}
                                    onClick={() => setSelectedEcli(res.ecli)}
                                    className={`text-left group relative flex w-full flex-col gap-1.5 rounded-lg border p-3 transition-all ${selectedEcli === res.ecli
                                            ? 'border-aura-amber/40 bg-aura-amber/5'
                                            : 'border-neutral-200 bg-aura-glass-white/40 hover:border-neutral-200 hover:bg-neutral-200'
                                        }`}
                                >
                                    <div className="flex items-center justify-between text-[11px] text-neutral-500">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-neutral-600">{parseCourtFromTitle(res.ecli, res.title)}</span>
                                            <GeoRelevanceBadge relevance={res.geo_relevance} />
                                        </div>
                                        <span>{res.datum_uitspraak?.split('T')[0]}</span>
                                    </div>
                                    <span className="font-mono text-[10px] text-neutral-500">{res.ecli.split(':').slice(2).join(':')}</span>
                                    <h4 className="text-sm font-medium leading-snug text-aura-ink group-hover:text-aura-amber/90 transition-colors">
                                        {res.title.replace(res.ecli, '').replace(/^,\s*/, '')}
                                    </h4>
                                    <p className="text-xs text-neutral-600 line-clamp-2">
                                        {res.summary && res.summary !== '-' ? res.summary : 'Geen korte samenvatting beschikbaar in archief.'}
                                    </p>

                                    {/* Uitkomst + Vergunningstype badges */}
                                    <div className="flex flex-wrap gap-1.5">
                                        {res.uitkomst && (
                                            <span
                                                className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-medium ${uitkomstColors[res.uitkomst] ?? uitkomstColors.onbekend}`}
                                            >
                                                {res.uitkomst}
                                            </span>
                                        )}
                                        {res.vergunningstype && (
                                            <span className="inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-medium bg-neutral-200 text-neutral-600">
                                                {res.vergunningstype}
                                            </span>
                                        )}
                                    </div>

                                    {/* AI Summary Badge */}
                                    <RulingAiSummaryBadge ecli={res.ecli} analysis={analysisResult} />
                                </button>
                            ))
                        ) : (
                            <div className="text-center py-6 text-sm text-neutral-500">
                                {isPending
                                    ? 'Uitspraken worden opgehaald. Even geduld...'
                                    : 'Geen uitspraken gevonden voor deze gemeente.'}
                            </div>
                        )}
                    </div>

                    {/* Analysis status indicator (replaces manual button) */}
                    {isAnalyzing && (
                        <div className="flex items-center justify-center gap-2 py-2 text-xs text-aura-amber/70">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            AI-analyse wordt uitgevoerd...
                        </div>
                    )}
                </div>

                {/* Right Side: Document Viewer */}
                {selectedEcli && (
                    <div className="md:w-2/3 min-h-0 border border-neutral-200 rounded-lg bg-aura-glass-white/40/50 flex flex-col">
                        <JurisprudenceViewer ecli={selectedEcli} onClose={() => setSelectedEcli(null)} />
                    </div>
                )}
            </div>
        </section>
    )
}

function JurisprudenceViewer({ ecli, onClose }: { ecli: string; onClose: () => void }) {
    const { data, isLoading, isError } = useJurisprudenceDoc(ecli)

    return (
        <>
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 bg-aura-glass-white/60/50">
                <div className="flex items-center gap-2 text-sm font-medium text-aura-ink">
                    <FileText className="w-4 h-4 text-neutral-600" />
                    {ecli}
                </div>
                <button onClick={onClose} className="text-neutral-500 hover:text-aura-ink transition-colors">
                    <X className="w-4 h-4" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 text-sm leading-relaxed text-neutral-700">
                {isLoading ? (
                    <div className="space-y-4">
                        <Skeleton className="h-6 w-1/3 mb-6" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-[90%]" />
                        <Skeleton className="h-4 w-[95%]" />
                        <Skeleton className="h-4 w-2/3 mt-6" />
                    </div>
                ) : isError ? (
                    <div className="text-red-400">Document kan momenteel niet worden geladen. Probeer later opnieuw.</div>
                ) : (
                    <div className="whitespace-pre-wrap font-sans">
                        {/* Header metadata */}
                        {data?.document && (
                            <div className="mb-6 pb-4 border-b border-neutral-200">
                                {data.document.instantie && <h1 className="text-lg font-bold text-aura-ink">{data.document.instantie}</h1>}
                                {data.document.datum_uitspraak && <p className="text-xs text-neutral-500 mt-1">Gewezen op: {data.document.datum_uitspraak}</p>}
                            </div>
                        )}

                        {/* Text body */}
                        <div className="text-neutral-700 prose prose-invert prose-sm max-w-none">
                            {data?.document.text || "Document is leeg of inhoud werd afgeschermd."}
                        </div>
                    </div>
                )}
            </div>
        </>
    )
}
