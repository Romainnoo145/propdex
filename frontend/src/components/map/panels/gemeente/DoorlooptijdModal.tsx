import { useMemo } from 'react'
import { AMBER, GREEN, RED, SLATE_MUTED } from '@/lib/tokens'
import { motion } from 'framer-motion'
import { Clock } from 'lucide-react'
import { GemeenteModal } from './GemeenteModal'
import { useGemeenteProfile } from '@/hooks/useGemeenteProfile'
import { useDoorlooptijdStats } from '@/hooks/useJurisprudence'

interface DoorlooptijdModalProps {
  gemeenteNaam: string
  onClose: () => void
}

function HBar({ label, value, max, color, suffix }: { label: string; value: number; max: number; color: string; suffix?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] font-semibold text-slate-500 w-[140px] truncate">{label}</span>
      <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1], delay: 0.2 }}
        />
      </div>
      <span className="text-[11px] font-black text-slate-600 tabular-nums w-[50px] text-right">
        {value}{suffix ?? ''}
      </span>
    </div>
  )
}

export function DoorlooptijdModal({ gemeenteNaam, onClose }: DoorlooptijdModalProps) {
  const { data: profile } = useGemeenteProfile(gemeenteNaam)
  const { data: doorlooptijdData, isLoading } = useDoorlooptijdStats(gemeenteNaam)

  const doorlooptijdTypes = useMemo(() => {
    if (!doorlooptijdData) return []
    return Object.values(doorlooptijdData)
      .filter((d) => d.avg_dagen != null && !d.insufficient_data)
      .sort((a, b) => (b.avg_dagen ?? 0) - (a.avg_dagen ?? 0))
  }, [doorlooptijdData])

  const maxDagen = doorlooptijdTypes.length > 0 ? Math.max(...doorlooptijdTypes.map(d => d.avg_dagen ?? 0)) : 1

  const avgDagen = profile?.avg_doorlooptijd_days

  return (
    <GemeenteModal
      title="Doorlooptijd"
      subtitle={avgDagen != null
        ? `Gemiddeld ~${avgDagen} dagen in ${gemeenteNaam}`
        : `Vergunning doorlooptijd in ${gemeenteNaam}`
      }
      onClose={onClose}
    >
      {/* Summary */}
      {avgDagen != null && (
        <div className="bg-[#F8FAF9] rounded-[16px] p-5 mb-6 text-center">
          <span
            className="text-[48px] font-black tracking-tighter tabular-nums leading-none"
            style={{ color: avgDagen <= 30 ? GREEN : avgDagen <= 90 ? AMBER.base : RED }}
          >
            ~{avgDagen}
          </span>
          <span className="text-[13px] font-semibold text-slate-400 block mt-1">
            dagen gemiddelde doorlooptijd
          </span>
        </div>
      )}

      {/* Per type */}
      {isLoading && <p className="text-[13px] text-slate-400 text-center py-8">Laden...</p>}

      {!isLoading && doorlooptijdTypes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Clock size={32} className="text-slate-200 mb-3" />
          <p className="text-[14px] font-semibold text-slate-500">Geen doorlooptijddata</p>
          <p className="text-[12px] text-slate-400 mt-1">
            Onvoldoende bekendmakingen om doorlooptijd per type te berekenen.
          </p>
        </div>
      )}

      {doorlooptijdTypes.length > 0 && (
        <>
          <h3 className="text-[10px] font-black text-slate-400 uppercase mb-3" style={{ letterSpacing: '0.2em' }}>
            Per vergunningstype
          </h3>
          <div className="space-y-3">
            {doorlooptijdTypes.map((d) => (
              <HBar
                key={d.vergunningstype}
                label={d.vergunningstype}
                value={Math.round(d.avg_dagen ?? 0)}
                max={maxDagen}
                color={d.avg_dagen != null ? (d.avg_dagen <= 30 ? GREEN : d.avg_dagen <= 90 ? AMBER.base : RED) : SLATE_MUTED}
                suffix="d"
              />
            ))}
          </div>

          <p className="text-[10px] text-slate-300 mt-4">
            Gebaseerd op bekendmakingen met publicatie- en besluitdatum.
          </p>
        </>
      )}
    </GemeenteModal>
  )
}
