import { useRef } from 'react';
import type maplibregl from 'maplibre-gl';
import AppLayout from '@/components/layout/AppLayout';
import MapView from '@/components/map/MapView';

function App() {
  const mapRef = useRef<maplibregl.Map | null>(null);

  return (
    <AppLayout>
      <MapView mapRef={mapRef} />
    </AppLayout>
  );
}

export default App;
