/**
 * OnderzoekPhaseView — fase-1 (Onderzoek) cockpit shell.
 * Successor to FavoriteParcelWorkspaceView 2026-05-19 (Plan 08-06 split, M050/S06 cont.).
 *
 * Composes: ParcelWorkspaceHeader + AanpakCard + DossierSection + WorkspaceInsightCard
 * (timeline) + WorkspaceContactModal + PotentieModal + RisicoModal + PdfViewerDrawer.
 * Shell owns ALL state + handlers; children are presentational.
 *
 * Plan 08-07 will modify AanpakCard.tsx CTA copy; this shell stays stable.
 */
import { useCallback, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { toast } from 'sonner'
import { useNavigate } from '@tanstack/react-router'
import { useDeleteDocument, useParcelDocuments, useUploadDocument } from '@/hooks/useDocuments'
import { useFavoriteNotes, useCreateNote, useUpdateNote, useDeleteNote } from '@/hooks/useFavorites'
import { useGenerateReportFromParcel } from '@/hooks/useReports'
import { getDocumentDownloadUrl } from '@/lib/api'
import { useAuth } from '@/lib/auth/useAuth'
import type { FavoriteResponse } from '@/lib/types/portfolio'
import { PotentieModal, RisicoModal } from '@/components/projects/ScoreDetailModal'
import { PdfViewerDrawer } from '@/components/ui/PdfViewerDrawer'
import { AanpakCard } from './AanpakCard'
import { ParcelWorkspaceHeader } from './ParcelWorkspaceHeader'
import { WorkspaceContactModal } from './WorkspaceContactModal'
import { DossierSection } from './DossierSection'
import { ActivityTimelineCard } from './ActivityTimelineCard'
import { buildPages, flattenCards, mergeDocuments } from '@/lib/cockpit/dossier-pages'
import {
  deriveActivityRows,
  deriveContactFollowUp,
  deriveMissingCards,
  deriveNextStep,
} from '@/lib/cockpit/cockpit-derivations'

const ACCEPTED_TYPES = '.pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx'

export function OnderzoekPhaseView({
  favorite,
  onBack,
  onOpenMap,
}: {
  favorite: FavoriteResponse
  onBack: () => void
  onOpenMap: () => void
}) {
  const [page, setPage] = useState(0)
  const [uploadingKey, setUploadingKey] = useState<string | null>(null)
  const [, setDeletingId] = useState<string | null>(null)
  const [pdfViewer, setPdfViewer] = useState<{ url: string; title: string } | null>(null)
  const [showContactModal, setShowContactModal] = useState(false)
  const [scoreModal, setScoreModal] = useState<'potentie' | 'risico' | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const activeCardKeyRef = useRef<string | null>(null)

  const { accessToken } = useAuth()
  const documentsQuery = useParcelDocuments(favorite.parcel_id)
  const uploadDocument = useUploadDocument()
  const deleteDocument = useDeleteDocument()
  const notesQuery = useFavoriteNotes(favorite.parcel_id)
  const createNote = useCreateNote()
  const updateNote = useUpdateNote()
  const deleteNote = useDeleteNote()
  const generateReport = useGenerateReportFromParcel()
  const navigate = useNavigate()

  const rawPages = useMemo(() => buildPages(favorite), [favorite])
  const userDocs = documentsQuery.data?.documents ?? []
  const pages = useMemo(() => mergeDocuments(rawPages, userDocs), [rawPages, userDocs])
  const allCards = useMemo(() => flattenCards(pages), [pages])
  const missingCards = useMemo(() => deriveMissingCards(allCards), [allCards])
  const nextStep = useMemo(
    () => deriveNextStep(favorite, allCards, missingCards),
    [favorite, allCards, missingCards],
  )
  const contactFollowUp = useMemo(
    () => deriveContactFollowUp(favorite, allCards),
    [favorite, allCards],
  )
  const activityRows = useMemo(
    () => deriveActivityRows(favorite, userDocs, allCards),
    [favorite, userDocs, allCards],
  )

  const handleGenerateReport = useCallback(() => {
    if (favorite.has_report && favorite.report_id) {
      navigate({ to: '/rapport/$id', params: { id: favorite.report_id } })
      return
    }
    if (!favorite.parcel_cache_id) {
      toast.error('Perceel niet gekoppeld aan een scan — open het eerst op de kaart')
      return
    }
    generateReport.mutate(favorite.parcel_cache_id, {
      onSuccess: (data) => {
        toast.success('Rapport gegenereerd — je wordt doorgestuurd')
        navigate({ to: '/rapport/$id', params: { id: data.report.id } })
      },
      onError: (err) => {
        toast.error(err.message || 'Rapport genereren mislukt')
      },
    })
  }, [favorite.has_report, favorite.report_id, favorite.parcel_cache_id, generateReport, navigate])

  const doUpload = useCallback(
    async (file: File, cardKey: string) => {
      setUploadingKey(cardKey)
      try {
        await uploadDocument.mutateAsync({
          parcelId: favorite.parcel_id,
          documentType: cardKey,
          file,
        })
        toast.success('Document toegevoegd aan workspace')
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Upload mislukt')
      } finally {
        setUploadingKey(null)
        activeCardKeyRef.current = null
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    },
    [favorite.parcel_id, uploadDocument],
  )

  const handleUploadClick = useCallback((cardKey: string) => {
    activeCardKeyRef.current = cardKey
    fileInputRef.current?.click()
  }, [])

  const handleFileDrop = useCallback(
    async (cardKey: string, file: File) => {
      activeCardKeyRef.current = cardKey
      await doUpload(file, cardKey)
    },
    [doUpload],
  )

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      const cardKey = activeCardKeyRef.current
      if (!file || !cardKey) return
      await doUpload(file, cardKey)
    },
    [doUpload],
  )

  const handleDelete = useCallback(
    async (documentId: string) => {
      setDeletingId(documentId)
      try {
        await deleteDocument.mutateAsync({ parcelId: favorite.parcel_id, documentId })
        toast.success('Document verwijderd')
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Verwijderen mislukt')
      } finally {
        setDeletingId(null)
      }
    },
    [deleteDocument, favorite.parcel_id],
  )

  const handleDownload = useCallback(
    async (documentId: string, filename: string) => {
      try {
        const headers: HeadersInit = {}
        if (accessToken) headers.Authorization = `Bearer ${accessToken}`
        const response = await fetch(getDocumentDownloadUrl(favorite.parcel_id, documentId), {
          method: 'GET',
          headers,
          credentials: 'include',
        })
        if (!response.ok) throw new Error('Download mislukt')
        const blob = await response.blob()
        const blobUrl = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = blobUrl
        anchor.download = filename
        document.body.appendChild(anchor)
        anchor.click()
        document.body.removeChild(anchor)
        URL.revokeObjectURL(blobUrl)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Download mislukt')
      }
    },
    [accessToken, favorite.parcel_id],
  )

  const handleView = useCallback(
    (documentId: string, filename?: string) => {
      setPdfViewer({
        url: getDocumentDownloadUrl(favorite.parcel_id, documentId),
        title: filename || 'Document',
      })
    },
    [favorite.parcel_id],
  )

  return (
    <div className="pb-8">
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        className="hidden"
        onChange={handleFileChange}
      />

      <ParcelWorkspaceHeader
        favorite={favorite}
        onBack={onBack}
        onOpenMap={onOpenMap}
        onScoreClick={setScoreModal}
      />

      <AanpakCard
        nextStep={nextStep}
        favorite={favorite}
        parcelId={favorite.parcel_id}
        onGenerateReport={handleGenerateReport}
        onOpenContact={() => setShowContactModal(true)}
        isGeneratingReport={generateReport.isPending}
      />

      <DossierSection
        pages={pages}
        page={page}
        onPageChange={setPage}
        isLoadingDocuments={documentsQuery.isLoading}
        documentsError={documentsQuery.isError ? documentsQuery.error : null}
        uploadingKey={uploadingKey}
        onUploadClick={handleUploadClick}
        onFileDrop={handleFileDrop}
        onDelete={(documentId) => void handleDelete(documentId)}
        onDownload={handleDownload}
        onView={handleView}
        parcelId={favorite.parcel_id}
        notes={notesQuery.data ?? []}
        isLoadingNotes={notesQuery.isLoading}
        createNote={createNote}
        updateNote={updateNote}
        deleteNote={deleteNote}
      />

      <ActivityTimelineCard rows={activityRows} />

      {showContactModal && (
        <WorkspaceContactModal
          favorite={favorite}
          contactFollowUp={contactFollowUp}
          hasEigendom={allCards.some((c) => c.key === 'eigendom' && c.filled)}
          onClose={() => setShowContactModal(false)}
          onOpenMap={() => {
            setShowContactModal(false)
            onOpenMap()
          }}
        />
      )}

      <PotentieModal
        open={scoreModal === 'potentie'}
        onClose={() => setScoreModal(null)}
        parcelCacheId={favorite.parcel_cache_id}
      />
      <RisicoModal
        open={scoreModal === 'risico'}
        onClose={() => setScoreModal(null)}
        parcelCacheId={favorite.parcel_cache_id}
      />
      {pdfViewer && (
        <PdfViewerDrawer
          url={pdfViewer.url}
          title={pdfViewer.title}
          onClose={() => setPdfViewer(null)}
        />
      )}
    </div>
  )
}
