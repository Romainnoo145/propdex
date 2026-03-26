/**
 * ChatSearchResults — compact result summary shown in chat for PARCEL_SEARCH.
 *
 * Shows count + filter pills + "Bekijk resultaten" button that navigates
 * to /resultaten?query_id=xxx. No table in chat — results live on their own page.
 */

import { ArrowRight, Search } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'

const FILTER_LABELS: Record<string, string> = {
  municipality: 'Gemeente',
  build_year_min: 'Bouwjaar vanaf',
  build_year_max: 'Bouwjaar t/m',
  area_min: 'Opp. vanaf',
  area_max: 'Opp. t/m',
  bestemming: 'Bestemming',
  bestemming_exclude: 'Niet',
  pand_status: 'Status',
}

interface Props {
  total: number
  parsed: Record<string, unknown>
  queryId?: string
}

export function ChatSearchResults({ total, parsed, queryId }: Props) {
  const navigate = useNavigate()

  const handleViewResults = () => {
    if (queryId) {
      navigate({
        to: '/resultaten',
        search: { query_id: queryId },
      })
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Search size={16} className="text-amber-500" />
        <span className="text-[14px] font-bold text-[#0E1111]">
          {total.toLocaleString('nl-NL')} resultaten gevonden
        </span>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(parsed)
          .filter(([, v]) => v != null)
          .map(([key, value]) => (
            <span
              key={key}
              className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[11px] font-medium text-amber-800"
            >
              {FILTER_LABELS[key] || key}: {key.includes('area') ? `${value} m²` : String(value)}
            </span>
          ))}
      </div>

      {/* Navigate to results page */}
      {queryId && (
        <button
          onClick={handleViewResults}
          className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-4 py-2 text-[13px] font-semibold text-white hover:bg-amber-600 transition-colors"
        >
          Bekijk resultaten
          <ArrowRight size={16} />
        </button>
      )}
    </div>
  )
}
