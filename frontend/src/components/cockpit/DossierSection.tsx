/**
 * DossierSection — combines DossierPager + active-page header + DossierCardSlot grid
 * + ProjectnotitiesGrid. Extracted from FavoriteParcelWorkspaceView.tsx 2026-05-19
 * (Plan 08-06 split, M050/S06 cont.) so OnderzoekPhaseView shell stays ≤300 LOC.
 *
 * Presentational: receives state + handlers as props from the OnderzoekPhaseView shell.
 */
import { AnimatePresence, motion } from 'framer-motion'
import { DossierPager } from './DossierPager'
import { DossierCardSlot } from './DossierCardSlot'
import type { DossierPage } from '@/lib/cockpit/dossier-pages'

interface DossierSectionProps {
  pages: DossierPage[]
  page: number
  onPageChange: (page: number) => void
  isLoadingDocuments: boolean
  documentsError: Error | null
  uploadingKey: string | null
  onUploadClick: (cardKey: string) => void
  onFileDrop: (cardKey: string, file: File) => void
  onDelete: (documentId: string) => void
  onDownload: (documentId: string, filename: string) => void
  onView: (documentId: string, filename?: string) => void
}

export function DossierSection({
  pages,
  page,
  onPageChange,
  isLoadingDocuments,
  documentsError,
  uploadingKey,
  onUploadClick,
  onFileDrop,
  onDelete,
  onDownload,
  onView,
}: DossierSectionProps) {
  const current = (pages[page] ?? pages[0])!
  const filledCount = current.cards.filter((card) => card.filled).length

  return (
    <>
      <div className="mt-4">
        <DossierPager pages={pages} activePage={page} onSelect={onPageChange} />
      </div>

      <div className="mt-4 rounded-[24px] border border-slate-200 bg-white/60 backdrop-blur-[24px] p-4 sm:p-6">
        <div className="rounded-[16px] bg-white/40 px-6 py-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={page}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <div className="flex items-center justify-between">
                <span className="tabular-nums text-7xl font-black leading-none tracking-tighter text-slate-900">
                  {filledCount}
                  <span className="text-2xl font-bold text-slate-400">/{current.cards.length}</span>
                </span>
                <div className="min-w-0 flex-1 px-6">
                  <p className="truncate text-xl font-bold uppercase tracking-wide text-slate-700">
                    {current.title}
                  </p>
                  <p className="mt-0.5 truncate text-[13px] text-slate-500">
                    {filledCount === 0
                      ? 'Sleep documenten naar de slots'
                      : `${filledCount} document${filledCount > 1 ? 'en' : ''} beschikbaar`}
                  </p>
                </div>
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#0E1111]">
                  <current.Icon className="size-6 text-[#F9A826]" strokeWidth={2.5} />
                </div>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
                <motion.div
                  className="h-full rounded-full bg-amber-400"
                  initial={{ width: 0 }}
                  animate={{
                    width: `${current.cards.length > 0 ? Math.round((filledCount / current.cards.length) * 100) : 0}%`,
                  }}
                  transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.2 }}
                />
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="relative mt-4">
          {isLoadingDocuments ? (
            <div className="rounded-[16px] bg-white/40 px-6 py-10 text-[14px] text-slate-500">
              Workspace laden...
            </div>
          ) : documentsError ? (
            <div className="rounded-[16px] border border-[#E6D1D1] bg-[#FFF5F5] px-6 py-10 text-[14px] text-[#9E3D3D]">
              {documentsError.message}
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={page}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.2 }}
                className="grid auto-rows-fr grid-cols-1 gap-1.5 md:grid-cols-2 xl:grid-cols-3"
              >
                {current.cards.map((card) => (
                  <DossierCardSlot
                    key={card.key}
                    card={card}
                    uploadingKey={uploadingKey}
                    onUploadClick={onUploadClick}
                    onFileDrop={onFileDrop}
                    onDelete={onDelete}
                    onDownload={onDownload}
                    onView={onView}
                  />
                ))}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </>
  )
}
