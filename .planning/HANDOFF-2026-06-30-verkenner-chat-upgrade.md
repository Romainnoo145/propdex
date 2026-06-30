# Handoff — volgende sessie: Verkenner-chat upgrade (opslaan vanuit chat + cascade-context)

**Datum:** 2026-06-30
**Door:** vorige sessie (demo-relaunch live op propdex.nl; beleid-docs zichtbaarheidsbug + gedeelde Framer Motion stap-animatie geshipt)

---

## Waar we staan (prod = propdex.nl, alles live)

- **Infra:** Railway-project `propdex` (`e115ad6f-2a9c-4c39-9fb4-c01030579abb`, workspace "Klarifai - Clients"). Services: `api` (FastAPI), `PostGIS` (+ volume), `Redis`. **Worker bewust NIET gedeployed** (kostenbesparing demo). Frontend op Vercel (project `frontend`, root-dir = `frontend`), domein `propdex.nl`, proxyt `/api/*` server-side naar `api-production-349d.up.railway.app`.
- **DB:** restore van `~/propdex-backups/propdex-railway-20260626.dump` (137.145 parcels, 6 Hauzer-favorites). Jurisprudentie = 443 gecureerde rulings. Beleid = Venlo-only (GM0983, 4 docs).
- **Lokaal = prod-data:** dezelfde dump in de lokale Docker-DB (`propdex-db`, port 5434, user/pass `postgres`/`postgres`). Frontend port 9300, backend 8000.
- **Demo-login:** `info@hauzer.nl` / `HauzerDemo2026!`
- **Laatste commits (main):** `6e9d100e` (policy-docs zichtbaar + StepTransition + verkenner polish), `b4fe07bf`, `91c9c003`, `869cbb32`.
- **Re-provision / restore runbook:** `~/propdex-backups/RESTORE-RUNBOOK.md` + `backend/DEPLOY_NOTES.md` ("Demo relaunch").

### Belangrijk over de Vercel-deploy (anders kost het je tijd)
Het Vercel-project heeft Root Directory = `frontend`. Deploy-flow die werkt:
```bash
cd /home/klarifai/Documents/klarifai/clientprojects/propdex
cp -r frontend/.vercel .vercel              # link naar repo-root
vercel pull --yes --environment=production
vercel build --prod --yes
rm -f .vercel/output/builds.json            # forceer prebuilt (build-validatie faalt op rootdir-mismatch)
vercel deploy --prebuilt --prod --yes       # → aliased aan propdex.nl
rm -rf .vercel                              # OPRUIMEN — anders breekt het de railway-context in backend/
```
`pnpm-lock.yaml` muteert tijdens build → **niet committen** (`git checkout pnpm-lock.yaml`).
Railway-DB benaderen vanaf lokaal: maak tijdelijk een TCP-proxy via de GraphQL API met de CLI-token (`~/.railway/config.json` → `user.accessToken`), mutation `tcpProxyCreate`. **Sluit 'm daarna weer** (`tcpProxyDelete`) — anders staat de prod-DB publiek open. Of gebruik `railway ssh -s api "python3 -c ..."` (interne DB, geen proxy nodig).

---

## Doel volgende sessie

De Verkenner-chat van "praat over één perceel" naar **"sla op + redeneer met alle relevante beleids- en jurisprudentie-context"** tillen. Twee onafhankelijke gaten:

- **Gat 1 — Opslaan vanuit de chat** (favoriet + rapport in één klik, zonder de omweg via de kaart).
- **Gat 2 — Cascade-context voor de chat** (de agent geeft nu géén beleidsdocs/jurisprudentie mee aan het LLM; het bronnen-panel toont ze wél maar de agent "leest" ze niet).

> **Aanbeveling: bouw Gat 2 eerst.** Dat is de demo-knaller ("mag ik hier optoppen?" → antwoord citeert de échte Venlo-woonvisie). Gat 1 is UX-comfort; Gat 2 maakt de kern-belofte van de Verkenner waar.

---

## Achtergrond: hoe het NU werkt (geverifieerd in code)

### Verkenner-frontend
- Route: `frontend/src/routes/_authenticated/verkenner.tsx`
- `SelectedParcel` (regel ~35): `{ id: string|null, address, gemeente?, gemeenteCode?, pdokId? }`.
  - `id` = Kadaster parcel-id (documents-key) — **alleen gezet als het adres een opgeslagen favoriet matcht** (`resolveParcel`, regel ~79). Anders `null`.
  - `pdokId` = PDOK suggestion-id, voor niet-opgeslagen percelen.
- `createReport` (regel ~305): bij niet-opgeslagen perceel → `lookupPdokAddress(pdokId)` → `navigate({ to: '/map', search: toMapAddressSearch({postcode, huisnummer}) })`. **Dit is de huidige omweg.** De map lost daar adres → perceel op.
- Chat-context die meegaat (regel ~280): alleen een tekst-prefix `"Context: deze vraag gaat over het perceel {address} (gemeente {gemeente}). Beantwoord specifiek voor dit perceel."` — **geen documenten, geen cascade.**
- Bronnen-panel: `frontend/src/components/verkenner/ParcelSourcesPanel.tsx`. Toont perceeldocumenten (`useParcelDocuments`) + gemeente-beleid (`usePolicySummaries(gmCode)`) + opent policy-docs in nieuw venster (`fetchPolicyDocumentBlob`). Dit panel weet dus al precies welke beleidscontext bij het perceel hoort — maar die kennis gaat niet naar de chat-agent.

### Bewaar-knop (waarom "gewoon dezelfde knop" niet kan vanuit de chat)
- `frontend/src/components/map/panels/parcel/HeartButton.tsx`, regel 45:
  ```ts
  if (!parcel.parcel_code) return null   // geen Kadaster-id = niet te bewaren
  ```
- De knop werkt op de kaart omdat het `parcel` daar een `parcel_code` heeft (uit scan-result/opgeloste lookup). In de chat heb je alleen een PDOK-adres → géén `parcel_code`.
- `useToggleFavorite` (`frontend/src/hooks/useFavorites.ts`, regel ~77) POST't naar `FAVORITES_BASE` met `parcel_id: parcel.parcel_code` (Kadaster-string), `gemeente_code`, `address`, etc.
- Backend `create_favorite` (`backend/app/favorites/favorites_service.py:171`) resolvet de `parcel_cache`-rij via `_resolve_favorite_context` (zoekt `ParcelCache` op `parcel_id` OF `parcel_code`). **Dus er moet al een parcel_cache bestaan.**
- `lookupProperty` / `aggregate_property_data` (`backend/app/services/property_aggregator.py`) **persisteert GEEN parcel_cache** — het aggregeert alleen externe API-data (BAG/PDOK/DSO).
- **BRK Bevragen staat UIT op prod** (boot-log: "BRK Bevragen not configured") → geen `perceel_identificatie` uit de lookup.

### Chat-backend (wat de agent NU kan)
- Router: `backend/app/agents/chat_router.py` → `POST /api/agents/chat` + `/chat/stream`.
- Service: `backend/app/agents/chat_service.py`. Intents (`chat_schemas.py`): `PARCEL_SEARCH`, `PARCEL_DETAIL`, `MY_FAVORITES`, `MY_REPORTS`, `UNSUPPORTED`.
- `handle_parcel_detail` (regel ~406): resolvet adres → cached `parcel_cache`-data (bestemming, bouwjaar, oppervlakte, pand-status, enrichment) → `ParcelDetailSummary`. **Geen** policy-docs, **geen** cascade, **geen** jurisprudentie, en geen LLM-synthese met die bronnen.
- Conclusie: de chat is nu **puur perceel-breed** op de cached perceelvelden. De Venlo-beleidscontext die in het bronnen-panel staat, bereikt het model niet.

### Bestaande, herbruikbare data-endpoints (org-agnostisch, werken al)
- `GET /api/policy-documents/cascade/{gemeente_code}` → `backend/app/policy_documents/router.py:147` (`get_gemeente_cascade`). Geeft landelijk+provincie+gemeente policy-docs met extraction/`randvoorwaarden`, nieuwste versie per slot. **Org-agnostisch** (filtert op `is_global=true`).
- `GET /api/policy-documents/summaries/gemeente/{code}` → `{source_key: randvoorwaarden[]}`. Org-agnostisch.
- Jurisprudentie per gemeente: `aggregate_dev_type_rulings` (`backend/app/services/ruling_aggregator.py`) + `juridisch_klimaat_builder.py`. Leest `ruling_cache` (org-agnostisch, public data).
- Beleid-docs zijn nu zichtbaar voor alle tenants sinds commit `6e9d100e` (`list_documents` matcht `is_global` org-agnostisch).

---

## Gat 1 — Opslaan vanuit de chat

**Probleem:** chat heeft alleen een adres; opslaan vereist een `parcel_cache`-rij + Kadaster-`parcel_code`.

**Oplossing: nieuw backend-endpoint `POST /api/favorites/from-address`** dat in één transactie:
1. Adres (postcode + huisnummer, of PDOK-id) → resolve naar een perceel.
2. **Persisteer/upsert een `parcel_cache`-rij** (de ontbrekende stap). Bron voor de Kadaster-`parcel_code`: PDOK Locatieserver lookup geeft `kadastrale_aanduiding` via de cadastral parcels in de property-lookup (`PropertyReportResponse.cadastral_parcels[].kadastrale_aanduiding`). Check of `aggregate_property_data` al een perceelidentificatie teruggeeft die je kunt normaliseren naar het `parcel_code`-formaat dat `parcel_favorites.parcel_id` verwacht (bv. `31160051970000`). Zo niet: gebruik PDOK `lookup` (`https://api.pdok.nl/bzk/locatieserver/search/v3_1/lookup?id={pdokId}`) — dat geeft postcode/huisnummer/straatnaam, maar **niet** altijd een Kadaster-id zonder BRK. **Dit is het kernrisico — eerst valideren of we zonder BRK aan een stabiele parcel_code komen.**
3. Roep de bestaande `create_favorite` (`favorites_service.py:171`) aan met die `parcel_code` + gemeente_code/naam/address.
4. (Optioneel) trigger rapport-generatie zoals de map dat doet.

**Frontend:** in `verkenner.tsx` `createReport` vervangen/aanvullen: i.p.v. `navigate('/map', ...)` → call `POST /api/favorites/from-address` → bij succes: `SelectedParcel.id` updaten met de nieuwe `parcel_code` zodat het bronnen-panel meteen de perceeldocumenten + cascade laadt. **Map-icon behouden** als secundaire actie (gebruiker wilde dat expliciet). Knop-copy van "Bekijk op de kaart" → "Opslaan in portfolio" (of beide knoppen).

**Valkuil / eerst checken:**
- Zonder BRK Bevragen: kunnen we betrouwbaar aan een `parcel_code` komen? Test met een Venlo-adres of `aggregate_property_data().cadastral_parcels` een bruikbare `kadastrale_aanduiding` bevat, en hoe de map die normaliseert (zoek in `frontend/src/routes/_authenticated/map.tsx` naar `parcelCode`/`kadastrale_aanduiding` → regels ~1064-1124; de map gebruikt `full.parcel_code` uit een eigen lookup + centroids). Mogelijk bestaat er al een backend-pad dat de map gebruikt om parcel_code te resolven — hergebruik dat.
- Multi-perceel adressen: één adres kan meerdere percelen raken (de map kiest `firstParcel`). Kies dezelfde heuristiek.

---

## Gat 2 — Cascade-context voor de chat (AANBEVOLEN EERST)

**Probleem:** `handle_parcel_detail` geeft het LLM geen beleids-/jurisprudentie-context.

**Oplossing: verrijk de chat-context met de gecascadeerde beleidsdocs + jurisprudentie van de gemeente van het perceel.**

Concreet, in `backend/app/agents/chat_service.py`:
1. In `handle_parcel_detail` (of een nieuwe `handle_parcel_question`): nadat het perceel + `gemeente_code` resolved is, haal op:
   - **Cascade-randvoorwaarden:** hergebruik de service achter `get_gemeente_cascade` / `get_summaries` (`backend/app/policy_documents/service.py`) → `{source_key: randvoorwaarden[]}` voor die gemeente. Dat zijn al geëxtraheerde, compacte bullets (titel + samenvatting) — ideaal als LLM-context, geen volledige PDF nodig.
   - **Juridisch klimaat:** `juridisch_klimaat_builder` / `aggregate_dev_type_rulings` voor de gemeente (uit `ruling_cache`).
2. Bouw een **systeem-/context-blok** voor het LLM: perceelvelden + relevante randvoorwaarden (gefilterd op de vraag waar mogelijk: optoppen → woonvisie/omgevingsvisie; parkeren → parkeerbeleid; splitsen → huisvestingsverordening) + juridisch-klimaat-samenvatting. Laat het model daarop antwoorden mét bronvermelding (welke beleidsdoc).
3. Voeg eventueel een nieuwe intent toe (`POLICY_QUESTION` / `PARCEL_ADVICE`) of breid `handle_parcel_detail` uit zodat een vrije vraag ("mag ik hier optoppen?") deze verrijkte context krijgt.

**Waarom dit laag-risico is:** alle data-endpoints bestaan al en zijn org-agnostisch. Het is vooral context-assemblage + een goede prompt. Geen nieuwe externe API's, geen BRK-afhankelijkheid.

**Frontend:** waarschijnlijk niets nodig — de chat stuurt al `address` + `gemeente`. Eventueel `gemeenteCode` expliciet meesturen in de chat-request (`useChat`, `frontend/src/hooks/useChat.ts`, body op regel ~179) zodat de backend niet opnieuw hoeft te resolven.

**Demo-scenario om naar te bouwen:** Hauzer opent Venrayseweg 192 (Venlo) → vraagt "mag ik hier optoppen of een woning toevoegen?" → antwoord citeert concrete randvoorwaarden uit de Venlo-woonvisie/omgevingsvisie + het juridisch klimaat. Dát verkoopt.

---

## Werkwijze-contract (uit CLAUDE.md — niet vergeten)
- **GSD-state** leeft in `/home/klarifai/.gsd/projects/0fbd70b53f1b/` — lees STATE.md vóór actie, schrijf alleen via `/gsd:*`.
- Nieuw component/UX → `superpowers:brainstorming` vóór code. Multi-step → `superpowers:writing-plans`. Feature/bugfix → `superpowers:test-driven-development`. "Klaar" claimen → `superpowers:verification-before-completion`.
- Validatie per change: `npm run check` (frontend) / `ruff check . && mypy .` (backend). Files < 300 regels. Multi-tenant: elke query filtert op `organization_id` — **behalve** de bewust org-agnostische public-data tabellen (`ruling_cache`, `policy_documents` met `is_global`).
- Commit-format: `M0xx/Sxx: <wat>` (of `chore:`/`fix:`/`docs:` allowlist).
- Design: lees `DESIGN.md`. Canvas Morning Mist `#F2F6F3`, accent Warm Amber `#F9A826`, Obsidian `#0E1111`, font Plus Jakarta Sans, glass `bg-white/60 backdrop-blur-[24px]`. Light mode only.

## Eerste stappen volgende sessie
1. Lees GSD STATE.md + dit document.
2. **Gat 2 eerst:** verifieer `get_summaries`/cascade-service output voor GM0983 (er staan 4 Venlo-docs mét randvoorwaarden: omgevingsvisie 12, woonvisie 8, parkeerbeleid 12, huisvestingsverordening 16). Bouw de context-assemblage in `chat_service.py`. TDD.
3. **Gat 1 daarna:** valideer eerst of we zonder BRK aan een stabiele `parcel_code` komen (test `aggregate_property_data` op een Venlo-adres). Pas dan het `from-address`-endpoint bouwen.
4. Deploy via de flows hierboven (backend: `railway up --service api --detach` vanuit `backend/`; frontend: prebuilt Vercel-flow).
