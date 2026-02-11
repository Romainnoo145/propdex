import { useEffect, useRef, useState } from 'react';
import type maplibregl from 'maplibre-gl';
import { TerraDraw } from 'terra-draw';
import { TerraDrawRectangleMode } from 'terra-draw';
import { TerraDrawPolygonMode } from 'terra-draw';
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter';
import bbox from '@turf/bbox';

interface DrawingToolsControlProps {
  map: maplibregl.Map | null;
  onAreaDrawn: (
    bbox: [number, number, number, number],
    geometry: GeoJSON.Geometry
  ) => void;
  disabled?: boolean;
}

type DrawingMode = 'rectangle' | 'polygon' | null;

export default function DrawingToolsControl({
  map,
  onAreaDrawn,
  disabled = false,
}: DrawingToolsControlProps) {
  const drawRef = useRef<TerraDraw | null>(null);
  const [activeMode, setActiveMode] = useState<DrawingMode>(null);

  // Initialize Terra Draw when map is available
  useEffect(() => {
    if (!map) return;

    const draw = new TerraDraw({
      adapter: new TerraDrawMapLibreGLAdapter({ map }),
      modes: [new TerraDrawRectangleMode(), new TerraDrawPolygonMode()],
    });

    draw.start();
    drawRef.current = draw;

    // Handle drawing completion
    draw.on('finish', (id: string | number) => {
      const features = draw.getSnapshot();
      const feature = features.find((f) => f.id === id);

      if (feature) {
        // Calculate bbox in EPSG:4326 (MapLibre native CRS)
        const bounds = bbox(feature) as [number, number, number, number];
        onAreaDrawn(bounds, feature.geometry);

        // Clear drawing and reset mode
        draw.clear();
        setActiveMode(null);
      }
    });

    return () => {
      draw.stop();
      drawRef.current = null;
    };
  }, [map, onAreaDrawn]);

  const handleModeChange = (mode: 'rectangle' | 'polygon') => {
    if (!drawRef.current || disabled) return;

    drawRef.current.clear();
    drawRef.current.setMode(mode);
    setActiveMode(mode);
  };

  const handleCancel = () => {
    if (!drawRef.current) return;

    drawRef.current.clear();
    setActiveMode(null);
  };

  const baseButtonClass =
    'px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2';
  const activeButtonClass =
    'bg-amber-500/30 text-white border border-amber-500/50 shadow-sm';
  const inactiveButtonClass =
    'bg-transparent text-white/70 hover:text-white hover:bg-white/10 border border-transparent';
  const disabledClass = 'opacity-50 cursor-not-allowed';

  return (
    <div
      className="absolute bottom-4 right-4 z-[var(--z-map-controls)] bg-black/30 backdrop-blur-md rounded-lg p-2 flex gap-2 border border-white/20 shadow-lg"
      aria-label="Tekenhulpmiddelen"
    >
      <button
        onClick={() => handleModeChange('rectangle')}
        disabled={disabled}
        className={`${baseButtonClass} ${
          activeMode === 'rectangle' ? activeButtonClass : inactiveButtonClass
        } ${disabled ? disabledClass : ''}`}
        title="Teken rechthoek"
        aria-label="Teken rechthoek"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <rect x="2" y="4" width="12" height="8" rx="1" />
        </svg>
        <span>Rechthoek</span>
      </button>

      <button
        onClick={() => handleModeChange('polygon')}
        disabled={disabled}
        className={`${baseButtonClass} ${
          activeMode === 'polygon' ? activeButtonClass : inactiveButtonClass
        } ${disabled ? disabledClass : ''}`}
        title="Teken polygoon"
        aria-label="Teken polygoon"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M8 2 L14 6 L12 14 L4 14 L2 6 Z" />
        </svg>
        <span>Polygoon</span>
      </button>

      {activeMode !== null && (
        <button
          onClick={handleCancel}
          className={`${baseButtonClass} bg-red-500/20 text-white hover:bg-red-500/30 border border-red-500/50`}
          title="Annuleer tekenen"
          aria-label="Annuleer tekenen"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M4 4 L12 12 M12 4 L4 12" />
          </svg>
          <span>Annuleren</span>
        </button>
      )}
    </div>
  );
}
