/**
 * ParcelScoreHero — sticky hero for the redesigned ParcelDetailPanel (Optie B).
 *
 * Holds everything down to the coloured divider: the parcel address/title, the
 * overall ontwikkelscore (big, tabular, amber bar) and a compact potentie /
 * risico split (green / red). Reuses the verdict-hero visual language from
 * PotentieLayer / RisicoLayer (text-7xl score + framer useSpring progress bar),
 * condensed into one always-visible header.
 *
 * Reduced motion: when prefers-reduced-motion is set the bars seed at their
 * target value, so no width animation runs.
 */

import { useEffect } from 'react'
import { motion, useSpring, useTransform } from 'framer-motion'
import { MissingDataBadge } from './MissingDataBadge'
import type { ScanResultItem } from '@/lib/types/scan'

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Split "Straat 1, 1234AB Venlo" → ["Straat 1", ", 1234AB Venlo"] for clean truncation. */
export function splitAddress(address: string | null): [string, string] {
  if (!address) return ['Onbekend adres', '']
  const m = address.match(/^(.+?)\s*(,\s*\d{4}\s?[A-Z]{2}.*)$/)
  return m ? [m[1] ?? address, m[2] ?? ''] : [address, '']
}

interface ScoreBarProps {
  /** 0–100, or null when unknown. */
  value: number | null
  colorClass: string
  /** Track height utility (default h-3). */
  heightClass?: string
}

function ScoreBar({ value, colorClass, heightClass = 'h-3' }: ScoreBarProps) {
  const target = value ?? 0
  // Seed at target under reduced motion so the spring has nowhere to travel.
  const spring = useSpring(prefersReducedMotion ? target : 0, { stiffness: 60, damping: 20 })
  useEffect(() => {
    if (prefersReducedMotion) {
      spring.jump(target)
      return
    }
    const timer = setTimeout(() => spring.set(target), 300)
    return () => clearTimeout(timer)
  }, [target, spring])
  const width = useTransform(spring, (v) => `${v}%`)
  return (
    <div className={`${heightClass} rounded-full bg-slate-100 overflow-hidden`}>
      <motion.div className={`h-full rounded-full ${colorClass}`} style={{ width }} />
    </div>
  )
}

interface SplitStatProps {
  label: string
  value: number | null
  numberColor: string
  barColor: string
}

function SplitStat({ label, value, numberColor, barColor }: SplitStatProps) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400">
          {label}
        </span>
        <span className={`text-[15px] font-black tabular-nums leading-none ${numberColor}`}>
          {value ?? '—'}
        </span>
      </div>
      <div className="mt-1.5">
        <ScoreBar value={value} colorClass={barColor} heightClass="h-1.5" />
      </div>
    </div>
  )
}

interface ParcelScoreHeroProps {
  parcel: ScanResultItem
  missingCount: number
}

export function ParcelScoreHero({ parcel, missingCount }: ParcelScoreHeroProps) {
  const total =
    parcel.score != null ? Math.round(parcel.score) : null
  const potentie =
    parcel.potentie_score != null
      ? Math.round(parcel.potentie_score)
      : parcel.score != null
        ? Math.round(parcel.score)
        : null
  const risico = parcel.risico_score != null ? Math.round(parcel.risico_score) : null

  const [street, rest] = splitAddress(parcel.address)

  return (
    <div className="px-8 pt-8 pb-5">
      {/* Address — pr-20 leaves room for the absolute close / heart buttons. */}
      <div className="pr-20">
        <h2 className="flex text-[28px] font-bold tracking-tighter text-slate-900 leading-tight overflow-hidden whitespace-nowrap">
          <span className="truncate">{street}</span>
          <span className="shrink-0">{rest}</span>
        </h2>
        <div className="flex items-center gap-2 mt-1 min-w-0">
          {parcel.parcel_code && (
            <p className="text-xs text-slate-400 font-medium uppercase tracking-widest truncate">
              {parcel.parcel_code}
            </p>
          )}
          <MissingDataBadge count={missingCount} />
        </div>
      </div>

      {/* Score block */}
      <div className="mt-5">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400">
              Ontwikkelscore
            </p>
            <span className="block text-7xl font-black tracking-tighter text-slate-900 tabular-nums leading-none mt-1">
              {total ?? '—'}
            </span>
          </div>
        </div>

        <div className="mt-3">
          <ScoreBar value={total} colorClass="bg-aura-amber" />
        </div>

        {/* Potentie / risico split */}
        <div className="mt-4 flex items-start gap-5">
          <SplitStat label="Potentie" value={potentie} numberColor="text-green-600" barColor="bg-aura-green" />
          <SplitStat label="Risico" value={risico} numberColor="text-red-500" barColor="bg-red-400" />
        </div>
      </div>

      {/* Coloured divider — the bottom edge of the sticky hero. */}
      <div
        className="mt-5 h-[2px] rounded-full"
        style={{
          background:
            'linear-gradient(90deg, var(--color-aura-green) 0%, var(--color-aura-amber) 55%, var(--color-aura-red) 100%)',
        }}
        aria-hidden="true"
      />
    </div>
  )
}
