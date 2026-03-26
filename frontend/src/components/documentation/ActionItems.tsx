/**
 * ActionItems — checklist of manual to-do's for the team.
 *
 * Redesigned: clean card list grouped by category with amber count rings,
 * modal detail on click, no colored priority cards.
 */

import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ExternalLink, Plug, Phone, MapPin, AlertTriangle, X } from 'lucide-react'
import { staggerContainer, fadeUp } from '@/lib/animations'

/* ── Types ─────────────────────────────────────────────────── */

type Priority = 'hoog' | 'middel' | 'laag'
type Category = 'api-config' | 'extern-contact' | 'roadmap' | 'bugfix'

interface ActionItem {
  id: string
  title: string
  description: string
  category: Category
  priority: Priority
  contact?: string
  url?: string
}

/* ── Config ────────────────────────────────────────────────── */

const CATEGORY_CONFIG: Record<Category, { label: string; icon: typeof Plug }> = {
  'api-config': { label: 'API Configuratie', icon: Plug },
  'extern-contact': { label: 'Extern Contact', icon: Phone },
  roadmap: { label: 'Roadmap', icon: MapPin },
  bugfix: { label: 'Fix Nodig', icon: AlertTriangle },
}

/* ── Data ──────────────────────────────────────────────────── */

const ITEMS: ActionItem[] = [
  { id: 'brk-api', title: 'Kadaster BRK API activeren', description: 'BRK Bevragen staat op "niet geconfigureerd". Kadaster API-key aanvragen via Kadaster.nl developer portal. Nodig voor eigendomsdata, hypotheek en beslaginfo. Tier 3 — kost per request.', category: 'api-config', priority: 'hoog', url: 'https://developer.kadaster.nl' },
  { id: 'google-oauth', title: 'Google OAuth configureren', description: 'Google login staat op "not configured". Google Cloud Console project aanmaken, OAuth consent screen instellen, client ID + secret toevoegen aan .env.', category: 'api-config', priority: 'middel', url: 'https://console.cloud.google.com/apis/credentials' },
  { id: 'mail-server', title: 'Mailserver configureren', description: 'Email verificatie en wachtwoord reset werken niet — mailserver is niet geconfigureerd. SMTP credentials toevoegen aan .env (bijv. via Resend, Postmark of AWS SES).', category: 'api-config', priority: 'hoog' },
  { id: 'stripe', title: 'Stripe subscription webhook verifiëren', description: 'Subscription endpoints bestaan in de backend maar Stripe webhook signing secret moet geconfigureerd worden voor productie.', category: 'api-config', priority: 'middel', url: 'https://dashboard.stripe.com/webhooks' },
  { id: 'vindsubsidies', title: 'Vindsubsidies.nl / Cocoon.nl contacten', description: 'Gemeentelijke subsidies zijn niet beschikbaar via een open API. Vindsubsidies.nl en Cocoon.nl bieden betaalde API\'s met gemeente-specifieke subsidies.', category: 'extern-contact', priority: 'hoog', contact: 'Vindsubsidies.nl / Cocoon.nl', url: 'https://www.vindsubsidies.nl' },
  { id: 'nvm-data', title: 'NVM contacten voor transactiedata', description: 'VON-prijs voorspelling en transactiecijfers vereisen NVM data. Dit is een betaalde API. Contact opnemen voor developer access en pricing.', category: 'extern-contact', priority: 'middel', contact: 'NVM', url: 'https://www.nvm.nl' },
  { id: 'kadaster-nhr', title: 'Kadaster NHR data voor eigenaarinformatie', description: 'Het Nationaal Handelsregister (via KVK) kan bedrijfsinformatie leveren voor eigenaren die rechtspersonen zijn. Vereist aparte API-overeenkomst.', category: 'extern-contact', priority: 'laag', contact: 'KVK', url: 'https://developers.kvk.nl' },
  { id: 'gemeente-subsidies', title: 'Gemeente-specifieke subsidies', description: 'Momenteel tonen we alleen landelijke RVO subsidies. Per gemeente zijn er vaak lokale subsidies. Vereist externe API of handmatige inventarisatie.', category: 'roadmap', priority: 'hoog' },
  { id: 'subsidie-matching', title: 'Subsidie matching per perceel', description: 'Automatisch matchen welke subsidies van toepassing zijn op een specifiek perceel op basis van locatie, type project, en eigendomssituatie.', category: 'roadmap', priority: 'middel' },
  { id: 'von-prijs', title: 'VON-prijs voorspelling per wijk', description: 'Op basis van NVM transactiedata de verwachte verkoopprijs per woningtype voorspellen. Vereist NVM API access.', category: 'roadmap', priority: 'middel' },
  { id: 'wws-punten', title: 'WWS huurpunten calculator', description: 'Automatisch berekenen of een woning in het vrije of gereguleerde huursegment valt op basis van oppervlakte, energielabel, WOZ-waarde.', category: 'roadmap', priority: 'middel' },
  { id: 'rendement-calc', title: 'Rendementscalculator bouwen', description: 'Bruto/netto rendement, belastingdruk (Box 1/3/BV), terugverdientijd. Kan met huidige data + configureerbare aannames.', category: 'roadmap', priority: 'laag' },
  { id: 'welstandsnota', title: 'Welstandsnota AI-parsing', description: 'Gemeentelijke welstandsnota\'s zijn alleen als PDF beschikbaar. AI-parsing om automatisch de belangrijkste eisen per gebied te extraheren.', category: 'roadmap', priority: 'laag' },
  { id: 'omgevingsvisie', title: 'Omgevingsvisie per gemeente', description: 'Elke gemeente publiceert een omgevingsvisie (verplicht sinds Omgevingswet 2024). PDF-parsing of gestructureerde data extractie.', category: 'roadmap', priority: 'laag' },
  { id: 'parkeerbeleid', title: 'Parkeernormen per gemeente', description: 'CROW-381 parkeernormen variëren per gemeente. Automatisch ophalen of handmatig invoeren. Impact op bouwkosten.', category: 'roadmap', priority: 'laag' },
]

/* ── Detail Modal ──────────────────────────────────────────── */

function ActionDetailModal({ item, onClose }: { item: ActionItem; onClose: () => void }) {
  const cat = CATEGORY_CONFIG[item.category]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-lg rounded-[24px] border border-[#EAEFEF] bg-white p-6 shadow-xl"
      >
        <button onClick={onClose} className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full border border-[#EAEFEF] text-slate-400 hover:text-[#0E1111] hover:border-[#0E1111] transition-colors">
          <X size={14} />
        </button>

        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#F9A826] mb-1.5">{cat.label}</p>
        <h3 className="text-[18px] font-bold text-[#0E1111] leading-snug pr-10" style={{ textWrap: 'balance' }}>{item.title}</h3>

        <p className="mt-3 text-[13px] text-slate-600 leading-relaxed">{item.description}</p>

        {item.contact && (
          <div className="mt-4 rounded-xl bg-[#F2F6F3] p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Contact</p>
            <p className="text-[13px] font-semibold text-[#0E1111]">{item.contact}</p>
          </div>
        )}

        {item.url && (
          <a href={item.url} target="_blank" rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#0E1111] px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-slate-800 transition-colors">
            Bekijk <ExternalLink size={14} />
          </a>
        )}
      </motion.div>
    </div>
  )
}

/* ── Component ─────────────────────────────────────────────── */

export function ActionItems() {
  const [filterCat, setFilterCat] = useState<Category | null>(null)
  const [selected, setSelected] = useState<ActionItem | null>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelected(null) }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const filtered = filterCat ? ITEMS.filter((i) => i.category === filterCat) : ITEMS

  // Group by category
  const grouped = new Map<Category, ActionItem[]>()
  for (const item of filtered) {
    const list = grouped.get(item.category) ?? []
    list.push(item)
    grouped.set(item.category, list)
  }

  // Count per category (from all items, not filtered)
  const counts = ITEMS.reduce((acc, item) => { acc[item.category] = (acc[item.category] ?? 0) + 1; return acc }, {} as Record<Category, number>)

  return (
    <div>
      {/* Category filter pills */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        <button
          onClick={() => setFilterCat(null)}
          className={`rounded-full px-3.5 py-1.5 text-[11px] font-semibold border transition-colors ${
            filterCat === null ? 'bg-[#0E1111] border-[#0E1111] text-white' : 'bg-white border-[#EAEFEF] text-slate-600 hover:border-[#0E1111]'
          }`}
        >
          Alle {ITEMS.length}
        </button>
        {(Object.keys(CATEGORY_CONFIG) as Category[]).map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCat((prev) => (prev === cat ? null : cat))}
            className={`rounded-full px-3.5 py-1.5 text-[11px] font-semibold border transition-colors ${
              filterCat === cat ? 'bg-[#0E1111] border-[#0E1111] text-white' : 'bg-white border-[#EAEFEF] text-slate-600 hover:border-[#0E1111]'
            }`}
          >
            {CATEGORY_CONFIG[cat].label} {counts[cat] ?? 0}
          </button>
        ))}
      </div>

      {/* Items grouped by category */}
      <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-8">
        {[...grouped.entries()].map(([cat, items]) => {
          const cfg = CATEGORY_CONFIG[cat]
          const Icon = cfg.icon
          return (
            <motion.div key={cat} variants={fadeUp}>
              {/* Category header */}
              <div className="flex items-center gap-3 mb-3">
                <div className="flex size-9 items-center justify-center rounded-full border-[2.5px] border-[#F9A826]">
                  <span className="text-[13px] font-bold text-[#0E1111] tabular-nums">{items.length}</span>
                </div>
                <h2 className="text-[16px] font-bold text-[#0E1111]">{cfg.label}</h2>
                <div className="h-px flex-1 bg-[#EAEFEF]" />
                <div className="flex size-8 items-center justify-center rounded-full bg-[#0E1111]">
                  <Icon size={14} strokeWidth={2} className="text-[#F9A826]" />
                </div>
              </div>

              {/* Item cards — same style as subsidie cards */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setSelected(item)}
                    className={`flex h-full flex-col rounded-[24px] border bg-white px-6 py-5 transition-shadow hover:shadow-md cursor-pointer ${
                      item.priority === 'hoog' ? 'border-l-[3px] border-l-red-400 border-[#EAEFEF]' : 'border-[#EAEFEF]'
                    }`}
                  >
                    <p className={`text-[10px] font-bold uppercase tracking-[0.12em] mb-1.5 line-clamp-1 ${
                      item.priority === 'hoog' ? 'text-red-500' : item.priority === 'middel' ? 'text-[#F9A826]' : 'text-slate-400'
                    }`}>
                      {item.priority}
                    </p>
                    <h3 className="text-[14px] font-semibold text-[#0E1111] leading-snug">{item.title}</h3>
                    <p className="mt-1.5 text-[13px] text-slate-500 leading-relaxed line-clamp-3">{item.description}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )
        })}
      </motion.div>

      {/* Detail modal */}
      <AnimatePresence>
        {selected && <ActionDetailModal item={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </div>
  )
}
