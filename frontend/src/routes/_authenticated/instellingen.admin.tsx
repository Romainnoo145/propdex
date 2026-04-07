import { createFileRoute } from '@tanstack/react-router'
import { AiKostenDashboard } from '@/components/admin/AiKostenDashboard'
import { ChatEvaluatieDashboard } from '@/components/admin/ChatEvaluatieDashboard'
import { PromptVerbeteringDashboard } from '@/components/admin/PromptVerbeteringDashboard'

export const Route = createFileRoute('/_authenticated/instellingen/admin')({
  component: AdminDashboardPage,
})

function AdminDashboardPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold text-aura-ink mb-8">AI Kosten Dashboard</h1>
      <AiKostenDashboard />
      <ChatEvaluatieDashboard />
      <PromptVerbeteringDashboard />
    </>
  )
}
