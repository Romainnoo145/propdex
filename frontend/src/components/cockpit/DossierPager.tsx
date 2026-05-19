/**
 * DossierPager — 5 dossier-tab pill switcher (Notities/Acquisitie/Technisch/Juridisch/Planologisch).
 * Extracted from FavoriteParcelWorkspaceView.tsx 2026-05-19 (Plan 08-06 split,
 * M050/S06 cont.). Was named `FavoriteDossierTabs` pre-split.
 */
import { motion } from 'framer-motion'
import type { DossierPage } from '@/lib/cockpit/dossier-pages'

interface DossierPagerProps {
  pages: DossierPage[]
  activePage: number
  onSelect: (page: number) => void
}

export function DossierPager({ pages, activePage, onSelect }: DossierPagerProps) {
  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex h-[48px] min-w-max rounded-full bg-[#F2F6F3] p-1">
        {pages.map((page, index) => {
          const isActive = activePage === index
          return (
            <button
              key={page.title}
              type="button"
              onClick={() => onSelect(index)}
              className="relative flex h-full min-w-[124px] flex-1 items-center justify-center rounded-full px-4 transition-colors"
              style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontSize: '13px',
                fontWeight: isActive ? 700 : 600,
                letterSpacing: isActive ? '-0.01em' : '0',
                color: isActive ? undefined : '#94a3b8',
              }}
            >
              {isActive && (
                <motion.div
                  layoutId="favorite-workspace-tab"
                  className="absolute inset-0 rounded-full"
                  style={{ background: '#0E1111' }}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <span className={`relative z-10 ${isActive ? 'text-white' : ''}`}>{page.tabLabel}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
