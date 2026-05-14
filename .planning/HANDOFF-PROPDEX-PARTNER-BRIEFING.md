# Handoff — Propdex Partner Briefing (volgende sessie)

**Context:** Klarifai heeft net een soortgelijk doc afgerond voor Box.16 (zie `.planning/PARTNER-BRIEFING-2026-05-13.md` in box16-repo). Voor Propdex willen we hetzelfde — **50/50 partnership-deal** met sales-partner, maar onder iets andere voorwaarden. Structuur en lessen blijven gelijk.

---

## Wat de volgende sessie moet opleveren

Een **`.planning/PARTNER-BRIEFING-<datum>.md`** in de Propdex-repo met:

1. **Executive Summary** — 5 bullets, top-line takeaways
2. **§1** — Wat is Propdex + waarom betalen klanten (use-case, tijdwinst, pricing-power, doelmarkt, concurrentie)
3. **§2** — Status: wat is af (per phase ✅)
4. **§3** — Wat ontbreekt vóór commerciële launch (gap-tabel met impact/effort/prioriteit)
5. **§4** — Lopende kosten + Kosten-roadmap per groeifase (pilot → launch → groei → scale)
6. **§5** — Sprint-roadmap (week 1-2, 3-4, post-launch)
7. **§6** — Beslissingen-tabel met **Voorstel Klarifai** per rij
8. **§7** — Partner-deal structuur (zie hieronder voor specifieke aandachtspunten)
9. **§8** — Risico's (eerlijk benoemd, met mitigaties)

---

## Methodologie — wat werkte voor Box.16

1. **Eerst audit-agent spawnen** die alle planning-docs, env-vars (Vercel/Railway/hosting), README's, CLAUDE.md, en huidige deployment-status verzamelt. Output = feitelijke status zonder meningen.
2. **Daarna doc schrijven** op basis van die audit, met expliciete cost-roadmap per groeifase.
3. **Toon**: zakelijk maar warm — het is een samenwerking tussen bekenden, geen VC-pitch deck.

---

## Kritieke voorkeuren van Klarifai (lessen Box.16 sessie)

Deze gelden óók voor Propdex — **stevig in acht nemen:**

### 1. Partner-deal: GEEN uren-commitment
- Nooit "X uur/week" of activity-tracking voorstellen
- Vesting puur op outcome (klanten, MRR, etc.)
- Als mijlpalen niet gehaald → aandelen vesten niet en vloeien terug. Dat is de meetlat. Niets anders.

### 2. Partner-deal toon: zakelijk maar respectvol
- Het is **samenwerking tussen bekenden**, geen high-stakes VC-deal tussen vreemden
- **Voor Propdex: iets zakelijker geschetst dan Box.16** — formelere taal in clausules, scherpere definities, maar nog steeds collaboratief in framing
- Geen harde "0% bij vertrek" cliffs of anti-fraud-framing — dat blijft te scherp
- Wél: milestone-vesting (zakelijke ruggengraat), tag/drag-along, pre-emption, non-compete (12-18 mnd, marktconform voor de sector waarin Propdex speelt)
- Wél: scherpere definitie "betalende klant" met heldere voorwaarden — mag duidelijker geformuleerd zijn dan in Box.16
- Niet: emotionele framing ("voorkomt churn-manipulatie", "bewijslast nalatigheid")
- Toevoegen: **periodieke evaluatie elke 3 of 6 mnd** als professioneel review-moment (frequenter dan Box.16 mag, geeft zakelijker signaal)

### 3. Concrete aanbevelingen in beslissingen-tabel
- §6 mag niet alleen vragen stellen — geef per rij een **Voorstel Klarifai**
- Helpt partner-gesprek anchoren

### 4. Eerlijke risico-sectie
- §8 expliciet, geen verstoppertje spelen
- Kans (Laag/Medium/Hoog) × Impact × Mitigatie

### 5. Kosten-roadmap is overtuigingsmiddel
- Per-klant kost moet dalen bij schaal (€10 → €3 voor Box.16)
- Bruto-marge zichtbaar tonen (95-97% is realistisch voor SaaS)
- Gross margin = belangrijkste cijfer voor partner

---

## Wat anders zal zijn voor Propdex

Klarifai zei: **"iets andere voorwaarden, maar het idee blijft hetzelfde"**.

Vraag in nieuwe sessie expliciet uit (eerste 5 minuten):

1. **Wat doet Propdex precies?** (lees CLAUDE.md, README, .planning/ in de repo)
2. **Wie is de Propdex-sales-partner?** (zelfde persoon als Box.16 of anders?)
3. **Welke voorwaarden zijn anders?** Mogelijk:
   - Andere vesting-mijlpalen (Propdex heeft mogelijk andere klant-grootte/cycli)
   - Andere commissie-percentage
   - Andere non-compete scope
   - Andere eigendomsstructuur (Propdex zit nu binnen Klarifai BV — apart of niet?)
4. **Pricing-model Propdex?** (vast abo, pay-per-use, transaction fee?)
5. **Pilot-klant?** (heeft Propdex al een pilot-klant zoals Bon-Trans voor box16?)

---

## Suggested opening prompt voor nieuwe sessie

> Lees `.planning/HANDOFF-PROPDEX-PARTNER-BRIEFING.md` en bekijk als template-voorbeeld het Box.16 partner-briefing-doc op `/home/klarifai/Documents/klarifai/clientprojects/box16/.planning/PARTNER-BRIEFING-2026-05-13.md`. Doe daarna een audit van de Propdex-repo (CLAUDE.md, .planning/, deployment status, env vars) en stel mij 5-7 vragen om de Propdex-specifieke gegevens helder te krijgen. Daarna schrijf je `.planning/PARTNER-BRIEFING-<vandaag>.md` voor Propdex.

---

## Referentie — Box.16 template-locatie

```
/home/klarifai/Documents/klarifai/clientprojects/box16/.planning/PARTNER-BRIEFING-2026-05-13.md
```

De nieuwe sessie kan dit doc direct lezen vanaf disk — staat in een buurmap onder `clientprojects/`.

---

*Veel succes met Propdex 🚀*
