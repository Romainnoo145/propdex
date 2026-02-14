import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'

interface ResultsLayoutProps {
  scanId: string | null
  children: React.ReactNode
  collapsed: boolean
}

export default function ResultsLayout({ scanId, children, collapsed }: ResultsLayoutProps) {
  // When collapsed, just render the map without panel structure
  if (collapsed || !scanId) {
    return <>{children}</>
  }

  // Full split-panel layout when results are active
  return (
    <div className="h-full w-full">
      <PanelGroup direction="horizontal" autoSaveId="propdex-results">
        {/* Left panel: Results table (placeholder for now) */}
        <Panel defaultSize={45} minSize={25} maxSize={70}>
          <div className="h-full w-full bg-black/40 backdrop-blur-xl p-6 flex flex-col items-center justify-center text-white">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-4"></div>
            <p className="text-lg font-medium">Resultaten laden...</p>
            <p className="text-sm text-white/70 mt-2">Scan ID: {scanId}</p>
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
