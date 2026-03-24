/**
 * SectionShell — accordion/toggle wrapper for Due Diligence Dashboard sections
 *
 * Collapsed: icon + title + status badge + chevron
 * Expanded: section content + notes textarea + PDF export button
 */

import { useState, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, StickyNote, FileDown } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { SectionStatusBadge } from './SectionStatusBadge'
import type { SectionStatus } from './SectionStatusBadge'

interface SectionShellProps {
  title: string
  icon: LucideIcon
  status: SectionStatus
  sectionKey: string
  reportId: string | null
  notes: Record<string, string>
  onNotesChange: (sectionKey: string, text: string) => void
  onExportPDF: () => void
  defaultOpen?: boolean
  children: React.ReactNode
}

export function SectionShell({
  title,
  icon: Icon,
  status,
  sectionKey,
  reportId,
  notes,
  onNotesChange,
  onExportPDF,
  defaultOpen = false,
  children,
}: SectionShellProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [notesOpen, setNotesOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const currentNote = notes[sectionKey] ?? ''

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [currentNote, notesOpen])

  return (
    <div
      className="rounded-[24px] border border-[#EAEFEF] bg-white overflow-hidden"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* Toggle header */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="w-full px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-[#F8FAFA] transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon size={18} strokeWidth={1.5} className="text-[#F9A826] flex-shrink-0" />
          <span className="text-[15px] font-bold text-[#0E1111]">{title}</span>
        </div>
        <div className="flex items-center gap-3">
          <SectionStatusBadge status={status} />
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            <ChevronDown size={18} className="text-[#94a3b8]" />
          </motion.div>
        </div>
      </button>

      {/* Expandable content */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            {/* Section content */}
            <div className="px-6 pb-5 pt-2">{children}</div>

            {/* Action bar */}
            <div className="border-t border-[#EAEFEF] px-6 py-3">
              {/* Notes area */}
              {notesOpen && reportId && (
                <div className="mb-3">
                  <textarea
                    ref={textareaRef}
                    value={currentNote}
                    onChange={(e) => onNotesChange(sectionKey, e.target.value)}
                    placeholder="Voeg notities toe voor deze sectie..."
                    rows={3}
                    className="w-full resize-none rounded-[12px] border border-[#EAEFEF] bg-[#F8FAFA] px-3 py-2 text-[13px] text-[#1A1C1E] placeholder-[#94a3b8] outline-none focus:border-[#EAEFEF] focus:ring-0"
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", minHeight: '72px' }}
                  />
                </div>
              )}

              {/* Buttons row */}
              <div className="flex items-center gap-2">
                {reportId && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setNotesOpen((v) => !v)
                    }}
                    className="flex items-center gap-1.5 rounded-full border border-[#EAEFEF] px-3 py-1.5 text-[12px] font-semibold text-[#94a3b8] transition-colors hover:border-[#EAEFEF] hover:text-[#1A1C1E]"
                  >
                    <StickyNote size={13} strokeWidth={1.5} />
                    <span>{notesOpen ? 'Verberg notities' : 'Notities'}</span>
                  </button>
                )}
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onExportPDF()
                  }}
                  className="flex items-center gap-1.5 rounded-full bg-[#0E1111] px-4 py-1.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
                >
                  <FileDown size={13} strokeWidth={2} />
                  <span>Download PDF</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
