# GSD Queue

<!-- Append-only log of future milestones queued via /gsd queue. -->
<!-- These milestones are not yet planned — they capture intent for future work. -->

## Queued Milestones

### Superuser Admin Dashboard + AI Cost Controls

**Status:** Queued

**Scope:** Two parts:

**Part 1 — Superuser usage dashboard:**
- `ai_usage_log` DB table (model, call_site, user_id, input_tokens, output_tokens, cache_tokens, estimated_cost_usd, created_at)
- Persist from existing CLAUDE_USAGE log hooks (already wired in claude_client.py, chat_service.py, bulk_query_service.py, document_summarizer.py, jurisprudence_analysis.py)
- Superuser auth (hardcoded admin email or is_superuser flag)
- Simple frontend page: cost-by-day chart, cost-by-call-site breakdown, cost-by-user table, total spend

**Part 2 — Make AI bestemmingsplan parsing opt-in:**
- Currently `aggregate_property_data` triggers `get_or_parse_plan` on every property lookup (address search). This fires Claude PDF parsing for each new bestemmingsplan.
- Change: skip AI parsing on property lookup (`/api/properties/lookup`). Only trigger it on rapport generation (`/api/reports/from-parcel`, `/api/reports/from-address`).
- PropertyDetailDrawer already handles `ai_parsing: null` gracefully (just doesn't show the section).
- This means users can browse properties for free. AI parsing only fires when they commit to generating a full rapport.

**Call sites tracked (7 total):**
1. `bestemmingsplan` — PDF parsing via DSO/Ruimtelijkeplannen.nl (highest per-call cost)
2. `jurisprudence` — court ruling analysis in batches of 5 (on-demand per gemeente)
3. `rechtsgrond_classify` — ruling type classification (batch job)
4. `tegenstander_extract` — opposing party extraction (batch job)
5. `chat_classify` — intent classification per chat message (high frequency, low cost)
6. `bulk_query` — search param extraction from NL chat
7. `doc_summary` — uploaded document summarization

*Queued: 2026-04-01*

---

### App Hardening — Full Test Coverage Sweep

**Status:** Queued

**Scope:** Write tests for every untested backend route and critical frontend flow. Audit all endpoints, find coverage gaps, write integration tests for favorites/portfolio, E2E smoke tests for login → scan → favorite → view saved, and any other untested flows. Goal: no route ships without test coverage.

*Queued: 2026-03-22*

---

### Gemeentelijke Subsidie-integratie

**Status:** Geparkeerd — onderzoek gedaan, wacht op besluit databron

**Bevindingen:**
- Er is geen gratis API voor gemeentelijke subsidies. Elke gemeente publiceert het anders, geen standaard.
- **Vindsubsidies.nl** heeft een V3 API (`api.vindsubsidies.nl`) die zoekt op gemeente code. Endpoints: `SearchSubiByIdentifier` (gemeente code → subsidies), `SearchSchemes` (zoek met filters). Vereist `ClientId` + `ClientSecret` — betaald, geen prijzen gepubliceerd. Enterprise sales.
- **LIOF** (Limburg), **BOM** (Brabant), **InnovationQuarter** (Zuid-Holland) etc. zijn ROM's — geen standaard APIs.
- **Energiesubsidiewijzer** (Milieu Centraal) — API key op aanvraag via verbeterjehuis@milieucentraal.nl. Alleen energie/verduurzaming.
- **KOOP/officielebekendmakingen.nl** — gratis, al geïntegreerd voor huisvestingsverordening. Subsidieregelingen worden hier ook gepubliceerd. Potentiële gratis route met dezelfde SRU client.
- **Amsterdam** heeft een open subsidieregister API (`api.data.amsterdam.nl`). Niet schaalbaar naar 342 gemeenten.

**Opties (in volgorde van haalbaarheid):**
1. KOOP/SRU route — gratis, hergebruik bestaande client, filter op subsidieregelingen i.p.v. huisvestingsverordening
2. Vindsubsidies API — compleet maar betaald, contacteer voor prijzen
3. Energiesubsidiewijzer — beperkt tot energie, API key aanvragen bij Milieu Centraal

**Huidige status:** RVO landelijke subsidies met "LANDELIJK" label. Eerlijk maar niet gemeente-specifiek.

*Geparkeerd: 2026-03-20*

---

## Completed (historical)

M002–M008 all completed. Original queue items from product vision conversation (2026-03-17) are fully delivered.

- **Verkenner Redesign** — Delivered across M018 (Chat Quality & Reliability) and M019 (Actionable Chat Components & UX Polish)
- **Checklist Intelligent Linking** — Done
- **Rapport Sections Redesign** — Delivered as M021
- **Checklist PDF Template Quality Overhaul** — Delivered as M022

## M031 — Parcel Panel CTA + Data Audit + Map Layer Fixes

### Scope
1. **CTA button swap**: Replace "Genereer Rapport" with two-state button:
   - Default: "Bewaar perceel" (heart icon + label) — saves as favorite via existing useToggleFavorite hook
   - When already favorited OR has_report: "Bekijk Rapport" (green) — navigates to rapport page
2. **Potentie + Risico data audit**: Systematic check of every card in PotentieLayer.tsx and RisicoLayer.tsx:
   - Map each card to its data source field in ScanResultItem / enrichment
   - Trace each field back to the backend API that populates it
   - For any card showing "geen data" / null / ONBEKEND: determine if it's genuinely missing data or a broken API coupling
   - Fix any broken couplings found
3. **Map color mode / filter layer fixes**: The LayerToggle color modes (bestemmingsplan, leegstand, favorieten etc.) are broken or intermittent:
   - Bestemmingsplan layer doesn't work at all
   - Leegstand layer works sometimes
   - Favorieten layer works sometimes
   - Layers overlap / interfere with each other
   - Only Potentie layer works reliably
   - Audit all color mode toggle handlers and visibility state, fix exclusive-mode switching
4. **Deploy**: Vercel frontend deploy with all M030 + M031 fixes

### Source
User directive — pre-production polish

### Priority
Next (before production launch)

---

## M032 — Map Overlay Lifecycle Fix

### Scope
Fix the structural issues in map overlay switching that M031/S01 partially addressed but didn't fully resolve:

1. **Overlay visibility race condition**: `handleOverlaySelect` sets MapLibre layer visibility synchronously, but `setActiveParcelOverlay` React state update is async. During the 1-frame gap, `LayerToggle`'s `needsDefaultOverlay` effect can override the selection back to Potentie. M031 added a ref guard but the root cause (sync map ops + async React state) remains.

2. **Overlay not initializing after hard refresh**: After Ctrl+Shift+R, the Potentie score-fill layer doesn't get set to visible on initial load. The `OverlayPicker` shows but clicking modes has no effect until some combination of actions re-initializes the layers. Root cause: the initialization path in `LayerToggle` / `addParcelScoreLayer` / lifecycle hook has a gap.

3. **Built-status "Leegstand" layer shows empty**: The `built_status` overlay (labeled "Leegstand" in the picker) colors on `has_pand` (bebouwd vs onbebouwd). Most scanned parcels have pands, so this mode appears empty. Consider either:
   - Renaming to "Onbebouwd" to match what it actually shows
   - Replacing with the `vacancy_signal` layer (which colors leeg_perceel/leegstaand_pand/in_gebruik) for the "Leegstand" menu item
   - Or adding `vacancy_signal` as a separate picker option

4. **Architecture improvement**: Consider moving overlay visibility management to a React-driven model where `activeParcelOverlay` state is the single source of truth, and a single `useEffect` syncs MapLibre visibility from that state. This eliminates the dual-write pattern (direct map + async state) that causes races.

### Evidence
- Browser JS eval confirmed `parcel-built-status-fill` stays `none` after "Leegstand" click despite `handleOverlaySelect` having correct logic
- `handleOverlaySelect` console.log not firing after fresh page load — lifecycle init issue
- `parcel-score-fill` visibility is `undefined` (MapLibre default=visible) instead of explicitly set — fragile

### Source
Discovered during M031 validation live testing

### Priority
Next — overlay switching is a core user interaction

*Queued: 2026-04-04*
