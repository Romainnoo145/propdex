interface BalanceSliderProps {
  value: number
  onChange: (value: number) => void
}

export function BalanceSlider({ value, onChange }: BalanceSliderProps) {
  const potentiePct = Math.round(value * 100)
  const risicoPct = Math.round((1 - value) * 100)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[12px] font-semibold">
        <span className="text-[#F9A826]">Potentie {potentiePct}%</span>
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
          className="w-full h-2 rounded-full appearance-none cursor-pointer accent-[#F9A826] bg-[#F2F6F3]"
          style={{
            background: `linear-gradient(to right, #F9A826 0%, #F9A826 ${potentiePct}%, #F2F6F3 ${potentiePct}%, #F2F6F3 100%)`,
          }}
        />
      </div>
      <p className="text-[11px] text-slate-400">
        Bepaalt hoeveel risicofactoren de potentiescore kunnen drukken
      </p>
    </div>
  )
}
