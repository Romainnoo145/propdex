import { useState, useEffect } from 'react'
import { SearchInput } from '@/components/primitives'
import { Skeleton } from '@/components/feedback/Skeleton'
import {
    useJurisprudenceSearch,
    useJurisprudenceDoc,
} from '@/hooks/useJurisprudence'
import { X, Scale, FileText } from 'lucide-react'

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

export function JurisprudenceSection({ gemeenteNaam, wijkNaam: _wijkNaam }: JurisprudenceSectionProps) {
    const defaultSearch = `omgevingsvergunning ${gemeenteNaam}`
    const [searchTerm, setSearchTerm] = useState(defaultSearch)
    const [debouncedSearch, setDebouncedSearch] = useState(defaultSearch)
    const [selectedEcli, setSelectedEcli] = useState<string | null>(null)

    // Debounce the search input 
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchTerm), 500)
        return () => clearTimeout(timer)
    }, [searchTerm])

    const { data, isLoading, isError, error } = useJurisprudenceSearch(debouncedSearch)

    return (
        <section className="rounded-xl border border-overlay/5 bg-grey-900 overflow-hidden">
            <div className="flex items-center gap-2 border-b border-overlay/5 px-4 py-2.5">
                <Scale className="w-3.5 h-3.5 text-amber-accent/70" />
                <span className="text-xs font-medium uppercase tracking-wide text-amber-accent/70">
                    Juridisch Klimaat
                </span>
                {data?.results && (
                    <span className="ml-auto flex items-center gap-1.5 rounded-full bg-grey-800/60 px-2 py-0.5 text-[10px] font-medium text-grey-400">
                        {data.results.length} resultaten
                    </span>
                )}
            </div>

            <div className="p-4 flex flex-col md:flex-row gap-4">
                {/* Left Side: Search & Feed */}
                <div className={`flex flex-col gap-3 transition-all duration-300 ${selectedEcli ? 'md:w-1/3' : 'w-full'}`}>
                    <SearchInput
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Zoek eerdere uitspraken..."
                        className="w-full h-auto rounded-md border-grey-700 bg-grey-850 py-2.5 text-sm placeholder:text-grey-500 focus:border-amber-accent/50"
                        name="q_juris"
                    />

                    <p className="text-xs text-grey-500 mb-1">
                        Doorzoek de Raad van State en Rechtbanken op bezwaarschriften, vergunningstrajecten en locatieprecedenten.
                    </p>

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
                        ) : data?.results && data.results.length > 0 ? (
                            data.results.map((res) => (
                                <button
                                    key={res.ecli}
                                    onClick={() => setSelectedEcli(res.ecli)}
                                    className={`text-left group relative flex w-full flex-col gap-1.5 rounded-lg border p-3 transition-all ${selectedEcli === res.ecli
                                            ? 'border-amber-accent/40 bg-amber-accent/5'
                                            : 'border-overlay/5 bg-grey-850 hover:border-overlay/10 hover:bg-grey-800'
                                        }`}
                                >
                                    <div className="flex items-center justify-between text-[11px] text-grey-500">
                                        <span className="font-medium text-grey-400">{parseCourtFromTitle(res.ecli, res.title)}</span>
                                        <span>{res.date.split('T')[0]}</span>
                                    </div>
                                    <span className="font-mono text-[10px] text-grey-600">{res.ecli.split(':').slice(2).join(':')}</span>
                                    <h4 className="text-sm font-medium leading-snug text-grey-100 group-hover:text-amber-accent/90 transition-colors">
                                        {res.title.replace(res.ecli, '').replace(/^,\s*/, '')}
                                    </h4>
                                    <p className="text-xs text-grey-400 line-clamp-2">
                                        {res.summary && res.summary !== '-' ? res.summary : 'Geen korte samenvatting beschikbaar in archief.'}
                                    </p>
                                </button>
                            ))
                        ) : (
                            <div className="text-center py-6 text-sm text-grey-500">
                                Geen uitspraken gevonden voor deze zoekopdracht.
                            </div>
                        )}
                    </div>
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
