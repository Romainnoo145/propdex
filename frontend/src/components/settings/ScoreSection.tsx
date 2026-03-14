import { useState, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
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
import { BentoPod } from '@/components/primitives/BentoPod'
import { PresetCards } from './PresetCards'
import { BalanceSlider } from './BalanceSlider'
import { FactorTable } from './FactorTable'

const MIN_ACTIVE = 3

/**
 * Score customization settings section
 *
 * Outer shell handles loading state.
 * Inner form component (ScoreForm) receives initialConfig and owns form state.
 * This pattern avoids setState-in-useEffect by passing loaded data as props.
 */
export function ScoreSection() {
  const { data: loadedData, isLoading } = useOrgScoreWeights()

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-neutral-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Score-profiel laden...</span>
      </div>
    )
  }

  // Pass loaded data as stable prop — ScoreForm initializes from it
  return <ScoreForm key={loadedData?.weights.preset} initialConfig={loadedData?.weights} />
}

interface ScoreFormProps {
  initialConfig: ScoreWeightsConfig | undefined
}

/**
 * Inner form component — owns all mutable form state.
 * Keyed on preset so it re-mounts when server data changes.
 */
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

  // When rescore job completes, invalidate score-weights so map picks up new scores
  const prevJobDoneRef = useRef(false)
  useEffect(() => {
    if (jobStatus?.status === 'complete' && !prevJobDoneRef.current) {
      queryClient.invalidateQueries({ queryKey: ['org', 'score-weights'] })
    }
    prevJobDoneRef.current = jobDone
  }, [jobStatus?.status, jobDone, queryClient])

  // Validation: at least MIN_ACTIVE factors active per category
  const activePotentieCount = POTENTIE_FACTORS.filter(
    (f) => (formState.potentie_weights[f.key] ?? 0) > 0,
  ).length
  const activeRisicoCount = RISICO_FACTORS.filter(
    (f) => (formState.risico_weights[f.key] ?? 0) > 0,
  ).length
  const isValid = activePotentieCount >= MIN_ACTIVE && activeRisicoCount >= MIN_ACTIVE
  const isJobRunning = !!activeJobId && !jobDone

  const canSave = isDirty && isValid && !isSaving && !isJobRunning

  // Resolve current preset weights for toggle restore
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
      {/* Section header */}
      <BentoPod size="spacious">
        <h2 className="text-lg font-semibold text-aura-ink">Score profiel</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Pas de scoremethode aan voor je organisatie
        </p>
      </BentoPod>

      {/* Preset cards */}
      <BentoPod size="spacious" className="space-y-3">
        <p className="text-sm font-medium text-aura-ink">Kies een startprofiel</p>
        <PresetCards
          presets={PRESETS}
          activePreset={formState.preset}
          onSelect={handlePresetSelect}
        />
      </BentoPod>

      {/* Balance slider */}
      <BentoPod size="spacious" className="space-y-3">
        <p className="text-sm font-medium text-aura-ink">
          Potentie / Risico verhouding
        </p>
        <BalanceSlider
          value={formState.potentie_risico_balance}
          onChange={(val) => updateFormState({ potentie_risico_balance: val })}
        />
      </BentoPod>

      {/* Score threshold */}
      <BentoPod size="spacious" className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-aura-ink">
            Minimale score op kaart
          </p>
          <span className="text-sm font-bold text-aura-ink tabular-nums">
            {formState.score_threshold}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={formState.score_threshold}
          onChange={(e) =>
            updateFormState({ score_threshold: Number(e.target.value) })
          }
          className="w-full accent-aura-amber"
        />
        <div className="flex justify-between text-[11px] text-neutral-400">
          <span>Alles tonen</span>
          <span>Alleen topkansen</span>
        </div>
      </BentoPod>

      {/* Potentie factor table */}
      <BentoPod size="spacious" className="space-y-3">
        <p className="text-sm font-medium text-aura-ink">Potentie factoren</p>
        <FactorTable
          factors={POTENTIE_FACTORS}
          weights={formState.potentie_weights}
          presetWeights={currentPreset.config.potentie_weights}
          onChange={handlePotentieWeightChange}
          minActive={MIN_ACTIVE}
        />
      </BentoPod>

      {/* Risico factor table */}
      <BentoPod size="spacious" className="space-y-3">
        <p className="text-sm font-medium text-aura-ink">Risico factoren</p>
        <FactorTable
          factors={RISICO_FACTORS}
          weights={formState.risico_weights}
          presetWeights={currentPreset.config.risico_weights}
          onChange={handleRisicoWeightChange}
          minActive={MIN_ACTIVE}
        />
      </BentoPod>

      {/* Save button area */}
      <BentoPod size="spacious" className="space-y-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="h-12 rounded-full bg-aura-obsidian px-8 text-[15px] font-bold tracking-tight text-white transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSaving || isJobRunning ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Herberekening bezig...
            </span>
          ) : (
            'Opslaan + herbereken'
          )}
        </button>

        {/* Impact preview when job completes */}
        {jobStatus?.status === 'complete' && (
          <div className="rounded-xl bg-aura-canvas p-4 space-y-2">
            <p className="text-sm font-semibold text-aura-ink">
              Herberekening voltooid
            </p>
            <div className="grid grid-cols-3 gap-3 mt-2">
              <div className="text-center">
                <p className="text-lg font-bold text-green-600">
                  {jobStatus.up_count.toLocaleString('nl-NL')}
                </p>
                <p className="text-xs text-neutral-500">percelen omhoog</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-red-500">
                  {jobStatus.down_count.toLocaleString('nl-NL')}
                </p>
                <p className="text-xs text-neutral-500">percelen omlaag</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-neutral-600">
                  {jobStatus.unchanged_count.toLocaleString('nl-NL')}
                </p>
                <p className="text-xs text-neutral-500">ongewijzigd</p>
              </div>
            </div>
            {jobStatus.avg_delta !== 0 && (
              <p className="text-xs text-neutral-500 text-center">
                Gemiddelde wijziging:{' '}
                {jobStatus.avg_delta > 0 ? '+' : ''}
                {jobStatus.avg_delta.toFixed(1)} punt
              </p>
            )}
          </div>
        )}

        {/* Job failed */}
        {jobStatus?.status === 'failed' && (
          <p className="text-sm text-red-500">
            Herberekening mislukt — probeer opnieuw
          </p>
        )}
      </BentoPod>
    </div>
  )
}
