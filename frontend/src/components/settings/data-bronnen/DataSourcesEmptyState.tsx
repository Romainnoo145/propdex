/**
 * DataSourcesEmptyState — M049/S03
 *
 * Gemeente-level empty state: zero rows across all 3 sections. Shows
 * MapPin icon + heading + body + docs CTA.
 *
 * Tokens locked in 03-CONTEXT.md §7. The docs URL is a placeholder —
 * real documentation is post-M049.
 */
import { BookOpen, MapPin } from 'lucide-react'

export function DataSourcesEmptyState() {
  return (
    <div
      className="bg-white/60 backdrop-blur-[24px] border border-white/20 rounded-2xl p-8 max-w-md mx-auto text-center space-y-4"
      data-component="data-sources-empty-state"
    >
      <MapPin
        size={48}
        strokeWidth={2}
        className="mx-auto text-[#F9A826]"
        aria-hidden
      />
      <div className="space-y-1.5">
        <h3 className="text-[15px] font-semibold text-[#0E1111]">
          Nog geen bronnen geactiveerd voor deze gemeente
        </h3>
        <p className="text-[12px] text-slate-500">
          Activeer cascade-documenten of configureer open API-bronnen om te starten.
        </p>
      </div>
      <div className="flex items-center justify-center pt-2">
        <a
          href="https://docs.propdex.nl/data-bronnen"
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-4 py-2 text-[12px] font-semibold text-slate-700 hover:bg-slate-200"
        >
          <BookOpen size={14} strokeWidth={2} />
          Documentatie bekijken
        </a>
      </div>
    </div>
  )
}
