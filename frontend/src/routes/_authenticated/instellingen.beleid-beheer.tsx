import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { InstellingenBeleidPage } from '@/components/settings/beleid/InstellingenBeleidPage'
import { useGemeentenSummary } from '@/lib/queries/data-sources-admin'

export const Route = createFileRoute('/_authenticated/instellingen/beleid-beheer')({
  beforeLoad: ({ context }) => {
    if (!context.auth.user?.is_superuser) {
      throw redirect({ to: '/instellingen' })
    }
  },
  component: BeleidBeheerWithBanner,
})

function BeleidBeheerWithBanner() {
  const gemeentenQuery = useGemeentenSummary()
  const firstGemeenteCode = gemeentenQuery.data?.[0]?.gemeente_code

  return (
    <div>
      <div className="bg-[#F9A826]/15 border border-[#F9A826]/30 rounded-2xl p-4 mb-6">
        <p className="text-[13px] text-[#0E1111]">
          <strong>Gemeente-documenten beheer je nu vanuit Data-bronnen.</strong>
          {' '}Landelijk/Provincie blijft hier tot M050.{' '}
          {firstGemeenteCode ? (
            <Link
              to="/instellingen/data-bronnen/$gemeenteCode"
              params={{ gemeenteCode: firstGemeenteCode }}
              className="font-semibold underline"
            >
              Ga naar Data-bronnen →
            </Link>
          ) : (
            <Link to="/instellingen/data-bronnen" className="font-semibold underline">
              Ga naar Data-bronnen →
            </Link>
          )}
        </p>
      </div>
      <InstellingenBeleidPage />
    </div>
  )
}
