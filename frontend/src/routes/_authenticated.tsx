import { useState } from 'react'
import { createFileRoute, Outlet, redirect, useNavigate } from '@tanstack/react-router'
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
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleToggleSidebar = () => {
    setSidebarOpen((prev) => !prev)
  }

  const handleSelectReport = (reportId: string) => {
    // Navigate to map with reportId - map.tsx will handle loading and display
    navigate({
      to: '/map',
      search: { reportId },
    })
    setSidebarOpen(false)
  }

  const handleSelectRecent = (item: RecentItem) => {
    navigate({
      to: '/map',
      search: {
        postcode: item.postcode,
        huisnummer: item.huisnummer,
      },
    })
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
      <main className="flex-1 relative overflow-hidden bg-gray-950">
        <Outlet />
      </main>
    </div>
  )
}
