# CURRENT PHASE — accel-v7

## Active: Phase 13 — Sales History UI in Admin Tab ✅ Complete

### Goal
Surface the sales-history layer in the Admin tab so Ken can see which CSVs
have been uploaded, when, and how many new records each one contributed.

### What Was Built
A new **📜 History** section tab added to the existing AdminTab section nav.
No existing sections were touched. Purely additive.

**History section displays:**
- **Store Totals card**: total upload batches, total de-duped records, last updated date
- **Upload Batches card**: reverse-chronological list of every batch — filename,
  date/time, row count, and new records added (green when > 0, dimmed when 0 = all deduped)

**Empty state**: shown when no uploads have been recorded yet.

**Styling**: uses the exact `Section` / `StatRow` component pattern already in the
`data` section — same `T.s1` background, same monospace values, same border tokens.

### Files Modified

| File | Change |
|------|--------|
| `src/components/tabs/AdminTab.tsx` | (1) Added `salesStore?:any` to props; (2) Added `"📜 History"` nav button; (3) Added `section==="history"` render block |
| `src/components/AccelerateApp.tsx` | Added `salesStore={salesStore}` prop to `<AdminTab>` render call |

### Commits
- `b0a23cff7b` — AdminTab: add Sales History section
- `bc14ab8f6c` — AccelerateApp: pass salesStore prop to AdminTab

---

## Previously Completed: Phase 12 — Incremental Rollup Derivation ✅
- `deriveSalesRollups()` re-derives pyQ/cyQ/products/last from full history
- Wired into upload handler and boot sequence

## Previously Completed: Phase 11 — Sales History Layer ✅
- `src/lib/sales.ts`, `/api/load-sales`, `/api/save-sales`
- `csv.ts` emits `rawSalesRows`, AccelerateApp persists on upload

## Previously Completed: Phase 10 — CRM / Sales Data Split ✅
## Previously Completed: Phase 9 — Import Cleanup Pipeline ✅
## Previously Completed: Phase 8 — Import Manager ✅
## Previously Completed: Phase 7 — Data Pipeline Upgrade ✅
## Previously Completed: Phase 6 — Foundation Hardening ✅
## Previously Completed: Phases 1–5 ✅

---

## Last Updated
March 24, 2026
