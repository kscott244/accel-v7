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

// ─── DERIVE SALES ROLLUPS ─────────────────────────────────────────
// Re-derive pyQ / cyQ / products / last for each child account from the
// full accumulated SalesStore, then patch those values into the groups
// array that came from the CSV processor (or preloaded data).
//
// Design:
// - Groups array structure (group → children hierarchy) comes from the
//   CSV parser as before. Only the sales fields on each child are replaced.
// - Children with NO records in the store are left unchanged — the
//   preloaded-data baseline continues to supply their figures.
// - Group-level pyQ / cyQ are re-summed from children after patching,
//   so rollupGroupTotals() downstream will always see fresh group totals.
// - Output shape is identical to processCSVData output — all downstream
//   pipeline steps (hydrateDealer, applyCrmToGroups, applyOverlays, etc.)
//   are untouched.
//
// Products shape (matches csv.ts):
//   { n: l3, py1, py2, py3, py4, pyFY, cy1, cy2, cy3, cy4, cyFY }
//   Capped at top 10 by pyFY descending. Rows with |pyFY| < 50 and
//   |cyFY| < 25 are filtered out (same threshold as csv.ts).
//
// last (daysSince):
//   Derived from the most recent year+month across all records for that
//   child. If no records exist for a child, the existing value is kept.

export function deriveSalesRollups(
  store:  SalesStore,
  groups: any[]
): any[] {
  if (!store || Object.keys(store.records).length === 0) return groups;

  const ref = new Date();

  // ── Index records by childId ──────────────────────────────────
  const byChild: Record<string, SalesRecord[]> = {};
  for (const rec of Object.values(store.records)) {
    if (!byChild[rec.childId]) byChild[rec.childId] = [];
    byChild[rec.childId].push(rec);
  }

  // ── Build per-child rollups ───────────────────────────────────
  const childRollups: Record<string, {
    pyQ:      Record<string, number>;
    cyQ:      Record<string, number>;
    products: any[];
    last:     number;
  }> = {};

  for (const [childId, recs] of Object.entries(byChild)) {
    const pyQ: Record<string, number> = {};
    const cyQ: Record<string, number> = {};
    // product accumulator: l3 → { py1..4, pyFY, cy1..4, cyFY }
    const prodMap: Record<string, Record<string, number>> = {};
    let latestYear  = 0;
    let latestMonth = 0;

    for (const rec of recs) {
      const q = String(rec.quarter);

      // Revenue by quarter
      if (rec.py !== 0) {
        pyQ[q]    = (pyQ[q]    || 0) + rec.py;
        pyQ["FY"] = (pyQ["FY"] || 0) + rec.py;
      }
      if (rec.cy !== 0) {
        cyQ[q]    = (cyQ[q]    || 0) + rec.cy;
        cyQ["FY"] = (cyQ["FY"] || 0) + rec.cy;
      }

      // Products — only when l3 is set
      if (rec.l3) {
        if (!prodMap[rec.l3]) prodMap[rec.l3] = {};
        if (rec.py !== 0) {
          prodMap[rec.l3][`py${q}`]  = (prodMap[rec.l3][`py${q}`]  || 0) + rec.py;
          prodMap[rec.l3]["pyFY"]    = (prodMap[rec.l3]["pyFY"]    || 0) + rec.py;
        }
        if (rec.cy !== 0) {
          prodMap[rec.l3][`cy${q}`]  = (prodMap[rec.l3][`cy${q}`]  || 0) + rec.cy;
          prodMap[rec.l3]["cyFY"]    = (prodMap[rec.l3]["cyFY"]    || 0) + rec.cy;
        }
      }

      // Track most recent period for daysSince
      if (
        rec.year > latestYear ||
        (rec.year === latestYear && rec.month > latestMonth)
      ) {
        latestYear  = rec.year;
        latestMonth = rec.month;
      }
    }

    // Round all revenue values (match csv.ts rounding)
    for (const k of Object.keys(pyQ)) pyQ[k] = Math.round(pyQ[k]);
    for (const k of Object.keys(cyQ)) cyQ[k] = Math.round(cyQ[k]);

    // Build products array — filter + sort same as csv.ts
    const products: any[] = [];
    for (const [l3, vals] of Object.entries(prodMap)) {
      const p: any = { n: l3 };
      for (const [k, v] of Object.entries(vals)) p[k] = Math.round(v);
      if (Math.abs(p.pyFY || 0) >= 50 || Math.abs(p.cyFY || 0) >= 25) {
        products.push(p);
      }
    }
    products.sort((a, b) => Math.abs(b.pyFY || 0) - Math.abs(a.pyFY || 0));

    // Compute daysSince from latest year+month
    let last = 999;
    if (latestYear > 0 && latestMonth > 0) {
      // Use the last day of the latest month as the reference date
      const latestDate = new Date(latestYear, latestMonth - 1, 28);
      last = Math.round((ref.getTime() - latestDate.getTime()) / 86400000);
    }

    childRollups[childId] = {
      pyQ,
      cyQ,
      products: products.slice(0, 10),
      last,
    };
  }

  // ── Patch groups array ────────────────────────────────────────
  return groups.map((g: any) => {
    const patchedChildren = (g.children || []).map((c: any) => {
      const rollup = childRollups[c.id];
      if (!rollup) return c; // no store data — keep preloaded baseline
      return {
        ...c,
        pyQ:      rollup.pyQ,
        cyQ:      rollup.cyQ,
        products: rollup.products,
        last:     rollup.last,
      };
    });

    // Re-sum group-level totals from patched children
    // (same logic as rollupGroupTotals, but always re-sums regardless of
    //  whether group already had pyQ set — needed because we're replacing values)
    const gPyQ: Record<string, number> = {};
    const gCyQ: Record<string, number> = {};
    for (const c of patchedChildren) {
      for (const [k, v] of Object.entries(c.pyQ || {})) {
        gPyQ[k] = (gPyQ[k] || 0) + (v as number);
      }
      for (const [k, v] of Object.entries(c.cyQ || {})) {
        gCyQ[k] = (gCyQ[k] || 0) + (v as number);
      }
    }

    return { ...g, children: patchedChildren, pyQ: gPyQ, cyQ: gCyQ };
  });
}

// ─── COMPACT STORAGE ─────────────────────────────────────────────
// Compact wire format for GitHub/localStorage persistence.
// Records are stored as { q } only — all other fields are encoded
// in the txKey itself ({childId}|{year}|{month}|{l3}|{pyCents}|{cyCents}).
// This reduces a 40K-record store from ~8.6MB to ~2.5MB, fitting
// within Vercel's 4.5MB serverless body limit.
//
// schemaVersion: 2 signals compact format vs. v1 (full records).

export interface CompactSalesStore {
  schemaVersion: 2;
  lastUpdated:   string;
  batches:       SalesBatch[];
  records:       Record<string, { q: number }>;
}

export function toCompactSalesStore(store: SalesStore): CompactSalesStore {
  const compact: Record<string, { q: number }> = {};
  for (const [key, rec] of Object.entries(store.records)) {
    compact[key] = { q: rec.quarter };
  }
  return { schemaVersion: 2, lastUpdated: store.lastUpdated, batches: store.batches, records: compact };
}

// Reconstruct a full SalesStore from compact or legacy full format.
export function hydrateSalesStore(data: CompactSalesStore | SalesStore): SalesStore {
  if (!data) return EMPTY_SALES_STORE;

  // v1 full format — already a SalesStore, pass through
  if ((data as any).schemaVersion !== 2) return data as SalesStore;

  const compact = data as CompactSalesStore;
  const records: Record<string, SalesRecord> = {};

  for (const [txKey, val] of Object.entries(compact.records)) {
    const parts = txKey.split("|");
    if (parts.length < 6) continue;
    // childId|year|month|l3(may contain |)|pyCents|cyCents
    const childId = parts[0];
    const year    = parseInt(parts[1], 10);
    const month   = parseInt(parts[2], 10);
    const cyCents = parseInt(parts[parts.length - 1], 10);
    const pyCents = parseInt(parts[parts.length - 2], 10);
    const l3      = parts.slice(3, parts.length - 2).join("|");
    records[txKey] = {
      txKey,
      childId,
      parentId: "",
      year,
      month,
      quarter:  val.q,
      l3,
      py:       pyCents / 100,
      cy:       cyCents / 100,
      batchId:  "",
    };
  }

  return {
    schemaVersion: 1,
    lastUpdated:   compact.lastUpdated,
    batches:       compact.batches,
    records,
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

// ─── FREQUENCY INDEX ─────────────────────────────────────────────
// Computes per-account order frequency from the accumulated sales history.
// Used by scoreAccount() to detect when an account is unusually overdue
// relative to its own historical ordering cadence — not just absolute days.
//
// Why this matters:
//   A Diamond practice that normally orders every 21 days at day 45 is a
//   very different situation from one that normally orders every 90 days
//   at day 45. The current recency score can't distinguish these. Frequency
//   data provides that context.
//
// freqScore = daysSince / avgIntervalDays
//   > 2.0  → more than 2x overdue by pattern  (strong signal)
//   > 1.5  → 1.5x overdue                     (moderate signal)
//   > 1.25 → slightly overdue                 (weak signal)
//   <= 1.0 → within normal cadence            (no bonus)

export interface FrequencyData {
  avgIntervalDays: number;  // average days between consecutive order months
  orderCount:      number;  // distinct months with CY > 0 seen in store
  freqScore:       number;  // daysSince / avgIntervalDays — computed at build time
}

export function computeFrequencyMap(
  store:       SalesStore,
  lastDaysMap: Record<string, number>  // childId → current days since last order
): Record<string, FrequencyData> {
  const result: Record<string, FrequencyData> = {};
  if (!store || Object.keys(store.records).length === 0) return result;

  // Group distinct order-months (cy != 0) per childId.
  // Multiple records can share the same childId + month (different products)
  // so we deduplicate into a Set of "YYYY-MM" strings.
  const orderMonthsByChild: Record<string, Set<string>> = {};
  for (const rec of Object.values(store.records)) {
    if (rec.cy !== 0) {
      if (!orderMonthsByChild[rec.childId]) orderMonthsByChild[rec.childId] = new Set();
      orderMonthsByChild[rec.childId].add(`${rec.year}-${String(rec.month).padStart(2, "0")}`);
    }
  }

  for (const [childId, monthSet] of Object.entries(orderMonthsByChild)) {
    if (monthSet.size < 2) continue;  // need at least 2 data points

    // Sort months chronologically and compute gaps in days
    const months = Array.from(monthSet).sort();
    let totalDays = 0;
    let gapCount  = 0;

    for (let i = 1; i < months.length; i++) {
      const [prevY, prevM] = months[i - 1].split("-").map(Number);
      const [currY, currM] = months[i].split("-").map(Number);
      // Approximate month-to-month gap — each month ~30.44 days
      const daysDiff = (currY - prevY) * 365 + (currM - prevM) * 30.44;
      // Ignore gaps > 13 months (data holes from missing exports) and < 1 day
      if (daysDiff > 1 && daysDiff < 400) {
        totalDays += daysDiff;
        gapCount++;
      }
    }

    if (gapCount === 0) continue;
    const avgIntervalDays = Math.round(totalDays / gapCount);
    if (avgIntervalDays < 10) continue;  // implausibly high frequency — likely data artifact

    const daysSince = lastDaysMap[childId] ?? 999;
    const freqScore = avgIntervalDays > 0 ? daysSince / avgIntervalDays : 0;

    result[childId] = {
      avgIntervalDays,
      orderCount: monthSet.size,
      freqScore,
    };
  }

  return result;
}
