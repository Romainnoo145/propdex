/** Zoom model for the PDF viewer. 'fit' = fit-to-width (the default). */
export type ZoomLevel = 'fit' | number

export const ZOOM_SEQUENCE: ZoomLevel[] = ['fit', 75, 100, 125, 150, 200]

function indexOf(z: ZoomLevel): number {
  const i = ZOOM_SEQUENCE.indexOf(z)
  return i === -1 ? 0 : i
}

export function nextZoom(z: ZoomLevel): ZoomLevel {
  const i = indexOf(z)
  return ZOOM_SEQUENCE[Math.min(i + 1, ZOOM_SEQUENCE.length - 1)]!
}

export function prevZoom(z: ZoomLevel): ZoomLevel {
  const i = indexOf(z)
  return ZOOM_SEQUENCE[Math.max(i - 1, 0)]!
}

export function zoomLabel(z: ZoomLevel): string {
  return z === 'fit' ? 'Passend' : `${z}%`
}

/** PDF Open Parameter for the iframe `#zoom=` fragment. */
export function zoomToPdfParam(z: ZoomLevel): string {
  return z === 'fit' ? 'page-width' : `${z}`
}
