import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { InstellingenBeleidPage } from '@/components/settings/beleid/InstellingenBeleidPage'

export const Route = createFileRoute('/_authenticated/instellingen/beleid-beheer')({
  beforeLoad: ({ context }) => {
    if (!context.auth.user?.is_superuser) {
      throw redirect({ to: '/instellingen' })
    }
  },
  component: BeleidBeheerWithBanner,
})

function BeleidBeheerWithBanner() {
  return (
    <div>
      <div className="bg-[#F9A826]/15 border border-[#F9A826]/30 rounded-2xl p-4 mb-6">
        <p className="text-[13px] text-[#0E1111]">
          <strong>Gemeente-documenten beheer je nu vanuit Data-bronnen.</strong>
          {' '}Landelijk/Provincie blijft hier tot M050.{' '}
          <Link to="/instellingen/data-bronnen" className="font-semibold underline">
            Ga naar Data-bronnen →
          </Link>
        </p>
      </div>
      <InstellingenBeleidPage />
    </div>
  )
}
