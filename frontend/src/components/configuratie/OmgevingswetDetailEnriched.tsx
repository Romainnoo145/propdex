/**
 * Omgevingswet & Bbl enriched detail view for the configuratie source-detail page.
 *
 * Shows structured reference content about the Dutch Omgevingswet (effective Jan 1 2024):
 *  - Vergunningvrij bouwen criteria
 *  - Meldingsplicht overview
 *  - Omgevingsplanactiviteit (OPA) procedure types
 *  - Bbl (Besluit bouwwerken leefomgeving) key requirements
 *  - External links to authoritative sources
 *
 * Static curated content — no API calls.
 */

import {
  ExternalLink,
  Scale,
  Building2,
  FileText,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  HardHat,
} from 'lucide-react'

/* ─── Types ──────────────────────────────────────────────────── */

interface ReferenceSection {
  id: string
  title: string
  icon: React.ElementType
  intro: string
  items: ReferenceItem[]
}

interface ReferenceItem {
  title: string
  description: string
  bullets?: string[]
  caveat?: string
}

interface ExternalLinkEntry {
  title: string
  description: string
  url: string
}

/* ─── Curated content ────────────────────────────────────────── */

const SECTIONS: ReferenceSection[] = [
  {
    id: 'vergunningvrij',
    title: 'Vergunningvrij bouwen',
    icon: CheckCircle2,
    intro:
      'Onder de Omgevingswet zijn bepaalde bouwactiviteiten vergunningvrij. Dit geldt voor zowel de technische bouwactiviteit (Bbl) als de omgevingsplanactiviteit (ruimtelijk).',
    items: [
      {
        title: 'Bijbehorend bouwwerk aan achterkant',
        description:
          'Aanbouwen, uitbouwen en bijgebouwen in het achtererfgebied tot 4 meter hoog, mits binnen het bebouwingsgebied.',
        bullets: [
          'Maximaal 50% van het bebouwingsgebied bebouwen',
          'Bij woningen: gezamenlijk max 150 m² aan bijbehorende bouwwerken',
          'Niet hoger dan 5 meter (met kap) in achtererfgebied',
        ],
      },
      {
        title: 'Inpandige verbouwingen',
        description:
          'Interne wijzigingen binnen het bestaande gebouw zijn doorgaans vergunningvrij, mits de draagconstructie niet wordt gewijzigd en het gebruik niet verandert.',
        bullets: [
          'Geen wijziging brandcompartimentering',
          'Geen wijziging van de gebruiksfunctie',
          'Constructieve veiligheid moet gewaarborgd blijven',
        ],
      },
      {
        title: 'Dakkapellen (achterkant)',
        description:
          'Een dakkapel aan de achterkant van het dakvlak is vergunningvrij onder voorwaarden.',
        bullets: [
          'Minimaal 0,5 m onder de nok',
          'Minimaal 0,5 m van de zijkanten van het dakvlak',
          'Niet breder dan 2/3 van het dakvlak',
        ],
      },
      {
        title: 'Erfafscheidingen',
        description:
          'Schuttingen en hekwerken tot 2 meter hoog in het achtererfgebied. Aan de voorkant maximaal 1 meter.',
        caveat: 'Gemeentelijk omgevingsplan kan afwijkende regels bevatten.',
      },
    ],
  },
  {
    id: 'meldingsplicht',
    title: 'Meldingsplicht',
    icon: FileText,
    intro:
      'Voor bepaalde bouwactiviteiten volstaat een melding bij de gemeente in plaats van een vergunningaanvraag. De melding moet minstens 4 weken voor de start worden ingediend.',
    items: [
      {
        title: 'Bouwmelding (Bbl)',
        description:
          'Verplicht voor bouwwerken in gevolgklasse 1: grondgebonden woningen, bedrijfshallen, fiets­bruggen en vergelijkbare constructies met beperkt risico.',
        bullets: [
          'Inclusief borgingsplan van de kwaliteitsborger',
          'Minimaal 4 weken voor start bouw indienen',
          'Na afronding: gereedmelding met dossier bevoegd gezag',
        ],
      },
      {
        title: 'Sloopmelding',
        description:
          'Verplicht bij het slopen van meer dan 10 m³ sloopafval, of bij asbesthoudende materialen.',
        bullets: [
          'Minimaal 4 weken voor start sloop',
          'Bij asbest: minimaal 5 werkdagen voor start',
          'Sloopveiligheidsplan vereist bij risico voor omgeving',
        ],
      },
      {
        title: 'Gebruiksmelding',
        description:
          'Nodig bij het in gebruik nemen van gebouwen waar meer dan 50 personen tegelijk aanwezig zullen zijn (niet-woningen).',
        caveat:
          'Geldt niet voor woningen. Check het omgevingsplan voor eventuele aanvullende meldingsplichten.',
      },
    ],
  },
  {
    id: 'opa',
    title: 'Omgevingsplanactiviteit (OPA)',
    icon: Scale,
    intro:
      'De omgevingsplanactiviteit vervangt de oude bestemmingsplanprocedures. Er zijn twee varianten, afhankelijk van of de activiteit past binnen het omgevingsplan.',
    items: [
      {
        title: 'Binnenplanse OPA',
        description:
          'De activiteit past binnen de regels van het omgevingsplan, maar er is wel een vergunning nodig (het omgevingsplan vereist dit expliciet).',
        bullets: [
          'Reguliere procedure: beslistermijn 8 weken',
          'Toetsing aan regels omgevingsplan',
          'Vergunning van rechtswege bij termijnoverschrijding is vervallen',
        ],
        caveat:
          'Let op: de automatische vergunning bij termijnoverschrijding (lex silencio) bestaat niet meer onder de Omgevingswet.',
      },
      {
        title: 'Buitenplanse OPA (BOPA)',
        description:
          'De activiteit wijkt af van het omgevingsplan. Vergelijkbaar met de oude afwijkingsvergunning / projectbesluit.',
        bullets: [
          'Reguliere of uitgebreide procedure (afhankelijk van impact)',
          'Gemeente moet instemmen met de afwijking',
          'Participatie kan verplicht zijn',
          'Evenwichtige toedeling van functies aan locaties',
        ],
      },
      {
        title: 'Wijziging omgevingsplan',
        description:
          'Bij structurele veranderingen kan de gemeente het omgevingsplan zelf wijzigen. Dit is vergelijkbaar met de oude bestemmingsplanwijziging.',
        bullets: [
          'Uitgebreide procedure: 6 maanden + 6 weken zienswijze',
          'Beroep bij de Afdeling bestuursrechtspraak van de Raad van State',
        ],
      },
    ],
  },
  {
    id: 'bbl',
    title: 'Bbl vereisten',
    icon: HardHat,
    intro:
      'Het Besluit bouwwerken leefomgeving (Bbl) bevat de technische bouwvoorschriften. Het vervangt het Bouwbesluit 2012 en bevat regels over veiligheid, gezondheid, duurzaamheid en bruikbaarheid.',
    items: [
      {
        title: 'Gevolgklasse 1 — Kwaliteitsborging (Wkb)',
        description:
          'Grondgebonden woningen en eenvoudige bedrijfsgebouwen vallen onder gevolgklasse 1. Hiervoor geldt het stelsel van kwaliteitsborging: een onafhankelijke kwaliteitsborger toetst het bouwwerk.',
        bullets: [
          'Bouwmelding met borgingsplan verplicht',
          'Gemeente toetst niet meer zelf aan technische eisen',
          'Kwaliteitsborger gebruikt een toegelaten instrument',
          'Gereedmelding met dossier bevoegd gezag na oplevering',
        ],
      },
      {
        title: 'Energieprestatie (BENG)',
        description:
          'Nieuwbouw moet voldoen aan de BENG-eisen (Bijna Energieneutrale Gebouwen). De drie indicatoren zijn energiebehoefte, primair fossiel energiegebruik en aandeel hernieuwbare energie.',
        bullets: [
          'BENG 1: maximale energiebehoefte (kWh/m²)',
          'BENG 2: maximaal primair fossiel energiegebruik (kWh/m²)',
          'BENG 3: minimaal aandeel hernieuwbare energie (%)',
        ],
      },
      {
        title: 'Constructieve veiligheid',
        description:
          'Het Bbl stelt eisen aan de constructieve veiligheid van nieuwe en bestaande bouwwerken, gebaseerd op de Eurocode-normen.',
        bullets: [
          'NEN-EN Eurocode normen voor dimensionering',
          'Specifieke eisen per materiaaltype (staal, beton, hout)',
          'Funderingseisen afhankelijk van grondgesteldheid',
        ],
      },
      {
        title: 'Brandveiligheid',
        description:
          'Eisen voor brandcompartimentering, vluchtwegen, brandwerendheid en brandveilige installaties. Afhankelijk van de gebruiksfunctie.',
        bullets: [
          'Brandcompartimenten max 1.000 m² (woningen) tot 2.500 m² (industrie)',
          'Vluchtwegen moeten rookvrij bereikbaar zijn',
          'Brandmeld- en ontruimingsinstallaties bij bepaalde gebruiksfuncties',
        ],
      },
    ],
  },
]

const EXTERNAL_LINKS: ExternalLinkEntry[] = [
  {
    title: 'Informatiepunt Leefomgeving (IPLO)',
    description:
      'Officiële hulp bij de toepassing van de Omgevingswet — regelhulpen, handleidingen en juridische toelichting.',
    url: 'https://iplo.nl',
  },
  {
    title: 'Omgevingsloket',
    description:
      'Het digitale loket voor vergunningaanvragen, meldingen en vergunningchecks onder de Omgevingswet.',
    url: 'https://omgevingswet.overheid.nl',
  },
  {
    title: 'Wetten.nl — Omgevingswet',
    description: 'De volledige wettekst van de Omgevingswet en bijbehorende besluiten (Bbl, Bkl, Bal).',
    url: 'https://wetten.overheid.nl/BWBR0037885',
  },
  {
    title: 'VNG — Staalkaarten Omgevingsplan',
    description:
      'Voorbeelduitwerkingen en staalkaarten voor gemeentelijke omgevingsplannen.',
    url: 'https://vng.nl/rubrieken/onderwerpen/omgevingswet',
  },
]

/* ─── Section card component ─────────────────────────────────── */

function SectionCard({ section }: { section: ReferenceSection }) {
  const Icon = section.icon

  return (
    <div className="space-y-4 rounded-[16px] border border-[#EAEFEF] bg-white p-5">
      {/* Section header */}
      <div className="flex items-center gap-2.5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-[#F2F6F3]">
          <Icon className="size-4 text-[#0E1111]" />
        </div>
        <h3 className="text-[14px] font-semibold text-[#0E1111]">{section.title}</h3>
      </div>

      {/* Section intro */}
      <p className="text-[13px] leading-relaxed text-slate-500">{section.intro}</p>

      {/* Reference items */}
      <div className="space-y-3">
        {section.items.map((item) => (
          <ReferenceCard key={item.title} item={item} />
        ))}
      </div>
    </div>
  )
}

/* ─── Individual reference card ──────────────────────────────── */

function ReferenceCard({ item }: { item: ReferenceItem }) {
  return (
    <div className="rounded-[12px] border border-[#EAEFEF] bg-[#FAFCFA] p-4 space-y-2.5">
      <h4 className="text-[13px] font-semibold text-[#0E1111]">{item.title}</h4>
      <p className="text-[12px] leading-relaxed text-slate-500">{item.description}</p>

      {item.bullets && item.bullets.length > 0 && (
        <ul className="space-y-1 pl-0.5">
          {item.bullets.map((b) => (
            <li key={b} className="flex items-start gap-2 text-[12px] leading-relaxed text-slate-500">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-slate-300" />
              {b}
            </li>
          ))}
        </ul>
      )}

      {item.caveat && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
          <p className="text-[11px] leading-relaxed text-amber-700">{item.caveat}</p>
        </div>
      )}
    </div>
  )
}

/* ─── External links section ─────────────────────────────────── */

function ExternalLinksSection() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <BookOpen className="size-4 text-slate-400" />
        <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">
          Nuttige bronnen
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {EXTERNAL_LINKS.map((link) => (
          <a
            key={link.url}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start justify-between gap-3 rounded-[16px] border border-[#EAEFEF] bg-white p-4 transition-colors hover:border-blue-200 hover:bg-blue-50/30"
          >
            <div className="space-y-1">
              <p className="text-[13px] font-medium text-[#0E1111]">{link.title}</p>
              <p className="text-[12px] leading-relaxed text-slate-400">{link.description}</p>
            </div>
            <ExternalLink className="mt-0.5 size-4 shrink-0 text-blue-500" />
          </a>
        ))}
      </div>
    </div>
  )
}

/* ─── Header banner ──────────────────────────────────────────── */

function HeaderBanner() {
  return (
    <div className="rounded-[16px] border border-[#EAEFEF] bg-white p-5 space-y-2">
      <div className="flex items-center gap-2.5">
        <div className="flex size-9 items-center justify-center rounded-xl bg-[#F2F6F3]">
          <ShieldCheck className="size-5 text-[#0E1111]" />
        </div>
        <div>
          <h2 className="text-[15px] font-semibold text-[#0E1111]">
            Omgevingswet & Besluit bouwwerken leefomgeving
          </h2>
          <p className="text-[12px] text-slate-400">
            In werking getreden op 1 januari 2024 — vervangt Wabo, Wro, Bouwbesluit 2012
          </p>
        </div>
      </div>
      <p className="text-[13px] leading-relaxed text-slate-500">
        De Omgevingswet bundelt 26 wetten voor de fysieke leefomgeving in één wet. Het Besluit
        bouwwerken leefomgeving (Bbl) bevat de technische bouwvoorschriften. Hieronder vindt u de
        belangrijkste concepten voor vastgoedontwikkeling.
      </p>
    </div>
  )
}

/* ─── Main component ─────────────────────────────────────────── */

export default function OmgevingswetDetailEnriched() {
  return (
    <div className="space-y-6">
      <HeaderBanner />

      {SECTIONS.map((section) => (
        <SectionCard key={section.id} section={section} />
      ))}

      <ExternalLinksSection />
    </div>
  )
}
