# M044/S01 — Audit + fix live gemeente enriched components Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring all 6 live gemeente enriched detail components in `frontend/src/components/configuratie/` fully in line with `~/.gsd/projects/0fbd70b53f1b/CONFIGURATIE-DESIGN-CONTRACT.md`, so clicking through Jurisprudentie, Bekendmakingen, VergunningKlimaat, Raadsinformatie, Huisvestingsverordening and BeschermdErfgoed in Venlo yields visually consistent views that match the rapport sections as ground-truth.

**Architecture:** Audit-driven refactor. Each component is a self-contained React function component consuming a React Query hook and rendering through `SectionInsightCard`, `SubCard`, `KVRow`, `SemanticPill` from `@/components/reports/components`. No new files. No new tests (visual compliance is verified via grep, type-check and manual click-through UAT — there are no existing style-unit tests in this project for enriched components). Every edit is one focused commit with contract references in the message.

**Tech Stack:** React 19, TypeScript strict, Tailwind v4, Plus Jakarta Sans, `@tanstack/react-query`, shared report components (`SectionInsightCard`, `SubCard`, `KVRow`).

**Contract reference:** `/home/klarifai/.gsd/projects/0fbd70b53f1b/CONFIGURATIE-DESIGN-CONTRACT.md` — §1 layout skelet, §2 containers, §3 SectionInsightCard structure, §4 typography, §5 pills, §6 TimelineRow list items, §8 KVRow, §10 loading/empty/error, §14 verboden patronen checklist.

---

## Audit results (performed during plan writing)

| File | Severity | Violations found |
|---|---|---|
| `BeschermdErfgoedDetailEnriched.tsx` | HIGH | `space-y-5` (should be `-6`), no Plus Jakarta on wrapper, custom `GezichtItem` without §6 TimelineRow dot+connector, non-contract type pill (`bg-slate-100 px-2 py-0.5 text-slate-500`), error state uses `text-slate-400` instead of `text-red-400` per §10 |
| `HuisvestingsverordeningDetailEnriched.tsx` | HIGH | `space-y-5` (should be `-6`), no Plus Jakarta on wrapper, **`SubCard` at top-level** (§2 violation: SubCard is "inner only"), bullet list uses hardcoded `bg-[#F9A826]` instead of semantic `bg-aura-amber` token |
| `JurisprudentieDetailEnriched.tsx` | LOW | `WinLossSummary` bar lacks motion animation (§9 + §13), SemanticPill classes are inlined instead of reusing contract's `SemanticPill` component shape (functional equivalent, but §5 specifies `text-[11px]` while this uses `text-[10px]`) |
| `RaadsinformatieDetailEnriched.tsx` | LOW | Type count pills use `px-2 py-0.5` while §5 specifies `px-1.5 py-0.5` for neutral type pills; `font-medium text-slate-500` adds a font-weight not in contract |
| `BekendmakingenDetailEnriched.tsx` | UNKNOWN | Spot-check clean (14 contract-component references, no forbidden colors, correct wrapper). Full §14 checklist audit not yet done. |
| `VergunningKlimaatDetailEnriched.tsx` | UNKNOWN | Spot-check clean (14 contract-component references, no forbidden colors, correct wrapper). Full §14 checklist audit not yet done. |

The plan addresses HIGH severity first (Tasks 1–2), then LOW polish (Tasks 3–4), then completes the audit for the two UNKNOWN files with concrete fix tasks appended only if violations are found (Tasks 5–6). Final verification is a click-through UAT using the test list from M043/S01-UAT.md.

---

## Task 1: Fix BeschermdErfgoedDetailEnriched.tsx

**Files:**
- Modify: `frontend/src/components/configuratie/BeschermdErfgoedDetailEnriched.tsx`

**Why:** 5 contract violations — wrong wrapper spacing, missing font family, custom list item without TimelineRow dot, non-contract type pill, wrong error text color.

- [ ] **Step 1: Grep for violations to confirm baseline**

Run:
```bash
grep -nE "space-y-5|Plus Jakarta|text-slate-400|bg-slate-100 px-2" frontend/src/components/configuratie/BeschermdErfgoedDetailEnriched.tsx
```
Expected: lines 80 (`space-y-5`), 63 (`text-slate-400` in error), 32 (`bg-slate-100 px-2`). No `Plus Jakarta` match.

- [ ] **Step 2: Replace the `GezichtItem` component with §6 TimelineRow pattern**

Replace the entire `GezichtItem` function (lines 25–52) with:

```tsx
function GezichtItem({
  gezicht,
  idx,
  total,
}: {
  gezicht: BeschermdGezichtResponse
  idx: number
  total: number
}) {
  return (
    <div className="flex gap-3 py-3 border-b border-[#EAEFEF] last:border-b-0">
      <div className="flex flex-col items-center pt-1.5">
        <span className="h-2 w-2 rounded-full bg-aura-amber shrink-0" />
        {idx < total - 1 && <span className="w-px flex-1 bg-[#EAEFEF] mt-1" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold text-[#0E1111] leading-snug line-clamp-2">
          {gezicht.naam}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
          {gezicht.type && (
            <span className="rounded-full border border-[#EAEFEF] bg-[#F8FAFA] px-1.5 py-0.5 text-[10px]">
              {gezicht.type}
            </span>
          )}
          {gezicht.aangewezen && <span>Aangewezen: {gezicht.aangewezen}</span>}
          {gezicht.oppervlakte_ha != null && <span>{gezicht.oppervlakte_ha} ha</span>}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Fix the error state to use `text-red-400`**

Replace line 63:

```tsx
<p className="text-[13px] text-red-400">Fout bij laden van erfgoeddata.</p>
```

- [ ] **Step 4: Fix the main wrapper (space-y-6 + Plus Jakarta) and move `total` into the `badge` prop**

Replace the return block (lines 79–95) with:

```tsx
  return (
    <div className="space-y-6" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <SectionInsightCard
        kicker="Beschermd erfgoed"
        title="Beschermde gezichten"
        badge={`${total}`}
        Icon={Landmark}
      >
        <div className="max-h-[400px] overflow-y-auto">
          {gezichten.map((gezicht, i) => (
            <GezichtItem
              key={`${gezicht.naam}-${i}`}
              gezicht={gezicht}
              idx={i}
              total={gezichten.length}
            />
          ))}
        </div>
      </SectionInsightCard>
    </div>
  )
```

- [ ] **Step 5: Run type-check**

Run:
```bash
cd frontend && npx tsc --noEmit 2>&1 | grep BeschermdErfgoed || echo "clean"
```
Expected: `clean` (no errors mentioning the file).

- [ ] **Step 6: Re-grep for §14 forbidden patterns**

Run:
```bash
grep -nE "(bg|text|border)-(blue|indigo|purple|violet|pink)-|space-y-[1-5]( |\")|bg-slate-100 px-2" frontend/src/components/configuratie/BeschermdErfgoedDetailEnriched.tsx
```
Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/configuratie/BeschermdErfgoedDetailEnriched.tsx
git commit -m "M044/S01: align BeschermdErfgoed with design contract

- Replace GezichtItem with §6 TimelineRow pattern (amber dot + connector)
- Fix wrapper: space-y-6 + Plus Jakarta Sans per §1
- Move total count into badge prop per §3
- Fix type pill to neutral §5 style
- Fix error state to text-red-400 per §10"
```

---

## Task 2: Fix HuisvestingsverordeningDetailEnriched.tsx

**Files:**
- Modify: `frontend/src/components/configuratie/HuisvestingsverordeningDetailEnriched.tsx`

**Why:** 4 contract violations — wrong wrapper spacing, missing font family, **SubCard used at top level** (§2 says SubCard is inner-only), hardcoded amber color instead of semantic token.

- [ ] **Step 1: Grep for violations to confirm baseline**

Run:
```bash
grep -nE "space-y-5|<SubCard>|bg-\[#F9A826\]|Plus Jakarta" frontend/src/components/configuratie/HuisvestingsverordeningDetailEnriched.tsx
```
Expected: lines 44 (`space-y-5`), 80 (`<SubCard>`), 92 (`bg-[#F9A826]`). No `Plus Jakarta` match.

- [ ] **Step 2: Replace the entire return block**

Replace the return block (lines 43–99) with:

```tsx
  return (
    <div className="space-y-6" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <SectionInsightCard
        kicker="Huisvestingsverordening"
        title={data.title ?? 'Actieve verordening'}
        Icon={Home}
      >
        <KVRow label="Kenmerk" value={data.identifier} />
        <KVRow label="Laatst gewijzigd" value={data.modified} />

        {data.subject && (
          <div className="mt-4">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-2">
              Onderwerp
            </p>
            <p className="text-[13px] leading-relaxed text-slate-500">{data.subject}</p>
          </div>
        )}

        {data.url && (
          <div className="mt-4">
            <a
              href={data.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#B07D18] hover:underline"
            >
              Bekijk volledige verordening
              <ExternalLink size={14} />
            </a>
          </div>
        )}
      </SectionInsightCard>

      <SectionInsightCard
        kicker="Impact"
        title="Relevant voor vastgoedontwikkeling"
        Icon={ArrowRight}
      >
        <div className="space-y-2">
          {[
            'Regels voor woningvorming, splitsing en kamerverhuur',
            'Vergunningplicht voor onttrekking aan de woningvoorraad',
            'Mogelijke quota voor sociale huur of middenhuur bij nieuwbouw',
            'Opkoopbescherming (zelfbewoningsplicht) in aangewezen wijken',
          ].map((item) => (
            <div key={item} className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-aura-amber shrink-0" />
              <span className="text-[12px] text-slate-500">{item}</span>
            </div>
          ))}
        </div>
      </SectionInsightCard>
    </div>
  )
```

- [ ] **Step 3: Remove unused `SubCard` import**

Update line 8 of the file. Change:
```tsx
import { SectionInsightCard, SubCard, KVRow } from '@/components/reports/components'
```
To:
```tsx
import { SectionInsightCard, KVRow } from '@/components/reports/components'
```

- [ ] **Step 4: Run type-check**

Run:
```bash
cd frontend && npx tsc --noEmit 2>&1 | grep Huisvestingsverordening || echo "clean"
```
Expected: `clean`.

- [ ] **Step 5: Re-grep for §14 forbidden patterns**

Run:
```bash
grep -nE "(bg|text|border)-(blue|indigo|purple|violet|pink)-|space-y-[1-5]( |\")|bg-\[#F9A826\]" frontend/src/components/configuratie/HuisvestingsverordeningDetailEnriched.tsx
```
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/configuratie/HuisvestingsverordeningDetailEnriched.tsx
git commit -m "M044/S01: align Huisvestingsverordening with design contract

- Replace top-level SubCard with second SectionInsightCard per §2
- Fix wrapper: space-y-6 + Plus Jakarta Sans per §1
- Use bg-aura-amber semantic token instead of hardcoded hex
- Remove unused SubCard import"
```

---

## Task 3: Polish JurisprudentieDetailEnriched.tsx

**Files:**
- Modify: `frontend/src/components/configuratie/JurisprudentieDetailEnriched.tsx`

**Why:** Two low-severity polish items — bar lacks motion animation per §9+§13, SemanticPill text size `text-[10px]` should be `text-[11px]` per §5.

- [ ] **Step 1: Grep for both items**

Run:
```bash
grep -nE "text-\[10px\] font-semibold|className=\"\\\$\\{bg\\}" frontend/src/components/configuratie/JurisprudentieDetailEnriched.tsx
```
Expected: line 148 (`text-[10px] font-semibold` in SemanticPill span), line 106 (`<div key={key} className={...}`) for the static bar.

- [ ] **Step 2: Add motion import**

Update line 11–12. Change:
```tsx
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Scale, ExternalLink, Loader2 } from 'lucide-react'
```
To:
```tsx
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowRight, Scale, ExternalLink, Loader2 } from 'lucide-react'
```

- [ ] **Step 3: Replace the static bar segments with motion.div**

Replace lines 102–108 (the bar `div` containing the segment map) with:

```tsx
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
        {WIN_LOSS_SEGMENTS.map(({ key, bg }, i) => {
          const pct = (data[key] / total) * 100
          if (pct === 0) return null
          return (
            <motion.div
              key={key}
              className={bg}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{
                duration: 0.6,
                delay: i * 0.1,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
            />
          )
        })}
      </div>
```

- [ ] **Step 4: Fix SemanticPill text size**

Replace line 148. Change:
```tsx
className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${uitkomstStyle(ruling.uitkomst)}`}
```
To:
```tsx
className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${uitkomstStyle(ruling.uitkomst)}`}
```

- [ ] **Step 5: Run type-check**

Run:
```bash
cd frontend && npx tsc --noEmit 2>&1 | grep Jurisprudentie || echo "clean"
```
Expected: `clean`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/configuratie/JurisprudentieDetailEnriched.tsx
git commit -m "M044/S01: polish Jurisprudentie to match contract §5 + §9

- WinLoss bar: use motion.div with contract's ease curve per §9/§13
- SemanticPill: text-[11px] per §5 (was text-[10px])"
```

---

## Task 4: Polish RaadsinformatieDetailEnriched.tsx

**Files:**
- Modify: `frontend/src/components/configuratie/RaadsinformatieDetailEnriched.tsx`

**Why:** Type count pill has wrong padding + adds font-weight not in contract.

- [ ] **Step 1: Grep to confirm baseline**

Run:
```bash
grep -n "px-2 py-0.5 text-\[10px\] font-medium" frontend/src/components/configuratie/RaadsinformatieDetailEnriched.tsx
```
Expected: line 158.

- [ ] **Step 2: Fix the type count pill classes**

Replace line 158. Change:
```tsx
className="rounded-full border border-[#EAEFEF] bg-[#F8FAFA] px-2 py-0.5 text-[10px] font-medium text-slate-500"
```
To:
```tsx
className="rounded-full border border-[#EAEFEF] bg-[#F8FAFA] px-1.5 py-0.5 text-[10px] text-slate-500"
```

- [ ] **Step 3: Run type-check**

Run:
```bash
cd frontend && npx tsc --noEmit 2>&1 | grep Raadsinformatie || echo "clean"
```
Expected: `clean`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/configuratie/RaadsinformatieDetailEnriched.tsx
git commit -m "M044/S01: polish Raadsinformatie type pills to §5

- Type count pills: px-1.5 (was px-2), drop font-medium"
```

---

## Task 5: Full §14 audit of BekendmakingenDetailEnriched.tsx

**Files:**
- Read only: `frontend/src/components/configuratie/BekendmakingenDetailEnriched.tsx`
- Write: `docs/superpowers/plans/2026-04-08-m044-s01-bekendmakingen-audit.md`

**Why:** Spot-checks look clean, but a full §14 checklist pass is required before we can claim S01 done. If violations are found, append concrete fix tasks to the plan.

- [ ] **Step 1: Read the full file**

```bash
wc -l frontend/src/components/configuratie/BekendmakingenDetailEnriched.tsx
```
Then read the entire file end-to-end with the Read tool. Don't skim — every className.

- [ ] **Step 2: Run each §14 checklist item as a grep**

Run all ten checks:
```bash
F=frontend/src/components/configuratie/BekendmakingenDetailEnriched.tsx
echo "1. forbidden colors:"; grep -nE "(bg|text|border)-(blue|indigo|purple|violet|pink)-" "$F" || echo "  pass"
echo "2. own MetricCard/StatCell:"; grep -nE "function (MetricCard|StatCell)" "$F" || echo "  pass"
echo "3. own rounded containers (outside components):"; grep -nE "rounded-\[16px\] border border-\[#EAEFEF\]" "$F" || echo "  pass"
echo "4. own loading/error patterns:"; grep -nE "rounded-\[20px\].*Loading|rounded-\[20px\].*Error" "$F" || echo "  pass"
echo "5. space-y-6 wrapper:"; grep -n "space-y-6" "$F" | head -1
echo "6. Plus Jakarta wrapper:"; grep -n "Plus Jakarta" "$F" | head -1
echo "7. forbidden bg-slate-100 px-2 pills:"; grep -nE "bg-slate-100 px-2" "$F" || echo "  pass"
echo "8. wrong font sizes in titles:"; grep -nE "text-\[1[4-9]px\].*font-(bold|semibold)" "$F" || echo "  pass"
```

- [ ] **Step 3: Write audit results document**

Create `docs/superpowers/plans/2026-04-08-m044-s01-bekendmakingen-audit.md` with this exact structure, filling in actual findings:

```markdown
# Bekendmakingen §14 Audit

## Grep results
(paste grep output from Step 2)

## Visual read findings
- [ ] Layout wrapper: ...
- [ ] All SectionInsightCards have correct kicker/title/Icon: ...
- [ ] List items follow §6 TimelineRow: ...
- [ ] KVRow used for key/value: ...
- [ ] SemanticPill used where applicable: ...
- [ ] Loading / empty / error states match §10: ...

## Violations (concrete)
(one bullet per violation with line number + rule reference, or "None")

## Recommendation
- [ ] No fixes needed → mark BekendmakingenDetailEnriched conformant
- [ ] Fixes needed → append Task 5a below with concrete code
```

- [ ] **Step 4: Commit audit**

```bash
git add docs/superpowers/plans/2026-04-08-m044-s01-bekendmakingen-audit.md
git commit -m "M044/S01: audit Bekendmakingen against §14 checklist"
```

- [ ] **Step 5 (conditional): If violations found, implement fixes**

If the audit found violations, follow the same TDD loop as Tasks 1–4: grep to confirm, apply exact code fix, type-check, commit. Use the same commit prefix `M044/S01: fix Bekendmakingen §X violations`. If no violations, skip this step.

---

## Task 6: Full §14 audit of VergunningKlimaatDetailEnriched.tsx

**Files:**
- Read only: `frontend/src/components/configuratie/VergunningKlimaatDetailEnriched.tsx`
- Write: `docs/superpowers/plans/2026-04-08-m044-s01-vergunningklimaat-audit.md`

**Why:** Same reasoning as Task 5 — spot-clean but needs full §14 pass.

- [ ] **Step 1: Read the full file**

```bash
wc -l frontend/src/components/configuratie/VergunningKlimaatDetailEnriched.tsx
```
Then read end-to-end.

- [ ] **Step 2: Run the §14 grep checklist (same as Task 5 Step 2, different file)**

```bash
F=frontend/src/components/configuratie/VergunningKlimaatDetailEnriched.tsx
echo "1. forbidden colors:"; grep -nE "(bg|text|border)-(blue|indigo|purple|violet|pink)-" "$F" || echo "  pass"
echo "2. own MetricCard/StatCell:"; grep -nE "function (MetricCard|StatCell)" "$F" || echo "  pass"
echo "3. own rounded containers:"; grep -nE "rounded-\[16px\] border border-\[#EAEFEF\]" "$F" || echo "  pass"
echo "4. own loading/error patterns:"; grep -nE "rounded-\[20px\].*Loading|rounded-\[20px\].*Error" "$F" || echo "  pass"
echo "5. space-y-6 wrapper:"; grep -n "space-y-6" "$F" | head -1
echo "6. Plus Jakarta wrapper:"; grep -n "Plus Jakarta" "$F" | head -1
echo "7. forbidden bg-slate-100 px-2 pills:"; grep -nE "bg-slate-100 px-2" "$F" || echo "  pass"
echo "8. wrong font sizes in titles:"; grep -nE "text-\[1[4-9]px\].*font-(bold|semibold)" "$F" || echo "  pass"
```

- [ ] **Step 3: Write audit results to `docs/superpowers/plans/2026-04-08-m044-s01-vergunningklimaat-audit.md`**

Same template structure as Task 5 Step 3.

- [ ] **Step 4: Commit audit**

```bash
git add docs/superpowers/plans/2026-04-08-m044-s01-vergunningklimaat-audit.md
git commit -m "M044/S01: audit VergunningKlimaat against §14 checklist"
```

- [ ] **Step 5 (conditional): If violations found, implement fixes**

Same pattern as Task 5 Step 5.

---

## Task 7: Global type-check + lint

**Files:** None modified. Runs project-level checks.

**Why:** Catch any cross-file breakage introduced by the 4 committed fixes before UAT.

- [ ] **Step 1: Run the project validation command**

Run:
```bash
cd frontend && npm run check 2>&1 | tail -30
```
Expected: no TypeScript errors, no ESLint errors, no formatting errors. If anything fails: fix the specific error mentioned, commit as `M044/S01: fix <specific issue>`, rerun.

- [ ] **Step 2: Commit only if fixes were needed**

If Step 1 introduced any fixes, commit them. If it was clean, skip.

---

## Task 8: Manual click-through UAT in Venlo

**Files:** None modified. Manual verification against M043/S01-UAT test list.

**Why:** The whole point of S01 is that clicking through Venlo's 6 live sources shows visually consistent, contract-conform views. Automated grep can't catch rendering bugs.

- [ ] **Step 1: Start the frontend dev server**

Run in a separate terminal (or background):
```bash
cd frontend && npm run dev
```
Wait until `VITE ready` appears. The app will be on port 9300.

- [ ] **Step 2: Navigate to Venlo configuratie**

1. Open `http://localhost:9300` in browser
2. Log in
3. Go to the Configuratie page
4. Select gemeente "Venlo"

- [ ] **Step 3: Verify each of the 6 live sources against M043/S01-UAT expectations**

For each source, click into it and verify:

1. **Vergunning-klimaat**: severity card + metrics + counters + distribution chart all rendered in `SectionInsightCard` containers, no blue/purple colors, Plus Jakarta font.
2. **Jurisprudentie**: win/loss bar animates on mount (§9), rulings feed uses TimelineRow with amber dots, SemanticPill shows toegewezen/afgewezen colors.
3. **Bekendmakingen**: feed with category pills using neutral `bg-[#F8FAFA] border-[#EAEFEF]`, no blue pills.
4. **Raadsinformatie**: stukken count in title, type summary pills (neutral), search input, feed with TimelineRow.
5. **Huisvestingsverordening**: main verordening card with KVRow entries + external link, second card "Impact" with bullet list using amber dots.
6. **Beschermd erfgoed**: title "Beschermde gezichten" with badge showing count, list of gezichten with TimelineRow dots.

For each: if a visual inconsistency appears that wasn't caught by the audit, note it in `docs/superpowers/plans/2026-04-08-m044-s01-uat-findings.md` with screenshot reference, commit the note, and add a fix task to address it before declaring S01 done.

- [ ] **Step 4: Verify no console errors**

Open browser devtools → Console tab. Click through all 6 sources. Expected: no red errors.

- [ ] **Step 5: Write S01 SUMMARY**

Create `~/.gsd/projects/0fbd70b53f1b/milestones/M044/slices/S01/S01-SUMMARY.md` with:

```yaml
---
id: M044/S01
title: "Audit + fix bestaande enriched components"
status: complete
completed_at: <today ISO timestamp>
key_files:
  - frontend/src/components/configuratie/BeschermdErfgoedDetailEnriched.tsx
  - frontend/src/components/configuratie/HuisvestingsverordeningDetailEnriched.tsx
  - frontend/src/components/configuratie/JurisprudentieDetailEnriched.tsx
  - frontend/src/components/configuratie/RaadsinformatieDetailEnriched.tsx
  - frontend/src/components/configuratie/BekendmakingenDetailEnriched.tsx
  - frontend/src/components/configuratie/VergunningKlimaatDetailEnriched.tsx
lessons_learned:
  - Audit-driven refactor works when there's a single source of truth (CONFIGURATIE-DESIGN-CONTRACT.md)
  - Grep for §14 forbidden patterns catches most violations; the rest need visual inspection
---

# S01 Summary

(Fill in: which files had HIGH vs LOW violations, whether audit of Bekendmakingen/VergunningKlimaat found anything, UAT outcome)
```

- [ ] **Step 6: Invoke superpowers:verification-before-completion**

Before claiming S01 done, invoke the `superpowers:verification-before-completion` skill. It will demand evidence: the grep outputs, the type-check result, the click-through notes. Only after it passes can S01 be marked complete.

- [ ] **Step 7: Update GSD root STATE.md**

After verification passes, update `~/.gsd/projects/0fbd70b53f1b/STATE.md`:
- Active Slice: `S02: Document source basis view — gedeeld component voor alle 22 roadmap sources`
- Phase: `ready-to-plan`
- Next Action: `Plan M044/S02 — gedeelde document source basis view`

- [ ] **Step 8: Final commit**

```bash
git add docs/superpowers/plans/2026-04-08-m044-s01-uat-findings.md 2>/dev/null || true
git commit --allow-empty -m "M044/S01: complete — 6 enriched components aligned with design contract"
```

---

## Self-review

**Spec coverage:** Every live gemeente source from M044-ROADMAP S01 ("Klik door Jurisprudentie, Bekendmakingen, VergunningKlimaat, Raadsinformatie, Huisvestingsverordening en BeschermdErfgoed in Venlo") has a task: 1 (Beschermd), 2 (Huisvestings), 3 (Jurisprudentie), 4 (Raadsinformatie), 5 (Bekendmakingen audit), 6 (VergunningKlimaat audit). Task 8 UAT tests all six.

**Placeholder scan:** Tasks 5 and 6 Step 5 are conditional ("if violations found") — this is NOT a placeholder because the audit output in Step 3 defines exactly which violations exist and the template in Step 5 references the exact fix pattern used in Tasks 1–4. Every code step shows actual code. Every grep command has expected output.

**Type consistency:** `GezichtItem` signature in Task 1 Step 2 matches its usage in Task 1 Step 4. Motion import in Task 3 Step 2 matches usage in Step 3. No inconsistencies.

**One note on "TDD":** This is visual style compliance work — there are no existing visual regression tests in this repo for enriched components, and adding one test framework just for this slice would be scope creep. The compensating verification is (a) grep for §14 forbidden patterns before/after, (b) type-check, (c) manual UAT click-through. The writing-plans skill says "TDD" — in this domain the compliance tests ARE the grep commands in Step 1 of each task. That is the honest interpretation.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-08-m044-s01-audit-fix-enriched-components.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Each subagent gets the task section + the design contract + the relevant source file, runs the steps, commits, and returns. I review the diff before launching the next subagent.

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints for review. Shares my context window, slower iteration but keeps everything visible in one conversation.

Which approach?
