/**
 * Shared read-tracking hook for change notifications
 *
 * Encapsulates read/unread state management, toggle-expand-and-mark-read,
 * and report generation — shared between meldingen.tsx and ChangeTimeline.tsx.
 *
 * Pattern: useMemo for Set (prevents useCallback deps changing on every render)
 */

import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth/useAuth'
import { generateReportFromParcel } from '@/lib/api'
import { useMarkChangeRead } from '@/hooks/useNotifications'

export interface UseReadTrackingOptions {
  readChangeIds: string[] | undefined
}

export interface UseReadTrackingResult {
  readIds: Set<string>
  handleToggle: (
    changeId: string,
    expandedId: string | null,
    setExpandedId: (id: string | null) => void
  ) => void
  handleGenerateReport: (parcelId: string) => Promise<void>
  generatingId: string | null
}

/**
 * Shared hook for read/unread state management and report generation.
 *
 * Used by both meldingen.tsx (full feed) and ChangeTimeline.tsx (per-project).
 *
 * @param options.readChangeIds - Array of already-read change IDs from server
 */
export function useReadTracking({
  readChangeIds,
}: UseReadTrackingOptions): UseReadTrackingResult {
  const navigate = useNavigate()
  const { accessToken } = useAuth()
  const markRead = useMarkChangeRead()
  const [generatingId, setGeneratingId] = useState<string | null>(null)

  // useMemo for Set prevents useCallback deps changing on every render
  const readIds = useMemo(
    () => new Set(readChangeIds ?? []),
    [readChangeIds]
  )

  const handleToggle = useCallback(
    (
      changeId: string,
      expandedId: string | null,
      setExpandedId: (id: string | null) => void
    ) => {
      setExpandedId(expandedId === changeId ? null : changeId)
      if (!readIds.has(changeId)) {
        markRead.mutate(changeId)
      }
    },
    [readIds, markRead]
  )

  const handleGenerateReport = useCallback(
    async (parcelId: string) => {
      setGeneratingId(parcelId)
      try {
        const report = await generateReportFromParcel(parcelId, accessToken)
        navigate({ to: '/rapport/$id', params: { id: String(report.id) } })
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Rapport genereren mislukt'
        )
      } finally {
        setGeneratingId(null)
      }
    },
    [accessToken, navigate]
  )

  return { readIds, handleToggle, handleGenerateReport, generatingId }
}
