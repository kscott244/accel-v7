// ─── SALES HISTORY ────────────────────────────────────────────────
// Persistent sales-history layer, separate from CRM identity data.
//
// Each SalesRecord represents one de-duplicated sales line item:
// a unique combination of account + period + product + amounts.
// Records are keyed by a deterministic transaction key so the same
// row uploaded twice (in overlapping weekly exports) is never double-counted.
//
// Transaction Key (txKey) format:
//   {childId}|{year}|{month}|{l3}|{pyCents}|{cyCents}
//
//   - childId:  Child MDM ID — identifies the specific office
//   - year:     Calendar year of the invoice (from Invoice Date)
//   - month:    Calendar month 1-12 (from Invoice Date)
//   - l3:       Product L3 name (empty string if no product on row)
//   - pyCents:  PY amount * 100, rounded, as integer (avoids float compare issues)
//   - cyCents:  CY amount * 100, rounded, as integer
//
// Rationale: Tableau weekly exports overlap by ~2 weeks. The same
// invoice row will appear in multiple consecutive exports. Using a
// content-addressed key means de-duplication is free — just check
// if the key already exists in the store.
//
// Storage: data/sales-history.json via GitHub (same pattern as overlays, crm)
// LocalStorage cache key: "sales_history_v1"
// API routes: /api/load-sales  /api/save-sales

export interface SalesRecord {
  txKey:    string;   // deterministic dedup key
  childId:  string;   // Child MDM ID
  parentId: string;   // Parent MDM ID (join key to group)
  year:     number;   // calendar year
  month:    number;   // calendar month 1-12
  quarter:  number;   // 1-4
  l3:       string;   // product L3 name (empty if no product)
  py:       number;   // PY amount (credited wholesale, already post-chargeback)
  cy:       number;   // CY amount
  batchId:  string;   // which upload batch this record came from
}

export interface SalesBatch {
  id:         string;   // uuid-ish: batch_{timestamp}_{rowCount}
  filename:   string;
  uploadedAt: string;   // ISO datetime
  rowCount:   number;   // clean rows processed in this batch
  newRecords: number;   // records inserted (not already in store)
}

export interface SalesStore {
  schemaVersion: number;
  lastUpdated:   string;
  batches:       SalesBatch[];
  records:       Record<string, SalesRecord>; // keyed by txKey
}

export const EMPTY_SALES_STORE: SalesStore = {
  schemaVersion: 1,
  lastUpdated:   new Date().toISOString(),
  batches:       [],
  records:       {},
};

// ─── TRANSACTION KEY ──────────────────────────────────────────────
// Produces a deterministic key for a sales row.
// Using integer cents avoids floating-point comparison issues.
export function buildTxKey(
  childId:  string,
  year:     number,
  month:    number,
  l3:       string,
  py:       number,
  cy:       number
): string {
  const pyCents = Math.round(py * 100);
  const cyCents = Math.round(cy * 100);
  return `${childId}|${year}|${month}|${l3}|${pyCents}|${cyCents}`;
}

// ─── RAW SALES ROW ────────────────────────────────────────────────
// The intermediate shape produced by csv.ts and consumed here.
// Keeps sales.ts free of CSV-parsing dependencies.
export interface RawSalesRow {
  childId:  string;
  parentId: string;
  year:     number;
  month:    number;
  quarter:  number;
  l3:       string;
  py:       number;
  cy:       number;
}

// ─── BUILD SALES RECORDS ─────────────────────────────────────────
// Convert an array of raw sales rows into SalesRecord objects
// (with tx keys), ready to be merged into the store.
// Skips rows where both py and cy are 0.
export function buildSalesRecords(
  rows:    RawSalesRow[],
  batchId: string
): SalesRecord[] {
  const out: SalesRecord[] = [];
  for (const r of rows) {
    if (r.py === 0 && r.cy === 0) continue;
    const txKey = buildTxKey(r.childId, r.year, r.month, r.l3, r.py, r.cy);
    out.push({ txKey, ...r, batchId });
  }
  return out;
}

// ─── MERGE SALES RECORDS ─────────────────────────────────────────
// De-duplicate and merge new records into an existing store.
// Records already present (same txKey) are skipped — no overwrite.
// Appends a new batch entry describing what was inserted.
export function mergeSalesRecords(
  existing: SalesStore,
  newRecords: SalesRecord[],
  batch: Omit<SalesBatch, "newRecords">
): SalesStore {
  const now     = new Date().toISOString();
  const updated = { ...existing.records };
  let   inserted = 0;

  for (const rec of newRecords) {
    if (!updated[rec.txKey]) {
      updated[rec.txKey] = rec;
      inserted++;
    }
  }

  const completedBatch: SalesBatch = { ...batch, newRecords: inserted };

  return {
    schemaVersion: 1,
    lastUpdated:   now,
    batches:       [...(existing.batches || []), completedBatch],
    records:       updated,
  };
}

// ─── STORE SIZE SUMMARY ──────────────────────────────────────────
// Quick diagnostic: how many records and batches are in the store.
export function salesStoreSummary(store: SalesStore) {
  return {
    batchCount:  store.batches.length,
    recordCount: Object.keys(store.records).length,
    lastUpdated: store.lastUpdated,
  };
}
