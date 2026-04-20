---
created: 2026-04-20T10:06:31.746Z
title: DataCatalog + source_keys status sync — 3-tier (live / beschikbaar / roadmap)
area: ui
files:
  - backend/app/policy_documents/source_keys.py (SourceStatus type + LANDELIJK/PROVINCIE/GEMEENTE arrays)
  - frontend/src/components/documentation/DataCatalog.tsx:193-291 (gemeente roadmap entries)
  - frontend/src/lib/constants/dataSources.ts (shared key mirror, if present)
  - frontend/src/routes/_authenticated/documentatie.tsx (renders DataCatalog)
---

## Problem

De `/documentatie` → **Data & bronnen** tab is out-of-sync met wat M045 heeft opgeleverd.
Zowel backend `source_keys.py` als frontend `DataCatalog.tsx` markeren documentbronnen als
`roadmap` terwijl de **upload-endpoints + AI-summary + cascade** sinds M045/S05 werken via
`/instellingen/beleid-beheer`. Omgevingsvisie heeft zelfs auto-ingest (S06 — KOOP SRU weekly).

Dit is problematisch voor:
1. **Investeerders-gesprekken** — user kan niet aantonen welke bronnen wél operationeel zijn
2. **Eigen overzicht** — user wil kunnen zien welke gemeente-documenten nog handmatig geüpload
   moeten worden om data-coverage te vergroten
3. **Vertrouwen bij eindgebruikers** — `/documentatie` suggereert dat veel minder werkt dan werkelijk

De huidige binary status (`live` | `roadmap`) kan het verschil niet uitdrukken tussen:
- Data zit er automatisch in (omgevingsvisie na S06, bekendmakingen, jurisprudentie, etc.)
- Endpoint + upload werkt, per-gemeente data moet nog geladen worden (welstandsnota, woonvisie, etc.)
- Nog helemaal niet gebouwd (VON-prijs voorspelling, Ladder verstedelijking, etc.)

## Solution

**1. Breid `SourceStatus` type uit naar 3 waardes:**
- `live` — data automatisch beschikbaar zonder per-entity actie
- `beschikbaar` — endpoint + upload werkt, per-gemeente PDF moet nog geüpload worden
- `roadmap` — endpoint/integratie nog niet gebouwd

**2. Reclassificeer in `backend/app/policy_documents/source_keys.py`:**

Gemeente-niveau → `beschikbaar`:
- `omgevingsvisie` → `live` (auto-ingest KOOP SRU, S06)
- `welstandsnota` → `beschikbaar`
- `woonvisie` → `beschikbaar`
- `parkeerbeleid` → `beschikbaar`
- `grondprijsbeleid` → `beschikbaar`
- `duurzaamheidsbeleid` → `beschikbaar`
- `leegstandsverordening` → `beschikbaar`
- `erfgoedverordening` → `beschikbaar`

(Dezelfde update voor provincie-niveau: `omgevingsverordening`, `ruimtelijke-visie`,
`woondeals`, etc. — allemaal `beschikbaar` als de upload endpoint hen accepteert.)

**3. Update `frontend/src/components/documentation/DataCatalog.tsx`:**
- Voeg visuele tier toe (bijv. blauw badge "Beschikbaar — upload per gemeente")
- Verplaats `beschikbaar` items uit de "Roadmap"-sectie
- Groepeer: Live (automatisch) → Beschikbaar (handmatig uploaden) → Roadmap

**4. Test coverage:**
- `test_m045_source_keys_validation.py` al aanwezig — uitbreiden met 3-tier check
- Visual regression (als aanwezig) op DataCatalog

**5. Geen schema-wijziging:** `PolicyDocument.source_key` blijft string-based, dit is
pure catalog-metadata.

**Scope afbakening:** géén coverage-teller ("13/342 gemeentes hebben welstandsnota") —
dat is een aparte toekomstige todo. Deze slice gaat puur over correcte status-labels.

**Verwachte effort:** XS — paar uur werk. Kan zelfstandig naast M046 lopen, geen
architectuur-conflict.
