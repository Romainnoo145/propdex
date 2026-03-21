interface BalanceSliderProps {
  value: number
  onChange: (value: number) => void
}

const BALANCE_STEPS = [
  { value: 0.3, label: '30/70', sub: 'Risico-focus' },
  { value: 0.5, label: '50/50', sub: 'Gebalanceerd' },
  { value: 0.65, label: '65/35', sub: 'Licht potentie' },
  { value: 0.8, label: '80/20', sub: 'Potentie-zwaar' },
  { value: 0.85, label: '85/15', sub: 'Potentie-focus' },
]

export function BalanceSlider({ value, onChange }: BalanceSliderProps) {
  // Snap to nearest step
  const activeStep = BALANCE_STEPS.reduce((closest, step) =>
    Math.abs(step.value - value) < Math.abs(closest.value - value) ? step : closest
  )

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {BALANCE_STEPS.map((step) => {
          const isActive = step.value === activeStep.value
          return (
            <button
              key={step.value}
              type="button"
              onClick={() => onChange(step.value)}
              className={`flex-1 rounded-[12px] border-2 py-3 text-center transition-all ${
                isActive
                  ? 'border-[#0E1111] bg-[#F9A826]'
                  : 'border-[#0E1111]/20 bg-white hover:border-[#0E1111]/40'
              }`}
            >
              <p className={`text-[13px] font-bold tabular-nums ${isActive ? 'text-[#0E1111]' : 'text-[#0E1111]'}`}>
                {step.label}
              </p>
              <p className={`text-[10px] mt-0.5 ${isActive ? 'text-[#0E1111]/60' : 'text-slate-400'}`}>
                {step.sub}
              </p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
