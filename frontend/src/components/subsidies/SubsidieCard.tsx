/**
 * SubsidieCard — card for a single subsidie in the explorer grid.
 *
 * Design tokens match RulingCard: rounded-[24px] border-[#EAEFEF] bg-white px-6 py-5.
 * Sector pills use bg-[#F2F6F3], target pills use bg-slate-100.
 */

import { ExternalLink } from 'lucide-react'
import type { SubsidieExplorerItem } from '@/hooks/useSubsidieExplorer'

/** Strip HTML entities and tags from intro text */
function cleanHtml(html: string | null): string {
  if (!html) return ''
  return html
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

interface SubsidieCardProps {
  item: SubsidieExplorerItem
}

export default function SubsidieCard({ item }: SubsidieCardProps) {
  const intro = cleanHtml(item.intro)

  return (
    <div className="rounded-[24px] border border-[#EAEFEF] bg-white px-6 py-5 transition-all hover:shadow-md">
      {/* Title */}
      <h3 className="text-[14px] font-semibold text-[#0E1111] leading-snug">
        {item.title}
      </h3>

      {/* Intro */}
      {intro ? (
        <p className="mt-2 text-[13px] text-slate-500 leading-relaxed line-clamp-3">
          {intro}
        </p>
      ) : (
        <p className="mt-2 text-[13px] text-slate-400 italic">
          Geen beschrijving beschikbaar
        </p>
      )}

      {/* Sector pills */}
      {item.sectors.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {item.sectors.slice(0, 3).map((s) => (
            <span
              key={s}
              className="inline-flex items-center rounded-full bg-[#F2F6F3] px-2.5 py-0.5 text-[11px] font-medium text-slate-600"
            >
              {s}
            </span>
          ))}
          {item.sectors.length > 3 && (
            <span className="inline-flex items-center rounded-full bg-[#F2F6F3] px-2.5 py-0.5 text-[11px] font-medium text-slate-400">
              +{item.sectors.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Target pills */}
      {item.targets.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {item.targets.slice(0, 2).map((t) => (
            <span
              key={t}
              className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-500"
            >
              {t}
            </span>
          ))}
          {item.targets.length > 2 && (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-400">
              +{item.targets.length - 2}
            </span>
          )}
        </div>
      )}

      {/* External link */}
      {item.url && (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#D48B1A] transition-colors hover:text-[#F9A826]"
        >
          Bekijk op RVO
          <ExternalLink size={13} strokeWidth={2.2} />
        </a>
      )}
    </div>
  )
}
