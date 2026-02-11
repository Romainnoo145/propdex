import { useState } from 'react';
import type maplibregl from 'maplibre-gl';
import {
  addParcelBoundariesLayer,
  setParcelBoundariesVisibility,
} from './ParcelBoundariesLayer';

type LayerType = 'aerial' | 'kaart';

interface LayerToggleProps {
  mapRef: React.RefObject<maplibregl.Map | null>;
  onParcelsToggle?: (visible: boolean) => void;
  onGemeentenToggle?: (visible: boolean) => void;
  onBestemmingsplanToggle?: (visible: boolean) => void;
}

function LayerToggle({ mapRef, onParcelsToggle, onGemeentenToggle, onBestemmingsplanToggle }: LayerToggleProps) {
  const [activeLayer, setActiveLayer] = useState<LayerType>('kaart');
  const [showParcels, setShowParcels] = useState(false);
  const [showGemeenten, setShowGemeenten] = useState(false);
  const [showBestemmingsplan, setShowBestemmingsplan] = useState(false);

  const handleLayerChange = (layer: LayerType) => {
    if (!mapRef.current || layer === activeLayer) return;

    const map = mapRef.current;

    if (layer === 'aerial') {
      map.setPaintProperty('esri-satellite-layer', 'raster-opacity', 1);
      map.setPaintProperty('carto-light-layer', 'raster-opacity', 0);
    } else {
      map.setPaintProperty('esri-satellite-layer', 'raster-opacity', 0);
      map.setPaintProperty('carto-light-layer', 'raster-opacity', 1);
    }

    setActiveLayer(layer);
  };

  const handleParcelsToggle = () => {
    if (!mapRef.current) return;

    const map = mapRef.current;
    const newShowParcels = !showParcels;

    // If source doesn't exist yet, add it first
    if (!map.getSource('pdok-parcels')) {
      addParcelBoundariesLayer(map);
    }

    // Toggle visibility
    setParcelBoundariesVisibility(map, newShowParcels);
    setShowParcels(newShowParcels);

    // Notify parent component
    if (onParcelsToggle) {
      onParcelsToggle(newShowParcels);
    }
  };

  const handleGemeentenToggle = () => {
    if (!mapRef.current) return;

    const newShowGemeenten = !showGemeenten;
    setShowGemeenten(newShowGemeenten);

    // Notify parent component to handle layer addition/removal
    if (onGemeentenToggle) {
      onGemeentenToggle(newShowGemeenten);
    }
  };

  const handleBestemmingsplanToggle = () => {
    const newShowBestemmingsplan = !showBestemmingsplan;
    setShowBestemmingsplan(newShowBestemmingsplan);

    // Notify parent component to handle layer addition/removal
    if (onBestemmingsplanToggle) {
      onBestemmingsplanToggle(newShowBestemmingsplan);
    }
  };

  const active = 'bg-white/70 text-gray-900 shadow-sm';
  const inactive = 'bg-transparent text-white/70 hover:text-white hover:bg-white/10';
  const parcelActive = 'bg-blue-500/30 text-white shadow-sm';
  const parcelInactive = 'bg-transparent text-white/70 hover:text-white hover:bg-white/10';
  const gemeenteActive = 'bg-emerald-500/30 text-white shadow-sm';
  const gemeenteInactive = 'bg-transparent text-white/70 hover:text-white hover:bg-white/10';
  const bestemmingsplanActive = 'bg-purple-500/30 text-white shadow-sm';
  const bestemmingsplanInactive = 'bg-transparent text-white/70 hover:text-white hover:bg-white/10';

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

      <div className="border-l border-white/20 h-6 self-center mx-0.5" />

      <button
        onClick={handleParcelsToggle}
        className={`px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 ${
          showParcels ? parcelActive : parcelInactive
        }`}
      >
        Percelen
      </button>

      <div className="border-l border-white/20 h-6 self-center mx-0.5" />

      <button
        onClick={handleGemeentenToggle}
        className={`px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 ${
          showGemeenten ? gemeenteActive : gemeenteInactive
        }`}
      >
        Gemeenten
      </button>

      <div className="border-l border-white/20 h-6 self-center mx-0.5" />

      <button
        onClick={handleBestemmingsplanToggle}
        className={`px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 ${
          showBestemmingsplan ? bestemmingsplanActive : bestemmingsplanInactive
        }`}
      >
        Bestemmingsplan
      </button>
    </div>
  );
}

export default LayerToggle;
