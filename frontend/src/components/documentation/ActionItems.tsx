/**
 * ActionItems — checklist of manual to-do's for the team.
 *
 * Covers: API integrations to set up, external contacts to make,
 * roadmap features requiring manual work, and broken/unconfigured services.
 */

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  ExternalLink,
  AlertTriangle,
  Plug,
  Phone,
  MapPin,
  ChevronDown,
} from 'lucide-react'

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

const PRIORITY_STYLE: Record<Priority, { label: string; cls: string }> = {
  hoog: { label: 'Hoog', cls: 'border-red-200 bg-red-50 text-red-700' },
  middel: { label: 'Middel', cls: 'border-amber-200 bg-amber-50 text-amber-700' },
  laag: { label: 'Laag', cls: 'border-[#EAEFEF] bg-[#F8FAFA] text-slate-600' },
}

const CATEGORY_CONFIG: Record<Category, { label: string; icon: typeof Plug }> = {
  'api-config': { label: 'API Configuratie', icon: Plug },
  'extern-contact': { label: 'Extern Contact', icon: Phone },
  roadmap: { label: 'Roadmap', icon: MapPin },
  bugfix: { label: 'Fix Nodig', icon: AlertTriangle },
}

/* ── Data ──────────────────────────────────────────────────── */

const ITEMS: ActionItem[] = [
  // ── API Configuratie ──
  {
    id: 'brk-api',
    title: 'Kadaster BRK API activeren',
    description:
      'BRK Bevragen staat op "niet geconfigureerd". Kadaster API-key aanvragen via Kadaster.nl developer portal. Nodig voor eigendomsdata, hypotheek en beslaginfo. Tier 3 — kost per request.',
    category: 'api-config',
    priority: 'hoog',
    url: 'https://developer.kadaster.nl',
  },
  {
    id: 'ep-online',
    title: 'EP-Online API key instellen',
    description:
      'Energielabel ophalen faalt zonder API key. Gratis aan te vragen bij RVO. Zonder key wordt de energielabel-sectie verborgen in rapporten.',
    category: 'api-config',
    priority: 'hoog',
    url: 'https://www.ep-online.nl/PublicApi',
  },
  {
    id: 'google-oauth',
    title: 'Google OAuth configureren',
    description:
      'Google login staat op "not configured". Google Cloud Console project aanmaken, OAuth consent screen instellen, client ID + secret toevoegen aan .env. Nodig voor "Continue with Google" button.',
    category: 'api-config',
    priority: 'middel',
    url: 'https://console.cloud.google.com/apis/credentials',
  },
  {
    id: 'mail-server',
    title: 'Mailserver configureren',
    description:
      'Email verificatie en wachtwoord reset werken niet — mailserver is niet geconfigureerd. SMTP credentials toevoegen aan .env (bijv. via Resend, Postmark of AWS SES).',
    category: 'api-config',
    priority: 'hoog',
  },
  {
    id: 'stripe',
    title: 'Stripe subscription webhook verifiëren',
    description:
      'Subscription endpoints bestaan in de backend maar Stripe webhook signing secret moet geconfigureerd worden voor productie.',
    category: 'api-config',
    priority: 'middel',
    url: 'https://dashboard.stripe.com/webhooks',
  },

  // ── Extern Contact ──
  {
    id: 'vindsubsidies',
    title: 'Vindsubsidies.nl / Cocoon.nl contacten voor subsidie API',
    description:
      'Gemeentelijke subsidies zijn niet beschikbaar via een open API. Vindsubsidies.nl en Cocoon.nl bieden betaalde API\'s met gemeente-specifieke subsidies. Contact opnemen voor pricing en API toegang.',
    category: 'extern-contact',
    priority: 'hoog',
    contact: 'Vindsubsidies.nl / Cocoon.nl',
    url: 'https://www.vindsubsidies.nl',
  },
  {
    id: 'nvm-data',
    title: 'NVM contacten voor transactiedata',
    description:
      'VON-prijs voorspelling en transactiecijfers (roadmap) vereisen NVM data. Dit is een betaalde API. Contact opnemen voor developer access en pricing.',
    category: 'extern-contact',
    priority: 'middel',
    contact: 'NVM',
    url: 'https://www.nvm.nl',
  },
  {
    id: 'kadaster-nhr',
    title: 'Kadaster NHR data voor eigenaarinformatie',
    description:
      'Het Nationaal Handelsregister (via KVK) kan bedrijfsinformatie leveren voor eigenaren die rechtspersonen zijn. Vereist aparte API-overeenkomst.',
    category: 'extern-contact',
    priority: 'laag',
    contact: 'KVK',
    url: 'https://developers.kvk.nl',
  },

  // ── Roadmap ──
  {
    id: 'gemeente-subsidies',
    title: 'Gemeente-specifieke subsidies',
    description:
      'Momenteel tonen we alleen landelijke RVO subsidies. Per gemeente zijn er vaak lokale subsidies voor verduurzaming, woningsplitsing, etc. Vereist externe API (Vindsubsidies/Cocoon) of handmatige inventarisatie.',
    category: 'roadmap',
    priority: 'hoog',
  },
  {
    id: 'subsidie-matching',
    title: 'Subsidie matching per perceel',
    description:
      'Automatisch matchen welke subsidies van toepassing zijn op een specifiek perceel op basis van locatie, type project, en eigendomssituatie.',
    category: 'roadmap',
    priority: 'middel',
  },
  {
    id: 'von-prijs',
    title: 'VON-prijs voorspelling per wijk',
    description:
      'Op basis van NVM transactiedata de verwachte verkoopprijs per woningtype voorspellen. OPENRED biedt dit al. Vereist NVM API access.',
    category: 'roadmap',
    priority: 'middel',
  },
  {
    id: 'wws-punten',
    title: 'WWS huurpunten calculator',
    description:
      'Automatisch berekenen of een woning in het vrije of gereguleerde huursegment valt op basis van oppervlakte, energielabel, WOZ-waarde. Regelgeving is complex maar data is beschikbaar.',
    category: 'roadmap',
    priority: 'middel',
  },
  {
    id: 'rendement-calc',
    title: 'Rendementscalculator bouwen',
    description:
      'Bruto/netto rendement, belastingdruk (Box 1/3/BV), terugverdientijd. Kan met huidige data + configureerbare aannames. Geen externe API nodig.',
    category: 'roadmap',
    priority: 'laag',
  },
  {
    id: 'welstandsnota',
    title: 'Welstandsnota AI-parsing',
    description:
      'Gemeentelijke welstandsnota\'s zijn alleen als PDF beschikbaar. AI-parsing om automatisch de belangrijkste eisen per gebied te extraheren. R&D traject.',
    category: 'roadmap',
    priority: 'laag',
  },
  {
    id: 'omgevingsvisie',
    title: 'Omgevingsvisie per gemeente',
    description:
      'Elke gemeente publiceert een omgevingsvisie (verplicht sinds Omgevingswet 2024). PDF-parsing of gestructureerde data extractie om ontwikkelgebieden en ambities weer te geven.',
    category: 'roadmap',
    priority: 'laag',
  },
  {
    id: 'parkeerbeleid',
    title: 'Parkeernormen per gemeente',
    description:
      'CROW-381 parkeernormen variëren per gemeente. Automatisch ophalen of handmatig invoeren per gemeente. Impact op bouwkosten bij vergunningaanvraag.',
    category: 'roadmap',
    priority: 'laag',
  },
]

/* ── Animation ─────────────────────────────────────────────── */

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] } },
}

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
}

/* ── Component ─────────────────────────────────────────────── */

function ActionCard({ item }: { item: ActionItem }) {
  const [expanded, setExpanded] = useState(false)
  const prio = PRIORITY_STYLE[item.priority]
  const cat = CATEGORY_CONFIG[item.category]
  const CatIcon = cat.icon

  return (
    <motion.div variants={fadeUp}>
      <div
        className="rounded-[20px] border border-[#EAEFEF] bg-white px-5 py-4 transition-all hover:shadow-sm cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#F2F6F3] mt-0.5">
              <CatIcon size={14} strokeWidth={2} className="text-slate-500" />
            </div>
            <div className="min-w-0">
              <h4 className="text-[13px] font-bold text-[#0E1111] leading-snug">
                {item.title}
              </h4>
              {!expanded && (
                <p className="text-[12px] text-slate-400 mt-0.5 line-clamp-1">
                  {item.description}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${prio.cls}`}>
              {prio.label}
            </span>
            <ChevronDown
              size={14}
              className={`text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
          </div>
        </div>

        {expanded && (
          <div className="mt-3 ml-11">
            <p className="text-[12px] text-slate-500 leading-relaxed">
              {item.description}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="rounded-full border border-[#EAEFEF] bg-[#F8FAFA] px-2.5 py-0.5 text-[10px] font-semibold text-slate-500">
                {cat.label}
              </span>
              {item.contact && (
                <span className="text-[11px] text-slate-400">
                  Contact: <span className="font-semibold text-slate-600">{item.contact}</span>
                </span>
              )}
              {item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#D48B1A] hover:text-[#F9A826] transition-colors"
                >
                  Link <ExternalLink size={10} />
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}

export function ActionItems() {
  const [filterCat, setFilterCat] = useState<Category | null>(null)

  const filtered = filterCat ? ITEMS.filter((i) => i.category === filterCat) : ITEMS

  // Count per category
  const counts = ITEMS.reduce(
    (acc, item) => {
      acc[item.category] = (acc[item.category] ?? 0) + 1
      return acc
    },
    {} as Record<Category, number>,
  )

  // Count per priority
  const prioCounts = ITEMS.reduce(
    (acc, item) => {
      acc[item.priority] = (acc[item.priority] ?? 0) + 1
      return acc
    },
    {} as Record<Priority, number>,
  )

  return (
    <div>
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-[16px] border border-red-100 bg-red-50/50 px-4 py-3 text-center">
          <p className="text-[24px] font-black text-red-600 tabular-nums">{prioCounts.hoog ?? 0}</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-red-400">Hoog</p>
        </div>
        <div className="rounded-[16px] border border-amber-100 bg-amber-50/50 px-4 py-3 text-center">
          <p className="text-[24px] font-black text-amber-600 tabular-nums">{prioCounts.middel ?? 0}</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Middel</p>
        </div>
        <div className="rounded-[16px] border border-[#EAEFEF] bg-[#F8FAFA] px-4 py-3 text-center">
          <p className="text-[24px] font-black text-slate-600 tabular-nums">{prioCounts.laag ?? 0}</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Laag</p>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        <button
          onClick={() => setFilterCat(null)}
          className={`rounded-full px-3 py-1.5 text-[11px] font-semibold border transition-colors ${
            filterCat === null
              ? 'bg-[#0E1111] border-[#0E1111] text-white'
              : 'bg-white border-[#EAEFEF] text-slate-600 hover:border-slate-300'
          }`}
        >
          Alle {ITEMS.length}
        </button>
        {(Object.keys(CATEGORY_CONFIG) as Category[]).map((cat) => {
          const cfg = CATEGORY_CONFIG[cat]
          return (
            <button
              key={cat}
              onClick={() => setFilterCat((prev) => (prev === cat ? null : cat))}
              className={`rounded-full px-3 py-1.5 text-[11px] font-semibold border transition-colors ${
                filterCat === cat
                  ? 'bg-[#0E1111] border-[#0E1111] text-white'
                  : 'bg-white border-[#EAEFEF] text-slate-600 hover:border-slate-300'
              }`}
            >
              {cfg.label} {counts[cat] ?? 0}
            </button>
          )
        })}
      </div>

      {/* Items */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="space-y-2"
      >
        {filtered.map((item) => (
          <ActionCard key={item.id} item={item} />
        ))}
      </motion.div>
    </div>
  )
}
