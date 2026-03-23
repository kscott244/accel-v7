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

export function processCSVData(rows: Record<string, string>[]) {
  const childInfo: Record<string, any> = {};
  const childPyQ: Record<string, Record<string, number>> = {};
  const childCyQ: Record<string, Record<string, number>> = {};
  const childProds: Record<string, Record<string, Record<string, number>>> = {};
  const parentInfo: Record<string, any> = {};
  const parentChildren: Record<string, Set<string>> = {};
  const childLastDate: Record<string, Date> = {};
  const ref = new Date();

  for (const row of rows) {
    if ((row["Parent Name"] || "").startsWith("Grand Total")) continue;
    if ((row["Parent MDM ID"] || "") === "Total") continue;

    const inv = row["Invoice Date"];
    if (!inv) continue;
    const parts = inv.split("/");
    if (parts.length < 3) continue;
    const month = parseInt(parts[0]);
    const year = parseInt(parts[2]);
    const dt = new Date(year, month - 1, parseInt(parts[1]));
    const q = Math.ceil(month / 3);

    const py = parseFloat((row["PY"] || "0").replace(/,/g, "")) || 0;
    const cy = parseFloat((row["CY"] || "0").replace(/,/g, "")) || 0;
    const childId = (row["Child Mdm Id"] || "").trim();
    const parentId = (row["Parent MDM ID"] || "").trim();
    const l3 = (row["L3"] || "").trim();

    if (!childId || !parentId) continue;

    // ── RULE: PY and CY from this Tableau export are already credited wholesale ──
    // Do NOT apply chargeback — they come in post-chargeback
    if (!childPyQ[childId]) childPyQ[childId] = {};
    if (!childCyQ[childId]) childCyQ[childId] = {};
    if (py !== 0) {
      childPyQ[childId][q] = (childPyQ[childId][q] || 0) + py;
      childPyQ[childId]["FY"] = (childPyQ[childId]["FY"] || 0) + py;
    }
    if (cy !== 0) {
      childCyQ[childId][q] = (childCyQ[childId][q] || 0) + cy;
      childCyQ[childId]["FY"] = (childCyQ[childId]["FY"] || 0) + cy;
    }

    if (l3) {
      if (!childProds[childId]) childProds[childId] = {};
      if (!childProds[childId][l3]) childProds[childId][l3] = {};
      if (py !== 0) {
        childProds[childId][l3][`py${q}`] = (childProds[childId][l3][`py${q}`] || 0) + py;
        childProds[childId][l3]["pyFY"] = (childProds[childId][l3]["pyFY"] || 0) + py;
      }
      if (cy !== 0) {
        childProds[childId][l3][`cy${q}`] = (childProds[childId][l3][`cy${q}`] || 0) + cy;
        childProds[childId][l3]["cyFY"] = (childProds[childId][l3]["cyFY"] || 0) + cy;
      }
    }

    if ((py !== 0 || cy !== 0) && (!childLastDate[childId] || dt > childLastDate[childId])) {
      childLastDate[childId] = dt;
    }

    // ── RULE: Pricing tier from Acct Type; practice type from Sds Cust Class2 ──
    if (!childInfo[childId]) {
      childInfo[childId] = {
        name: row["Child Name"] || "",
        city: row["City"] || "",
        st: row["State"] || "",
        addr: row["Addr"] || "",
        tier: normalizeTier(row["Acct Type"]),
        top100: isTop100(row["Acct Type"]),
        class2: row["Sds Cust Class2"] || "",
        parentId,
      };
    }

    // ── RULE: Group name always comes from Parent Name field (strip suffix) ──
    // ── NEVER use Class 4 as primary — it's often a tier name ──
    if (parentId && !parentInfo[parentId]) {
      parentInfo[parentId] = {
        name: extractGroupName(row["Parent Name"], row["Class 4"], row["Child Name"]),
        tier: normalizeTier(row["Acct Type"]),
        class2: normalizePracticeType(row["Sds Cust Class2"]),
      };
    }

    if (parentId) {
      if (!parentChildren[parentId]) parentChildren[parentId] = new Set();
      parentChildren[parentId].add(childId);
    }
  }

  const groups: any[] = [];
  for (const [pid, childIds] of Object.entries(parentChildren)) {
    const pi = parentInfo[pid] || {};
    const children: any[] = [];
    const gPy: Record<string, number> = {};
    const gCy: Record<string, number> = {};

    for (const cid of Array.from(childIds)) {
      const ci = childInfo[cid] || {};
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

      const last = childLastDate[cid];
      const daysSince = last ? Math.round((ref.getTime() - last.getTime()) / 86400000) : 999;

      const hasMoney = Object.values(pyQ).some((v) => v !== 0) || Object.values(cyQ).some((v) => v !== 0);
      if (!hasMoney) continue;

      children.push({
        id: cid,
        name: ci.name,
        city: ci.city,
        st: ci.st,
        addr: ci.addr || "",
        tier: ci.tier || "Standard",
        top100: ci.top100 || false,
        class2: ci.class2 || "",
        last: daysSince,
        pyQ,
        cyQ,
        products: products.slice(0, 10),
        dealer: _dealers[cid] || "Unknown",
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
      id: pid,
      name: gName,
      tier: pi.tier || "Standard",
      class2: pi.class2 || "Private Practice",
      locs: children.length,
      pyQ: gPy,
      cyQ: gCy,
      children,
    });
  }

  groups.sort(
    (a, b) => ((b.pyQ["1"] || 0) - (b.cyQ["1"] || 0)) - ((a.pyQ["1"] || 0) - (a.cyQ["1"] || 0))
  );
  return { groups, generated: new Date().toISOString().slice(0, 10) };
}
