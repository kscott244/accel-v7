# CURRENT PHASE — accel-v7

## Active: Phase 14 — Account-Level Sales History in AcctDetail ✅ Complete

### Goal
Surface per-account sales history records in the AcctDetail view so Ken can
see exactly which months are on record for any given account.

### What Was Built
A **Sales History** card added to AcctDetail, positioned after the Activity Log
and before the Group Link modal. Purely additive — no existing cards touched.

**Display:**
- Reads `salesStore.records` and filters to records where `childId === acct.id`
- Sorted newest-first (year desc, month desc)
- Grid table: Month | Q | PY | CY
  - Month: "Jan 2025" format
  - Q: Q1–Q4
  - PY: monospace, dimmed when zero
  - CY: monospace, cyan when positive, dimmed when zero
- Row count shown at bottom right
- Empty state: "No history on record — upload a CSV to populate."

**Styling:** matches existing AcctDetail card pattern exactly —
`T.s1` background, `T.b1` border, `borderRadius:16`, `padding:16`, `marginBottom:12`,
`animationDelay:"300ms"` (next in sequence after activity log at 280ms).

### Files Modified

| File | Change |
|------|--------|
| `src/components/tabs/AcctDetail.tsx` | Added `salesStore=null` prop; inserted Sales History card before GROUP LINK MODAL comment |
| `src/components/AccelerateApp.tsx` | Added `salesStore={salesStore}` to the `<AcctDetail>` render call |

### Commits
- `4eb1922554` — AcctDetail: Sales History card
- `1d266a2b0b` — AccelerateApp: pass salesStore to AcctDetail

---

## Previously Completed: Phase 13 — Sales History UI in Admin Tab ✅
## Previously Completed: Phase 12 — Incremental Rollup Derivation ✅
## Previously Completed: Phase 11 — Sales History Layer ✅
## Previously Completed: Phase 10 — CRM / Sales Data Split ✅
## Previously Completed: Phase 9 — Import Cleanup Pipeline ✅
## Previously Completed: Phase 8 — Import Manager ✅
## Previously Completed: Phase 7 — Data Pipeline Upgrade ✅
## Previously Completed: Phase 6 — Foundation Hardening ✅
## Previously Completed: Phases 1–5 ✅

---

## Last Updated
March 24, 2026
