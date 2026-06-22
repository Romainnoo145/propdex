'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Download, Trash2, Upload, RefreshCw, ExternalLink, Minus, Plus } from 'lucide-react'
import { useAuth } from '@/lib/auth/useAuth'
import { type ZoomLevel, nextZoom, prevZoom, zoomLabel, zoomToPdfParam } from '@/lib/pdf-zoom'

export interface PdfViewerFile {
  id: string
  filename: string
  meta?: string
}

export interface PdfViewerDrawerProps {
  url: string
  title: string
  eyebrow?: string
  onClose: () => void
  files?: PdfViewerFile[]
  activeId?: string
  onSelectFile?: (id: string) => void
  onDownload?: () => void
  onDelete?: () => void
  onUpload?: () => void
}

const IMAGE_RE = /\.(png|jpe?g|webp|gif)$/i

export function PdfViewerDrawer({
  url, title, eyebrow = 'Document viewer', onClose,
  files, activeId, onSelectFile, onDownload, onDelete, onUpload,
}: PdfViewerDrawerProps) {
  const { accessToken } = useAuth()
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [zoom, setZoom] = useState<ZoomLevel>('fit')
  const isImage = IMAGE_RE.test(title)

  const fetchDoc = useCallback(async (signal?: AbortSignal) => {
    if (!accessToken) return
    await Promise.resolve()
    if (signal?.aborted) return
    setLoading(true)
    setError(null)
    try {
      const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, credentials: 'include', signal })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const blob = await r.blob()
      setObjectUrl(URL.createObjectURL(blob))
      setLoading(false)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Kon document niet laden')
      setLoading(false)
    }
  }, [url, accessToken])

  useEffect(() => {
    const c = new AbortController()
    void fetchDoc(c.signal)
    return () => c.abort()
  }, [fetchDoc])

  useEffect(() => {
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [objectUrl])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); onClose() }
    }
    document.addEventListener('keydown', handler, true)
    return () => document.removeEventListener('keydown', handler, true)
  }, [onClose])

  const iframeSrc = objectUrl ? `${objectUrl}#zoom=${zoomToPdfParam(zoom)}&toolbar=0` : ''

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="pdf-drawer-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[60] flex items-stretch justify-end bg-black/30 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="relative flex h-full w-[52vw] min-w-[840px] max-w-[1100px] flex-col rounded-l-[32px] bg-[#F8FAFA] shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-7 py-5">
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400">{eyebrow}</p>
              <h2 className="mt-0.5 truncate text-[18px] font-bold text-[#0E1111]">{title}</h2>
            </div>
            <div className="flex items-center gap-2">
              {!isImage && (
                <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1">
                  <button type="button" aria-label="Uitzoomen" onClick={() => setZoom(prevZoom(zoom))} className="flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-[#0E1111]"><Minus size={15} /></button>
                  <span className="min-w-[58px] text-center text-[12px] font-bold tabular-nums text-slate-600">{zoomLabel(zoom)}</span>
                  <button type="button" aria-label="Inzoomen" onClick={() => setZoom(nextZoom(zoom))} className="flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-[#0E1111]"><Plus size={15} /></button>
                </div>
              )}
              {onDownload && <button type="button" aria-label="Download" onClick={onDownload} className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 hover:text-[#0E1111]"><Download size={16} /></button>}
              {onDelete && <button type="button" aria-label="Verwijderen" onClick={onDelete} className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>}
              <button type="button" aria-label="Sluiten" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0E1111] text-white hover:bg-[#0E1111]/80"><X size={16} /></button>
            </div>
          </div>

          {/* Body: optional rail + viewport */}
          <div className="flex min-h-0 flex-1">
            {files && files.length > 0 && (
              <div className="flex w-[230px] shrink-0 flex-col gap-1.5 overflow-y-auto border-r border-slate-100 p-3.5">
                <p className="mb-1 px-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">{files.length} bestand{files.length > 1 ? 'en' : ''}</p>
                {files.map((f) => (
                  <button
                    key={f.id} type="button" onClick={() => onSelectFile?.(f.id)}
                    className={`flex items-center gap-2.5 rounded-[14px] p-2.5 text-left transition-colors ${f.id === activeId ? 'bg-amber-100' : 'hover:bg-white'}`}
                  >
                    <span className="truncate">
                      <span className={`block truncate text-[12px] font-bold ${f.id === activeId ? 'text-amber-900' : 'text-slate-900'}`}>{f.filename}</span>
                      {f.meta && <span className="block text-[10px] text-slate-400">{f.meta}</span>}
                    </span>
                  </button>
                ))}
                {onUpload && (
                  <button type="button" onClick={onUpload} className="mt-1 flex items-center justify-center gap-1.5 rounded-[14px] border border-dashed border-slate-300 p-2.5 text-[11px] font-extrabold uppercase tracking-wide text-slate-400 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700">
                    <Upload size={13} /> Toevoegen
                  </button>
                )}
              </div>
            )}

            <div className="flex flex-1 justify-center overflow-y-auto bg-[#ECEFF1] p-7">
              {loading && (
                <div className="flex items-center self-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-aura-amber border-t-transparent" />
                  <p className="ml-3 text-[13px] text-slate-500">Document laden…</p>
                </div>
              )}
              {error && !loading && (
                <div className="flex flex-col items-center gap-3 self-center text-center">
                  <p className="text-[13px] text-red-600">Fout bij het laden: {error}</p>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => { if (objectUrl) { URL.revokeObjectURL(objectUrl); setObjectUrl(null) } void fetchDoc() }} className="flex items-center gap-1.5 rounded-full bg-[#0E1111] px-4 py-1.5 text-[12px] font-semibold text-white hover:bg-[#0E1111]/80"><RefreshCw size={14} /> Opnieuw</button>
                    <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-[12px] font-semibold text-slate-500 hover:text-[#0E1111]"><ExternalLink size={14} /> Nieuw tabblad</a>
                  </div>
                </div>
              )}
              {objectUrl && !loading && !error && (
                isImage ? (
                  <img src={objectUrl} alt={title} className="h-fit max-w-full rounded-[4px] bg-white shadow-[0_6px_24px_rgba(0,0,0,0.12)]" />
                ) : (
                  <iframe src={iframeSrc} title={title} className="h-full w-full max-w-[820px] rounded-[4px] border-0 bg-white shadow-[0_6px_24px_rgba(0,0,0,0.12)]" />
                )
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}
