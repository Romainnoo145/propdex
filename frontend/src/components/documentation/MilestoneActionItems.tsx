import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Building2, Scale, Users, Briefcase, X, type LucideIcon } from 'lucide-react'
import { staggerContainer, fadeUp } from '@/lib/animations'

/* ── Types ─────────────────────────────────────────────────── */

type ActionStatus = 'te-doen' | 'lopend' | 'wachten' | 'klaar'

interface MilestoneAction {
  id: string
  title: string
  teaser: string
  toelichting: string
  owner: string
  status: ActionStatus
  timing: string
  volgende_stap: string
}

interface ActionGroup {
  key: string
  label: string
  intro: string
  icon: LucideIcon
  acties: MilestoneAction[]
}

/* ── Status config ──────────────────────────────────────────── */

const STATUS: Record<ActionStatus, { label: string; color: string }> = {
  'te-doen': { label: 'Te doen', color: '#f59e0b' },
  lopend: { label: 'Lopend', color: '#22c55e' },
  wachten: { label: 'Wachten op...', color: '#94a3b8' },
  klaar: { label: 'Klaar', color: '#0E1111' },
}

/* ══════════════════════════════════════════════════════════════
   ACTIE-DATA — in normaal Nederlands, geen jargon
   ══════════════════════════════════════════════════════════════ */

const GROUPS: ActionGroup[] = [
  {
    key: 'contracten',
    label: 'Contracten regelen',
    intro:
      'Twee externe contracten moeten lopen voor we live kunnen. Hoe sneller we starten, hoe minder wall-time wachten op papierwerk.',
    icon: Building2,
    acties: [
      {
        id: 'postnl',
        title: 'PostNL-contract afsluiten',
        teaser:
          'Voor we brieven kunnen versturen, hebben we een zakelijk contract met PostNL nodig.',
        toelichting:
          'Propdex stuurt straks namens elke klant brieven naar perceel-eigenaars. Daarvoor heeft Propdex één centraal zakelijk PostNL-contract nodig — niet elke klant apart. Brieven krijgen wel de bedrijfsnaam van de klant als afzender (klant-branding), niet "Propdex".',
        owner: 'Jij regelt',
        status: 'te-doen',
        timing: 'Direct starten · onboarding-duur onbekend',
        volgende_stap:
          'Aanvraag indienen via PostNL Zakelijk. Vijf vragen om tijdens onboarding antwoord op te krijgen:\n\n1. Wanneer krijgen we test-toegang (sandbox-credentials)?\n2. Kunnen brieven met andere afzender-naam (klant-naam) verstuurd worden?\n3. Wat is het tarief bij grotere volumes (batch-korting)?\n4. Krijgen we automatisch doormelding wanneer brieven aankomen (delivery-webhooks)?\n5. Hoe regelen we dat per brief een andere afzender wordt gebruikt (multi-tenant)?',
      },
      {
        id: 'kadaster',
        title: 'Kadaster-contract afsluiten',
        teaser:
          'Om eigenaargegevens permanent op te slaan, hebben we een formele afspraak met het Kadaster nodig.',
        toelichting:
          'Het Kadaster levert eigendomsinfo via een betaald abonnement. Daarbovenop hebben we een verwerkersovereenkomst nodig om de gegevens namens onze klanten te mogen opslaan. Dit is een juridisch document dat tijd kost om af te ronden.',
        owner: 'Jij regelt',
        status: 'te-doen',
        timing: 'Direct starten · realistisch 4-8 weken voor juridisch klaar',
        volgende_stap:
          'Contact opnemen met Kadaster Zakelijk via klantcontact. Twee dingen aanvragen: (1) een budgetfinanciering-abonnement voor BRK-bevragingen, (2) ondertekening van de verwerkersovereenkomst-template.',
      },
    ],
  },
  {
    key: 'juridisch',
    label: 'Juridisch traject',
    intro:
      'Loopt parallel met de bouw, maar moet rond zijn voordat we live gaan. Niet onderschatten — dit duurt vaak langer dan code schrijven.',
    icon: Scale,
    acties: [
      {
        id: 'privacy-check',
        title: 'Privacy-overeenkomst laten checken',
        teaser:
          'Een jurist of privacy-officer moet onze klant-overeenkomst goedkeuren voordat we live gaan.',
        toelichting:
          'Wij gaan eigendomsdata van klanten opslaan met een vaste bewaartermijn (30 dagen actief, 90 dagen totaal voor BRK-records; 7 jaar voor verzonden brieven). De overeenkomst die we met elke klant tekenen moet dit netjes beschrijven en juridisch kloppen volgens de AVG.',
        owner: 'Jij + externe adviseur',
        status: 'te-doen',
        timing: 'Parallel met de bouw · af voor we live gaan',
        volgende_stap:
          'Bepaal wie deze check gaat doen: Klarifai\'s bestaande adviseur, of iemand via het partner-netwerk (zie partner-actie hieronder). Vraag om één revisie-ronde + eindgoedkeuring.',
      },
    ],
  },
  {
    key: 'klant',
    label: 'Bevestiging van pre-sale klant',
    intro:
      'Vijf dingen om met de pre-sale klant af te tikken voordat we slices openen. Vermijdt rework als aannames niet kloppen.',
    icon: Users,
    acties: [
      {
        id: 'klant-commitment',
        title: 'Klant bevestigt direct-productie op week 8-12',
        teaser:
          'We bouwen 8-12 weken voor één klant. Bevestig dat ze direct in productie willen draaien (geen beta-fase).',
        toelichting:
          'Het office-hours design-doc gaat ervan uit dat de klant bij oplevering direct in productie wil. Geen private beta-fase. Als klant liever eerst een test-fase wil, moeten we de bouw-strategie aanpassen.',
        owner: 'Jij + klant',
        status: 'te-doen',
        timing: 'Voor we de eerste slice plannen',
        volgende_stap:
          'Belafspraak. Bevestig timeline (week 8-13). Vraag expliciet: "Als alles werkt op week 8, gaan jullie er dan direct mee aan de slag, of willen jullie eerst een paar weken stil testen?"',
      },
      {
        id: 'klant-volume',
        title: 'Klant bevestigt onderzoek-volume per maand',
        teaser:
          'Onze quota-voorstellen: 25 BRK + 5 brieven per maand voor Paid. Klopt dat met hun werkwijze?',
        toelichting:
          'We hebben quota voorgesteld op basis van een aanname: klanten onderzoeken ~5 percelen per brief die ze sturen. Voor Paid 10/maand, voor Enterprise 50/maand. Als die verhouding anders is bij deze klant, moeten we de quota-getallen bijstellen voordat we ze in software bouwen.',
        owner: 'Jij + klant',
        status: 'te-doen',
        timing: 'Voor we quota-tabellen in code zetten',
        volgende_stap:
          'Vraag tijdens klant-gesprek: (1) hoeveel percelen onderzoeken jullie per maand, (2) welk deel daarvan krijgt een brief, (3) zijn er piekmaanden of redelijk verdeeld. Bij grote afwijking: nieuwe getallen.',
      },
      {
        id: 'klant-kadaster',
        title: 'Klant heeft eigen Kadaster-contract',
        teaser:
          'Klanten brengen hun eigen Kadaster-abonnement mee. Check of die er al is, anders helpen we ze aanvragen.',
        toelichting:
          'Propdex regelt de Kadaster-data niet voor de klant — dat hoort bij hun eigen bedrijfsvoering. Een Kadaster Zakelijk-contract met budgetfinanciering kost ongeveer €500-2.000 per jaar afhankelijk van volume.',
        owner: 'Jij + klant',
        status: 'te-doen',
        timing: 'Parallel met ons eigen Kadaster-contract',
        volgende_stap:
          'Vraag of klant al een Kadaster Zakelijk-contract heeft. Zo niet: bied aan om de aanvraag samen te begeleiden — dat versnelt onboarding en geeft jou inzicht in budget-niveau.',
      },
      {
        id: 'klant-branding',
        title: 'Klant gaat akkoord met klant-branding op brieven',
        teaser:
          'Brieven gaan via Propdex-PostNL maar met logo en bedrijfsnaam van de klant op de envelop.',
        toelichting:
          'De perceel-eigenaar opent de envelop en ziet KLANT\'s bedrijfsnaam als afzender, niet "Propdex". Logo, voettekst en huisstijl van klant worden in de brief gebruikt. Dit moet de klant goed vinden — sommige bedrijven willen liever alles onder eigen PostNL-account doen.',
        owner: 'Jij + klant',
        status: 'te-doen',
        timing: 'Voor we de branding-upload bouwen',
        volgende_stap:
          'Toon de mock-up van hoe een brief eruit gaat zien (Propdex stuurt, klant brand). Bevestig akkoord. Tegenargument-check: "Willen jullie absoluut eigen PostNL-account? Dat kan, maar werkt anders."',
      },
      {
        id: 'klant-brieven',
        title: 'Klant levert bestaande brieven aan',
        teaser:
          'We bouwen 3 templates op basis van klant\'s huidige huisstijl en tone-of-voice.',
        toelichting:
          'Drie templates: koude benadering (eerste contact), follow-up (na geen reactie), verkennend gesprek (na warm signaal). Klant levert input over toon, openingsregel, ondertekening, en mogelijk bestaande voorbeeld-brieven.',
        owner: 'Jij + klant',
        status: 'te-doen',
        timing: 'Voor we templates bouwen',
        volgende_stap:
          'Vraag klant om 2-3 voorbeeld-brieven die ze nu sturen (anoniem mag). Bepaal samen welke velden altijd ingevuld moeten worden: project-context, eigenaar-aanhef, klant-bedrijfsnaam, contact-info.',
      },
    ],
  },
  {
    key: 'partner',
    label: 'Partner-gesprek items',
    intro:
      'Vijf dingen om met partner door te lopen. Relevant voor sales-coördinatie en angel-pitch-narratief.',
    icon: Briefcase,
    acties: [
      {
        id: 'partner-narratief',
        title: 'Partner: nieuwe sales-verhaal doornemen',
        teaser:
          'Propdex is niet meer alleen onderzoek-tool. Verhaal wordt: van perceel-onderzoek tot brief naar eigenaar.',
        toelichting:
          'Tot dusver pitchten we "we lossen versnipperde vastgoed-due-diligence op". Vanaf deze milestone is het verhaal: "we zijn de cockpit van grondpositie tot brief naar eigenaar". Eén-regel-pitch om te onthouden: "Actiegericht werken kan pas als vooronderzoek klopt." Partner moet dit weten voor sales-gesprekken.',
        owner: 'Jij + partner',
        status: 'te-doen',
        timing: 'Voor volgende klant-pitch',
        volgende_stap:
          'Samen het partner-briefing-document doornemen. Even oefenen met de nieuwe pitch in een mock-gesprek.',
      },
      {
        id: 'partner-cost',
        title: 'Partner: bespreek kosten-impact in Enterprise-tier',
        teaser:
          'PostNL-kosten gaan deels in tier-prijs verstopt. Marges veranderen iets.',
        toelichting:
          'Bij volwaardig actie-gebruik kost PostNL ongeveer €70 per maand per Enterprise-klant. Op een tier-prijs van €1.249/maand is dat 5-6%. De marge zakt van ongeveer 95% naar ongeveer 90%. Bij 50 Enterprise-klanten draagt Propdex ~€3.500/maand PostNL-cost.',
        owner: 'Jij + partner',
        status: 'te-doen',
        timing: 'Voor angel-pitch-update',
        volgende_stap:
          'Bespreek: vanaf welke schaal gaan we batch-korting met PostNL onderhandelen? Bij 100+ klanten zou tarief naar €0,80-1,00 per brief kunnen, wat de marge weer verbetert.',
      },
      {
        id: 'partner-vindsubsidies',
        title: 'Partner: Vindsubsidies-shift communiceren',
        teaser:
          'Vindsubsidies komt later in plaats van als eerste betaalde feature. Check of het al gepitcht is.',
        toelichting:
          'In de oude roadmap was Vindsubsidies de eerste betaalde feature. Nu hebben we besloten dat BRK (Kadaster-eigenaargegevens) eerst komt — bredere use-case, sterker pre-sale signaal. Vindsubsidies schuift naar later (M053+, dus maanden later).',
        owner: 'Jij + partner',
        status: 'te-doen',
        timing: 'Voor volgend extern gesprek',
        volgende_stap:
          'Check met partner: heb je Vindsubsidies expliciet genoemd in eerdere pitches? Zo ja, dan samen een framing bedenken om het naar later te schuiven zonder dat het lijkt alsof we onze roadmap niet kennen.',
      },
      {
        id: 'partner-jurist',
        title: 'Partner: privacy-jurist via netwerk',
        teaser:
          'Mogelijk sneller via partner-netwerk dan via Klarifai-route.',
        toelichting:
          'We hebben een AVG-jurist of privacy-officer nodig voor de overeenkomst-check (zie juridisch-traject hierboven). Een contact via partner-netwerk kan vaak sneller een review-cyclus regelen dan via een formeel kantoor benaderen.',
        owner: 'Jij + partner',
        status: 'te-doen',
        timing: 'Parallel met juridisch-traject',
        volgende_stap:
          'Vraag partner: ken je iemand in je netwerk die AVG-checks doet voor SaaS-producten? Anders gaan we via Klarifai\'s adviseur.',
      },
      {
        id: 'partner-tijdslijn',
        title: 'Partner: tijdslijn 4-6 weken naar achteren',
        teaser:
          'Deze milestone is groter dan eerder geschat. MVP-launch schuift mee.',
        toelichting:
          'Eerdere ruwe schatting voor deze milestone: 4-6 weken. Realistische schatting na detail-planning: 9-13 weken. De totale MVP-launch-datum verschuift dus 4-6 weken naar achteren.',
        owner: 'Jij + partner',
        status: 'te-doen',
        timing: 'Voor volgende angel-presentatie',
        volgende_stap:
          'Bespreek: is dit acceptabel richting angel-pitch, of moeten we strakker stoppen op de minimale MVP-versie om sneller te leveren? Mogelijk de actiefase faseren als eigen pitch-bouwsteen.',
      },
    ],
  },
]

/* ══════════════════════════════════════════════════════════════
   MODAL — full detail on click
   ══════════════════════════════════════════════════════════════ */

function ActionDetailModal({
  actie,
  onClose,
}: {
  actie: MilestoneAction
  onClose: () => void
}) {
  const status = STATUS[actie.status]

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose],
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [handleKeyDown])

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-md"
      >
        <motion.div
          key="modal"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="relative flex flex-col bg-white rounded-[32px] shadow-2xl w-full max-w-xl max-h-[calc(100vh-80px)] mx-4"
        >
          <div className="flex items-start justify-between px-8 pt-7 pb-4 shrink-0">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5 mb-2">
                <div
                  className="h-3 w-3 rounded-full shrink-0"
                  style={{ backgroundColor: status.color }}
                />
                <span
                  className="text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: status.color }}
                >
                  {status.label}
                </span>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  · {actie.owner}
                </span>
              </div>
              <h2 className="text-[22px] font-black tracking-tight text-[#0E1111] leading-tight">
                {actie.title}
              </h2>
            </div>

            <button
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center text-[#0E1111] transition-colors ml-4 mt-0.5"
              aria-label="Sluiten"
            ><X className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-8 pb-8">
            <div className="mb-6">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">
                Wat het is
              </span>
              <p className="text-[13px] text-slate-700 leading-relaxed">
                {actie.toelichting}
              </p>
            </div>

            <div className="mb-6">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">
                Timing
              </span>
              <p className="text-[13px] text-[#0E1111] font-medium">
                {actie.timing}
              </p>
            </div>

            <div className="rounded-[16px] bg-[#FFF8EC] border border-[#FDE68A] p-4">
              <span className="text-[10px] font-black text-[#92400E] uppercase tracking-wider block mb-2">
                Volgende stap
              </span>
              <p className="text-[13px] text-[#0E1111] leading-relaxed whitespace-pre-line">
                {actie.volgende_stap}
              </p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}

/* ══════════════════════════════════════════════════════════════
   CARDS + SECTIONS
   ══════════════════════════════════════════════════════════════ */

function ActionCard({
  actie,
  onOpen,
}: {
  actie: MilestoneAction
  onOpen: () => void
}) {
  const status = STATUS[actie.status]

  return (
    <motion.button
      variants={fadeUp}
      onClick={onOpen}
      className="flex flex-col justify-between rounded-[24px] border border-[#EAEFEF] bg-white p-5 text-left transition-all duration-200 hover:shadow-md hover:border-[#DDE3E3] cursor-pointer h-full"
    >
      <div className="flex items-center justify-between w-full mb-3">
        <div className="flex items-center gap-2">
          <div
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: status.color }}
          />
          <span
            className="text-[10px] font-bold uppercase tracking-wider"
            style={{ color: status.color }}
          >
            {status.label}
          </span>
        </div>
        <span className="text-[9px] font-semibold text-slate-400">
          {actie.owner}
        </span>
      </div>

      <h4 className="text-[15px] font-bold text-[#0E1111] leading-snug mb-2">
        {actie.title}
      </h4>

      <p className="text-[12px] text-slate-500 leading-relaxed line-clamp-3 flex-1">
        {actie.teaser}
      </p>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#EAEFEF]">
        <span className="text-[10px] text-slate-400 font-medium">
          {(actie.timing.split('·')[0] ?? '').trim()}
        </span>
        <span className="text-[10px] text-slate-400 font-medium">Bekijk →</span>
      </div>
    </motion.button>
  )
}

function ActionGroupSection({
  group,
  onOpen,
}: {
  group: ActionGroup
  onOpen: (actie: MilestoneAction) => void
}) {
  const Icon = group.icon
  return (
    <motion.section variants={fadeUp} className="mb-10">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F2F6F3]">
          <Icon className="h-4 w-4 text-[#0E1111]" strokeWidth={1.8} />
        </div>
        <h2 className="text-[20px] font-black tracking-tight text-[#0E1111]">
          {group.label}
        </h2>
        <span className="text-[11px] font-semibold text-slate-400 tabular-nums">
          {group.acties.length} {group.acties.length === 1 ? 'actie' : 'acties'}
        </span>
      </div>
      <p className="text-[13px] text-slate-500 leading-relaxed mb-5 max-w-3xl">
        {group.intro}
      </p>
      <motion.div
        variants={staggerContainer}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        {group.acties.map((actie) => (
          <ActionCard
            key={actie.id}
            actie={actie}
            onOpen={() => onOpen(actie)}
          />
        ))}
      </motion.div>
    </motion.section>
  )
}

/* ══════════════════════════════════════════════════════════════
   MAIN EXPORT
   ══════════════════════════════════════════════════════════════ */

export function MilestoneActionItems() {
  const [openActie, setOpenActie] = useState<MilestoneAction | null>(null)
  const totalActies = GROUPS.reduce((sum, g) => sum + g.acties.length, 0)

  return (
    <>
      <motion.div variants={staggerContainer} initial="hidden" animate="show">
        <motion.div variants={fadeUp} className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-2 w-2 rounded-full bg-aura-amber" />
            <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400">
              Lopende milestone · BRK actiefase
            </span>
          </div>
          <h1 className="text-[32px] font-black tracking-tight text-[#0E1111]">
            Wat moet er nog gebeuren
          </h1>
          <p className="text-[14px] text-slate-500 mt-2 max-w-2xl leading-relaxed">
            {totalActies} dingen die geregeld moeten worden terwijl de bouw
            loopt — contracten, juridisch, klant-bevestigingen en
            partner-coördinatie. Klik op een kaart voor meer informatie.
          </p>
        </motion.div>

        {GROUPS.map((group) => (
          <ActionGroupSection
            key={group.key}
            group={group}
            onOpen={setOpenActie}
          />
        ))}
      </motion.div>

      <AnimatePresence>
        {openActie && (
          <ActionDetailModal
            actie={openActie}
            onClose={() => setOpenActie(null)}
          />
        )}
      </AnimatePresence>
    </>
  )
}
