/**
 * ProjectnotitiesGrid — multi-note block (notitie create/edit/delete/list).
 * Extracted from FavoriteParcelWorkspaceView.tsx 2026-05-19 (Plan 08-06 split,
 * M050/S06 cont.). Was named `MultiNoteBlock` pre-split.
 */
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  useCreateNote,
  useDeleteNote,
  useUpdateNote,
  type FavoriteNoteResponse,
} from '@/hooks/useFavorites'

interface ProjectnotitiesGridProps {
  parcelId: string
  notes: FavoriteNoteResponse[]
  isLoading: boolean
  createNote: ReturnType<typeof useCreateNote>
  updateNote: ReturnType<typeof useUpdateNote>
  deleteNote: ReturnType<typeof useDeleteNote>
}

export function ProjectnotitiesGrid({
  parcelId,
  notes,
  isLoading,
  createNote,
  updateNote,
  deleteNote,
}: ProjectnotitiesGridProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [addingNew, setAddingNew] = useState(false)
  const [newText, setNewText] = useState('')

  const handleExpand = (note: FavoriteNoteResponse) => {
    if (expandedId === note.id) {
      setExpandedId(null)
    } else {
      setExpandedId(note.id)
      setEditText(note.content)
    }
    setAddingNew(false)
  }

  const handleSave = (noteId: string) => {
    const trimmed = editText.trim()
    if (!trimmed) return
    updateNote.mutate(
      { parcelId, noteId, content: trimmed },
      {
        onSuccess: () => {
          setExpandedId(null)
          toast.success('Notitie bijgewerkt')
        },
      },
    )
  }

  const handleDelete = (noteId: string) => {
    deleteNote.mutate(
      { parcelId, noteId },
      {
        onSuccess: () => {
          setExpandedId(null)
          toast.success('Notitie verwijderd')
        },
      },
    )
  }

  const handleCreate = () => {
    const trimmed = newText.trim()
    if (!trimmed) return
    createNote.mutate(
      { parcelId, content: trimmed },
      {
        onSuccess: () => {
          setAddingNew(false)
          setNewText('')
          toast.success('Notitie toegevoegd')
        },
      },
    )
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  if (isLoading) {
    return (
      <div className="rounded-[20px] border border-[#EAEFEF] bg-[#F8FAFA] px-4 py-6 text-center text-[13px] text-slate-400">
        Notities laden...
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {notes.map((note) => {
        const isExpanded = expandedId === note.id
        const preview = note.content.length > 80 ? `${note.content.slice(0, 80)}…` : note.content

        return (
          <motion.div
            key={note.id}
            layout
            className="rounded-[16px] border border-[#EAEFEF] bg-[#F8FAFA] overflow-hidden transition-colors hover:border-[#F9A826]/30"
          >
            <button
              type="button"
              onClick={() => handleExpand(note)}
              className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
            >
              <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-slate-700">
                {isExpanded ? '' : preview}
              </p>
              <span className="shrink-0 text-[11px] tabular-nums text-slate-400">
                {formatDate(note.updated_at)}
              </span>
            </button>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 space-y-3">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={4}
                      className="w-full resize-none rounded-[12px] border border-[#EAEFEF] bg-white px-3 py-2.5 text-[14px] leading-6 text-slate-700 placeholder:text-slate-400 focus:border-[#F9A826] focus:outline-none focus:ring-1 focus:ring-[#F9A826]"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <motion.button
                        type="button"
                        onClick={() => handleSave(note.id)}
                        disabled={updateNote.isPending}
                        whileTap={{ scale: 0.96 }}
                        className="inline-flex min-h-[34px] items-center gap-2 rounded-full bg-[#0E1111] px-4 text-[12px] font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
                      >
                        {updateNote.isPending ? <Loader2 size={12} className="animate-spin" /> : null}
                        Opslaan
                      </motion.button>
                      <motion.button
                        type="button"
                        onClick={() => handleDelete(note.id)}
                        disabled={deleteNote.isPending}
                        whileTap={{ scale: 0.96 }}
                        className="inline-flex min-h-[34px] items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 text-[12px] font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
                      >
                        {deleteNote.isPending ? <Loader2 size={12} className="animate-spin" /> : null}
                        <Trash2 size={12} />
                        Verwijderen
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )
      })}

      <AnimatePresence>
        {addingNew && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="rounded-[16px] border border-[#F9A826]/40 bg-[#FFFDF8] px-4 py-4 space-y-3">
              <textarea
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                placeholder="Waarom is dit perceel interessant? Welke strategie lijkt kansrijk?"
                rows={4}
                className="w-full resize-none rounded-[12px] border border-[#EAEFEF] bg-white px-3 py-2.5 text-[14px] leading-6 text-slate-700 placeholder:text-slate-400 focus:border-[#F9A826] focus:outline-none focus:ring-1 focus:ring-[#F9A826]"
                autoFocus
              />
              <div className="flex gap-2">
                <motion.button
                  type="button"
                  onClick={handleCreate}
                  disabled={createNote.isPending || !newText.trim()}
                  whileTap={{ scale: 0.96 }}
                  className="inline-flex min-h-[34px] items-center gap-2 rounded-full bg-[#0E1111] px-4 text-[12px] font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
                >
                  {createNote.isPending ? <Loader2 size={12} className="animate-spin" /> : null}
                  Opslaan
                </motion.button>
                <button
                  type="button"
                  onClick={() => {
                    setAddingNew(false)
                    setNewText('')
                  }}
                  className="inline-flex min-h-[34px] items-center rounded-full border border-[#EAEFEF] px-4 text-[12px] font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                >
                  Annuleren
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!addingNew && (
        <motion.button
          type="button"
          onClick={() => {
            setAddingNew(true)
            setExpandedId(null)
          }}
          whileTap={{ scale: 0.97 }}
          className="flex w-full items-center justify-center gap-2 rounded-[16px] border border-dashed border-[#EAEFEF] bg-[#F8FAFA] px-4 py-3 text-[12px] font-semibold text-slate-500 transition-colors hover:border-[#F9A826]/40 hover:bg-[#FFFDF8] hover:text-[#0E1111]"
        >
          <Plus size={16} strokeWidth={2.5} />
          Notitie toevoegen
        </motion.button>
      )}
    </div>
  )
}
