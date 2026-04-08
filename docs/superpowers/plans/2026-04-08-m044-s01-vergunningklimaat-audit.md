# VergunningKlimaat §14 Audit

**Audited file:** `frontend/src/components/configuratie/VergunningKlimaatDetailEnriched.tsx`
**File length:** 116 lines (pre-fix), 122 lines (post-fix)
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
42:    <div className="space-y-6" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

=== 5. Plus Jakarta on wrapper ===
42:    <div className="space-y-6" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

=== 6. forbidden bg-slate-100 px-2 pills ===
  pass

=== 7. wrong font sizes in titles ===
  pass

=== 8. error state text color (pre-fix) ===
18:      <span className="text-[13px] text-slate-400">Data laden…</span>
30:        <p className="text-[13px] text-slate-400">{error ? 'Fout bij laden.' : 'Geen data beschikbaar.'}</p>

=== 9. empty state pattern ===
Line 30 combines error and empty into a single <p className="text-[13px] text-slate-400">
contract requires: empty → font-semibold text-[#0E1111], error → text-red-400

=== 10. canonical type pills (px-1.5 py-0.5 text-[10px]) ===
  none — no type pills used in this component (correct; bar chart used instead)

=== 11. px-2 type pills (non-canonical) ===
  none

=== 12. font-medium on neutral pills ===
  pass

=== 13. icon-only external links (ExternalLink size={9}) ===
  none — this component uses a text link with ArrowRight size={14} (§11 primary link pattern)

=== 14. text-[#B07D18] external links ===
108:          className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#B07D18] hover:underline"
  → matches §11 canonical primary link pattern exactly

=== 15. SectionInsightCard usage ===
44:      <SectionInsightCard

=== 16. SubCard usage ===
83:        <SubCard>   (permit type distribution — top-level sibling of SectionInsightCard)
105:      <SubCard>    (link — top-level sibling of SectionInsightCard)

=== 17. KVRow usage ===
76:        <KVRow label="Bekendmakingen 30d" value={...} />
77:        <KVRow label="Bekendmakingen 90d" value={...} />
78:        <KVRow label="Bekendmakingen 365d" value={...} />
```

---

## Structural read

- **Top-level wrapper:** YES — `space-y-6` + `fontFamily: "'Plus Jakarta Sans', sans-serif"` at line 42
- **Number of SectionInsightCards:** 1 (main severity/metrics card)
- **List item pattern:** Bar chart rows (custom, not TimelineRow) — appropriate for permit type distribution data
- **SemanticPill usage:** None — not needed; severity is shown via inline color dot
- **KVRow usage:** 3× inside SectionInsightCard for bekendmakingen counts — correct
- **Loading / Empty / Error states:** `DetailLoading()` component + inline error/empty returns. Loading matches §10 exactly. Error/empty were combined into one element with wrong classes (VIOLATION — fixed).
- **External links:** One primary text link with `ArrowRight size={14}` — matches §11 canonical primary link pattern exactly
- **SubCard outside SectionInsightCard:** Two top-level SubCards (bar chart, link) — same pattern accepted in other enriched components in this milestone (not flagged as violation)
- **Specific patterns found:** `SEVERITY_COLORS` from `useGemeenteProfile` for inline dot; `StatCell` from shared components for 3-col metrics grid

---

## Violations (concrete)

### Violation 1 — §10 Error/empty state: wrong text styling

**Rule:** §10 — Empty state primary text must be `text-[13px] font-semibold text-[#0E1111]`; error state must be `text-[13px] text-red-400`. Both were collapsed into `text-[13px] text-slate-400`.

**File line (pre-fix):** 27–33

**Current code (pre-fix):**
```tsx
if (error || !profile) {
  return (
    <div className="rounded-[20px] border border-[#EAEFEF] bg-white p-8 text-center">
      <p className="text-[13px] text-slate-400">{error ? 'Fout bij laden.' : 'Geen data beschikbaar.'}</p>
    </div>
  )
}
```

**Required code (§10 canonical):**
```tsx
if (error) {
  return (
    <div className="rounded-[20px] border border-[#EAEFEF] bg-white p-8 text-center">
      <p className="text-[13px] text-red-400">Fout bij laden.</p>
    </div>
  )
}
if (!profile) {
  return (
    <div className="rounded-[20px] border border-[#EAEFEF] bg-white p-8 text-center">
      <p className="text-[13px] font-semibold text-[#0E1111]">Geen data beschikbaar</p>
    </div>
  )
}
```

---

## Recommendation

- [x] Fixes applied:
  1. §10 Error/empty state split and corrected — error now uses `text-red-400`, empty uses `font-semibold text-[#0E1111]`

**Audit doc commit:** see below
**Fix commit:** same commit (single violation, fix applied before committing audit doc)
