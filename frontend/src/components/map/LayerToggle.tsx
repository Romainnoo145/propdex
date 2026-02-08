import { useState } from 'react';
import type maplibregl from 'maplibre-gl';

type LayerType = 'aerial' | 'topo';

interface LayerToggleProps {
  mapRef: React.RefObject<maplibregl.Map | null>;
}

function LayerToggle({ mapRef }: LayerToggleProps) {
  const [activeLayer, setActiveLayer] = useState<LayerType>('aerial');

  const handleLayerChange = (layer: LayerType) => {
    if (!mapRef.current) return;

    const map = mapRef.current;

    if (layer === 'aerial') {
      map.setLayoutProperty('pdok-aerial-layer', 'visibility', 'visible');
      map.setLayoutProperty('pdok-topo-layer', 'visibility', 'none');
    } else {
      map.setLayoutProperty('pdok-aerial-layer', 'visibility', 'none');
      map.setLayoutProperty('pdok-topo-layer', 'visibility', 'visible');
    }

    setActiveLayer(layer);
  };

  return (
    <div className="absolute bottom-4 left-4 z-[var(--z-map-controls)] bg-white/90 backdrop-blur-sm rounded-lg shadow-md p-1 flex gap-1">
      <button
        onClick={() => handleLayerChange('aerial')}
        className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
          activeLayer === 'aerial'
            ? 'bg-[var(--color-primary)] text-white'
            : 'bg-transparent text-gray-600 hover:bg-gray-100'
        }`}
      >
        Satellite
      </button>
      <button
        onClick={() => handleLayerChange('topo')}
        className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
          activeLayer === 'topo'
            ? 'bg-[var(--color-primary)] text-white'
            : 'bg-transparent text-gray-600 hover:bg-gray-100'
        }`}
      >
        Kaart
      </button>
    </div>
  );
}

export default LayerToggle;
