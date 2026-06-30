import { type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { stepVariants, stepTransition } from '@/lib/animations'

interface StepTransitionProps {
  /** Unique key per step/tab — a change drives the exit→enter cycle. */
  stepKey: string | number
  /** Slide direction: +1 forward, -1 back, 0 = neutral cross-fade. Default 0. */
  direction?: number
  className?: string
  children: ReactNode
}

/**
 * Reusable directional step/tab transition.
 *
 * Wraps a single keyed child in `AnimatePresence mode="wait"` with the shared
 * `stepVariants`, so the exiting step is fully gone before the next enters
 * (no overlap, no flash-back). This is the single source of truth for the
 * stepper motion used by both the jurisprudentie wizard and the beleid
 * category tabs — previously each surface rolled its own (local variants in
 * WizardFlow, an ad-hoc inline transition in beleid).
 */
export default function StepTransition({
  stepKey,
  direction = 0,
  className,
  children,
}: StepTransitionProps) {
  return (
    <AnimatePresence mode="wait" custom={direction} initial={false}>
      <motion.div
        key={stepKey}
        custom={direction}
        variants={stepVariants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={stepTransition}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
