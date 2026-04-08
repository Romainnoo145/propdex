# M044/S03 — Provincie + Landelijk Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the 14 currently-unreachable document sources (8 provincie + 6 landelijk document) into the S02-built shared `DocumentSourceDetailView` shell so clicking any tile opens a full contract-conform detail workspace.

**Architecture:** Routing + dispatch wiring only. 1 file touched (`beleid.tsx`), ~50 net lines added. Leverages the discovery that `entityType`/`entityCode` already flow through `EntityDetail → CategoryTabbedSources → DataSourceCard` for both gemeente and provincie — the spec's initial plan to add a `provincieCode` prop is unnecessary. Only `LandelijkContent` needs its entity props wired up.

**Tech Stack:** React 19, TypeScript strict, TanStack Router file-based routing, `framer-motion`, existing `DocumentSourceDetailView` shell from S02, existing `useProvincieGeoJSON` hook.

**Spec reference:** `docs/superpowers/specs/2026-04-08-m044-s03-provincie-landelijk-routing-design.md`

---

## Simplification note (from brainstorm exploration)

The spec at §5.1 proposes a new `provincieCode?: string` prop on `DataSourceCard`. During plan writing, deeper code exploration revealed that `entityType` and `entityCode` already flow through `EntityDetail → CategoryTabbedSources → DataSourceCard` for BOTH gemeente and provincie (verified at `beleid.tsx:1064-1070` and `beleid.tsx:1231-1242`). `DataSourceCard.handleDrop` and `usePolicyDocuments` already use these props correctly.

**Actual architecture:**
- **Provincie drag-drop upload already works** — the entity props are wired
- **Provincie click routing is broken** — `handleCardClick` only reads `gemeenteCode`
- **Landelijk drag-drop + click both broken** — `LandelijkContent` doesn't pass `entityType`/`entityCode` at all
- **No new DataSourceCard prop needed** — use the existing `entityType`/`entityCode` props for the provincie branch

This plan implements the simpler path. The spec section 5.1 and 5.3 (`provincieCode` prop + ProvincieDetail wiring) are superseded by this plan — the spec will be updated post-execution to match reality.

---

## File map

One file: `frontend/src/routes/_authenticated/beleid.tsx`

Change surfaces (all in this file):
1. `LandelijkContent` function (line ~1587): add entityType/entityCode props to CategoryTabbedSources call
2. `DataSourceCard.handleCardClick` (line ~792-809): add provincie branch reading `entityType === 'provincie'`
3. New function `ProvincieSourceDetailWorkspace` (inserted after `SourceDetailWorkspace`, ~line 1790)
4. `LandelijkSourceDetail` default case (line ~1863): replace stub with `<DocumentSourceDetailView entityType="landelijk" entityCode="NL" sourceKey={sourceKey} />`
5. Main route dispatch (line ~1932): insert `activeProvincie && activeSource` branch; tighten landelijk condition

---

## Task 1: Fix LandelijkContent entity prop wiring

**Files:**
- Modify: `frontend/src/routes/_authenticated/beleid.tsx` at line ~1587-1588

**Why:** `LandelijkContent` calls `CategoryTabbedSources` without `entityType` or `entityCode`, so `DataSourceCard` receives undefined for both. This breaks drag-drop upload, document fetching (`usePolicyDocuments` gets empty strings), and the upcoming click routing. Fix by passing the landelijk conventions (`"landelijk"` + `"NL"`).

- [ ] **Step 1: Verify current state**

```bash
grep -nA 2 "^function LandelijkContent" frontend/src/routes/_authenticated/beleid.tsx
```
Expected: shows the 2-line function currently returning `<CategoryTabbedSources sources={LANDELIJK_DATA_SOURCES} />` with no entity props.

- [ ] **Step 2: Update the function body**

Replace the function body. Use Edit with:

Old string:
```tsx
function LandelijkContent() {
  return <CategoryTabbedSources sources={LANDELIJK_DATA_SOURCES} />;
}
```

New string:
```tsx
function LandelijkContent() {
  return (
    <CategoryTabbedSources
      sources={LANDELIJK_DATA_SOURCES}
      entityType="landelijk"
      entityCode="NL"
    />
  );
}
```

- [ ] **Step 3: Type-check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep "beleid.tsx" || echo "clean"
```
Expected: `clean`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/routes/_authenticated/beleid.tsx
git commit -m "M044/S03: wire landelijk entity props through LandelijkContent

LandelijkContent did not pass entityType or entityCode to
CategoryTabbedSources, so DataSourceCard received undefined for both.
This broke drag-drop upload, document fetching, and (implicitly) any
future click routing for landelijk document sources.

Now passes entityType='landelijk' and entityCode='NL' (the landelijk
entityCode convention established in the S02 design spec)."
```

---

## Task 2: Update DataSourceCard.handleCardClick with provincie + landelijk branches

**Files:**
- Modify: `frontend/src/routes/_authenticated/beleid.tsx` at line ~792-809

**Why:** Current `handleCardClick` has only 2 branches: `gemeenteCode` or `source.status === 'live'`. This leaves provincie tiles dead and landelijk document tiles (non-live status) dead. Expand to 3 branches using the already-flowing `entityType`/`entityCode` props for provincie, and remove the `"live"` check so all landelijk sources click through.

- [ ] **Step 1: Locate the current implementation**

```bash
grep -n "handleCardClick" frontend/src/routes/_authenticated/beleid.tsx
```
Expected: shows the function declaration around line 792 and the onClick binding around line 819.

- [ ] **Step 2: Replace the full handleCardClick body**

Find the current:

```tsx
  const handleCardClick = useCallback(() => {
    if (gemeenteCode) {
      navigate({
        to: "/beleid",
        search: {
          gemeente: gemeenteCode,
          source: source.key,
          category: source.category,
        },
      });
    } else if (!gemeenteCode && source.status === "live") {
      // Landelijk sources: navigate without gemeente param
      navigate({
        to: "/beleid",
        search: { source: source.key, category: source.category },
      });
    }
  }, [gemeenteCode, navigate, source.key]);
```

Replace with:

```tsx
  const handleCardClick = useCallback(() => {
    if (gemeenteCode) {
      navigate({
        to: "/beleid",
        search: {
          gemeente: gemeenteCode,
          source: source.key,
          category: source.category,
        },
      });
    } else if (entityType === "provincie" && entityCode) {
      navigate({
        to: "/beleid",
        search: {
          provincie: entityCode,
          source: source.key,
          category: source.category,
        },
      });
    } else {
      // Landelijk — no gemeente, no provincie. All sources click through,
      // including document sources (no status check).
      navigate({
        to: "/beleid",
        search: { source: source.key, category: source.category },
      });
    }
  }, [gemeenteCode, entityType, entityCode, navigate, source.key, source.category]);
```

**Changes:**
- Old `else if` checks `source.status === "live"` → dropped; all landelijk sources now route
- New `else if` branch for `entityType === "provincie" && entityCode` using the already-flowing props
- useCallback dependency array updated: added `entityType`, `entityCode`, `source.category`; removed the implicit `source.status` dependency (it was never in the deps anyway, that's a pre-existing bug that becomes moot)

- [ ] **Step 3: Type-check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep "beleid.tsx" || echo "clean"
```
Expected: `clean`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/routes/_authenticated/beleid.tsx
git commit -m "M044/S03: add provincie + landelijk-document branches to handleCardClick

Previously DataSourceCard only navigated for gemeente tiles or
landelijk 'live' sources. This left all 8 provincie tiles and 6
landelijk document tiles dead on click.

Now:
- gemeente branch unchanged
- provincie branch reads existing entityType/entityCode props
  (already wired via CategoryTabbedSources from EntityDetail)
- landelijk branch drops the source.status === 'live' check so
  document sources also navigate to their detail view

Task 1 wired LandelijkContent to pass entityType='landelijk',
entityCode='NL'. Together these two fixes make all 24 document
sources reachable from the UI (pending main route dispatch in Task 5)."
```

---

## Task 3: Add ProvincieSourceDetailWorkspace function

**Files:**
- Modify: `frontend/src/routes/_authenticated/beleid.tsx` — insert new function directly after `SourceDetailWorkspace` (around line 1790, before `LandelijkSourceDetail`)

**Why:** Currently the main route has no dispatcher for `activeProvincie && activeSource`. This task adds a standalone workspace function that, unlike `SourceDetailWorkspace` for gemeente, has no enriched cases — all provincie sources are document-based, so it always renders `DocumentSourceDetailView` with `entityType="provincie"`.

- [ ] **Step 1: Find the insertion point**

```bash
grep -n "^function SourceDetailWorkspace\|^function LandelijkSourceDetail" frontend/src/routes/_authenticated/beleid.tsx
```
Expected: shows the line numbers of both functions. Insert the new function between them (after the closing `}` of `SourceDetailWorkspace`, before `/* ─── ...  ─── */` comment marking `LandelijkSourceDetail`).

- [ ] **Step 2: Verify useProvincieGeoJSON is already imported**

```bash
grep -n "useProvincieGeoJSON" frontend/src/routes/_authenticated/beleid.tsx
```
Expected: at least 1 import hit and 1 usage hit (around line 1901 in main route dispatch). Already in scope.

- [ ] **Step 3: Insert the new function**

Add the full function verbatim after the closing `}` of `SourceDetailWorkspace`:

```tsx
/* ─── Provincie source detail workspace ────────────────────── */

function ProvincieSourceDetailWorkspace({
  sourceKey,
  provincieCode,
  onBack,
}: {
  sourceKey: string;
  provincieCode: string;
  onBack: () => void;
}) {
  const source = PROVINCIE_DATA_SOURCES.find((s) => s.key === sourceKey);

  // Resolve provincie naam from geojson for breadcrumb consistency
  // with the gemeente workspace's "Terug naar Venlo" pattern.
  const { data: provincieGeoJSON } = useProvincieGeoJSON(true);
  const provincieNaam = useMemo(() => {
    if (!provincieGeoJSON) return null;
    const feature = provincieGeoJSON.features.find(
      (f) =>
        String((f.properties as Record<string, unknown>)?.statcode ?? "") ===
        provincieCode,
    );
    return feature
      ? String(
          (feature.properties as Record<string, unknown>)?.statnaam ??
            provincieCode,
        )
      : provincieCode;
  }, [provincieGeoJSON, provincieCode]);

  if (!source) {
    return (
      <div className="space-y-6">
        <motion.button
          variants={fadeUp}
          initial="hidden"
          animate="show"
          onClick={onBack}
          className="flex items-center gap-2 text-[13px] font-semibold text-slate-500 transition-colors hover:text-[#0E1111]"
        >
          <ArrowLeft size={14} />
          Terug naar {provincieNaam ?? "provincie"}
        </motion.button>
        <div className="rounded-[20px] border border-[#EAEFEF] bg-white p-8 text-center">
          <p className="text-[13px] text-slate-400">
            Databron &ldquo;{sourceKey}&rdquo; niet gevonden.
          </p>
        </div>
      </div>
    );
  }

  const Icon = source.icon;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <motion.button
        variants={fadeUp}
        initial="hidden"
        animate="show"
        onClick={onBack}
        className="flex items-center gap-2 text-[13px] font-semibold text-slate-500 transition-colors hover:text-[#0E1111]"
      >
        <ArrowLeft size={14} />
        Terug naar {provincieNaam ?? "provincie"}
      </motion.button>

      {/* Source heading — mirrors gemeente SourceDetailWorkspace */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="flex items-center gap-4"
      >
        <div className="flex size-14 items-center justify-center rounded-full bg-[#0E1111]">
          <Icon className="size-7 text-[#F9A826]" strokeWidth={2} />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            Databron · {source.category}
          </p>
          <h1 className="text-[28px] font-black leading-none tracking-tight text-[#0E1111]">
            {source.label}
          </h1>
          <p className="mt-1 text-[12px] text-slate-500">{source.description}</p>
        </div>
      </motion.div>

      {/* Always the shared shell — no enriched cases at provincie level */}
      <motion.div variants={fadeUp} initial="hidden" animate="show">
        <DocumentSourceDetailView
          entityType="provincie"
          entityCode={provincieCode}
          sourceKey={sourceKey}
        />
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 4: Type-check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep "beleid.tsx" || echo "clean"
```
Expected: `clean`. If a missing import is flagged, verify `useMemo`, `useProvincieGeoJSON`, `ArrowLeft`, `fadeUp`, `motion`, `PROVINCIE_DATA_SOURCES`, `DocumentSourceDetailView` are all already in scope (they should be — all are used elsewhere in the file).

- [ ] **Step 5: §14 grep sanity check**

```bash
grep -nA 100 "^function ProvincieSourceDetailWorkspace" frontend/src/routes/_authenticated/beleid.tsx | grep -nE "(bg|text|border)-(blue|indigo|purple|violet|pink)-" || echo "no forbidden colors"
```
Expected: `no forbidden colors`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/routes/_authenticated/beleid.tsx
git commit -m "M044/S03: add ProvincieSourceDetailWorkspace function

New inline function mirroring SourceDetailWorkspace's shape (breadcrumb
+ source heading + body) but without the gemeente enriched switch —
all 8 provincie sources are document-based and always render through
DocumentSourceDetailView with entityType='provincie'.

Breadcrumb resolves provincie name from useProvincieGeoJSON (already
in scope) for consistency with the gemeente 'Terug naar Venlo' pattern.

Not yet wired into the main route dispatch — that lands in Task 5."
```

---

## Task 4: Upgrade LandelijkSourceDetail default case

**Files:**
- Modify: `frontend/src/routes/_authenticated/beleid.tsx` at `LandelijkSourceDetail` default switch case (around line 1863)

**Why:** Currently landelijk document sources fall into a stub default case that only renders `SourceGuidanceCard` + a flat description paragraph inside a custom rounded container. No upload, no document list, no AI summary. Replace with the shared shell to unlock the full flow.

- [ ] **Step 1: Find the default case**

```bash
grep -n "function LandelijkSourceDetail\|renderLandelijkDetail\|default:" frontend/src/routes/_authenticated/beleid.tsx | head -20
```
Expected: shows the function start and the default case inside `renderLandelijkDetail`.

- [ ] **Step 2: Read the current default case**

Use the Read tool to read lines around the default case to confirm the exact current JSX. The current block is approximately:

```tsx
      default:
        return (
          <div className="space-y-4">
            <SourceGuidanceCard sourceKey={sourceKey} />
            <div className="rounded-[16px] border border-[#EAEFEF] bg-white p-6">
              <p className="text-[13px] text-slate-500">{source.description}</p>
            </div>
          </div>
        );
```

- [ ] **Step 3: Replace the default case with the shared shell**

Use Edit with old_string matching the current block exactly (including the `default:` label and the closing `);`). New string:

```tsx
      default:
        return (
          <DocumentSourceDetailView
            entityType="landelijk"
            entityCode="NL"
            sourceKey={sourceKey}
          />
        );
```

Note: the shell renders its own `SourceGuidanceCard` as its first child, so the old stub's guidance card is not lost — just moved inside the shell.

- [ ] **Step 4: Type-check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep "beleid.tsx" || echo "clean"
```
Expected: `clean`.

- [ ] **Step 5: Verify SourceGuidanceCard may become unused in beleid.tsx**

```bash
grep -n "SourceGuidanceCard" frontend/src/routes/_authenticated/beleid.tsx
```
If the ONLY remaining matches are the import line, `SourceGuidanceCard` is now unused and should be removed from imports. If there is another usage (e.g. from M044/S02.1 rename context), keep the import.

If unused, remove the import line and re-run tsc.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/routes/_authenticated/beleid.tsx
git commit -m "M044/S03: upgrade LandelijkSourceDetail default case to shared shell

The default case previously rendered a stub (SourceGuidanceCard + a
flat description paragraph inside a custom rounded container) with no
upload, no document list, and no AI summary. Landelijk document sources
(6 of the 8 total — the 2 enriched rvo-subsidies/omgevingswet cases
stay unchanged) had no way to exercise the document workflow.

Replaces the stub with <DocumentSourceDetailView entityType='landelijk'
entityCode='NL' sourceKey={sourceKey} />. The shell itself renders
SourceGuidanceCard as its first child so no guidance is lost, plus
the upload zone (superuser), AI summary card, document list, and
PDFViewerModal all come for free.

RvoSubsidies + Omgevingswet enriched cases stay unchanged — they
belong to S04 scope."
```

---

## Task 5: Main route dispatch — new provincie+source branch + landelijk condition tightening

**Files:**
- Modify: `frontend/src/routes/_authenticated/beleid.tsx` around line 1931-1992

**Why:** Even with `handleCardClick` (Task 2) and `ProvincieSourceDetailWorkspace` (Task 3) in place, clicking a provincie tile with a source key set will hit the `activeProvincie` alone branch (tile grid) first because the dispatch chain has no `activeProvincie && activeSource` check. Add that check before `activeProvincie`. Also tighten the landelijk condition so it only matches when neither gemeente nor provincie is set.

- [ ] **Step 1: Find the dispatch chain**

```bash
grep -n "if (activeGemeente && activeSource\|if (activeGemeente)\|if (activeProvincie\|if (activeSource && !activeGemeente" frontend/src/routes/_authenticated/beleid.tsx
```
Expected: 4 matches in the dispatch chain inside the `configuratie` route component (now renamed `beleid`).

- [ ] **Step 2: Insert the provincie+source branch**

Find this block (the existing gemeente+source branch):

```tsx
  // If source workspace is selected, show full-page source detail
  if (activeGemeente && activeSource) {
    return (
      <ResultsShell>
        <div className="mx-auto max-w-4xl">
          <SourceDetailWorkspace
            sourceKey={activeSource}
            gemeenteCode={activeGemeente}
            onBack={() =>
              navigate({
                to: "/beleid",
                search: { gemeente: activeGemeente, category: activeCategory },
              })
            }
          />
        </div>
      </ResultsShell>
    );
  }
```

Replace with the same block PLUS a new provincie+source block immediately after it:

```tsx
  // If source workspace is selected, show full-page source detail
  if (activeGemeente && activeSource) {
    return (
      <ResultsShell>
        <div className="mx-auto max-w-4xl">
          <SourceDetailWorkspace
            sourceKey={activeSource}
            gemeenteCode={activeGemeente}
            onBack={() =>
              navigate({
                to: "/beleid",
                search: { gemeente: activeGemeente, category: activeCategory },
              })
            }
          />
        </div>
      </ResultsShell>
    );
  }

  // Provincie source workspace — must be checked BEFORE activeProvincie alone
  if (activeProvincie && activeSource) {
    return (
      <ResultsShell>
        <div className="mx-auto max-w-4xl">
          <ProvincieSourceDetailWorkspace
            sourceKey={activeSource}
            provincieCode={activeProvincie}
            onBack={() =>
              navigate({
                to: "/beleid",
                search: { provincie: activeProvincie },
              })
            }
          />
        </div>
      </ResultsShell>
    );
  }
```

- [ ] **Step 3: Tighten the landelijk condition**

Find:

```tsx
  // If landelijk source is selected (no gemeente), show landelijk detail view
  if (activeSource && !activeGemeente) {
```

Replace with:

```tsx
  // If landelijk source is selected (no gemeente, no provincie), show landelijk detail view
  if (activeSource && !activeGemeente && !activeProvincie) {
```

- [ ] **Step 4: Type-check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep "beleid.tsx" || echo "clean"
```
Expected: `clean`.

- [ ] **Step 5: Sanity grep — dispatch chain order**

```bash
grep -n "if (activeGemeente && activeSource\|if (activeProvincie && activeSource\|if (activeGemeente)\|if (activeProvincie)\|if (activeSource && !activeGemeente" frontend/src/routes/_authenticated/beleid.tsx
```
Expected order (line numbers will differ):
1. `if (activeGemeente && activeSource)` — first
2. `if (activeProvincie && activeSource)` — second (NEW)
3. `if (activeGemeente)` — third
4. `if (activeProvincie)` — fourth
5. `if (activeSource && !activeGemeente && !activeProvincie)` — fifth (tightened)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/routes/_authenticated/beleid.tsx
git commit -m "M044/S03: add provincie+source route dispatch + tighten landelijk

New branch: if (activeProvincie && activeSource) routes to
ProvincieSourceDetailWorkspace. Must come BEFORE the activeProvincie
alone branch (same rule as gemeente) otherwise the tile grid would
win over the source detail.

Landelijk condition tightened: was 'activeSource && !activeGemeente',
now 'activeSource && !activeGemeente && !activeProvincie'. Without
this, a URL like /beleid?provincie=PV31&source=X would also satisfy
the landelijk condition if the provincie+source branch didn't catch
it first — defense in depth.

Closes the routing gap for all 14 previously-unreachable document
sources (8 provincie + 6 landelijk document). The 2 landelijk enriched
cases (rvo-subsidies, omgevingswet) are unchanged."
```

---

## Task 6: Global verification pass

**Files:** None modified unless issues are found.

**Why:** Confirm all 5 prior tasks landed cleanly before UAT. Same pattern as S02 Task 8.

- [ ] **Step 1: §14 grep on the full beleid.tsx**

```bash
grep -nE "(bg|text|border)-(blue|indigo|purple|violet|pink)-" frontend/src/routes/_authenticated/beleid.tsx && echo "FAIL" || echo "  ✓ clean"
```
Expected: `  ✓ clean`. If the pre-existing DataSourceCard AI badge (fixed in M044/S02 Task 8 to amber) is still amber, nothing should match here.

- [ ] **Step 2: Prettier check**

```bash
cd frontend && npx prettier --check src/routes/_authenticated/beleid.tsx
```
Expected: `All matched files use Prettier code style!`. If not, run `prettier --write` on the same file and re-check.

- [ ] **Step 3: TypeScript scoped**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep "beleid.tsx" || echo "clean"
```
Expected: `clean`.

- [ ] **Step 4: Full `npm run check` tail**

```bash
cd frontend && npm run check 2>&1 | tail -20
```
Expected: any remaining errors are pre-existing in unrelated files (verkenner.tsx, stories, S4/S6/S8 report sections, routing files) — the same set documented at the end of S01 Task 7 and S02 Task 8. NO errors mentioning beleid.tsx.

- [ ] **Step 5: Verify the new ProvincieSourceDetailWorkspace is reachable**

```bash
grep -n "ProvincieSourceDetailWorkspace" frontend/src/routes/_authenticated/beleid.tsx
```
Expected: 2 matches — 1 function declaration + 1 JSX usage in the dispatch chain.

- [ ] **Step 6: Line count snapshot**

```bash
wc -l frontend/src/routes/_authenticated/beleid.tsx
```
Expected: approximately 2140 (up from 2060 post-S02.1, net +80 lines as predicted). If significantly off, investigate.

- [ ] **Step 7: Commit only if any fixes were needed**

If Steps 1-4 triggered any source edits, commit them with `M044/S03: fix <specific issue>` format. If all passed without changes, skip.

---

## Task 7: Manual UAT + S03 closure

**Files:** Non-code state files only (GSD STATE.md + S03-SUMMARY.md in ~/.gsd/).

**Why:** Same pattern as S01 Task 8 + S02 Task 9. Manual click-through by the user verifies the routing actually works in the browser; `verification-before-completion` skill formalizes the closure with fresh evidence.

- [ ] **Step 1: Ensure dev servers are running**

```bash
lsof -i :8000 -i :9300 2>&1 | grep -E "LISTEN" | head -5
```
If not running, start them:
```bash
cd backend && source .venv/bin/activate && nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload > /tmp/propdex-backend.log 2>&1 &
cd frontend && nohup npm run dev > /tmp/propdex-frontend.log 2>&1 &
```

- [ ] **Step 2: User UAT click-through (4 paths)**

Ask the user to hard-refresh and test all 3 levels:

**Path A — Gemeente regression** (should still work, S01+S02 territory)
1. Open `/beleid`
2. Select Venlo
3. Click Welstandsnota → verify detail view renders (SourceGuidanceCard + DetailEmpty)
4. Back button returns to Venlo tile grid

**Path B — Provincie (NEW)**
1. Open `/beleid`
2. Select a provincie (e.g. Limburg)
3. ProvincieDetail tile grid renders
4. **Click any tile (e.g. Omgevingsverordening)** — verify:
   - URL becomes `/beleid?provincie=PV31&source=omgevingsverordening&category=...`
   - Breadcrumb reads "Terug naar Limburg" (not generic "provincie")
   - Source heading with obsidian+amber icon circle
   - SourceGuidanceCard renders with the source's guidance content
   - DetailEmpty renders for non-admin (or upload zone for admin)
5. Back button returns to Limburg tile grid

**Path C — Landelijk document (NEW)**
1. Open `/beleid`
2. Landelijk tiles are visible inline on the main landing
3. **Click a landelijk document tile (e.g. BENG energieprestatie)** — verify:
   - URL becomes `/beleid?source=beng-energieprestatie&category=...`
   - LandelijkSourceDetail renders with breadcrumb + heading + DocumentSourceDetailView
   - SourceGuidanceCard content shows the BENG guidance
   - DetailEmpty or upload zone renders
4. Back button returns to main landing

**Path D — Landelijk enriched regression**
1. From main landing, click RVO Subsidies
2. Verify the existing RvoSubsidiesDetailEnriched renders (unchanged from S03)
3. Same for Omgevingswet

- [ ] **Step 3: Check browser console**

Open devtools Console tab while clicking through. Expected: zero red errors. Warnings about tailwind arbitrary values or pre-existing React hook deps are acceptable.

- [ ] **Step 4: Write S03-SUMMARY.md**

Create `~/.gsd/projects/0fbd70b53f1b/milestones/M044/slices/S03/S03-SUMMARY.md` following the S02-SUMMARY.md template:

```yaml
---
id: M044/S03
title: "Provincie + landelijk source workspace routing"
status: complete
completed_at: <ISO timestamp>
key_decisions:
  - Minimal additive approach — no new DataSourceCard prop needed, leveraged existing entityType/entityCode flow discovered during plan writing
  - ProvincieSourceDetailWorkspace inline in beleid.tsx (consistent with SourceDetailWorkspace + LandelijkSourceDetail)
  - Landelijk entityCode "NL" convention (from S02 spec)
  - Dropped 'source.status === live' check in handleCardClick so all landelijk sources click through
  - Provincie breadcrumb resolves provincie naam from useProvincieGeoJSON for "Terug naar Limburg" consistency
key_files:
  - frontend/src/routes/_authenticated/beleid.tsx
  - docs/superpowers/specs/2026-04-08-m044-s03-provincie-landelijk-routing-design.md
  - docs/superpowers/plans/2026-04-08-m044-s03-provincie-landelijk-routing.md
lessons_learned:
  - Exploring the existing code before writing the plan (not during) can simplify the plan substantially — the spec had a more invasive prop-addition proposal that turned out to be unnecessary once the entityType/entityCode flow was verified
  - File-based routing + TanStack Router's codegen plugin made the M044/S02.1 rename nearly automatic — manual work was limited to navigate() call strings and sidebar label
  - Routing-only slices are faster to execute than component slices but still benefit from the same subagent+review discipline
---

# M044/S03 — Provincie + Landelijk Routing

## What Happened
(Fill in: task-by-task results, commit SHAs, deviations from plan)

## Success Criteria Results
(Checklist from spec section 6)

## Follow-ups
- None beyond the existing M044 backlog (tasks #11, #12, #13, #24, S04/S05)
```

- [ ] **Step 5: Invoke superpowers:verification-before-completion**

Fresh verification with:
- §14 grep output
- tsc clean output
- prettier clean output
- User UAT confirmation (all 4 paths)
- Line count snapshot

Only claim S03 complete after the skill says the evidence is sufficient.

- [ ] **Step 6: Update GSD STATE.md**

Edit `~/.gsd/projects/0fbd70b53f1b/STATE.md`:

```
**Active Milestone:** M044: Source Detail Views — Design Contract Herziening
**Active Slice:** S04: Remaining live detail views — RVO Subsidies + Omgevingswet audit
**Phase:** ready-to-plan
```

Update the Next Action section to describe starting S04.

- [ ] **Step 7: Final closure commit**

```bash
git commit --allow-empty -m "M044/S03: complete — all 24 document sources now reachable

N commits on branch m044/s03-provincie-landelijk-routing covering:
- LandelijkContent entity prop wiring
- DataSourceCard.handleCardClick 3-branch routing
- ProvincieSourceDetailWorkspace new function
- LandelijkSourceDetail default case stub → shared shell
- Main route dispatch new branch + landelijk condition tightening

Verified: tsc clean, prettier clean, §14 grep clean.
User UAT passed: provincie + landelijk document paths render
DocumentSourceDetailView with proper breadcrumb, heading, guidance.
Gemeente + landelijk enriched regression paths unchanged.

Slice advanced to M044/S04: RvoSubsidiesDetailEnriched +
OmgevingswetDetailEnriched §14 audit + fix."
```

(Replace `N` with the actual commit count when executing.)

---

## Self-Review

**1. Spec coverage:**

Walking through the spec sections:
- §1 Goal — covered by Tasks 1-5 taken together
- §2 Scope in/out — provincie + landelijk document routing all addressed; explicitly out-of-scope items (S04, BeleidscontextCard violets, file splitting) not touched
- §3 Architecture — single file touched as predicted
- §4 Routing Table — Tasks 2 (click) + 5 (dispatch) together deliver all 6 routing states
- §5.1 DataSourceCard props — **simplified**: no new prop needed (see simplification note at plan top). Original spec proposal was more invasive than reality required. Documented for spec post-update.
- §5.2 handleCardClick — Task 2
- §5.3 ProvincieDetail wiring — **not needed**: entityType/entityCode already flow through via CategoryTabbedSources. Task 1 covers the LandelijkContent equivalent gap.
- §5.4 ProvincieSourceDetailWorkspace — Task 3
- §5.5 LandelijkSourceDetail default upgrade — Task 4
- §5.6 Main route dispatch — Task 5
- §6 Success criteria — Task 7 UAT checklist covers all items
- §7 Risks — all 5 risks either mitigated by plan structure or addressed in relevant tasks
- §8 Implementation notes — the "ProvincieDetail inspection" note (§8 first bullet) was resolved during plan writing (no change needed). The drag-drop verification (§8 second bullet) was resolved during exploration (provincie already works, landelijk fixed by Task 1).

Gap: none. Simplifications noted.

**2. Placeholder scan:**

- Task 3 Step 2 says "at least 1 import hit and 1 usage hit" for useProvincieGeoJSON — concrete expectation, not a placeholder
- Task 4 Step 5 has a conditional "If unused, remove the import line" — concrete enough (grep gives deterministic answer)
- Task 7 Step 4 SUMMARY template has `(Fill in: ...)` placeholder sections — acceptable because the closure task's entire purpose is to fill those in after UAT
- No TBDs, no TODOs, no "implement later" markers

**3. Type consistency:**

- `entityType: 'gemeente' | 'provincie' | 'landelijk'` — consistent across Tasks 1, 2, 3, 4, 5
- `entityCode` usage consistent (reads from existing DataSourceCard prop in Task 2, passes literal "NL" in Task 1 + Task 4, passes `provincieCode` in Task 3 + Task 5)
- `PROVINCIE_DATA_SOURCES` referenced in Task 3 — already in scope in beleid.tsx (verified during exploration)
- `DocumentSourceDetailView` prop shape (entityType, entityCode, sourceKey) — consistent across Tasks 3, 4 (and already proven working from S02)
- `ProvincieSourceDetailWorkspace` props interface declared in Task 3 (`sourceKey: string; provincieCode: string; onBack: () => void`) and consumed identically in Task 5 main dispatch

No inconsistencies.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-08-m044-s03-provincie-landelijk-routing.md`. Two execution options:

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, spec + code-quality review between tasks. Same pattern that worked for S01 and S02.

**2. Inline Execution** — Batch execute all 7 tasks in this session using `superpowers:executing-plans`.

S03 is the smallest M044 slice so far (7 tasks vs S01's 11 and S02's 9) and touches only 1 file. Inline is a reasonable choice if context budget is the concern. Subagent-driven is safer.

Which approach?
