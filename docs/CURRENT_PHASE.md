# CURRENT PHASE — accel-v7

## Active: Phase 17 — Weekly Delta Dashboard ✅ Complete

### Goal
Show Ken what changed between his last two CSV uploads — accounts that
reactivated, accounts that went dark, and big revenue movers — so the
first thing he sees each week is what needs attention.

### What Was Built

**src/lib/weeklyDelta.ts** (new file)
- WeeklySnapshot type: stores q, cy map, py map, uploadedAt timestamp
- buildSnapshot(accounts, q): snapshot the current leaf-level cyQ values
- computeDelta(prev, accounts, q): diffs prev snapshot vs current data
  - reactivated: was $0 CY, now has revenue (sorted by currCY desc, max 8)
  - wentDark: had CY revenue, now $0 (sorted by prevCY desc, max 8)
  - bigMovers: |diff| >= $300 (sorted by abs diff desc, max 8)
- saveSnapshot / loadSnapshot: localStorage("weekly_snapshot_v1") persistence

**src/components/AccelerateApp.tsx**
- Imports weeklyDelta lib
- weeklyDelta state added
- On CSV upload: loads previous snapshot, runs computeDelta if same quarter,
  then saves new snapshot; sets weeklyDelta state
- Passes weeklyDelta prop to TodayTab

**src/components/tabs/TodayTab.tsx**
- Accepts weeklyDelta prop
- deltaOpenState: defaults open (true), collapses on tap
- Renders "What changed" card between search bar and KPI strip when delta exists
- Collapsed header shows pill badges: reactivated count (green), dark count (red), movers count (amber)
- Expanded: three sections, each row tappable — routes to AcctDetail via goAcct

### Files Modified

| File | Commit |
|------|--------|
| src/lib/weeklyDelta.ts | b19cf7d6 (new) |
| src/components/AccelerateApp.tsx | 25d309dc |
| src/components/tabs/TodayTab.tsx | 5e2fd06b |

---

## Previously Completed: Phase 16 — Quarter Switcher ✅
## Previously Completed: Phase 15 — Product Drill-Down in AcctDetail ✅
## Previously Completed: Phases 1–14 ✅

---

## Last Updated
March 24, 2026
