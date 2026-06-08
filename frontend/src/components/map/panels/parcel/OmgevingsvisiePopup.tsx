/**
 * OmgevingsvisiePopup — M053/S01 cascade showcase.
 * Minimal Calm Intelligence: one focal point = the beleidstekst (citaat).
 * Cloned from WoonvisiePopup; deelgebied-karakter replaces wijk-prioriteit.
 */
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

export type GebiedKarakter =
  | 'centraal_stedelijk' | 'transformatie' | 'stedelijk_wonen'
  | 'werklocatie' | 'dorp' | 'landschap'
export type Woningbouwprioriteit = 'hoog' | 'gemiddeld' | 'laag' | 'niet_benoemd'

export type BeleidsVerdict = 'kansrijk' | 'neutraal' | 'strijdig' | 'geen_beleid'

const VERDICT_COPY: Record<BeleidsVerdict, { mark: string; color: string; line: string }> = {
  kansrijk: { mark: '✓', color: 'text-[#15803d]', line: 'Kansrijk — gemeente stuurt hier op wonen; jouw plan past bij de visie.' },
  neutraal: { mark: '•', color: 'text-[#6B7280]', line: 'Past binnen de gemeentelijke richting voor dit gebied.' },
  strijdig: { mark: '⚠', color: 'text-[#DC2626]', line: 'Strijdig met de gemeentevisie — reken op verzet.' },
  geen_beleid: { mark: '•', color: 'text-[#9CA3AF]', line: 'Geen gebied-specifiek beleid voor dit perceel.' },
}

export interface GebiedPolicy {
  gebied_naam: string
  karakter: GebiedKarakter
  woningbouwprioriteit: Woningbouwprioriteit
  transformatie_kansgebied: boolean
  gebonden_plaatsen: string[]
  citaat: string
  pagina: number | null
}

export interface Randvoorwaarde {
  categorie: string
  titel: string
  samenvatting: string
  citaat?: string | null
  pagina?: number | null
}

export interface OmgevingsvisiePopupProps {
  isOpen: boolean
  onClose: () => void
  gemeente: string
  tijdshorizon: number
  matched_policy: GebiedPolicy | null
  algemeen_citaat: string
  project_type: string
  verdict?: BeleidsVerdict
  randvoorwaarden?: Randvoorwaarde[]
}

/* ── Randvoorwaarde categorie display labels (NL) + render order ── */

const RANDVOORWAARDE_LABEL: Record<string, string> = {
  programmering: 'Programmering',
  financieel: 'Financieel',
  doelgroep: 'Doelgroep',
  duurzaamheid: 'Duurzaamheid',
  ruimtelijk: 'Ruimtelijk',
  proces: 'Proces',
  markt: 'Markt',
  overig: 'Overig',
}

const RANDVOORWAARDE_ORDER = [
  'programmering', 'financieel', 'doelgroep', 'duurzaamheid',
  'ruimtelijk', 'proces', 'markt', 'overig',
]

/** Group randvoorwaarden by categorie, in RANDVOORWAARDE_ORDER. */
export function groupRandvoorwaarden(
  randvoorwaarden: Randvoorwaarde[],
): Array<{ categorie: string; items: Randvoorwaarde[] }> {
  const byCategorie = new Map<string, Randvoorwaarde[]>()
  for (const rv of randvoorwaarden) {
    const bucket = byCategorie.get(rv.categorie)
    if (bucket) bucket.push(rv)
    else byCategorie.set(rv.categorie, [rv])
  }
  const ordered: Array<{ categorie: string; items: Randvoorwaarde[] }> = []
  for (const cat of RANDVOORWAARDE_ORDER) {
    const items = byCategorie.get(cat)
    if (items) {
      ordered.push({ categorie: cat, items })
      byCategorie.delete(cat)
    }
  }
  // Any unknown categorie not in the order list, appended in insertion order.
  for (const [categorie, items] of byCategorie) ordered.push({ categorie, items })
  return ordered
}

/* ── Karakter label (inline text, no chip) ─────────────────────── */

export const KARAKTER_LABEL: Record<GebiedKarakter, string> = {
  centraal_stedelijk: 'Centraal stedelijk gebied',
  transformatie: 'Transformatiegebied',
  stedelijk_wonen: 'Stedelijk woongebied',
  werklocatie: 'Werklocatie',
  dorp: 'Dorpskern',
  landschap: 'Landschapszone',
}

export const KARAKTER_DOT: Record<GebiedKarakter, string> = {
  centraal_stedelijk: 'bg-[#22C55E]',
  transformatie: 'bg-[#22C55E]',
  stedelijk_wonen: 'bg-[#F9A826]',
  dorp: 'bg-[#F9A826]',
  werklocatie: 'bg-[#9CA3AF]',
  landschap: 'bg-[#EF4444]',
}

/* ── Projecttype → preferred karakter types ─────────────────────── */

export const PROJECTTYPE_FIT: Record<string, GebiedKarakter[]> = {
  transformatie_wonen: ['transformatie', 'centraal_stedelijk'],
  nieuwbouw_wonen: ['transformatie', 'stedelijk_wonen', 'dorp'],
  commercieel_naar_wonen: ['transformatie', 'centraal_stedelijk'],
  optoppen: ['centraal_stedelijk', 'stedelijk_wonen'],
  splitsen: ['stedelijk_wonen', 'centraal_stedelijk'],
  onbepaald: [],
}

export function alignmentSentence(projectType: string, k: GebiedKarakter): string | null {
  const fit = PROJECTTYPE_FIT[projectType] ?? []
  if (fit.length === 0) return null
  return fit.includes(k)
    ? `Jouw projecttype sluit aan bij de gemeentelijke richting voor dit gebied`
    : `Jouw projecttype wijkt af van de gemeentelijke richting voor dit gebied`
}

/* ── Pure helpers ───────────────────────────────────────────────── */

export function resolvePopupCitaat(
  matched_policy: GebiedPolicy | null,
  algemeen_citaat: string,
): string {
  return matched_policy ? (matched_policy.citaat || algemeen_citaat) : algemeen_citaat
}

/* ── Component ─────────────────────────────────────────────────── */

export function OmgevingsvisiePopup({
  isOpen,
  onClose,
  gemeente,
  tijdshorizon,
  matched_policy,
  algemeen_citaat,
  verdict,
  randvoorwaarden,
}: OmgevingsvisiePopupProps) {
  if (!isOpen) return null

  const hasMatch = matched_policy != null && typeof matched_policy === 'object'
  const karakter = hasMatch ? matched_policy!.karakter : null
  const citaat = resolvePopupCitaat(matched_policy, algemeen_citaat)
  const titel = hasMatch ? matched_policy!.gebied_naam : 'Gemeente-breed'
  const pagina = hasMatch ? (matched_policy!.pagina ?? null) : null
  const verdictCopy = verdict ? VERDICT_COPY[verdict] : undefined
  const randvoorwaardeGroups =
    randvoorwaarden && randvoorwaarden.length > 0 ? groupRandvoorwaarden(randvoorwaarden) : []

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="omgevingsvisie-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          className="relative flex flex-col bg-white rounded-[32px] shadow-2xl w-full max-w-xl mx-4 max-h-[calc(100vh-80px)]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close — no header chrome */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 flex h-8 w-8 items-center justify-center rounded-full text-[#9CA3AF] transition-colors hover:bg-[#F2F6F3] hover:text-[#0E1111]"
            aria-label="Sluiten"
          >
            <X size={14} strokeWidth={2} />
          </button>

          <div className="flex-1 min-h-0 overflow-y-auto px-12 py-12">
            {/* Meta line — small, single row */}
            <div className="flex items-center gap-2 text-[11px] text-[#9CA3AF]">
              <span>Omgevingsvisie {gemeente} {tijdshorizon}</span>
              {pagina != null && (
                <>
                  <span>·</span>
                  <span>p. {pagina}</span>
                </>
              )}
            </div>

            {/* Gebied title */}
            <h2 className="mt-3 text-[36px] font-black tracking-[-0.03em] text-[#0E1111] leading-[1.05]">
              {titel}
            </h2>

            {/* Karakter + prioriteit — meta */}
            {karakter && (
              <div className="mt-3 flex items-center gap-2 text-[13px] text-[#6B7280]">
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${KARAKTER_DOT[karakter]}`} />
                <span>{KARAKTER_LABEL[karakter]}</span>
                {hasMatch && matched_policy!.woningbouwprioriteit !== 'niet_benoemd' && (
                  <>
                    <span>·</span>
                    <span>woningbouwprioriteit {matched_policy!.woningbouwprioriteit}</span>
                  </>
                )}
              </div>
            )}
            {!hasMatch && (
              <div className="mt-3 text-[13px] text-[#6B7280] italic">geen gebied-specifieke tekst</div>
            )}

            {/* Verdict — the new focal point */}
            {verdictCopy && (
              <p className={`mt-8 text-[18px] font-semibold leading-snug ${verdictCopy.color}`}>
                {verdictCopy.mark} {verdictCopy.line}
              </p>
            )}

            {/* Citaat — demoted to supporting evidence */}
            {citaat && (
              <p className="mt-6 text-[13px] leading-[1.7] text-[#6B7280] whitespace-pre-line">
                {citaat}
              </p>
            )}

            {/* Randvoorwaarden — gemeente-brede toetsingsregels, grouped by categorie */}
            {randvoorwaardeGroups.length > 0 && (
              <div className="mt-8 border-t border-[#F2F6F3] pt-6">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Randvoorwaarden
                </p>
                <div className="mt-4 space-y-6">
                  {randvoorwaardeGroups.map((group) => (
                    <div key={group.categorie}>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
                        {RANDVOORWAARDE_LABEL[group.categorie] ?? group.categorie}
                      </p>
                      <div className="mt-2 space-y-3">
                        {group.items.map((rv, i) => (
                          <div key={`${group.categorie}-${i}`}>
                            <p className="text-[13px] font-semibold text-[#0E1111]">{rv.titel}</p>
                            <p className="text-[12px] leading-relaxed text-[#6B7280]">
                              {rv.samenvatting}
                            </p>
                            {rv.citaat && (
                              <p className="mt-1 text-[11px] italic text-slate-400">
                                “{rv.citaat}”{rv.pagina ? ` · p.${rv.pagina}` : ''}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}
