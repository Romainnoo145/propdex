import type { DakkapelReport } from '@/lib/reportsV2'

export function DakkapelReportView({ report }: { report: DakkapelReport }) {
  const {
    perceel,
    oordeel,
    welstand,
    jurisprudentie,
    onzekerheden,
    bronnen,
    geldigheidsdatum,
    aanvraag_url,
    disclaimers,
  } = report
  return (
    <article className="mx-auto max-w-3xl space-y-8 p-6">
      <header>
        <h1 className="text-2xl font-semibold">{perceel.adres ?? perceel.parcel_id}</h1>
        <p className="text-sm opacity-70">
          Dakkapel · {perceel.bestemmingen.join(', ') || 'onbekend'} ·{' '}
          {perceel.oppervlakte_m2 ?? '?'} m² · bouwjaar {perceel.bouwjaar ?? '?'}
        </p>
      </header>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Mag dit hier?</h2>
        <p>{oordeel.achterdakvlak}</p>
        <p className="mt-1">{oordeel.voor_zijdakvlak}</p>
        <ul className="mt-2 list-disc pl-5 text-sm">
          {oordeel.bepalende_factoren.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Welstand</h2>
        {welstand ? (
          <div className="space-y-1">
            <p>{welstand.samenvatting}</p>
            {welstand.beschermd_gezicht && (
              <p className="text-sm opacity-70">Let op: beschermd stadsgezicht.</p>
            )}
          </div>
        ) : (
          <p className="text-sm opacity-70">
            Welstandseisen voor deze gemeente nog niet beschikbaar.
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
        <h2 className="mb-2 text-lg font-semibold">Onzekerheden &amp; wat nu</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {onzekerheden.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
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
        <p>Bronnen: {bronnen.join(' · ')}</p>
        <p>Geldig op: {geldigheidsdatum}</p>
        {disclaimers.map((d) => (
          <p key={d}>{d}</p>
        ))}
      </footer>
    </article>
  )
}
