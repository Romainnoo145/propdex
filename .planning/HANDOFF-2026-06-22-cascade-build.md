# Handoff — volgende sessie: cascade-build campaign (alle potentie/risico scores erin)

**Datum:** 2026-06-22
**Door:** vorige sessie (frontend perceel-detail overhaul afgerond + live op prod)

---

## Waar we staan (prod = propdex.nl, alles live vandaag)

- **29 scoring-factoren live** (post-M054/S01+S02). Regressie-pin: `backend/tests/regression/test_score_v3_registry_29_factors.py` (`KNOWN_29_FACTOR_KEYS`).
- **Vandaag geshipt naar prod** (Vercel auto-deploy vanaf `main`):
  - M054/S03 — perceel-detail redesign: `FactorKpiCard` (witte kaart per factor, amber icoon-tegel, bijdrage-pill groen/rood) op Potentie/Risico + `FactorExplainBody` Aura-pop-up. (bijdrage-bars-concept verlaten.)
  - M054/S04 — `PdfViewerDrawer` (brede rechter slide-in, A4 fit-to-width + zoom); vervangt `PDFViewerModal` overal.
  - M054/S05 — Dossier-tab refurb: toggle eruit → één scroll + categorie-secties, totale-compleetheid-hero, 2-koloms `DossierSlotCard`, klik-met-docs → PdfViewerDrawer.
- `main` @ `27879554`. `npm run check` exit 0; 254 frontend-tests groen.

## Doel volgende sessie

**Alle potentie/risico-scores populeren** = de resterende geplande cascades bouwen. In beide tabs staan ze al als **"Binnenkort"-placeholders** (`frontend/src/components/map/panels/parcel/lib/factor-list.ts`, `PLANNED_POTENTIE` / `PLANNED_RISICO`). Elke gebouwde cascade haalt een placeholder weg en voegt een echte factor toe.

### Werklijst (de 11 geplande cascades)

**Potentie:**
| key | bron-document | wave |
|---|---|---|
| `woondeal_boost` | Woondeal Limburg 2022-2030 (Venlo 2.718 won.) | **Wave 1 — NEXT** |
| `beleidsalignement_provincie` | POVI Limburg | Wave 2 |
| `subsidie_potentie` | Subsidies Venlo/Limburg | Wave 3 (API) |
| `politiek_klimaat` | Raadsinformatie (ORI) | Wave 3 (API) |
| `segment_fit` | Woningwet | Wave 3 |

**Risico:**
| key | bron-document | wave |
|---|---|---|
| `welstand_beperking` | Welstandsnota Venlo | Wave 2 |
| `duurzaamheid_kosten` | Transitievisie Gebouwde Omgeving 2.0 | Wave 2 |
| `omgevingsverordening_limburg` | Omgevingsverordening Limburg | Wave 2 |
| `stikstof_risico` | Limburgs Offensief Stikstof / AERIUS | Wave 3 (API/geo) |
| `beng_kosten` | BENG (RVO / EP-Online) | Wave 3 (API) |
| `ladder_risico` | Ladder duurzame verstedelijking | Wave 3 |

Wave 1 (huisvestingsverordening · grondprijzen · parkeerverordening) is al LIVE — alleen **`woondeal_boost` rest** als pure-S07 Wave 1. Daarna Wave 2 (4 stuks, ook puur document-cascades). **Wave 3 = API/geo-bronnen → vergt eerst een brainstorm** (andere bron-types dan PDF/document).

## Hoe een cascade gebouwd wordt (gevestigd patroon)

- **Per cascade = 1 slice**, volgens het **LOCKED M053/S07-patroon** (zie memory `project_cascade_detail_view_pattern.md`): per-factor typed extraction (Anthropic tool-use + `input_schema`) → randvoorwaarden display-only + editorial in-panel detail → frontend cascade-popup (nu via de nieuwe `PdfViewerDrawer`/`FactorExplainBody`-taal).
- **Brainstorm vóór nieuw component/UX** (CLAUDE.md). Wave 1/2 = puur extend (S07-clone, weinig nieuwe UX). Wave 3 (API/geo) = wél brainstorm.
- **SCHEMA_VERSION** globaal bumpen bij nieuwe randvoorwaarden-velden; let op de woonvisie/omgevingsvisie buurt-retrofit die nog DEFERRED is.
- Naam→code resolutie: zie `project_buurt_code_infra_naam_crosswalk_gap.md` — M053/S13 crosswalk-enabler is BUILT maar NIET gemerged/deployed (branch `m053-s13-buurt-crosswalk`); overweeg dat eerst te landen als een nieuwe cascade buurt-namen gebruikt.

## ⚠️ Deploy is anders dan vandaag — BACKEND-heavy

Vandaag was frontend-only (Vercel auto-deploy). Cascade-builds zijn **backend** (extraction + scoring + re-score):
- `railway up backend --path-as-root --service api --ci` (api auto-deployt wél, maar verifieer).
- **Worker deployt NIET automatisch** — na elke push die `backend/app/jobs/` of geïmporteerde services raakt: `railway up backend --path-as-root --service worker --ci` + check ARQ-heartbeat. Zie `reference_prod_deploy_procedure.md`.
- Na een nieuwe cascade: **re-score van de 55k Venlo scan_results** + tiles-versie bumpen. Prod data-tools lokaal via PostGIS public proxy (`gondola.proxy.rlwy.net:39031`), niet railway ssh.

## Referenties

- Prioriteit + Venlo-data-verificatie: `.planning/CASCADE-BUILD-INVENTARISATIE.md`
- Document↔factor↔milestone mapping: `.planning/CASCADE-DOCUMENT-MAPPING.md`
- Memory: `project_cascade_build_campaign.md`, `project_cascade_detail_view_pattern.md`, `reference_prod_deploy_procedure.md`, `project_buurt_code_infra_naam_crosswalk_gap.md`
- Specs/plans van vandaag: `docs/superpowers/specs/2026-06-22-*` + `docs/superpowers/plans/2026-06-22-*`

## Openstaande follow-ups (niet-blocking, van vandaag)

- `DossierSlotCard.tsx` valText: onbereikbare `value==='LEEG'`-tak (mergeDocuments herschrijft al naar "N BESTANDEN") → 2-regelige cleanup.
- PdfViewerDrawer: retry-`fetchDoc()` zonder AbortSignal (latent); image-detectie via `title` ipv `url`.
- Cockpit `DossierSection` is NIET mee-gerefurbished (alleen de map-Dossiers-tab) — bewust; mogelijk later gelijktrekken.
- Volledige unificatie map- + cockpit-dossier-`buildPages` (verschillende inputs) = los cleanup-traject.

## Eerste actie volgende sessie

Start `woondeal_boost` (Wave 1, Potentie) als nieuwe slice: brainstorm kort (S07-clone, dus licht) → extraction-schema + scoring + frontend-popup → backend deploy (api + worker) + re-score. Of: open de cascade-inventory en herprioriteer met de user.
