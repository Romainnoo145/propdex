# Design Audit: Parcel Detail Panel vs Gemeente/Wijk Panels — Full Scope

## 1. PARCEL DETAIL SYSTEM (Gold Standard)

### 1.1 Shell (ParcelPanelShell.tsx)
- **Portal**: `createPortal(content, panelPortalRef.current)` — renders into `_authenticated.tsx` flex slot
- **Open signal**: `setPanelOpen(true)` → portal expands to 620px → map shrinks via flex
- **Card styling**: `w-[620px] h-full rounded-[40px] bg-white/60 backdrop-blur-[24px] border border-white/40 shadow-[0_20px_50px_rgba(0,0,0,0.04)]`
- **Close button**: `absolute top-8 right-8 z-10`, `h-8 w-8`, `X h-4 w-4`, `text-aura-obsidian hover:text-aura-obsidian/60`
- **Header actions**: Optional slot to LEFT of close button (HeartButton uses it)
- **Footer**: Optional `shrink-0 px-8 pb-8 pt-4` sticky footer
- **Escape**: `document.addEventListener('keydown')`
- **Animation**: `opacity: 0, scale: 0.97 → opacity: 1, scale: 1` (respects `prefers-reduced-motion`)
- **Content**: `<div className="flex-1 overflow-y-auto">{children}</div>`

### 1.2 Panel Header (ParcelDetailPanel.tsx)
- Padding: `px-8 pt-8`
- Title: `text-[28px] font-bold tracking-tighter text-slate-900 leading-tight`
- Subtitle: `text-xs text-slate-400 font-medium uppercase tracking-widest`
- Address splits into truncatable street + non-truncatable postcode
- View back button: `h-7 w-7 rounded-full bg-white/60 backdrop-blur-sm hover:bg-white/80`

### 1.3 Category Tabs (CategoryTabs.tsx)
- Container: `h-[48px] rounded-full p-1 bg-[#F2F6F3]`
- Active tab: `bg-[#0E1111]` pill with `layoutId` spring slide, `text-white font-700`
- Inactive: `color: #94a3b8`, `hover:text-slate-600`
- Font: Plus Jakarta Sans, `fontSize: 13px`
- 3 tabs: Potentie, Risico, Dossiers

### 1.4 Bento Overview (ParcelBentoOverview.tsx)
- **Stagger**: `staggerChildren: 0.08`, fadeUp `opacity:0 y:12 → opacity:1 y:0, duration:0.35`
- **Image cards** (3 columns): `rounded-[20px]`, active border `2px solid #F9A826`, inactive `2px solid transparent`
  - Hover: `whileHover={{ scale: 1.02 }}`, `whileTap={{ scale: 0.98 }}`
  - Spring: `type: 'spring', stiffness: 400, damping: 25`
- **CardLabelBar**: `height: 28px`, active bg `#F9A826` white text, inactive bg `#F2F6F3` text `#8A948D`
  - Font: Plus Jakarta Sans, `10px`, weight 800, `letterSpacing: 0.2em`, UPPERCASE
- **Score circle cards**: `rounded-[24px] bg-white border border-[#EAEFEF] p-5`
  - Label: `text-[11px] font-extrabold uppercase`, `letterSpacing: 0.15em`, `color: #94a3b8`
  - Value: `text-5xl font-black tracking-tighter tabular-nums`
  - Chevron indicators: `ChevronUp + ChevronDown -space-y-1 text-slate-200`
- **BeschikbaarCard**: Same rounded-[24px] pattern, amber accent when highlight `rgba(249,168,38,0.08)` bg with `rgba(249,168,38,0.3)` border
- **SecondaryField**: `h-[40px] rounded-[14px] bg-[#F2F6F3]`, `text-[13px] font-semibold text-[#0E1111]`, Search icon on interactive
- **Trust metadata**: `text-[9px] uppercase tracking-wider text-slate-300`

### 1.5 BouwjaarTimeline
- Header: `text-[10px] font-black text-slate-400 uppercase`, `letterSpacing: 0.2em`
- Badge: `bg-black text-white text-[10px] px-2.5 py-1 rounded-full font-black tabular-nums`
- Track: `h-1.5 bg-slate-100 rounded-full`, amber fill `#F9A826`, shadow `0 0 8px rgba(249,168,38,0.3)`
- White markers at start/end edges

### 1.6 Footer Button (ParcelDetailPanel)
- `w-full h-[60px] rounded-full text-[15px] font-bold tracking-tight`
- Primary: `bg-[#0E1111] text-white hover:bg-slate-800`
- Success: `bg-aura-green text-white`
- Active: `active:scale-[0.98]`

### 1.7 Detail Layers (PotentieLayer, RisicoLayer, BronnenLayer)
- **Hero verdict**: `text-7xl font-black tracking-tighter tabular-nums` score, `text-xl font-bold uppercase tracking-wide` verdict label
- **Score bar**: `h-3 rounded-full bg-slate-100` with colored fill
- **Badge circle**: `size-12 rounded-full` with color bg and white icon
- **3×3 Intelligence Grid**: `grid grid-cols-3 gap-1.5 auto-rows-fr`
  - Card: `bg-white border border-slate-100 rounded-[24px] p-6`
  - Label: `text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]`
  - Points badge: `text-green-600 bg-green-50 px-2 py-0.5 rounded-full text-[10px] font-black` (potentie) / `text-red-600 bg-red-50` (risico)
  - Value: `text-2xl font-black text-slate-900 tracking-tighter`
  - Sub: `text-[11px] font-bold text-slate-400`, `border-t border-slate-50 pt-3`
- **Pagination**: `text-[11px] font-bold text-slate-300 uppercase tracking-widest tabular-nums`, chevron buttons `p-1 rounded-full hover:bg-slate-100`
- **BronnenLayer**: Same grid but with DropzoneCards (3 states: empty/ghost dashed, API data/solid, user docs/amber bg)

### 1.8 Modals (ALL parcel modals)
**Pattern**: `createPortal(content, document.body)` — escapes ALL z-context stacking
- **Backdrop**: `fixed inset-0 z-[60] bg-black/50 backdrop-blur-md`
- **Card**: `rounded-[32px] bg-white shadow-2xl`, width `max-w-2xl` or `max-w-5xl`, `max-h-[calc(100vh-80px)]`
- **Header**: `px-8 pt-7 pb-3`
  - Title: `text-[22px] font-black tracking-tight text-[#0E1111]`
  - Subtitle: `text-[13px] text-[#6B7280]`
  - Close: `h-9 w-9 rounded-full bg-[#F2F6F3] text-[#0E1111] hover:bg-[#E8EDEB]`
- **Content**: `px-8 pb-6`, scrollable `flex-1 min-h-0 overflow-y-auto`
- **Footer**: `px-8 pb-6 pt-3 border-t border-[#EAEFEF]`
- **Buttons**: `rounded-full`, primary `bg-[#0E1111] text-white`, outline `border border-[#EAEFEF]`
- **Section bg**: `rounded-[16px] bg-[#F2F6F3]` for data groups, `rounded-[12px] bg-white` for nested items
- **MetricPill**: `rounded-[10px] bg-white px-3 py-2`, label `text-[11px] text-[#94a3b8]`, value `text-[13px] font-bold text-[#0E1111]`
- **Animation**: `opacity:0 y:24 → opacity:1 y:0, duration:0.3, ease:[0.4,0,0.2,1]`

### 1.9 Color Tokens
| Token | Value | Usage |
|-------|-------|-------|
| Ink | `#0E1111` | All primary text, dark buttons |
| Muted label | `#94a3b8` | Section labels, secondary icons |
| Secondary text | `#6B7280` | Descriptions, subtitles |
| Light bg | `#F2F6F3` | Inactive tabs, card backgrounds, close buttons |
| Light bg hover | `#E8EDEB` | Hover on `#F2F6F3` elements |
| Border | `#EAEFEF` | Card borders, dividers |
| Amber | `#F9A826` | Active states, score, accents |
| Green | `#22C55E` | Potentie, positive states |
| Red | `#EF4444` | Risico, negative states |
| Track bg | `#f1f5f9` (slate-100) | Progress track, ring bg |
| Deep purple | `#8b5cf6` | Category accent |
| Blue | `#3b82f6` | Category accent |

---

## 2. CURRENT GEMEENTE/WIJK PANELS — ISSUES

### 2.1 LeftPanelShell.tsx
- ✅ Portal-based (fixed this session)
- ✅ 620px width (fixed this session)
- ✅ Same glass card styling
- ❌ **No headerActions slot** — ParcelPanelShell has one
- ❌ **No footer slot** — ParcelPanelShell has one
- ❌ **Close button not in shell** — each panel adds its own, inconsistent placement
- ❌ **No prefersReducedMotion check** — ParcelPanelShell has it

### 2.2 GemeenteContextPanel.tsx
- ❌ Has its OWN close button `absolute top-8 right-8` — should be in shell
- ❌ Cards use `aspect-[5/4]` but NOT `CardLabelBar` with 28px bar and active color — should match bento exactly
- ❌ Stats badges use `bg-black text-white` and `bg-emerald-500 text-white` — BouwjaarTimeline style is `bg-black text-white text-[10px] px-2.5 py-1 rounded-full font-black tabular-nums` which matches, but the green badge style doesn't exist in the parcel panel
- ❌ Wijk list items use `rounded-[14px] bg-[#F2F6F3]` grid — NOT a bad pattern but the items are too simple. Parcel panel's SecondaryField is `h-[40px]` with search icon — similar but wijk items need chevron + status icon
- ❌ No CategoryTabs-like navigation for the card sections
- ❌ Trust metadata placement is correct but font might not use fontFamily inline

### 2.3 WijkMapPanel.tsx
- ❌ Has its OWN close button — should be in shell
- ❌ Scan card uses `rounded-[20px] border border-[#EAEFEF] bg-white p-5` — correct tokens but:
  - Label `text-[10px] font-extrabold uppercase` — correct
  - Value `text-[14px] font-bold` — parcel uses `text-5xl font-black` for big numbers. Scan date/count are smaller values so `text-[14px]` is reasonable, but the icon containers use `rounded-[14px]` instead of parcel's `rounded-[14px]` (matches)
- ❌ CTA `h-[52px]` — parcel footer is `h-[60px]`. Should match.
- ❌ No footer slot integration — CTA is inside content, not in shell footer

### 2.4 GemeenteModal.tsx (shared shell)
- ❌ **NOT using `createPortal(document.body)`** — renders inline, BEHIND the panel z-context. THIS IS THE MODAL-BEHIND-PANEL BUG.
- ❌ Card: `rounded-2xl` → should be `rounded-[32px]`
- ❌ Header: `text-lg font-semibold text-aura-ink` → should be `text-[22px] font-black tracking-tight text-[#0E1111]`
- ❌ Close: `h-8 w-8 rounded-full text-neutral-500` → should be `h-9 w-9 rounded-full bg-[#F2F6F3] text-[#0E1111]`
- ❌ Divider: `border-neutral-200` → should be `border-[#EAEFEF]`
- ❌ Content: `p-6` → should be `px-8 pb-6`
- ❌ Backdrop: `bg-black/40 backdrop-blur-sm` → should be `bg-black/50 backdrop-blur-md`
- ❌ z-index: `z-[1000]` — correct in theory but useless because it's NOT portaled to body
- ❌ No footer slot
- ❌ Animation: `scale: 0.95, y: 10` → parcel uses `y: 24` only

### 2.5 DemografieModal.tsx (content)
- ❌ StatCard: `rounded-xl border-neutral-200 bg-neutral-50` → should be `rounded-[20px] border border-[#EAEFEF] bg-white`
- ❌ StatCard value: `text-xl font-semibold text-aura-ink` → should be `text-5xl font-black tracking-tighter tabular-nums` (or at least `text-2xl font-black`)
- ❌ StatCard label: `text-xs text-neutral-500` → should be `text-[11px] font-extrabold uppercase tracking-[0.15em] text-[#94a3b8]`
- ❌ StatCard icon: `text-aura-amber` → should use specific color per stat type
- ❌ AgeBar: `bg-aura-amber/60` → should be solid `#F9A826`
- ❌ AgeBar label: `text-xs text-neutral-600` → should be `text-[10px] font-black uppercase`
- ❌ Section title: `text-sm font-semibold text-neutral-700` → should be `text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]`
- ❌ MiniStat: `rounded-lg border-neutral-200 bg-neutral-50` → should be `rounded-[14px] bg-[#F2F6F3]`
- ❌ MiniStat label: `text-xs text-neutral-500` → should be `text-[11px] text-[#94a3b8]`
- ❌ MiniStat value: `text-sm font-semibold text-aura-ink` → should be `text-[13px] font-bold text-[#0E1111]`
- ❌ Footer text: `text-xs text-neutral-400` → should be `text-[10px] text-[#94a3b8]`

### 2.6 JuridischKlimaatModal.tsx
- Only 20 lines, likely just wraps GemeenteModal → same GemeenteModal issues

### 2.7 MeldingenModal.tsx
- 263 lines with content → same GemeenteModal shell issues
- Content styling likely uses old neutral-* tokens

### 2.8 WijkenModal.tsx
- 134 lines → same GemeenteModal shell issues

### 2.9 Toggle Behavior Issues
- ❌ Gemeente → Perceel: `exitGemeenteMode()` now closes panel (fixed this session) BUT gemeente boundaries still showing on the map (user reported)
- ❌ Perceel → Gemeente: Now clears parcel panel (fixed this session), zooms to NL overview
- ❌ Gemeente zoom padding: Changed to `left: 680` (fixed this session) but needs verification

### 2.10 Layout Issues
- ❌ Sidebar `w-[130px]` with `pl-8` change not reflecting — user reports no change visible
- ❌ Content area `ml-[130px]` updated but may not be picked up by Vite HMR

---

## 3. FIX PLAN — MILESTONE SCOPE

### Slice 1: Unify LeftPanelShell with ParcelPanelShell
1. Add `headerActions` prop to LeftPanelShell
2. Add `footer` prop to LeftPanelShell  
3. Move close button INTO shell (absolute top-8 right-8, matching ParcelPanelShell exactly)
4. Add `prefersReducedMotion` check
5. Remove close buttons from GemeenteContextPanel and WijkMapPanel
6. Move WijkMapPanel CTA to footer slot

### Slice 2: Redesign GemeenteContextPanel
1. Exact `px-8 pt-8` padding, `text-[28px] font-bold tracking-tighter text-slate-900` header
2. Black pill badge for wijk count (BouwjaarTimeline style)
3. Bento summary cards: `rounded-[20px]`, `2px solid` active border, `CardLabelBar` with category color, `whileHover/Tap` spring, `aspect-[5/6]` or similar
4. Wijk list in `grid grid-cols-2 gap-1.5` with `rounded-[14px] bg-[#F2F6F3]` items
5. Trust metadata: `text-[9px] uppercase tracking-wider text-slate-300`

### Slice 3: Redesign WijkMapPanel
1. Same header treatment
2. Scan card: `rounded-[20px] bg-white border border-[#EAEFEF] p-5`
3. Labels: `text-[10px] font-extrabold uppercase tracking-[0.15em]`
4. CTA in footer slot: `h-[60px] rounded-full bg-[#0E1111]` (exact parcel footer match)
5. CBS section: `text-[10px] font-black uppercase tracking-[0.2em]` header

### Slice 4: Fix GemeenteModal shell (CRITICAL — modal behind panel bug)
1. Convert to `createPortal(content, document.body)` 
2. `z-[60]` (matching parcel modals)
3. Card: `rounded-[32px] bg-white shadow-2xl`
4. Backdrop: `bg-black/50 backdrop-blur-md`
5. Header: `px-8 pt-7 pb-3`, `text-[22px] font-black tracking-tight text-[#0E1111]`
6. Close: `h-9 w-9 rounded-full bg-[#F2F6F3]`
7. Content: `px-8 pb-6`
8. Footer: `px-8 pb-6 pt-3 border-t border-[#EAEFEF]`
9. Animation: `y: 24` only, `duration: 0.3`

### Slice 5: Redesign DemografieModal content
1. StatCard → `rounded-[20px] border border-[#EAEFEF] bg-white`, value `text-2xl font-black`, label `text-[11px] font-extrabold uppercase`
2. AgeBar → `#F9A826` fill on `bg-slate-100` track, `text-[10px] font-black` labels
3. Section → `text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]`
4. MiniStat → `rounded-[14px] bg-[#F2F6F3]`, value `text-[13px] font-bold text-[#0E1111]`

### Slice 6: Redesign JuridischKlimaatModal, MeldingenModal, WijkenModal content
Same token migration as Slice 5

### Slice 7: Fix toggle behavior + sidebar + zoom
1. Verify gemeente boundaries hide on Perceel toggle
2. Sidebar centering fix (verify HMR picks up changes)
3. Gemeente zoom padding verification with 620px panel
4. Map resize during left panel transitions
