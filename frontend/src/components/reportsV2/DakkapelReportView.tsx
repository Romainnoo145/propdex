import {
  CircleCheck,
  TriangleAlert,
  Scale,
  ExternalLink,
  Info,
} from 'lucide-react'
import type { DakkapelReport, JurisprudentieCase } from '@/lib/reportsV2'

/** Aura glass-card (Morning Mist canvas; print degradeert naar obsidian-op-wit via index.css @media print). */
const CARD =
  'bg-white/60 backdrop-blur-[24px] border border-slate-200 rounded-[24px] px-7 py-6 ' +
  'shadow-[0_1px_2px_rgba(14,17,17,0.03),0_8px_24px_rgba(14,17,17,0.04)]'

/** uitkomst → semantische pill (Aura: groen=positief, rood=negatief, amber=tussen). */
function uitkomstPill(uitkomst: JurisprudentieCase['uitkomst']): string {
  switch (uitkomst) {
    case 'toegekend':
      return 'text-aura-green bg-aura-green/10'
    case 'geweigerd':
      return 'text-aura-red bg-aura-red/10'
    default: // vernietigd | gemengd
      return 'text-aura-amber-dark bg-aura-amber/15'
  }
}

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
    <div className="h-full overflow-y-auto bg-aura-canvas px-4 py-10">
      <article className="mx-auto max-w-3xl space-y-5">
        {/* Header */}
        <header className={CARD}>
          <div className="text-label text-aura-amber-dark">Vergunningsrapport · Dakkapel</div>
          <h1 className="mt-1 text-[26px] font-bold leading-tight text-aura-ink">
            {perceel.adres ?? perceel.parcel_id}
          </h1>
          <p className="mt-1 text-[13px] text-slate-500">
            {perceel.bestemmingen.join(', ') || 'bestemming onbekend'} ·{' '}
            {perceel.oppervlakte_m2 ?? '?'} m² · bouwjaar {perceel.bouwjaar ?? '?'}
          </p>
        </header>

        {/* Oordeel — conditioneel */}
        <section className={CARD}>
          <div className="text-label mb-3 text-slate-500">Mag dit hier?</div>
          <div className="space-y-3">
            <div className="flex gap-3">
              <CircleCheck size={22} strokeWidth={1.5} className="mt-0.5 shrink-0 text-aura-green" />
              <p className="text-[14px] leading-relaxed text-aura-ink">{oordeel.achterdakvlak}</p>
            </div>
            <div className="flex gap-3">
              <TriangleAlert size={22} strokeWidth={1.5} className="mt-0.5 shrink-0 text-aura-amber" />
              <p className="text-[14px] leading-relaxed text-aura-ink">{oordeel.voor_zijdakvlak}</p>
            </div>
          </div>
          <div className="mt-4 rounded-[16px] border border-slate-200 bg-aura-mint/30 px-4 py-3">
            <div className="text-label mb-2 text-slate-500">Bepalende factoren</div>
            <ul className="space-y-1.5">
              {oordeel.bepalende_factoren.map((f, i) => (
                <li key={`${i}-${f}`} className="flex gap-2 text-[13px] text-aura-ink">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-aura-amber" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Welstand */}
        <section className={CARD}>
          <div className="text-label mb-2 text-slate-500">Welstand</div>
          {welstand ? (
            <div className="space-y-2">
              <p className="text-[14px] leading-relaxed text-aura-ink">{welstand.samenvatting}</p>
              {welstand.beschermd_gezicht && (
                <p className="inline-flex items-center gap-1.5 rounded-full bg-aura-amber/15 px-3 py-1 text-[12px] font-medium text-aura-amber-dark">
                  <Info size={16} strokeWidth={1.5} /> Beschermd stadsgezicht
                </p>
              )}
            </div>
          ) : (
            <p className="text-[13px] text-slate-400">
              Welstandseisen voor deze gemeente nog niet beschikbaar.
            </p>
          )}
        </section>

        {/* Jurisprudentie */}
        <section className={CARD}>
          <div className="text-label mb-3 flex items-center gap-2 text-slate-500">
            <Scale size={18} strokeWidth={1.5} /> Wat zegt de rechter
          </div>
          {jurisprudentie.length > 0 ? (
            <ul className="space-y-3">
              {jurisprudentie.map((c) => (
                <li key={c.ecli} className="rounded-[16px] border border-slate-200 bg-white/40 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={c.bron_url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-[12px] text-aura-ink underline decoration-slate-300 underline-offset-2 hover:decoration-aura-amber"
                    >
                      {c.ecli}
                    </a>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em] ${uitkomstPill(c.uitkomst)}`}
                    >
                      {c.uitkomst}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {c.instantie} · {c.datum}
                    </span>
                  </div>
                  <p className="mt-2 text-[13px] leading-relaxed text-aura-ink">{c.duiding}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-slate-400">Geen relevante jurisprudentie gevonden.</p>
          )}
        </section>

        {/* Onzekerheden & wat nu */}
        <section className={CARD}>
          <div className="text-label mb-2 text-slate-500">Onzekerheden &amp; wat nu</div>
          <ul className="space-y-1.5">
            {onzekerheden.map((o, i) => (
              <li
                key={`${i}-${o}`}
                className="flex gap-2 text-[13px] leading-relaxed text-slate-600"
              >
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-slate-300" />
                {o}
              </li>
            ))}
          </ul>
          <a
            href={aanvraag_url}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-aura-obsidian px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-black"
          >
            Vraag de vergunning aan via het Omgevingsloket
            <ExternalLink size={16} strokeWidth={1.5} />
          </a>
        </section>

        {/* Footer */}
        <footer className="px-7 text-[12px] leading-relaxed text-slate-400">
          <p>Bronnen: {bronnen.join(' · ')}</p>
          <p>Geldig op: {geldigheidsdatum}</p>
          {disclaimers.map((d) => (
            <p key={d} className="mt-2">
              {d}
            </p>
          ))}
        </footer>
      </article>
    </div>
  )
}
