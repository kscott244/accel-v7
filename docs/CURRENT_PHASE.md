# CURRENT PHASE — accel-v7

## Active: Phase 12 — Incremental Rollup Derivation ✅ Complete

### Goal
Use the Phase 11 sales-history layer to drive rollup display. Instead of
replacing pyQ/cyQ from scratch on every upload, re-derive from accumulated
history so overlapping weekly Tableau exports accumulate correctly.

### deriveSalesRollups Design

**Location**: `src/lib/sales.ts` — exported alongside the existing merge functions

**Inputs**:
- `store: SalesStore` — the full accumulated sales history
- `groups: any[]` — the groups array from the CSV processor (or preloaded data)
  used as the structural skeleton (hierarchy, identity fields)

**Algorithm**:
1. Index all `SalesRecord` entries by `childId`
2. For each child with records: sum `py`/`cy` into `pyQ[quarter]` + `pyQ["FY"]`,
   build `products` map keyed by `l3`, track latest `year+month` for `daysSince`
3. Round all revenue values (matches csv.ts rounding)
4. Filter products: `|pyFY| >= 50 || |cyFY| >= 25` (same threshold as csv.ts)
5. Sort products by `|pyFY|` descending, cap at 10 (same as csv.ts)
6. Patch each child in the groups array: replace `pyQ`, `cyQ`, `products`, `last`
   — children with **no store records** are left unchanged (preloaded baseline kept)
7. Re-sum group-level `pyQ`/`cyQ` from patched children (always, replacing old values)

**Output**: same `groups` shape as `processCSVData` — all downstream pipeline
steps (`rollupGroupTotals → hydrateDealer → applyCrmToGroups → applyOverlays →
applyGroupOverrides → scoreAccount`) are untouched.

### Upload Flow (new)

```
CSV upload
  → processCSVData()        — extracts groups skeleton + rawSalesRows
  → buildSalesRecords()     — assigns txKeys
  → mergeSalesRecords()     — dedupes into SalesStore, persists to GitHub async
  → deriveSalesRollups()    — re-derives pyQ/cyQ/products/last from FULL history
  → rollupGroupTotals()     — re-sums group totals (now a no-op since deriveSalesRollups does it)
  → hydrateDealer()
  → applyCrmToGroups()
  → applyOverlays()
  → applyGroupOverrides()
  → setGroups()             — UI updates
```

### Boot Flow (new)

```
Boot
  → load sales_history_v1 from localStorage → setSalesStore + bootSalesStore local var
  → fetch /api/load-sales in background (same non-blocking pattern as CRM)
  → load accel_data_v2 from localStorage
  → deriveSalesRollups(bootSalesStore, parsed.groups)  ← NEW
  → rollupGroupTotals → hydrateDealer → applyOverlays → applyGroupOverrides → setGroups
```

### Files Modified

| File | Change |
|------|--------|
| `src/lib/sales.ts` | Added `deriveSalesRollups(store, groups)` — 80 lines; produces fully-derived pyQ/cyQ/products/last per child from accumulated store records |
| `src/components/AccelerateApp.tsx` | 3 patches: (1) added `deriveSalesRollups` to import; (2) wired re-derive in `handleUpload` after `mergeSalesRecords`; (3) wired re-derive in boot sequence after sales localStorage load |

### Behavior

- **First upload**: sales history has only this upload's rows → rollups identical to before
- **Second upload (overlapping export)**: duplicate rows deduped by txKey → rollups unchanged (correct — not double-counted)
- **Third upload (new week's data)**: net-new rows merged → rollups reflect all history since first upload
- **Boot with existing sales_history_v1**: rollups re-derived from full store, not just last-uploaded snapshot
- **No upload yet (preloaded data path)**: `deriveSalesRollups` receives `EMPTY_SALES_STORE` → returns groups unchanged (preloaded baseline fully preserved)
- UI, scoring, overlays, CRM — all unchanged

### Commits
- `36fb306bd1` — `deriveSalesRollups` added to `src/lib/sales.ts`
- `808cb74f44` — AccelerateApp.tsx wired (import + upload + boot)

---

## Previously Completed: Phase 11 — Sales History Layer ✅
- `src/lib/sales.ts` (types + buildSalesRecords + mergeSalesRecords)
- `/api/load-sales`, `/api/save-sales`
- `csv.ts` emits `rawSalesRows`; AccelerateApp persists on upload

## Previously Completed: Phase 10 — CRM / Sales Data Split ✅
## Previously Completed: Phase 9 — Import Cleanup Pipeline ✅
## Previously Completed: Phase 8 — Import Manager ✅
## Previously Completed: Phase 7 — Data Pipeline Upgrade ✅
## Previously Completed: Phase 6 — Foundation Hardening ✅
## Previously Completed: Phases 1–5 ✅

---

## Last Updated
March 24, 2026
