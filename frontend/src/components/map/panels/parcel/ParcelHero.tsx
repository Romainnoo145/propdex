interface ParcelHeroProps {
  parcelId: string
  score: number | null
}

export function ParcelHero({ parcelId, score }: ParcelHeroProps) {
  // Satellite crop URL via backend aerial crop endpoint
  const imageUrl = `/api/scans/parcels/${parcelId}/aerial-crop`

  return (
    <div className="relative h-[180px] w-full shrink-0 overflow-hidden rounded-t-[32px]">
      {/* Satellite image with fallback gradient */}
      <img
        src={imageUrl}
        alt="Luchtfoto perceel"
        className="h-full w-full object-cover"
        onError={(e) => {
          // Hide broken image, fallback gradient shows through
          ;(e.target as HTMLImageElement).style.display = 'none'
        }}
      />

      {/* Fallback gradient — visible when image fails or loading */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-aura-sage/40 to-aura-canvas" />

      {/* Loading pulse skeleton — sits behind image */}
      <div className="absolute inset-0 -z-20 animate-pulse bg-aura-sage/30" />

      {/* Score badge — Deep Obsidian circle with Amber score */}
      <div className="absolute bottom-3 right-3 flex h-12 w-12 items-center justify-center rounded-full bg-aura-obsidian shadow-lg">
        <span className={score !== null ? 'font-bold text-lg text-aura-amber' : 'font-bold text-lg text-white/50'}>
          {score !== null ? score : '--'}
        </span>
      </div>
    </div>
  )
}
