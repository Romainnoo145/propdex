# Spec — Adres → Vergunningskansen-rapport (de spine)

**Datum:** 2026-06-23
**Status:** DRAFT — ter review
**Aanpak:** zelfde repo, nieuwe branch, nieuwe frontend-surface naast bestaand; backend hergebruikt; geen fork.

---

## 1. Wat we bouwen (één zin)

Een gebruiker (verbouwer/belegger) typt een **adres**, kiest een **verbouwingstype**, en krijgt een onderbouwd **vergunningskansen-rapport**: perceelfeiten + het lokale beleid dat de ingreep bepaalt + relevante jurisprudentie + aandachtspunten.

## 2. Waarom

Propdex kan de datarace niet winnen (Brainbay bezit de transactiedata, het Omgevingsloket bezit de regels gratis). Beide zijn referentielagen. De onbediende baan is "wat zijn mijn kansen, met precedent erbij". De data die dáárvoor nodig is, is wél te krijgen: open jurisprudentie (rechtspraak.nl, ~21.4k omgevingsrecht-uitspraken) plus lokaal beleid dat Propdex al extraheert. Koper: verbouwers/beleggers (B2B), het rapport als conversie- en onderbouwingsmiddel. Zie `memory/project_pivot_vergunningskansen_rapport.md`.

## 3. Scope — de spine (eerste buildbare ding)

**In scope:**
- Adres-invoer → perceelresolutie (hergebruik bestaande PDOK-adreszoeker + perceel-lookup).
- Verbouwingstype-selector. **Start: splitsing.** Architectuur ondersteunt later meer types (dakkapel, optoppen, uitbouw, nieuwbouw, functiewijziging).
- Backend "rapport-samensteller": voor (perceel + verbouwingstype) verzamelt perceelfeiten + relevant beleid + jurisprudentie.
- Nieuwe rapport-view die dat rendert.
- **Geen score. Geen nep-percentage** — een onderbouwd risicobeeld.

**Non-goals (nu niet):**
- Geautomatiseerde rechtspraak-pijplijn (omgevingsrecht binnenhalen + classificeren). Jurisprudentie is in v1 **gecureerd**: echte ECLI's, handmatig gekoppeld aan verbouwingstype + context.
- Diep verwijderen van scoringsmotor, kaart-ontdekking, lifecycle/werkplek, dashboard. Blijven staan tot de spine overtuigt; opruimen is fast-follow.
- Betaling/abonnement, white-label branding. Later.

## 4. Architectuur

- Zelfde repo, **nieuwe branch**. Nieuwe frontend-surface (eigen routes + rapport-module) náást het bestaande. Backend ongewijzigd hergebruikt; de scoringsmotor wordt in deze flow simpelweg niet aangeroepen.
- Productie blijft op `main` draaien tot we bewust wisselen.

## 5. Flow

1. Adres invoer (autocomplete via bestaande PDOK-suggest).
2. Resolve adres → perceel (bestaande lookup → `parcel_id` + perceelfeiten).
3. Kies verbouwingstype (default splitsing).
4. Backend stelt rapport samen:
   - **Perceelfeiten:** bestemming, oppervlakte, bouwjaar, `buurt_code`, monument/beschermd-gezicht-status.
   - **Beleid voor dit type + deze wijk:** splitsing → huisvestingsverordening (hergebruik bestaande extractie achter `splitsingsrisico`): vergunningplicht, schaarste/leefbaarheid-criterium, eventuele wijk-specifieke regels.
   - **Jurisprudentie:** 3-5 gecureerde echte ECLI's relevant voor splitsing + context, met korte duiding (gemeente, weigeringsgrond, uitkomst).
5. Rapport-view rendert vier blokken:
   - **Perceelfeiten** (kort, tastbaar).
   - **"Wat geldt hier"** — het beleid in mensentaal.
   - **"Wat zegt de rechter"** — de uitspraken + wat eruit volgt.
   - **Aandachtspunten** + "vraag aan via Omgevingsloket".

## 6. Datacontract per verbouwingstype

Een verbouwingstype definieert drie dingen, zodat het rapport configureerbaar is zonder nieuwe code per type:
- welk **beleid** relevant is (splitsing → huisvestingsverordening; dakkapel → welstandsnota; optoppen → bestemmingsplan max bouwhoogte),
- welke **perceelfeiten** ertoe doen,
- welke **jurisprudentie-cluster** (zoekterm/categorie) hoort.

## 7. Wat blijft / valt weg (referentie)

**Blijft:** PDOK adres→perceel, perceelfeiten (BAG/bestemming/buurt_code/monument), beleidsextractie (huisvestingsverordening, parkeernormen, woonvisie, omgevingsvisie), rapportgeneratie-scaffolding, auth/multi-tenant.

**Valt weg (na de spine):** scoringsmotor (potentie/risico/overall + FACTOR_REGISTRY-gewichten + re-score jobs + tile-kleuring), kaart-als-ontdekking (tiles/overlays/layer-toggles), lifecycle/werkplek (fasen/side-rail/checklists/dossier/BRK/brief/Realworks/dashboard/favorieten), factor-kaarten + bijdrage-bars.

## 8. Validatiepoort

De spine bouwen we om aan een belegger te tonen en feedback te halen. Pas ná een "ja, dit koop ik"-signaal investeren we in: geautomatiseerde jurisprudentie-pijplijn, meer verbouwingstypes, opruimen van de oude app, white-label/betaling.

## 9. Open beslissingen (input nodig)

1. **Gemeente(n) voor v1?** Venlo heeft perceeldata; splitsing-jurisprudentie kan landelijk (ECLI's zijn niet gemeente-gebonden).
2. **Verbouwingstype-set v1:** alleen splitsing, of splitsing + één visueel type (dakkapel) om de breedte te tonen?
3. **Rapport-output:** web-view, PDF, of beide?
4. **Hoeveel hergebruik van de bestaande rapport-view** vs. een schone nieuwe view?
