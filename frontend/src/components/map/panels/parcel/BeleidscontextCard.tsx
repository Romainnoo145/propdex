/**
 * BeleidscontextCard — compact card showing which gemeente beleidsdocumenten
 * have AI summaries available. Renders in parcel detail panel overview.
 */
import { BookOpen, CheckCircle2, Circle } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { usePolicySummaries, SOURCE_KEY_LABELS } from '@/hooks/usePolicySummaries'

/** Source keys to show in the parcel detail context card. */
const DISPLAY_KEYS = [
  'welstandsnota',
  'omgevingsvisie',
  'woonvisie',
  'parkeerbeleid',
  'duurzaamheidsbeleid',
  'erfgoedverordening',
] as const

interface BeleidscontextCardProps {
  /** CBS gemeente code (e.g. "0363"), NOT prefixed with GM */
  gemeenteCode: string
}

export function BeleidscontextCard({ gemeenteCode }: BeleidscontextCardProps) {
  const navigate = useNavigate()
  const gmCode = gemeenteCode.startsWith('GM') ? gemeenteCode : `GM${gemeenteCode}`
  const { data } = usePolicySummaries(gmCode)
  const summaries = data?.summaries

  // Don't render if no policy documents exist at all
  if (!summaries || Object.keys(summaries).length === 0) return null

  const availableKeys = DISPLAY_KEYS.filter((key) => !!summaries[key])
  if (availableKeys.length === 0) return null

  return (
    <button
      type="button"
      onClick={() => navigate({ to: '/configuratie', search: { gemeente: gmCode } })}
      className="w-full rounded-[16px] border border-violet-200 bg-violet-50/50 p-3 text-left transition-colors hover:bg-violet-50 group"
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-violet-100">
          <BookOpen size={12} className="text-violet-600" />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-violet-700">
          Gemeentelijk beleid
        </span>
        <span className="ml-auto text-[10px] text-violet-400 group-hover:text-violet-600 transition-colors">
          Bekijk →
        </span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {DISPLAY_KEYS.map((key) => {
          const available = !!summaries[key]
          return (
            <div key={key} className="flex items-center gap-1">
              {available ? (
                <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
              ) : (
                <Circle size={12} className="text-slate-300 shrink-0" />
              )}
              <span
                className={`text-[11px] ${
                  available ? 'text-violet-800 font-medium' : 'text-slate-400'
                }`}
              >
                {SOURCE_KEY_LABELS[key] ?? key}
              </span>
            </div>
          )
        })}
      </div>
    </button>
  )
}
