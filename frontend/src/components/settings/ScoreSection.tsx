import { useState, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, Sliders } from 'lucide-react'
import { toast } from 'sonner'
import {
  useOrgScoreWeights,
  useSaveScoreWeights,
  useRescoreJobStatus,
} from '@/hooks/useScoreWeights'
import type { ScoreWeightsConfig } from '@/lib/types/scoreWeights'
import {
  DEFAULT_WEIGHTS,
  PRESETS,
  POTENTIE_FACTORS,
  RISICO_FACTORS,
} from '@/lib/types/scoreWeights'
import { PresetCards } from './PresetCards'
import { RiskAppetite } from './RiskAppetite'
import { FactorTable } from './FactorTable'

const MIN_ACTIVE = 3

export function ScoreSection() {
  const { data: loadedData, isLoading } = useOrgScoreWeights()

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-[13px]">Score-profiel laden...</span>
      </div>
    )
  }

  return <ScoreForm key={loadedData?.weights.preset} initialConfig={loadedData?.weights} />
}

interface ScoreFormProps {
  initialConfig: ScoreWeightsConfig | undefined
}

function ScoreForm({ initialConfig }: ScoreFormProps) {
  const { mutateAsync: saveWeights, isPending: isSaving } = useSaveScoreWeights()
  const queryClient = useQueryClient()

  const [formState, setFormState] = useState<ScoreWeightsConfig>(
    initialConfig ?? DEFAULT_WEIGHTS,
  )
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)

  const { data: jobStatus } = useRescoreJobStatus(activeJobId)
  const jobDone = jobStatus?.status === 'complete' || jobStatus?.status === 'failed'

  const prevJobDoneRef = useRef(false)
  useEffect(() => {
    if (jobStatus?.status === 'complete' && !prevJobDoneRef.current) {
      queryClient.invalidateQueries({ queryKey: ['org', 'score-weights'] })
    }
    prevJobDoneRef.current = jobDone
  }, [jobStatus?.status, jobDone, queryClient])

  const activePotentieCount = POTENTIE_FACTORS.filter(
    (f) => (formState.potentie_weights[f.key] ?? 0) > 0,
  ).length
  const activeRisicoCount = RISICO_FACTORS.filter(
    (f) => (formState.risico_weights[f.key] ?? 0) > 0,
  ).length
  const isValid = activePotentieCount >= MIN_ACTIVE && activeRisicoCount >= MIN_ACTIVE
  const isJobRunning = !!activeJobId && !jobDone
  const canSave = isDirty && isValid && !isSaving && !isJobRunning

  const currentPreset = PRESETS.find((p) => p.id === formState.preset) ?? PRESETS[0]!

  const updateFormState = (partial: Partial<ScoreWeightsConfig>) => {
    setFormState((prev) => ({ ...prev, ...partial }))
    setIsDirty(true)
  }

  const handlePresetSelect = (preset: (typeof PRESETS)[0]) => {
    setFormState(preset.config)
    setIsDirty(true)
    setActiveJobId(null)
  }

  const handlePotentieWeightChange = (key: string, weight: number) => {
    updateFormState({
      potentie_weights: { ...formState.potentie_weights, [key]: weight },
    })
  }

  const handleRisicoWeightChange = (key: string, weight: number) => {
    updateFormState({
      risico_weights: { ...formState.risico_weights, [key]: weight },
    })
  }

  const handleSave = async () => {
    try {
      const result = await saveWeights({
        preset: formState.preset,
        potentie_risico_balance: formState.potentie_risico_balance,
        potentie_weights: formState.potentie_weights,
        risico_weights: formState.risico_weights,
        score_threshold: formState.score_threshold,
      })
      setIsDirty(false)
      if (result.job_id) {
        setActiveJobId(result.job_id)
        toast.success('Score-profiel opgeslagen — herberekening gestart')
      } else {
        toast.success('Score-profiel opgeslagen')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fout bij opslaan')
    }
  }

  return (
    <div className="space-y-4">
      {/* Header with save button */}
      <div className="rounded-[24px] border border-[#EAEFEF] bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sliders size={14} className="text-[#F9A826]" />
              <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#0E1111]">
                Score profiel
              </p>
            </div>
            <p className="text-[13px] text-slate-500">
              Pas de scoremethode aan voor je organisatie
            </p>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="rounded-full bg-[#0E1111] px-6 py-2.5 text-[12px] font-semibold text-white transition-all hover:bg-slate-800 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            {isSaving || isJobRunning ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Herberekening...
              </span>
            ) : (
              'Opslaan + herbereken'
            )}
          </button>
        </div>
      </div>

      {/* Presets — full width, 4 columns */}
      <div className="rounded-[24px] border border-[#EAEFEF] bg-white p-6 space-y-4">
        <p className="text-[12px] font-semibold text-[#0E1111]">Kies een startprofiel</p>
        <PresetCards
          presets={PRESETS}
          activePreset={formState.preset}
          onSelect={handlePresetSelect}
        />
      </div>

      {/* Risk appetite — combined balance + threshold */}
      <div className="rounded-[24px] border border-[#EAEFEF] bg-white p-6 space-y-4">
        <p className="text-[12px] font-semibold text-[#0E1111]">Risicoprofiel</p>
        <RiskAppetite
          balance={formState.potentie_risico_balance}
          threshold={formState.score_threshold}
          onChange={(balance, threshold) => updateFormState({ potentie_risico_balance: balance, score_threshold: threshold })}
        />
      </div>

      {/* Factor tables side by side */}
      <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-[24px] border border-[#EAEFEF] bg-white p-6 space-y-4">
        <p className="text-[12px] font-semibold text-[#0E1111]">Potentie factoren</p>
        <FactorTable
          factors={POTENTIE_FACTORS}
          weights={formState.potentie_weights}
          presetWeights={currentPreset.config.potentie_weights}
          onChange={handlePotentieWeightChange}
          minActive={MIN_ACTIVE}
        />
      </div>

      {/* Risico factor table */}
      <div className="rounded-[24px] border border-[#EAEFEF] bg-white p-6 space-y-4">
        <p className="text-[12px] font-semibold text-[#0E1111]">Risico factoren</p>
        <FactorTable
          factors={RISICO_FACTORS}
          weights={formState.risico_weights}
          presetWeights={currentPreset.config.risico_weights}
          onChange={handleRisicoWeightChange}
          minActive={MIN_ACTIVE}
        />
      </div>
      </div>

      {/* Job status feedback */}
      {jobStatus?.status === 'complete' && (
        <div className="rounded-[24px] border border-[#EAEFEF] bg-white p-6 space-y-3">
          <p className="text-[12px] font-semibold text-[#0E1111]">
            Herberekening voltooid
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-[18px] font-black text-emerald-600 tabular-nums">
                {jobStatus.up_count.toLocaleString('nl-NL')}
              </p>
              <p className="text-[11px] text-slate-400">percelen omhoog</p>
            </div>
            <div className="text-center">
              <p className="text-[18px] font-black text-red-500 tabular-nums">
                {jobStatus.down_count.toLocaleString('nl-NL')}
              </p>
              <p className="text-[11px] text-slate-400">percelen omlaag</p>
            </div>
            <div className="text-center">
              <p className="text-[18px] font-black text-slate-500 tabular-nums">
                {jobStatus.unchanged_count.toLocaleString('nl-NL')}
              </p>
              <p className="text-[11px] text-slate-400">ongewijzigd</p>
            </div>
          </div>
          {jobStatus.avg_delta !== 0 && (
            <p className="text-[11px] text-slate-400 text-center">
              Gemiddelde wijziging:{' '}
              {jobStatus.avg_delta > 0 ? '+' : ''}
              {jobStatus.avg_delta.toFixed(1)} punt
            </p>
          )}
        </div>
      )}

      {jobStatus?.status === 'failed' && (
        <p className="text-[13px] text-red-500">
          Herberekening mislukt — probeer opnieuw
        </p>
      )}
    </div>
  )
}
