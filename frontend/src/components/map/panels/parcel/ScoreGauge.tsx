interface ScoreGaugeProps {
  score: number | null
}

export function ScoreGauge({ score }: ScoreGaugeProps) {
  const normalised = score !== null ? Math.min(100, Math.max(0, Math.round(score))) : 0
  const r = 48
  const circumference = 2 * Math.PI * r
  const offset = circumference - (normalised / 100) * circumference

  return (
    <div className="relative flex items-center justify-center">
      <svg
        viewBox="0 0 120 120"
        className="h-[140px] w-[140px]"
        style={{ transform: 'rotate(-90deg)' }}
      >
        {/* Track */}
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth="12"
        />
        {/* Indicator */}
        {score !== null && (
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke="#F9A826"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ filter: 'drop-shadow(0 0 16px rgba(249,168,38,0.4))' }}
          />
        )}
      </svg>
      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl font-black tracking-tighter text-slate-900 tabular-nums leading-none">
          {score !== null ? Math.round(score) : '--'}
        </span>
        <span className="text-[10px] font-bold uppercase text-slate-400 mt-1" style={{ letterSpacing: '0.2em' }}>
          Score
        </span>
      </div>
    </div>
  )
}
