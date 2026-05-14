# Phase 7: Factor pinning + groep-pages + 6 cards per page — Research

**Researched:** 2026-04-26
**Domain:** Multi-tenant per-user persistence (FastAPI/SQLAlchemy 2.x/Alembic) + frontend pagination refactor + Storybook play-function tests
**Confidence:** HIGH (every decision verified against current code; CONTEXT.md authoritative)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

1. **FACTOR_REGISTRY metadata (GROUP-01).** Add a **new field** on `FactorRegistryEntry` (preference name `bron`, planner may pick `groep`/`thema`/`subcategory` if it fits convention better). Do **not** rename the existing `category: Literal["potentie", "risico"]`. Type = `Literal["gemeente_beleid", "markt", "fysiek", "klimaat", "juridisch", "planologisch"]`. Metadata-only — zero runtime scoring change. Mapping per-factor (planner finalizes Risico):
   - Potentie (9): `bestemming`/`vergunning_succeskans`/`woonvisie_match` → `gemeente_beleid`; `funda_frictie`/`demografie` → `markt`; `vrije_grond`/`optoppotentie`/`perceelgrootte`/`leegstand` → `fysiek`. (Note: CONTEXT lists `capaciteit` but it is a derived UI card, not a registry entry — see Pitfalls.)
   - Risico (13): `funderingsrisico`/`asbest`/`bodemverontreiniging`/`constructieve_staat`/`max_hoogte_bereikt` → `fysiek`; `geluid`/`luchtkwaliteit`/`overstromingsrisico`/`natura2000` → `klimaat`; `monument`/`juridisch_klimaat` → `juridisch`; `bestemmingswijziging` → `planologisch`; `criminaliteit` → `markt` (or new `sociaal`; planner decides).

2. **Backend `user_factor_pins` model (PIN-02).** SQLAlchemy 2.x `Mapped[]` + `mapped_column()`. Inherit `Base` + `TenantMixin`. Columns: `id` (uuid PK, `gen_random_uuid()` server_default), `user_id` (FK `users.id` CASCADE, indexed), `category` (str, "potentie"/"risico" — the **tab**, NOT the bron-groep), `factor_key` (str), `position` (int, autoincrement on create within `(user_id, category)`), `created_at`. Constraints: `UniqueConstraint("user_id","category","factor_key", name="uq_user_factor_pins_user_cat_key")` + `Index("ix_user_factor_pins_lookup","user_id","category")`.

3. **Alembic migration (PIN-02).** File `y0_m048_s04_create_user_factor_pins.py`. `down_revision = "28d2d029856d"`. Mirror pattern of `x0_m047_s04_create_factor_extraction_cache.py`. No seed data.

4. **REST endpoints (PIN-03).** Locate in **new module** `backend/app/users/factor_pins/` (`router.py` + `schemas.py`) — preference for scope-isolation. Mount under `/api/users/me/factor-pins`:
   - `GET /api/users/me/factor-pins?category={potentie|risico}` → `200 list[FactorPinResponse]`
   - `POST /api/users/me/factor-pins` body `{category, factor_key}` → `201 FactorPinResponse` | `409 Conflict` (duplicate) | `400 {code: "MAX_PINS_REACHED"}` (>6)
   - `DELETE /api/users/me/factor-pins/{pin_id}` → `204 No Content`
   - Auth: `Depends(get_current_user)`. All queries explicitly filter on `organization_id == current_user.organization_id`.

5. **Frontend hook `useFactorPins(category)` (UI-01, PIN-01).** Location `frontend/src/hooks/useFactorPins.ts`. Mirror `useScoreWeights.ts` shape. Query key `["factor-pins", category]`. Returns `{pins, isLoading, toggle, isPinned}`. Optimistic mutation: `onMutate` cancels query + snapshots + mutates cache + returns rollback ctx; `onError` rollbacks; `onSettled` invalidates. Client-side max-6 guard fires `toast("⭐ Max 6 bereikt")` (sonner default variant) **before** POST; server 400 is silent backup.

6. **Page-structuur (GROUP-02).** `CARDS_PER_PAGE = 6` (was 9). Grid `grid-cols-3 grid-rows-2 gap-1.5 auto-rows-fr`. Page 0 = pinned synth-page (title `GEPIND`); 0 pins = top-6 by `|bijdrage|` (title `TOP FACTOREN`); partial = ghost-cells with dashed border + "Pin een factor" affordance. Page 1..N = one page per `bron` group (order: `gemeente_beleid` → `markt` → `fysiek` → `klimaat` → `juridisch` → `planologisch`). Mapping `bron → display label` in `frontend/src/lib/factor-groups.ts`. Pagination footer (chevrons + "1/N") **unchanged** from `PotentieLayer.tsx:452-475`.

7. **⭐ badge consistency (UI-01, PIN-01).** Pinned card always shows `Star filled` (`text-amber-500`) top-right. Unpinned card on group-page reveals `Star outline` (`text-slate-300`) on hover with `transition-opacity 150ms`. Star click `e.stopPropagation()` to not trigger card-body click. Card-body click = primary action (`woonvisie_match` → `WoonvisiePopup`, `eigendom` → `EigendomModal`, others → expand info).

8. **Missing pinned factor handling (PIN-01).** On both pinned-page and group-page: render with `border-dashed border-slate-200`, value `text-slate-300`, sub `"Geen data"`, but **keep** `Star filled` visible. No skip — counts toward 6 slots.

9. **Toast + max-6 guard (PIN-01, UI-01).** `sonner` already wired. Call `toast("⭐ Max 6 bereikt")` (NOT `toast.warning` — keep minimal aesthetic). Default 4s.

10. **Reorderability — no drag (PIN-02).** `position` autoincrements on create. Delete leaves gap (frontend sorts asc — gap rendered as collapsed). Re-pin = `max(existing) + 1`. **No PATCH endpoint, no @dnd-kit dep.**

11. **Tests (TEST-07).** Backend pytest unit + integration; frontend Storybook play-functions (no RTL). Backend covers model+UniqueConstraint, max-6 service-layer, auth-required, multi-tenant isolation, 400 with `code=MAX_PINS_REACHED`, 275-test regression. Frontend: extend `PotentieLayer.stories.tsx` with `PinnedPageEmpty` / `PinnedPagePartial` / `PinnedPageFull` / `PinFlow` / `Max6Guard` / `MissingPinDashedBorder` stories.

### Claude's Discretion

- Exact name of new FACTOR_REGISTRY field (`bron`/`groep`/`thema`/`subcategory`) — voorkeur `bron`
- Exact module-locatie for pin-router — voorkeur new `backend/app/users/factor_pins/`
- Component decomposition (`PinnedPage.tsx` / `GroupPage.tsx` / `FactorCard.tsx` extracts) — design doc suggests; planner may keep inline if simpler
- Storybook mock strategy (`msw` vs inline cache pre-seed) — see Code Examples (precedent: inline pre-seed)
- Star icon animation (Framer Motion vs Tailwind transitions) — Tailwind opacity transition matches existing layer code
- Logging format for max-6 / duplicate / 401
- Exact `FactorPinResponse` JSON shape — minimum `{id, category, factor_key, position, created_at}`

### Deferred Ideas (OUT OF SCOPE)

- Drag-to-reorder pins (M049+, `position` field forward-compatible)
- Pin-share between org-users (eigen feature, separate table)
- Toast "vervang oudste pin" undo-action
- Bulk-pin / preset-pins ("pin alle MARKT in 1 klik")
- i18n of group names (i18n-ready in `lib/factor-groups.ts`, translation = future milestone)
- Mobile layout (desktop-only design)
- Drag-and-drop pin from group-page to pinned-page (use click)
- Smart-pin suggestions (M058+)
- `PATCH /api/users/me/factor-pins/{id}` for position update (creation-order suffices)

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PIN-01 | User pins/unpins factor (max 6 per category); 7e poging → toast "max 6 bereikt" | `sonner` already wired (`frontend/src/main.tsx:5`, `App.tsx:4`); optimistic update pattern via TanStack Query mirror of `useScoreWeights.ts`; hover→star pattern via Tailwind `transition-opacity` consistent with existing card styling |
| PIN-02 | `user_factor_pins` table + Alembic migration; UniqueConstraint `(user_id,category,factor_key)`; TenantMixin | `TenantMixin` confirmed at `backend/app/models/base.py:16-30`; `TimestampMixin` exists `:33-44` (provides `created_at` + `updated_at`); migration head verified `28d2d029856d` (no children); `RefreshToken` model is the closest precedent (`backend/app/models/refresh_token.py`) — uses `Base+TenantMixin+TimestampMixin`, uuid PK with `gen_random_uuid()`, FK to users with CASCADE, `__table_args__` with composite indexes |
| PIN-03 | REST API: list/POST/DELETE under `/api/users/me/factor-pins`; optimistic UI via TanStack Query | `get_current_user` at `backend/app/auth/dependencies.py:19` returns `User` with `.id` and `.organization_id`; `app.users.router` already mounts `/api/users` prefix and has `me/preferences` precedent for "users.me" pattern; existing `useScoreWeights.ts` is the canonical TanStack Query precedent |
| GROUP-01 | Each `FACTOR_REGISTRY` entry has new metadata field for bron-grouping | Registry confirmed at `backend/app/services/score_v3.py:62-238` — 22 entries (9 potentie, 13 risico). `category` already taken (`potentie`/`risico`). Add new field via dataclass `field()` with default; safe — no call-site change since only UI reads it |
| GROUP-02 | `CARDS_PER_PAGE = 6`; page 1 = pinned synth-page; page 2+ = 1 group per page; pinned cards also visible in their group-page with ⭐ | `PotentieLayer.tsx:304` (`CARDS_PER_PAGE = 9`), `:328-332` (`POTENTIE_KEYS`), `:391-449` (animated grid), `:452-475` (pagination footer). `RisicoLayer.tsx:310` (own `CARDS_PER_PAGE = 9`), `:324-328` (`RISICO_KEYS`), `:282-306` (extracted `RisicoCard`). Pagination footer markup is **identical** between layers — extract candidate |
| UI-01 | Hover → pin-icoon top-right; click → optimistic + POST; unpin from both locations syncs | TanStack Query `setQueryData` + invalidation on `onSettled` propagates pinned-state across both renders (pinned-page and group-page) since they read the same `["factor-pins", category]` query |
| TEST-07 | Component tests for pin/unpin, max-6 guard, ⭐ badge, page-nav with pinned synth-page | Storybook Vitest play-functions (verified Phase 3 precedent) — see `WoonvisiePopup.stories.tsx` (msw-free, inline mocks) and `PotentieLayer.stories.tsx` (QueryClientProvider + AuthContext decorator with `setQueryData` cache pre-seed) |

</phase_requirements>

---

## Summary

Phase 7 introduces three coordinated capabilities: a metadata-only registry extension (GROUP-01), per-user persistent pins backed by a new SQLAlchemy 2.x table + Alembic migration (PIN-02/PIN-03), and a refactor of two existing layer components from a flat 9-card grid to a paginated **6-cards × N-pages** model with a synthetic pinned page first (GROUP-02). The codebase already has every precedent needed: `RefreshToken` for the multi-tenant model shape, `useScoreWeights` for the optimistic TanStack Query hook, and `PotentieLayer.stories.tsx` for the Storybook play-function pattern with QueryClient pre-seeded cache.

The Alembic head is verified as `28d2d029856d` (`x0_m047_s04_create_factor_extraction_cache.py`, no children). All eleven success criteria are coverable by automated tests: pytest for backend unit + integration, Storybook play-functions for frontend behaviour. No new dependencies are required — `sonner`, `framer-motion`, `lucide-react`, and `@tanstack/react-query` are all in active use.

**Primary recommendation:** Plan as four (possibly five) waves: Wave 0 = test stubs + factor-groups mapping module; Wave 1 = backend (model + migration + router + tests); Wave 2 = frontend hook + factor-groups consumer; Wave 3 = layer refactor (PotentieLayer first, then mirror to RisicoLayer); Wave 4 = Storybook stories + integration verification. The PotentieLayer + RisicoLayer can either share an extracted `<PaginatedFactorGrid>` component (DRY) or be refactored independently (YAGNI). The CONTEXT signals planner discretion — recommend extracting **only** `FactorCard.tsx` + the page-rendering hook `useGroupedFactorPages(allCards, pins)`, leaving the two layer shells separate (their hero/verdict logic genuinely diverges).

---

## Standard Stack

### Core (already in project — verified)

| Library | Version (pinned in repo) | Purpose | Why Standard |
|---------|--------------------------|---------|--------------|
| FastAPI | (project-pinned) | REST router + auth dependency injection | Existing user-router pattern (`backend/app/users/router.py:36`) |
| SQLAlchemy 2.x | `Mapped[]` + `mapped_column()` | ORM model | Verified in `backend/app/models/base.py` and `refresh_token.py` |
| Alembic | (project-pinned) | DB migration | Verified head: `28d2d029856d` |
| Pydantic v2 | model_validate | Request/response schemas | Project standard |
| TanStack Query v5 | `useQuery` + `useMutation` | Frontend cache + optimistic update | Verified in `useScoreWeights.ts` |
| sonner | (already imported) | Toast for max-6 | `frontend/src/main.tsx:5`, `App.tsx:4`, `EigendomModal.tsx:20` |
| Framer Motion | `AnimatePresence` + `motion.div` | Page transition (already there) | Keep identical to `PotentieLayer.tsx:391-449` |
| lucide-react | `Star`, `ChevronLeft`, `ChevronRight` | Icons | Already imported |
| Storybook 10 + addon-vitest | play-functions on Playwright Chromium | Component tests | Verified Phase 3; tests live in `frontend/src/stories/**/*.stories.tsx` |

### Supporting (already in project — verified)

| Library | Purpose | Use |
|---------|---------|-----|
| pytest + pytest-asyncio | Backend tests | `backend/tests/{unit,integration}/` — 275 tests |
| httpx AsyncClient + ASGITransport | Integration test client | Existing pattern in `tests/integration/` |
| `storybook/test` (NOT `@storybook/test`) | `expect`/`within`/`userEvent`/`waitFor` | Verified `WoonvisiePopup.stories.tsx:13`, `PotentieLayer.stories.tsx:11` (project-locked Phase 2) |

### Alternatives Considered (rejected by CONTEXT)

| Instead of | Could Use | Why Rejected |
|------------|-----------|--------------|
| Backend persistence | localStorage | CONTEXT decided per-user device-portable persistence |
| `useState` page index | URL query param | Out of scope; current pattern works |
| `@dnd-kit` for reorder | n/a | Deferred — `position` is forward-compatible |
| `msw` for API mocks in stories | inline cache pre-seed | Existing precedent uses inline `queryClient.setQueryData` (`PotentieLayer.stories.tsx:120-125`) |
| React Testing Library | n/a | Project locked on Storybook play-functions (Phase 3 verified) |

**Installation:** No new dependencies. Verify with `cd frontend && npm ls sonner framer-motion @tanstack/react-query lucide-react`.

---

## Architecture Patterns

### Recommended Project Structure

```
backend/
├── app/
│   ├── users/
│   │   ├── router.py                # existing — leave untouched
│   │   ├── schemas.py               # existing
│   │   └── factor_pins/             # NEW
│   │       ├── __init__.py
│   │       ├── router.py            # FastAPI APIRouter
│   │       └── schemas.py           # FactorPinCreate, FactorPinResponse, MaxPinsReachedDetail
│   ├── models/
│   │   └── user_factor_pin.py       # NEW — UserFactorPin(Base, TenantMixin, TimestampMixin)
│   └── main.py                      # add include_router(factor_pins_router)
└── alembic/versions/
    └── y0_m048_s04_create_user_factor_pins.py  # NEW

frontend/
├── src/
│   ├── hooks/
│   │   └── useFactorPins.ts         # NEW — mirrors useScoreWeights.ts
│   ├── lib/
│   │   └── factor-groups.ts         # NEW — bron→label mapping + ordering
│   ├── components/map/panels/parcel/
│   │   ├── FactorCard.tsx           # NEW (recommended extract — shared shell)
│   │   └── layers/
│   │       ├── PotentieLayer.tsx    # REFACTOR
│   │       └── RisicoLayer.tsx      # REFACTOR
│   └── stories/parcel/
│       ├── PotentieLayer.stories.tsx  # EXTEND (6 new stories)
│       └── RisicoLayer.stories.tsx    # NEW (mirror)
```

### Pattern 1: SQLAlchemy 2.x Model with TenantMixin (verified)

Direct mirror of `RefreshToken`:

```python
# Source: backend/app/models/refresh_token.py:13-66 (verified pattern)
import uuid
from datetime import datetime
from sqlalchemy import ForeignKey, Index, Integer, String, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin


class UserFactorPin(Base, TenantMixin, TimestampMixin):
    """
    Per-user persistent pin of a factor card in Potentie/Risico layer.

    `category` here is the parent TAB ("potentie" | "risico") — NOT the
    bron-groep (gemeente_beleid/markt/fysiek/klimaat/juridisch/planologisch)
    introduced on FACTOR_REGISTRY in this same phase.

    Multi-tenant: TenantMixin enforces organization_id; routers MUST
    explicitly filter (no implicit middleware).
    """
    __tablename__ = "user_factor_pins"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    category: Mapped[str] = mapped_column(String(16), nullable=False)
    factor_key: Mapped[str] = mapped_column(String(64), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)

    __table_args__ = (
        UniqueConstraint(
            "user_id", "category", "factor_key",
            name="uq_user_factor_pins_user_cat_key",
        ),
        Index("ix_user_factor_pins_lookup", "user_id", "category"),
    )
```

### Pattern 2: Alembic migration (mirror x0_m047_s04)

```python
# Source mirror: backend/alembic/versions/x0_m047_s04_create_factor_extraction_cache.py
revision: str = 'y0...'  # generate via `alembic revision -m ...`
down_revision: str | Sequence[str] | None = '28d2d029856d'  # verified head 2026-04-26
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        'user_factor_pins',
        sa.Column('id', sa.Uuid(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('organization_id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('category', sa.String(length=16), nullable=False),
        sa.Column('factor_key', sa.String(length=64), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(),
                  server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(),
                  server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'category', 'factor_key',
                            name='uq_user_factor_pins_user_cat_key'),
    )
    op.create_index('ix_user_factor_pins_organization_id', 'user_factor_pins',
                    ['organization_id'], unique=False)
    op.create_index('ix_user_factor_pins_user_id', 'user_factor_pins',
                    ['user_id'], unique=False)
    op.create_index('ix_user_factor_pins_lookup', 'user_factor_pins',
                    ['user_id', 'category'], unique=False)
```

### Pattern 3: Router with explicit tenant filter

```python
# Mirror: backend/app/users/router.py:39-47 (transactions: db.add/flush/commit, NOT db.begin)
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/users/me/factor-pins", tags=["user-factor-pins"])

@router.get("", response_model=list[FactorPinResponse])
async def list_pins(
    category: Literal["potentie", "risico"],
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[FactorPinResponse]:
    result = await db.execute(
        select(UserFactorPin)
        .where(
            UserFactorPin.user_id == current_user.id,
            UserFactorPin.organization_id == current_user.organization_id,  # explicit!
            UserFactorPin.category == category,
        )
        .order_by(UserFactorPin.position.asc())
    )
    return [FactorPinResponse.model_validate(p) for p in result.scalars()]


@router.post("", response_model=FactorPinResponse, status_code=status.HTTP_201_CREATED)
async def create_pin(
    data: FactorPinCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FactorPinResponse:
    # 1. Count existing pins for max-6 guard (server-side backup)
    count = await db.scalar(
        select(func.count(UserFactorPin.id)).where(
            UserFactorPin.user_id == current_user.id,
            UserFactorPin.organization_id == current_user.organization_id,
            UserFactorPin.category == data.category,
        )
    )
    if (count or 0) >= 6:
        raise HTTPException(
            status_code=400,
            detail={"code": "MAX_PINS_REACHED", "message": "Max 6 pins per category"},
        )
    # 2. Compute next position
    max_position = await db.scalar(
        select(func.max(UserFactorPin.position)).where(
            UserFactorPin.user_id == current_user.id,
            UserFactorPin.organization_id == current_user.organization_id,
            UserFactorPin.category == data.category,
        )
    )
    next_position = (max_position or -1) + 1
    # 3. Insert (UniqueConstraint will catch duplicate → 409)
    pin = UserFactorPin(
        organization_id=current_user.organization_id,
        user_id=current_user.id,
        category=data.category,
        factor_key=data.factor_key,
        position=next_position,
    )
    db.add(pin)
    try:
        await db.flush()
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Already pinned")
    await db.refresh(pin)
    return FactorPinResponse.model_validate(pin)
```

### Pattern 4: Optimistic TanStack Query hook (mirror useScoreWeights)

```ts
// Source mirror: frontend/src/hooks/useScoreWeights.ts (full file)
// Plus optimistic onMutate/onError/onSettled — NEW for this phase
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth/useAuth'
import { apiFetch } from '@/lib/api'

type FactorPin = { id: string; category: 'potentie'|'risico'; factor_key: string; position: number; created_at: string }

export function useFactorPins(category: 'potentie' | 'risico') {
  const { accessToken } = useAuth()
  const qc = useQueryClient()
  const queryKey = ['factor-pins', category] as const

  const query = useQuery<FactorPin[]>({
    queryKey,
    queryFn: () => apiFetch<FactorPin[]>(`/api/users/me/factor-pins?category=${category}`, {
      accessToken, method: 'GET',
    }),
    enabled: !!accessToken,
    staleTime: 5 * 60 * 1000,
  })

  const addMutation = useMutation<FactorPin, Error, string, { previous: FactorPin[] }>({
    mutationFn: (factor_key: string) =>
      apiFetch<FactorPin>('/api/users/me/factor-pins', {
        accessToken, method: 'POST',
        body: JSON.stringify({ category, factor_key }),
      }),
    onMutate: async (factor_key) => {
      await qc.cancelQueries({ queryKey })
      const previous = qc.getQueryData<FactorPin[]>(queryKey) ?? []
      const optimistic: FactorPin = {
        id: `tmp-${factor_key}`,
        category, factor_key,
        position: (previous[previous.length - 1]?.position ?? -1) + 1,
        created_at: new Date().toISOString(),
      }
      qc.setQueryData<FactorPin[]>(queryKey, [...previous, optimistic])
      return { previous }
    },
    onError: (_err, _key, ctx) => {
      if (ctx) qc.setQueryData(queryKey, ctx.previous)
    },
    onSettled: () => qc.invalidateQueries({ queryKey }),
  })

  const removeMutation = useMutation<void, Error, string, { previous: FactorPin[] }>({
    mutationFn: (pinId: string) =>
      apiFetch<void>(`/api/users/me/factor-pins/${pinId}`, { accessToken, method: 'DELETE' }),
    onMutate: async (pinId) => {
      await qc.cancelQueries({ queryKey })
      const previous = qc.getQueryData<FactorPin[]>(queryKey) ?? []
      qc.setQueryData<FactorPin[]>(queryKey, previous.filter((p) => p.id !== pinId))
      return { previous }
    },
    onError: (_err, _id, ctx) => { if (ctx) qc.setQueryData(queryKey, ctx.previous) },
    onSettled: () => qc.invalidateQueries({ queryKey }),
  })

  const pins = query.data ?? []
  const isPinned = (key: string) => pins.some((p) => p.factor_key === key)

  const toggle = (key: string) => {
    const existing = pins.find((p) => p.factor_key === key)
    if (existing) {
      removeMutation.mutate(existing.id)
      return
    }
    if (pins.length >= 6) {
      toast('⭐ Max 6 bereikt')
      return
    }
    addMutation.mutate(key)
  }

  return { pins, isLoading: query.isLoading, toggle, isPinned }
}
```

### Pattern 5: Page builder for grouped + pinned

```ts
// NEW abstraction — extract to frontend/src/lib/factor-groups.ts or as hook
import type { FactorRegistryEntry } from '@/lib/types/scan'

export type Bron = 'gemeente_beleid' | 'markt' | 'fysiek' | 'klimaat' | 'juridisch' | 'planologisch'

export const BRON_ORDER: Bron[] = ['gemeente_beleid', 'markt', 'fysiek', 'klimaat', 'juridisch', 'planologisch']
export const BRON_LABEL: Record<Bron, string> = {
  gemeente_beleid: 'GEMEENTE BELEID',
  markt: 'MARKT',
  fysiek: 'FYSIEK',
  klimaat: 'KLIMAAT',
  juridisch: 'JURIDISCH',
  planologisch: 'PLANOLOGISCH',
}

// Pinned page is page 0; group pages 1..N
export function buildPages(args: {
  allCards: CardDisplay[],          // includes a `bron` field added by formatter
  pins: FactorPin[],
}): { title: string, cards: (CardDisplay | { kind: 'ghost' })[] }[] {
  const pinnedPage = buildPinnedPage(args)         // 0 or fallback top-6
  const groupPages = BRON_ORDER
    .map((bron) => ({
      title: BRON_LABEL[bron],
      cards: args.allCards.filter((c) => c.bron === bron).slice(0, 6),
    }))
    .filter((p) => p.cards.length > 0)
  return [pinnedPage, ...groupPages]
}
```

### Anti-Patterns to Avoid

- **Implicit tenant middleware:** never rely on middleware to filter by `organization_id`. Always add the `WHERE organization_id = ...` clause **explicitly** in router handlers. Verified pattern in `backend/app/auth/dependencies.py:65-68`.
- **`async with db.begin():`** — causes "transaction already begun" errors. Use direct `db.add()/flush()/commit()` per project memory.
- **`datetime.now(timezone.utc)`** for created_at — type-error against `TIMESTAMP WITHOUT TIME ZONE`. Use `datetime.utcnow()` (note: `TimestampMixin` uses `server_default=text("CURRENT_TIMESTAMP")` so this rarely matters, but if explicit fallback is needed in code, use the naive variant).
- **Hardcoded brand color hex** (e.g. `text-yellow-400` for the star) — must be `text-amber-500` (CSS var-backed token) per CLAUDE.md + DESIGN.md.
- **Bumping `CARDS_PER_PAGE` only in PotentieLayer** — RisicoLayer has its own const at line 310; both must change.
- **Counting `capaciteit` as a registry entry** — it is a derived UI card (computed via `capacityValue`/`capacitySub` from `building_metrics`), not in `FACTOR_REGISTRY`. The Potentie tab shows 10 cards (9 registry + 1 derived). The new bron-mapping must handle this UI-only card explicitly (recommend `bron: 'fysiek'` set inline in the cards array, NOT via registry).
- **PATCH endpoint for reorder** — explicitly out of scope per CONTEXT decision 10. Don't pre-build it.
- **Treating duplicate-pin race as critical** — server `UniqueConstraint` returns 409, optimistic frontend simply rolls back. No transaction-level isolation needed.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pin persistence | localStorage with cross-device sync logic | Backend table + REST + TanStack Query | CONTEXT decision; cross-device requires server anyway |
| Optimistic UI | manual `useState` cache with rollback | TanStack `onMutate/onError/onSettled` | Battle-tested rollback semantics; precedent in `useScoreWeights.ts` |
| Toast | custom div with timer | `sonner` (already wired) | Single-line; matches Aura aesthetic |
| Page transition animation | manual CSS keyframes | `AnimatePresence + motion.div` (already in PotentieLayer) | Keep identical to current code so visual regression = 0 |
| Star icon | custom SVG | `lucide-react` `Star` (already imported by app) | Filled vs outline = `fill="currentColor"` toggle |
| UUID PK generation | `uuid.uuid4()` in Python | `server_default=text("gen_random_uuid()")` | Matches `RefreshToken` + `factor_extraction_cache` precedent |
| Race condition on max-6 | optimistic locking / `SELECT FOR UPDATE` | Simple count + insert; UniqueConstraint on duplicate; HTTP 400 on count > 6 | Pin is per-user; concurrent inserts from same user are vanishingly rare in real UX (user clicks twice in <100ms across two tabs) — server simply returns 400 on the loser; client refetches and learns truth |
| API mock in Storybook | install `msw` | inline `queryClient.setQueryData(['factor-pins', 'potentie'], [...])` in decorator | Precedent: `PotentieLayer.stories.tsx:120-125`; no MSW infrastructure exists in repo |

**Key insight:** Every primitive needed for this phase is already in the codebase. The work is composing them, not introducing new dependencies.

---

## Common Pitfalls

### Pitfall 1: Bron-mapping for UI-derived `capaciteit` card
**What goes wrong:** `POTENTIE_KEYS` includes `'capaciteit'` (`PotentieLayer.tsx:331`) but `FACTOR_REGISTRY` does **not** have a `capaciteit` entry. If you blindly read `bron` from the registry, the capaciteit card has `bron === undefined` and falls into no group-page.
**Why it happens:** Capaciteit is computed inline from `parcel.area_m2`, `building_metrics.pand_oppervlakte_m2`, and `max_bouwlagen` (see `capacityValue()`/`capacitySub()` at `PotentieLayer.tsx:224-249`). It is a derived UI card, not a registry factor.
**How to avoid:** When the layer builds its `allCards: CardDisplay[]`, attach `bron` per card explicitly. For capaciteit, hard-code `bron: 'fysiek'`. For all other Potentie cards, look up via the registry. Document this in a comment.
**Warning sign:** A blank group-page or the pinned-page silently dropping capaciteit when the user pins it.

### Pitfall 2: Storybook portal scope
**What goes wrong:** `WoonvisiePopup` uses `createPortal` to escape the canvas. Play-functions that use `within(canvasElement)` won't find rendered DOM.
**Why it happens:** Verified Phase 2 fix — portal-rendered modals require `within(document.body)`.
**How to avoid:** In any new story that exercises pin click → toast or pin click → modal, query via `within(document.body)`. Sonner toasts also render to portal.
**Warning sign:** `getByText is not a function on undefined` or `Unable to find element with text`.

### Pitfall 3: TanStack Query stale `pins` after pin from group-page
**What goes wrong:** User on group-page MARKT pins `funda_frictie`. The pinned-page (page 0) is mounted but stale until refetch. Star badge appears on group-page card immediately, but pinned-page would show old state.
**Why it happens:** Pinned-page and group-page subscribe to the same `["factor-pins", category]` query. `setQueryData` in `onMutate` updates the cache synchronously, so both consumers re-render in the same React commit.
**How to avoid:** Trust TanStack Query's `setQueryData` — both renderers see the same data. Verified pattern in `useScoreWeights.ts` (sync invalidation). Just make sure the **page builder** (pure function) reads the live `pins` array on every render.
**Warning sign:** Manual force-rerender hacks, `useEffect` watchers, or `setState` mirrors of `pins`.

### Pitfall 4: Tailwind v4 `@theme` token vs hardcoded hex
**What goes wrong:** Hardcoding `#F9A826` for the star defeats the design system; CSS vars allow runtime theme override.
**Why it happens:** Aura tokens live in `frontend/src/styles/index.css` `@theme` block. `text-amber-500` resolves to the token in Tailwind v4.
**How to avoid:** Always use Tailwind utility classes (`text-amber-500`, `text-slate-300`, `border-dashed border-slate-200`). Inline hex only for truly dynamic values per CLAUDE.md.
**Warning sign:** Any `style={{ color: '#...' }}` in pin-related code.

### Pitfall 5: Race on `position` autoincrement
**What goes wrong:** Two simultaneous POSTs from same user (two tabs) both compute `next_position = max + 1` → both insert position N → UniqueConstraint catches the **factor_key** collision but two pins of different factors could share a position number.
**Why it happens:** No `SELECT FOR UPDATE` in the create endpoint.
**How to avoid:** Position duplicates do NOT break anything (frontend sorts by position asc; tie-break by `created_at` is implicit). The unique constraint is on `(user_id, category, factor_key)` — that's the real invariant. Document this in the model docstring; do **not** add `SERIALIZABLE` isolation.
**Warning sign:** Trying to add a second `UniqueConstraint("user_id", "category", "position")` — that would over-constrain and cause spurious failures.

### Pitfall 6: `category` overload (registry vs pin-table)
**What goes wrong:** Code reading `pin.category` and getting confused about whether that's the tab (`potentie`/`risico`) or the bron-groep (`fysiek`/...).
**Why it happens:** The CONTEXT explicitly named the pin-table column `category` to mean **tab**, but the new registry field is also semantically a category. Naming collision.
**How to avoid:** Pin-table column = `category` (tab). Registry new field = `bron` (planner discretion; recommend `bron`). Add a docstring on `UserFactorPin.category` saying "the parent tab — NOT the bron-groep on FACTOR_REGISTRY".
**Warning sign:** A type union widens to include both sets of literals.

### Pitfall 7: Storybook 10 import path
**What goes wrong:** `import { expect, within } from '@storybook/test'` works in Storybook 8/9 but **not** in Storybook 10 (the path changed to `'storybook/test'`).
**Why it happens:** Storybook 10 package restructuring. Verified Phase 2 decision.
**How to avoid:** Always import from `'storybook/test'` (no `@`). Match the existing stories.
**Warning sign:** `Cannot find module '@storybook/test'` at story load.

### Pitfall 8: Mounting issue — Toaster requires app-level
**What goes wrong:** Stories that trigger `toast(...)` see no rendered toast because no `<Toaster />` is mounted in the story tree.
**Why it happens:** `<Toaster />` is in `App.tsx:4`, not in story decorators.
**How to avoid:** For stories that assert toast text, add `<Toaster />` to the story decorator or query it via `body.getByText(/Max 6 bereikt/)` if Sonner mounts itself globally on first `toast()` call (Sonner does auto-mount on first call only if `<Toaster />` exists). Recommend explicit Toaster in decorator for `Max6Guard` story.
**Warning sign:** `Max 6 bereikt` text not in DOM after click.

---

## Code Examples

### Pinned-page render (page 0 case)

```tsx
// In refactored PotentieLayer.tsx — replaces lines 391-449 page-0 path
function PinnedPage({ pins, allCards, onUnpin }: PinnedPageProps) {
  const pinnedCards = pins
    .map((p) => allCards.find((c) => c.factor_key === p.factor_key))
    .filter((c): c is CardDisplay => !!c)

  const isFallbackToTop6 = pins.length === 0
  const displayCards = isFallbackToTop6
    ? [...allCards].sort((a, b) => Math.abs(b.pts) - Math.abs(a.pts)).slice(0, 6)
    : pinnedCards

  const ghosts = Math.max(0, 6 - displayCards.length)
  const title = isFallbackToTop6 ? 'TOP FACTOREN' : 'GEPIND'

  return (
    <div>
      <h3 className="text-[10px] font-black tracking-[0.15em] uppercase text-slate-500 mb-2">
        {title}
      </h3>
      <motion.div
        key="pinned"
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -40 }}
        transition={{ duration: 0.2 }}
        className="grid grid-cols-3 grid-rows-2 gap-1.5 auto-rows-fr h-full"
      >
        {displayCards.map((card) => (
          <FactorCard
            key={card.label}
            card={card}
            isPinned
            onStarClick={() => onUnpin(card.factor_key!)}
          />
        ))}
        {Array.from({ length: ghosts }).map((_, i) => (
          <GhostCard key={`ghost-${i}`} />
        ))}
      </motion.div>
    </div>
  )
}
```

### Storybook decorator with QueryClient + Toaster + pin cache

```tsx
// In PotentieLayer.stories.tsx — extend existing meta decorator
import { Toaster } from 'sonner'

function makeQueryClientWithPins(parcelId: string, pins: FactorPin[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  queryClient.setQueryData(['parcel-project-type', parcelId], {
    parcel_id: parcelId, project_type: 'nieuwbouw_wonen',
    set_at: '2026-04-25T00:00:00Z', set_by_user_id: null,
  })
  queryClient.setQueryData(['factor-pins', 'potentie'], pins)
  return queryClient
}

// Story: pinning page partial (3 of 6)
export const PinnedPagePartial: Story = {
  name: '3. Pinned page — 3 pins + 3 ghosts',
  decorators: [
    (Story) => {
      const qc = makeQueryClientWithPins(PARCEL_ID, [
        { id: '1', category: 'potentie', factor_key: 'vrije_grond', position: 0, created_at: '2026-04-26T00:00:00Z' },
        { id: '2', category: 'potentie', factor_key: 'bestemming',  position: 1, created_at: '2026-04-26T00:00:01Z' },
        { id: '3', category: 'potentie', factor_key: 'woonvisie_match', position: 2, created_at: '2026-04-26T00:00:02Z' },
      ])
      return (
        <QueryClientProvider client={qc}>
          <AuthContext.Provider value={mockAuthValue}>
            <Toaster />
            <div className="h-screen w-screen bg-[#F2F6F3] flex flex-col overflow-hidden">
              <Story />
            </div>
          </AuthContext.Provider>
        </QueryClientProvider>
      )
    },
  ],
  args: { parcel: mockParcelWithBlerick, gemeenteNaam: 'Venlo' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // Title shows GEPIND
    await expect(canvas.getByText('GEPIND')).toBeInTheDocument()
    // 3 pinned cards + 3 ghost slots = 6 grid cells
    const grid = canvasElement.querySelector('.grid-cols-3') as HTMLElement
    await expect(grid.children.length).toBe(6)
    // Ghost label
    await expect(canvas.getAllByText(/pin een factor/i).length).toBe(3)
  },
}
```

### Backend pytest integration test (multi-tenant isolation)

```python
# backend/tests/integration/test_factor_pins_router.py
@pytest.mark.asyncio
async def test_org_a_user_cannot_see_org_b_pins(
    async_client: AsyncClient, db: AsyncSession,
    org_a_user_headers: dict, org_b_user_headers: dict,
    org_b_id: uuid.UUID, org_b_user_id: uuid.UUID,
):
    # Seed: org B user pins funda_frictie
    db.add(UserFactorPin(
        organization_id=org_b_id, user_id=org_b_user_id,
        category="potentie", factor_key="funda_frictie", position=0,
    ))
    await db.commit()
    # Org A user lists pins
    resp = await async_client.get(
        "/api/users/me/factor-pins?category=potentie",
        headers=org_a_user_headers,
    )
    assert resp.status_code == 200
    assert resp.json() == []  # empty — multi-tenant isolation honored
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 9 cards per page, no grouping | 6 cards × N pages, group-by-bron, pinned page-0 | This phase (M048/S04) | Forward-compatible scaling for M050+ cascade factors (no UI work per new factor) |
| Per-component card rendering | (Recommended) `FactorCard.tsx` shared shell + `useGroupedFactorPages` builder | This phase (planner discretion) | Reduces drift between Potentie/Risico layers |
| Hardcoded factor labels in layer | (Recommended) `lib/factor-groups.ts` constants | This phase | i18n-ready; DRY across layers |
| `category: Literal["potentie", "risico"]` only on registry | Add `bron: Literal[...]` for UI grouping | This phase (GROUP-01) | Metadata-only; runtime scoring unaffected |

**Deprecated/outdated in this phase:**
- The `CARDS_PER_PAGE = 9` constants in both `PotentieLayer.tsx:304` and `RisicoLayer.tsx:310` — both flip to 6.
- The flat `POTENTIE_KEYS` / `RISICO_KEYS` arrays remain in spirit (still need an ordered list to drive registry lookup) but become inputs to the new `buildPages()` builder rather than direct page slicers.

---

## Open Questions

1. **Should `FactorCard` and the page-builder be extracted now, or inlined?**
   - What we know: PotentieLayer renders cards inline (`:400-447`). RisicoLayer has extracted `RisicoCard` (`:282-306`). Card markup is **structurally identical** but uses different colors (`green-600/green-50` vs `red-600/red-50`).
   - What's unclear: Does the planner want a single `<FactorCard variant="potentie|risico" />` or two layers each with their own card?
   - Recommendation: Extract `FactorCard.tsx` with a `variant` prop OR a `tone={'positive'|'negative'}` prop. Reduces duplicated star/hover logic which is the most error-prone surface.

2. **Should the `bron` field be Optional or Required on `FactorRegistryEntry`?**
   - What we know: 22 entries to migrate. Backend has assertion that weights sum to 100.
   - What's unclear: If a future Risico factor lands without an immediate bron mapping, should it crash module-load or default to e.g. `'fysiek'`?
   - Recommendation: Make `bron` REQUIRED (no default). Module-load assertion error is a feature — forces explicit thought when adding factors.

3. **Capaciteit card group-page placement.**
   - What we know: `capaciteit` is UI-only, not a registry factor. Computed from building_metrics.
   - What's unclear: Which group-page does it live on?
   - Recommendation: Inline assign `bron: 'fysiek'`. Document in `frontend/src/lib/factor-groups.ts` why this card is special.

4. **Should the `criminaliteit` factor map to `markt` or a new `sociaal` bron?**
   - What we know: CONTEXT lists 6 valid bron values; `criminaliteit` is currently in Risico tab.
   - What's unclear: Semantically "social context" but the CONTEXT only enumerates {gemeente_beleid, markt, fysiek, klimaat, juridisch, planologisch}.
   - Recommendation: Map to `markt` (closest fit, since marketability is affected by criminaliteit). Avoid expanding the enum unless multiple factors warrant it.

5. **Should the layer mount a local `<Toaster />` for stories?**
   - What we know: App-level Toaster lives in `App.tsx`. Stories don't include App.
   - What's unclear: Whether Sonner self-mounts on first call.
   - Recommendation: Add `<Toaster />` explicitly in story decorators that exercise `Max6Guard` to remove ambiguity.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Backend framework | pytest + pytest-asyncio + httpx AsyncClient (ASGITransport) |
| Backend config | `backend/pytest.ini` / `backend/pyproject.toml` (existing) |
| Frontend framework | Storybook 10 + `@storybook/addon-vitest` (Playwright Chromium) |
| Frontend config | `frontend/.storybook/main.ts`, `frontend/.storybook/preview.ts` (existing) |
| Quick run (backend) | `cd backend && pytest tests/unit/test_user_factor_pin_model.py tests/integration/test_factor_pins_router.py -x` |
| Quick run (frontend) | `cd frontend && npm run test-storybook -- --include="src/stories/parcel/PotentieLayer.stories.tsx"` (or equivalent) |
| Full suite (backend) | `cd backend && pytest -x` (must keep 275 + new tests green) |
| Full suite (frontend) | `cd frontend && npm run check && npm run test-storybook` |
| Phase gate | Both full suites green before `/gsd:verify-work` |

### Phase Requirements → Test Map (11 Success Criteria from ROADMAP)

| SC# | Behavior | Test Type | Surface | Automated Command | File Exists? |
|-----|----------|-----------|---------|-------------------|--------------|
| 1 | Each `FACTOR_REGISTRY` entry has `bron` field | unit | backend pytest | `pytest backend/tests/unit/test_factor_registry_bron_field.py -x` | ❌ Wave 0 |
| 2 | `user_factor_pins` table + cols + UniqueConstraint exist after migration | integration | backend pytest (Alembic upgrade-down-up smoke) | `pytest backend/tests/integration/test_user_factor_pins_migration.py -x` | ❌ Wave 0 |
| 3 | REST endpoints `GET/POST/DELETE /api/users/me/factor-pins` respond per spec | integration | backend pytest + httpx | `pytest backend/tests/integration/test_factor_pins_router.py -x` | ❌ Wave 0 |
| 4 | `CARDS_PER_PAGE = 6` in both layers | unit (constant assertion) + visual via story | frontend Storybook | `npm run test-storybook -- PotentieLayer` (story `PinnedPageEmpty` asserts grid.children.length === 6) | ❌ Wave 0 (story) |
| 5 | Page 1 = pinned synth-page; page 2+ = group pages | story play-function | frontend Storybook | story `GroupPagesNavigation` walks chevrons + asserts titles `GEPIND → GEMEENTE BELEID → MARKT → FYSIEK → KLIMAAT` | ❌ Wave 0 |
| 6 | Pinned cards visible on both pinned-page and own group-page with ⭐ | story play-function | frontend Storybook | story `PinnedAlsoOnGroupPage` asserts ⭐ in both renders | ❌ Wave 0 |
| 7 | Hover → star; click → optimistic + POST; unpin from both syncs | story play-function (with mocked fetch / cache) | frontend Storybook | story `PinFlow` hover-clicks + asserts cache mutation | ❌ Wave 0 |
| 8 | 6 pins + 7th attempt → toast "max 6 bereikt" | story play-function | frontend Storybook (with `<Toaster />` in decorator) | story `Max6Guard` clicks 7th pin + asserts toast text in `document.body` | ❌ Wave 0 |
| 9 | Pins persist across refresh/devices | integration | backend pytest (POST then GET round-trip) — covered by SC#3; manual smoke for "across devices" | `pytest backend/tests/integration/test_factor_pins_router.py::test_pin_persists_across_sessions -x` | ❌ Wave 0 |
| 10 | Multi-tenant: org A user cannot see org B pins | integration | backend pytest | `pytest backend/tests/integration/test_factor_pins_router.py::test_org_a_user_cannot_see_org_b_pins -x` | ❌ Wave 0 |
| 11 | Pin/unpin flow + max-6 + ⭐ rendering + page-nav with pinned synth-page | story play-functions | frontend Storybook | combined coverage from stories above (TEST-07 = aggregate) | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** Quick run = `pytest <single test file> -x` (backend) / `npm run check` (frontend type+lint)
- **Per wave merge:** Backend full unit + integration suite for affected modules; frontend full Storybook play run on touched stories.
- **Phase gate:** `cd backend && pytest -x` AND `cd frontend && npm run check && npm run test-storybook` both green before `/gsd:verify-work`. Pre-existing 275 tests must remain green (no regression).

### Wave 0 Gaps (test infrastructure to seed)

- [ ] `backend/tests/unit/test_factor_registry_bron_field.py` — covers SC#1 (assert every entry has `bron` Literal value)
- [ ] `backend/tests/integration/test_user_factor_pins_migration.py` — covers SC#2 (Alembic upgrade head, table inspect, downgrade, upgrade)
- [ ] `backend/tests/integration/test_factor_pins_router.py` — covers SC#3, SC#9, SC#10 (auth, list/POST/DELETE, max-6 400, multi-tenant isolation)
- [ ] `backend/tests/unit/test_user_factor_pin_model.py` — model construction + UniqueConstraint smoke (defense-in-depth)
- [ ] `frontend/src/stories/parcel/PotentieLayer.stories.tsx` (extend) — add `PinnedPageEmpty`, `PinnedPagePartial`, `PinnedPageFull`, `PinFlow`, `Max6Guard`, `MissingPinDashedBorder`, `GroupPagesNavigation`, `PinnedAlsoOnGroupPage` (covers SC#4–SC#8, SC#11)
- [ ] `frontend/src/stories/parcel/RisicoLayer.stories.tsx` (NEW) — mirror PotentieLayer story battery for the risico tab; minimal smoke since logic is shared (covers SC#4 in risico tab + visual regression)
- [ ] No framework install needed — pytest, Storybook, addon-vitest all in repo

---

## Sources

### Primary (HIGH confidence — verified in repo this session)

- `backend/app/models/base.py:16-44` — `Base`, `TenantMixin`, `TimestampMixin` (canonical mixin shape)
- `backend/app/models/refresh_token.py:1-66` — closest model precedent (`Base + TenantMixin + TimestampMixin`, uuid PK with `gen_random_uuid()`, FK to users CASCADE, composite indexes via `__table_args__`)
- `backend/app/auth/dependencies.py:19-77` — `get_current_user` returns `User` with `.id` and `.organization_id`
- `backend/app/users/router.py:1-301` — existing `/api/users` mount; `/me/preferences` precedent for users.me endpoints; `db.add/flush/commit` transaction pattern
- `backend/app/services/score_v3.py:62-238` — `FactorRegistryEntry` dataclass + 22-entry registry (9 potentie / 13 risico), sum-guard pattern at `:240-279`
- `backend/alembic/versions/x0_m047_s04_create_factor_extraction_cache.py:1-89` — most recent migration; pattern for new file
- `backend/alembic/versions/` listing (verified `28d2d029856d` is head — no children with `down_revision = '28d2d029856d'`)
- `backend/app/main.py:45,157` — `users_router` import + mount at `app.include_router(users_router)`
- `frontend/src/components/map/panels/parcel/layers/PotentieLayer.tsx:1-493` — current Potentie layer (CARDS_PER_PAGE=9 at :304, POTENTIE_KEYS at :328, pagination footer at :452-475, animated grid at :391-449)
- `frontend/src/components/map/panels/parcel/layers/RisicoLayer.tsx:1-449` — current Risico layer (CARDS_PER_PAGE=9 at :310, RISICO_KEYS at :324, extracted RisicoCard at :282-306, mirror pagination at :423-445)
- `frontend/src/hooks/useScoreWeights.ts:1-101` — TanStack Query pattern (useQuery + useMutation + invalidateQueries on success); apiFetch usage
- `frontend/src/stories/parcel/WoonvisiePopup.stories.tsx:1-389` — Storybook play-function pattern, `within(document.body)` for portal-rendered modals, `storybook/test` import path
- `frontend/src/stories/parcel/PotentieLayer.stories.tsx:1-200` — QueryClientProvider + AuthContext decorator with `setQueryData` cache pre-seed (no MSW); waitFor pattern for page transition; canonical reference for Phase 7 stories
- `frontend/.storybook/preview.ts` + `.storybook/main.ts` — Morning Mist default background, addon-vitest configured, addon-a11y on
- `frontend/src/main.tsx:5`, `App.tsx:4` — `<Toaster />` mounted at app level (sonner)
- `~/.claude/projects/-home-klarifai-Documents-klarifai-clientprojects-propdex/memory/MEMORY.md` — Key Patterns (transactions, datetimes, JWT, pwdlib), Testing Patterns

### Secondary (MEDIUM confidence — derived from project memory + design doc references)

- `~/.gstack/projects/Romainnoo145-propdex/klarifai-main-design-20260424-200512.md` — design doc §"Frontend: Pin-mechanisme + group-per-page (S04)" (referenced by CONTEXT, not re-read this session)
- CLAUDE.md project + global — multi-tenant rules, file-size <300 lines, Tailwind v4 `@theme` tokens, design system DESIGN.md
- DESIGN.md — Aura tokens (Morning Mist `#F2F6F3`, Warm Amber `#F9A826`, Plus Jakarta Sans, glass surfaces) — referenced by CONTEXT

### Tertiary (LOW confidence — flagged for validation if planner depends on them)

- Sonner self-mounting behavior in stories — verify by running a `Max6Guard` story with and without `<Toaster />` decorator. Recommendation: explicit Toaster in decorator (no risk).
- Exact JSON shape of `FactorPinResponse` (Pydantic v2 `model_config = ConfigDict(from_attributes=True)`) — confirm by checking another `*Response` schema in `backend/app/users/schemas.py` or `backend/app/auth/schemas.py`.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every library verified in repo with line numbers
- Architecture: HIGH — patterns mirror existing `RefreshToken` + `useScoreWeights` + Phase 3 Storybook precedent
- Pitfalls: HIGH — 8 pitfalls extracted from concrete code observations + project memory; 1 (capaciteit) is a non-obvious gotcha that would otherwise burn the planner
- Validation Architecture: HIGH — 11 success criteria each mapped to a runnable test surface

**Notable verifications:**
- ✅ Alembic head = `28d2d029856d` (CONTEXT correct; no children migrations)
- ✅ TenantMixin = `organization_id: Mapped[uuid.UUID]` FK to organizations CASCADE, indexed
- ✅ TimestampMixin provides both `created_at` AND `updated_at` (CONTEXT only mentions `created_at` — model can use TimestampMixin for both, free `updated_at`)
- ✅ FACTOR_REGISTRY = 22 entries (9 potentie + 13 risico), NOT 21 as CONTEXT states (small mismatch — Risico count is 13, not 12+. Planner should map all 13)
- ✅ `capaciteit` is UI-derived, NOT in registry (CONTEXT decision 1 lists it under Potentie mapping — clarification: it lives in UI cards array only)
- ✅ `criminaliteit` exists in Risico registry (`score_v3.py:196-202`) — CONTEXT didn't explicitly map it; recommendation in Open Questions
- ✅ Storybook 10 import: `from 'storybook/test'` (no `@`) — verified

**Research date:** 2026-04-26
**Valid until:** 2026-05-26 (30 days — backend deps are stable; frontend Storybook patterns recently verified Phase 3-4)
