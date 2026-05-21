import { useAuth } from '@/lib/auth/useAuth'

/**
 * M052/S01 (DEMO-01) — per-org gate for mock surfaces.
 * Derives from already-loaded auth state (no extra round-trip).
 * Non-demo orgs always get false (backend /me enforces org isolation).
 */
export function useHauzerDemo(): boolean {
  const { user } = useAuth()
  return user?.hauzer_demo ?? false
}
