import { ChevronRight } from 'lucide-react'
import { JurisprudenceSection } from '@/components/projects/JurisprudenceSection'
import { useGemeenteProfile, SEVERITY_COLORS } from '@/hooks/useGemeenteProfile'

interface JuridischTabProps {
  gemeenteNaam: string
  gemeenteCode: string
  onOpenModal: () => void
}

/**
 * Juridisch tab — profile stats + JurisprudenceSection.
 * Profile stats show approval rate, doorlooptijd, and bekendmakingen count.
 */
export function JuridischTab({ gemeenteNaam, onOpenModal }: JuridischTabProps) {
  const { data: profile, isLoading } = useGemeenteProfile(gemeenteNaam)

  return (
    <div className="px-8 pt-5 pb-6">
      {/* Profile stats bar */}
      {!isLoading && profile && profile.data_coverage !== 'none' && (
        <div className="flex items-center gap-4 mb-4 pb-3 border-b border-slate-100">
          {profile.approval_rate_pct != null && (
            <div>
              <span
                className="text-[10px] font-extrabold uppercase block"
                style={{ letterSpacing: '0.15em', color: '#94a3b8' }}
              >
                Verleend
              </span>
              <span
                className="text-[15px] font-black tabular-nums"
                style={{ color: profile.approval_rate_pct >= 80 ? '#22c55e' : profile.approval_rate_pct >= 50 ? '#f59e0b' : '#ef4444' }}
              >
                {profile.approval_rate_pct}%
              </span>
            </div>
          )}
          {profile.avg_doorlooptijd_days != null && (
            <div>
              <span
                className="text-[10px] font-extrabold uppercase block"
                style={{ letterSpacing: '0.15em', color: '#94a3b8' }}
              >
                Doorlooptijd
              </span>
              <span className="text-[15px] font-black tabular-nums text-[#0E1111]">
                ~{profile.avg_doorlooptijd_days}d
              </span>
            </div>
          )}
          <div>
            <span
              className="text-[10px] font-extrabold uppercase block"
              style={{ letterSpacing: '0.15em', color: '#94a3b8' }}
            >
              Bekendmakingen
            </span>
            <span className="text-[15px] font-black tabular-nums text-[#0E1111]">
              {profile.bekendmakingen_90d}
              <span className="text-[11px] font-semibold text-[#94a3b8] ml-0.5">(90d)</span>
            </span>
          </div>
        </div>
      )}

      {/* JurisprudenceSection — constrained height */}
      <div className="max-h-[320px] overflow-y-auto rounded-[16px]">
        <JurisprudenceSection gemeenteNaam={gemeenteNaam} wijkNaam={null} />
      </div>

      {/* Meer details → modal */}
      <div className="flex justify-end mt-3">
        <button
          onClick={onOpenModal}
          className="flex items-center gap-0.5 text-[11px] font-semibold text-[#0E1111] hover:text-slate-600 transition-colors"
        >
          Meer details
          <ChevronRight size={12} />
        </button>
      </div>
    </div>
  )
}
