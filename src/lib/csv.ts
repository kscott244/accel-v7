// ─── CSV PROCESSOR ───────────────────────────────────────────────
// Rules are permanent — future uploads with the same Tableau headers
// will always produce clean, consistent output regardless of what
// values Tableau puts in Acct Type or Class 4.
//
// Depends on: DEALERS (static data), tier helpers
// Used by: AdminTab (CSV upload), preloaded-data.ts generation

import { normalizeTier, isTop100, normalizePracticeType, extractGroupName } from "./tier";

// DEALERS is loaded at call time via the caller passing it in,
// or falls back to empty. This keeps the module free of direct data imports.
let _dealers: Record<string, string> = {};
export function setDealers(d: Record<string, string>) { _dealers = d; }

// ─── IMPORT REPORT ───────────────────────────────────────────────
// Returned alongside groups from processCSVData(). Stored in localStorage
// under "import_report_v1" so AdminTab can display it persistently.
export interface ImportReport {
  // File metadata
  filename: string;           // Original filename (passed in by caller)
  timestamp: string;          // ISO timestamp of when upload was processed
  // File format detection
  delimiterDetected: "comma" | "tab" | "unknown";
  encodingDetected: "UTF-8" | "UTF-8 BOM" | "Windows-1252 (likely)" | "unknown";
  // Row-level counts (all rows in the raw file)
  totalRawRows: number;       // All data rows after header (blank line not counted)
  blankRowsSkipped: number;   // Rows that were entirely blank
  grandTotalRowsSkipped: number; // Rows where Parent Name starts with "Grand Total"
  summaryRowsSkipped: number; // Rows where Parent MDM ID === "Total"
  noDateRowsSkipped: number;  // Rows with missing or unparseable Invoice Date
  cleanRowsProcessed: number; // Rows that passed all filters and were aggregated
  // Entity-level output (after aggregation)
  uniqueParents: number;      // Distinct Parent MDM IDs in output
  uniqueOffices: number;      // Distinct Child MDM IDs in output (includes zero-rev stubs)
  zeroRevenueOfficesDropped: number; // Child MDM IDs removed because all PY+CY = 0
  finalOffices: number;       // Offices in output (uniqueOffices - dropped)
  finalGroups: number;        // Groups with at least one child (= groups array length)
  // Warnings — deduplicated and summarized
  warnings: ImportWarning[];
}

export interface ImportWarning {
  code: string;   // Short machine-readable code, e.g. "UNKNOWN_TIER"
  label: string;  // Human-readable summary
  count: number;  // How many rows triggered this warning
  examples: string[]; // Up to 3 example values
}

// Detect delimiter from header line
function detectDelimiter(header: string): "comma" | "tab" | "unknown" {
  const commas = (header.match(/,/g) || []).length;
  const tabs   = (header.match(/\t/g) || []).length;
  if (tabs > commas) return "tab";
  if (commas > 0)    return "comma";
  return "unknown";
}

// Rough encoding detection from raw text
function detectEncoding(text: string): "UTF-8 BOM" | "Windows-1252 (likely)" | "UTF-8" {
  if (text.charCodeAt(0) === 0xFEFF) return "UTF-8 BOM";
  // Windows-1252 smuggles high bytes (0x80–0x9F range) that are invalid UTF-8
  for (let i = 0; i < Math.min(text.length, 4000); i++) {
    const c = text.charCodeAt(i);
    if (c >= 0x80 && c <= 0x9F) return "Windows-1252 (likely)";
  }
  return "UTF-8";
}

export function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split("\n");
  const headers = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const vals = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, j) => (row[h.trim()] = (vals[j] || "").trim()));
    rows.push(row);
  }
  return rows;
}

export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') { inQuotes = !inQuotes; }
    else if (line[i] === "," && !inQuotes) { result.push(current); current = ""; }
    else { current += line[i]; }
  }
  result.push(current);
  return result;
}

// processCSVData now accepts an optional filename and returns an ImportReport
// alongside the groups output. Signature change is backward-compatible because
// the caller destructures { groups, generated } — the added `report` key is ignored
// unless the caller explicitly reads it.
export function processCSVData(
  rows: Record<string, string>[],
  rawText = "",
  filename = ""
) {
  // ── Format detection ──────────────────────────────────────────
  const firstLine = rawText ? rawText.split("\n")[0] : "";
  const delimiterDetected = firstLine ? detectDelimiter(firstLine) : "unknown";
  const encodingDetected  = rawText   ? detectEncoding(rawText)    : "unknown";

  // ── Warning accumulators ──────────────────────────────────────
  const unknownTierExamples: string[]   = [];
  const missingParentExamples: string[] = [];

  // ── Row-level skip counters ───────────────────────────────────
  let blankRowsSkipped      = 0;
  let grandTotalRowsSkipped = 0;
  let summaryRowsSkipped    = 0;
  let noDateRowsSkipped     = 0;
  let cleanRowsProcessed    = 0;

  const childInfo:    Record<string, any>                         = {};
  const childPyQ:     Record<string, Record<string, number>>      = {};
  const childCyQ:     Record<string, Record<string, number>>      = {};
  const childProds:   Record<string, Record<string, Record<string, number>>> = {};
  const parentInfo:   Record<string, any>                         = {};
  const parentChildren: Record<string, Set<string>>               = {};
  const childLastDate:  Record<string, Date>                      = {};
  const allChildIds:    Set<string>                               = new Set();
  const ref = new Date();

  for (const row of rows) {
    // Count blank rows (all values empty)
    if (Object.values(row).every(v => !v.trim())) { blankRowsSkipped++; continue; }

    if ((row["Parent Name"] || "").startsWith("Grand Total")) { grandTotalRowsSkipped++; continue; }
    if ((row["Parent MDM ID"] || "") === "Total")             { summaryRowsSkipped++;    continue; }

    const inv = row["Invoice Date"];
    if (!inv) { noDateRowsSkipped++; continue; }
    const parts = inv.split("/");
    if (parts.length < 3) { noDateRowsSkipped++; continue; }
    const month = parseInt(parts[0]);
    const year  = parseInt(parts[2]);
    if (isNaN(month) || isNaN(year)) { noDateRowsSkipped++; continue; }
    const dt = new Date(year, month - 1, parseInt(parts[1]));
    const q  = Math.ceil(month / 3);

    const py      = parseFloat((row["PY"] || "0").replace(/,/g, "")) || 0;
    const cy      = parseFloat((row["CY"] || "0").replace(/,/g, "")) || 0;
    const childId  = (row["Child Mdm Id"]   || "").trim();
    const parentId = (row["Parent MDM ID"]  || "").trim();
    const l3       = (row["L3"]             || "").trim();

    if (!childId || !parentId) continue;

    allChildIds.add(childId);

    // Warn on unrecognized tier values (collect up to 3 examples)
    const rawTier = (row["Acct Type"] || "").trim();
    if (rawTier && unknownTierExamples.length < 3) {
      const normalized = normalizeTier(rawTier);
      if (normalized === "Standard" && rawTier !== "" &&
          !["Standard","Top 100","HOUSE ACCOUNTS","Silver","Gold","Platinum","Diamond",
            "Top 100-Gold","Top 100-Diamond","Top 100-Platinum"].includes(rawTier)) {
        if (!unknownTierExamples.includes(rawTier)) unknownTierExamples.push(rawTier);
      }
    }

    // Warn on missing Parent Name (collect up to 3 examples)
    if (!row["Parent Name"] && missingParentExamples.length < 3) {
      if (!missingParentExamples.includes(parentId)) missingParentExamples.push(parentId);
    }

    // ── RULE: PY and CY from this Tableau export are already credited wholesale ──
    // Do NOT apply chargeback — they come in post-chargeback
    if (!childPyQ[childId]) childPyQ[childId] = {};
    if (!childCyQ[childId]) childCyQ[childId] = {};
    if (py !== 0) {
      childPyQ[childId][q]    = (childPyQ[childId][q]    || 0) + py;
      childPyQ[childId]["FY"] = (childPyQ[childId]["FY"] || 0) + py;
    }
    if (cy !== 0) {
      childCyQ[childId][q]    = (childCyQ[childId][q]    || 0) + cy;
      childCyQ[childId]["FY"] = (childCyQ[childId]["FY"] || 0) + cy;
    }

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

    // ── RULE: Group name always comes from Parent Name field (strip suffix) ──
    // ── NEVER use Class 4 as primary — it's often a tier name ──
    if (parentId && !parentInfo[parentId]) {
      parentInfo[parentId] = {
        name:   extractGroupName(row["Parent Name"], row["Class 4"], row["Child Name"]),
        tier:   normalizeTier(row["Acct Type"]),
        class2: normalizePracticeType(row["Sds Cust Class2"]),
      };
    }

    if (parentId) {
      if (!parentChildren[parentId]) parentChildren[parentId] = new Set();
      parentChildren[parentId].add(childId);
    }

    cleanRowsProcessed++;
  }

  // ── Build groups ──────────────────────────────────────────────
  let zeroRevenueOfficesDropped = 0;
  let finalOffices = 0;
  const groups: any[] = [];

  for (const [pid, childIds] of Object.entries(parentChildren)) {
    const pi       = parentInfo[pid] || {};
    const children: any[] = [];
    const gPy: Record<string, number> = {};
    const gCy: Record<string, number> = {};

    for (const cid of Array.from(childIds)) {
      const ci   = childInfo[cid] || {};
      const pyQ: Record<string, number> = {};
      const cyQ: Record<string, number> = {};
      for (const [k, v] of Object.entries(childPyQ[cid] || {})) { pyQ[String(k)] = Math.round(v); }
      for (const [k, v] of Object.entries(childCyQ[cid] || {})) { cyQ[String(k)] = Math.round(v); }

      // ── RULE: PY/CY already credited — no chargeback adjustment needed ──
      const products: any[] = [];
      for (const [l3, vals] of Object.entries(childProds[cid] || {})) {
        const p: any = { n: l3 };
        for (const [k, v] of Object.entries(vals)) { p[k] = Math.round(v); }
        if (Math.abs(p.pyFY || 0) >= 50 || Math.abs(p.cyFY || 0) >= 25) products.push(p);
      }
      products.sort((a, b) => Math.abs(b.pyFY || 0) - Math.abs(a.pyFY || 0));

      const last      = childLastDate[cid];
      const daysSince = last ? Math.round((ref.getTime() - last.getTime()) / 86400000) : 999;

      const hasMoney  = Object.values(pyQ).some(v => v !== 0) || Object.values(cyQ).some(v => v !== 0);
      if (!hasMoney) { zeroRevenueOfficesDropped++; continue; }

      finalOffices++;
      children.push({
        id:     cid,
        name:   ci.name,
        city:   ci.city,
        st:     ci.st,
        addr:   ci.addr   || "",
        tier:   ci.tier   || "Standard",
        top100: ci.top100 || false,
        class2: ci.class2 || "",
        last:   daysSince,
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
      (children.length === 1 ? children[0].name : `${children[0].name} (+${children.length - 1})`);

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
  if (unknownTierExamples.length > 0) {
    warnings.push({
      code:     "UNKNOWN_TIER",
      label:    "Rows contained unrecognized Acct Type values — normalized to Standard",
      count:    unknownTierExamples.length,
      examples: unknownTierExamples,
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
    timestamp: new Date().toISOString(),
    delimiterDetected,
    encodingDetected,
    totalRawRows:               rows.length,
    blankRowsSkipped,
    grandTotalRowsSkipped,
    summaryRowsSkipped,
    noDateRowsSkipped,
    cleanRowsProcessed,
    uniqueParents:              Object.keys(parentChildren).length,
    uniqueOffices:              allChildIds.size,
    zeroRevenueOfficesDropped,
    finalOffices,
    finalGroups:                groups.length,
    warnings,
  };

  return { groups, generated: new Date().toISOString().slice(0, 10), report };
}
