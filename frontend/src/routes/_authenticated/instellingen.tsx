import { Outlet, createFileRoute } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import ResultsShell from '@/components/layout/ResultsShell'
import { SettingsTabNav } from '@/components/settings/SettingsTabNav'

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] } },
}

export const Route = createFileRoute('/_authenticated/instellingen')({
  component: InstellingenLayout,
})

function InstellingenLayout() {
  return (
    <ResultsShell>
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={fadeUp} className="mb-8">
          <p
            className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400 mb-2"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Instellingen
          </p>
          <h1 className="text-[32px] font-black tracking-tight text-[#0E1111]">
            Account & voorkeuren
          </h1>
        </motion.div>

        <motion.div variants={fadeUp}>
          <SettingsTabNav />
        </motion.div>

        <motion.div variants={fadeUp} className="mt-6 max-w-3xl pb-8">
          <Outlet />
        </motion.div>
      </motion.div>
    </ResultsShell>
  )
}
