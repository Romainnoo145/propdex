import { ExternalLink } from 'lucide-react'
import { Badge } from '@/components/primitives'
import type { ProfessionalResponse } from '@/lib/types/professional'

const MAX_WERKGEBIED_VISIBLE = 5

/** Badge variant per gevolgklasse */
const GK_VARIANT: Record<string, 'amber' | 'info' | 'teal'> = {
  GK1: 'amber',
  GK2: 'info',
  GK3: 'teal',
}

interface ProfessionalCardProps {
  professional: ProfessionalResponse
}

/**
 * Card displaying a single kwaliteitsborger with:
 * - naam + bedrijfsnaam header
 * - Gevolgklasse badges (GK1/GK2/GK3)
 * - Werkgebied gemeente chips (max 5 visible + overflow count)
 * - TloKB register verification link
 *
 * Read-only — no edit/delete actions.
 */
export function ProfessionalCard({ professional }: ProfessionalCardProps) {
  const { naam, bedrijfsnaam, gevolgklassen, werkgebied, tlokb_url } = professional

  const visibleWerkgebied = werkgebied.slice(0, MAX_WERKGEBIED_VISIBLE)
  const overflowCount = werkgebied.length - MAX_WERKGEBIED_VISIBLE

  return (
    <div className="rounded-xl border border-overlay/[0.08] bg-grey-900 p-4 space-y-3">
      {/* Header */}
      <div>
        <h3 className="font-semibold text-grey-100">{naam}</h3>
        {bedrijfsnaam && (
          <p className="text-sm text-grey-400 mt-0.5">{bedrijfsnaam}</p>
        )}
      </div>

      {/* Gevolgklasse badges */}
      {gevolgklassen.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {gevolgklassen.map((gk) => (
            <Badge key={gk} variant={GK_VARIANT[gk] ?? 'default'}>
              {gk}
            </Badge>
          ))}
        </div>
      )}

      {/* Werkgebied chips */}
      {werkgebied.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {visibleWerkgebied.map((gemeente) => (
            <span
              key={gemeente}
              className="text-xs bg-grey-850 text-grey-300 border border-grey-800 rounded px-1.5 py-0.5"
            >
              {gemeente}
            </span>
          ))}
          {overflowCount > 0 && (
            <span className="text-xs text-grey-500 self-center">+{overflowCount} meer</span>
          )}
        </div>
      )}

      {/* TloKB verification link */}
      {tlokb_url && (
        <a
          href={tlokb_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-teal-accent hover:text-teal-accent/80 transition-colors"
        >
          <ExternalLink size={12} />
          Verifieer op TloKB register
        </a>
      )}
    </div>
  )
}
