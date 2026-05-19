/**
 * REGRESSION-CRITICAL: pins phase enablement state.
 *
 * Phases 3-8 MUST stay disabled until their milestones ship — premature enable
 * breaks the sidebar greyed-out icon contract from Phase 6 (M050/S06 cockpit
 * shell). The lifecycle sidebar renders icons with `text-slate-300` when
 * `enabled === false`; flipping any of these to `true` before their milestone
 * has shipped exposes dead routes ("Komt later — onderdeel van M0xx" placeholder)
 * to users via the active-icon styling, violating the Phase-6 design contract.
 *
 * Iron rule (eng-plan Phase 8 §"Phase enablement"):
 *   - 1-onderzoek: enabled (Tranche 1 core — always live)
 *   - 2-contact:   enabled (THIS milestone — M050/S06 cont. via Phase 8)
 *   - 3-bod through 8-exit: DISABLED until M060/M070/M080/M090/M100/M110 ship
 *
 * If this test fails, someone toggled a phase prematurely. Revert before merging.
 */
import { describe, it, expect } from 'vitest'
import {
  LIFECYCLE_PHASES,
  getLifecyclePhase,
  type LifecyclePhaseKey,
} from '../phases'

describe('LIFECYCLE_PHASES — Phase 8 enablement contract', () => {
  it('test_only_two_phases_enabled: exactly 2 phases have enabled: true', () => {
    const enabled = LIFECYCLE_PHASES.filter((p) => p.enabled === true)
    expect(enabled).toHaveLength(2)
    expect(enabled.map((p) => p.key).sort()).toEqual(['1-onderzoek', '2-contact'])
  })

  it('test_2_contact_enabled: getLifecyclePhase("2-contact").enabled === true', () => {
    expect(getLifecyclePhase('2-contact').enabled).toBe(true)
  })

  it('test_2_contact_planned_milestone: 2-contact plannedMilestone pinned to Phase 8 marker', () => {
    expect(getLifecyclePhase('2-contact').plannedMilestone).toBe(
      'M050/S06 cont. (Phase 8)',
    )
  })

  it('test_phases_3_to_8_disabled (REGRESSION-CRITICAL): all six future phases stay disabled', () => {
    const futurePhaseKeys: LifecyclePhaseKey[] = [
      '3-bod',
      '4-vergunning',
      '5-bouw',
      '6-verhuur',
      '7-beheer',
      '8-exit',
    ]
    for (const key of futurePhaseKeys) {
      const phase = getLifecyclePhase(key)
      expect(
        phase.enabled,
        `REGRESSION: phase "${key}" must remain enabled=false until its milestone ships`,
      ).toBe(false)
    }
  })

  it('test_1_onderzoek_still_enabled: baseline preserved', () => {
    expect(getLifecyclePhase('1-onderzoek').enabled).toBe(true)
  })

  it('test_phase_count_unchanged: no phases added or removed', () => {
    expect(LIFECYCLE_PHASES).toHaveLength(8)
  })
})
