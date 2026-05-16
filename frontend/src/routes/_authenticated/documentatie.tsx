import { createFileRoute } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import { staggerContainer, fadeUp } from '@/lib/animations'
import ResultsShell from '@/components/layout/ResultsShell'
import { DataCatalog } from '@/components/documentation/DataCatalog'

export const Route = createFileRoute('/_authenticated/documentatie')({
  component: DocumentatiePage,
})

/**
 * /documentatie — overview of data sources per niveau (gemeente, wijk, perceel).
 *
 * M049/S06: actiepunten-toggle removed. Action-item content has fully
 * migrated to /instellingen/data-bronnen action-buttons (per source_key).
 * Page is now single-tab (DataCatalog only).
 */
function DocumentatiePage() {
  return (
    <ResultsShell>
      <motion.div variants={staggerContainer} initial="hidden" animate="show">
        <motion.div variants={fadeUp} className="mb-8">
          <p
            className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400 mb-2"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Documentatie
          </p>
          <h1 className="text-[32px] font-black tracking-tight text-[#0E1111]">
            Data &amp; bronnen
          </h1>
          <p
            className="text-[14px] text-slate-500 mt-2 max-w-2xl leading-relaxed"
            style={{ textWrap: 'pretty' }}
          >
            Overzicht van alle databronnen per niveau — gemeente, wijk en
            perceel. Elke bron toont de herkomst, beschikbaarheid en status.
          </p>
        </motion.div>

        <motion.div variants={fadeUp} className="pb-8">
          <DataCatalog />
        </motion.div>
      </motion.div>
    </ResultsShell>
  )
}
