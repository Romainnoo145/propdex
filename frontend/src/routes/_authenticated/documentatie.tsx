import { createFileRoute } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import ResultsShell from '@/components/layout/ResultsShell'
import { DataCatalog } from '@/components/documentation/DataCatalog'

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] } },
}

export const Route = createFileRoute('/_authenticated/documentatie')({
  component: DocumentatiePage,
})

function DocumentatiePage() {
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
            Documentatie
          </p>
          <h1 className="text-[32px] font-black tracking-tight text-[#0E1111]">
            Data & bronnen
          </h1>
          <p className="text-[14px] text-slate-500 mt-2 max-w-2xl leading-relaxed">
            Overzicht van alle databronnen per niveau — gemeente, wijk en perceel.
            Elke bron toont de herkomst, beschikbaarheid en status.
          </p>
        </motion.div>

        <motion.div variants={fadeUp} className="pb-8">
          <DataCatalog />
        </motion.div>
      </motion.div>
    </ResultsShell>
  )
}
