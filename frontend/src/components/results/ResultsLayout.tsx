import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import ResultsTable from './ResultsTable'

interface ResultsLayoutProps {
  scanId: string | null
  children: React.ReactNode
  collapsed: boolean
  onClose?: () => void
}

export default function ResultsLayout({ scanId, children, collapsed, onClose }: ResultsLayoutProps) {
  // When collapsed, just render the map without panel structure
  if (collapsed || !scanId) {
    return <>{children}</>
  }

  // Full split-panel layout when results are active
  return (
    <div className="h-full w-full">
      <PanelGroup direction="horizontal" autoSaveId="propdex-results">
        {/* Left panel: Results table */}
        <Panel defaultSize={45} minSize={25} maxSize={70}>
          <div className="h-full w-full bg-black/40 backdrop-blur-xl flex flex-col overflow-hidden">
            {/* Sticky header with title and close button */}
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
              <h2 className="text-lg font-semibold text-white">Scanresultaten</h2>
              <button
                onClick={onClose}
                className="text-white/60 hover:text-white transition-colors"
                aria-label="Resultaten sluiten"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Table scrolls within remaining space */}
            <div className="flex-1 overflow-hidden">
              <ResultsTable scanId={scanId} />
            </div>
          </div>
        </Panel>

        {/* Resize handle */}
        <PanelResizeHandle className="w-1.5 bg-white/10 hover:bg-white/30 transition-colors cursor-col-resize relative group">
          {/* Grip indicator (3 vertical dots) */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-1 h-1 rounded-full bg-white"></div>
            <div className="w-1 h-1 rounded-full bg-white"></div>
            <div className="w-1 h-1 rounded-full bg-white"></div>
          </div>
        </PanelResizeHandle>

        {/* Right panel: Map */}
        <Panel defaultSize={55} minSize={30}>
          <div className="h-full w-full">
            {children}
          </div>
        </Panel>
      </PanelGroup>
    </div>
  )
}
