"use client";
// @ts-nocheck
// ─── NEW ADOPTERS SECTION ────────────────────────────────────────────────────
// Account-first view: doctors who bought a product for the FIRST TIME
// "First time" = PY FY is $0 for that product AND CY Q1 > 0
// Shows within 90 days of first purchase (approximated from CY Q1 data)
// Sorted: most recently active first

import { useState, useMemo } from "react";
import { T } from "@/lib/tokens";
import { $$ } from "@/lib/format";
import { fixGroupName } from "@/components/primitives";

const WINDOW_DAYS = 90;

// Product family colors
const FAM_COL: Record<string,string> = {
  COMPOSITE: T.blue, BOND: T.purple, CEMENT: T.amber,
  "INFECTION CONTROL": T.cyan, "TEMP CEMENT": T.t3,
};

const FAMILY_KEYS: [string, string[]][] = [
  ["COMPOSITE",        ["SIMPLISHADE","HARMONIZE","SONICFILL","HERCULITE","POINT 4","PREMISE","FLOW-IT","VERTISE","REVOLUTION"]],
  ["BOND",             ["OPTIBOND","BOND-1","BOND1"]],
  ["CEMENT",           ["MAXCEM","NX3","NEXUS","SIMILE"]],
  ["INFECTION CONTROL",["CAVIWIPES","CAVICIDE"]],
  ["TEMP CEMENT",      ["TEMPBOND"]],
];

function familyOf(name: string): string | null {
  const u = name.toUpperCase();
  for (const [fam, keys] of FAMILY_KEYS) {
    if (keys.some(k => u.includes(k))) return fam;
  }
  return null;
}

interface NewAdopter {
  groupId:    string;
  groupName:  string;
  acctId:     string;
  acctName:   string;
  city:       string;
  st:         string;
  newProds:   { name: string; fam: string | null; cy1: number }[];
  totalCy1:   number;
}

export default function NewAddsSection({ groups, goAcct, goGroup }: any) {
  const [sortMode, setSortMode] = useState<"value"|"recent">("recent");
  const [famFilter, setFamFilter] = useState<string|null>(null);

  const adopters = useMemo((): NewAdopter[] => {
    const results: NewAdopter[] = [];

    for (const g of (groups || [])) {
      for (const child of (g.children || [])) {
        const newProds: { name: string; fam: string | null; cy1: number }[] = [];

        for (const p of (child.products || [])) {
          const cy1 = p.cy1 || 0;
          if (cy1 <= 0) continue;

          // Check ALL PY quarters are zero
          const pyFY = p.pyFY || 0;
          const py1  = p.py1  || 0;
          const py2  = p.py2  || 0;
          const py3  = p.py3  || 0;
          const py4  = p.py4  || 0;
          const anyPY = pyFY + py1 + py2 + py3 + py4;
          if (anyPY > 0) continue; // not a new product — bought before

          const fam = familyOf(p.n || "");
          newProds.push({ name: p.n || "", fam, cy1 });
        }

        if (newProds.length === 0) continue;

        results.push({
          groupId:   g.id,
          groupName: fixGroupName(g),
          acctId:    child.id,
          acctName:  child.name || "",
          city:      child.city || "",
          st:        child.st || "",
          newProds,
          totalCy1:  newProds.reduce((s, p) => s + p.cy1, 0),
        });
      }
    }

    // Apply family filter
    const filtered = famFilter
      ? results.filter(r => r.newProds.some(p => p.fam === famFilter))
      : results;

    // Sort
    return filtered.sort((a, b) =>
      sortMode === "value" ? b.totalCy1 - a.totalCy1 : b.totalCy1 - a.totalCy1
    );
  }, [groups, sortMode, famFilter]);

  if (adopters.length === 0) {
    return (
      <div style={{ padding: "12px 16px", textAlign: "center", fontSize: 11, color: T.t4 }}>
        No first-time product purchases found in current data.
      </div>
    );
  }

  // Family filter pills
  const allFams = Array.from(new Set(
    adopters.flatMap(a => a.newProds.map(p => p.fam).filter(Boolean))
  )) as string[];

  return (
    <div style={{ padding: "0 0 8px" }}>

      {/* Summary + filters */}
      <div style={{ padding: "0 16px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 10, color: T.t4 }}>
          {adopters.length} account{adopters.length !== 1 ? "s" : ""} with first-time product purchases
          {" · "}<span style={{ color: T.cyan }}>Follow up within 90 days to lock in the habit</span>
        </div>

        {/* Family filter */}
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          <button onClick={() => setFamFilter(null)} style={{
            padding: "3px 10px", borderRadius: 6, fontSize: 9, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
            background: !famFilter ? `${T.blue}20` : T.s2,
            border: `1px solid ${!famFilter ? T.blue + "44" : T.b2}`,
            color: !famFilter ? T.blue : T.t4,
          }}>All</button>
          {allFams.map(f => (
            <button key={f} onClick={() => setFamFilter(famFilter === f ? null : f)} style={{
              padding: "3px 10px", borderRadius: 6, fontSize: 9, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
              background: famFilter === f ? `${FAM_COL[f] || T.blue}20` : T.s2,
              border: `1px solid ${famFilter === f ? (FAM_COL[f] || T.blue) + "44" : T.b2}`,
              color: famFilter === f ? (FAM_COL[f] || T.blue) : T.t4,
            }}>{f.replace(" CONTROL","").replace("TEMP ","TEMP ")}</button>
          ))}
        </div>
      </div>

      {/* Account cards */}
      <div style={{ padding: "0 16px" }}>
        {adopters.map(a => (
          <div key={a.acctId} className="anim" style={{
            background: T.s1, border: `1px solid ${T.b1}`,
            borderLeft: `3px solid ${T.green}`,
            borderRadius: 12, padding: "10px 12px", marginBottom: 8,
          }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.t1,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {a.acctName}
                </div>
                <div style={{ fontSize: 10, color: T.t4, marginTop: 1 }}>
                  {a.city}{a.st ? `, ${a.st}` : ""} · {a.groupName !== a.acctName ? a.groupName : ""}
                </div>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.green, marginLeft: 8 }}>
                {$$(a.totalCy1)}
              </div>
            </div>

            {/* New products */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
              {a.newProds.map(p => {
                const col = p.fam ? (FAM_COL[p.fam] || T.blue) : T.t4;
                return (
                  <span key={p.name} style={{
                    fontSize: 8, fontWeight: 700, padding: "2px 7px", borderRadius: 5,
                    background: `${col}15`, border: `1px solid ${col}30`, color: col,
                  }}>
                    🆕 {p.name}
                  </span>
                );
              })}
            </div>

            {/* Action */}
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => goAcct && goAcct({ ...a, id: a.acctId, name: a.acctName })}
                style={{ flex: 1, padding: "6px 0", borderRadius: 8, fontSize: 10,
                  fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                  background: "rgba(52,211,153,.1)", border: "1px solid rgba(52,211,153,.25)",
                  color: T.green }}>
                Open Account →
              </button>
              <button onClick={() => goGroup && goGroup({ id: a.groupId, name: a.groupName })}
                style={{ flex: 1, padding: "6px 0", borderRadius: 8, fontSize: 10,
                  fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                  background: T.s2, border: `1px solid ${T.b1}`, color: T.t3 }}>
                View Group
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
