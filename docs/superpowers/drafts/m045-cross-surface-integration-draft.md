# M045 — Cross-Surface Data Integration v2 (DRAFT)

> **Status:** Draft proposal. NOT yet committed via `/gsd:new-milestone`.
> Created: 2026-04-09 in the M044 closure session.
>
> **Next steps before execution:**
> 1. Close M044 formally (`/gsd:audit-milestone M044` → `/gsd:complete-milestone M044`)
> 2. Run gstack decision layer on this draft:
>    - `/office-hours` — pressure-test wedge selection
>    - `/plan-ceo-review` — scope expansion vs hold
>    - `/plan-eng-review` — lock the S04 architecture decision (data-driven mapping)
> 3. `/gsd:new-milestone` to create the formal M045 structure
> 4. `/gsd:plan-phase` per slice, starting with S04 (architecture)

---

## Vision

Sluit alle data-eilanden tussen workspace, checklists, beleid, perceeldetail, wijkdata en gemeentedata. Maak van Propdex één samenhangend systeem waar elk data point in elke surface dezelfde context heeft, en waar het toevoegen van een nieuwe data source automatisch in alle relevante surfaces verschijnt zonder hardcoded mapping uit te breiden.

## Predecessor: M042 (already shipped 2026-04-07)

M042 wired beleid → 4 surfaces als proof-of-concept met **8 hardcoded source keys**:

| Surface | What | Where |
|---|---|---|
| Beleid → Rapport | `PolicyInsightCard` (violet) in rapport tabs met AI summaries | `frontend/src/components/reports/components/PolicyInsightCard.tsx` |
| Beleid → Verkenner Chat | `query_policy_documents` + `get_checklist_status` agent tools | `backend/app/agents/agent_tools.py` |
| Workspace → Documents | `ParcelDocuments` in dossier tabs | `frontend/src/components/projects/FavoriteParcelWorkspaceView.tsx` |
| Perceeldetail → Beleid | `BeleidscontextCard` op map parcel panel | `frontend/src/components/map/panels/parcel/BeleidscontextCard.tsx` |

## The gap M044 created

M044 added 33+ source keys via `DocumentSourceDetailView` (16 gemeente + 8 provincie + 9 landelijk), but the M042 plumbing was never expanded:

| Pipeline component | M042 baseline | M044 reality | Gap |
|---|---|---|---|
| `SOURCE_KEY_TO_SECTION` mapping (`usePolicySummaries.ts:67`) | 8 source keys | 33+ uploaded | **25 source keys: AI parsed → DB → never surfaced** |
| `BeleidscontextCard` `DISPLAY_KEYS` (line 13) | 6 hardcoded gemeente keys | 16 gemeente keys | **10 gemeente keys never visible on parcel panel** |
| Backend endpoint `/api/policy-documents/summaries/gemeente/{code}` | Gemeente only | Provincie + landelijk uploads exist | **No `/provincie/` or `/landelijk/` equivalent** |
| `usePolicySummaries(gemeenteCode)` hook | Gemeente only | — | **No provincie/landelijk hooks** |
| `PolicyInsightCard` styling | `bg-violet-50 text-violet-700` | — | **§14 violation, never rebranded to amber** |
| Gemeente map panel beleid section | Doesn't exist | — | **No surface for "this gemeente has 12 documents"** |

## Root cause

The mapping is a hardcoded constant in a hook. Every new source key from M044 must be manually added to `SOURCE_KEY_TO_SECTION` and `BeleidscontextCard.DISPLAY_KEYS`. This doesn't scale — adding a new document type in `beleid.tsx` should automatically wire it through every surface that consumes policy summaries.

**Fix:** make it data-driven. Add `rapportSection?: SectionKey` (and optionally `crossReferenceTargets?: string[]`) directly to the `DataSource` definition in `beleid.tsx`. The hook derives the mapping from the catalog. New source key → automatic wiring everywhere.

This is the **S04 architecture decision** that gates the rest of the milestone.

---

## Slices (9 total)

### S01: Wijk + gemeente metrics in parcel detail panel
**Type:** wiring · **Effort:** medium · **Depends:** —

Klikt een gebruiker op een perceel op de kaart, dan toont het parcel detail panel inline de relevante wijk-level statistieken (demografie, WOZ, criminaliteit, voorzieningen via CBS) en gemeente-level vergunningklimaat (approval rate, gemiddelde doorlooptijd, bekendmakingen 30d).

**Klaar wanneer:** Klik perceel → ziet "Wijk: 35% boven 65 jaar · WOZ €280k · Doorlooptijd vergunningen 42 dagen" als compacte cards in het parcel detail panel, zonder modal-clicks.

**Bestaande infrastructure:** `useGemeenteProfile`, `useWijkData`, CBS clients, vergunning klimaat aggregator. Alles werkt al — wiring naar de panel ontbreekt.

---

### S02: Workspace checklist + dossier voortgangs-pills
**Type:** wiring · **Effort:** small · **Depends:** —

Op `/opgeslagen` (workspace) toont elke parcel row twee compacte voortgang-pills: checklist progress en documenten count. Geeft de user instant zicht op welke percelen nog aandacht nodig hebben.

**Klaar wanneer:** `/opgeslagen` row toont "Checklist 8/24 · Documenten 3/12" met amber pill voor elk opgeslagen perceel. Hover state toont laatst-bijgewerkt timestamp.

**Bestaande infrastructure:** `useChecklistProgress`, `useParcelDocuments` hooks bestaan. Alleen consumption op workspace row ontbreekt.

---

### S03: Rapport cross-references tussen secties
**Type:** wiring · **Effort:** small · **Depends:** —

Maak rapport secties klikbaar onderling. Klik op een vergunning in S6 → scrollt naar relevante regel in S3 (Bestemmingsplan). Klik op een eigenaar in S2 (Kadaster) → toont alle percelen van die eigenaar in dezelfde rapport context.

**Klaar wanneer:** Cross-section anchors werken in rapport tabs UI. PDF-export behoudt links als interne TOC anchors waar mogelijk.

**Open vraag:** moet dit ook in PDF-export? Of alleen UI? → eng-review beslissing.

---

### S04 ⭐: Data-driven SOURCE_KEY mapping via DataSource definitie
**Type:** architectuur · **Effort:** medium · **Depends:** — · **BLOCKS S05/S06/S07**

Vervang de hardcoded `SOURCE_KEY_TO_SECTION` constant door een data-driven mapping afgeleid uit de `DataSource` definities in `beleid.tsx`. Voeg nieuwe velden toe aan het `DataSource` type:

```ts
interface DataSource {
  // ... existing fields
  /** Which rapport section this source's AI summary appears in. */
  rapportSection?: SectionKey
  /** Whether this source should appear in BeleidscontextCard on parcel panel. */
  showOnParcelPanel?: boolean
  /** Whether this source should appear in gemeente/provincie map panel beleid summary. */
  showOnEntityPanel?: boolean
}
```

`usePolicySummaries` derivert mapping automatisch uit catalog. `BeleidscontextCard` queries de catalog ipv hardcoded keys.

**Klaar wanneer:** Een nieuwe `DataSource` entry in `beleid.tsx` met `rapportSection: 'analyse'` verschijnt automatisch in de Analyse-tab van het rapport zonder verdere code wijzigingen. Existing 8 keys gemigreerd naar nieuw schema, gedrag onveranderd.

**Eng-review topics:**
- Plek voor `SectionKey` type (sectionUtils.ts of nieuwe shared types)
- Backwards compat tijdens migratie (kunnen we beide schema's tegelijk supporten of hard switch?)
- Provincie/landelijk sources — hoe mappen ze naar gemeente-rapport secties? Of gaan ze direct naar de top als context?

---

### S05 ⭐: PolicyInsightCard amber rebrand + alle 33 source keys ondersteund
**Type:** wiring + design · **Effort:** small · **Depends:** S04

PolicyInsightCard krijgt §14-conforme styling (obsidian + amber, niet violet). Doordat S04 de mapping data-driven heeft gemaakt, toont de card automatisch AI summaries voor ALLE 33 geüploade source keys in de juiste rapport secties.

**Klaar wanneer:**
- Geen `bg-violet-*` of `text-violet-*` meer in `PolicyInsightCard.tsx` (§14 grep clean)
- Upload een PDF voor een willekeurige source key → AI summary verschijnt automatisch in juiste rapport sectie
- Visual: matches design contract §3 (SectionInsightCard wrapping als mogelijk, anders inline `bg-aura-amber/[0.08]` accent)

---

### S06 ⭐: Provincie + landelijk policy summary endpoints + hooks
**Type:** backend + wiring · **Effort:** medium · **Depends:** S04

Backend endpoints uitbreiden:
- `GET /api/policy-documents/summaries/provincie/{code}` (PV31, PV30, etc.)
- `GET /api/policy-documents/summaries/landelijk/NL`

Frontend hook generieker maken:
```ts
usePolicySummaries({ niveau: 'gemeente' | 'provincie' | 'landelijk', code: string })
```

Provincie summaries flowen naar rapporten van percelen IN die provincie (resolve perceel.gemeente → provincie code). Landelijk summaries flowen naar ELK rapport (één gedeelde set).

**Klaar wanneer:**
- Upload `omgevingsverordening.pdf` op provincie Limburg → AI summary
- Open rapport voor een Venlo perceel → ziet provincie omgevingsverordening summary in juiste sectie
- Upload `nationale-woonagenda.pdf` op landelijk → ziet 'm in elke rapport
- Tests: 1 provincie + 1 landelijk endpoint integration test

---

### S07 ⭐: Gemeente + Provincie map panel BeleidscontextCard
**Type:** wiring · **Effort:** medium · **Depends:** S04

Klik op een gemeente of provincie in de kaart (de gemeente/provincie panel, niet parcel panel) → panel toont een nieuwe beleid sectie met:
- Aantal geüploade documenten
- Aantal met AI summary
- Lijst van top 3-5 source keys met checkmarks
- Click-through naar `/beleid?gemeente=X` of `/beleid?provincie=X`

Hergebruik van bestaande `BeleidscontextCard` patroon, maar dan op `GemeenteMapPanel` en `ProvincieMapPanel` ipv parcel panel.

**Klaar wanneer:** Klik gemeente Venlo op de kaart → panel toont "Beleid · 12 docs · 8 met AI summary" met click-through. Idem voor provincie.

---

### S08: Welstandsnota + Omgevingsvisie AI parsing pipeline (proof points)
**Type:** data · **Effort:** medium · **Depends:** S04, S05

Concrete validatie van het end-to-end flow door 2 echte document types door de pipeline te halen. Welstandsnota en omgevingsvisie zijn bestaande document types in M044 catalog maar de AI parsing prompt voor deze types moet nog geschreven worden.

**Klaar wanneer:**
- Upload een echte welstandsnota PDF → ARQ job parseert via Claude → structured summary in DB
- Summary verschijnt automatisch in S3 (Bestemmingsplan) tab van rapport via S05
- Idem voor omgevingsvisie
- Cost monitoring: Claude usage per document logged via M024 admin dashboard

**Open scope:** moeten we hier 1 of 2 of meer document types pakken? Welstandsnota lijkt het meest waardevolle proof point. Omgevingsvisie is grotere PDF, hogere parsing cost.

---

### S09: Funda enrichment trigger + monitoring
**Type:** wiring · **Effort:** small · **Depends:** —

ActionItem `funda-enrichment` afvinken: bouw admin-gated knop in `/instellingen` om funda-enrichment job te draaien op alle bestaande scans. De funda-summary endpoint bestaat al, alleen handmatige trigger ontbreekt.

**Klaar wanneer:** Admin user → instellingen → "Funda enrichment draaien" knop → ARQ job loops alle scans, vult ontbrekende waarden, dashboard toont progress.

---

## Out of scope voor M045

| Item | Reden |
|---|---|
| Gemeentelijke subsidies (Vindsubsidies/NVM betaalde APIs) | Externe deal nodig — blijft in `QUEUE.md` |
| VON-prijs voorspelling | NVM API contract |
| Welstandsnota AI parsing voor ALLE Nederlandse gemeenten | Eerst pipeline bewijzen op 1 gemeente (S08) |
| Stikstof / CO₂ / netcapaciteit | Innovatie-tier in DataCatalog, niet roadmap |
| Subsidie matching per perceel (RVO landelijk) | Verschoven naar M046 — vereist eerst dat S05/S06/S07 stable zijn |
| WWS Huurpunten + Rendementscalculator | Verschoven naar M046 — separate feature, niet integratie |

## Suggested execution order

```
gstack:
  /office-hours       (wedge selection — welke 3 slices als we moeten kiezen?)
  /plan-ceo-review    (scope expansion of hold?)
  /plan-eng-review    (S04 architectuur lock-in — kritiek)

then:
  S04 (architectuur — blocker voor S05/S06/S07)
    ↓
  S05 + S06 + S07 (parallel — wiring sweep op data-driven foundation)
    ↓
  S01 + S02 + S03 (overige wiring — onafhankelijk van S04)
    ↓
  S08 + S09 (data + ops afronding)
```

## Forcing questions for /office-hours

1. **Wedge:** Als we maar 3 slices kunnen doen voor we shippen, welke drie? (Mijn gut: S04+S05+S06 — die drie samen lossen het kern probleem op dat gebruiker flagged)
2. **Wiring vs nieuwe data:** Is M045 puur wiring (S01-S07) of mag S08 erbij? Argument voor wiring-only: clean delivery, snelle feedback. Argument voor S08 erbij: pipeline pas echt bewezen als er 1 echte document type doorheen loopt.
3. **PDF export:** moeten S03 cross-references ook in PDF? Hoge effort, lage gebruiker waarde voor de meeste use cases (die de PDF later openen ipv de UI).
4. **S04 backwards compat:** kunnen we in 1 keer alle 8 bestaande source keys migreren naar nieuwe schema, of moet er een transitional periode zijn?
5. **S07 scope:** wijk panel ook? Of alleen gemeente + provincie? Wijk-niveau heeft geen beleidsdocumenten (CBS data only), dus waarschijnlijk nee — confirm.

## CEO review topics

1. **Is dit wat de echte gebruiker wil?** M042 was al een grote stap. Verder integreren is mooi maar misschien eerst valideren met 1 echte gebruiker dat de huidige integratie waarde levert vóór we 9 nieuwe slices openen.
2. **Concurrent priority:** moeten we niet eerst marketing/onboarding/payment infra doen voor M045? M045 maakt het product beter voor bestaande users, niet meer users.
3. **Wedge expansion:** is er iets bij M045 wat we kunnen verbreden naar een 10-star feature? Bijvoorbeeld: cross-surface integration als marketing message ("één perceel = alle context, automatisch") — zou dat de positionering versterken?

## Eng review topics

1. **S04 contract design** — `rapportSection?: SectionKey` op DataSource. Issues:
   - Type safety: `SectionKey` is gedefinieerd in `frontend/src/components/reports/components/sectionUtils.ts`. Importeren in `beleid.tsx` creëert een dependency van route naar reports component layer.
   - Multi-section mapping: sommige documenten zijn relevant voor meerdere secties (bv. welstandsnota → bestemming + risicoprofiel). Single field of array?
   - Provincie/landelijk: deze hebben geen "rapport sectie" want het rapport is gemeente-specifiek. Hoe representeren we "altijd zichtbaar"?
2. **S06 endpoint shape** — één generieke endpoint `/summaries/{niveau}/{code}` of drie aparte? Argument voor één: minder routes, generieker. Argument voor drie: explicit, makkelijker te testen.
3. **S05 backwards compat** — als we PolicyInsightCard rebranden naar amber, breken we visueel wat M042 leverde. Is dat acceptabel? (Ja, want het was §14 violation. Maar moet expliciet worden gevlagd.)
4. **Test coverage** — M045 raakt veel surfaces. Moet er een integration test zijn die: upload doc → AI parse → check rapport → check parcel panel → check gemeente panel allemaal in 1 flow? Yes. Waar leeft die test?

## Estimated effort

- Wiring slices (S01, S02, S03, S05, S07, S09): 1-2 dagen elk
- Architecture slice (S04): 2-3 dagen (incl. eng-review iteratie)
- Backend slice (S06): 2 dagen
- Data slice (S08): 3-5 dagen (afhankelijk van prompt iteratie + cost validation)

**Totaal:** ruwe schatting 15-20 werkdagen voor alle 9 slices. Realistisch: 1-2 maanden afhankelijk van parallellisatie en hoeveel tijd in brainstorm/review gaat.

---

## Why this matters

M044 leverde de UI om 33+ document types te uploaden. Maar zonder M045 is dat een data graveyard: gebruikers uploaden documenten, AI parses ze, maar de waardevolle inzichten verdwijnen in de DB en surfacen alleen voor 8 specifiek hardcoded source types. M045 maakt M044 daadwerkelijk waardevol door de upload-actie te verbinden aan elke surface waar de gebruiker context nodig heeft.

Dit is ook waarom S04 (data-driven mapping) zo belangrijk is: zonder dat blijft elke nieuwe document type een handmatige uitbreiding van 3-4 hardcoded constants. Met S04 wordt het toevoegen van een nieuwe data source een 1-regel wijziging in de catalog die automatisch overal landt.
