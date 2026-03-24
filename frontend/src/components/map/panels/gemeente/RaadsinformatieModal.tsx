import { useMemo, useState } from 'react'
import { AMBER, GREEN, RED, OBSIDIAN, SLATE_MUTED } from '@/lib/tokens'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import { GemeenteModal } from './GemeenteModal'
import { fadeUp } from './animations'
import { useRaadsinformatie, type RaadsstukResponse } from '@/hooks/useRaadsinformatie'

interface RaadsinformatieModalProps {
  gemeenteNaam: string
  onClose: () => void
}

const TYPE_COLORS: Record<string, string> = {
  motie: AMBER.base,
  raadsbrief: OBSIDIAN,
  besluit: AMBER.base,
  amendement: AMBER.base,
  initiatiefvoorstel: OBSIDIAN,
}

function typeBadgeColor(type: string | null): string {
  if (!type) return SLATE_MUTED
  const lower = type.toLowerCase()
  for (const [key, color] of Object.entries(TYPE_COLORS)) {
    if (lower.includes(key)) return color
  }
  return SLATE_MUTED
}

function StukCard({ stuk }: { stuk: RaadsstukResponse }) {
  const color = typeBadgeColor(stuk.type)
  const [expanded, setExpanded] = useState(false)

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" className="bg-[#F8FAF9] rounded-[14px] p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            {stuk.type && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase" style={{ color, backgroundColor: `${color}15` }}>
                {stuk.type}
              </span>
            )}
            {stuk.datum && (
              <span className="text-[10px] text-slate-400 tabular-nums">
                {new Date(stuk.datum).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            )}
          </div>
          <h4 className="text-[13px] font-bold text-[#0E1111] leading-snug line-clamp-2">{stuk.titel}</h4>
        </div>
        {stuk.bron_url && (
          <a href={stuk.bron_url} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center h-7 w-7 rounded-full bg-white text-slate-400 hover:text-[#F9A826] transition-colors shrink-0"
            onClick={(e) => e.stopPropagation()}>
            <ExternalLink size={12} />
          </a>
        )}
      </div>
      {stuk.samenvatting && (
        <>
          <button type="button" onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 mt-2 text-[11px] font-semibold text-slate-400 hover:text-slate-600 transition-colors">
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {expanded ? 'Minder' : 'Samenvatting'}
          </button>
          <AnimatePresence>
            {expanded && (
              <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }} className="text-[12px] text-slate-500 leading-relaxed mt-2 overflow-hidden">
                {stuk.samenvatting}
              </motion.p>
            )}
          </AnimatePresence>
        </>
      )}
    </motion.div>
  )
}

export function RaadsinformatieModal({ gemeenteNaam, onClose }: RaadsinformatieModalProps) {
  const { data: raadsData, isLoading } = useRaadsinformatie(gemeenteNaam)

  const sortedStukken = useMemo(() => {
    if (!raadsData?.stukken) return []
    return [...raadsData.stukken].sort((a, b) => {
      if (!a.datum && !b.datum) return 0
      if (!a.datum) return 1
      if (!b.datum) return -1
      return b.datum.localeCompare(a.datum)
    })
  }, [raadsData?.stukken])

  return (
    <GemeenteModal
      title="Raadsinformatie"
      subtitle={raadsData?.dekking
        ? `${raadsData.total_found} stukken via Open Raadsinformatie`
        : 'Gemeente niet aangesloten bij ORI'
      }
      onClose={onClose}
    >
      {isLoading && <p className="text-[13px] text-slate-400 text-center py-8">Laden...</p>}

      {!isLoading && raadsData?.dekking === false && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FileText size={32} className="text-slate-200 mb-3" />
          <p className="text-[14px] font-semibold text-slate-500">Niet beschikbaar</p>
          <p className="text-[12px] text-slate-400 mt-1">
            Deze gemeente publiceert geen raadsinformatie via ORI.
          </p>
        </div>
      )}

      {sortedStukken.length > 0 && (
        <div className="space-y-2">
          {sortedStukken.map((stuk) => (
            <StukCard key={stuk.doc_id} stuk={stuk} />
          ))}
        </div>
      )}
    </GemeenteModal>
  )
}
