/**
 * Manual TS mirror of backend/app/services/action_items_catalog.py
 * (M049/S06 Plan 06-02).
 *
 * Update both files in lockstep. Drift would mean a row's data-bronnen
 * "Bekijk action item" button shows different copy than the canonical
 * backend catalog.
 *
 * Same kebab-case keys, same field values verbatim.
 *
 * Drift caught by tests/unit/test_action_items_catalog.py (backend) +
 * Python one-shot in plan 06-02 task 1.
 */
import type { ActionItemEntry } from '@/lib/types/action-items'

// ── Entries bound to a DATA_SOURCE_KEYS source_key ───────────────────────────
// key = source_key from data_source_keys.py.
// These surface as the `view_action_item` action-button on data-bronnen rows.
export const ACTION_ITEMS_CATALOG: Record<string, ActionItemEntry> = {
  'brk-eigendom': {
    id: 'brk-eigendom',
    title: 'Kadaster BRK API activeren',
    description:
      "BRK Bevragen staat op 'niet geconfigureerd'. Kadaster API-key aanvragen via Kadaster.nl developer portal. Nodig voor eigendomsdata, hypotheek en beslaginfo. Tier 3 — kost per request. Mapped under 'brk-eigendom' (most user-visible BRK source); brk-hypotheek + brk-beslag share the same Kadaster API auth, so a single ActionItem covers all three.",
    category: 'api-config',
    priority: 'hoog',
    url: 'https://developer.kadaster.nl',
  },
  vindsubsidies: {
    id: 'vindsubsidies',
    title: 'Vindsubsidies.nl / Cocoon.nl contacten',
    description:
      "Gemeentelijke subsidies zijn niet beschikbaar via een open API. Vindsubsidies.nl en Cocoon.nl bieden betaalde API's met gemeente-specifieke subsidies.",
    category: 'extern-contact',
    priority: 'hoog',
    contact: 'Vindsubsidies.nl / Cocoon.nl',
    url: 'https://www.vindsubsidies.nl',
  },
  'nvm-transactiedata': {
    id: 'nvm-transactiedata',
    title: 'NVM contacten voor transactiedata',
    description:
      'VON-prijs voorspelling en transactiecijfers vereisen NVM data. Dit is een betaalde API. Contact opnemen voor developer access en pricing.',
    category: 'extern-contact',
    priority: 'middel',
    contact: 'NVM',
    url: 'https://www.nvm.nl',
  },
  welstandsnota: {
    id: 'welstandsnota',
    title: 'Welstandsnota AI-parsing',
    description:
      'Shipped in M045/S05. Welstandsnota PDFs worden via /instellingen/beleid-beheer geüpload en automatisch door Claude samengevat (document_summary_job). Samenvatting zichtbaar in rapport + parcel dossier.',
    category: 'roadmap',
    priority: 'laag',
    done: true,
  },
  omgevingsvisie: {
    id: 'omgevingsvisie',
    title: 'Omgevingsvisie per gemeente',
    description:
      'Shipped in M045/S05 + S06. Omgevingsvisies worden wekelijks auto-geïmporteerd uit KOOP/CVDR voor elke gemeente, plus handmatige upload via admin. AI-summary + cascade-zichtbaarheid op alle relevante surfaces.',
    category: 'roadmap',
    priority: 'laag',
    done: true,
  },
  parkeerbeleid: {
    id: 'parkeerbeleid',
    title: 'Parkeerbeleid — CROW-381 calculator',
    description:
      'PDF-upload van gemeentelijk parkeerbeleid werkt al (source_key parkeerbeleid). Nog te doen: CROW-381 parkeernorm-calculator die op basis van projecttype + wijktype een parkeereis voorspelt. Impact op bouwkosten.',
    category: 'roadmap',
    priority: 'laag',
  },
}

// ── INFRASTRUCTURE entries (NOT gemeente-bound) ──────────────────────────────
// Future surface: /instellingen/admin or a dedicated infra-actions widget.
// For M049/S06 these are MIGRATED to the catalog but not yet wired to a UI surface.
// Mirrors backend INFRASTRUCTURE_ACTION_ITEMS list.
export const INFRASTRUCTURE_ACTION_ITEMS: ActionItemEntry[] = [
  {
    id: 'google-oauth',
    title: 'Google OAuth configureren',
    description:
      "Google login staat op 'not configured'. Google Cloud Console project aanmaken, OAuth consent screen instellen, client ID + secret toevoegen aan .env.",
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
  {
    id: 'gemeente-subsidies',
    title: 'Gemeente-specifieke subsidies',
    description:
      'Momenteel tonen we alleen landelijke RVO subsidies. Per gemeente zijn er vaak lokale subsidies. Vereist externe API of handmatige inventarisatie.',
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
      'Op basis van NVM transactiedata de verwachte verkoopprijs per woningtype voorspellen. Vereist NVM API access.',
    category: 'roadmap',
    priority: 'middel',
  },
  {
    id: 'wws-punten',
    title: 'WWS huurpunten calculator',
    description:
      'Automatisch berekenen of een woning in het vrije of gereguleerde huursegment valt op basis van oppervlakte, energielabel, WOZ-waarde.',
    category: 'roadmap',
    priority: 'middel',
  },
  {
    id: 'rendement-calc',
    title: 'Rendementscalculator bouwen',
    description:
      'Bruto/netto rendement, belastingdruk (Box 1/3/BV), terugverdientijd. Kan met huidige data + configureerbare aannames.',
    category: 'roadmap',
    priority: 'laag',
  },
  {
    id: 'raadsinformatie-cache',
    title: 'Raadsinformatie DB-cache',
    description:
      'De raadsinformatie service gebruikt nu een in-memory dict als cache die bij elke Railway restart verdampt. Migreren naar cache_manager (DB-backed).',
    category: 'roadmap',
    priority: 'laag',
  },
  {
    id: 'funda-enrichment',
    title: 'Funda enrichment draaien',
    description:
      'Het funda-summary endpoint bestaat en de wijkkaart toont de data, maar alle waarden zijn null omdat de funda-enrichment nog niet is uitgevoerd voor enige scan. Enrichment moet handmatig getriggerd worden om looptijd- en prijsmutatie-data te vullen.',
    category: 'api-config',
    priority: 'middel',
  },
  {
    id: 'chat-model-upgrade',
    title: 'Verkenner chat model upgrade',
    description:
      'De AI-chat in de Verkenner gebruikt momenteel Haiku, wat matige Nederlandse antwoorden oplevert. Upgrade naar Sonnet voor betere kwaliteit, of vereenvoudig de intent-classificatie om verwarring te verminderen.',
    category: 'roadmap',
    priority: 'middel',
  },
]
