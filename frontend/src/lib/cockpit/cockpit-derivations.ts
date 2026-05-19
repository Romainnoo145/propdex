/**
 * Cockpit derivation logic — next-step + missing-cards + activity rows.
 * Extracted from FavoriteParcelWorkspaceView.tsx 2026-05-19 (Plan 08-06 split, M050/S06 cont.).
 *
 * Pure helpers. Plan 08-07 (M050/S06 cont., AD1) REPLACED the BRK persist CTA on
 * fase-1 (Onderzoek) with a Contact-handoff CTA — BRK lives on fase-2 per the
 * "fase-overgang IS the gate, geen score-drempel" rule. The handoff fires on ANY
 * fase-1 parcel regardless of scores. See iron-rule canary in
 * __tests__/OnderzoekPhaseView.parity.test.tsx.
 */
import type { ParcelDocumentMeta } from '@/lib/types/document'
import type { FavoriteResponse } from '@/lib/types/portfolio'
import {
  REQUIRED_CARD_PRIORITY,
  type DossierCardWithContext,
} from './dossier-pages'

const WORKSPACE_DATE_TIME = new Intl.DateTimeFormat('nl-NL', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function formatWorkspaceDate(value: string | null | undefined): string | null {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return WORKSPACE_DATE_TIME.format(parsed)
}

export function deriveMissingCards(cards: DossierCardWithContext[]): DossierCardWithContext[] {
  const cardMap = new Map(cards.map((card) => [card.key, card]))
  return REQUIRED_CARD_PRIORITY.map((key) => cardMap.get(key)).filter(
    (card): card is DossierCardWithContext => Boolean(card && !card.filled),
  )
}

/**
 * Discriminated next-step shape.
 *
 * - kind 'default': passive copy-only suggestion (legacy shape).
 * - kind 'contact-handoff': fires on ANY fase-1 (Onderzoek) parcel — surfaces a
 *   navigation CTA to the Contact phase. Per Plan 08-07 / AD1, no score-threshold
 *   gating. The fase-overgang IS the gate.
 */
export type NextStep =
  | { kind: 'default'; title: string; detail: string }
  | {
      kind: 'contact-handoff'
      title: string
      detail: string
      cta: {
        kind: 'route'
        to: '/opgeslagen/perceel/$parcelId/$phase'
        params: { phase: '2-contact' }
        label: string
      }
    }

export function deriveNextStep(
  favorite: FavoriteResponse,
  allCards: DossierCardWithContext[],
  missingCards: DossierCardWithContext[],
): NextStep {
  const missingKeys = new Set(missingCards.map((card) => card.key))
  const correspondenceCount =
    allCards.find((card) => card.key === 'correspondentie')?.documents.length ?? 0

  // If report exists, next step shifts to review / dossier completeness.
  // Plan 08-07 / AD1: BRK persist branch removed (BRK lives on fase-2).
  if (favorite.has_report && favorite.pipeline_stage === 'Gesignaleerd') {
    return {
      kind: 'default',
      title: 'Bekijk je rapport en plan opvolging',
      detail:
        "Je rapport is gegenereerd. Loop de risico's en potentie door en bepaal of dit perceel naar de onderzoeksfase gaat.",
    }
  }

  if (favorite.pipeline_stage === 'Afgerond') {
    if (favorite.afgerond_reden === 'Gekocht') {
      return {
        kind: 'default',
        title: 'Werk het vervolgdossier uit',
        detail:
          'Leg overdracht, uitvoeringsstukken en verdere correspondentie vast zodat het perceel direct projectklaar blijft.',
      }
    }
    return {
      kind: 'default',
      title: 'Bewaar leerpunten compact',
      detail:
        'Zet de afwijzingsreden, eventuele heropeningssignalen en relevante stukken overzichtelijk weg voor later.',
    }
  }

  if (favorite.pipeline_stage === 'Besluit') {
    if (
      missingKeys.has('bouwkundig') ||
      missingKeys.has('bodem') ||
      missingKeys.has('fundering')
    ) {
      return {
        kind: 'default',
        title: 'Maak het besluitdossier compleet',
        detail:
          'Er ontbreken nog technische stukken die je nodig hebt om stevig te kunnen kopen, parkeren of afwijzen.',
      }
    }
    return {
      kind: 'default',
      title: 'Bundel het beslisdossier',
      detail:
        'Zet quickscan, eigendom, technische checks en correspondentie naast elkaar voor een scherp investeringsbesluit.',
    }
  }

  if (favorite.pipeline_stage === 'Contact') {
    if (correspondenceCount === 0) {
      return {
        kind: 'default',
        title: 'Leg de eerste outreach vast',
        detail:
          'Sla mail, brief of gespreksnotities op in Correspondentie zodat opvolging niet buiten het perceeldossier valt.',
      }
    }
    if (missingKeys.has('eigendom')) {
      return {
        kind: 'default',
        title: 'Rond het eigenaarsspoor af',
        detail:
          'Vraag eigendomsinformatie op voordat je verder escaleert in contact of onderhandeling.',
      }
    }
    return {
      kind: 'default',
      title: 'Plan de opvolging',
      detail:
        'Werk het volgende contactmoment uit en koppel nieuwe reacties of stukken direct terug aan het dossier.',
    }
  }

  // Fase-1 (Onderzoek) → Fase-2 (Contact) handoff.
  // Plan 08-07 / AD1: BRK persist branch removed; handoff fires unconditionally
  // on Onderzoek. The fase-overgang IS the gate (no score threshold).
  if (favorite.pipeline_stage === 'Onderzoek') {
    return {
      kind: 'contact-handoff',
      title: 'Klaar met onderzoek?',
      detail:
        'Stap door naar Contact om eigendom op te vragen en outreach voor te bereiden.',
      cta: {
        kind: 'route',
        to: '/opgeslagen/perceel/$parcelId/$phase',
        params: { phase: '2-contact' },
        label: 'Naar Contact-fase →',
      },
    }
  }

  if (missingKeys.has('quickscan')) {
    return {
      kind: 'default',
      title: 'Genereer rapport',
      detail:
        'Start met een quickscan zodat dit perceel van een ruwe signalering naar een toetsbaar acquisitiedossier gaat.',
    }
  }

  if (missingKeys.has('bestemmingscheck')) {
    return {
      kind: 'default',
      title: 'Bevestig de bestemmingsruimte',
      detail:
        'Leg eerst vast wat planologisch wel en niet kan, zodat de rest van het dossier richting krijgt.',
    }
  }

  return {
    kind: 'default',
    title: 'Zet door naar Onderzoek',
    detail:
      'De eerste basisinformatie staat klaar. Verzamel nu eigendom, vergunninghistorie en technische checks.',
  }
}

export function deriveContactFollowUp(
  favorite: FavoriteResponse,
  allCards: DossierCardWithContext[],
): { title: string; detail: string } {
  const eigendomCard = allCards.find((card) => card.key === 'eigendom')
  const correspondenceCard = allCards.find((card) => card.key === 'correspondentie')
  const hasEigendom = eigendomCard?.filled ?? false
  const correspondenceCount = correspondenceCard?.documents.length ?? 0

  if (favorite.pipeline_stage === 'Afgerond') {
    return {
      title: 'Geen open opvolging',
      detail:
        favorite.afgerond_reden === 'Gekocht'
          ? 'Dit perceel is afgerond als aankoop. Gebruik correspondentie en documenten vooral voor overdracht en vervolguitwerking.'
          : 'Dit perceel is afgerond als afwijzing. Bewaar alleen nog relevante leerpunten of heropeningssignalen.',
    }
  }

  if (!hasEigendom && correspondenceCount === 0) {
    return {
      title: 'Start met eigenaar + eerste outreach',
      detail:
        'Nog geen eigendomsinformatie of contactspoor vastgelegd. Haal eigendomsinformatie op en leg de eerste benadering direct vast.',
    }
  }

  if (hasEigendom && correspondenceCount === 0) {
    return {
      title: 'Eigendom staat klaar, contact nog niet',
      detail:
        'De volgende logische stap is een eerste bel-, mail- of briefactie. Sla die daarna op in Correspondentie.',
    }
  }

  return {
    title: 'Houd opvolging compact in dit dossier',
    detail: `${correspondenceCount} contactstuk${
      correspondenceCount === 1 ? '' : 'ken'
    } aanwezig. Gebruik Correspondentie als vaste plek voor reacties, afspraken en vervolgacties.`,
  }
}

export function deriveActivityRows(
  favorite: FavoriteResponse,
  documents: ParcelDocumentMeta[],
  allCards: DossierCardWithContext[],
): Array<{ label: string; value: string }> {
  const latestDocument = [...documents].sort(
    (a, b) => Date.parse(b.uploaded_at) - Date.parse(a.uploaded_at),
  )[0]

  const rows: Array<{ label: string; value: string }> = []

  if (latestDocument) {
    rows.push({
      label: 'Laatste upload',
      value: `${latestDocument.filename} · ${formatWorkspaceDate(latestDocument.uploaded_at) ?? 'Onbekende datum'}`,
    })
  } else {
    rows.push({
      label: 'Laatste upload',
      value: 'Nog geen documenten toegevoegd in deze workspace',
    })
  }

  rows.push({
    label: 'Portfolio status',
    value: `${favorite.pipeline_stage} · ${formatWorkspaceDate(favorite.updated_at) ?? 'Onbekende datum'}`,
  })

  rows.push({
    label: 'Dossierstand',
    value: `${allCards.filter((card) => card.filled).length}/${allCards.length} kaarten gevuld`,
  })

  return rows
}
