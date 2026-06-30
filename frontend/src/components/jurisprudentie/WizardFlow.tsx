import { useState, useMemo } from 'react'
import { ArrowLeft, ArrowRight, Check, Search } from 'lucide-react'
import type { ExplorerFilters, FacetItem } from '@/hooks/useExplorer'
import { SearchInput } from '@/components/primitives'
import StepTransition from '@/components/motion/StepTransition'

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

  const [step, setStep] = useState(() => {
    // If filters are already set, start at the last step so user can tweak
    if (filters.periode || filters.rechtsgrond || filters.vergunningstype || filters.gemeente || filters.rechtbank_niveau) {
      return 4
    }
    return 0
  })
  // Slide direction: +1 = forward (next), -1 = backward (previous).
  const [direction, setDirection] = useState(0)
  const [gemeenteSearch, setGemeenteSearch] = useState('')

  /** Single entry point for step changes so the slide direction is always set. */
  const goToStep = (next: number) => {
    setDirection(next >= step ? 1 : -1)
    setStep(next)
  }

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
      goToStep(2)
    } else if (step < 4) {
      goToStep(step + 1)
    }
  }

  const goBack = () => {
    if (step === 0) return
    if (step === 2 && schaal === 'landelijk') {
      goToStep(0)
    } else {
      goToStep(step - 1)
    }
  }

  const handleSchaal = (s: Schaal) => {
    if (s !== schaal) {
      onFilterChange('gemeente', undefined)
      onFilterChange('rechtbank_niveau', undefined)
    }
    setSchaal(s)
    goToStep(s === 'landelijk' ? 2 : 1)
  }

  /* ── Progress ──────────────────────────────────────── */
  const stepSequence = schaal === 'landelijk' ? [0, 2, 3, 4] : [0, 1, 2, 3, 4]
  const progressIndex = stepSequence.indexOf(step)
  // Distinguish the two step-1 variants so switching schaal also animates.
  const stepKey = `${step}-${step === 1 ? (schaal ?? 'none') : ''}`

  return (
    <div className="flex h-full flex-col bg-[#FAFCFA] rounded-[40px] pb-14 md:pb-0">
      {/* ── Progress dots ──────────────────────────────── */}
      <div className="flex justify-center pt-8">
        <div className="flex items-center gap-2">
          {stepSequence.map((s, i) => (
            <button
              key={i}
              onClick={() => goToStep(s)}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === progressIndex
                  ? 'w-8 bg-aura-amber'
                  : i < progressIndex
                    ? 'w-2 bg-aura-amber/50 hover:bg-aura-amber/70'
                    : 'w-2 bg-slate-200 hover:bg-slate-300'
              }`}
            />
          ))}
        </div>
      </div>

      {/* ── Step content ─────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-8">
        <StepTransition stepKey={stepKey} direction={direction} className="flex w-full justify-center">
        {/* Step 0: Schaalniveau */}
        {step === 0 && (
          <StepPage
            title="Op welk niveau zoek je?"
            subtitle="Kies het schaalniveau voor je zoekopdracht"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
                    goToStep(2)
                  }}
                />
              ))}
            </div>
            {!facets?.rechtbank_niveau?.length && (
              <p className="mt-4 text-[13px] text-slate-400">Gegevens laden...</p>
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
                className="h-10 text-[13px]"
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
                      goToStep(2)
                    }}
                  />
                ))}
                {filteredGemeenten.length === 0 && gemeenteSearch.trim() && (
                  <p className="col-span-full py-4 text-center text-[13px] text-slate-400">
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
              onClick={() => goToStep(0)}
              className="rounded-full bg-aura-canvas px-5 py-2.5 text-[13px] font-semibold text-aura-obsidian transition-colors hover:bg-neutral-200"
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
                    goToStep(3)
                  }}
                />
              ))}
            </div>
            {!facets?.vergunningstype?.length && (
              <p className="mt-4 text-[13px] text-slate-400">Gegevens laden...</p>
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
                    goToStep(4)
                  }}
                />
              ))}
            </div>
            {!facets?.rechtsgrond?.length && (
              <p className="mt-4 text-[13px] text-slate-400">Gegevens laden...</p>
            )}
          </StepPage>
        )}

        {/* Step 4: Periode */}
        {step === 4 && (
          <StepPage title="Welke periode?" subtitle="Hoe ver wil je terugkijken?">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
                      onComplete()
                    }}
                  />
                )
              })}
            </div>
          </StepPage>
        )}
        </StepTransition>
      </div>

      {/* ── Navigation bar ──────────────────────────────── */}
      <div className="flex items-center justify-between px-6 pb-6 sm:px-12">
        {step > 0 ? (
          <button
            onClick={goBack}
            className="flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium text-slate-400 transition-colors hover:text-aura-obsidian"
          >
            <ArrowLeft size={14} />
            Vorige
          </button>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-3">
          {step > 0 && step < 4 && (
            <button
              onClick={goNext}
              className="rounded-full px-4 py-2 text-[13px] font-medium text-slate-400 transition-colors hover:text-slate-600"
            >
              Overslaan
            </button>
          )}
          <button
            onClick={onComplete}
            className="flex items-center gap-2 rounded-full bg-aura-obsidian px-6 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-slate-800"
          >
            Toon {totalCount} resultaten
            <ArrowRight size={14} />
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
      <div className="flex items-center justify-center gap-2 mb-3">
        <div className="size-1.5 rounded-full bg-aura-amber" />
        <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400">
          Jurisprudentie
        </p>
      </div>
      <h1 className="text-[28px] font-black tracking-tight text-aura-obsidian sm:text-[36px]">
        {title}
      </h1>
      <p className="mt-2 text-[13px] text-slate-500">{subtitle}</p>
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
      className={`group relative flex flex-col overflow-hidden rounded-2xl border-2 px-5 py-5 text-left transition-all ${
        selected
          ? 'border-aura-obsidian bg-aura-amber'
          : 'border-aura-obsidian/40 bg-aura-glass-white/60 hover:border-aura-amber hover:shadow-[0_4px_20px_rgba(249,168,38,0.15)]'
      }`}
    >
      {selected && (
        <Check size={14} className="absolute right-3 top-3 text-aura-obsidian" />
      )}
      <span
        className={`block text-[15px] font-bold leading-snug ${
          selected ? 'text-aura-obsidian' : 'text-aura-obsidian'
        }`}
      >
        {label}
      </span>
      {desc && (
        <span className={`mt-1.5 block text-[12px] leading-relaxed ${
          selected ? 'text-aura-obsidian/60' : 'text-slate-400'
        }`}>
          {desc}
        </span>
      )}
      {count != null && (
        <span className={`mt-auto block pt-3 text-[11px] font-semibold tabular-nums ${
          selected ? 'text-aura-obsidian/70' : 'text-aura-amber'
        }`}>
          {count} zaken
        </span>
      )}
      {!selected && !count && (
        <span className="mt-3 block text-[12px] font-semibold text-aura-amber opacity-0 transition-opacity group-hover:opacity-100">
          Bekijken →
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
      className={`flex items-center justify-between rounded-[12px] border px-3.5 py-2.5 text-left text-[13px] font-semibold transition-all ${
        selected
          ? 'border-aura-obsidian bg-aura-amber text-aura-obsidian'
          : 'border-aura-obsidian/40 bg-aura-glass-white/60 text-aura-obsidian hover:border-aura-obsidian/60 hover:shadow-sm'
      }`}
    >
      <span className="flex items-center gap-1.5">
        {selected && <Check size={12} className="text-aura-obsidian" />}
        {label}
      </span>
      <span className={`ml-1.5 text-[11px] font-semibold tabular-nums ${
        selected ? 'text-aura-obsidian/70' : 'text-aura-amber'
      }`}>({count})</span>
    </button>
  )
}
