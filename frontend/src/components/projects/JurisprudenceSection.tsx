import { useState } from 'react'
import { Skeleton } from '@/components/feedback/Skeleton'
import {
    useGemeenteRulingsFeed,
    useJurisprudenceDoc,
    useJurisprudenceAnalysis,
    useTriggerAnalysis,
} from '@/hooks/useJurisprudence'
import { JuridischKlimaatCard } from './JuridischKlimaatCard'
import { X, Scale, FileText, Sparkles, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import type { JuridischAnalysisResult, WinLossRatio } from '@/lib/api'

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
 * Win/loss ratio bar rendered as compact pill badges.
 */
function WinLossBar({ winLoss }: { winLoss: WinLossRatio }) {
    if (winLoss.total === 0) {
        return (
            <p className="text-[10px] text-grey-500 italic">
                Nog geen uitkomstdata
            </p>
        )
    }

    const items = [
        { key: 'toegewezen', label: 'Toegewezen', color: 'bg-emerald-500/20 text-emerald-400', count: winLoss.toegewezen },
        { key: 'afgewezen', label: 'Afgewezen', color: 'bg-red-500/20 text-red-400', count: winLoss.afgewezen },
        { key: 'gedeeltelijk', label: 'Gedeeltelijk', color: 'bg-amber-accent/20 text-amber-accent', count: winLoss.gedeeltelijk },
        { key: 'onbekend', label: 'Onbekend', color: 'bg-grey-700 text-grey-400', count: winLoss.onbekend },
    ] as const

    return (
        <div className="flex flex-wrap gap-1.5">
            {items.map((item) => {
                if (item.count === 0) return null
                const pct = Math.round((item.count / winLoss.total) * 100)
                return (
                    <span
                        key={item.key}
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${item.color}`}
                    >
                        {item.label}: {pct}%
                    </span>
                )
            })}
        </div>
    )
}

/**
 * Geo-relevance badge shown next to court name.
 */
function GeoRelevanceBadge({ relevance }: { relevance: 'gemeente' | 'arrondissement' }) {
    if (relevance === 'gemeente') {
        return (
            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Gemeente
            </span>
        )
    }
    return (
        <span className="inline-flex items-center gap-1 text-[10px] text-grey-500">
            <span className="w-1.5 h-1.5 rounded-full bg-grey-500" />
            Arrondissement
        </span>
    )
}

const uitkomstColors: Record<string, string> = {
    toegewezen: 'bg-emerald-500/20 text-emerald-400',
    afgewezen: 'bg-red-500/20 text-red-400',
    gedeeltelijk: 'bg-amber-accent/20 text-amber-accent',
    onbekend: 'bg-grey-700 text-grey-400',
}

/**
 * Collapsible AI summary badge rendered inside each ruling card.
 */
function RulingAiSummaryBadge({
    ecli,
    analysis,
}: {
    ecli: string
    analysis: JuridischAnalysisResult | null
}) {
    const [isOpen, setIsOpen] = useState(false)

    if (!analysis) return null

    const ruling = analysis.ruling_analyses.find((r) => r.ecli === ecli)
    if (!ruling) return null

    return (
        <div className="mt-2 rounded-md border border-overlay/5 bg-grey-900/50">
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation()
                    setIsOpen(!isOpen)
                }}
                className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-[11px] text-amber-accent/80 hover:text-amber-accent transition-colors"
            >
                <Sparkles className="w-3 h-3" />
                <span className="font-medium">AI samenvatting</span>
                {isOpen ? (
                    <ChevronUp className="w-3 h-3 ml-auto" />
                ) : (
                    <ChevronDown className="w-3 h-3 ml-auto" />
                )}
            </button>

            {isOpen && (
                <div
                    className="px-2.5 pb-2.5 space-y-2"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Bezwaargrond */}
                    <div>
                        <span className="text-[10px] font-medium uppercase text-grey-500">
                            Bezwaargrond
                        </span>
                        <p className="text-xs text-grey-300">{ruling.bezwaargrond}</p>
                    </div>

                    {/* Uitkomst badge */}
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-medium uppercase text-grey-500">
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
                        <span className="text-[10px] font-medium uppercase text-grey-500">
                            Relevantie
                        </span>
                        <p className="text-xs text-grey-300">{ruling.relevantie}</p>
                    </div>

                    {/* Disclaimer */}
                    <p className="text-[10px] italic text-grey-600 pt-1 border-t border-overlay/5">
                        {DISCLAIMER_TEXT}
                    </p>
                </div>
            )}
        </div>
    )
}

export function JurisprudenceSection({ gemeenteNaam, wijkNaam: _wijkNaam }: JurisprudenceSectionProps) {
    const [selectedEcli, setSelectedEcli] = useState<string | null>(null)
    const [analysisJobId, setAnalysisJobId] = useState<string | null>(null)
    const [prevGemeente, setPrevGemeente] = useState(gemeenteNaam)

    // Track gemeente changes: reset selection and analysis when switching gemeente
    if (prevGemeente !== gemeenteNaam) {
        setPrevGemeente(gemeenteNaam)
        setSelectedEcli(null)
        if (analysisJobId !== null) {
            setAnalysisJobId(null)
        }
    }

    const { data: feedData, isLoading, isError, error } = useGemeenteRulingsFeed(gemeenteNaam)
    const analysisQuery = useJurisprudenceAnalysis(analysisJobId)
    const triggerMutation = useTriggerAnalysis()

    const analysisResult: JuridischAnalysisResult | null =
        analysisQuery.data?.status === 'complete' ? (analysisQuery.data.result ?? null) : null

    const isAnalyzing =
        triggerMutation.isPending ||
        (!!analysisJobId &&
            analysisQuery.data?.status !== 'complete' &&
            analysisQuery.data?.status !== 'failed')

    async function handleAnalyze() {
        if (!feedData?.rulings?.length) return
        try {
            const response = await triggerMutation.mutateAsync({
                ecliList: feedData.rulings.map((r) => r.ecli),
                gemeenteNaam,
            })
            if (response.status === 'complete') {
                // Cached result returned immediately -- no polling needed
            } else if (response.job_id) {
                setAnalysisJobId(response.job_id)
            }
        } catch {
            // Error handled by mutation state
        }
    }

    const isPending = feedData?.ingestion_status === 'pending'
    const isRefreshing = feedData?.ingestion_status === 'refreshing'

    return (
        <section className="rounded-xl border border-overlay/5 bg-grey-900 overflow-hidden">
            <div className="flex items-center gap-2 border-b border-overlay/5 px-4 py-2.5">
                <Scale className="w-3.5 h-3.5 text-amber-accent/70" />
                <span className="text-xs font-medium uppercase tracking-wide text-amber-accent/70">
                    Juridisch Klimaat
                </span>
                {feedData?.rulings && (
                    <span className="ml-auto flex items-center gap-1.5 rounded-full bg-grey-800/60 px-2 py-0.5 text-[10px] font-medium text-grey-400">
                        {feedData.count} uitspraken
                    </span>
                )}
            </div>

            <div className="p-4 flex flex-col md:flex-row gap-4">
                {/* Left Side: Feed */}
                <div className={`flex flex-col gap-3 transition-all duration-300 ${selectedEcli ? 'md:w-1/3' : 'w-full'}`}>
                    {/* Klimaat card above feed when analysis is complete or loading */}
                    {(analysisResult || isAnalyzing) && (
                        <JuridischKlimaatCard
                            analysis={analysisResult}
                            isLoading={isAnalyzing}
                        />
                    )}

                    {/* Win/loss ratio bar */}
                    {feedData?.win_loss && (
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-medium uppercase text-grey-500">
                                Uitkomstverdeling
                            </span>
                            <WinLossBar winLoss={feedData.win_loss} />
                        </div>
                    )}

                    {/* Ingestion status indicators */}
                    {isPending && (
                        <div className="flex items-center gap-2 rounded-md bg-amber-accent/5 border border-amber-accent/10 px-3 py-2 text-xs text-amber-accent/80">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Uitspraken worden opgehaald...
                        </div>
                    )}
                    {isRefreshing && (
                        <div className="flex items-center gap-1.5 text-[10px] text-grey-500">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Verversing actief
                        </div>
                    )}

                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-accent/10 px-2 py-0.5 text-[10px] font-medium text-amber-accent/80 w-fit">
                        <Scale className="w-2.5 h-2.5" />
                        Omgevingsrecht filter actief
                    </span>

                    <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto scrollbar-hidden">
                        {isLoading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="rounded-lg border border-grey-800 bg-grey-850 p-3 space-y-2">
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
                                            ? 'border-amber-accent/40 bg-amber-accent/5'
                                            : 'border-overlay/5 bg-grey-850 hover:border-overlay/10 hover:bg-grey-800'
                                        }`}
                                >
                                    <div className="flex items-center justify-between text-[11px] text-grey-500">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-grey-400">{parseCourtFromTitle(res.ecli, res.title)}</span>
                                            <GeoRelevanceBadge relevance={res.geo_relevance} />
                                        </div>
                                        <span>{res.datum_uitspraak?.split('T')[0]}</span>
                                    </div>
                                    <span className="font-mono text-[10px] text-grey-600">{res.ecli.split(':').slice(2).join(':')}</span>
                                    <h4 className="text-sm font-medium leading-snug text-grey-100 group-hover:text-amber-accent/90 transition-colors">
                                        {res.title.replace(res.ecli, '').replace(/^,\s*/, '')}
                                    </h4>
                                    <p className="text-xs text-grey-400 line-clamp-2">
                                        {res.summary && res.summary !== '-' ? res.summary : 'Geen korte samenvatting beschikbaar in archief.'}
                                    </p>

                                    {/* Uitkomst badge */}
                                    {res.uitkomst && (
                                        <span
                                            className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-medium ${uitkomstColors[res.uitkomst] ?? uitkomstColors.onbekend}`}
                                        >
                                            {res.uitkomst}
                                        </span>
                                    )}

                                    {/* AI Summary Badge */}
                                    <RulingAiSummaryBadge ecli={res.ecli} analysis={analysisResult} />
                                </button>
                            ))
                        ) : (
                            <div className="text-center py-6 text-sm text-grey-500">
                                {isPending
                                    ? 'Uitspraken worden opgehaald. Even geduld...'
                                    : 'Geen uitspraken gevonden voor deze gemeente.'}
                            </div>
                        )}
                    </div>

                    {/* Analyse button -- only show when rulings exist */}
                    {feedData?.rulings && feedData.rulings.length > 0 && (
                        <button
                            onClick={handleAnalyze}
                            disabled={isAnalyzing}
                            className="w-full mt-1 py-2.5 px-4 text-sm font-medium text-on-accent bg-amber-accent hover:bg-amber-accent-hover disabled:opacity-60 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            {isAnalyzing ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Analyseren...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-4 h-4" />
                                    Analyseer juridisch klimaat
                                </>
                            )}
                        </button>
                    )}

                    {/* Analysis error */}
                    {analysisQuery.data?.status === 'failed' && (
                        <div className="p-3 bg-red-900/20 text-red-400 border border-red-900/40 rounded-lg text-xs">
                            Analyse mislukt: {analysisQuery.data.error ?? 'Onbekende fout'}
                        </div>
                    )}
                </div>

                {/* Right Side: Document Viewer */}
                {selectedEcli && (
                    <div className="md:w-2/3 border border-overlay/5 rounded-lg bg-grey-850/50 flex flex-col max-h-[580px]">
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
            <div className="flex items-center justify-between px-4 py-3 border-b border-overlay/5 bg-grey-900/50">
                <div className="flex items-center gap-2 text-sm font-medium text-grey-200">
                    <FileText className="w-4 h-4 text-grey-400" />
                    {ecli}
                </div>
                <button onClick={onClose} className="text-grey-500 hover:text-grey-200 transition-colors">
                    <X className="w-4 h-4" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 text-sm leading-relaxed text-grey-300">
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
                            <div className="mb-6 pb-4 border-b border-overlay/5">
                                {data.document.instantie && <h1 className="text-lg font-bold text-grey-100">{data.document.instantie}</h1>}
                                {data.document.datum_uitspraak && <p className="text-xs text-grey-500 mt-1">Gewezen op: {data.document.datum_uitspraak}</p>}
                            </div>
                        )}

                        {/* Text body */}
                        <div className="text-grey-300 prose prose-invert prose-sm max-w-none">
                            {data?.document.text || "Document is leeg of inhoud werd afgeschermd."}
                        </div>
                    </div>
                )}
            </div>
        </>
    )
}
