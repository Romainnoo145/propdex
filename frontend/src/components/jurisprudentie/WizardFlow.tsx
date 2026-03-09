import { useState, useMemo } from 'react'
import { ArrowLeft, ArrowRight, Check, Search } from 'lucide-react'
import type { ExplorerFilters, FacetItem } from '@/hooks/useExplorer'
import { SearchInput } from '@/components/primitives'

type Facets = {
  gemeente: FacetItem[]
  vergunningstype: FacetItem[]
  uitkomst: FacetItem[]
  rechtsgrond: FacetItem[]
  rechtbank_niveau: FacetItem[]
} | null

interface WizardFlowProps {
  filters: ExplorerFilters
  facets: Facets
  onFilterChange: (dim: keyof ExplorerFilters, value: string | undefined) => void
  onComplete: () => void
  totalCount: number
}

type Schaal = 'landelijk' | 'provinciaal' | 'gemeentelijk'

const VERGUNNINGSTYPE_LABELS: Record<string, string> = {
  nieuwbouw: 'Nieuwbouw',
  verbouw: 'Verbouw',
  dakopbouw: 'Dakopbouw',
  uitbreiding: 'Uitbreiding',
  sloop: 'Sloop',
  bestemmingswijziging: 'Bestemmingswijziging',
  milieu: 'Milieu',
  monumenten: 'Monumenten',
  overig: 'Overig',
}

const THEMA_MAP: Record<string, { label: string; desc: string }> = {
  etfal_ruimtelijke_ordening: {
    label: 'Ruimtelijke impact',
    desc: 'Parkeren, verkeer, geluid, schaduwwerking',
  },
  procedurefout: {
    label: 'Procedure & proces',
    desc: 'Termijnen, hoorplicht, bekendmaking, participatie',
  },
  motiveringsgebrek: {
    label: 'Onderbouwing',
    desc: 'Onvoldoende motivering van het besluit',
  },
  gelijkheidsbeginsel: {
    label: 'Gelijke behandeling',
    desc: 'Vergelijkbare gevallen, precedentwerking',
  },
  disproportioneel: {
    label: 'Evenredigheid',
    desc: 'Onevenredige gevolgen, proportionaliteit',
  },
}

/*
 * Steps:
 *   0 — Schaalniveau (landelijk / provinciaal / gemeentelijk)
 *   1 — Locatie (skipped for landelijk)
 *   2 — Vergunningstype
 *   3 — Thema
 *   4 — Periode
 */

export default function WizardFlow({
  filters,
  facets,
  onFilterChange,
  onComplete,
  totalCount,
}: WizardFlowProps) {
  const [schaal, setSchaal] = useState<Schaal | null>(() => {
    if (filters.gemeente) return 'gemeentelijk'
    if (filters.rechtbank_niveau) return 'provinciaal'
    return null
  })

  const [step, setStep] = useState(0)
  const [gemeenteSearch, setGemeenteSearch] = useState('')

  const gemeenteFacets = facets?.gemeente ?? []
  const filteredGemeenten = useMemo(() => {
    if (gemeenteFacets.length === 0) return []
    if (!gemeenteSearch.trim()) return gemeenteFacets.slice(0, 20)
    const q = gemeenteSearch.toLowerCase()
    return gemeenteFacets.filter((f) => f.value.toLowerCase().includes(q)).slice(0, 20)
  }, [gemeenteFacets, gemeenteSearch])

  /* ── Navigation ────────────────────────────────────── */
  const goNext = () => {
    if (step === 0 && schaal === 'landelijk') {
      setStep(2)
    } else if (step < 4) {
      setStep(step + 1)
    }
  }

  const goBack = () => {
    if (step === 0) return
    if (step === 2 && schaal === 'landelijk') {
      setStep(0)
    } else {
      setStep(step - 1)
    }
  }

  const handleSchaal = (s: Schaal) => {
    if (s !== schaal) {
      onFilterChange('gemeente', undefined)
      onFilterChange('rechtbank_niveau', undefined)
    }
    setSchaal(s)
    if (s === 'landelijk') {
      setStep(2)
    } else {
      setStep(1)
    }
  }

  /* ── Progress ──────────────────────────────────────── */
  const stepSequence = schaal === 'landelijk' ? [0, 2, 3, 4] : [0, 1, 2, 3, 4]
  const progressIndex = stepSequence.indexOf(step)

  return (
    <div className="flex h-full flex-col bg-aura-canvas">
      {/* ── Progress dots (clickable) ──────────────────── */}
      <div className="flex justify-center pt-8">
        <div className="flex items-center gap-2">
          {stepSequence.map((s, i) => (
            <button
              key={i}
              onClick={() => setStep(s)}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === progressIndex
                  ? 'w-8 bg-amber-500'
                  : i < progressIndex
                    ? 'w-2 bg-amber-500/50 hover:bg-amber-400/70'
                    : 'w-2 bg-neutral-300 hover:bg-neutral-400'
              }`}
            />
          ))}
        </div>
      </div>

      {/* ── Step content ─────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-8">
        {/* Step 0: Schaalniveau */}
        {step === 0 && (
          <StepPage
            title="Op welk niveau zoek je?"
            subtitle="Kies het schaalniveau voor je zoekopdracht"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <WizardCard
                label="Landelijk"
                desc="Zoek door alle uitspraken in heel Nederland"
                selected={schaal === 'landelijk'}
                onClick={() => handleSchaal('landelijk')}
              />
              <WizardCard
                label="Provinciaal"
                desc="Zoek binnen een specifieke rechtbankregio"
                selected={schaal === 'provinciaal'}
                onClick={() => handleSchaal('provinciaal')}
              />
              <WizardCard
                label="Gemeentelijk"
                desc="Zoek uitspraken voor een specifieke gemeente"
                selected={schaal === 'gemeentelijk'}
                onClick={() => handleSchaal('gemeentelijk')}
              />
            </div>
          </StepPage>
        )}

        {/* Step 1: Locatie — Provinciaal */}
        {step === 1 && schaal === 'provinciaal' && (
          <StepPage
            title="Welke regio?"
            subtitle="Selecteer de rechtbankregio waar je wilt zoeken"
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {(facets?.rechtbank_niveau ?? []).map((f) => (
                <WizardCard
                  key={f.value}
                  label={f.value}
                  count={f.count}
                  selected={filters.rechtbank_niveau === f.value}
                  onClick={() => {
                    onFilterChange('rechtbank_niveau', f.value)
                    setStep(2)
                  }}
                />
              ))}
            </div>
            {!facets?.rechtbank_niveau?.length && (
              <p className="mt-4 text-sm text-neutral-500">Gegevens laden...</p>
            )}
          </StepPage>
        )}

        {/* Step 1: Locatie — Gemeentelijk */}
        {step === 1 && schaal === 'gemeentelijk' && (
          <StepPage title="Welke gemeente?" subtitle="Zoek en selecteer de gemeente">
            <div className="mx-auto w-full max-w-2xl">
              <SearchInput
                leftIcon={<Search size={16} />}
                placeholder="Zoek gemeente..."
                value={gemeenteSearch}
                onChange={(e) => setGemeenteSearch(e.target.value)}
                className="h-10 text-base"
              />
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {filteredGemeenten.map((f) => (
                  <SubCard
                    key={f.value}
                    label={f.value}
                    count={f.count}
                    selected={filters.gemeente === f.value}
                    onClick={() => {
                      onFilterChange('gemeente', f.value)
                      setStep(2)
                    }}
                  />
                ))}
                {filteredGemeenten.length === 0 && gemeenteSearch.trim() && (
                  <p className="col-span-full py-4 text-center text-sm text-neutral-500">
                    Geen gemeenten gevonden voor &quot;{gemeenteSearch}&quot;
                  </p>
                )}
              </div>
            </div>
          </StepPage>
        )}

        {/* Step 1: Fallback — schaal not set */}
        {step === 1 && !schaal && (
          <StepPage
            title="Kies eerst een schaalniveau"
            subtitle="Ga terug om een schaalniveau te kiezen"
          >
            <button
              onClick={() => setStep(0)}
              className="rounded-lg bg-neutral-200 px-4 py-2 text-sm text-neutral-700 transition-colors hover:bg-neutral-300"
            >
              Ga naar schaalniveau
            </button>
          </StepPage>
        )}

        {/* Step 2: Vergunningstype */}
        {step === 2 && (
          <StepPage title="Wat voor project?" subtitle="Selecteer het vergunningstype">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {(facets?.vergunningstype ?? []).map((f) => (
                <WizardCard
                  key={f.value}
                  label={VERGUNNINGSTYPE_LABELS[f.value] ?? f.value}
                  count={f.count}
                  selected={filters.vergunningstype === f.value}
                  onClick={() => {
                    onFilterChange('vergunningstype', f.value)
                    setStep(3)
                  }}
                />
              ))}
            </div>
            {!facets?.vergunningstype?.length && (
              <p className="mt-4 text-sm text-neutral-500">Gegevens laden...</p>
            )}
          </StepPage>
        )}

        {/* Step 3: Thema */}
        {step === 3 && (
          <StepPage title="Welk thema?" subtitle="Waar gaat het geschil over?">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(facets?.rechtsgrond ?? []).map((f) => (
                <WizardCard
                  key={f.value}
                  label={THEMA_MAP[f.value]?.label ?? f.value}
                  desc={THEMA_MAP[f.value]?.desc}
                  count={f.count}
                  selected={filters.rechtsgrond === f.value}
                  onClick={() => {
                    onFilterChange('rechtsgrond', f.value)
                    setStep(4)
                  }}
                />
              ))}
            </div>
            {!facets?.rechtsgrond?.length && (
              <p className="mt-4 text-sm text-neutral-500">Gegevens laden...</p>
            )}
          </StepPage>
        )}

        {/* Step 4: Periode */}
        {step === 4 && (
          <StepPage title="Welke periode?" subtitle="Hoe ver wil je terugkijken?">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {(
                [
                  { value: '1jaar', label: '1 jaar', sub: 'Sinds vorig jaar' },
                  { value: '3jaar', label: '3 jaar', sub: 'Recente trends' },
                  { value: '5jaar', label: '5 jaar', sub: 'Breed overzicht' },
                  { value: 'alles', label: 'Alles', sub: 'Volledige database' },
                ] as const
              ).map((opt) => {
                const isSelected =
                  opt.value === 'alles' ? !filters.periode : filters.periode === opt.value
                return (
                  <WizardCard
                    key={opt.value}
                    label={opt.label}
                    desc={opt.sub}
                    selected={isSelected}
                    onClick={() => {
                      onFilterChange('periode', opt.value === 'alles' ? undefined : opt.value)
                    }}
                  />
                )
              })}
            </div>
          </StepPage>
        )}
      </div>

      {/* ── Navigation bar ──────────────────────────────── */}
      <div className="flex items-center justify-between px-6 pb-6 sm:px-12">
        {step > 0 ? (
          <button
            onClick={goBack}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm text-neutral-600 transition-colors hover:text-aura-ink"
          >
            <ArrowLeft size={16} />
            Vorige
          </button>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-3">
          {step > 0 && step < 4 && (
            <button
              onClick={goNext}
              className="rounded-lg px-4 py-2 text-sm text-neutral-500 transition-colors hover:text-neutral-700"
            >
              Overslaan
            </button>
          )}
          <button
            onClick={onComplete}
            className="flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-aura-canvas transition-colors hover:bg-amber-400"
          >
            Toon {totalCount} resultaten
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Layout ──────────────────────────────────────────────────── */

function StepPage({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div className="w-full max-w-3xl text-center">
      <h1 className="text-2xl font-bold text-aura-ink sm:text-3xl">{title}</h1>
      <p className="mt-2 text-sm text-neutral-600 sm:text-base">{subtitle}</p>
      <div className="mt-8">{children}</div>
    </div>
  )
}

/* ── Cards ────────────────────────────────────────────────────── */

function WizardCard({
  label,
  desc,
  count,
  selected,
  onClick,
}: {
  label: string
  desc?: string
  count?: number
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col overflow-hidden rounded-xl border-2 px-4 py-5 text-left transition-all sm:p-6 ${
        selected
          ? 'border-amber-500 bg-amber-500/10'
          : 'border-neutral-200 bg-aura-glass-white/60 hover:border-neutral-300'
      }`}
    >
      {selected && (
        <Check size={16} className="absolute right-3 top-3 text-amber-400" />
      )}
      <span
        className={`block min-h-[1.75rem] break-words text-base font-semibold leading-6 sm:text-lg sm:leading-7 ${
          selected ? 'text-amber-300' : 'text-aura-ink'
        }`}
      >
        {label}
      </span>
      <span className="mt-1 block min-h-[2.5rem] text-sm leading-5 text-neutral-600">
        {desc ?? '\u00A0'}
      </span>
      {count != null && (
        <span className="mt-auto block pt-2 text-sm tabular-nums text-neutral-500">
          {count} zaken
        </span>
      )}
    </button>
  )
}

function SubCard({
  label,
  count,
  selected,
  onClick,
}: {
  label: string
  count: number
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition-all ${
        selected
          ? 'border-amber-500/60 bg-amber-500/10 text-amber-300'
          : 'border-neutral-300 text-neutral-700 hover:border-neutral-400 hover:bg-aura-glass-white/60'
      }`}
    >
      <span className="flex items-center gap-1.5">
        {selected && <Check size={12} className="text-amber-400" />}
        {label}
      </span>
      <span className="ml-1.5 text-xs text-neutral-500">({count})</span>
    </button>
  )
}
