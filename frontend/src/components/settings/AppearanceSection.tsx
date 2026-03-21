import { Palette, Satellite, Map } from 'lucide-react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/feedback/Skeleton'
import { useUserPreferences, useUpdatePreferences } from '@/hooks/useSettings'

const MAP_STYLES = [
  {
    value: 'satellite',
    label: 'Satelliet',
    description: 'Luchtfoto weergave',
    icon: Satellite,
  },
  {
    value: 'light',
    label: 'Licht',
    description: 'Standaard kaartweergave',
    icon: Map,
  },
] as const

type MapStyleValue = (typeof MAP_STYLES)[number]['value']

export function AppearanceSection() {
  const { data: prefs, isLoading } = useUserPreferences()
  const { mutate: updatePreferences } = useUpdatePreferences()

  const handleSelectStyle = (style: MapStyleValue) => {
    updatePreferences(
      { map_style: style },
      {
        onSuccess: () => toast.success('Weergave opgeslagen'),
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : 'Fout bij opslaan'),
      }
    )
  }

  return (
    <div className="rounded-[24px] border border-[#EAEFEF] bg-white p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Palette size={14} className="text-[#F9A826]" />
        <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#0E1111]">
          Weergave
        </p>
      </div>
      <p className="text-[13px] text-slate-500">
        Kaartstijl
      </p>

      {isLoading ? (
        <div className="flex gap-4">
          <Skeleton className="h-24 w-40 rounded-[16px]" />
          <Skeleton className="h-24 w-40 rounded-[16px]" />
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {MAP_STYLES.map(({ value, label, description, icon: Icon }) => {
            const isSelected = (prefs?.map_style ?? 'light') === value
            return (
              <button
                key={value}
                type="button"
                onClick={() => handleSelectStyle(value)}
                className={`flex w-40 flex-col items-center gap-2 rounded-[16px] border-2 p-4 transition-all ${
                  isSelected
                    ? 'border-[#0E1111] bg-[#F9A826]'
                    : 'border-[#0E1111]/40 bg-white hover:border-[#0E1111]/60 hover:shadow-sm'
                }`}
              >
                <Icon
                  size={24}
                  className={isSelected ? 'text-[#0E1111]' : 'text-slate-400'}
                />
                <span className={`text-[13px] font-semibold ${isSelected ? 'text-[#0E1111]' : 'text-[#0E1111]'}`}>
                  {label}
                </span>
                <span className={`text-[11px] ${isSelected ? 'text-[#0E1111]/60' : 'text-slate-400'}`}>
                  {description}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
