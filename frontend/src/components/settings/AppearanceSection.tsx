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
    <section>
      <div className="mb-4 flex items-center gap-2">
        <Palette className="h-5 w-5 text-neutral-600" />
        <h2 className="text-lg font-semibold text-aura-ink">Weergave</h2>
      </div>

      {/* Map style */}
      <p className="mb-3 text-sm text-neutral-600">
        Kaartstijl
      </p>

      {isLoading ? (
        <div className="flex gap-4">
          <Skeleton className="h-24 w-40" />
          <Skeleton className="h-24 w-40" />
        </div>
      ) : (
        <div className="flex flex-wrap gap-4">
          {MAP_STYLES.map(({ value, label, description, icon: Icon }) => {
            const isSelected = (prefs?.map_style ?? 'light') === value
            return (
              <button
                key={value}
                type="button"
                onClick={() => handleSelectStyle(value)}
                className={[
                  'flex w-40 flex-col items-center gap-2 rounded-lg border p-4',
                  'transition-colors duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aura-green focus-visible:ring-offset-2 focus-visible:ring-offset-aura-canvas',
                  isSelected
                    ? 'border-aura-green ring-2 ring-aura-green'
                    : 'border-neutral-200 hover:border-neutral-400',
                ].join(' ')}
              >
                <Icon
                  className={[
                    'h-8 w-8',
                    isSelected ? 'text-aura-green' : 'text-neutral-600',
                  ].join(' ')}
                />
                <span
                  className={[
                    'text-sm font-medium',
                    isSelected ? 'text-aura-ink' : 'text-neutral-600',
                  ].join(' ')}
                >
                  {label}
                </span>
                <span className="text-xs text-neutral-500">{description}</span>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
