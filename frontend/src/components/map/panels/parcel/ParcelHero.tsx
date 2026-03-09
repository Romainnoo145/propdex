import { cn } from '@/lib/utils'

interface ParcelHeroProps {
  parcelId: string
  score: number | null
}

function scoreColor(score: number | null): string {
  if (score === null) return 'bg-neutral-400 text-white'
  if (score >= 70) return 'bg-aura-green text-white'
  if (score >= 50) return 'bg-aura-amber text-white'
  if (score >= 30) return 'bg-amber-500 text-white'
  return 'bg-neutral-400 text-white'
}

export function ParcelHero({ parcelId, score }: ParcelHeroProps) {
  // Satellite crop URL via backend aerial crop endpoint
  const imageUrl = `/api/scans/parcels/${parcelId}/aerial-crop`

  return (
    <div className="relative h-40 w-full shrink-0 overflow-hidden rounded-t-3xl">
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

      {/* Score badge */}
      <span
        className={cn(
          'absolute bottom-3 right-3 inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold shadow-lg',
          scoreColor(score),
        )}
      >
        {score !== null ? score : '--'}
      </span>
    </div>
  )
}
