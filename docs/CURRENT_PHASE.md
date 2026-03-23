# CURRENT PHASE — accel-v7

## Active: Phase 3 — Decompose the Monolith ✅ Complete

### What Was Done (Phase 3)
1. **Extracted `src/lib/tokens.ts`** — design tokens (`T`), `Q1_TARGET`, `FY_TARGET`, `DAYS_LEFT`, `HOME_LAT/LNG`
2. **Extracted `src/lib/tier.ts`** — `normalizeTier`, `isTop100`, `normalizePracticeType`, `getTierRate`, `isAccelTier`, `getTierLabel`, `extractGroupName`, `ACCEL_RATES`
3. **Extracted `src/lib/format.ts`** — `$$`, `$f`, `pc`, `scoreAccount()`, `getHealthStatus()`
4. **Extracted `src/lib/csv.ts`** — `parseCSV`, `parseCSVLine`, `processCSVData` (full Tableau CSV processor)
5. **AccelerateApp.tsx reduced from 5,388 → 5,053 lines** — replaced 393 lines of inline logic with 9-line import block
6. **All 4 modules are pure TypeScript** — no React deps, fully reusable, single responsibility
7. **App deployed and verified** — chunk hash changed, build READY, no regressions

### What Remains in AccelerateApp.tsx (intentional)
- `ErrorBoundary`, static data imports, `OVERLAYS_REF`, `applyOverlays()` — lines 1-192 (too entangled to move safely)
- Icons + small UI primitives (`Back`, `Chev`, `Pill`, `Stat`, `Bar`, `AccountId`, `fixGroupName`) — kept inline, nav-coupled
- SKU pricing array — only used by `EstTab`, not worth moving yet
- All 8 tab components (`TodayTab`, `GroupsTab`, `GroupDetail`, `AccountDetail`, `DashTab`, `MapTab`, `DealersTab`, `EstTab`, `OutreachTab`, `AdminTab`) — Phase 4 work

### Commits
- `31c5798` — phase 3: extract tokens, tier, format, csv to src/lib/
- `264f024` — phase 3: fix — restore icons/primitives accidentally removed from AccelerateApp

---

## Previously Completed

### Phase 2 — Stabilize + Consolidate ✅ Complete
1. Retired patches.json — deleted save-patch route, marked patches.json deprecated
2. Added build version badge — commit SHA in More menu
3. Audited applyOverlays() edge cases — all 5 verified safe
4. Cache-busting headers — next.config.js sets no-cache on /api/* and /accelerate

### Phase 1 — Foundation Audit + Docs ✅ Complete
1. Full repo audit — file tree, data flow, API routes, component structure, deployment pipeline
2. Created/updated docs/ARCHITECTURE.md, docs/ROADMAP.md, docs/CURRENT_PHASE.md, docs/IDEAS_BACKLOG.md

---

## Next Up: Phase 4 — Extract Tab Components

### Scope
Extract tabs one at a time into `src/components/tabs/`. Start smallest/safest first.

### Extraction Order (safest → riskiest)
1. `GroupsTab` (~100 lines) — minimal deps, list render only
2. `EstTab` (~113 lines) — self-contained calculator
3. `MapTab` (~179 lines) — route builder, no scoring deps
4. `DashTab` (~220 lines) — charts + aggregates, moderate deps
5. `OutreachTab` (~317 lines) — AI calls, moderate coupling
6. `AdminTab` (~471 lines) — CSV upload + overlay editing, high coupling
7. `GroupDetail` (~309 lines) — complex props, defer
8. `DealersTab` (~692 lines) — complex state, defer
9. `TodayTab` (~1069 lines) + `AccountDetail` (~798 lines) — last, most coupled

### DO NOT extract in Phase 4
- `TodayTab`, `DealersTab`, `AccountDetail` — too large/coupled, Phase 5+
- `applyOverlays()` — module-level state coupling, needs context refactor first

### Entry Criteria
- Phase 3 complete ✅

### What Phase 4 Does NOT Include
- New features
- UI redesign
- TypeScript strict mode (remove @ts-nocheck) — save for after tabs are extracted

---

## Last Updated
March 23, 2026
