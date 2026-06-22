/**
 * PolicyInsightCard — shows cascade randvoorwaarden from a gemeente beleidsdocument
 * within a rapport section. Violet-50 background.
 */
import { BookOpen } from 'lucide-react'
import type { Randvoorwaarde } from '@/components/map/panels/parcel/OmgevingsvisiePopup'
import { RandvoorwaardenSection } from '@/components/map/panels/parcel/OmgevingsvisiePopup'

interface PolicyInsight {
  sourceKey: string
  label: string
  randvoorwaarden: Randvoorwaarde[]
}

interface PolicyInsightCardProps {
  insights: PolicyInsight[]
}

/**
 * Renders one or more policy document randvoorwaarden relevant to a rapport section.
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
      <RandvoorwaardenSection randvoorwaarden={insight.randvoorwaarden} />
    </div>
  )
}
