import { createFileRoute } from '@tanstack/react-router'
import ResultsShell from '@/components/layout/ResultsShell'
import { AccountSection } from '@/components/settings/AccountSection'
import { PasswordSection } from '@/components/settings/PasswordSection'
import { NotificationsSection } from '@/components/settings/NotificationsSection'
import { AppearanceSection } from '@/components/settings/AppearanceSection'

export const Route = createFileRoute('/_authenticated/instellingen')({
  component: InstellingenPage,
})

function InstellingenPage() {
  return (
    <ResultsShell>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-grey-100">Instellingen</h1>
        <p className="mt-1 text-grey-400">Beheer je account en voorkeuren</p>
      </div>
      <div className="max-w-2xl space-y-8 pb-8">
        <AccountSection />
        <div className="border-t border-grey-800" />
        <PasswordSection />
        <div className="border-t border-grey-800" />
        <NotificationsSection />
        <div className="border-t border-grey-800" />
        <AppearanceSection />
      </div>
    </ResultsShell>
  )
}
