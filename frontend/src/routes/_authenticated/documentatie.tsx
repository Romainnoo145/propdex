import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Database, ClipboardList } from 'lucide-react'
import ResultsShell from '@/components/layout/ResultsShell'
import { DataCatalog } from '@/components/documentation/DataCatalog'
import { ActionItems } from '@/components/documentation/ActionItems'

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
  const [activeTab, setActiveTab] = useState<'data' | 'acties'>('data')

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
            {activeTab === 'data' ? 'Data & bronnen' : 'Actiepunten'}
          </h1>
          <p className="text-[14px] text-slate-500 mt-2 max-w-2xl leading-relaxed">
            {activeTab === 'data'
              ? 'Overzicht van alle databronnen per niveau — gemeente, wijk en perceel. Elke bron toont de herkomst, beschikbaarheid en status.'
              : 'Manuele taken die opgepakt moeten worden — API configuratie, externe contacten, en roadmap features.'}
          </p>
        </motion.div>

        {/* Tab toggle */}
        <motion.div variants={fadeUp} className="mb-6">
          <div className="flex items-center bg-[#F2F6F3] rounded-[18px] p-1 max-w-md">
            <button
              onClick={() => setActiveTab('data')}
              className={`relative flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[14px] text-[13px] font-bold transition-all duration-200 ${
                activeTab === 'data'
                  ? 'bg-[#0E1111] text-white shadow-lg'
                  : 'text-slate-500 hover:text-[#0E1111]'
              }`}
            >
              <Database size={16} strokeWidth={activeTab === 'data' ? 2 : 1.5} />
              Data & bronnen
            </button>
            <button
              onClick={() => setActiveTab('acties')}
              className={`relative flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[14px] text-[13px] font-bold transition-all duration-200 ${
                activeTab === 'acties'
                  ? 'bg-[#0E1111] text-white shadow-lg'
                  : 'text-slate-500 hover:text-[#0E1111]'
              }`}
            >
              <ClipboardList size={16} strokeWidth={activeTab === 'acties' ? 2 : 1.5} />
              Actiepunten
            </button>
          </div>
        </motion.div>

        <motion.div variants={fadeUp} className="pb-8">
          {activeTab === 'data' ? <DataCatalog /> : <ActionItems />}
        </motion.div>
      </motion.div>
    </ResultsShell>
  )
}
