# ROADMAP — accel-v7

> Last updated: March 23, 2026
> Phased plan from current state to long-term platform.

---

## Phase Overview

| Phase | Name | Status | Description |
|-------|------|--------|-------------|
| 1 | Foundation Audit + Docs | ✅ Complete | Audit repo, document architecture, establish project docs, define roadmap |
| 2 | Stabilize + Consolidate | ✅ Complete | Retire patches.json, add deploy verification, fix remaining edge cases |
| 3 | Decompose the Monolith | ✅ Complete | Extracted all tabs + lib modules — AccelerateApp.tsx 5,377 → ~680 lines |
| 4 | Data Pipeline Upgrade | ✅ Complete | CSV diff view on upload, full overlay integrity check across all sections |
| 5 | Intelligence Layer | ⚠️ Partial | AI briefing, Deep Research, find-group-matches built — enhanced scoring + weekly change detection remain |
| 6 | Foundation Hardening | ✅ Complete | Zero TS errors, 34 tests for scoring + CSV processor, updated docs |
| 7 | Multi-Quarter / Q2+ | 🔲 Future | Quarter selector, historical tracking, goal management |

---

## Phase 1 — Foundation Audit + Docs ✅ Complete

**Delivered**:
- Full repo audit — file tree, data flow, API routes, component structure, deployment pipeline
- `docs/ARCHITECTURE.md` — current + target architecture with accurate metrics
- `docs/ROADMAP.md` — this file
- `docs/CURRENT_PHASE.md` — active phase tracker
- `docs/IDEAS_BACKLOG.md` — organized idea capture

---

## Phase 2 — Stabilize + Consolidate ✅ Complete

**Goal**: Clean up the dual overlay systems, add deploy confidence, fix remaining rough edges. No new features.

**What's already been fixed** (these were originally Phase 2 items but got done during recent feature work):
- ✅ Error boundary debug code removed (commit `73da0e0`)
- ✅ Nav bar consolidated: 5 main tabs + More menu (commit `e1a6baf`)
- ✅ Dealers tab single-location fix (commit `ae5ae27`)
- ✅ GROUP CREATES / Resolute products fix (commit `58f54a6`)
- ✅ Overlay persistence hardened — survives cache clear + CSV upload (commit `d2f20df`)

**Completed March 23, 2026**:
1. ✅ **Retired patches.json** — deleted save-patch API route, updated stale comments, marked patches.json as deprecated archive
2. ✅ **Added build hash to UI** — commit SHA badge in More menu (uses NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA)
3. ✅ **Audited overlay edge cases** — all 5 scenarios verified safe, added inline documentation
4. ✅ **Cache-busting headers** — next.config.js sets no-cache on API routes and app page

**Does NOT include**: New features, tab decomposition, AI enhancements.

**Completion criteria**: Single overlay system, deploy verification visible in UI, no known data integrity edge cases.

---

## Phase 3 — Decompose the Monolith

**Goal**: Break AccelerateApp.tsx (5,377 lines) into maintainable, typed components without breaking anything.

**Approach**: Extract one tab at a time. Each extraction is a standalone commit.

**Order of extraction** (lowest risk first):
1. Extract shared logic first:
   - Design tokens (T object) → `src/lib/tokens.ts`
   - Scoring engine → `src/lib/scoring.ts`
   - CSV processor → `src/lib/csv-processor.ts`
   - Overlay logic → `src/lib/overlays.ts`
   - Shared micro-components (Pill, Stat, Bar, AccountId, icons) → `src/components/shared/`
2. Then extract tabs:
   - `MapTab` → `src/components/tabs/MapTab.tsx` (self-contained)
   - `EstTab` → `src/components/tabs/EstTab.tsx` (simple)
   - `DashTab` → `src/components/tabs/DashTab.tsx`
   - `GroupsTab` + `GroupDetail` → `src/components/tabs/GroupsTab.tsx`
   - `DealersTab` → `src/components/tabs/DealersTab.tsx`
   - `OutreachTab` → `src/components/tabs/OutreachTab.tsx`
   - `AdminTab` → `src/components/tabs/AdminTab.tsx`
   - `TodayTab` → `src/components/tabs/TodayTab.tsx` (most complex, last)
   - `AcctDetail` → `src/components/tabs/AcctDetail.tsx`

**Completion criteria**: AccelerateApp.tsx under 500 lines (shell + routing + state + imports). All tabs in separate files. TypeScript enabled.

---

## Phase 4 — Data Pipeline Upgrade

**Goal**: Make weekly data refresh reliable and self-service.

**Scope**:
1. Improved CSV import with column auto-detection for Ken's Tableau export format
2. Data validation dashboard — show what changed since last upload
3. Diff view: "15 new accounts, 3 removed, 47 with changed CY numbers"
4. Overlay integrity check — flag overlays referencing accounts no longer in base data
5. One-click "Upload New Week" flow in Admin tab

**Completion criteria**: Ken can upload a new Tableau export weekly with confidence.

---

## Phase 5 — Intelligence Layer

**Goal**: Make the app smarter about recommending actions.

**Scope**:
1. Enhanced scoring engine with configurable weights
2. "Top 10 This Week" auto-generated from scoring + geography + calendar
3. Gap-closing scenario modeling ("convert these 12 accounts = $X")
4. Distributor-level trend detection
5. Product-level opportunity identification
6. Weekly AI briefing refinement

**Completion criteria**: Ken opens the app Monday morning and sees a useful, personalized action plan.

---

## Phase 6 — Multi-Quarter / Q2+

**Goal**: Transition from Q1-only to an ongoing operating system.

**Scope**:
1. Quarter selector — switch between Q1, Q2, etc.
2. Historical tracking — "Q1 2026 final: $X"
3. Goal management — update targets per quarter
4. Year-over-year comparisons
5. Territory change tracking (accounts gained/lost)

**Completion criteria**: App works for Q2 2026 without hardcoded Q1 changes.

---

## Dependencies

```
Phase 1 (Foundation Audit) ✅
  └─► Phase 2 (Stabilize)
       ├─► Phase 3 (Decompose) ── can run in parallel with Phase 4
       └─► Phase 4 (Data Pipeline)
            └─► Phase 5 (Intelligence)
                 └─► Phase 6 (Multi-Quarter)
```

## Timeline Guidance

- **Phase 2**: 1 session, focused cleanup
- **Phase 3**: Biggest investment (multiple sessions), highest long-term payoff
- **Phase 4-6**: Post-Q1 work — Q1 ends March 31, 2026
- During Q1 crunch, prioritize bug fixes and usability over architecture
