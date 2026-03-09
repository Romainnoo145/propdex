import { Shield } from 'lucide-react'
import type { OpponentProfile } from '@/hooks/useExplorer'

interface OpponentProfilesProps {
  profiles: OpponentProfile[]
}

export default function OpponentProfiles({ profiles }: OpponentProfilesProps) {
  if (profiles.length === 0) return null

  return (
    <div className="rounded-lg border border-neutral-200 bg-aura-glass-white/60 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Shield size={16} className="text-amber-500/60" />
        <h3 className="text-sm font-semibold text-aura-ink">
          Tegenstanders
        </h3>
        <span className="text-xs text-neutral-500">Wie houdt de boel tegen?</span>
      </div>
      <div className="space-y-2">
        {profiles.slice(0, 10).map((p) => {
          const winRate = p.zaken > 0 ? Math.round((p.gewonnen / p.zaken) * 100) : 0
          return (
            <div
              key={p.naam}
              className="flex items-center justify-between rounded-lg border border-neutral-200 bg-aura-canvas px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-aura-ink">{p.naam}</p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  {p.zaken} {p.zaken === 1 ? 'zaak' : 'zaken'}
                  {p.gewonnen > 0 && ` · ${p.gewonnen}x gewonnen`}
                  {p.verloren > 0 && ` · ${p.verloren}x verloren`}
                </p>
              </div>
              <div className="ml-3 flex items-center gap-2">
                {/* Win rate bar */}
                <div className="flex h-1.5 w-16 overflow-hidden rounded-full bg-neutral-200">
                  {winRate > 0 && (
                    <div
                      className="rounded-full bg-red-500/60"
                      style={{ width: `${winRate}%` }}
                    />
                  )}
                </div>
                <span className="w-8 text-right text-xs tabular-nums text-neutral-600">
                  {winRate}%
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
