# GSD Queue

<!-- Append-only log of future milestones queued via /gsd queue. -->
<!-- These milestones are not yet planned — they capture intent for future work. -->

## Queued Milestones

### M002 — v18.0 Kansenkaart + Nav Simplification

**Vision:** Transform the UI from a 5-route app into a dual-panel map intelligence system. Navigation collapses to 2 items (Kaart + Opgeslagen). The map becomes the entire product surface — gemeente intelligence lives in a new left panel with summary cards and full-page modals, parcel intelligence stays in the right panel. Kansenkaart heatmap adds color mode switching for spatial opportunity visualization. Pipeline management moves from dead Projecten page into enriched Opgeslagen favorites.

**Key deliverables:**
- Navigation: 5 items → 3 (Kaart + Opgeslagen + Jurisprudentie)
- Dual-panel map: existing right panel (parcel) + new left panel (~400px GemeenteContextPanel on gemeente boundary click)
- Gemeente intelligence via left panel summary cards → full-page modals (DemografieModal, JuridischKlimaatModal, MeldingenModal, WijkenModal)
- Kill standalone routes: Projecten, Rapporten (Jurisprudentie stays — wizard explorer is a different interaction model)
- Meldingen feed absorbs into map/gemeente panels
- Kansenkaart heatmap + map color modes
- Pipeline → Completeness model + enriched favorites in Opgeslagen view

**Phases (from product vision):**
1. Phase 114: Nav Simplification (5 → 2 items)
2. Phase 115: Gemeente Left Panel (GemeenteContextPanel)
3. Phase 116: Gemeente Modals (Demografie, JuridischKlimaat, Meldingen, Wijken)
4. Phase 117: Map Color Modes + Kansenkaart heatmap
5. Phase 118: Pipeline → Completeness + enriched favorites

**Product layer coverage:**
- Discovery (map/filters): 70% → ~90%
- Workflow & Actie: 5% → ~20%

**Note:** This milestone kills the Projecten page. M001 S14 (Pipeline Stages on Projecten) is dead work — pipeline management absorbed into Phase 118. M001 S15 (Map Markers) carries forward into this milestone.

---

### M003 — v19.0 Vergunning & Bestuurlijke Intelligence

**Vision:** Make Propdex the definitive source for understanding a municipality's political and regulatory posture toward development. Scrape raadsinformatiebrieven, surface subsidie opportunities, compute per-parcel vergunningkans, detect BOPA signals, and build gemeente profile dashboards.

**Key deliverables:**
- Raadsinformatiebrieven scraping + AI summaries
- Subsidie intelligence (RVO / provincial APIs)
- Vergunningkans-indicator per parcel
- BOPA signalering (buitenplanse omgevingsplanactiviteit)
- Gemeenteprofiel dashboards

**Product layer coverage:**
- Vergunning Intelligence: 30% → ~60%

---

### M004 — v20.0 Ontwikkel Quickscan & Scenarios

**Vision:** Move beyond "what's here" to "what could you do with it." Use-case specific scoring for optoppen, splitsen, transformatie, and nieuwbouw. Side-by-side scenario comparison. Confidence scoring based on data coverage. Custom zoekprofielen with multi-criteria filtering.

**Key deliverables:**
- Use-case specific scores: optoppen / splitsen / transformatie / nieuwbouw
- Scenario comparison side-by-side
- Confidence scoring based on data coverage
- Custom zoekprofielen with multi-criteria filtering

**Product layer coverage:**
- Ontwikkelpotentie: 40% → ~75%

---

### M005 — v21.0 Document Automation & Workflow

**Vision:** Close the loop from intelligence to action. AI summarizes documents, generates concept briefs to property owners and pre-consultation requests to municipalities. Per-parcel action suggestions, task management with deadlines, and vergunning preparation checklists turn Propdex from an intelligence tool into a workflow system.

**Key deliverables:**
- AI document summarization
- Concept document generation (eigenaar briefs, vooroverleg requests)
- Per-perceel actievoorstellen
- Taakbeheer with deadlines
- Vergunning voorbereiding checklists

**Product layer coverage:**
- Dossier: 25% → ~60%
- Workflow & Actie: 20% → ~50%

---

*Queued: 2026-03-17*
*Source: Product vision conversation (breezy-mixing-puzzle.md)*
