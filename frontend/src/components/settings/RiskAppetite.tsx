interface RiskAppetiteProps {
  balance: number
  threshold: number
  onChange: (balance: number, threshold: number) => void
}

const APPETITES = [
  { label: 'Agressief', sub: 'Maximaal kansen, minimaal filter', balance: 0.85, threshold: 0 },
  { label: 'Offensief', sub: 'Potentie-focus, laag filter', balance: 0.8, threshold: 30 },
  { label: 'Gebalanceerd', sub: 'Gelijke weging, standaard filter', balance: 0.65, threshold: 50 },
  { label: 'Voorzichtig', sub: 'Risico meegewogen, strenger filter', balance: 0.5, threshold: 60 },
  { label: 'Conservatief', sub: 'Risico-zwaar, alleen topkansen', balance: 0.3, threshold: 80 },
]

export function RiskAppetite({ balance, threshold, onChange }: RiskAppetiteProps) {
  // Find closest match
  const active = APPETITES.reduce((closest, a) =>
    Math.abs(a.balance - balance) + Math.abs(a.threshold - threshold) <
    Math.abs(closest.balance - balance) + Math.abs(closest.threshold - threshold)
      ? a : closest
  )

  return (
    <div className="flex gap-2">
      {APPETITES.map((a) => {
        const isActive = a.label === active.label
        return (
          <button
            key={a.label}
            type="button"
            onClick={() => onChange(a.balance, a.threshold)}
            className={`flex-1 rounded-[12px] border-2 py-3 text-center transition-all ${
              isActive
                ? 'border-[#0E1111] bg-[#F9A826]'
                : 'border-[#0E1111]/20 bg-white hover:border-[#0E1111]/40'
            }`}
          >
            <p className={`text-[12px] font-bold ${isActive ? 'text-[#0E1111]' : 'text-[#0E1111]'}`}>
              {a.label}
            </p>
            <p className={`text-[10px] mt-0.5 leading-tight ${isActive ? 'text-[#0E1111]/60' : 'text-slate-400'}`}>
              {a.sub}
            </p>
          </button>
        )
      })}
    </div>
  )
}
