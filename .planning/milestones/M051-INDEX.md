# M051 — Brief-Send Pipeline (Hub Doc)

**Defined:** 2026-05-19 (split from M050)
**Status:** Defined, not yet kicked off
**Kickoff blocked on:** Kadaster DPA progress (related — M050 BRK persist is dormant until DPA signed), PostNL Zakelijk legal-track (~4 wk lead-time)

## Origin

M051 was geboren uit een mid-milestone audit van M050 BRK Actiefase-Wedge. M050 shipte 5/10 phases (BRK datamodel + persist + scoring + cockpit + fase-2 wire-up) — alleen de research/lookup-helft van het originele "Onderzoek → Actie" wedge-concept. De brief-send actie-helft (templates + AI + PostNL + branding + tier-gates) werd nooit gepland of gebouwd binnen M050. Bij audit op 2026-05-19 bleek dit 23/45 unsatisfied requirements; de brief-half is losgekoppeld en als M051 neergezet.

Zie: `.planning/vM050-MILESTONE-AUDIT.md` voor het volledige audit-rapport.

## Artifacts

- `.planning/milestones/M051-ROADMAP.md` — 5 phases (Brief-Template → AI → PostNL → Partner-Branding → Wiring+Tier-Gates)
- `.planning/milestones/M051-REQUIREMENTS.md` — 23 requirements (3 BRIEF + 4 AI + 5 POST + 3 BRAND + 3 WIRE + 5 TEST)

## Architectuur-erfgoed

De originele M050 ENG-PLAN (`.planning/milestones/M050-ENG-PLAN.md`) bevat alle architectuur-decisions die voor M051 nog van toepassing zijn:

- **D1**: Pydantic-only typed AI input — geen freeform-prompt
- **D2**: Atomic quota UPDATE (`WHERE count < limit RETURNING`)
- **D3**: Webhook idempotency via `external_event_id` UQ + `ON CONFLICT DO NOTHING`
- **D4**: Env-flag triad (M051_BACKEND / M051_FRONTEND / M050_5_TIER_ENFORCEMENT)
- **D5**: Sync brief-create API + DB-write, async PostNL via ARQ
- **D6**: Claude streaming via Anthropic SDK + FastAPI `StreamingResponse`; PostNL SPOF accepted v1
- **D7**: Partner-review-step verplicht vóór `/briefs/{id}/send` — geen direct-send pad
- **Q6 LOCKED**: PostNL Zakelijk master-account model (Propdex tekent contract; sender-identity dynamisch per partner-branding)
- **Q8 LOCKED**: Tier-quota Demo 0/0, Paid 25/5, Enterprise 250/50 (BRK / brief per maand)

## Dependencies

**Wat M051 nodig heeft (al shipped in M050):**
- `GET /api/parcels/{id}/brk` endpoint voor brief-perceel-context (M050 Phase 8)
- Cockpit + lifecycle sidebar shell voor brief-CTA hosting (M050 Phase 6)
- BRK risico-scoring beschikbaar voor brief-content-context (M050 Phase 3)

**Wat M051 nodig heeft (extern):**
- Kadaster verwerkersovereenkomst getekend → activeert M050 BRK persist + M051 brief-send productie
- PostNL Zakelijk master-account onboarding (~4 wk lead-time)
- M050.5/S02 (quota-counter) gemerged vóór M051 Phase 5 tier-gates kan wiren

## Kickoff-checklist

Vóór `/gsd:new-milestone M051` of `/gsd:plan-phase 1`:

- [ ] Bevestig M050 Phase 105 modal blijft de fallback voor BRK natuurlijke-persoon (geen persist)
- [ ] Bevestig Kadaster DPA status (M050 + M051 productie-pad both gated)
- [ ] Bevestig PostNL legal-track gestart
- [ ] Bevestig M050.5/S02 quota-counter status (M051 Phase 5 depends)
- [ ] Bevestig partner-review/approve-step UX-flow (D7) — design-review als nieuwe component nodig

## Out of Scope (geërfd van M050)

- S08 Admin-UX quota-monitoring → M052
- Graceful-degrade PostNL outage PDF-fallback → M052+
- Multi-channel outreach (email/WhatsApp/SMS/LinkedIn) → M053+
- Reply-tracking inbound mail → M053+
- A/B-test brieven → M054+

---

*M051 hub doc — created 2026-05-19 during milestone split from M050. Original M050 brief-half pre-planning artifacts (M050-INDEX.md, M050-ENG-PLAN.md, M050-DECISIONS-PRE-PLANNING.md) remain authoritative for D1-D7 architectuur decisions.*
