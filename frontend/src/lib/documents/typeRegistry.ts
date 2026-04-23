/**
 * Document type registry — single source of truth for all surfaces.
 *
 * Maps every document_type (dossier upload OR checklist-generated) to its
 * canonical dossier slot key. Must stay in sync with
 * backend/app/documents/type_registry.py.
 */

import type { ParcelDocumentMeta } from '@/lib/types/document'

// Minimal shape required by mergeWithRegistry — both DossierCard interfaces satisfy this.
interface SlottableCard {
  key: string
  filled: boolean
  value: string
  documents: ParcelDocumentMeta[]
}

interface SlottablePage {
  cards: SlottableCard[]
}

/** Maps every document_type to its canonical dossier slot key. */
export const DOC_TYPE_TO_SLOT: Record<string, string> = {
  // dossier upload types — self-mapping
  bestemmingscheck:   'bestemmingscheck',
  perceeldata:        'perceeldata',
  vergunninghistorie: 'vergunninghistorie',
  woz:                'woz',
  quickscan:          'quickscan',
  bodem:              'bodem',
  fundering:          'fundering',
  asbest:             'asbest',
  bouwkundig:         'bouwkundig',
  energielabel:       'energielabel',
  bestemmingsplan:    'bestemmingsplan',
  milieuzones:        'milieuzones',
  geluid:             'geluid',
  stikstof:           'stikstof',
  kadaster:           'kadaster',
  eigendom:           'eigendom',
  erfpacht:           'erfpacht',
  documenten:         'documenten',
  correspondentie:    'correspondentie',
  ideeen:             'ideeen',
  checklist:          'documenten',
  // checklist-generated types — cross-mapping
  vergunningen:       'vergunninghistorie',
  haalbaarheid:       'bestemmingscheck',
  wkb_precheck:       'bestemmingscheck',
  risicoprofiel:      'quickscan',
  monumenten:         'kadaster',
}

const FALLBACK_SLOT = 'documenten'

function buildReverseMap(mapping: Record<string, string>): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  for (const [docType, slot] of Object.entries(mapping)) {
    if (!result[slot]) result[slot] = []
    result[slot].push(docType)
  }
  return result
}

/** Reverse map: slot → all document_types that land there. */
export const SLOT_TO_DOC_TYPES: Record<string, string[]> = buildReverseMap(DOC_TYPE_TO_SLOT)

/**
 * Replaces mergeDocuments() in BronnenLayer and FavoriteParcelWorkspaceView.
 *
 * Routes each document to its canonical slot via DOC_TYPE_TO_SLOT.
 * Unknown types fall back to 'documenten'. Updates filled + value label.
 */
export function mergeWithRegistry<P extends SlottablePage>(
  pages: P[],
  docs: ParcelDocumentMeta[],
): P[] {
  const bySlot: Record<string, ParcelDocumentMeta[]> = {}

  for (const doc of docs) {
    const slot = DOC_TYPE_TO_SLOT[doc.document_type] ?? FALLBACK_SLOT
    if (!bySlot[slot]) bySlot[slot] = []
    bySlot[slot].push(doc)
  }

  return pages.map((page) => ({
    ...page,
    cards: page.cards.map((card) => {
      const slotDocs = bySlot[card.key] ?? []
      if (slotDocs.length === 0) return card
      return {
        ...card,
        filled: true,
        value:
          card.value === 'LEEG'
            ? `${slotDocs.length} BESTAND${slotDocs.length > 1 ? 'EN' : ''}`
            : card.value,
        documents: slotDocs,
      }
    }),
  }))
}
