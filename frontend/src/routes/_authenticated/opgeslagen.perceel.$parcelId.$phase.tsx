import { createFileRoute, useParams, Link, redirect } from '@tanstack/react-router'
import ResultsShell from '@/components/layout/ResultsShell'
import { LIFECYCLE_PHASES, getLifecyclePhase, type LifecyclePhaseKey } from '@/lib/lifecycle/phases'
import { ArrowLeft } from 'lucide-react'
import { ContactPhaseView } from '@/components/lifecycle/ContactPhaseView'
import { HaalbaarheidPhaseView } from '@/components/lifecycle/HaalbaarheidPhaseView'

const VALID_PHASE_KEYS: readonly LifecyclePhaseKey[] = LIFECYCLE_PHASES.map((p) => p.key)

function isValidPhaseKey(value: string): value is LifecyclePhaseKey {
  return (VALID_PHASE_KEYS as readonly string[]).includes(value)
}

export const Route = createFileRoute('/_authenticated/opgeslagen/perceel/$parcelId/$phase')({
  // beforeLoad runs BEFORE the component renders — canonical place for redirects.
  // Phase '1-onderzoek' should never live in a $phase URL; bounce to the canonical
  // /opgeslagen/perceel/$parcelId route.
  beforeLoad: ({ params }) => {
    if (params.phase === '1-onderzoek') {
      throw redirect({
        to: '/opgeslagen/perceel/$parcelId',
        params: { parcelId: params.parcelId },
        replace: true,
      })
    }
  },
  component: OpgeslagenPerceelPhasePage,
})

function OpgeslagenPerceelPhasePage() {
  const { parcelId, phase } = useParams({
    from: '/_authenticated/opgeslagen/perceel/$parcelId/$phase',
  })

  // Unknown phase slug → render fallback (NOT a redirect — user might have typed it manually).
  if (!isValidPhaseKey(phase)) {
    return (
      <ResultsShell>
        <div className="p-8">
          <p className="text-[14px] text-slate-500">Onbekende fase: {phase}</p>
          <Link
            to="/opgeslagen/perceel/$parcelId"
            params={{ parcelId }}
            className="text-aura-amber underline mt-2 inline-block"
          >
            Terug naar Onderzoek
          </Link>
        </div>
      </ResultsShell>
    )
  }

  // Phase 8 (M050/S06 cont.) — Contact fase is BRK-home
  if (phase === '2-contact') {
    return <ContactPhaseView parcelId={parcelId} />
  }

  // Fase 3 (M052/S02 acquisitie-arc) — Voorbereiding: projecttype-gedreven checklist
  if (phase === '3-voorbereiding') {
    return <HaalbaarheidPhaseView parcelId={parcelId} />
  }

  // Fallthrough: phases 4-9 remain placeholder until their milestones ship
  const phaseDef = getLifecyclePhase(phase)
  const Icon = phaseDef.icon

  return (
    <ResultsShell>
      <div className="px-6 pt-6 pb-12 max-w-3xl">
        <Link
          to="/opgeslagen/perceel/$parcelId"
          params={{ parcelId }}
          className="inline-flex items-center gap-2 text-[13px] text-slate-500 hover:text-aura-ink mb-6"
        >
          <ArrowLeft size={14} strokeWidth={1.5} /> Terug naar Onderzoek
        </Link>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/60 backdrop-blur-[24px] border border-white/40">
            <Icon size={22} strokeWidth={1.5} className="text-slate-400" />
          </div>
          <div>
            <h1 className="text-[22px] font-semibold text-aura-ink">{phaseDef.label}</h1>
            <p className="text-[12px] text-slate-500">Stap {phaseDef.order} in de developer-flow</p>
          </div>
        </div>

        <div className="bg-white/60 backdrop-blur-[24px] border border-white/40 rounded-[24px] p-8 text-center">
          <p className="text-[15px] text-aura-ink font-medium mb-2">
            Komt later — onderdeel van {phaseDef.plannedMilestone}
          </p>
          <p className="text-[13px] text-slate-500">
            Deze fase wordt geactiveerd zodra de bijbehorende milestone is geshipped. Voor nu
            blijven opgeslagen percelen in fase &quot;1. Onderzoek&quot;.
          </p>
        </div>
      </div>
    </ResultsShell>
  )
}
