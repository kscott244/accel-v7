# CURRENT PHASE — accel-v7

## Active: Phase 19 — Search Behavior Audit ✅ Complete

### Goal
Lock the search behavior model before more UI changes are made.
Audit how search works across all tabs, identify inconsistencies,
and recommend a shared model with the lowest-risk implementation path.

### Baseline
Commit `329ce93` — stabilize: revert Steps 1/3/4 UX changes, keep data fix

### What Was Delivered

**docs/SEARCH_AUDIT.md** — full audit document covering:

1. **Entity types**: Child, Parent/Group, Dealer-Parent
2. **Data pipeline**: What each tab receives (scored vs groups vs groupedPrivates)
3. **Search paths audited**:
   - TodayTab: searches `scored` (children), returns individual children, navigates via `goSmartFn`
   - GroupsTab: searches `groups` (parents), returns parent groups, navigates via `goGroupFn`
   - DealersTab: no search bar, but co-call list uses `goAcctFn` (inconsistent with others)
   - AcctDetail: move-group search (internal, parent-level)
   - GroupDetail, EstTab, DashTab, OutreachTab: no search
4. **Inconsistencies found**:
   - Navigation: DealersTab uses `goAcctFn` while TodayTab/DashTab/EstTab use `goSmartFn`
   - Identity display: DealersTab doesn't pass `gName` to AccountId, uses separate hardcoded line
   - Search returns: TodayTab returns N children for a parent name search (should collapse to 1 parent card)
   - Numbers: TodayTab shows child-level PY/CY when user searched by parent name
5. **Recommended shared model**:
   - Child match → child card → AcctDetail (or GroupDetail via goSmartFn for multi-loc)
   - Parent match → parent card with loc count → GroupDetail
   - Dealer-parent is a view mode, not a search result type
6. **Implementation path** (5 steps, ordered by risk):
   - Step 1: Unify DealersTab navigation to goSmartFn (1 line)
   - Step 2: Unify AccountId usage in DealersTab (5 lines)
   - Step 3: Deduplicate TodayTab search by parent (30-50 lines)
   - Step 4: Add loc count to AccountId component (5 lines + callers)
   - Step 5: Optional shared search utility in src/lib/search.ts

### Files Created/Modified

| File | Change |
|------|--------|
| docs/SEARCH_AUDIT.md | New — full audit document |
| docs/CURRENT_PHASE.md | Updated to Phase 19 |

### No Code Changes
This was an audit-only phase. No application code was modified.

---

## Previously Completed: Phase 18 — Product Monthly Timeline ✅ Complete
## Previously Completed: Phase 17 — Weekly Delta Dashboard ✅ Complete
## Previously Completed: Phase 16 — Quarter Switcher ✅
## Previously Completed: Phase 15 — Product Drill-Down in AcctDetail ✅
## Previously Completed: Phases 1–14 ✅

---

## Last Updated
March 24, 2026
