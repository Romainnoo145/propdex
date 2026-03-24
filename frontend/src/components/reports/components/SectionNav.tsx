/**
 * SectionNav — 7-item vertical navigation for Due Diligence Dashboard
 *
 * Uses Framer Motion layoutId for animated active indicator (same spring
 * config as CategoryTabs: stiffness 380, damping 30).
 */

import { motion } from 'framer-motion'
import { MapPin, Gavel, LandPlot, ShieldAlert, BarChart3, ScrollText, Database } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { OBSIDIAN, SLATE_MUTED } from '@/lib/tokens'
import { SectionStatusDot } from './SectionStatusBadge'
import type { SectionStatus } from './SectionStatusBadge'

export const SECTIONS = [
  { key: 'locatiegegevens', label: '1. Locatiegegevens', icon: MapPin },
  { key: 'kadaster', label: '2. Kadaster & Eigendom', icon: Gavel },
  { key: 'bestemmingsplan', label: '3. Bestemmingsplan', icon: LandPlot },
  { key: 'risicoprofiel', label: '4. Risicoprofiel', icon: ShieldAlert },
  { key: 'analyse', label: '5. Potentie & Risico', icon: BarChart3 },
  { key: 'vergunningen', label: '6. Vergunningen', icon: ScrollText },
  { key: 'bronnen', label: '7. Bronvermelding', icon: Database },
] as const

export type SectionKey = (typeof SECTIONS)[number]['key']

interface SectionNavItem {
  key: SectionKey
  label: string
  icon: LucideIcon
}

interface SectionNavProps {
  activeSection: SectionKey
  onSelect: (key: SectionKey) => void
  sectionStatuses: Record<SectionKey, SectionStatus>
}

export function SectionNav({ activeSection, onSelect, sectionStatuses }: SectionNavProps) {
  return (
    <nav
      className="flex flex-col gap-0.5 py-2"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {(SECTIONS as readonly SectionNavItem[]).map(({ key, label, icon: Icon }) => {
        const isActive = activeSection === key
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            className="relative flex items-center gap-2.5 px-3 py-2.5 rounded-[14px] transition-colors text-left w-full"
            style={{
              color: isActive ? OBSIDIAN : SLATE_MUTED,
            }}
          >
            {isActive && (
              <motion.div
                layoutId="section-nav-active"
                className="absolute inset-0 rounded-[14px]"
                style={{ backgroundColor: 'rgba(14,17,17,0.06)' }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
            <Icon
              size={16}
              strokeWidth={isActive ? 2 : 1.5}
              className="relative z-10 flex-shrink-0"
            />
            <span
              className="relative z-10 flex-1 text-[12px] font-semibold tracking-wide leading-tight"
              style={{
                fontWeight: isActive ? 700 : 600,
                color: isActive ? '#1A1C1E' : SLATE_MUTED,
              }}
            >
              {label}
            </span>
            <span className="relative z-10">
              <SectionStatusDot status={sectionStatuses[key]} />
            </span>
          </button>
        )
      })}
    </nav>
  )
}
