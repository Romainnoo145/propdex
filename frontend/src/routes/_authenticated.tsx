import { useState } from 'react'
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import SideRailNav from '@/components/layout/SideRailNav'
import ReportSidebar from '@/components/layout/ReportSidebar'
import type { RecentItem } from '@/hooks/useRecentViewed'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({
        to: '/auth',
        search: {
          redirect: location.href,
        },
      })
    }
  },
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleToggleSidebar = () => {
    setSidebarOpen((prev) => !prev)
  }

  const handleSelectReport = (reportId: string) => {
    // TODO: Implement report selection
    // - Fetch report data
    // - Extract coordinates from report_data
    // - Trigger map flyTo
    // - Open drawer with report details
    console.log('Selected report:', reportId)
    setSidebarOpen(false)
  }

  const handleSelectRecent = (item: RecentItem) => {
    // TODO: Implement recent item selection
    // - Fetch property data by nummeraanduiding_id
    // - Trigger map flyTo
    // - Open drawer with property details
    console.log('Selected recent item:', item)
    setSidebarOpen(false)
  }

  return (
    <div className="flex h-screen">
      <SideRailNav
        sidebarOpen={sidebarOpen}
        onToggleSidebar={handleToggleSidebar}
      />
      <ReportSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSelectReport={handleSelectReport}
        onSelectRecent={handleSelectRecent}
      />
      <main className="flex-1 relative overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
