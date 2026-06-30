import { type Variants } from 'framer-motion'

/**
 * Shared Framer Motion animation variants for authenticated route pages.
 * Uses 0.06s stagger for page-level content sections.
 *
 * Note: gemeente panel animations (components/map/panels/gemeente/animations.ts)
 * intentionally use 0.08s stagger for panel-level density — do not consolidate.
 */

export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
}

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] } },
}

/**
 * Directional step/tab transition shared by every stepper-style surface
 * (jurisprudentie WizardFlow steps, beleid category tabs). Pass the slide
 * `direction` via AnimatePresence `custom`:
 *   +1 forward, -1 back, 0 = neutral cross-fade (slight vertical lift).
 * Always pair with <AnimatePresence mode="wait"> (see the StepTransition
 * component) so the exiting node is fully gone before the next enters — no
 * overlap, no flash-back.
 */
export const stepVariants: Variants = {
  enter: (dir: number) =>
    dir === 0 ? { opacity: 0, y: 8 } : { opacity: 0, x: dir > 0 ? 28 : -28 },
  center: { opacity: 1, x: 0, y: 0 },
  exit: (dir: number) =>
    dir === 0 ? { opacity: 0, y: -8 } : { opacity: 0, x: dir > 0 ? -28 : 28 },
}

export const stepTransition = { duration: 0.24, ease: [0.4, 0, 0.2, 1] as const }
