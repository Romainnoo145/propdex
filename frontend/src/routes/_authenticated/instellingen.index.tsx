import { createFileRoute } from '@tanstack/react-router'
import { AccountSection } from '@/components/settings/AccountSection'
import { PasswordSection } from '@/components/settings/PasswordSection'
import { CompanySection } from '@/components/settings/CompanySection'
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
        <NotificationsSection />
      </div>
      <div className="space-y-4">
        <CompanySection />
        <AppearanceSection />
      </div>
    </div>
  )
}
