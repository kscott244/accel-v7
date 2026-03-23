# ROADMAP — accel-v7

> Last updated: March 22, 2026
> Phased plan from current state to long-term platform.

---

## Phase Overview

| Phase | Name | Status | Description |
|-------|------|--------|-------------|
| 1 | Foundation Audit + Docs | ✅ Current | Audit repo, document architecture, establish project docs, define roadmap |
| 2 | Stabilize & Harden | 🔲 Next | Fix known bugs, remove debug code, clean up stale data paths, harden overlay system |
| 3 | Decompose the Monolith | 🔲 Planned | Extract tabs from AccelerateApp.tsx into separate files, enable TypeScript |
| 4 | Data Pipeline Upgrade | 🔲 Planned | Improve CSV import, add data validation, weekly upload workflow |
| 5 | Intelligence Layer | 🔲 Future | Enhanced scoring, AI briefings, gap-closing scenarios, route optimization |
| 6 | Multi-Quarter / Q2+ | 🔲 Future | Support quarter transitions, historical tracking, goal updates |

---

## Phase 1 — Foundation Audit + Docs ✅

**Goal**: Create project documentation so future work is faster and less error-prone.

**Deliverables**:
- `docs/ARCHITECTURE.md` — current + target architecture
- `docs/ROADMAP.md` — this file
- `docs/CURRENT_PHASE.md` — active phase tracker
- `docs/IDEAS_BACKLOG.md` — captured ideas, organized

**Completion criteria**: Docs exist, are repo-specific, and accurately describe the codebase.

---

## Phase 2 — Stabilize & Harden

**Goal**: Fix what's broken, remove dead code, make the app more reliable before adding features.

**Scope**:
1. Remove error boundary debug code (known Q2 backlog item)
2. Consolidate patches.json + overlays.json — pick one system, retire the other
3. Fix: single-location accounts not surfacing in Dealers tab under some reps
4. Fix: nav bar crowding (8 tabs) — implement "More" menu or tab consolidation
5. Fix: browser cache staleness after deploys — add cache-busting strategy
6. Audit `applyOverlays()` for edge cases (missing children, duplicate IDs, stale references)
7. Add `data-version` or build hash visible in UI for deploy verification

**Does NOT include**: New features, tab decomposition, AI enhancements.

**Completion criteria**: Zero known bugs in the live app, clean overlay system, deploy verification works.

---

## Phase 3 — Decompose the Monolith

**Goal**: Break AccelerateApp.tsx (5,377 lines) into maintainable, typed components without breaking anything.

**Approach**: Extract one tab at a time. Each extraction is a standalone PR-sized change.

**Order of extraction** (lowest risk first):
1. `MapTab` → `src/components/tabs/MapTab.tsx` (self-contained, no shared state beyond props)
2. `EstTab` → `src/components/tabs/EstTab.tsx` (simple estimator)
3. `DashTab` → `src/components/tabs/DashTab.tsx`
4. `GroupsTab` → `src/components/tabs/GroupsTab.tsx`
5. `DealersTab` → `src/components/tabs/DealersTab.tsx`
6. `OutreachTab` → `src/components/tabs/OutreachTab.tsx`
7. `AdminTab` → `src/components/tabs/AdminTab.tsx`
8. `TodayTab` → `src/components/tabs/TodayTab.tsx` (most complex, last)

**Supporting extractions**:
- Shared types → `src/types/accelerate.ts`
- Design tokens (T object) → `src/lib/tokens.ts`
- Scoring engine → `src/lib/scoring.ts`
- CSV processor → `src/lib/csv-processor.ts`
- Overlay logic → `src/lib/overlays.ts`
- Formatters/icons → already partially in `src/lib/utils.ts`

**Completion criteria**: AccelerateApp.tsx under 500 lines (shell + routing + state + imports). All tabs in separate files. TypeScript enabled (remove `@ts-nocheck`).

---

## Phase 4 — Data Pipeline Upgrade

**Goal**: Make weekly data refresh reliable and self-service.

**Scope**:
1. Improved CSV import with column auto-detection for Ken's Tableau export format
2. Data validation dashboard — show what changed since last upload
3. Diff view: "15 new accounts, 3 removed, 47 with changed CY numbers"
4. Overlay integrity check — flag overlays that reference accounts no longer in base data
5. One-click "Upload New Week" flow in Admin tab

**Completion criteria**: Ken can upload a new Tableau export weekly with confidence that nothing breaks.

---

## Phase 5 — Intelligence Layer

**Goal**: Make the app smarter about recommending actions.

**Scope**:
1. Enhanced scoring engine with configurable weights
2. "Top 10 This Week" auto-generated from scoring + geography + calendar
3. Gap-closing scenario modeling ("convert these 12 accounts = $X")
4. Distributor-level trend detection
5. Product-level opportunity identification (accounts buying competitor products)
6. Weekly AI briefing refinement

**Completion criteria**: Ken opens the app Monday morning and sees a useful, personalized action plan.

---

## Phase 6 — Multi-Quarter / Q2+

**Goal**: Transition the app from Q1-only to an ongoing operating system.

**Scope**:
1. Quarter selector — switch between Q1, Q2, etc.
2. Historical tracking — "Q1 2026 final: $X"
3. Goal management — update targets per quarter
4. Year-over-year comparisons
5. Territory change tracking (accounts gained/lost)

**Completion criteria**: App works for Q2 2026 without manual hardcoded changes.

---

## Dependencies

```
Phase 1 (Foundation Audit)
  └─► Phase 2 (Stabilize)
       ├─► Phase 3 (Decompose) ── can start in parallel with Phase 4
       └─► Phase 4 (Data Pipeline)
            └─► Phase 5 (Intelligence)
                 └─► Phase 6 (Multi-Quarter)
```

Phase 3 and Phase 4 can run in parallel once Phase 2 is complete. Phase 3 is about code quality; Phase 4 is about data quality. Both are prerequisites for Phase 5.

---

## Timeline Guidance

- **Phase 2** is the immediate next step and should be completable in 1-2 sessions
- **Phase 3** is the biggest investment (multiple sessions) but has the highest long-term payoff
- **Phase 4-6** are post-Q1 work — Q1 ends March 31, 2026
- During Q1 crunch (now through March 31), prioritize bug fixes and usability over architecture
