import { useState, useEffect } from 'react'

/**
 * Hook that returns true when the viewport is below the md breakpoint (768px).
 *
 * Uses matchMedia('(max-width: 767px)') — matches Tailwind's md: breakpoint boundary.
 * Initializes synchronously to avoid flicker on first render.
 * SSR-safe: returns false when window is unavailable.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(max-width: 767px)').matches
  })

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)')

    const handler = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches)
    }

    mql.addEventListener('change', handler)

    return () => {
      mql.removeEventListener('change', handler)
    }
  }, [])

  return isMobile
}
