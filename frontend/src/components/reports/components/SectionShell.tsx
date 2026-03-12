/**
 * SectionShell — consistent section wrapper for Due Diligence Dashboard
 *
 * Provides: icon + title header, content area, collapsible notes textarea,
 * and PDF export button in the action bar.
 */

import { useState, useRef, useEffect } from 'react'
import { StickyNote, FileDown } from 'lucide-react'
import { SectionStatusBadge } from './SectionStatusBadge'
import type { SectionStatus } from './SectionStatusBadge'

interface SectionShellProps {
  title: string
  icon: React.ReactNode
  status: SectionStatus
  sectionKey: string
  reportId: string | null
  notes: Record<string, string>
  onNotesChange: (sectionKey: string, text: string) => void
  onExportPDF: () => void
  children: React.ReactNode
}

export function SectionShell({
  title,
  icon,
  status,
  sectionKey,
  reportId,
  notes,
  onNotesChange,
  onExportPDF,
  children,
}: SectionShellProps) {
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
      className="flex flex-col h-full"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-neutral-100 flex-shrink-0">
        <span className="text-neutral-500 flex-shrink-0">{icon}</span>
        <h2
          className="flex-1 text-sm font-bold tracking-wide text-[#1A1C1E]"
          style={{ letterSpacing: '0.02em' }}
        >
          {title}
        </h2>
        <SectionStatusBadge status={status} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

      {/* Action bar */}
      <div className="flex-shrink-0 border-t border-neutral-100 px-6 py-3">
        {/* Notes area */}
        {notesOpen && reportId && (
          <div className="mb-3">
            <textarea
              ref={textareaRef}
              value={currentNote}
              onChange={(e) => onNotesChange(sectionKey, e.target.value)}
              placeholder="Voeg notities toe voor deze sectie..."
              rows={3}
              className="w-full resize-none rounded-[12px] border border-neutral-200 bg-[#F2F6F3] px-3 py-2 text-[13px] text-[#1A1C1E] placeholder-neutral-400 outline-none focus:border-neutral-300 focus:ring-0"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", minHeight: '72px' }}
            />
          </div>
        )}

        {/* Buttons row */}
        <div className="flex items-center gap-2">
          {reportId && (
            <button
              type="button"
              onClick={() => setNotesOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-full border border-neutral-200 px-3 py-1.5 text-[12px] font-semibold text-neutral-500 transition-colors hover:border-neutral-300 hover:text-neutral-700"
            >
              <StickyNote size={13} strokeWidth={1.5} />
              <span>{notesOpen ? 'Verberg notities' : 'Notities'}</span>
            </button>
          )}
          <div className="flex-1" />
          <button
            type="button"
            onClick={onExportPDF}
            className="flex items-center gap-1.5 rounded-full bg-[#0E1111] px-4 py-1.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            <FileDown size={13} strokeWidth={2} />
            <span>Exporteer volledig dossier als PDF</span>
          </button>
        </div>
      </div>
    </div>
  )
}
