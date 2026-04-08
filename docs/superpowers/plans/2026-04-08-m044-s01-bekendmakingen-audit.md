# Bekendmakingen §14 Audit

**Audited file:** `frontend/src/components/configuratie/BekendmakingenDetailEnriched.tsx`
**File length:** 212 lines (from wc -l)
**Audit date:** 2026-04-08

---

## Grep results

```
=== 1. forbidden colors (blue/indigo/purple/violet/pink) ===
  pass

=== 2. own MetricCard/StatCell functions ===
  pass

=== 3. own rounded-[16px] containers outside SubCard/SectionInsightCard ===
  pass

=== 4. space-y-6 on wrapper ===
152:    <div className="space-y-6" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

=== 5. Plus Jakarta on wrapper ===
152:    <div className="space-y-6" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

=== 6. forbidden bg-slate-100 px-2 pills ===
  pass

=== 7. wrong font sizes in titles ===
  pass

=== 8a. error state text color ===
34:      <Loader2 className="size-5 animate-spin text-slate-400" />
35:      <span className="text-[13px] text-slate-400">Data laden…</span>
43:      <p className="text-[13px] text-slate-400">{message ?? 'Geen data beschikbaar.'}</p>
51:      <p className="text-[13px] text-red-400">{error?.message ?? 'Er is een fout opgetreden.'}</p>
96:        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">

=== 9. type pills canonical check ===
99:  <span className="rounded-full border border-[#EAEFEF] bg-[#F8FAFA] px-1.5 py-0.5 text-[10px]">
104: <span className="rounded-full border border-[#EAEFEF] bg-[#F8FAFA] px-1.5 py-0.5 text-[10px]">
  no px-2 variants

=== 10. font-medium on neutral pills ===
  pass

=== 11. all hex colors used ===
bg-[#EAEFEF], bg-[#F8FAFA], border-[#EAEFEF], text-[#0E1111]

=== 12. SemanticPill usage ===
  (not used — no semantic badges in this component; correct for this data type)

=== 13. KVRow usage ===
  (not used — SubCard stat grid used instead; correct pattern)

=== 14. TimelineRow usage ===
  (custom BekendmakingListItem follows §6 pattern; no import of shared TimelineRow)

=== 15. external links pattern ===
13: import { Bell, ExternalLink, Loader2 } from 'lucide-react'
85:   href={record.source_url}
110:   href={record.source_url}
115:   <ExternalLink size={9} />

=== 16. SubCard usage ===
  Used correctly: 3× SubCard in aggregate counters SectionInsightCard

=== 17. SectionInsightCard usage ===
  Used correctly: 2× SectionInsightCards (counters + feed)

=== 18. loading/empty/error state patterns ===
  DetailLoading, DetailEmpty, DetailError all present

=== 19. text-slate- usage ===
  text-slate-400 appears in: loading spinner (correct), loading text (correct),
  empty state text (VIOLATION — see below), meta row (correct), SubCard labels (correct)

=== 20. font-medium usage ===
  pass — no font-medium anywhere
```

---

## Structural read

- **Top-level wrapper:** YES — `space-y-6` + `fontFamily: "'Plus Jakarta Sans', sans-serif"` (line 152)
- **Number of SectionInsightCards:** 2 (aggregate counters + recent feed)
- **List item pattern:** Custom `BekendmakingListItem` (§6 TimelineRow pattern, not a shared import) — structure matches §6 contract exactly
- **SemanticPill usage:** None — not needed for this data type; type pills use canonical neutral `bg-[#F8FAFA]` variant
- **KVRow usage:** None — SubCard stat grid is correct for metric data; no key/value pairs
- **Loading / Empty / Error states:** Mixed — Loading and Error match §10 exactly; Empty deviates (see violations)
- **External links:** Two usage sites: (1) title link matches §6 contract; (2) icon-only link is missing `text-slate-400` (see violations)

---

## Violations (concrete)

### Violation 1 — §10 Empty state: wrong text styling

**Rule:** §10 Empty state — main text must be `text-[13px] font-semibold text-[#0E1111]`, not `text-slate-400`

**File line:** 43

**Current code:**
```tsx
<p className="text-[13px] text-slate-400">{message ?? 'Geen data beschikbaar.'}</p>
```

**Required code (§10 canonical):**
```tsx
<p className="text-[13px] font-semibold text-[#0E1111]">{message ?? 'Geen data beschikbaar.'}</p>
```

**Note:** The §10 spec also shows a secondary `<p className="mx-auto mt-2 max-w-sm text-[12px] text-slate-400">` for a toelichting, but since `DetailEmpty` accepts a `message` prop (used as the primary text), keeping it as a single paragraph is acceptable. The violation is only the color/weight.

---

### Violation 2 — §11 Icon-only external link: missing `text-slate-400`

**Rule:** §11 — Icon-only external links at list items must use `text-slate-400 hover:text-[#0E1111]`

**File line:** 113

**Current code:**
```tsx
className="inline-flex items-center gap-0.5 hover:text-[#0E1111]"
```

**Required code (§11 canonical):**
```tsx
className="inline-flex items-center gap-0.5 text-slate-400 hover:text-[#0E1111]"
```

---

## Recommendation

- [x] Fixes needed — 2 violations:
  1. §10 Empty state text color/weight (`text-slate-400` → `font-semibold text-[#0E1111]`)
  2. §11 Icon-only external link missing `text-slate-400`
