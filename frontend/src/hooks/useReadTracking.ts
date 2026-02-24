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
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth/useAuth'
import { generateReportFromAddress, generateReportFromParcel } from '@/lib/api'
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
  handleGenerateReport: (parcelId: string, projectId?: string) => Promise<void>
  handleGenerateReportByAddress: (input: {
    postcode: string
    huisnummer: number
    projectId?: string
  }) => Promise<void>
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
  const queryClient = useQueryClient()
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
    async (parcelId: string, projectId?: string) => {
      setGeneratingId(parcelId)
      try {
        const report = await generateReportFromParcel(parcelId, accessToken, {
          ...(projectId && { project_id: projectId }),
        })
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['reports'] }),
          queryClient.invalidateQueries({ queryKey: ['projects'] }),
        ])
        navigate({ to: '/rapport/$id', params: { id: String(report.id) } })
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Rapport genereren mislukt'
        )
      } finally {
        setGeneratingId(null)
      }
    },
    [accessToken, navigate, queryClient]
  )

  const handleGenerateReportByAddress = useCallback(
    async ({
      postcode,
      huisnummer,
      projectId,
    }: {
      postcode: string
      huisnummer: number
      projectId?: string
    }) => {
      const generationKey = `addr:${postcode.replace(/\s/g, '').toUpperCase()}:${huisnummer}`
      setGeneratingId(generationKey)
      try {
        const report = await generateReportFromAddress(
          {
            postcode,
            huisnummer,
            ...(projectId && { project_id: projectId }),
          },
          accessToken
        )
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['reports'] }),
          queryClient.invalidateQueries({ queryKey: ['projects'] }),
        ])
        navigate({ to: '/rapport/$id', params: { id: String(report.id) } })
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Rapport genereren mislukt'
        )
      } finally {
        setGeneratingId(null)
      }
    },
    [accessToken, navigate, queryClient]
  )

  return {
    readIds,
    handleToggle,
    handleGenerateReport,
    handleGenerateReportByAddress,
    generatingId,
  }
}
