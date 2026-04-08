/**
 * Shared state helpers for configuratie source detail views.
 *
 * Implements contract §10 (loading / empty / error) as a single source of
 * truth so all 6 enriched components can stay in sync with the design
 * contract without duplicating the JSX.
 */
import { Loader2 } from 'lucide-react'

interface DetailEmptyProps {
  message?: string
  description?: string
}

interface DetailErrorProps {
  error: Error | null
}

export function DetailLoading() {
  return (
    <div className="flex items-center justify-center gap-2 rounded-[20px] border border-[#EAEFEF] bg-white p-12">
      <Loader2 className="size-5 animate-spin text-slate-400" />
      <span className="text-[13px] text-slate-400">Data laden…</span>
    </div>
  )
}

export function DetailEmpty({ message, description }: DetailEmptyProps) {
  return (
    <div className="rounded-[20px] border border-[#EAEFEF] bg-white p-8 text-center">
      <p className="text-[13px] font-semibold text-[#0E1111]">
        {message ?? 'Geen data beschikbaar'}
      </p>
      {description && (
        <p className="mx-auto mt-2 max-w-sm text-[12px] text-slate-400">
          {description}
        </p>
      )}
    </div>
  )
}

export function DetailError({ error }: DetailErrorProps) {
  return (
    <div className="rounded-[20px] border border-[#EAEFEF] bg-white p-8 text-center">
      <p className="text-[13px] text-red-400">
        {error?.message ?? 'Er is een fout opgetreden.'}
      </p>
    </div>
  )
}
