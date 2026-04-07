/**
 * PDFViewerModal — Reusable fullscreen modal that fetches an authenticated PDF
 * and renders it in an embedded iframe.
 *
 * Follows the proven pattern from AIAnalysisModal (createPortal, AnimatePresence,
 * capture-phase Escape, blob fetch with auth header, object URL lifecycle).
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ExternalLink, RefreshCw } from 'lucide-react'
import { useAuth } from '@/lib/auth/useAuth'

export interface PDFViewerModalProps {
  /** API endpoint URL to fetch the PDF from (e.g. `/api/policy-documents/...`) */
  url: string
  /** Optional document title shown in the modal header */
  title?: string
  /** Callback to close the modal */
  onClose: () => void
}

const prefersReducedMotion =
  typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false

export function PDFViewerModal({ url, title, onClose }: PDFViewerModalProps) {
  const { accessToken } = useAuth()
  const [pdfObjectUrl, setPdfObjectUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPdf = useCallback(
    (signal?: AbortSignal) => {
      if (!accessToken) return

      setLoading(true)
      setError(null)

      fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        credentials: 'include',
        signal,
      })
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          return r.blob()
        })
        .then((blob) => {
          const objectUrl = URL.createObjectURL(blob)
          setPdfObjectUrl(objectUrl)
          setLoading(false)
        })
        .catch((err) => {
          if (err instanceof DOMException && err.name === 'AbortError') return
          setError(err instanceof Error ? err.message : 'Kon PDF niet laden')
          setLoading(false)
        })
    },
    [url, accessToken],
  )

  // Fetch PDF blob with auth and create object URL
  useEffect(() => {
    const controller = new AbortController()
    fetchPdf(controller.signal)

    return () => {
      controller.abort()
    }
  }, [fetchPdf])

  // Revoke object URL on unmount or when it changes
  useEffect(() => {
    return () => {
      if (pdfObjectUrl) URL.revokeObjectURL(pdfObjectUrl)
    }
  }, [pdfObjectUrl])

  // Close on Escape — capture phase to prevent parent panel closes
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopImmediatePropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', handler, true)
    return () => document.removeEventListener('keydown', handler, true)
  }, [onClose])

  const handleRetry = () => {
    // Revoke old URL before retrying
    if (pdfObjectUrl) {
      URL.revokeObjectURL(pdfObjectUrl)
      setPdfObjectUrl(null)
    }
    fetchPdf()
  }

  const displayTitle = title || 'Document'

  return createPortal(
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="pdf-viewer-modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-md"
        onClick={onClose}
      >
        {/* Content */}
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="relative flex w-full max-w-6xl flex-col rounded-[32px] bg-[#F8FAFA] shadow-2xl mx-4 max-h-[calc(100vh-64px)]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Header ── */}
          <div className="flex items-center justify-between px-8 pt-7 pb-4 shrink-0">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                Document viewer
              </p>
              <h2 className="text-[18px] font-bold text-[#0E1111] mt-0.5">{displayTitle}</h2>
            </div>
            <div className="flex items-center gap-2">
              {/* Open in new tab fallback */}
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-500 transition-colors hover:text-[#0E1111] hover:bg-slate-50"
              >
                <ExternalLink size={14} />
                Open in nieuw tabblad
              </a>
              {/* Close button */}
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0E1111] text-white transition-colors hover:bg-[#0E1111]/80"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* ── Body ── */}
          <div className="flex-1 min-h-0 px-8 pb-6 flex flex-col" style={{ minHeight: '60vh' }}>
            {loading && (
              <div className="flex flex-1 items-center justify-center">
                <div className="animate-spin h-6 w-6 border-2 border-aura-amber border-t-transparent rounded-full" />
                <p className="ml-3 text-[13px] text-slate-500">PDF laden...</p>
              </div>
            )}

            {error && !loading && (
              <div className="flex flex-1 flex-col items-center justify-center text-center gap-3">
                <p className="text-[13px] text-red-600">Fout bij het laden van de PDF: {error}</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="flex items-center gap-1.5 rounded-full bg-[#0E1111] px-4 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-[#0E1111]/80"
                  >
                    <RefreshCw size={14} />
                    Opnieuw proberen
                  </button>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-[12px] font-semibold text-slate-500 transition-colors hover:text-[#0E1111]"
                  >
                    <ExternalLink size={14} />
                    Open in nieuw tabblad
                  </a>
                </div>
              </div>
            )}

            {pdfObjectUrl && !loading && !error && (
              <iframe
                src={pdfObjectUrl}
                className="w-full flex-1 rounded-[16px] border border-[#EAEFEF]"
                title={displayTitle}
              />
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}
