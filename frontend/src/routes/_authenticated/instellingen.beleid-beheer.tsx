import { createFileRoute, redirect } from '@tanstack/react-router'
import { InstellingenBeleidPage } from '@/components/settings/beleid/InstellingenBeleidPage'

export const Route = createFileRoute('/_authenticated/instellingen/beleid-beheer')({
  beforeLoad: ({ context }) => {
    if (!context.auth.user?.is_superuser) {
      throw redirect({ to: '/instellingen' })
    }
  },
  component: InstellingenBeleidPage,
})
