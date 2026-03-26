/**
 * ChatParcelDetail — property summary card for PARCEL_DETAIL intent.
 */

import { MapPin, Calendar, Maximize2, Home, Zap, Landmark } from 'lucide-react'
import type { ParcelDetailSummary } from '@/hooks/useChat'

interface Props {
  data: ParcelDetailSummary
}

function StatBlock({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string | number | null | undefined }) {
  if (value == null) return null
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0E1111]/5">
        <Icon size={14} className="text-[#0E1111]" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-slate-400 leading-tight">{label}</p>
        <p className="text-[13px] font-medium text-[#0E1111] truncate">{String(value)}</p>
      </div>
    </div>
  )
}

export function ChatParcelDetail({ data }: Props) {
  return (
    <div className="rounded-xl border border-[#EAEFEF] bg-white p-4 space-y-3">
      {/* Address header */}
      <div>
        <p className="text-[14px] font-bold text-[#0E1111]">{data.address || data.parcel_id}</p>
        {data.parcel_code && (
          <p className="text-[11px] text-slate-400 mt-0.5">{data.parcel_code}</p>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatBlock icon={Calendar} label="Bouwjaar" value={data.bouwjaar} />
        <StatBlock
          icon={Maximize2}
          label="Oppervlakte"
          value={data.area_m2 != null ? `${data.area_m2.toLocaleString('nl-NL')} m²` : null}
        />
        <StatBlock icon={Home} label="Bestemming" value={data.bestemming} />
        <StatBlock icon={Home} label="Status" value={data.pand_status} />
        <StatBlock
          icon={Landmark}
          label="WOZ-waarde"
          value={data.woz_waarde != null ? `€ ${data.woz_waarde.toLocaleString('nl-NL')}` : null}
        />
        <StatBlock icon={Zap} label="Energielabel" value={data.energielabel} />
      </div>
    </div>
  )
}
