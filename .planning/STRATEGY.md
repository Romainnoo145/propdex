# Propdex — Strategische Positionering

**Vastgesteld:** 2026-03-02
**Door:** Klarifai + Claude strategische analyse

---

## Kernpositionering

> "Matrixian vertelt je wat het waard is. Het Omgevingsloket vertelt je wat mag. Propdex vertelt je wat je ermee kunt doen — en of het de moeite waard is."

**Propdex = cockpit voor de voorkant van vastgoedontwikkeling.**
Van grondpositie tot go/no-go in 1 platform.

---

## Doelgroepen

| Segment | Prioriteit | Waarom |
|---------|-----------|--------|
| Vastgoedontwikkelaar | **#1 — Kernmarkt** | Niemand bedient hun scouting-to-due-diligence workflow end-to-end |
| Kwaliteitsborger (Wkb) | **#2 — Nichewinst** | Wkb is nieuw (2024), geen tooling, risicobeoordeling past perfect |
| Particulier (B2C) | **NIET DOEN** | Omgevingsloket biedt vergunningcheck gratis, geen verdienmodel |
| Makelaar | **NIET DOEN** | Brainbay/NVM heeft dit al, geen opening |

---

## Concurrentielandschap (eerlijk)

| Platform | Sterkte | Zwakte (onze opening) |
|----------|---------|----------------------|
| **Matrixian** | 7.8M panden, 300+ kenmerken, AVM | Alleen huidige waarde, geen transformatiepotentie |
| **Calcasa** | AVM goedgekeurd door alle hypotheekverstrekkers | Alleen taxatie, geen ontwikkelperspectief |
| **Brainbay** | 1M API calls/dag, grootste NL database | Voor makelaars (NVM), niet voor ontwikkelaars |
| **Reasult** | Haalbaarheidsanalyse, 60+ klanten | Post-acquisitie tool, geen scouting |
| **Planviewer** | Alle bestemmingsplannen NL | 1 adres per keer, geen bulk, geen interpretatie |
| **Altum AI** | 250+ woningvariabelen, duurzaamheid | Taxatie-gericht, geen scanning |
| **Locatus** | 400k winkelpunten, Benelux | Retail-only |
| **RPS/Antea Group** | Professionele TDD rapporten | Weken doorlooptijd, duur, handmatig |

### Kritisch inzicht

Deze platforms zijn **veel verder** dan Propdex op hun eigen terrein. We winnen niet door ze te kopiëren. We winnen door iets te doen dat **niemand combineert**: de hele scouting-to-go/no-go pipeline in één flow.

---

## Ontwikkelaar-workflow & dekking

```
1. SCOUTEN       → Gebiedsscan (100k+ percelen)          [Propdex ✓]
2. SCREENEN      → Scoring + ranking                     [Propdex ✓]
3. DUE DILIGENCE → Auto-rapport (8 bronnen)              [Propdex ✓]
4. RISICO        → Risicobeoordeling dossier             [Propdex ✓ v9.0]
5. HAALBAARHEID  → Grondexploitatie / BAR-NAR            [TODO — killer feature]
6. GO/NO-GO      → Portfolio dashboard + vergelijking     [TODO]
7. VERGUNNING    → Omgevingsloket (niet ons terrein)     [—]
8. BOUWEN        → Aannemer (buiten scope)               [—]
```

---

## Omgevingsloket — harde grens

Het Omgevingsloket heeft wettelijk monopolie (Art. 16.1 Omgevingswet) op:
- Officieel indienen vergunningaanvraag
- Leges innen
- Juridisch geldig ontvangstbewijs
- Multi-overheid coordinatie

**Beslissing: NOOIT een vergunningchecker/wizard voor particulieren bouwen.** Dat is gratis overheidsproduct kopiëren zonder verdienmodel.

**WEL toegestaan:**
- Data ophalen via DSO APIs (gratis, Fair Use Policy)
- AI-samenvattingen maken van bestemmingsplanregels
- Voorbereiding/documentatie voor vergunningaanvraag
- Risicobeoordeling genereren (Wkb workflow)

---

## Mastertool roadmap — toekomstige features

| Feature | Beschrijving | Moeilijkheid | Impact | Bron |
|---------|-------------|-------------|--------|------|
| AI bestemmingsplan-samenvatting | Juridische tekst → mensentaal ("hier mag je appartementen tot 15m") | Medium | Hoog | DSO/bestemmingsplan data |
| Instant haalbaarheidscheck | Geschatte grond + bouw + opbrengst → BAR/NAR in 30 sec | Hoog | Hoog | BDB bouwkosten + WOZ + marktdata |
| Portfolio vergelijkingsdashboard | 5 locaties naast elkaar vergelijken op alle dimensies | Medium | Hoog | Eigen data |
| Concurrentie-alerts | "Sloopvergunning aangevraagd op dit perceel" = koopsignaal | Laag | Hoog | Meldingen (bestaat al) |
| Marktwaarde-integratie | WOZ + referentietransacties als context | Medium | Medium | WOZ API + Kadaster |
| Transformatie-scanner | Niet "wat is het waard?" maar "wat KAN hier?" | Hoog | Hoog | Cross-source analyse |

---

## Wat Propdex uniek maakt (verdedigbaar)

1. **Gebiedsscans op gemeenteschaal** — 100k+ percelen tegelijk scannen en ranken
2. **Cross-source aggregatie** — 8 overheids-APIs in 30 seconden
3. **Transformatiepotentie** — niet huidige waarde maar toekomstige mogelijkheden
4. **Veranderingsintelligentie** — meldingen als koopsignalen voor ontwikkelaars
5. **Geautomatiseerde risicobeoordeling** — van weken (RPS/Antea) naar seconden
6. **End-to-end flow** — scouten → screenen → due diligence → risico → go/no-go

---

## Prijsindicatie (marktonderzoek)

| Tier | Prijs | Doelgroep |
|------|-------|-----------|
| Starter | €499/maand | Kleine ontwikkelaar (1 user, 1 scan/maand) |
| Professional | €1.299/maand | Mid-market (3 users, 10 scans/maand) |
| Enterprise | Op maat | Grote partij (unlimited, API toegang) |

Referentie: Matrixian haalde €3.5M op met alleen taxaties. Reasult heeft 60+ betalende klanten.

---

## Anti-patronen (NIET doen)

- **NIET** vergunningchecker voor particulieren bouwen (Omgevingsloket = gratis)
- **NIET** concurreren op taxatie/AVM (Matrixian/Calcasa zijn jaren voor)
- **NIET** makelaarstools bouwen (Brainbay/NVM domineert)
- **NIET** project-financieringstool bouwen (Reasult domineert)
- **WEL** de gaten vullen die niemand dekt: scouting + screening + risico op schaal
