/**
 * ChatUnsupported — explanation + request submission for UNSUPPORTED intent.
 */

import { useState } from 'react'
import { MessageSquare, Send, CheckCircle2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useMutation } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/useAuth'
import { apiFetch } from '@/lib/api'

interface Props {
  reason: string
}

export function ChatUnsupported({ reason }: Props) {
  const { accessToken } = useAuth()
  const [submitted, setSubmitted] = useState(false)

  const requestMutation = useMutation({
    mutationFn: () =>
      apiFetch('/api/agents/bulk-request', {
        method: 'POST',
        body: JSON.stringify({ query_text: reason }),
        accessToken,
      }),
    onSuccess: () => {
      setSubmitted(true)
      toast.success('Aanvraag ingediend', {
        description: 'We nemen contact op wanneer de resultaten beschikbaar zijn.',
      })
    },
    onError: () => {
      toast.error('Aanvraag kon niet worden ingediend')
    },
  })

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <MessageSquare size={16} className="text-amber-500 mt-0.5 shrink-0" />
        <p className="text-[13px] text-slate-600">{reason}</p>
      </div>

      {submitted ? (
        <div className="flex items-center gap-1.5 text-[12px] text-green-700">
          <CheckCircle2 size={14} />
          <span className="font-medium">Aanvraag ingediend</span>
        </div>
      ) : (
        <button
          onClick={() => requestMutation.mutate()}
          disabled={requestMutation.isPending}
          className="inline-flex items-center gap-1.5 rounded-full bg-aura-amber px-3 py-1.5 text-[12px] font-medium text-aura-obsidian hover:bg-aura-amber-hover disabled:opacity-50 transition-colors"
        >
          {requestMutation.isPending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Send size={14} />
          )}
          Aanvraag indienen
        </button>
      )}
    </div>
  )
}
