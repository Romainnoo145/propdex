import { describe, expect, it } from 'vitest'
import { ZOOM_SEQUENCE, nextZoom, prevZoom, zoomLabel, zoomToPdfParam } from '../pdf-zoom'

describe('pdf-zoom', () => {
  it('sequence starts at fit and increases', () => {
    expect(ZOOM_SEQUENCE[0]).toBe('fit')
    expect(ZOOM_SEQUENCE).toContain(100)
  })
  it('nextZoom steps up and clamps at the max', () => {
    expect(nextZoom('fit')).toBe(75)
    expect(nextZoom(200)).toBe(200)
  })
  it('prevZoom steps down and clamps at fit', () => {
    expect(prevZoom(75)).toBe('fit')
    expect(prevZoom('fit')).toBe('fit')
  })
  it('zoomLabel renders fit + percentages', () => {
    expect(zoomLabel('fit')).toBe('Passend')
    expect(zoomLabel(100)).toBe('100%')
  })
  it('zoomToPdfParam maps fit to page-width and numbers to the zoom value', () => {
    expect(zoomToPdfParam('fit')).toBe('page-width')
    expect(zoomToPdfParam(125)).toBe('125')
  })
})
