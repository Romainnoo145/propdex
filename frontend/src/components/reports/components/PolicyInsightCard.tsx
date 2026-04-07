/**
 * PolicyInsightCard — shows an AI summary from a gemeente beleidsdocument
 * within a rapport section. Violet-50 background, collapsible.
 */
import { useState } from 'react'
import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react'

interface PolicyInsight {
  sourceKey: string
  label: string
  summary: string
}

interface PolicyInsightCardProps {
  insights: PolicyInsight[]
}

const MAX_CHARS = 280

/**
 * Renders one or more policy document AI summaries relevant to a rapport section.
 * Shows nothing if insights array is empty.
 */
export function PolicyInsightCard({ insights }: PolicyInsightCardProps) {
  if (insights.length === 0) return null

  return (
    <div className="mt-4 space-y-3">
      {insights.map((insight) => (
        <SingleInsight key={insight.sourceKey} insight={insight} />
      ))}
    </div>
  )
}

function SingleInsight({ insight }: { insight: PolicyInsight }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = insight.summary.length > MAX_CHARS
  const displayText = expanded || !isLong ? insight.summary : insight.summary.slice(0, MAX_CHARS) + '…'

  return (
    <div className="rounded-[12px] border border-violet-200 bg-violet-50 p-4">
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-100">
          <BookOpen size={14} className="text-violet-600" />
        </div>
        <span className="text-[13px] font-semibold text-violet-900">
          Gemeentelijk beleid — {insight.label}
        </span>
      </div>
      <p className="text-[13px] leading-relaxed text-violet-800 whitespace-pre-line">
        {displayText}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 flex items-center gap-1 text-[12px] font-medium text-violet-600 hover:text-violet-800 transition-colors"
        >
          {expanded ? (
            <>
              Minder tonen <ChevronUp size={14} />
            </>
          ) : (
            <>
              Meer lezen <ChevronDown size={14} />
            </>
          )}
        </button>
      )}
    </div>
  )
}
