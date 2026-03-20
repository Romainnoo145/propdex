import { type Variants } from 'framer-motion'

/**
 * Shared Framer Motion animation variants for gemeente/wijk panels.
 * Matches the proven parcel panel animation system (ParcelBentoOverview).
 */

export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
}

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] } },
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] } },
}
