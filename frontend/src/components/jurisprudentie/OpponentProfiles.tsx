import { useState } from 'react'
import { Shield, ChevronDown, ChevronUp } from 'lucide-react'
import type { OpponentProfile } from '@/hooks/useExplorer'

interface OpponentProfilesProps {
  profiles: OpponentProfile[]
}

/** Amber ring — fill relative to maxZaken so top opponent = full ring */
function CaseRing({ zaken }: { zaken: number }) {
  const r = 16

  return (
    <div className="relative flex items-center justify-center shrink-0">
      <svg viewBox="0 0 40 40" className="h-11 w-11" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="20" cy="20" r={r} fill="none" stroke="#F9A826" strokeWidth="3.5" />
      </svg>
      <span className="absolute text-[10px] font-black tabular-nums leading-none text-aura-obsidian">
        {zaken}
      </span>
    </div>
  )
}

export default function OpponentProfiles({ profiles }: OpponentProfilesProps) {
  const [expanded, setExpanded] = useState(false)
  if (profiles.length === 0) return null

  const visible = expanded ? profiles.slice(0, 10) : profiles.slice(0, 5)
  const hasMore = profiles.length > 5

  return (
    <div className="rounded-2xl border border-neutral-200 bg-aura-glass-white/60 p-5">
      <div className="mb-4 flex items-center gap-2">
        <Shield size={14} className="text-aura-amber" />
        <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400">
          Tegenstanders
        </p>
      </div>
      <div className="space-y-1.5">
        {visible.map((p) => (
          <div
            key={p.naam}
            className="flex items-center gap-3 rounded-[12px] bg-aura-canvas px-3.5 py-2.5"
          >
            <CaseRing zaken={p.zaken} />
            <p className="truncate text-[13px] font-semibold text-aura-obsidian min-w-0 flex-1">
              {p.naam}
            </p>
            {/* Right: gewonnen count — always visible */}
            <div className="flex items-center gap-1 shrink-0">
              {p.gewonnen > 0 && (
                <span className="text-[13px] font-black text-emerald-600">↑</span>
              )}
              <span className="text-[13px] font-bold tabular-nums text-aura-obsidian">
                {p.gewonnen} gewonnen
              </span>
            </div>
          </div>
        ))}
      </div>
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-slate-400 transition-colors hover:text-slate-600"
        >
          {expanded ? (
            <>Minder tonen <ChevronUp size={12} /></>
          ) : (
            <>Alle {profiles.length} tonen <ChevronDown size={12} /></>
          )}
        </button>
      )}
    </div>
  )
}
