import { useRef } from 'react';
import type maplibregl from 'maplibre-gl';
import MapShell from '@/components/layout/MapShell';
import MapView from '@/components/map/MapView';
import LayerToggle from '@/components/map/LayerToggle';

function App() {
  const mapRef = useRef<maplibregl.Map | null>(null);

  return (
    <MapShell>
      <MapView mapRef={mapRef} />
      <LayerToggle mapRef={mapRef} />
    </MapShell>
  );
}

export default App;
