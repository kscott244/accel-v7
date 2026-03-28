// ─── CSV PROCESSOR ───────────────────────────────────────────────
// Rules are permanent — future uploads with the same Tableau headers
// will always produce clean, consistent output regardless of what
// values Tableau puts in Acct Type or Class 4.
//
// Depends on: DEALERS (static data), tier helpers
// Used by: AdminTab (CSV upload), preloaded-data.ts generation

import { normalizeTier, isTop100, normalizePracticeType, extractGroupName } from "./tier";
import MANUAL_PARENTS from "@/data/manual-parents.json";

// Build childId → manualParentId lookup once at module load
const MANUAL_PARENT_MAP: Record<string, string> = {};
const MANUAL_PARENT_INFO: Record<string, any> = {};
for (const [pid, def] of Object.entries(MANUAL_PARENTS as Record<string, any>)) {
  MANUAL_PARENT_INFO[pid] = def;
  for (const cid of (def.childIds || [])) {
    MANUAL_PARENT_MAP[cid] = pid;
  }
}
import type { RawSalesRow } from "./sales";

// DEALERS is loaded at call time via the caller passing it in,
// or falls back to empty. This keeps the module free of direct data imports.
let _dealers: Record<string, string> = {};
export function setDealers(d: Record<string, string>) { _dealers = d; }

// ─── IMPORT REPORT ───────────────────────────────────────────────
export interface ImportReport {
  filename: string;
  timestamp: string;
  delimiterDetected: "comma" | "tab" | "unknown";
  encodingDetected: "UTF-8" | "UTF-8 BOM" | "Windows-1252 (likely)" | "unknown";
  totalRawRows: number;
  blankRowsSkipped: number;
  grandTotalRowsSkipped: number;
  summaryRowsSkipped: number;
  noDateRowsSkipped: number;
  noMdmRowsSkipped: number;
  cleanRowsProcessed: number;
  uniqueParents: number;
  uniqueOffices: number;
  zeroRevenueOfficesDropped: number;
  finalOffices: number;
  finalGroups: number;
  warnings: ImportWarning[];
}

export interface ImportWarning {
  code: string;
  label: string;
  count: number;
  examples: string[];
}

// ─── ENCODING DETECTION ──────────────────────────────────────────
// Called on raw text BEFORE BOM stripping so BOM is detectable.
function detectEncoding(text: string): "UTF-8 BOM" | "Windows-1252 (likely)" | "UTF-8" {
  if (text.charCodeAt(0) === 0xFEFF) return "UTF-8 BOM";
  for (let i = 0; i < Math.min(text.length, 4000); i++) {
    const c = text.charCodeAt(i);
    if (c >= 0x80 && c <= 0x9F) return "Windows-1252 (likely)";
  }
  return "UTF-8";
}

// ─── DELIMITER DETECTION ─────────────────────────────────────────
// Count unquoted tabs vs commas in the header line.
function detectDelimiter(header: string): "comma" | "tab" {
  let tabs = 0, commas = 0, inQ = false;
  for (let i = 0; i < header.length; i++) {
    const c = header[i];
    if (c === '"') { inQ = !inQ; continue; }
    if (inQ) continue;
    if (c === "\t") tabs++;
    else if (c === ",") commas++;
  }
  return tabs > commas ? "tab" : "comma";
}

// ─── CANONICAL HEADER MAP ─────────────────────────────────────────
// Tableau column names vary by export settings. This map lets us look up
// the correct raw header regardless of casing or extra whitespace.
// Keys are lowercase-trimmed; values are the canonical names the rest of
// the pipeline uses.
const HEADER_ALIASES: Record<string, string> = {
  // MDM IDs
  "parent mdm id":        "Parent MDM ID",
  "parentmdmid":          "Parent MDM ID",
  "child mdm id":         "Child Mdm Id",
  "childmdmid":           "Child Mdm Id",
  "child mdm  id":        "Child Mdm Id",   // double-space variant seen in exports
  // Names
  "parent name":          "Parent Name",
  "parentname":           "Parent Name",
  "child name":           "Child Name",
  "childname":            "Child Name",
  // Date
  "invoice date":         "Invoice Date",
  "invoicedate":          "Invoice Date",
  // Revenue
  "py":                   "PY",
  "cy":                   "CY",
  // Product
  "l3":                   "L3",
  // Account type / tier
  "acct type":            "Acct Type",
  "accttype":             "Acct Type",
  "account type":         "Acct Type",
  // Class fields
  "sds cust class2":      "Sds Cust Class2",
  "sdscustclass2":        "Sds Cust Class2",
  "sds cust class 2":     "Sds Cust Class2",
  "class 4":              "Class 4",
  "class4":               "Class 4",
  // Address
  "city":                 "City",
  "state":                "State",
  "addr":                 "Addr",
  "address":              "Addr",
  "street":               "Addr",
};

// Build a lookup from raw header → canonical name.
// For headers not in the alias map, pass through trimmed as-is.
function buildHeaderMap(rawHeaders: string[]): (raw: string) => string {
  const resolved: Record<string, string> = {};
  for (const h of rawHeaders) {
    const key = h.trim().toLowerCase().replace(/\s+/g, " ");
    resolved[h] = HEADER_ALIASES[key] || h.trim();
  }
  return (raw: string) => resolved[raw] ?? raw.trim();
}

// ─── LINE SPLITTER ───────────────────────────────────────────────
// Handles quoted fields for both comma and tab delimiters.
function splitLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      // Handle escaped double-quote ""
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; continue; }
      inQuotes = !inQuotes;
    } else if (c === delimiter && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += c;
    }
  }
  result.push(current);
  return result;
}

// ─── NUMERIC COERCION ────────────────────────────────────────────
// Handles: "1,234.56"  "$1,234.56"  "(1234.56)" [negatives]  " 0 "
function coerceNumber(raw: string): number {
  if (!raw) return 0;
  let s = raw.trim().replace(/\$/g, "").replace(/,/g, "");
  // Parentheses = negative: (1234) → -1234
  if (s.startsWith("(") && s.endsWith(")")) s = "-" + s.slice(1, -1);
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// ─── DATE COERCION ───────────────────────────────────────────────
// Handles: M/D/YYYY  MM/DD/YYYY  M/D/YY  YYYY-MM-DD
// Returns { month, year, date } or null if unparseable.
function coerceDate(raw: string): { month: number; year: number; dt: Date } | null {
  if (!raw) return null;
  const s = raw.trim();

  // ISO: YYYY-MM-DD
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const year = parseInt(iso[1]), month = parseInt(iso[2]), day = parseInt(iso[3]);
    if (month < 1 || month > 12) return null;
    return { month, year, dt: new Date(year, month - 1, day) };
  }

  // M/D/YYYY or M/D/YY
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (mdy) {
    let year = parseInt(mdy[3]);
    const month = parseInt(mdy[1]);
    const day   = parseInt(mdy[2]);
    // 2-digit year: 00–49 → 2000s, 50–99 → 1900s
    if (year < 100) year += year < 50 ? 2000 : 1900;
    if (month < 1 || month > 12) return null;
    return { month, year, dt: new Date(year, month - 1, day) };
  }

  return null;
}

// ─── JUNK ROW DETECTION ──────────────────────────────────────────
// Tableau emits various summary/total rows. Catch all patterns.
function isJunkRow(row: Record<string, string>): "blank" | "grandtotal" | "summary" | null {
  // All values empty or whitespace
  if (Object.values(row).every(v => !v.trim())) return "blank";

  const parentName = (row["Parent Name"] || "").trim().replace(/[()]/g, "").toLowerCase();
  const parentId   = (row["Parent MDM ID"] || "").trim().toLowerCase();
  const childId    = (row["Child Mdm Id"] || "").trim().toLowerCase();

  // Grand Total rows (various spellings Tableau uses)
  if (parentName.startsWith("grand total") || parentName === "grand total") return "grandtotal";

  // Summary rows: "Total" in the ID columns, or both IDs equal "Total"
  if (parentId === "total" || childId === "total") return "summary";
  if (parentId === "" && childId === "" && parentName === "") return "blank";

  return null;
}

// ─── MAIN PARSE ENTRY POINT ──────────────────────────────────────
// Replaces the old parseCSV + parseCSVLine pair.
// Returns typed rows with canonical header names.
export function parseCSV(rawText: string): Record<string, string>[] {
  // Strip BOM if present
  const text = rawText.charCodeAt(0) === 0xFEFF ? rawText.slice(1) : rawText;

  // Split into lines — handle \r\n (Windows) and \n (Unix)
  const lines = text.split(/\r?\n/);
  if (lines.length === 0) return [];

  const delimiter = detectDelimiter(lines[0]) === "tab" ? "\t" : ",";
  const rawHeaders = splitLine(lines[0], delimiter);
  const resolveHeader = buildHeaderMap(rawHeaders);

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const vals = splitLine(line, delimiter);
    const row: Record<string, string> = {};
    rawHeaders.forEach((h, j) => {
      row[resolveHeader(h)] = (vals[j] ?? "").trim();
    });
    rows.push(row);
  }
  return rows;
}

// Keep old parseCSVLine exported for any callers that reference it directly
export function parseCSVLine(line: string): string[] {
  return splitLine(line, ",");
}

// ─── MAIN PROCESSOR ──────────────────────────────────────────────
export function processCSVData(
  rows: Record<string, string>[],
  rawText = "",
  filename = ""
) {
  // ── Format detection (needs rawText before BOM strip) ─────────
  const encodingDetected  = rawText ? detectEncoding(rawText) : "unknown";
  const strippedText      = (rawText && rawText.charCodeAt(0) === 0xFEFF) ? rawText.slice(1) : rawText;
  const firstLine         = strippedText ? strippedText.split(/\r?\n/)[0] : "";
  const delimiterDetected = firstLine ? detectDelimiter(firstLine) : "unknown";

  // ── Warning accumulators ──────────────────────────────────────
  const unknownTierCounts: Record<string, number>   = {};
  const missingParentExamples: string[]              = [];

  // ── Row-level skip counters ───────────────────────────────────
  let blankRowsSkipped      = 0;
  let grandTotalRowsSkipped = 0;
  let summaryRowsSkipped    = 0;
  let noDateRowsSkipped     = 0;
  let noMdmRowsSkipped      = 0;
  let cleanRowsProcessed    = 0;

  const childInfo:      Record<string, any>                                    = {};
  const childPyQ:       Record<string, Record<string, number>>                 = {};
  const childCyQ:       Record<string, Record<string, number>>                 = {};
  const childProds:     Record<string, Record<string, Record<string, number>>> = {};
  const parentInfo:     Record<string, any>                                    = {};
  const parentChildren: Record<string, Set<string>>                            = {};
  const childLastDate:  Record<string, Date>                                   = {};
  const allChildIds:    Set<string>                                            = new Set();
  const rawSalesRows:   RawSalesRow[]                                          = [];
  const ref = new Date();

  for (const row of rows) {
    // ── Junk row filter ──────────────────────────────────────────
    const junk = isJunkRow(row);
    if (junk === "blank")      { blankRowsSkipped++;      continue; }
    if (junk === "grandtotal") { grandTotalRowsSkipped++; continue; }
    if (junk === "summary")    { summaryRowsSkipped++;    continue; }

    // ── Date coercion ────────────────────────────────────────────
    const dateResult = coerceDate(row["Invoice Date"] || "");
    if (!dateResult) { noDateRowsSkipped++; continue; }
    const { month, year, dt } = dateResult;
    const q = Math.ceil(month / 3);

    // ── Numeric coercion ─────────────────────────────────────────
    // RULE: PY and CY are already credited wholesale — do NOT re-apply chargeback
    const py = coerceNumber(row["PY"] || "");
    const cy = coerceNumber(row["CY"] || "");

    const childId  = (row["Child Mdm Id"]  || "").trim();
    const parentId = (row["Parent MDM ID"] || "").trim();
    const l3       = (row["L3"]            || "").trim();

    if (!childId || !parentId) { noMdmRowsSkipped++; continue; }

    allChildIds.add(childId);

    // ── Raw sales row — for persistent sales-history layer ───────
    // Captured before any aggregation so each invoice row is recorded
    // individually. buildSalesRecords() in sales.ts will skip py=cy=0 rows.
    if (py !== 0 || cy !== 0) {
      rawSalesRows.push({ childId, parentId, year, month, quarter: q, l3, py, cy });
    }

    // ── Tier warning accumulation ────────────────────────────────
    const rawTier = (row["Acct Type"] || "").trim();
    if (rawTier) {
      const normalized = normalizeTier(rawTier);
      const KNOWN_TIERS = new Set([
        "Standard","Top 100","HOUSE ACCOUNTS","Silver","Gold","Platinum","Diamond",
        "Top 100-Gold","Top 100-Diamond","Top 100-Platinum","Top 100-Silver",
      ]);
      if (normalized === "Standard" && !KNOWN_TIERS.has(rawTier)) {
        unknownTierCounts[rawTier] = (unknownTierCounts[rawTier] || 0) + 1;
      }
    }

    // ── Missing Parent Name warning ──────────────────────────────
    if (!row["Parent Name"] && missingParentExamples.length < 3) {
      if (!missingParentExamples.includes(parentId)) missingParentExamples.push(parentId);
    }

    // ── Revenue accumulation ─────────────────────────────────────
    if (!childPyQ[childId]) childPyQ[childId] = {};
    if (!childCyQ[childId]) childCyQ[childId] = {};
    if (py !== 0) {
      childPyQ[childId][q]     = (childPyQ[childId][q]     || 0) + py;
      childPyQ[childId]["FY"]  = (childPyQ[childId]["FY"]  || 0) + py;
    }
    if (cy !== 0) {
      childCyQ[childId][q]     = (childCyQ[childId][q]     || 0) + cy;
      childCyQ[childId]["FY"]  = (childCyQ[childId]["FY"]  || 0) + cy;
    }

    // ── Product accumulation ─────────────────────────────────────
    if (l3) {
      if (!childProds[childId])      childProds[childId]      = {};
      if (!childProds[childId][l3])  childProds[childId][l3]  = {};
      if (py !== 0) {
        childProds[childId][l3][`py${q}`] = (childProds[childId][l3][`py${q}`] || 0) + py;
        childProds[childId][l3]["pyFY"]   = (childProds[childId][l3]["pyFY"]   || 0) + py;
      }
      if (cy !== 0) {
        childProds[childId][l3][`cy${q}`] = (childProds[childId][l3][`cy${q}`] || 0) + cy;
        childProds[childId][l3]["cyFY"]   = (childProds[childId][l3]["cyFY"]   || 0) + cy;
      }
    }

    if ((py !== 0 || cy !== 0) && (!childLastDate[childId] || dt > childLastDate[childId])) {
      childLastDate[childId] = dt;
    }

    // ── RULE: Pricing tier from Acct Type; practice type from Sds Cust Class2 ──
    if (!childInfo[childId]) {
      childInfo[childId] = {
        name:     row["Child Name"]      || "",
        city:     row["City"]            || "",
        st:       row["State"]           || "",
        addr:     row["Addr"]            || "",
        tier:     normalizeTier(row["Acct Type"]),
        top100:   isTop100(row["Acct Type"]),
        class2:   row["Sds Cust Class2"] || "",
        parentId,
      };
    }

    // ── RULE: Group name always from Parent Name — never Class 4 ──
    if (parentId && !parentInfo[parentId]) {
      parentInfo[parentId] = {
        name:   extractGroupName(row["Parent Name"], row["Class 4"], row["Child Name"]),
        tier:   normalizeTier(row["Acct Type"]),
        class2: normalizePracticeType(row["Sds Cust Class2"]),
      };
    }

    if (!parentChildren[parentId]) parentChildren[parentId] = new Set();
    parentChildren[parentId].add(childId);

    cleanRowsProcessed++;
  }

  // ── Apply manual parent remaps ──────────────────────────────────
  // If a childId belongs to a manual parent group, reassign it from its
  // Tableau parentId to the manual parent. This survives every CSV upload.
  for (const cid of Array.from(allChildIds)) {
    const manualPid = MANUAL_PARENT_MAP[cid];
    if (!manualPid) continue;
    const originalPid = childInfo[cid]?.parentId;
    if (!originalPid || originalPid === manualPid) continue;

    // Move child from original parent to manual parent
    if (parentChildren[originalPid]) {
      parentChildren[originalPid].delete(cid);
      if (parentChildren[originalPid].size === 0) delete parentChildren[originalPid];
    }
    if (!parentChildren[manualPid]) parentChildren[manualPid] = new Set();
    parentChildren[manualPid].add(cid);

    // Set manual parent info if not already set
    if (!parentInfo[manualPid]) {
      const mp = MANUAL_PARENT_INFO[manualPid];
      parentInfo[manualPid] = {
        name: mp.name,
        tier: mp.tier || "Standard",
        class2: mp.class2 || "DSO",
      };
    }
  }

  // ── Build groups ──────────────────────────────────────────────
  let zeroRevenueOfficesDropped = 0;
  let finalOffices = 0;
  const groups: any[] = [];

  for (const [pid, childIdSet] of Object.entries(parentChildren)) {
    const pi       = parentInfo[pid] || {};
    const children: any[] = [];
    const gPy: Record<string, number> = {};
    const gCy: Record<string, number> = {};

    for (const cid of Array.from(childIdSet)) {
      const ci   = childInfo[cid] || {};
      const pyQ: Record<string, number> = {};
      const cyQ: Record<string, number> = {};
      for (const [k, v] of Object.entries(childPyQ[cid] || {})) { pyQ[String(k)] = Math.round(v as number); }
      for (const [k, v] of Object.entries(childCyQ[cid] || {})) { cyQ[String(k)] = Math.round(v as number); }

      const products: any[] = [];
      for (const [l3, vals] of Object.entries(childProds[cid] || {})) {
        const p: any = { n: l3 };
        for (const [k, v] of Object.entries(vals)) { p[k] = Math.round(v as number); }
        if (Math.abs(p.pyFY || 0) >= 50 || Math.abs(p.cyFY || 0) >= 25) products.push(p);
      }
      products.sort((a, b) => Math.abs(b.pyFY || 0) - Math.abs(a.pyFY || 0));

      const last      = childLastDate[cid];
      const daysSince = last ? Math.round((ref.getTime() - last.getTime()) / 86400000) : 999;

      const hasMoney = Object.values(pyQ).some(v => v !== 0) || Object.values(cyQ).some(v => v !== 0);
      if (!hasMoney) { zeroRevenueOfficesDropped++; continue; }

      finalOffices++;
      children.push({
        id:       cid,
        name:     ci.name,
        city:     ci.city,
        st:       ci.st,
        addr:     ci.addr   || "",
        tier:     ci.tier   || "Standard",
        top100:   ci.top100 || false,
        class2:   ci.class2 || "",
        last:     daysSince,
        pyQ,
        cyQ,
        products: products.slice(0, 10),
        dealer:   _dealers[cid] || "All Other",
      });

      for (const [k, v] of Object.entries(pyQ)) gPy[k] = (gPy[k] || 0) + v;
      for (const [k, v] of Object.entries(cyQ)) gCy[k] = (gCy[k] || 0) + v;
    }

    if (children.length === 0) continue;
    children.sort(
      (a, b) => ((b.pyQ["1"] || 0) - (b.cyQ["1"] || 0)) - ((a.pyQ["1"] || 0) - (a.cyQ["1"] || 0))
    );

    const gName =
      pi.name ||
      (children.length === 1
        ? children[0].name
        : `${children[0].name} (+${children.length - 1})`);

    groups.push({
      id:     pid,
      name:   gName,
      tier:   pi.tier   || "Standard",
      class2: pi.class2 || "Private Practice",
      locs:   children.length,
      pyQ:    gPy,
      cyQ:    gCy,
      children,
    });
  }

  groups.sort(
    (a, b) => ((b.pyQ["1"] || 0) - (b.cyQ["1"] || 0)) - ((a.pyQ["1"] || 0) - (a.cyQ["1"] || 0))
  );

  // ── Build warnings (deduplicated + summarized) ────────────────
  const warnings: ImportWarning[] = [];

  const unknownTierEntries = Object.entries(unknownTierCounts);
  if (unknownTierEntries.length > 0) {
    const totalCount = unknownTierEntries.reduce((s, [, n]) => s + n, 0);
    warnings.push({
      code:     "UNKNOWN_TIER",
      label:    "Rows had unrecognized Acct Type values — normalized to Standard",
      count:    totalCount,
      examples: unknownTierEntries.slice(0, 3).map(([v]) => v),
    });
  }
  if (missingParentExamples.length > 0) {
    warnings.push({
      code:     "MISSING_PARENT_NAME",
      label:    "Rows had no Parent Name — group name fell back to Child Name",
      count:    missingParentExamples.length,
      examples: missingParentExamples,
    });
  }
  if (noMdmRowsSkipped > 0) {
    warnings.push({
      code:     "MISSING_MDM",
      label:    `${noMdmRowsSkipped} rows dropped — missing Child MDM ID or Parent MDM ID (revenue not counted)`,
      count:    noMdmRowsSkipped,
      examples: [],
    });
  }
  if (noDateRowsSkipped > 0) {
    warnings.push({
      code:     "BAD_DATE",
      label:    `${noDateRowsSkipped} rows skipped — missing or unparseable Invoice Date`,
      count:    noDateRowsSkipped,
      examples: [],
    });
  }

  // ── Assemble report ───────────────────────────────────────────
  const report: ImportReport = {
    filename,
    timestamp:              new Date().toISOString(),
    delimiterDetected:      delimiterDetected as "comma" | "tab" | "unknown",
    encodingDetected,
    totalRawRows:           rows.length,
    blankRowsSkipped,
    grandTotalRowsSkipped,
    summaryRowsSkipped,
    noDateRowsSkipped,
    noMdmRowsSkipped,
    cleanRowsProcessed,
    uniqueParents:          Object.keys(parentChildren).length,
    uniqueOffices:          allChildIds.size,
    zeroRevenueOfficesDropped,
    finalOffices,
    finalGroups:            groups.length,
    warnings,
  };

  // ── Build CRM candidates from child identity fields ─────────────
  // These are extracted here but NOT written to storage — the caller
  // (AccelerateApp.handleUpload) decides whether and when to persist them.
  // Only identity fields are captured; sales fields (pyQ/cyQ/products) are excluded.
  const crmCandidates: Record<string, any> = {};
  for (const [cid, ci] of Object.entries(childInfo)) {
    crmCandidates[cid] = {
      id:       cid,
      parentId: ci.parentId || "",
      name:     ci.name     || "",
      city:     ci.city     || "",
      st:       ci.st       || "",
      addr:     ci.addr     || "",
      zip:      (ci.zip     || ""),
      email:    (ci.email   || ""),
      tier:     ci.tier     || "Standard",
      top100:   ci.top100   || false,
      class2:   ci.class2   || "",
      dealer:   _dealers[cid] || "All Other",
    };
  }

  return { groups, generated: new Date().toISOString().slice(0, 10), report, crmCandidates, rawSalesRows };
}

