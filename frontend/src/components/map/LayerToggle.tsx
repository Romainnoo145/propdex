import { useState, useRef, useEffect } from 'react';
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
  onWijkenToggle?: (visible: boolean) => void;
  showWijkenToggle?: boolean; // Only show when gemeente is active
}

function LayerToggle({ mapRef, onParcelsToggle, onGemeentenToggle, onBestemmingsplanToggle, onWijkenToggle, showWijkenToggle }: LayerToggleProps) {
  const [activeLayer, setActiveLayer] = useState<LayerType>('kaart');
  const [showParcels, setShowParcels] = useState(false);
  const [showGemeenten, setShowGemeenten] = useState(false);
  const [showBestemmingsplan, setShowBestemmingsplan] = useState(false);
  const [showWijken, setShowWijken] = useState(true); // Wijken default to visible when loaded

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

  const handleWijkenToggle = () => {
    const newShowWijken = !showWijken;
    setShowWijken(newShowWijken);
    if (onWijkenToggle) {
      onWijkenToggle(newShowWijken);
    }
  };

  // Track when wijken toggle appears/disappears to reset state to default (visible)
  const prevShowWijkenToggleRef = useRef(showWijkenToggle);
  useEffect(() => {
    // Only reset when transitioning from hidden -> visible (gemeente just became active)
    if (showWijkenToggle && !prevShowWijkenToggleRef.current) {
      // Intentional: Reset toggle state to match layer visibility when gemeente becomes active
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowWijken(true);
    }
    prevShowWijkenToggleRef.current = showWijkenToggle;
  }, [showWijkenToggle]);

  const active = 'bg-amber-accent text-grey-950 shadow-sm';
  const inactive = 'bg-transparent text-grey-400 hover:text-grey-100 hover:bg-grey-800';
  const overlayActive = 'bg-amber-accent/25 text-amber-accent shadow-sm';
  const overlayInactive = 'bg-transparent text-grey-400 hover:text-grey-100 hover:bg-grey-800';

  return (
    <div className="absolute bottom-4 left-4 z-[var(--z-map-controls)] bg-grey-900/90 backdrop-blur-md rounded-full p-1 flex gap-0.5 border border-grey-800 shadow-lg">
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

      <div className="border-l border-grey-700 h-6 self-center mx-0.5" />

      <button
        onClick={handleParcelsToggle}
        className={`px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 ${
          showParcels ? overlayActive : overlayInactive
        }`}
      >
        Percelen
      </button>

      <div className="border-l border-grey-700 h-6 self-center mx-0.5" />

      <button
        onClick={handleGemeentenToggle}
        className={`px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 ${
          showGemeenten ? overlayActive : overlayInactive
        }`}
      >
        Gemeenten
      </button>

      <div className="border-l border-grey-700 h-6 self-center mx-0.5" />

      <button
        onClick={handleBestemmingsplanToggle}
        className={`px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 ${
          showBestemmingsplan ? overlayActive : overlayInactive
        }`}
      >
        Bestemmingsplan
      </button>

      {showWijkenToggle && (
        <>
          <div className="border-l border-grey-700 h-6 self-center mx-0.5" />
          <button
            onClick={handleWijkenToggle}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 ${
              showWijken ? overlayActive : overlayInactive
            }`}
          >
            Wijken
          </button>
        </>
      )}
    </div>
  );
}

export default LayerToggle;
