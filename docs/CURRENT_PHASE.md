# CURRENT PHASE — accel-v7

## Active: Phase 20 — Search Model Steps 1-2 ✅ Complete

### Goal
Implement the first two low-risk search consistency fixes from the Phase 19 audit.

### Baseline
Commit `04f98c9` — Phase 19 search behavior audit

### What Was Changed

**Step 1: Unified DealersTab navigation**
- `src/components/AccelerateApp.tsx` line 889: changed `goAcct={goAcctFn}` → `goAcct={goSmartFn}`
- DealersTab co-call taps now route multi-location accounts to GroupDetail (consistent with TodayTab)
- Single-location accounts still go to AcctDetail

**Step 2: Unified AccountId in DealersTab co-call list**
- `src/components/tabs/DealersTab.tsx` line 705: added `gName={isMultiLoc?a.gName:undefined}` to AccountId
- Removed duplicate `↳ {a.gName}` from the group context line (Row 3) — AccountId now handles identity display
- Kept the group-level financial context (locs count, Group PY/CY) as a separate line — that's useful info not identity duplication

### Files Modified

| File | Change |
|------|--------|
| src/components/AccelerateApp.tsx | DealersTab goAcctFn → goSmartFn |
| src/components/tabs/DealersTab.tsx | AccountId gName added, group context line cleaned |
| docs/CURRENT_PHASE.md | Updated to Phase 20 |

### Deploy
- Commit: `e925295`
- Verified live: version API returns matching SHA

---

## Previously Completed: Phase 19 — Search Behavior Audit ✅ Complete
## Previously Completed: Phase 18 — Product Monthly Timeline ✅ Complete
## Previously Completed: Phases 1–17 ✅

---

## Last Updated
March 24, 2026
