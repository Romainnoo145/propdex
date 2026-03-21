import { createFileRoute } from '@tanstack/react-router'
import { AccountSection } from '@/components/settings/AccountSection'
import { PasswordSection } from '@/components/settings/PasswordSection'
import { NotificationsSection } from '@/components/settings/NotificationsSection'
import { AppearanceSection } from '@/components/settings/AppearanceSection'

export const Route = createFileRoute('/_authenticated/instellingen/')({
  component: InstellingenIndexPage,
})

function InstellingenIndexPage() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        <AccountSection />
        <PasswordSection />
      </div>
      <div className="space-y-4">
        <NotificationsSection />
        <AppearanceSection />
      </div>
    </div>
  )
}
