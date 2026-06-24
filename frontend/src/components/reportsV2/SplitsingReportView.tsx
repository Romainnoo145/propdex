import type { SplitsingReport } from '@/lib/reportsV2'

export function SplitsingReportView({ report }: { report: SplitsingReport }) {
  const { perceel, beleid, jurisprudentie, aandachtspunten, aanvraag_url, disclaimers } = report
  return (
    <article className="mx-auto max-w-3xl space-y-8 p-6">
      <header>
        <h1 className="text-2xl font-semibold">{perceel.adres ?? perceel.parcel_id}</h1>
        <p className="text-sm opacity-70">
          {perceel.bestemmingen.join(', ') || 'onbekend'} · {perceel.oppervlakte_m2 ?? '?'} m² ·
          bouwjaar {perceel.bouwjaar ?? '?'}
        </p>
      </header>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Wat geldt hier</h2>
        {beleid ? (
          <div className="space-y-2">
            <p>{beleid.samenvatting}</p>
            {beleid.vergunningplichten.length > 0 && (
              <p className="text-sm">
                Vergunningplichtig: {beleid.vergunningplichten.join(', ')}
              </p>
            )}
            {beleid.randvoorwaarden.length > 0 && (
              <ul className="list-disc pl-5 text-sm">
                {beleid.randvoorwaarden.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p className="text-sm opacity-70">
            Geen actuele huisvestingsverordening gevonden.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Wat zegt de rechter</h2>
        {jurisprudentie.length > 0 ? (
          <ul className="space-y-3">
            {jurisprudentie.map((c) => (
              <li key={c.ecli} className="rounded-lg border p-3">
                <a
                  href={c.bron_url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-sm underline"
                >
                  {c.ecli}
                </a>
                <span className="ml-2 text-xs uppercase opacity-60">{c.uitkomst}</span>
                <p className="mt-1 text-sm">{c.duiding}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm opacity-70">Geen relevante jurisprudentie gevonden.</p>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Aandachtspunten</h2>
        {aandachtspunten.length > 0 && (
          <ul className="list-disc space-y-1 pl-5">
            {aandachtspunten.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        )}
        <a
          href={aanvraag_url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-block underline"
        >
          Vraag de vergunning aan via het Omgevingsloket
        </a>
      </section>

      <footer className="border-t pt-4 text-xs opacity-60">
        {disclaimers.map((d) => (
          <p key={d}>{d}</p>
        ))}
      </footer>
    </article>
  )
}
