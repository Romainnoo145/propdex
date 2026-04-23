# Propdex — Stack Workflow Contract

**Werkwijze:** drie-laags stack — gstack denkt, GSD stabiliseert, superpowers voert uit.
Bij elke nieuwe taak vraag jezelf: *"Mis ik beslissing, context of executie?"*

---

## Laag 1 — DECISION (gstack)

**Wanneer:** alleen bij start van een **nieuwe milestone** (M0xx). NIET halverwege, NIET voor bugfixes, NIET voor slices binnen een lopende milestone.

**Tools (in volgorde):**
1. `/office-hours` — forcing questions: bouwen we het juiste? Wat is de wedge?
2. `/plan-ceo-review` — scope expansion of hold?
3. `/plan-eng-review` — architectuur lock-in
4. `/plan-design-review` — alleen als er UI in zit

Output landt in de milestone roadmap **vóórdat** GSD slices worden aangemaakt.

---

## Laag 2 — CONTEXT (GSD)

**Single source of truth voor "waar staan we".**

- State leeft in: `/home/klarifai/.gsd/projects/0fbd70b53f1b/`
- **Lezen:** altijd vóór actie (hook injecteert dit bij SessionStart)
- **Schrijven:** alleen via `/gsd:*` commands. Nooit handmatig `STATE.md`/`DECISIONS.md` editen.

**Slices, niet milestones.** Een slice = atomische unit. Werk binnen 1 slice tegelijk.

---

## Laag 3 — EXECUTION (superpowers)

**Hoe het werk gebeurt binnen één slice.**

| Trigger | Verplichte skill |
|---|---|
| Nieuw component / nieuwe UX | `superpowers:brainstorming` (vóór code) |
| Multi-step taak | `superpowers:writing-plans` |
| Feature of bugfix | `superpowers:test-driven-development` |
| Plan klaar, ga uitvoeren | `superpowers:executing-plans` |
| "Klaar" claimen | `superpowers:verification-before-completion` |
| Vóór merge | `superpowers:requesting-code-review` |

**Niet verplicht** voor: pure docs, config edits, audit/refactor van bestaand werk zonder design-shift.

---

## Harde regels

1. **Geen losse hotfixes.** Elk commit hoort bij een slice. Format: `M0xx/Sxx: <wat>`.
   - Allowlist (mag zonder slice-prefix): `chore:`, `docs:`, `merge:`, `fix:` voor build/CI breakage.
2. **Geen component-werk zonder voorafgaande brainstorm** in dezelfde slice. Audit/refactor mag wel.
3. **"Klaar" zonder verification = niet klaar.** Altijd `superpowers:verification-before-completion` vóór de claim.
4. **Eén slice tegelijk.** Geen werk verspreid over meerdere slices in één sessie tenzij expliciet afgesproken.
5. **STATE.md is heilig.** Wijzigen alleen via `/gsd:*` commands. Als git en STATE.md uit sync raken: stop, sync eerst.

---

## Triage entry-vraag

Bij elke nieuwe sessie of nieuwe taak:

> *"Mis ik beslissing, context of executie?"*

- **Beslissing mist** → gstack laag (alleen voor nieuwe milestone)
- **Context mist** → lees GSD STATE.md (gebeurt automatisch via hook)
- **Executie mist** → kies de superpowers skill voor het type werk

---

## Codebase basics

- Frontend port: 9300 (NIET 3000)
- Backend port: 8000
- Postgres (PostGIS): port 5434, container `propdex-db`
- Redis: port 6380, container `propdex-redis`
- Validation per change: `npm run check` (frontend) / `ruff check . && mypy .` (backend)
- Files onder 300 lines, splits anders
- Multi-tenant: elke query filtert op `organization_id`

Voor diepere project-context: zie `~/.claude/projects/-home-klarifai-Documents-klarifai-clientprojects-propdex/memory/MEMORY.md`.

---

## Design System

**Always read `DESIGN.md` before making any visual or UI decisions.**

Alle font-keuzes, kleuren, spacing, radius, motion en aesthetic direction zijn daar vastgelegd. Niet afwijken zonder expliciete user-approval. In QA / design-review mode: flag elke code die niet met DESIGN.md matcht.

Korte samenvatting (altijd DESIGN.md lezen voor de volledige regels):
- **North Star:** two-mode product — Discovery (map-first) + Build-management (data-dense).
- **Canvas:** Morning Mist `#F2F6F3`, NIET wit.
- **Accent:** Warm Amber `#F9A826` (intelligence). Obsidian `#0E1111` (commitment).
- **Font:** Plus Jakarta Sans, single family.
- **Glass surfaces:** `bg-white/60 backdrop-blur-[24px]`.
- **Tokens live in:** `frontend/src/styles/index.css` (Tailwind v4 `@theme` block).
- **Light mode only.** Dark mode is uit scope.
