import { useState } from 'react';
import type maplibregl from 'maplibre-gl';

type LayerType = 'aerial' | 'kaart';

interface LayerToggleProps {
  mapRef: React.RefObject<maplibregl.Map | null>;
}

function LayerToggle({ mapRef }: LayerToggleProps) {
  const [activeLayer, setActiveLayer] = useState<LayerType>('kaart');

  const handleLayerChange = (layer: LayerType) => {
    if (!mapRef.current || layer === activeLayer) return;

    const map = mapRef.current;

    if (layer === 'aerial') {
      map.setPaintProperty('pdok-aerial-layer', 'raster-opacity', 1);
      map.setPaintProperty('carto-light-layer', 'raster-opacity', 0);
    } else {
      map.setPaintProperty('pdok-aerial-layer', 'raster-opacity', 0);
      map.setPaintProperty('carto-light-layer', 'raster-opacity', 1);
    }

    setActiveLayer(layer);
  };

  const active = 'bg-white/70 text-gray-900 shadow-sm';
  const inactive = 'bg-transparent text-white/70 hover:text-white hover:bg-white/10';

  return (
    <div className="absolute bottom-4 left-4 z-[var(--z-map-controls)] bg-black/30 backdrop-blur-md rounded-full p-1 flex gap-0.5 border border-white/20 shadow-lg">
      <button
        onClick={() => handleLayerChange('kaart')}
        className={`px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 ${
          activeLayer === 'kaart' ? active : inactive
        }`}
      >
        Kaart
      </button>
      <button
        onClick={() => handleLayerChange('aerial')}
        className={`px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 ${
          activeLayer === 'aerial' ? active : inactive
        }`}
      >
        Satellite
      </button>
    </div>
  );
}

export default LayerToggle;
