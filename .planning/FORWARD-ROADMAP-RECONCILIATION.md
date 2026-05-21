# Forward-Roadmap Reconciliation (2026-05-21)

**Aanleiding:** De originele milestone-landscape (`~/.gstack/projects/Romainnoo145-propdex/complete-milestone-landscape-20260418.md`, v3) plande een lineaire scoring-roadmap M050-M059. Sindsdien is er een **strategische pivot** (System-of-Engagement + Hauzer, 2026-05-21) die milestone-nummers M050/M051/M052 heeft hergebruikt voor ánder werk. De cascade-batches zijn dáármee verschoven — **niet geschrapt**. Dit doc reconcilieert de twee.

**Dit vervangt de milestone-sequentie (Deel 4) van de landscape-doc als forward-planning-bron.** De landscape-doc blijft authoritative voor cascade-doc-inhoud (welk document voedt welke factor — zie `CASCADE-DOCUMENT-MAPPING.md`).

---

## 1. Wat er feitelijk gebeurde met M050/M051/M052

| Nr | Landscape bedoelde (2026-04-18) | Werd in werkelijkheid (2026-05) | Status |
|----|---------------------------------|----------------------------------|--------|
| **M050** | Cascade Batch 1 — Juridisch klimaat | **BRK Lookup-Wedge** (eerste paid Type-C, eigendom-diepte) | ✅ Shipped 2026-05-21 |
| **M050.5** | (bestond niet) | **Feature Tiering & Demo Lockdown** | Defined, parallel |
| **M051** | Financieel — Subsidies | **Brief-Send Pipeline** (eigenaar-outreach na BRK) | Defined, gated (DPA+PostNL) |
| **M052** | BRK uitbreiding — Eigendom diepte | **Hauzer Engagement-Demo** (System-of-Engagement) | 🆕 Started 2026-05-21 |

**Waarom:** (1) BRK bleek de bredere wedge dan Subsidies → naar voren gehaald als M050 (2026-05-17). (2) M050 audit splitste de brief-send-helft af als M051 (2026-05-19). (3) De System-of-Engagement-pivot (2026-05-21) maakte de engagement-laag de focus → M052. BRK "uitbreiding" (origineel M052) is grotendeels al gedekt door M050; NHR/diepere eigendom schuift door naar de scoring-track.

**Netto:** de M0-nummers 050-052 zijn nu een **engagement/integratie-spoor**, niet het cascade-spoor waar de landscape ze voor reserveerde.

---

## 2. De drie sporen

De solo-dev + parallel-able realiteit (zie PROJECT.md Tranche-2-pivot + Deel 2 landscape) betekent dat lineaire nummering niet meer past. Drie parallelle sporen:

### Spoor A — Engagement / product (huidige focus)
Daily-Active-Use laag; valideert demand via Hauzer vóór verdere investering.
- ✅ **M050** BRK Lookup-Wedge
- **M050.5** Feature Tiering (defined)
- **M051** Brief-Send Pipeline (defined, gated op Kadaster-DPA + PostNL legal)
- 🆕 **M052** Hauzer Engagement-Demo (active)
- **post-deal** productionisatie van M052-mocks (echte Realworks-matcher, nieuwbouw-matcher, change-monitor inbox) — genummerd ná Hauzer-commitment

### Spoor B — Scoring-depth / cascade (post-MVP iteratief)
De originele landscape-tail, verschoven. Maakt de score "zeggender". Lager prioriteit nu (engagement valideert demand eerst), maar **blijft nodig — dit is de data-magneet**.
- Zie renummering §3. Loopt **M053-M059**.

### Spoor C — Tranche-2 / developer-lifecycle (toekomst)
Verhuur → Beheer → Exit. Zie `.planning/milestones/TRANCHE-2-ROADMAP.md`.
- **M060-M110** (Bod/Vergunning/Bouw/Verhuur/Beheer/Exit). Ongewijzigd — band gereserveerd.

### Parallel — Infra & Features
- **I-01** Productie-infra (mail/OAuth/Stripe) — blokkeert eerste betalende klant
- **I-02** Monitoring hardening
- **F-01** Rendementscalculator · **F-02** Verkenner chat upgrade · **F-03** PDF rapport v3

---

## 3. Renummering Spoor B (cascade / scoring-depth)

Verschoven van origineel M050-M059 → nieuw **M053-M059**. Inhoud + cascade-docs onveranderd; alleen het nummer schuift. Twee bewuste merges om binnen de M053-M059-band te blijven (en niet in Tranche-2's M060+ te lopen) — **APPROVED 2026-05-21** (user-akkoord, voorwaarde: geen scope-verlies — alle sub-batches expliciet behouden, zie §3.1).

| Nieuw | Origineel | Inhoud | Cascade-docs | Karakter |
|-------|-----------|--------|--------------|----------|
| **M053** | M050 | Cascade Batch 1 — Juridisch klimaat | GEM-08 raadsinfo, GEM-09 leegstand, GEM-05 huisvesting, LAND-04/05 | politiek_klimaat, leegstandsdruk, splitsingsrisico |
| **M054** | M051 | Financieel — Subsidies | GEM-10, PROV-04, GEM-11 | subsidie_potentie, grondwaarde_fit · **Type-C (Vindsubsidies-contract)** |
| **M055** | M053 | Marktdata — NVM | (Type-C feed) | NVM-transactiedata, von_prijs, wws_segment_fit · **Type-C (NVM-contract)** |
| **M056** | M054 | Kosten-regelgeving — Welstand + Parkeer | GEM-02, GEM-04, GEM-12, LAND-07 | welstand_beperking, parkeerdruk, duurzaamheid/BENG |
| **M057** | M055 | Ruimtelijk — Omgevingsvisie + Ladder + Geo-overlay | GEM-01, LAND-02, PROV-01/02/03 | beleidsalignement, ladder_risico, woondeals + geo-infra |
| **M058** | M056 **+** M057 (merge) | Erfgoed + Natuur + Energie + Mobiliteit | GEM-14, PROV-05/06/07/08, LAND-08 | monument-refine, stikstof, energie_context, mobiliteit_waardering |
| **M059** | M058 **+** M059 (merge) | Ground-truth Validatie + Score v4.0 Release | — | kalibratie tegen historische cases → officiële v4.0-release |

**Merge-rationale:** orig M056 (Erfgoed+Natuur, 4 docs) en M057 (Energie+Mobiliteit, 2 docs) zijn beide klein → samenvoegen tot één milestone van 6 docs. Orig M058 (Ground-truth) en M059 (Release) zijn capstone + consolidatie → samenvoegen tot één validatie-naar-release-milestone. **APPROVED 2026-05-21.**

### 3.1 Scope-behoud bij de merges (geen verlies)

De merge is puur nummering — elk sub-batch behoudt al zijn slices/factoren. Bij kickoff van M058/M059 worden deze sub-secties 1-op-1 slices:

**M058 = (orig M056 Erfgoed+Natuur) + (orig M057 Energie+Mobiliteit):**
- GEM-14 Erfgoedverordening → monument-refine (gemeentelijk)
- PROV-06 Provinciaal erfgoed → monument-refine (provinciaal)
- PROV-05 + LAND-08 Stikstof/Natura2000 (prov.+landelijk consolideren) → stikstof_risico
- PROV-07 Energietransitie/RES → energie_context
- PROV-08 Mobiliteitsbeleid → mobiliteit_waardering

**M059 = (orig M058 Ground-truth) + (orig M059 Score v4.0 Release):**
- Ground-truth: historische dataset (10-15 cases) → score retroactief → gewicht-kalibratie → A/B-tooling → UAT 2 echte ontwikkelaars
- Release: factor-uitleg cross-review → score-versioning (v3.0 blijft zichtbaar, nieuw=v4.0) → per-use-case breakdown → investor-demo-flow
- Volgorde-borg: validatie-slices blokkeren de release-slices binnen M059 (kan geen "score klopt" claimen zonder validatie).

---

## 4. Number-band allocatie (collision-preventie)

Lineaire nummering brak omdat drie sporen parallel lopen. Vaste banden voorkomen herhaling:

| Band | Spoor | Toewijzing |
|------|-------|------------|
| **M050-M052** | A Engagement | M050 ✅ · M050.5 · M051 · M052 (vol) |
| **M053-M059** | B Scoring-depth | 7 cascade/scoring-milestones (zie §3) |
| **M060-M110** | C Tranche-2 | Verhuur→Exit (gereserveerd, ongewijzigd) |
| **post-deal** | A Engagement follow-on | genummerd ná Hauzer-commitment (Realworks/matcher/inbox productie) — kandidaat-band M053-… botst met B → **bij commitment beslissen: suffix (M052.x) of eigen band** |
| **I-0x / F-0x** | Infra / Features | parallel, eigen prefix |

**Bekend spanningspunt:** Spoor-A engagement-follow-ons (post-deal) hebben nog geen band. Omdat ze gated zijn op de Hauzer-deal (onzeker), reserveren we nu niets — bij commitment kiezen we suffix-nummering (M052.1, M052.2…) of een nieuwe band. Geen actie nodig tot de deal.

---

## 5. Wat dit NIET verandert

- **Cascade-doc-inhoud:** `CASCADE-DOCUMENT-MAPPING.md` blijft authoritative voor welk doc welke factor voedt. Alleen de milestone-nummers in dat doc (M050/M051/M054-M057) moeten gelezen worden als **M053/M054/M056-M058** per §3. *(Dat bestand niet ge-edit — deze mapping is de vertaallaag.)*
- **MVP-definitie:** eerste-klant-MVP = I-01 + M046 + M047 + M048(v1.48) + ground-truth. M046-M049 zijn ✅ shipped. Ground-truth zit nu in M059.
- **Tranche-2 (Spoor C):** ongewijzigd, M060-M110.

---

## 6. Status-snapshot (2026-05-21)

| Milestone | Spoor | Status |
|-----------|-------|--------|
| M046 Scoring Fundament | B | ✅ Shipped |
| M047 Projecttype + Cascade-Infra | B | ✅ Shipped |
| M048 / v1.48 Score v4.0 Frontend Scaling | B | ✅ Shipped |
| M049 Data Sources Hub | B | ✅ Shipped |
| M050 BRK Lookup-Wedge | A | ✅ Shipped |
| M050.5 Feature Tiering | A | Defined |
| M051 Brief-Send Pipeline | A | Defined (gated DPA+PostNL) |
| **M052 Hauzer Engagement-Demo** | **A** | **🆕 Active** |
| M053-M059 Scoring-depth tail | B | Planned (renumbered) |
| M060-M110 Tranche-2 | C | Roadmap |
| I-01/I-02, F-01/02/03 | Infra/Feat | Backlog |

---

*Created 2026-05-21 (RECON-01, M052 setup-deliverable). Vervangt forward-sequentie van `complete-milestone-landscape-20260418.md` Deel 4. Merges §3 APPROVED 2026-05-21 (scope-behoud §3.1). Resterende open decision: post-deal engagement-band §4 (pas relevant ná Hauzer-commitment).*
