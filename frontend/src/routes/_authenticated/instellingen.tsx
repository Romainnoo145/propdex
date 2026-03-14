import { createFileRoute } from '@tanstack/react-router'
import ResultsShell from '@/components/layout/ResultsShell'
import { AccountSection } from '@/components/settings/AccountSection'
import { PasswordSection } from '@/components/settings/PasswordSection'
import { NotificationsSection } from '@/components/settings/NotificationsSection'
import { AppearanceSection } from '@/components/settings/AppearanceSection'
import { SettingsTabNav } from '@/components/settings/SettingsTabNav'

export const Route = createFileRoute('/_authenticated/instellingen')({
  component: InstellingenPage,
})

function InstellingenPage() {
  return (
    <ResultsShell>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-aura-ink">Instellingen</h1>
        <p className="mt-1 text-neutral-600">Beheer je account en voorkeuren</p>
      </div>
      <SettingsTabNav />
      <div className="mt-6 max-w-2xl space-y-8 pb-8">
        <AccountSection />
        <div className="border-t border-neutral-200" />
        <PasswordSection />
        <div className="border-t border-neutral-200" />
        <NotificationsSection />
        <div className="border-t border-neutral-200" />
        <AppearanceSection />
      </div>
    </ResultsShell>
  )
}
