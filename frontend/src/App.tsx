import React, { Suspense, useRef } from 'react';
import type maplibregl from 'maplibre-gl';
import { Toaster } from 'sonner';
import MapShell from '@/components/layout/MapShell';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

// Lazy load MapLibre components to reduce initial bundle size
const MapView = React.lazy(() => import('@/components/map/MapView'));

// A simple fallback skeleton for the map
function MapSkeleton() {
  return (
    <div className="absolute inset-0 bg-aura-glass-white/60 animate-pulse flex items-center justify-center">
      <span className="text-neutral-600 text-sm">Kaart laden...</span>
    </div>
  );
}

function App() {
  const mapRef = useRef<maplibregl.Map | null>(null);

  return (
    <>
      <MapShell>
        <ErrorBoundary>
          <Suspense fallback={<MapSkeleton />}>
            <MapView mapRef={mapRef} />
          </Suspense>
        </ErrorBoundary>
      </MapShell>
      <Toaster position="top-right" richColors />
    </>
  );
}

export default App;
