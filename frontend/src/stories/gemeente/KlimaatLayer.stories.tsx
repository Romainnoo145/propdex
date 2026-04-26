/**
 * KlimaatLayer stories — M048 Phase 4
 *
 * Pins BUG-01 success criteria (SC#1, SC#2, SC#3):
 *   SC#1: Switching gemeente A→B updates the verdict label/score within one render cycle
 *   SC#2: No ghost verdict from gemeente A remains after transition
 *   SC#3: Rapid 3-way switch (A→B→C) leaves only gemeente C's verdict visible
 *
 * Uses QueryClientProvider + AuthContext to satisfy useGemeenteProfile,
 * useGemeenteAnalysisStatus, and useDoorlooptijdStats hooks.
 * Cache is pre-seeded via setQueryData — no network calls.
 */

import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within, userEvent, waitFor } from 'storybook/test'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthContext } from '@/lib/auth/AuthContext'
import type { AuthContextValue } from '@/lib/auth/types'
import { KlimaatLayer } from '@/components/map/panels/gemeente/KlimaatLayer'
import type { GemeenteProfile } from '@/hooks/useGemeenteProfile'
import { useState } from 'react'

/* ── Mock Auth ───────────────────────────────────────────────────── */

const mockAuthValue: AuthContextValue = {
  user: {
    id: 'story-user-id',
    email: 'dev@propdex.nl',
    full_name: 'Storybook User',
    organization_id: 'story-org-id',
    email_verified: true,
    auth_provider: 'email',
    is_superuser: false,
    created_at: '2026-01-01T00:00:00Z',
  },
  isLoading: false,
  isAuthenticated: true,
  accessToken: 'story-token',
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  loginWithToken: async () => {},
  loginAsDemo: () => {},
  updateUser: () => {},
}

/* ── GemeenteProfile fixtures ────────────────────────────────────── */
// Venlo: severity='Gunstig'=40 + round(82/100*40)=33 + doorlooptijd=25<30→+20 = 93 → ONTWIKKELKANSRIJK
const VENLO_PROFILE: GemeenteProfile = {
  gemeente_naam: 'Venlo',
  severity_label: 'Gunstig',
  approval_rate_pct: 82,
  rejection_rate_pct: 18,
  avg_doorlooptijd_days: 25,
  bekendmakingen_30d: 12,
  bekendmakingen_90d: 30,
  bekendmakingen_365d: 120,
  permit_type_distribution: { 'Reguliere bouw': 50, 'Sloop': 20, 'Kap': 30 },
  sample_size: 120,
  data_coverage: 'high',
}

// Eindhoven: severity='Ongunstig'=10 + round(44/100*40)=18 + doorlooptijd=110<120→+5 = 33 → LASTIG KLIMAAT
const EINDHOVEN_PROFILE: GemeenteProfile = {
  gemeente_naam: 'Eindhoven',
  severity_label: 'Ongunstig',
  approval_rate_pct: 44,
  rejection_rate_pct: 56,
  avg_doorlooptijd_days: 110,
  bekendmakingen_30d: 5,
  bekendmakingen_90d: 18,
  bekendmakingen_365d: 80,
  permit_type_distribution: { 'Reguliere bouw': 30, 'Sloop': 20, 'Kap': 30 },
  sample_size: 80,
  data_coverage: 'medium',
}

// Amsterdam: severity='Gemiddeld'=25 + round(65/100*40)=26 + doorlooptijd=70<90→+10 = 61 → GEMIDDELD KLIMAAT
const AMSTERDAM_PROFILE: GemeenteProfile = {
  gemeente_naam: 'Amsterdam',
  severity_label: 'Gemiddeld',
  approval_rate_pct: 65,
  rejection_rate_pct: 35,
  avg_doorlooptijd_days: 70,
  bekendmakingen_30d: 18,
  bekendmakingen_90d: 50,
  bekendmakingen_365d: 200,
  permit_type_distribution: { 'Reguliere bouw': 70, 'Sloop': 15, 'Kap': 15 },
  sample_size: 200,
  data_coverage: 'high',
}

const GEMEENTE_FIXTURES: Record<string, { profile: GemeenteProfile; code: string }> = {
  Venlo: { profile: VENLO_PROFILE, code: 'GM0983' },
  Eindhoven: { profile: EINDHOVEN_PROFILE, code: 'GM0772' },
  Amsterdam: { profile: AMSTERDAM_PROFILE, code: 'GM0363' },
}

/* ── QueryClient factory ─────────────────────────────────────────── */

/**
 * Creates a QueryClient pre-seeded with gemeente profile + jurisprudence data.
 * @param seedAll - if true, seeds all three gemeenten (Venlo, Eindhoven, Amsterdam)
 * @param initialNaam - which gemeente to seed (always seeded)
 */
function makeQueryClient(seedAll: boolean, initialNaam: string): QueryClient {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
    },
  })

  function seedGemeente(naam: string) {
    const fixture = GEMEENTE_FIXTURES[naam]
    if (!fixture) return
    queryClient.setQueryData(['gemeente-profile', naam], fixture.profile)
    queryClient.setQueryData(
      ['jurisprudence', 'analysis-status', naam],
      { status: 'completed', total_count: 50, vergunnings_succeskans: 75 } as never,
    )
    queryClient.setQueryData(
      ['jurisprudence', 'doorlooptijd', naam],
      {} as never,
    )
  }

  // Always seed the initial gemeente
  seedGemeente(initialNaam)

  // Optionally seed all three (for rapid-switch and stale-data scenarios)
  if (seedAll) {
    for (const naam of ['Venlo', 'Eindhoven', 'Amsterdam']) {
      seedGemeente(naam)
    }
  }

  return queryClient
}

/* ── Harness component ───────────────────────────────────────────── */

/**
 * KlimaatLayerSwitcher — wraps KlimaatLayer with gemeente-switch buttons.
 *
 * The `key={current}` on KlimaatLayer mirrors the production fix:
 * `key={activePanel.code}` on GemeenteContextPanel in map.tsx forces remount
 * on gemeente switch. The harness applies the same invariant in isolation.
 */
function KlimaatLayerSwitcher({ options }: { options: string[] }) {
  const [current, setCurrent] = useState<string>(options[0] ?? 'Venlo')
  const fixture = GEMEENTE_FIXTURES[current] ?? GEMEENTE_FIXTURES['Venlo']!
  return (
    <div className="flex flex-col gap-2 p-4">
      <div className="flex gap-2">
        {options.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setCurrent(g)}
            aria-label={`switch-to-${g.toLowerCase()}`}
            className="px-3 py-1 rounded bg-amber-500 text-white text-sm"
          >
            {g}
          </button>
        ))}
      </div>
      <div className="h-[600px] w-[420px] bg-white rounded-[24px] overflow-hidden">
        <KlimaatLayer
          key={current}
          gemeenteNaam={current}
          gemeenteCode={fixture.code}
        />
      </div>
    </div>
  )
}

/* ── Meta ────────────────────────────────────────────────────────── */

const meta: Meta<typeof KlimaatLayerSwitcher> = {
  title: 'M048/KlimaatLayer',
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj<typeof KlimaatLayerSwitcher>

/* ── Stories ─────────────────────────────────────────────────────── */

/**
 * Story 1 — PropSwap (BUG-01 SC#1 + SC#2)
 *
 * Initial render shows Venlo's verdict 'ONTWIKKELKANSRIJK'.
 * After clicking "Switch to Eindhoven":
 *   - 'ONTWIKKELKANSRIJK' must be gone from DOM (SC#2: no ghost)
 *   - 'LASTIG KLIMAAT' must be visible (SC#1: verdict updates)
 */
export const PropSwap: Story = {
  name: '1. Gemeente A→B prop-swap shows B verdict (BUG-01 SC#1+SC#2)',
  render: () => {
    const queryClient = makeQueryClient(true, 'Venlo')
    return (
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={mockAuthValue}>
          <div className="h-screen w-screen bg-[#F2F6F3] flex flex-col overflow-hidden">
            <KlimaatLayerSwitcher options={['Venlo', 'Eindhoven']} />
          </div>
        </AuthContext.Provider>
      </QueryClientProvider>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Initial: Venlo verdict ONTWIKKELKANSRIJK visible
    await waitFor(() => {
      expect(canvas.getByText('ONTWIKKELKANSRIJK')).toBeInTheDocument()
    }, { timeout: 2000 })

    // Click "switch-to-eindhoven" button
    await userEvent.click(canvas.getByRole('button', { name: /switch-to-eindhoven/i }))

    // After switch: Venlo verdict gone, Eindhoven verdict 'LASTIG KLIMAAT' visible
    await waitFor(() => {
      expect(canvas.queryByText('ONTWIKKELKANSRIJK')).not.toBeInTheDocument()
      expect(canvas.getByText('LASTIG KLIMAAT')).toBeInTheDocument()
    }, { timeout: 2000 })
  },
}

/**
 * Story 2 — RapidSwitch (BUG-01 SC#3)
 *
 * Rapid 3-way switch: Venlo → Eindhoven → Amsterdam (no await between clicks).
 * Only Amsterdam's 'GEMIDDELD KLIMAAT' must be visible after both clicks.
 * Neither Venlo ('ONTWIKKELKANSRIJK') nor Eindhoven ('LASTIG KLIMAAT') may persist.
 */
export const RapidSwitch: Story = {
  name: '2. Rapid 3-way switch — only last gemeente visible (BUG-01 SC#3)',
  render: () => {
    const queryClient = makeQueryClient(true, 'Venlo')
    return (
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={mockAuthValue}>
          <div className="h-screen w-screen bg-[#F2F6F3] flex flex-col overflow-hidden">
            <KlimaatLayerSwitcher options={['Venlo', 'Eindhoven', 'Amsterdam']} />
          </div>
        </AuthContext.Provider>
      </QueryClientProvider>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Wait for initial Venlo verdict
    await waitFor(() => {
      expect(canvas.getByText('ONTWIKKELKANSRIJK')).toBeInTheDocument()
    }, { timeout: 2000 })

    // Rapid fire: click Eindhoven, then immediately Amsterdam (no waitFor between)
    await userEvent.click(canvas.getByRole('button', { name: /switch-to-eindhoven/i }))
    await userEvent.click(canvas.getByRole('button', { name: /switch-to-amsterdam/i }))

    // Only Amsterdam ('GEMIDDELD KLIMAAT') visible — no ghost from Venlo or Eindhoven
    await waitFor(() => {
      expect(canvas.queryByText('ONTWIKKELKANSRIJK')).not.toBeInTheDocument()
      expect(canvas.queryByText('LASTIG KLIMAAT')).not.toBeInTheDocument()
      expect(canvas.getByText('GEMIDDELD KLIMAAT')).toBeInTheDocument()
    }, { timeout: 2000 })
  },
}

/**
 * Story 3 — NoStaleDataOnSwitch (regression pin)
 *
 * Both Venlo and Eindhoven are pre-seeded in the QueryClient cache BEFORE render
 * (mimics the staleTime=5min real-world scenario where gemeente A data is fresh).
 *
 * Initial render = Venlo.
 * After clicking "Switch to Eindhoven":
 *   - Within 500ms: 'ONTWIKKELKANSRIJK' must be gone from DOM.
 *
 * Without the key prop fix, Eindhoven's pre-seeded data would be served instantly
 * from cache but the OLD KlimaatLayer instance (still subscribed to Venlo queries)
 * would show Venlo's verdict until remount. The key prop forces remount immediately,
 * so Venlo's verdict text must clear within 500ms even with pre-seeded cache.
 */
export const NoStaleDataOnSwitch: Story = {
  name: '3. Regression — Venlo verdict cleared within 500ms after switch (staleTime scenario)',
  render: () => {
    const queryClient = makeQueryClient(true, 'Venlo')
    return (
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={mockAuthValue}>
          <div className="h-screen w-screen bg-[#F2F6F3] flex flex-col overflow-hidden">
            <KlimaatLayerSwitcher options={['Venlo', 'Eindhoven']} />
          </div>
        </AuthContext.Provider>
      </QueryClientProvider>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Initial: Venlo verdict visible
    await waitFor(() => {
      expect(canvas.getByText('ONTWIKKELKANSRIJK')).toBeInTheDocument()
    }, { timeout: 2000 })

    // Switch — both Venlo and Eindhoven data are fresh in cache (staleTime=Infinity in story).
    // The key remount must clear the DOM of Venlo's verdict immediately.
    await userEvent.click(canvas.getByRole('button', { name: /switch-to-eindhoven/i }))

    // Within 500ms, Venlo verdict label must be gone (the bug would leave it visible)
    await waitFor(() => {
      expect(canvas.queryByText('ONTWIKKELKANSRIJK')).not.toBeInTheDocument()
    }, { timeout: 500 })
  },
}
