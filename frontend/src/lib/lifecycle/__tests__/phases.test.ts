/**
 * REGRESSION-CRITICAL: pins phase enablement state + the additive Haalbaarheid insert.
 *
 * Future phases MUST stay disabled until their milestones ship — premature enable
 * breaks the sidebar greyed-out icon contract from Phase 6 (M050/S06 cockpit
 * shell). The lifecycle sidebar renders icons with `text-slate-300` when
 * `enabled === false`; flipping any of these to `true` before their milestone
 * has shipped exposes dead routes ("Komt later — onderdeel van M0xx" placeholder)
 * to users via the active-icon styling, violating the Phase-6 design contract.
 *
 * Iron rule:
 *   - 1-onderzoek:     enabled (Tranche 1 core — always live)
 *   - 2-contact:       enabled (M050/S06 cont. via Phase 8)
 *   - 3-voorbereiding:  enabled (M052/S02 acquisitie-arc — projecttype-gedreven checklist)
 *   - 4-bod through 9-exit: DISABLED until M060/M070/M080/M090/M100/M110 ship
 *
 * M052/S02: Haalbaarheid is ADDITIVE — inserted at order 3 between Contact and Bod,
 * downstream phases renumbered (8 → 9 fases). No phase removed; all original phases
 * (now relabeled) still present. If this test fails, someone toggled a phase
 * prematurely or dropped a phase. Revert before merging.
 */
import { describe, it, expect } from 'vitest'
import {
  LIFECYCLE_PHASES,
  getLifecyclePhase,
  type LifecyclePhaseKey,
} from '../phases'

describe('LIFECYCLE_PHASES — enablement + additive-Haalbaarheid contract', () => {
  it('test_three_phases_enabled: exactly 3 phases have enabled: true', () => {
    const enabled = LIFECYCLE_PHASES.filter((p) => p.enabled === true)
    expect(enabled).toHaveLength(3)
    expect(enabled.map((p) => p.key).sort()).toEqual([
      '1-onderzoek',
      '2-contact',
      '3-voorbereiding',
    ])
  })

  it('test_2_contact_enabled: getLifecyclePhase("2-contact").enabled === true', () => {
    expect(getLifecyclePhase('2-contact').enabled).toBe(true)
  })

  it('test_2_contact_planned_milestone: 2-contact plannedMilestone pinned to Phase 8 marker', () => {
    expect(getLifecyclePhase('2-contact').plannedMilestone).toBe(
      'M050/S06 cont. (Phase 8)',
    )
  })

  it('test_3_haalbaarheid_added: order 3, enabled, label "3. Voorbereiding"', () => {
    const haalbaarheid = getLifecyclePhase('3-voorbereiding')
    expect(haalbaarheid.order).toBe(3)
    expect(haalbaarheid.enabled).toBe(true)
    expect(haalbaarheid.label).toBe('3. Voorbereiding')
  })

  it('test_future_phases_disabled (REGRESSION-CRITICAL): all six future phases stay disabled', () => {
    const futurePhaseKeys: LifecyclePhaseKey[] = [
      '4-bod',
      '5-vergunning',
      '6-bouw',
      '7-verhuur',
      '8-beheer',
      '9-exit',
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

  it('test_phase_count: 9 phases after additive Haalbaarheid insert', () => {
    expect(LIFECYCLE_PHASES).toHaveLength(9)
  })

  it('test_no_original_phase_removed: all original 8 phases still present (relabeled)', () => {
    // The original 8-phase model — every one must survive the additive insert.
    const originalLabels = [
      'Onderzoek',
      'Contact',
      'Bod',
      'Vergunning',
      'Bouw',
      'Verhuur',
      'Beheer',
      'Exit',
    ]
    const shortLabels = LIFECYCLE_PHASES.map((p) => p.shortLabel)
    for (const label of originalLabels) {
      expect(shortLabels, `original phase "${label}" must still exist`).toContain(label)
    }
    // Plus the new one.
    expect(shortLabels).toContain('Voorbereiding')
  })

  it('test_ordered_keys: phases are sequentially ordered 1..9', () => {
    expect(LIFECYCLE_PHASES.map((p) => p.key)).toEqual([
      '1-onderzoek',
      '2-contact',
      '3-voorbereiding',
      '4-bod',
      '5-vergunning',
      '6-bouw',
      '7-verhuur',
      '8-beheer',
      '9-exit',
    ])
    LIFECYCLE_PHASES.forEach((p, i) => expect(p.order).toBe(i + 1))
  })
})
