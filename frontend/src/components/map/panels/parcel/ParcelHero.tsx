import { useAerialCrop } from '@/hooks/useScans'

interface ParcelHeroProps {
  parcelId: string
}

export function ParcelHero({ parcelId }: ParcelHeroProps) {
  const { data: blobUrl, isLoading } = useAerialCrop(parcelId)

  return (
    <div className="h-full w-full overflow-hidden relative">
      {/* Satellite image — full-bleed */}
      {blobUrl && (
        <img
          src={blobUrl}
          alt="Luchtfoto perceel"
          className="h-full w-full object-cover"
          onError={(e) => {
            ;(e.target as HTMLImageElement).style.display = 'none'
          }}
        />
      )}

      {/* Fallback gradient */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-aura-sage/40 to-aura-canvas" />

      {/* Loading skeleton */}
      {isLoading && (
        <div className="absolute inset-0 -z-5 animate-pulse bg-aura-sage/30" />
      )}

      {/* Inset shadow for depth — sits on top of image */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ boxShadow: 'inset 0 2px 20px rgba(0,0,0,0.15)' }}
      />
    </div>
  )
}
