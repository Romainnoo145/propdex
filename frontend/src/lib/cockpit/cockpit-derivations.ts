/**
 * Cockpit derivation logic — next-step + missing-cards + activity rows.
 * Extracted from FavoriteParcelWorkspaceView.tsx 2026-05-19 (Plan 08-06 split, M050/S06 cont.).
 *
 * Pure helpers. PRESERVES current next-step CTA copy verbatim — Plan 08-07 will
 * replace the BRK CTA ("Vraag eigendomsinfo op" / "Controleer eigendom") with the
 * "Stap door naar Contact" copy. DO NOT modify the strings in this file in Plan 08-06.
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

export function deriveNextStep(
  favorite: FavoriteResponse,
  allCards: DossierCardWithContext[],
  missingCards: DossierCardWithContext[],
): { title: string; detail: string } {
  const missingKeys = new Set(missingCards.map((card) => card.key))
  const correspondenceCount =
    allCards.find((card) => card.key === 'correspondentie')?.documents.length ?? 0

  // If report exists, next step shifts to review / dossier completeness
  if (favorite.has_report && favorite.pipeline_stage === 'Gesignaleerd') {
    if (missingKeys.has('eigendom')) {
      return {
        title: 'Vraag eigendomsinfo op',
        detail:
          'Het rapport staat klaar. Volgende stap: BRK eigendom ophalen zodat je weet wie de eigenaar is en hoe je kunt benaderen.',
      }
    }
    return {
      title: 'Bekijk je rapport en plan opvolging',
      detail:
        "Je rapport is gegenereerd. Loop de risico's en potentie door en bepaal of dit perceel naar de onderzoeksfase gaat.",
    }
  }

  if (favorite.pipeline_stage === 'Afgerond') {
    if (favorite.afgerond_reden === 'Gekocht') {
      return {
        title: 'Werk het vervolgdossier uit',
        detail:
          'Leg overdracht, uitvoeringsstukken en verdere correspondentie vast zodat het perceel direct projectklaar blijft.',
      }
    }
    return {
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
        title: 'Maak het besluitdossier compleet',
        detail:
          'Er ontbreken nog technische stukken die je nodig hebt om stevig te kunnen kopen, parkeren of afwijzen.',
      }
    }
    return {
      title: 'Bundel het beslisdossier',
      detail:
        'Zet quickscan, eigendom, technische checks en correspondentie naast elkaar voor een scherp investeringsbesluit.',
    }
  }

  if (favorite.pipeline_stage === 'Contact') {
    if (correspondenceCount === 0) {
      return {
        title: 'Leg de eerste outreach vast',
        detail:
          'Sla mail, brief of gespreksnotities op in Correspondentie zodat opvolging niet buiten het perceeldossier valt.',
      }
    }
    if (missingKeys.has('eigendom')) {
      return {
        title: 'Rond het eigenaarsspoor af',
        detail:
          'Vraag eigendomsinformatie op voordat je verder escaleert in contact of onderhandeling.',
      }
    }
    return {
      title: 'Plan de opvolging',
      detail:
        'Werk het volgende contactmoment uit en koppel nieuwe reacties of stukken direct terug aan het dossier.',
    }
  }

  if (favorite.pipeline_stage === 'Onderzoek') {
    if (missingKeys.has('eigendom')) {
      return {
        title: 'Controleer eigendom',
        detail:
          'BRK eigendom ontbreekt nog. Pak dat eerst op voordat je outreach of biedstrategie aanscherpt.',
      }
    }
    if (missingKeys.has('quickscan')) {
      return {
        title: 'Genereer rapport',
        detail:
          'Zorg dat de quickscan of rapportlaag gevuld is zodat je van signalen naar inhoudelijke toetsing gaat.',
      }
    }
    if (missingKeys.has('vergunninghistorie')) {
      return {
        title: 'Controleer vergunninghistorie',
        detail:
          'Vergunningen en bekendmakingen geven snel scherpte op haalbaarheid, risico en timing.',
      }
    }
    return {
      title: 'Werk toe naar contact',
      detail:
        'De basis ligt er. Vertaal de bevindingen nu naar een eerste benadering of onderbouwde afwijzing.',
    }
  }

  if (missingKeys.has('quickscan')) {
    return {
      title: 'Genereer rapport',
      detail:
        'Start met een quickscan zodat dit perceel van een ruwe signalering naar een toetsbaar acquisitiedossier gaat.',
    }
  }

  if (missingKeys.has('bestemmingscheck')) {
    return {
      title: 'Bevestig de bestemmingsruimte',
      detail:
        'Leg eerst vast wat planologisch wel en niet kan, zodat de rest van het dossier richting krijgt.',
    }
  }

  return {
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
        'Nog geen eigendomsinformatie of contactspoor vastgelegd. Vraag BRK eigendom op en leg de eerste benadering direct vast.',
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
