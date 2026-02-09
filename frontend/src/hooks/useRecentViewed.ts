/**
 * Recent viewed properties hook with localStorage persistence
 *
 * Tracks the last 10 properties viewed by the user.
 * Stored in localStorage for cross-session persistence.
 *
 * Data structure:
 * - id: nummeraanduiding_id (address identifier)
 * - report_name: "Straat Huisnummer" (display name)
 * - postcode: "1234AB"
 * - woonplaats: "Amsterdam"
 * - viewed_at: timestamp (Date.now())
 *
 * Usage:
 * ```ts
 * const { recent, addRecentItem, clearRecent } = useRecentViewed()
 *
 * // After property lookup:
 * addRecentItem({
 *   id: data.address.nummeraanduiding_id,
 *   report_name: `${data.address.straatnaam} ${data.address.huisnummer}`,
 *   postcode: data.address.postcode,
 *   woonplaats: data.address.woonplaats,
 * })
 * ```
 */

import { useState } from 'react'

export interface RecentItem {
  id: string              // nummeraanduiding_id
  report_name: string     // "Straat Huisnummer"
  postcode: string
  huisnummer: number
  woonplaats: string
  viewed_at: number       // Date.now() timestamp
}

const STORAGE_KEY = 'propdex_recent_viewed'
const MAX_RECENT = 10

/**
 * Load initial state from localStorage
 *
 * This runs once during hook initialization.
 * Using lazy initialization pattern to avoid ESLint warning.
 */
function loadInitialRecent(): RecentItem[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored) as RecentItem[]
    }
  } catch (error) {
    console.error('Failed to load recent viewed items:', error)
  }
  return []
}

/**
 * Hook for managing recently viewed properties
 *
 * @returns Object with recent items array, addRecentItem function, and clearRecent function
 */
export function useRecentViewed() {
  const [recent, setRecent] = useState<RecentItem[]>(loadInitialRecent)

  /**
   * Add a property to recent viewed list
   *
   * - Removes existing entry with same ID (dedup)
   * - Prepends new item with current timestamp
   * - Limits to MAX_RECENT items
   * - Persists to localStorage
   *
   * @param item - Item to add (without viewed_at, will be added automatically)
   */
  const addRecentItem = (item: Omit<RecentItem, 'viewed_at'>) => {
    setRecent((prev) => {
      // Remove existing entry with same id (dedup)
      const filtered = prev.filter((i) => i.id !== item.id)

      // Prepend new item with current timestamp
      const newItem: RecentItem = {
        ...item,
        viewed_at: Date.now(),
      }

      const updated = [newItem, ...filtered].slice(0, MAX_RECENT)

      // Persist to localStorage
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      } catch (error) {
        console.error('Failed to save recent viewed items:', error)
        // Continue without localStorage (quota errors, etc.)
      }

      return updated
    })
  }

  /**
   * Clear all recent viewed items
   */
  const clearRecent = () => {
    setRecent([])
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (error) {
      console.error('Failed to clear recent viewed items:', error)
    }
  }

  return {
    recent,
    addRecentItem,
    clearRecent,
  }
}
