/**
 * Potentie/Risico balance slider
 *
 * Props:
 * - value: 0.0-1.0 (potentie weight, e.g. 0.7 = 70% potentie, 30% risico discount)
 * - onChange: called with new 0.0-1.0 value on slider input
 */

interface BalanceSliderProps {
  value: number
  onChange: (value: number) => void
}

export function BalanceSlider({ value, onChange }: BalanceSliderProps) {
  const potentiePct = Math.round(value * 100)
  const risicoPct = Math.round((1 - value) * 100)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm font-medium">
        <span className="text-aura-amber">Potentie {potentiePct}%</span>
        <span className="text-red-500">Risico {risicoPct}%</span>
      </div>
      <div className="relative">
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={potentiePct}
          onChange={(e) => onChange(Number(e.target.value) / 100)}
          className="w-full h-2 rounded-full appearance-none cursor-pointer accent-aura-amber bg-[#F2F6F3]"
          style={{
            background: `linear-gradient(to right, #F9A826 0%, #F9A826 ${potentiePct}%, #F2F6F3 ${potentiePct}%, #F2F6F3 100%)`,
          }}
        />
      </div>
      <p className="text-xs text-neutral-500">
        Bepaalt hoeveel risicofactoren de potentiescore kunnen drukken
      </p>
    </div>
  )
}
