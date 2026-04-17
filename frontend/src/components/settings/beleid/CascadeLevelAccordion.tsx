/**
 * CascadeLevelAccordion — M045/S05
 *
 * One toggle per cascade level (Landelijk / Provinciaal / Gemeentelijk).
 * Mirrors the AccordionLevelCard pattern from routes/_authenticated/beleid.tsx:
 * icon pill, title + description, count, chevron, framer-motion height expand.
 */
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'

interface Props {
  icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
  title: string
  description: string
  count: string
  isOpen: boolean
  onToggle: () => void
  children: ReactNode
}

export function CascadeLevelAccordion({
  icon: Icon,
  title,
  description,
  count,
  isOpen,
  onToggle,
  children,
}: Props) {
  return (
    <div className="rounded-[20px] border border-[#EAEFEF] bg-white overflow-hidden transition-shadow hover:shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-[#FAFCFB]"
      >
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#0E1111]">
          <Icon size={18} strokeWidth={1.5} className="text-[#F9A826]" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-bold text-[#0E1111]">{title}</h3>
          <p className="text-[12px] text-slate-500 leading-snug mt-0.5">{description}</p>
        </div>
        <span className="text-[13px] font-bold text-slate-400 tabular-nums shrink-0">
          {count}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0"
        >
          <ChevronDown size={18} className="text-slate-400" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="border-t border-[#EAEFEF] px-5 py-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
