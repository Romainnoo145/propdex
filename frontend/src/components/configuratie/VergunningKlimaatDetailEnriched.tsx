/**
 * VergunningKlimaatDetailEnriched — enriched detail view for vergunning-klimaat source.
 * Shows approval rate, severity, doorlooptijd, bekendmakingen counters, and permit type distribution.
 */
import { useAuth } from '@/lib/auth/useAuth'
import { useGemeenteProfile, SEVERITY_COLORS, type GemeenteProfile } from '@/hooks/useGemeenteProfile'
import { Shield, TrendingUp, Clock, Bell, AlertCircle, Loader2, BarChart3 } from 'lucide-react'

interface Props {
  gemeenteNaam: string | null
}

export function VergunningKlimaatDetailEnriched({ gemeenteNaam }: Props) {
  const { data: profile, isLoading, error } = useGemeenteProfile(gemeenteNaam)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="rounded-[16px] border border-[#EAEFEF] bg-white p-8 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-slate-300 mb-2" />
        <p className="text-[13px] text-slate-400">Vergunning-klimaat data kon niet worden geladen.</p>
      </div>
    )
  }

  const severityColor = SEVERITY_COLORS[profile.severity_label] ?? SEVERITY_COLORS['Onbekend']
  const approvalRate = profile.approval_rate_pct != null ? `${profile.approval_rate_pct}%` : '—'
  const rejectionRate = profile.rejection_rate_pct != null ? `${profile.rejection_rate_pct}%` : '—'
  const doorlooptijd = profile.avg_doorlooptijd_days != null ? `${profile.avg_doorlooptijd_days} dagen` : '—'

  // Permit type distribution — sorted by count desc
  const permitTypes = Object.entries(profile.permit_type_distribution || {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
  const maxCount = permitTypes.length > 0 ? permitTypes[0][1] : 1

  return (
    <div className="space-y-4">
      {/* Severity indicator */}
      <div className="rounded-[16px] border border-[#EAEFEF] bg-white p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: `${severityColor}18` }}>
            <Shield size={20} style={{ color: severityColor }} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Vergunningklimaat</p>
            <p className="text-[20px] font-black" style={{ color: severityColor }}>{profile.severity_label}</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-[11px] text-slate-400">Steekproef</p>
            <p className="text-[14px] font-bold text-[#0E1111] tabular-nums">{profile.sample_size} zaken</p>
          </div>
        </div>

        {/* Key metrics row */}
        <div className="grid grid-cols-3 gap-3">
          <MetricTile icon={TrendingUp} label="Goedkeuring" value={approvalRate} color="#22c55e" />
          <MetricTile icon={TrendingUp} label="Afwijzing" value={rejectionRate} color="#ef4444" />
          <MetricTile icon={Clock} label="Gem. doorlooptijd" value={doorlooptijd} color="#6366f1" />
        </div>
      </div>

      {/* Bekendmakingen counters */}
      <div className="rounded-[16px] border border-[#EAEFEF] bg-white p-5">
        <div className="flex items-center gap-2 mb-3">
          <Bell size={16} className="text-slate-400" />
          <p className="text-[13px] font-bold text-[#0E1111]">Bekendmakingen</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <CounterCard label="30 dagen" value={profile.bekendmakingen_30d} />
          <CounterCard label="90 dagen" value={profile.bekendmakingen_90d} />
          <CounterCard label="365 dagen" value={profile.bekendmakingen_365d} />
        </div>
      </div>

      {/* Permit type distribution */}
      {permitTypes.length > 0 && (
        <div className="rounded-[16px] border border-[#EAEFEF] bg-white p-5">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 size={16} className="text-slate-400" />
            <p className="text-[13px] font-bold text-[#0E1111]">Vergunningstypen</p>
          </div>
          <div className="space-y-2">
            {permitTypes.map(([type, count]) => (
              <div key={type} className="flex items-center gap-3">
                <span className="w-[140px] truncate text-[12px] text-slate-600">{type}</span>
                <div className="flex-1 h-[6px] rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#F9A826]"
                    style={{ width: `${(count / maxCount) * 100}%` }}
                  />
                </div>
                <span className="w-8 text-right text-[12px] font-bold text-[#0E1111] tabular-nums">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function MetricTile({ icon: Icon, label, value, color }: { icon: typeof TrendingUp; label: string; value: string; color: string }) {
  return (
    <div className="rounded-[12px] bg-slate-50 p-3 text-center">
      <Icon size={16} className="mx-auto mb-1" style={{ color }} />
      <p className="text-[16px] font-black text-[#0E1111]">{value}</p>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
    </div>
  )
}

function CounterCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[12px] border border-[#EAEFEF] bg-white p-3 text-center">
      <p className="text-[20px] font-black text-[#0E1111] tabular-nums">{value}</p>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
    </div>
  )
}
