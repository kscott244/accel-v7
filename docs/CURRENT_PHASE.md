# CURRENT PHASE — accel-v7

## Active: Phase 4 — Extract Tab Components ✅ Complete

### What Was Done (Phase 4)
1. **Created `src/data/sku-data.ts`** — SKU pricing array (44 products) extracted from AccelerateApp.tsx
2. **Created `src/components/primitives.tsx`** — Shared UI primitives: `fixGroupName`, `Pill`, `Stat`, `Bar`, `AccountId`, `Chev`, `IconMap`
3. **Created `src/components/tabs/GroupsTab.tsx`** — Groups list tab (~99 lines of logic)
4. **Created `src/components/tabs/EstTab.tsx`** — Q1 Completion Estimator tab (~108 lines)
5. **Created `src/components/tabs/MapTab.tsx`** — Map/Route tab with Leaflet (~178 lines)
6. **Created `src/components/tabs/DashTab.tsx`** — Dashboard + Quick Sale Calculator (~220 lines)
7. **Patched `src/components/AccelerateApp.tsx`** — Replaced 4 inline tab bodies + SKU array with imports
8. **AccelerateApp.tsx reduced from 5,052 → 4,400 lines** (−652 lines, −13%)

### What Remains in AccelerateApp.tsx (intentional)
- `ErrorBoundary`, static data imports, `OVERLAYS_REF`, `applyOverlays()` — too entangled to move
- Icons (Back, IconBolt, etc.) + primitives kept inline — nav-coupled, other tabs still use them
- `TodayTab` (~1069 lines), `DealersTab` (~692 lines), `AccountDetail` (~798 lines) — Phase 5 targets
- `GroupDetail` (~309 lines), `OutreachTab` (~317 lines), `AdminTab` (~471 lines) — Phase 5 targets

### Commits
- `e65991019c31` — phase 4: extract GroupsTab, EstTab, MapTab, DashTab, primitives, sku-data

---

## Previously Completed

### Phase 3 — Decompose the Monolith ✅ Complete
1. Extracted `src/lib/tokens.ts` — design tokens, Q1_TARGET, FY_TARGET, DAYS_LEFT
2. Extracted `src/lib/tier.ts` — normalizeTier, getTierRate, isAccelTier, getTierLabel, ACCEL_RATES
3. Extracted `src/lib/format.ts` — $$, $f, pc, scoreAccount, getHealthStatus
4. Extracted `src/lib/csv.ts` — parseCSV, parseCSVLine, processCSVData
5. AccelerateApp.tsx reduced from 5,388 → 5,053 lines

### Phase 2 — Stabilize + Consolidate ✅ Complete
1. Retired patches.json — deleted save-patch route
2. Added build version badge
3. Audited applyOverlays() edge cases
4. Cache-busting headers

### Phase 1 — Foundation Audit + Docs ✅ Complete
1. Full repo audit
2. Created docs/ARCHITECTURE.md, docs/ROADMAP.md, docs/CURRENT_PHASE.md, docs/IDEAS_BACKLOG.md

---

## Next Up: Phase 5 — Extract Remaining Large Tabs

### Scope
Continue tab extraction for the larger, more complex components.

### Extraction Order
1. `GroupDetail` (~309 lines) — moderate coupling, manageable
2. `OutreachTab` (~317 lines) — AI calls, moderate coupling
3. `AdminTab` (~471 lines) — CSV upload + overlay editing
4. `DealersTab` (~692 lines) — complex state
5. `AccountDetail` (~798 lines) — high coupling
6. `TodayTab` (~1069 lines) — most complex, last

### Entry Criteria
- Phase 4 complete ✅

---

## Last Updated
March 23, 2026
