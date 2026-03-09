import { useEffect, useState } from 'react'
import { Command } from 'cmdk'
import { DEFAULT_SEARCH_INPUT_PROPS } from '@/components/primitives'
import type { ReportListItem } from '@/lib/types/report'

interface ReportSearchProps {
  onSelectReport: (reportId: string) => void
  reports: ReportListItem[]
}

/**
 * Cmd+K command palette search using cmdk.
 *
 * Inline search in sidebar (NOT dialog).
 * Groups reports by project for better organization.
 * Registers global Cmd+K / Ctrl+K shortcut to focus input.
 */
export default function ReportSearch({
  onSelectReport,
  reports,
}: ReportSearchProps) {
  const [searchValue, setSearchValue] = useState('')
  const [inputRef, setInputRef] = useState<HTMLInputElement | null>(null)

  // Register Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef?.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [inputRef])

  // Group reports by project
  const groupedReports = reports.reduce(
    (acc, report) => {
      const key = report.project_id || 'Geen project'
      if (!acc[key]) {
        acc[key] = []
      }
      acc[key].push(report)
      return acc
    },
    {} as Record<string, ReportListItem[]>
  )

  return (
    <Command className="rounded-lg border border-neutral-200 bg-aura-glass-white/40">
      <div className="flex items-center border-b border-neutral-200 px-3">
        <SearchIcon />
        <Command.Input
          ref={setInputRef}
          value={searchValue}
          onValueChange={setSearchValue}
          placeholder="Zoek rapporten... (⌘K)"
          {...DEFAULT_SEARCH_INPUT_PROPS}
          name="q_sidebar_reports"
          className="w-full border-0 bg-transparent py-3 pl-2 text-sm text-aura-ink outline-none placeholder:text-neutral-500"
        />
      </div>

      <Command.List className="max-h-64 overflow-y-auto p-2">
        <Command.Empty className="py-6 text-center text-sm text-neutral-500">
          Geen resultaten
        </Command.Empty>

        {Object.entries(groupedReports).map(([projectName, projectReports]) => (
          <Command.Group
            key={projectName}
            heading={projectName}
            className="mb-2"
          >
            <div className="mb-1 px-2 text-xs text-neutral-500">
              {projectName}
            </div>
            {projectReports.map((report) => (
              <Command.Item
                key={report.id}
                value={`${report.report_name} ${report.postcode} ${report.city}`}
                onSelect={() => onSelectReport(report.id)}
                className="cursor-pointer rounded-lg px-3 py-2 text-sm text-neutral-700 transition-colors data-[selected=true]:bg-neutral-200 data-[selected=true]:text-aura-ink"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{report.report_name}</p>
                    <p className="text-xs text-neutral-500">
                      {report.postcode}, {report.city}
                    </p>
                  </div>
                  <span className="ml-2 text-xs text-neutral-500">
                    {Math.round(report.completeness_score * 100)}%
                  </span>
                </div>
              </Command.Item>
            ))}
          </Command.Group>
        ))}
      </Command.List>
    </Command>
  )
}

// Search icon
function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-neutral-500"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  )
}
