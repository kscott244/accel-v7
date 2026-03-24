# CURRENT PHASE — accel-v7

## Active: Phase 16 — Quarter Switcher ✅ Complete

### Goal
Make the app quarter-aware so it works correctly for Q2, Q3, and Q4 without
hardcoded Q1 logic. Auto-detect the active quarter from loaded data, allow
the user to override it, and wire it through scoring, KPIs, and all tabs.

### What Was Built

**src/lib/tokens.ts**
- Added QUARTER_TARGETS record: Q1=8,915 Q2=\89,602 Q3=\94,888 Q4=\94,689
- Added daysLeftInQuarter(q) function — returns days remaining in any quarter
- Added quarterLabel(q) helper — returns "Q2 2026" style string
- Kept Q1_TARGET and DAYS_LEFT as legacy exports (backward compat)

**src/lib/format.ts**
- scoreAccount() reasons now say "Q{q} close — act now" and "Q{q} closing window"
  instead of hardcoded "Q1 close" strings

**src/components/AccelerateApp.tsx**
- Added activeQ state — persisted to localStorage("active_quarter")
- Auto-detects activeQ after data loads: highest quarter with CY > 0
- Also auto-detects on CSV upload
- Compact Q1/Q2/Q3/Q4 pill switcher in header — only shows quarters with data,
  hidden when only one quarter has data (no clutter for current Q1-only datasets)
- Header attainment badge uses daysLeftInQuarter(activeQ)
- Scoring (scored useMemo) uses activeQ for scoreAccount()
- q1CYFromData, q1Gap, q1Att all use activeQ and QUARTER_TARGETS[activeQ]
- activeQ passed as prop to TodayTab, DashTab, DealersTab

**src/components/tabs/TodayTab.tsx**
- Accepts activeQ prop from parent (removed local activeQ useMemo)
- All pyQ/cyQ["1"] references replaced with [activeQ]
- daysLeftInQuarter(activeQ) used for endgame/sprint/cruise thresholds
- kpiData uses QUARTER_TARGETS[activeQ] for target and daysLeftInQuarter(activeQ) for perDay
- Dependency arrays updated to include activeQ

**src/components/tabs/DashTab.tsx**
- Accepts activeQ prop
- Header shows "Q{activeQ} 2026" instead of hardcoded "Q1 2026"
- Target shows QUARTER_TARGETS[activeQ] instead of hardcoded 8,915
- All pyQ/cyQ["1"] references replaced with [activeQ]

**src/components/tabs/DealersTab.tsx**
- Accepts activeQ prop
- All 18 pyQ/cyQ["1"] references replaced with [activeQ]

### Files Modified

| File | Commit |
|------|--------|
| src/lib/tokens.ts | 4d81cf00 |
| src/lib/format.ts | 35a55e65 |
| src/components/AccelerateApp.tsx | b677511d |
| src/components/tabs/TodayTab.tsx | f06dc2d0 |
| src/components/tabs/DashTab.tsx | dfca07de |
| src/components/tabs/DealersTab.tsx | 3112ae23 |

---

## Previously Completed: Phase 15 — Product Drill-Down in AcctDetail ✅
## Previously Completed: Phase 14 — Account-Level Sales History in AcctDetail ✅
## Previously Completed: Phase 13 — Sales History UI in Admin Tab ✅
## Previously Completed: Phase 12 — Incremental Rollup Derivation ✅
## Previously Completed: Phase 11 — Sales History Layer ✅
## Previously Completed: Phase 10 — CRM / Sales Data Split ✅
## Previously Completed: Phases 1–9 ✅

---

## Last Updated
March 24, 2026
