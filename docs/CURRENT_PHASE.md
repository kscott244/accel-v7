# CURRENT PHASE — accel-v7

## Active: Phase 22 — Search Model Step 4 ✅ Complete

### Goal
Add loc count to the AccountId primitive so multi-location group membership
is visible everywhere an account's identity is displayed.

### Baseline
Commit `9c2124e` — Phase 21

### What Was Changed

**src/components/primitives.tsx**
- AccountId now accepts optional `locs` prop
- When `locs > 1` and parent line is shown, renders: `↳ {gName} · {locs} locs`
- Single-location accounts (locs=1 or undefined) show no suffix — no visual change

**src/components/tabs/TodayTab.tsx**
- Added `groupLocsMap` memo: `gId → locs` lookup built from `groups` prop
- Updated 3 AccountId calls with `locs={groupLocsMap[a.gId]}`:
  - Child search results
  - Overdrive/today focus cards
  - Trip planner modal stops

**src/components/tabs/DealersTab.tsx**
- Updated 2 AccountId calls with locs:
  - Dealer detail location list: `locs={groupLocsMap[a.gId]}`
  - Co-call planner cards: `locs={isMultiLoc?gLocs:undefined}`

**src/components/tabs/AcctDetail.tsx**
- Updated header AccountId: `locs={parentGroup?.locs}`

### Files Modified

| File | Change |
|------|--------|
| src/components/primitives.tsx | AccountId accepts + renders `locs` prop |
| src/components/tabs/TodayTab.tsx | groupLocsMap memo + 3 AccountId updates |
| src/components/tabs/DealersTab.tsx | 2 AccountId updates |
| src/components/tabs/AcctDetail.tsx | 1 AccountId update |
| docs/CURRENT_PHASE.md | Updated to Phase 22 |

### Deploy
- Commit: `c64ffa5`
- Verified live: version API returns matching SHA

---

## Previously Completed: Phase 21 — Search Model Step 3 ✅ Complete
## Previously Completed: Phase 20 — Search Model Steps 1-2 ✅ Complete
## Previously Completed: Phase 19 — Search Behavior Audit ✅ Complete
## Previously Completed: Phases 1–18 ✅

---

## Last Updated
March 24, 2026
