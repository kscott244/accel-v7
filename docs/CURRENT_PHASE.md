# CURRENT PHASE — accel-v7

## Active: Phase 21 — Search Model Step 3 ✅ Complete

### Goal
Collapse TodayTab search results by parent when the search matches a group name,
so searching "Abra Dental" shows one parent group card instead of N child cards.

### Baseline
Commit `78e533d` — Phase 20 Steps 1-2

### What Was Changed

**src/components/tabs/TodayTab.tsx**
- Replaced flat `searchResults` memo with parent-collapsing logic:
  - Each matched child is classified: did it match on `gName` (parent name) or on its own fields?
  - If `gName` matched AND the group is multi-location → collapse all children into one parent card
  - Children that only matched on their own name/city/addr/st stay as individual child cards
  - Children whose parent is already shown as a collapsed card are excluded (no double-up)
- Added parent card rendering: cyan left border, group name, loc count, group-level PY/CY/gap/ret, "Group · N locs" badge
- Parent card taps → `goGroup()` → GroupDetail
- Child card rendering unchanged
- Added `fixGroupName` import from primitives

### Matching Rules
- Search "abra dental" → matches `gName` on ABRA DENTAL children → shows 1 parent card
- Search "all about kids" → matches child name only → shows that specific child card
- Search "stamford" → matches city on individual children → shows individual child cards
- Single-location groups where gName === name → treated as child match (no collapse needed)

### Files Modified

| File | Change |
|------|--------|
| src/components/tabs/TodayTab.tsx | Parent-collapsing search + parent card rendering |
| docs/CURRENT_PHASE.md | Updated to Phase 21 |

### Deploy
- Commit: `1505cbf`
- Verified live: version API returns matching SHA

---

## Previously Completed: Phase 20 — Search Model Steps 1-2 ✅ Complete
## Previously Completed: Phase 19 — Search Behavior Audit ✅ Complete
## Previously Completed: Phase 18 — Product Monthly Timeline ✅ Complete
## Previously Completed: Phases 1–17 ✅

---

## Last Updated
March 24, 2026
