/**
 * ChatParcelDetail — property summary card for PARCEL_DETAIL intent.
 *
 * Shows parcel stats + 3 action buttons: Bekijk op kaart, Rapport, Opslaan.
 */

import { MapPin, Calendar, Maximize2, Home, Zap, Landmark, Map, FileText, Heart, Loader2 } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { toMapParcelSearch } from '@/lib/navigation/mapSearch'
import { useGenerateReportFromParcel } from '@/hooks/useReports'
import { useToggleFavorite, useParcelFavorites } from '@/hooks/useFavorites'
import type { ParcelDetailSummary } from '@/hooks/useChat'
import type { ScanResultItem } from '@/lib/types/scan'

interface Props {
  data: ParcelDetailSummary
}

function StatBlock({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string | number | null | undefined }) {
  if (value == null) return null
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-aura-obsidian/5">
        <Icon size={14} className="text-aura-obsidian" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-slate-400 leading-tight">{label}</p>
        <p className="text-[13px] font-medium text-aura-obsidian truncate">{String(value)}</p>
      </div>
    </div>
  )
}

export function ChatParcelDetail({ data }: Props) {
  const navigate = useNavigate()
  const generateReport = useGenerateReportFromParcel()
  const toggleFavorite = useToggleFavorite()
  const favoritesQuery = useParcelFavorites()

  const isFavorited = favoritesQuery.data?.some((f) => f.parcel_id === data.parcel_code) ?? false

  const handleViewOnMap = () => {
    navigate({
      to: '/map',
      search: toMapParcelSearch({
        parcelId: data.parcel_id,
        fallbackAddress: data.address ?? undefined,
      }),
    })
  }

  const handleReport = () => {
    if (data.has_report && data.report_id) {
      navigate({ to: '/rapport/$id', params: { id: data.report_id } })
    } else {
      generateReport.mutate(data.parcel_id, {
        onSuccess: (res) => {
          navigate({ to: '/rapport/$id', params: { id: res.report.id } })
        },
      })
    }
  }

  const handleToggleFavorite = () => {
    if (!data.parcel_code) return

    const shim = {
      parcel_code: data.parcel_code,
      gemeente_code: data.gemeente_code ?? null,
      address: data.address ?? null,
    } as ScanResultItem

    toggleFavorite.mutate({ parcel: shim, isFavorited })
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 space-y-3">
      {/* Address header */}
      <div>
        <p className="text-[14px] font-bold text-aura-obsidian">{data.address || data.parcel_id}</p>
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

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleViewOnMap}
          className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-4 py-2 text-[13px] font-semibold text-white hover:bg-amber-600 transition-colors"
        >
          <Map size={16} />
          Bekijk op kaart
        </button>

        <button
          onClick={handleReport}
          disabled={generateReport.isPending}
          className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 px-4 py-2 text-[13px] font-medium text-aura-obsidian hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          {generateReport.isPending ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <FileText size={16} />
          )}
          Rapport
        </button>

        <button
          onClick={handleToggleFavorite}
          disabled={!data.parcel_code}
          className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 px-4 py-2 text-[13px] font-medium text-aura-obsidian hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          <Heart
            size={16}
            className={isFavorited ? 'text-red-500 fill-red-500' : ''}
          />
          Opslaan
        </button>
      </div>
    </div>
  )
}
