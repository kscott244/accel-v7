# CURRENT PHASE — accel-v7

## Active: Phase 11 — Sales History Layer ✅ Complete

### Goal
Introduce a persistent, de-duplicated sales-history layer as the foundation for incremental upload ingestion. No UI changes. No behavior changes. Pure additive infrastructure.

### Sales History Model

**Storage**: `data/sales-history.json` (GitHub, same pattern as overlays + crm-accounts)
**LocalStorage cache**: `sales_history_v1`

**Transaction Key** (dedup key):
```
{childId}|{year}|{month}|{l3}|{pyCents}|{cyCents}
```
- Content-addressed: the same invoice row in two overlapping weekly exports maps to the same key
- Integer cents (×100, rounded) avoids floating-point comparison issues
- Empty string for l3 on rows with no product

**SalesStore shape**:
```json
{
  "schemaVersion": 1,
  "lastUpdated": "ISO",
  "batches": [
    { "id": "batch_ts_rowcount", "filename": "...", "uploadedAt": "ISO", "rowCount": N, "newRecords": N }
  ],
  "records": {
    "txKey": { "childId", "parentId", "year", "month", "quarter", "l3", "py", "cy", "batchId" }
  }
}
```

### Files Added

| File | Purpose |
|------|---------|
| `src/lib/sales.ts` | `SalesRecord`, `SalesBatch`, `SalesStore` types; `buildTxKey()`; `buildSalesRecords()`; `mergeSalesRecords()`; `EMPTY_SALES_STORE`; `salesStoreSummary()` |
| `src/app/api/load-sales/route.ts` | GET `data/sales-history.json` from GitHub; returns `{ sales: null }` on 404 |
| `src/app/api/save-sales/route.ts` | POST `data/sales-history.json` to GitHub; handles first-write (no SHA) |

### Files Modified

| File | Change |
|------|--------|
| `src/lib/csv.ts` | Added `import type { RawSalesRow }` from sales; added `rawSalesRows[]` accumulator in row loop (captures non-zero py/cy rows); added `rawSalesRows` to return value of `processCSVData()` |
| `src/components/AccelerateApp.tsx` | Added `buildSalesRecords`/`mergeSalesRecords`/`EMPTY_SALES_STORE` import; added `salesStore` state; wired sales persist block in `handleUpload` (fire-and-forget, same pattern as CRM) |

### Behavior

- On first CSV upload: `data/sales-history.json` is created in GitHub with all non-zero rows from that upload as records
- On subsequent uploads: new records are de-duped by txKey — rows already in the store are skipped; only net-new rows are inserted
- Each upload appends a batch entry recording filename, timestamp, row count, and net-new record count
- Sales persist is fire-and-forget (never blocks upload flow; failure is non-fatal and cached in localStorage)
- All existing rollups, UI, and behavior are completely unchanged — `pyQ`/`cyQ` still come from the existing aggregation pipeline

### What Does NOT Change
- Upload still replaces the working groups array (CY/PY rollups are still recomputed from scratch each upload)
- No UI changes of any kind
- overlays.json untouched
- crm-accounts.json untouched
- All existing tests still pass

### Completion Criteria ✅
- `src/lib/sales.ts` pushed — commit `905db45002`
- `/api/load-sales` pushed — commit `01265f9d96`
- `/api/save-sales` pushed — commit `c1c9141f3d`
- `csv.ts` patched — commit `65d1fad307`
- `AccelerateApp.tsx` patched — commit `c0401b24e8`
- Vercel build in progress

---

## Previously Completed: Phase 10 — CRM / Sales Data Split ✅ Complete

**Goal**: Stop treating CSV uploads as source of truth for account identity. Separate persistent CRM identity from upload-driven sales data.

Files added: `src/lib/crm.ts`, `/api/load-crm`, `/api/save-crm`
Files modified: `csv.ts` (crmCandidates), `AccelerateApp.tsx` (CRM wiring)

---

## Previously Completed: Phase 9 — Import Cleanup Pipeline ✅
## Previously Completed: Phase 8 — Import Manager ✅
## Previously Completed: Phase 7 — Data Pipeline Upgrade ✅
## Previously Completed: Phase 6 — Foundation Hardening ✅
## Previously Completed: Phases 1–5 ✅

---

## Last Updated
March 24, 2026
