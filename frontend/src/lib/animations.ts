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
