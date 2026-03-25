# CURRENT PHASE — accel-v7

## Active: Phase A11 — Group Product Month Drilldown ✅ Complete

### Goal
Make product rows in GroupDetail inline-drillable so a parent/group acts as a real product command center — without leaving the group screen.

### Baseline
A10 complete: Merge Group workflow verified (already implemented in Phase 23). Commit `192a468`.

### What Was Built

**`src/components/tabs/GroupDetail.tsx`** (commit `d9563fc`)

Added `expandedProduct` state (string|null). Product rows in both "Stopped Buying" and "Currently Buying" sections now toggle an inline month table on tap.

**Interaction:**
- Tap any product row → expands a Month | Q | PY | CY table inline beneath it (newest-first)
- Tap again → collapses
- Small **"Locs"** underline link preserved → still navigates to the existing full-screen by-location drill
- Rotating `›` chevron indicates expand/collapse state
- Border highlight activates on the expanded row (red for stopped, blue for buying)

**Month data:**
- Aggregates `salesStore.records` across all children in the group where `r.l3 === productName`
- Buckets by `r.month` (1–12), rolled up across all child locations
- Displays newest-first (Dec → Jan), filtered to months with any PY or CY data
- Quarter column derived from month: Q1=Jan–Mar, Q2=Apr–Jun, Q3=Jul–Sep, Q4=Oct–Dec
- Empty state: "No monthly history — upload a CSV with sales data to populate"

**No changes to:** merge workflow, search, upload pipeline, full-screen drill, data architecture.

---

## Previously Completed
- A10 — Merge Group workflow verified (192a468) ✅
- A9 — adjs cross-device via overlays (f2475b9 + 0a4c11d) ✅
- A8 — Cross-device state audit ✅
- A7 — Overlay schema hardening (dealerManualReps) ✅
- A6 — DealersTab durable rep persistence ✅
- Phase 23 — GroupDetail Upgrade ✅
- Phases 1–22 ✅

---

## Last Updated
March 25, 2026
