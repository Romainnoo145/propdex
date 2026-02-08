/**
 * Onboarding guide for empty report list.
 *
 * Minimalist 3-step guide:
 * 1. Ontdek - Zoek een adres op de kaart
 * 2. Analyseer - Bekijk kadaster, bestemming en monument data
 * 3. Organiseer - Sla rapporten op in projecten
 */
export default function EmptyState() {
  return (
    <div className="px-4 py-8">
      <div className="space-y-4">
        {/* Step 1: Ontdek */}
        <div className="rounded-lg bg-white/5 p-4 opacity-70">
          <div className="mb-2 flex items-center gap-3">
            <SearchIcon />
            <h3 className="text-sm font-medium text-white/90">Ontdek</h3>
          </div>
          <p className="text-xs text-white/60">
            Zoek een adres op de kaart
          </p>
        </div>

        {/* Step 2: Analyseer */}
        <div className="rounded-lg bg-white/5 p-4 opacity-70">
          <div className="mb-2 flex items-center gap-3">
            <ChartIcon />
            <h3 className="text-sm font-medium text-white/90">Analyseer</h3>
          </div>
          <p className="text-xs text-white/60">
            Bekijk kadaster, bestemming en monument data
          </p>
        </div>

        {/* Step 3: Organiseer */}
        <div className="rounded-lg bg-white/5 p-4 opacity-70">
          <div className="mb-2 flex items-center gap-3">
            <FolderIcon />
            <h3 className="text-sm font-medium text-white/90">Organiseer</h3>
          </div>
          <p className="text-xs text-white/60">
            Sla rapporten op in projecten
          </p>
        </div>
      </div>
    </div>
  )
}

// Icons (20x20)
function SearchIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-white/70"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-white/70"
    >
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
    </svg>
  )
}

function FolderIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-white/70"
    >
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  )
}
