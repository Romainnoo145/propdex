import { useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import maplibregl from 'maplibre-gl';
import type { PropertyReportResponse } from '@/lib/types/property';

interface PropertyQuickCardProps {
  data: PropertyReportResponse | null;
  isLoading: boolean;
  onViewDetails: () => void;
  onClose: () => void;
  mapRef: RefObject<maplibregl.Map | null>;
  lngLat: [number, number] | null;
}

/**
 * PropertyQuickCard — MapLibre Popup anchored to the property location.
 * Uses createPortal with a stable container ref to render React content
 * into the popup without DOM ownership conflicts on unmount.
 */
export function PropertyQuickCard({
  data,
  isLoading,
  onViewDetails,
  onClose,
  mapRef,
  lngLat,
}: PropertyQuickCardProps) {
  const popupRef = useRef<maplibregl.Popup | null>(null);
  // Stable container — created once via lazy initializer, never changes.
  // MapLibre moves it into the popup DOM; React manages its children via portal.
  const [containerEl] = useState(() => document.createElement('div'));

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !lngLat) return;

    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      anchor: 'bottom',
      offset: 12,
      className: 'propdex-property-popup',
      maxWidth: 'none',
    });

    popup.setLngLat(lngLat);
    popup.setDOMContent(containerEl);
    popup.addTo(map);

    popupRef.current = popup;
    popup.on('close', onClose);

    return () => {
      popup.remove();
      popupRef.current = null;
    };
  }, [mapRef, lngLat, onClose, containerEl]);

  const address = data?.address;
  const addressLine = address
    ? `${address.straat} ${address.huisnummer}${address.huisletter ?? ''}${address.toevoeging ? ` ${address.toevoeging}` : ''}`
    : '';

  return createPortal(
    <div className="flex items-center gap-2 whitespace-nowrap">
      {isLoading && (
        <div className="flex items-center gap-2 px-1">
          <div className="h-3.5 w-24 animate-pulse rounded bg-white/20" />
        </div>
      )}

      {data && !isLoading && (
        <>
          <svg className="h-4 w-4 shrink-0 text-white/60" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
          </svg>

          <span className="text-sm font-medium text-white">
            {addressLine}
          </span>

          <button
            onClick={onViewDetails}
            className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium text-white transition-colors hover:bg-white/30"
          >
            Details &rarr;
          </button>

          <button
            onClick={onClose}
            className="flex h-5 w-5 items-center justify-center rounded-full text-white/40 transition-colors hover:text-white"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </>
      )}
    </div>,
    containerEl,
  );
}
