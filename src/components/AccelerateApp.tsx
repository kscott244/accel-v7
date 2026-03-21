"use client";
// @ts-nocheck

import { useState, useMemo, useCallback, useRef, useEffect } from "react";

// Dealer data — loads if available, gracefully degrades if not
let DEALER_LOOKUP: Record<string, any> = {};
let DEALERS: Record<string, string> = {};
try { DEALER_LOOKUP = require("@/data/dealer-lookup").DEALER_LOOKUP; } catch(e) {}
try { DEALERS = require("@/data/dealers").DEALERS; } catch(e) {}

// ─── DESIGN TOKENS ───────────────────────────────────────────────
const T = {
  bg: "#0a0a0f", s1: "#12121a", s2: "#1a1a25", s3: "#222230", s4: "#2a2a3a",
  b1: "rgba(255,255,255,.06)", b2: "rgba(255,255,255,.08)", b3: "rgba(255,255,255,.04)",
  t1: "#f0f0f5", t2: "#c8c8d0", t3: "#8888a0", t4: "#555570",
  blue: "#4f8ef7", cyan: "#22d3ee", green: "#34d399", amber: "#fbbf24",
  red: "#f87171", purple: "#a78bfa", orange: "#fb923c",
};

const Q1_TARGET = 778915;
const Q_TARGETS = { 1: 778915, 2: 798328, 3: 793897, 4: 786954 };
const FY_TARGET = 3158094;
const DAYS_LEFT = Math.max(0, Math.ceil((new Date(2026, 2, 31).getTime() - new Date().getTime()) / 86400000));

// ─── TIER / CHARGEBACK LOGIC ─────────────────────────────────────
const ACCEL_RATES = { Silver: 0.20, Gold: 0.24, Platinum: 0.30, Diamond: 0.36 };

// Normalize Acct Type: strip "Top 100" ranking, treat HOUSE ACCOUNTS as Standard
const normalizeTier = (raw) => {
  if (!raw) return "Standard";
  const t = raw.trim();
  if (t === "HOUSE ACCOUNTS") return "Standard";
  if (t === "Top 100") return "Standard";           // just a ranking, no chargeback
  if (t.startsWith("Top 100-")) return t.split("-")[1]; // "Top 100-Gold" → "Gold"
  return t;
};

const getTierRate = (tier) => {
  const n = normalizeTier(tier);
  return ACCEL_RATES[n] || 0;
};
const isAccelTier = (tier) => {
  const n = normalizeTier(tier);
  return n in ACCEL_RATES;
};
const getTierLabel = (tier) => {
  const n = normalizeTier(tier);
  if (n === "Standard") return "Private Practice";
  if (n in ACCEL_RATES) return `Accelerate ${n}`;
  return n;
};

// ─── FORMATTERS ──────────────────────────────────────────────────
const $$ = n => {
  if (n == null || isNaN(n)) return "$0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1000000) return sign + "$" + (abs/1000000).toFixed(2) + "M";
  if (abs >= 1000) return sign + "$" + (abs/1000).toFixed(abs%1000===0?0:1) + "K";
  return sign + "$" + Math.round(abs).toLocaleString();
};
const $f = n => "$" + Math.round(n||0).toLocaleString();
const pc = n => Math.round((n||0)*100) + "%";

// ─── ICONS ───────────────────────────────────────────────────────
const Back = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>;
const Chev = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{opacity:.4,flexShrink:0}}><path d="M9 18l6-6-6-6"/></svg>;
const UploadIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
// SVG nav icons (avoid emoji corruption)
const IconBolt = ({c}:{c:string}) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>;
const IconGroup = ({c}:{c:string}) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const IconCalc = ({c}:{c:string}) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="10" y2="10"/><line x1="14" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="10" y2="14"/><line x1="14" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="16" y2="18"/></svg>;
const IconChart = ({c}:{c:string}) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
const IconCheck = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>;
const IconAlert = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;

// ─── DISPLAY NAME FIXER (catches bad names in preloaded data too) ──
const BAD_GROUP_NAMES = new Set(["STANDARD","Standard","HOUSE ACCOUNTS","House Accounts","SILVER","GOLD","PLATINUM","DIAMOND","TOP 100","Silver","Gold","Platinum","Diamond","Top 100",""]);
// Strip " : Master-CMxxxxxx" suffix from Tableau parent names
const cleanParentName = (name) => {
  if (!name) return "";
  return name.replace(/\s*:\s*Master-CM\d+$/i, "").trim();
};
const fixGroupName = (g) => {
  if (!g) return "Unknown";
  const cleaned = cleanParentName(g.name);
  if (!cleaned || BAD_GROUP_NAMES.has(cleaned)) {
    if (g.children?.length === 1) return g.children[0].name;
    if (g.children?.length > 1) return `${g.children[0].name} (+${g.children.length-1})`;
    return cleaned || g.id || "Unknown";
  }
  return cleaned;
};

// ─── SMALL COMPONENTS ────────────────────────────────────────────
const Pill = ({l,v,c}) => <div><span style={{fontSize:8,textTransform:"uppercase",color:T.t4}}>{l} </span><span className="m" style={{fontSize:12,fontWeight:700,color:c}}>{v}</span></div>;
const Stat = ({l,v,c}) => <div style={{background:T.s2,borderRadius:8,padding:"8px 10px",textAlign:"center"}}><div style={{fontSize:8,textTransform:"uppercase",color:T.t4,marginBottom:2}}>{l}</div><div className="m" style={{fontSize:14,fontWeight:700,color:c}}>{v}</div></div>;
const Bar = ({pct, color}) => <div style={{width:"100%",height:6,borderRadius:3,background:T.s3,overflow:"hidden"}}><div className="bar-g" style={{height:"100%",borderRadius:3,width:`${Math.min(Math.max(pct,0),100)}%`,background:color||`linear-gradient(90deg,${T.blue},${T.cyan})`}}/></div>;

// ─── SCORING ENGINE ──────────────────────────────────────────────
function scoreAccount(a, q) {
  let s = 0; const r = []; // r = [{label, pts}]
  const py = a.pyQ?.[q] || 0;
  const cy = a.cyQ?.[q] || 0;
  const gap = py - cy;
  const ret = py > 0 ? cy / py : 0;
  const d = a.last || 999;

  if (gap > 8000) { s += 30; r.push({label:`Large gap: ${$$(gap)}`, pts:30}); }
  else if (gap > 4000) { s += 20; r.push({label:`Gap: ${$$(gap)}`, pts:20}); }
  else if (gap > 2000) { s += 10; r.push({label:`Gap: ${$$(gap)}`, pts:10}); }

  if (py > 500 && ret < 0.05) { s += 25; r.push({label:"Near-zero retention", pts:25}); }
  else if (py > 500 && ret < 0.15) { s += 20; r.push({label:`Critical ${Math.round(ret*100)}%`, pts:20}); }
  else if (py > 200 && ret < 0.30) { s += 12; r.push({label:`Low retention ${Math.round(ret*100)}%`, pts:12}); }

  if (d > 120) { s += 20; r.push({label:`Gone dark — ${d}d`, pts:20}); }
  else if (d > 60) { s += 15; r.push({label:`${d}d since order`, pts:15}); }
  else if (d > 30) { s += 8; r.push({label:`${d}d since order`, pts:8}); }

  if (gap > 5000 && d < 60) { s += 15; r.push({label:"Q1 close — act now", pts:15}); }
  else if (gap > 3000) { s += 10; r.push({label:"Q1 closing window", pts:10}); }

  const tier = a.gTier || a.tier;
  if (tier === "Diamond" || tier?.includes("Diamond")) { s += 10; r.push({label:"Diamond tier", pts:10}); }
  else if (tier === "Platinum") { s += 8; r.push({label:"Platinum tier", pts:8}); }
  else if (tier === "Top 100") { s += 5; r.push({label:"Top 100", pts:5}); }

  // Products at $0
  const dead = (a.products||[]).filter(p => (p[`py${q}`]||0) > 200 && (p[`cy${q}`]||0) === 0);
  if (dead.length) { s += dead.length * 3; r.push({label:`${dead.length} products at $0`, pts:dead.length*3}); }

  return { score: s, reasons: r, gap, ret, d, py, cy };
}

// ─── ACCOUNT HEALTH STATUS ───────────────────────────────────────
const getHealthStatus = (ret, gap, cy, py) => {
  if (py > 0 && cy > py) return {label:"Growing — cross-sell opportunity", color:T.green, bg:"rgba(52,211,153,.08)", border:"rgba(52,211,153,.18)"};
  if (ret >= 0.6)         return {label:"Stable", color:T.cyan,  bg:"rgba(34,211,238,.08)",  border:"rgba(34,211,238,.18)"};
  if (ret >= 0.25 && gap < 2000) return {label:"Recoverable — product-specific decline", color:T.amber, bg:"rgba(251,191,36,.08)", border:"rgba(251,191,36,.18)"};
  if (ret >= 0.25)        return {label:"Recoverable — needs attention", color:T.amber, bg:"rgba(251,191,36,.08)", border:"rgba(251,191,36,.18)"};
  return                         {label:"Critical retention risk", color:T.red,   bg:"rgba(248,113,113,.08)", border:"rgba(248,113,113,.18)"};
};

// ─── CSV PROCESSOR ───────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.split("\n");
  const headers = parseCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const vals = parseCSVLine(lines[i]);
    const row = {};
    headers.forEach((h, j) => row[h.trim()] = (vals[j]||"").trim());
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line) {
  const result = []; let current = ""; let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') { inQuotes = !inQuotes; }
    else if (line[i] === ',' && !inQuotes) { result.push(current); current = ""; }
    else { current += line[i]; }
  }
  result.push(current);
  return result;
}

function processCSVData(rows) {
  const childInfo = {};
  const childPyQ = {};
  const childCyQ = {};
  const childProds = {};
  const parentInfo = {};
  const parentChildren = {};
  const childLastDate = {};
  const ref = new Date();

  for (const row of rows) {
    if ((row["Parent Name"]||"").startsWith("Grand Total")) continue;
    const inv = row["Invoice Date"];
    if (!inv) continue;
    const parts = inv.split("/");
    if (parts.length < 3) continue;
    const month = parseInt(parts[0]);
    const year = parseInt(parts[2]);
    const dt = new Date(year, month - 1, parseInt(parts[1]));
    const q = Math.ceil(month / 3);

    const py = parseFloat((row["PY"]||"0").replace(/,/g,"")) || 0;
    const cy = parseFloat((row["CY"]||"0").replace(/,/g,"")) || 0;
    const childId = (row["Child Mdm Id"]||"").trim();
    const parentId = (row["Parent MDM ID"]||"").trim();
    const l3 = (row["L3"]||"").trim();

    if (!childId) continue;

    if (!childPyQ[childId]) childPyQ[childId] = {};
    if (!childCyQ[childId]) childCyQ[childId] = {};
    if (py !== 0) {
      childPyQ[childId][q] = (childPyQ[childId][q]||0) + py;
      childPyQ[childId]["FY"] = (childPyQ[childId]["FY"]||0) + py;
    }
    if (cy !== 0) {
      childCyQ[childId][q] = (childCyQ[childId][q]||0) + cy;
      childCyQ[childId]["FY"] = (childCyQ[childId]["FY"]||0) + cy;
    }

    if (l3) {
      if (!childProds[childId]) childProds[childId] = {};
      if (!childProds[childId][l3]) childProds[childId][l3] = {};
      if (py !== 0) {
        childProds[childId][l3][`py${q}`] = (childProds[childId][l3][`py${q}`]||0) + py;
        childProds[childId][l3]["pyFY"] = (childProds[childId][l3]["pyFY"]||0) + py;
      }
      if (cy !== 0) {
        childProds[childId][l3][`cy${q}`] = (childProds[childId][l3][`cy${q}`]||0) + cy;
        childProds[childId][l3]["cyFY"] = (childProds[childId][l3]["cyFY"]||0) + cy;
      }
    }

    if ((py !== 0 || cy !== 0) && (!childLastDate[childId] || dt > childLastDate[childId])) {
      childLastDate[childId] = dt;
    }

    if (!childInfo[childId]) {
      childInfo[childId] = {
        name: row["Child Name"]||"", city: row["City"]||"", st: row["State"]||"",
        tier: row["Acct Type"]||"Standard", parentId,
      };
    }
    if (parentId && !parentInfo[parentId]) {
      const rawName = (row["Class 4"]||row["Parent Name"]||"").trim();
      // Avoid tier names / generic labels as group names
      const BAD_NAMES = ["STANDARD","HOUSE ACCOUNTS","SILVER","GOLD","PLATINUM","DIAMOND","TOP 100",""];
      const isBadName = BAD_NAMES.includes(rawName.toUpperCase());
      parentInfo[parentId] = {
        name: isBadName ? (row["Parent Name"]||row["Child Name"]||"").trim() : rawName,
        tier: row["Acct Type"]||"Standard",
        class2: row["Sds Cust Class2"]||"",
      };
    } else if (parentId && parentInfo[parentId]) {
      // If current name is a bad generic and this row has a better one, upgrade
      const cur = parentInfo[parentId].name.toUpperCase();
      const BAD_NAMES = ["STANDARD","HOUSE ACCOUNTS","SILVER","GOLD","PLATINUM","DIAMOND","TOP 100",""];
      if (BAD_NAMES.includes(cur)) {
        const better = (row["Class 4"]||row["Parent Name"]||"").trim();
        if (better && !BAD_NAMES.includes(better.toUpperCase())) {
          parentInfo[parentId].name = better;
        }
      }
    }
    if (parentId) {
      if (!parentChildren[parentId]) parentChildren[parentId] = new Set();
      parentChildren[parentId].add(childId);
    }
  }

  const groups = [];
  for (const [pid, childIds] of Object.entries(parentChildren)) {
    const pi = parentInfo[pid] || {};
    const children = [];
    const gPy = {}; const gCy = {};

    for (const cid of childIds) {
      const ci = childInfo[cid] || {};
      const pyQ = {}; const cyQ = {};
      for (const [k,v] of Object.entries(childPyQ[cid]||{})) { pyQ[String(k)] = Math.round(v); }
      for (const [k,v] of Object.entries(childCyQ[cid]||{})) { cyQ[String(k)] = Math.round(v); }

      // Apply PY chargeback for Accelerate tier accounts
      // PY data comes in as full wholesale — need to deduct tier chargeback to match CY treatment
      // Use the CHILD's own tier (not parent) — same DSO can have mixed tiers
      const acctTier = ci.tier || ci.acctType || "Standard";
      const cbRate = getTierRate(acctTier);
      if (cbRate > 0) {
        for (const k of Object.keys(pyQ)) {
          pyQ[k] = Math.round(pyQ[k] * (1 - cbRate));
        }
      }

      const products = [];
      for (const [l3, vals] of Object.entries(childProds[cid]||{})) {
        const p = { n: l3 };
        for (const [k,v] of Object.entries(vals)) {
          // Also adjust PY product values for chargeback
          if (k.startsWith("py") && cbRate > 0) {
            p[k] = Math.round(v * (1 - cbRate));
          } else {
            p[k] = Math.round(v);
          }
        }
        if (Math.abs(p.pyFY||0) >= 50 || Math.abs(p.cyFY||0) >= 25) products.push(p);
      }
      products.sort((a,b) => Math.abs(b.pyFY||0) - Math.abs(a.pyFY||0));

      const last = childLastDate[cid];
      const daysSince = last ? Math.round((ref - last) / 86400000) : 999;

      const hasMoney = Object.values(pyQ).some(v=>v!==0) || Object.values(cyQ).some(v=>v!==0);
      if (!hasMoney) continue;

      children.push({ id: cid, name: ci.name, city: ci.city, st: ci.st, tier: ci.tier||ci.acctType||"Standard", last: daysSince, pyQ, cyQ, products: products.slice(0,10), dealer: DEALERS[cid] || "Unknown" });

      for (const [k,v] of Object.entries(pyQ)) gPy[k] = (gPy[k]||0) + v;
      for (const [k,v] of Object.entries(cyQ)) gCy[k] = (gCy[k]||0) + v;
    }

    if (children.length === 0) continue;
    children.sort((a,b) => ((b.pyQ["1"]||0)-(b.cyQ["1"]||0)) - ((a.pyQ["1"]||0)-(a.cyQ["1"]||0)));
    // Final name cleanup: if group name is still a tier/generic label, use first child
    let gName = pi.name||pid;
    const BAD_UPPER = ["STANDARD","HOUSE ACCOUNTS","SILVER","GOLD","PLATINUM","DIAMOND","TOP 100",""];
    if (BAD_UPPER.includes(gName.toUpperCase())) {
      gName = children.length === 1 ? children[0].name : `${children[0].name} (+${children.length-1})`;
    }
    groups.push({ id: pid, name: gName, tier: pi.tier||pi.acctType||"Standard", class2: pi.class2||"", locs: children.length, pyQ: gPy, cyQ: gCy, children });
  }

  groups.sort((a,b) => ((b.pyQ["1"]||0)-(b.cyQ["1"]||0)) - ((a.pyQ["1"]||0)-(a.cyQ["1"]||0)));
  return { groups, generated: new Date().toISOString().slice(0,10) };
}

// ─── SKU PRICING (2025 Kerr Accelerate Formulary +3% for 2026) ──
// [sku, desc, cat, stdWS, stdMSRP, diaWS, diaMSRP, platWS, platMSRP, goldWS, goldMSRP, silvWS, silvMSRP]
const SKU = [
["37007","SimpliShade Unidose 20pk Medium","SIMPLISHADE",73.67,122.22,51.69,64.62,55.18,70.74,58.85,77.44,62.53,84.5],
["37001","SimpliShade Syringe Light","SIMPLISHADE",73.67,122.22,51.69,64.62,55.18,70.74,58.85,77.44,62.53,84.5],
["37002","SimpliShade Syringe Medium","SIMPLISHADE",73.67,122.22,51.69,64.62,55.18,70.74,58.85,77.44,62.53,84.5],
["37106","SS SE Flow Syringe Intro Kit","SIMPLISHADE",225.0,375.0,135.0,168.75,149.17,191.25,165.3,217.5,177.6,240.0],
["37107","SS SE Flow Syringe Light","SIMPLISHADE",81.0,135.0,48.6,60.75,53.7,68.85,59.51,78.3,63.94,86.4],
["36440","Harmonize A1 ENAMEL Uni 20pk","HARMONIZE",100.03,165.04,70.18,87.73,74.91,96.04,79.9,105.14,84.9,114.72],
["36441","Harmonize A2 ENAMEL Uni 20pk","HARMONIZE",100.03,165.04,70.18,87.73,74.91,96.04,79.9,105.14,84.9,114.72],
["36439","Harmonize XL ENAMEL Uni 20pk","HARMONIZE",100.03,165.04,70.18,87.73,74.91,96.04,79.9,105.14,84.9,114.72],
["34337","Herculite Ultra Syringe A1","HERCULITE ULTRA",107.94,179.89,82.12,102.65,87.22,111.81,92.6,121.84,97.98,132.4],
["35392","Herculite Ultra Flow Syr A1","HERCULITE ULTRA FLOW",72.59,120.41,37.21,46.51,43.44,55.69,50.68,66.68,54.3,73.37],
["36887","OptiBond Univ 360 Bottle Ref","OPTIBOND 360",107.66,178.56,68.9,86.13,75.36,96.62,81.82,107.66,86.13,116.39],
["36886","OptiBond Univ 360 Unidose Kit","OPTIBOND 360",219.49,364.03,140.47,175.59,153.64,196.98,166.81,219.49,175.59,237.29],
["36519","OptiBond Universal Bottle Ref","OPTIBOND UNIVERSAL",107.66,178.56,72.13,90.17,77.52,99.38,86.13,113.33,91.51,123.66],
["36518","OptiBond Universal Uni 100pk","OPTIBOND UNIVERSAL",219.49,364.03,147.06,183.82,158.03,202.61,175.59,231.04,186.57,252.12],
["29669","OptiBond Solo Plus Uni Ref","OPTIBOND SOLO PLUS",275.52,456.94,184.6,230.75,198.37,254.32,220.41,290.02,234.19,316.47],
["36659","OptiBond eXTRa Unidose Kit","OPTIBOND eXTRa",244.77,406.01,164.0,204.99,176.23,225.94,195.82,257.65,208.05,281.15],
["N01I","BOND 1 Primer/Adhesive Kit","BOND-1",100.53,160.77,65.34,81.68,70.37,90.22,75.4,99.21,80.42,108.68],
["N01IAB","BOND 1 Refill 6mL","BOND-1",94.88,158.13,61.67,77.09,66.42,85.15,71.16,93.63,75.9,102.57],
["36711","SonicFill 3 A1 Refill 20 tips","SONICFILL 3",105.55,175.07,74.05,92.57,79.05,101.34,84.31,110.94,89.58,121.05],
["36710","SonicFill 3 Intro Kit","SONICFILL 3",409.12,678.53,287.04,358.8,306.39,392.81,326.81,430.01,347.22,469.22],
["34418","MaxCem Elite Bulk Pack","MAXCEM ELITE",194.04,321.84,122.25,152.81,133.89,171.65,145.53,191.49,153.29,207.15],
["33872","MaxCem Elite Ref CLR pk2","MAXCEM ELITE",126.25,209.39,79.54,99.42,87.11,111.68,94.69,124.59,99.74,134.78],
["36299","MaxCem Elite Chroma Bulk Kit","MAXCEM ELITE CHROMA",214.06,355.07,134.86,168.57,147.7,189.36,160.55,211.24,169.11,228.52],
["N56A","Simile 10 Syringe Kit","SIMILE",443.64,739.39,227.59,284.49,265.7,340.64,309.98,407.87,332.12,448.81],
["N56BA","Simile A1 Syringe","SIMILE",60.21,100.34,30.89,38.61,36.06,46.23,42.07,55.36,45.07,60.91],
["32611","Premise Master Syringe Kit","PREMISE",659.73,1099.54,435.42,544.28,476.98,611.52,524.29,689.85,560.31,757.17],
["32617","Premise Syr Ref Body A1 4gm","PREMISE",109.33,182.22,72.16,90.2,79.05,101.34,86.88,114.32,92.86,125.49],
["33682","NX3 Light-Cure Kit","NX3",164.77,274.59,107.1,133.88,115.34,147.87,123.58,162.6,131.82,178.13],
["13-1100","CaviWipes Towelettes CN160","CAVIWIPES",8.4,13.99,5.94,7.42,6.28,8.05,6.64,8.74,7.01,9.47],
["13-1150","CaviWipes XL Towelettes CN65","CAVIWIPES XL",10.06,16.75,7.11,8.89,7.52,9.64,7.95,10.46,8.38,11.32],
["14-1100","CaviWipes 2.0 Towelettes CN160","CAVIWIPES 2.0",8.24,13.73,6.12,7.65,6.48,8.31,6.85,9.01,7.23,9.77],
["13-5100","CaviWipes 1 Towelettes CN160","CAVIWIPES1",9.37,15.6,6.51,8.14,6.88,8.82,7.28,9.58,7.67,10.36],
["13-1000","CaviCide Gallon","CAVICIDE",22.86,38.07,16.59,20.74,17.55,22.5,18.56,24.42,19.57,26.45],
["13-5000","CaviCide 1 Gallon","CAVICIDE1",25.11,41.81,17.9,22.37,18.93,24.27,20.02,26.34,21.11,28.53],
["33215","TempBond Automix","TEMPBOND",89.92,149.12,62.87,78.59,67.11,86.03,71.59,94.19,76.05,102.78],
["33217","TempBond NE Automix","TEMPBOND NE",89.92,149.12,62.87,78.59,67.11,86.03,71.59,94.19,76.05,102.78],
["N11VA","Flow-It ALC Value Pk A1 pk6","FLOW-IT ALC",93.61,156.0,48.02,60.03,56.06,71.88,65.41,86.06,70.08,94.7],
["29684","Point 4 Syringe Kit","POINT 4",411.92,686.51,271.87,339.83,297.82,381.82,327.35,430.73,349.84,472.76],
["N32","Build-It FR Intro Kit","BUILD IT F.R.",199.18,330.37,139.47,174.33,148.87,190.86,158.79,208.93,168.73,228.01],
["910860-1","Demi Plus LED Curing System","DEMI PLUS",1343.12,2238.54,886.46,1108.07,971.08,1244.97,1067.38,1404.44,1140.71,1541.5],
["N56CA","Simile A2 Syringe","SIMILE",60.21,100.34,30.89,38.61,36.06,46.23,42.07,55.36,45.07,60.91],
["34338","Herculite Ultra Syringe A2","HERCULITE ULTRA",107.94,179.89,82.12,102.65,87.22,111.81,92.6,121.84,97.98,132.4],
];

// ═════════════════════════════════════════════════════════════════
// MAIN APP
// ═════════════════════════════════════════════════════════════════
export default function App() {
  const [tab, setTab] = useState("today");
  const [view, setView] = useState(null);
  const [adjs, setAdjs] = useState([]);
  const [estPct, setEstPct] = useState(90);
  const [gFilt, setGFilt] = useState("All");
  const [gSearch, setGSearch] = useState("");
  const [dataSource, setDataSource] = useState("preloaded");
  const [groups, setGroups] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadMsg, setUploadMsg] = useState(null);
  const fileRef = useRef(null);

  // Hydrate dealer info onto groups (handles preloaded data that was built without dealer field)
  const hydrateDealer = (grps) => {
    if (!grps) return grps;
    return grps.map(g => ({
      ...g,
      children: g.children?.map(c => ({
        ...c,
        dealer: c.dealer || DEALERS[c.id] || "Unknown"
      }))
    }));
  };

  // Load pre-loaded data on mount
  useEffect(() => {
    // Check localStorage first
    try {
      const saved = localStorage.getItem("accel_data");
      if (saved) {
        const parsed = JSON.parse(saved);
        setGroups(hydrateDealer(parsed.groups));
        setDataSource(`CSV uploaded ${parsed.generated}`);
        setLoading(false);
        return;
      }
    } catch(e) {}

    // Load pre-loaded data
    try {
      const { PRELOADED } = require("@/data/preloaded-data");
      setGroups(hydrateDealer(PRELOADED.groups));
      setDataSource(`Pre-loaded ${PRELOADED.generated}`);
    } catch(e) {
      setGroups([]);
      setDataSource("No data — upload CSV");
    }
    setLoading(false);
  }, []);

  // Handle CSV upload
  const handleUpload = useCallback((e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadMsg("Processing CSV...");
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target.result;
        const rows = parseCSV(text);
        const result = processCSVData(rows);
        setGroups(result.groups);
        setDataSource(`CSV uploaded ${result.generated}`);
        localStorage.setItem("accel_data", JSON.stringify(result));
        setUploadMsg(`OK Loaded ${result.groups.length} groups from CSV`);
        setTimeout(() => setUploadMsg(null), 4000);
      } catch(err) {
        setUploadMsg(`ERR Error: ${err.message}`);
        setTimeout(() => setUploadMsg(null), 5000);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }, []);

  // Flatten all children for "Today" scoring
  const allChildren = useMemo(() => {
    if (!groups) return [];
    return groups.flatMap(g =>
      g.children.map(c => ({ ...c, gName: fixGroupName(g), gId: g.id, gTier: g.tier }))
    );
  }, [groups]);

  const totalAdjQ1 = adjs.reduce((s,a) => s + a.credited, 0);

  // Compute Q1 totals from data
  const q1CYFromData = useMemo(() => {
    if (!groups) return 0;
    return groups.reduce((s,g) => s + (g.cyQ?.["1"]||0), 0);
  }, [groups]);

  const q1CY = q1CYFromData + totalAdjQ1;
  const q1Gap = Q1_TARGET - q1CY;
  const q1Att = q1CY / Q1_TARGET;

  // Score all accounts
  const scored = useMemo(() => {
    return allChildren.map(a => {
      const myAdj = adjs.filter(m => m.acctId === a.id);
      const adjCY = (a.cyQ?.["1"]||0) + myAdj.reduce((s,m) => s + m.credited, 0);
      const adjusted = { ...a, cyQ: { ...a.cyQ, "1": adjCY }, adjCount: myAdj.length };
      return { ...adjusted, ...scoreAccount(adjusted, "1") };
    }).sort((a,b) => b.score - a.score);
  }, [allChildren, adjs]);

  if (loading) return <div style={{background:T.bg,color:T.t1,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif"}}><div style={{textAlign:"center"}}><div style={{fontSize:20,marginBottom:8,color:T.blue}}><IconBolt c={T.blue}/></div><div style={{color:T.t3}}>Loading Accelerate...</div></div></div>;

  return (
    <div style={{background:T.bg,color:T.t1,minHeight:"100vh",fontFamily:"'DM Sans',-apple-system,sans-serif",maxWidth:960,margin:"0 auto",position:"relative"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        .m{font-family:'JetBrains Mono',monospace}
        .hide-sb::-webkit-scrollbar{display:none}
        input[type=range]{-webkit-appearance:none;width:100%;height:6px;border-radius:3px;background:${T.s3};outline:none}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;border-radius:50%;background:${T.blue};cursor:pointer;border:2px solid ${T.bg};box-shadow:0 0 8px rgba(79,142,247,.4)}
        input[type=number]{-moz-appearance:textfield}
        input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none}
        .anim{animation:su .3s cubic-bezier(.16,1,.3,1) both}
        @keyframes su{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
        .bar-g{animation:bg .8s cubic-bezier(.16,1,.3,1) both}
        @keyframes bg{from{width:0}}
        @media(min-width:640px){
          .today-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
          .group-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
        }
      `}</style>

      {/* HEADER */}
      <header style={{position:"sticky",top:0,zIndex:50,borderBottom:`1px solid ${T.b1}`,background:"rgba(10,10,15,.85)",backdropFilter:"blur(32px)",padding:"0 18px",height:52,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{fontSize:15,fontWeight:700}}>Ken <span style={{color:T.blue}}>Scott</span></div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <button onClick={()=>fileRef.current?.click()} style={{background:"rgba(79,142,247,.08)",border:`1px solid rgba(79,142,247,.15)`,borderRadius:8,padding:"4px 10px",display:"flex",alignItems:"center",gap:5,cursor:"pointer",color:T.blue,fontSize:10,fontWeight:600,fontFamily:"inherit"}}><UploadIcon/> CSV</button>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleUpload} style={{display:"none"}}/>
          <div className="m" style={{border:`1px solid ${T.b1}`,background:T.s2,borderRadius:999,padding:"3px 10px",fontSize:10,fontWeight:500,color:T.t4}}>{dataSource}</div>
        </div>
      </header>

      {/* UPLOAD MESSAGE */}
      {uploadMsg && <div className="anim" style={{margin:"8px 16px",padding:"10px 14px",borderRadius:10,background:uploadMsg.startsWith("OK")?"rgba(52,211,153,.08)":"rgba(248,113,113,.08)",border:`1px solid ${uploadMsg.startsWith("OK")?"rgba(52,211,153,.15)":"rgba(248,113,113,.15)"}`,fontSize:12,color:uploadMsg.startsWith("OK")?T.green:uploadMsg.startsWith("ERR")?T.red:T.t3}}>{uploadMsg}</div>}

      {/* TAB CONTENT */}
      {!view && tab==="today" && <TodayTab scored={scored} goAcct={a=>setView({type:"acct",data:a})} q1CY={q1CY} q1Gap={q1Gap} q1Att={q1Att} adjCount={adjs.length} totalAdj={totalAdjQ1} groups={groups||[]} goGroup={g=>setView({type:"group",data:g})}/>}
      {!view && tab==="groups" && <GroupsTab groups={groups||[]} goGroup={g=>setView({type:"group",data:g})} filt={gFilt} setFilt={setGFilt} search={gSearch} setSearch={setGSearch}/>}
      {!view && tab==="calc" && <DashTab groups={groups||[]} q1CY={q1CY} q1Att={q1Att} q1Gap={q1Gap} scored={scored}/>}
      {!view && tab==="est" && <EstTab pct={estPct} setPct={setEstPct} q1CY={q1CY} groups={groups||[]}/>}
      {view?.type==="group" && <GroupDetail group={view.data} goMain={()=>setView(null)} goAcct={a=>setView({type:"acct",data:{...a,gName:fixGroupName(view.data),gId:view.data.id,gTier:view.data.tier},from:view.data})}/>}
      {view?.type==="acct" && <AcctDetail acct={view.data} goBack={()=>view?.from?setView({type:"group",data:view.from}):setView(null)} adjs={adjs} setAdjs={setAdjs} groups={groups||[]} goGroup={g=>setView({type:"group",data:g})}/>}

      {/* NAV BAR */}
      <nav style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:960,zIndex:50,borderTop:`1px solid ${T.b1}`,background:"rgba(10,10,15,.92)",backdropFilter:"blur(32px)"}}>
        <div style={{display:"flex",height:56,alignItems:"center",justifyContent:"space-around",padding:"0 4px"}}>
          {[{k:"today",l:"Today",I:IconBolt},{k:"groups",l:"Groups",I:IconGroup},{k:"calc",l:"Dash",I:IconChart},{k:"est",l:"Estimator",I:IconChart}].map(t=>(
            <button key={t.k} onClick={()=>{setTab(t.k);setView(null)}} style={{background:"none",border:"none",display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"4px 8px",cursor:"pointer",color:tab===t.k&&!view?T.blue:T.t4}}>
              <t.I c={tab===t.k&&!view?T.blue:T.t4}/>
              <span style={{fontSize:9,fontWeight:600,letterSpacing:".5px"}}>{t.l}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

// ─── TODAY TAB ────────────────────────────────────────────────────
function TodayTab({scored,goAcct,q1CY,q1Gap,q1Att,adjCount,totalAdj,groups,goGroup}) {
  // ── Section 1: Q1 status
  const ahead = q1Att >= 1.0;
  const onTrack = !ahead && q1Att >= 0.85;
  const statusColor = ahead ? T.green : onTrack ? T.amber : T.red;
  const statusLabel = ahead ? "Ahead of Target" : onTrack ? "On Track" : "Behind Target";
  const statusBg = ahead ? "rgba(52,211,153,.08)" : onTrack ? "rgba(251,191,36,.08)" : "rgba(248,113,113,.08)";
  const statusBorder = ahead ? "rgba(52,211,153,.18)" : onTrack ? "rgba(251,191,36,.18)" : "rgba(248,113,113,.18)";

  // ── Section 2: Wins & Momentum
  const growing = scored
    .filter(a => (a.cyQ?.["1"]||0) > 0 && (a.pyQ?.["1"]||0) > 0 && (a.cyQ?.["1"]||0) > (a.pyQ?.["1"]||0))
    .sort((a,b) => ((b.cyQ?.["1"]||0)-(b.pyQ?.["1"]||0)) - ((a.cyQ?.["1"]||0)-(a.pyQ?.["1"]||0)))
    .slice(0,5);
  const healthyAccel = scored
    .filter(a => isAccelTier(a.gTier||a.tier) && a.ret >= 0.6 && (a.cyQ?.["1"]||0) > 0)
    .sort((a,b) => (b.cyQ?.["1"]||0) - (a.cyQ?.["1"]||0))
    .slice(0,5);

  // ── Section 3: Action List split
  const hot = scored.filter(a => a.score >= 50).slice(0,10);
  const followUp = scored.filter(a => a.score >= 20 && a.score < 50).slice(0,10);

  const AcctCard = ({a, i, showHot=false}) => (
    <button className="anim" onClick={()=>goAcct(a)}
      style={{animationDelay:`${i*25}ms`,width:"100%",textAlign:"left",background:T.s1,
        border:`1px solid ${showHot?"rgba(248,113,113,.18)":T.b1}`,borderRadius:14,
        padding:"12px 14px",marginBottom:8,cursor:"pointer"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:5}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap",marginBottom:3}}>
            <span className="m" style={{fontSize:10,fontWeight:700,
              color:a.score>=60?T.red:a.score>=40?T.amber:T.t3,
              background:a.score>=60?"rgba(248,113,113,.08)":a.score>=40?"rgba(251,191,36,.08)":T.s2,
              borderRadius:4,padding:"2px 6px"}}>{a.score}pt</span>
            {showHot&&<span style={{fontSize:8,color:T.red,fontWeight:700,background:"rgba(248,113,113,.08)",borderRadius:4,padding:"1px 4px"}}>HOT</span>}
            {a.adjCount>0&&<span style={{fontSize:9,color:T.green,background:"rgba(52,211,153,.08)",borderRadius:4,padding:"2px 5px"}}>+adj</span>}
          </div>
          <div style={{fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.name}</div>
          <div style={{fontSize:10,color:T.t3,marginTop:2}}>{a.city}, {a.st} · {isAccelTier(a.gTier||a.tier)?<span style={{color:T.amber}}>{normalizeTier(a.gTier||a.tier)}</span>:"Private"}</div>
        </div>
        <div style={{textAlign:"right",flexShrink:0,marginLeft:12}}>
          <div className="m" style={{fontSize:12,fontWeight:700,color:T.red}}>{a.gap>0?`-${$$(a.gap)}`:$$(a.gap)}</div>
          <div className="m" style={{fontSize:10,color:T.t4}}>{pc(a.ret)} ret</div>
        </div>
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
        {a.reasons.slice(0,4).map((r,j)=><span key={j} style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:9,color:T.t3,background:T.s2,borderRadius:4,padding:"2px 6px",border:`1px solid ${T.b2}`}}>{r.label}<span style={{color:T.amber,fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>+{r.pts}</span></span>)}
      </div>
    </button>
  );

  const SectionHeader = ({label, color, count, pulse=false}) => (
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,marginTop:4}}>
      <div style={{width:7,height:7,borderRadius:"50%",background:color,flexShrink:0,animation:pulse?"pulse 2s infinite":"none"}}/>
      <span style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1.2px",color}}>{label}</span>
      {count!=null&&<span style={{fontSize:10,color:T.t4,marginLeft:"auto"}}>{count}</span>}
    </div>
  );

  return <div style={{padding:"16px 16px 80px"}}>

    {/* ── SECTION 1: Q1 PROGRESS ── */}
    <div className="anim" style={{background:`linear-gradient(135deg,${T.s1},rgba(79,142,247,.06))`,border:`1px solid ${T.b1}`,borderRadius:16,padding:16,marginBottom:16,boxShadow:"0 4px 24px rgba(0,0,0,.4)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <span style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1.2px",color:T.t3}}>Q1 Progress</span>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:10,fontWeight:700,color:statusColor,background:statusBg,border:`1px solid ${statusBorder}`,borderRadius:999,padding:"2px 10px"}}>{statusLabel}</span>
          <span className="m" style={{fontSize:10,fontWeight:700,color:T.amber}}>{DAYS_LEFT}d left</span>
        </div>
      </div>
      <div style={{display:"flex",alignItems:"baseline",gap:12,marginBottom:8}}>
        <span className="m" style={{fontSize:30,fontWeight:800,color:statusColor}}>{pc(q1Att)}</span>
        <span style={{fontSize:12,color:T.t3}}>{$$(q1CY)} / {$$(Q1_TARGET)}</span>
      </div>
      <Bar pct={q1Att*100} color={`linear-gradient(90deg,${statusColor},${ahead?T.cyan:onTrack?T.orange:T.red})`}/>
      {adjCount>0&&<div style={{marginTop:8,padding:"5px 10px",borderRadius:8,background:"rgba(52,211,153,.06)",border:"1px solid rgba(52,211,153,.12)",fontSize:10,color:T.green}}>+{adjCount} adj: +{$f(totalAdj)}</div>}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:10}}>
        <div style={{borderRadius:8,background:"rgba(248,113,113,.06)",border:"1px solid rgba(248,113,113,.12)",padding:10}}>
          <div style={{fontSize:9,color:T.t3}}>Gap to close</div>
          <div className="m" style={{fontSize:16,fontWeight:700,color:q1Gap<=0?T.green:T.red}}>{q1Gap<=0?`+${$$(-q1Gap)}`:$$(q1Gap)}</div>
        </div>
        <div style={{borderRadius:8,background:"rgba(79,142,247,.06)",border:"1px solid rgba(79,142,247,.12)",padding:10}}>
          <div style={{fontSize:9,color:T.t3}}>$/day needed</div>
          <div className="m" style={{fontSize:16,fontWeight:700,color:T.blue}}>{$f(DAYS_LEFT>0&&q1Gap>0?q1Gap/DAYS_LEFT:0)}</div>
        </div>
      </div>
    </div>

    {/* ── SECTION 2: WINS & MOMENTUM ── */}
    <div className="anim" style={{background:`linear-gradient(135deg,${T.s1},rgba(52,211,153,.04))`,border:"1px solid rgba(52,211,153,.1)",borderRadius:16,padding:14,marginBottom:16}}>
      <SectionHeader label="Wins & Momentum" color={T.green}/>
      {growing.length===0&&healthyAccel.length===0&&(
        <div style={{fontSize:11,color:T.t4,padding:"8px 0"}}>Upload fresh CSV data to see momentum accounts.</div>
      )}
      {growing.length>0&&<>
        <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.t4,marginBottom:6}}>Growing vs Last Year</div>
        {growing.map((a,i)=>{
          const py=a.pyQ?.["1"]||0; const cy=a.cyQ?.["1"]||0; const lift=py>0?((cy-py)/py*100):0;
          return <div key={a.id} className="anim" onClick={()=>goAcct(a)}
            style={{animationDelay:`${i*20}ms`,display:"flex",alignItems:"center",justifyContent:"space-between",
              padding:"9px 12px",marginBottom:6,borderRadius:10,background:T.s2,
              border:"1px solid rgba(52,211,153,.1)",cursor:"pointer"}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.name}</div>
              <div style={{fontSize:10,color:T.t3}}>{a.city}, {a.st}</div>
            </div>
            <div style={{textAlign:"right",flexShrink:0,marginLeft:12}}>
              <div className="m" style={{fontSize:12,fontWeight:700,color:T.green}}>+{$$(cy-py)}</div>
              <div style={{fontSize:9,color:T.green}}>+{lift.toFixed(0)}% vs PY</div>
            </div>
          </div>;
        })}
      </>}
      {healthyAccel.length>0&&<>
        <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.t4,marginTop:growing.length>0?10:0,marginBottom:6}}>Healthy Accelerate Accounts</div>
        {healthyAccel.map((a,i)=>{
          const tier=normalizeTier(a.gTier||a.tier);
          return <div key={a.id} className="anim" onClick={()=>goAcct(a)}
            style={{animationDelay:`${i*20}ms`,display:"flex",alignItems:"center",justifyContent:"space-between",
              padding:"9px 12px",marginBottom:6,borderRadius:10,background:T.s2,
              border:"1px solid rgba(251,191,36,.1)",cursor:"pointer"}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.name}</div>
              <div style={{fontSize:10,color:T.t3}}>{a.city}, {a.st} · <span style={{color:T.amber}}>{tier}</span></div>
            </div>
            <div style={{textAlign:"right",flexShrink:0,marginLeft:12}}>
              <div className="m" style={{fontSize:12,fontWeight:700,color:T.blue}}>{$$(a.cyQ?.["1"]||0)}</div>
              <div style={{fontSize:9,color:T.green}}>{pc(a.ret)} ret</div>
            </div>
          </div>;
        })}
      </>}
    </div>

    {/* ── SECTION 3: ACTION LIST ── */}
    <div>
      {hot.length>0&&<>
        <SectionHeader label="Hot" color={T.red} count={`${hot.length} account${hot.length>1?"s":""}`} pulse={true}/>
        <div style={{fontSize:10,color:T.t4,marginBottom:10}}>Score 50+ · High urgency · Call today</div>
        <div className="today-grid">
          {hot.map((a,i)=><AcctCard key={a.id} a={a} i={i} showHot={true}/>)}
        </div>
      </>}
      {followUp.length>0&&<>
        <div style={{marginTop:hot.length>0?4:0}}>
          <SectionHeader label="Follow Up" color={T.amber} count={`${followUp.length} account${followUp.length>1?"s":""}`}/>
          <div style={{fontSize:10,color:T.t4,marginBottom:10}}>Score 20-49 · Worth a call this week</div>
          <div className="today-grid">
            {followUp.map((a,i)=><AcctCard key={a.id} a={a} i={i}/>)}
          </div>
        </div>
      </>}
      {hot.length===0&&followUp.length===0&&(
        <div style={{padding:"24px 0",textAlign:"center",color:T.t4,fontSize:12}}>No scored accounts — upload a CSV to get started.</div>
      )}
    </div>
  </div>;
}
// ─── GROUPS TAB ──────────────────────────────────────────────────
function GroupsTab({groups,goGroup,filt,setFilt,search,setSearch}) {
  const fs=["All","Schein","Patterson","Benco","Darby","Top 100","Diamond","Platinum","Gold","DSO","Urgent"];
  const isDealerFilt=["Schein","Patterson","Benco","Darby"].includes(filt);

  // Enrich each group with dealer-specific spend for sorting/display
  const enriched=useMemo(()=>groups.map(g=>{
    const kids=isDealerFilt?g.children?.filter(c=>c.dealer===filt)||[]:g.children||[];
    const py1=isDealerFilt?kids.reduce((s,c)=>s+(c.pyQ?.["1"]||0),0):(g.pyQ?.["1"]||0);
    const cy1=isDealerFilt?kids.reduce((s,c)=>s+(c.cyQ?.["1"]||0),0):(g.cyQ?.["1"]||0);
    const gap=py1-cy1;
    const ret=py1>0?cy1/py1:1;
    const locCount=isDealerFilt?kids.length:g.locs;
    return {...g,_py1:py1,_cy1:cy1,_gap:gap,_ret:ret,_locs:locCount};
  }),[groups,filt,isDealerFilt]);

  const list=useMemo(()=>{
    let l=[...enriched];
    if(search){const q=search.toLowerCase();l=l.filter(g=>fixGroupName(g).toLowerCase().includes(q)||g.name.toLowerCase().includes(q)||g.children?.some(c=>c.name.toLowerCase().includes(q)));}
    if(filt==="Urgent")l=l.filter(g=>g._gap>2000&&g._ret<0.3);
    else if(filt==="Top 100")l=l.filter(g=>g.tier==="Top 100"||g.tier?.startsWith("Top 100"));
    else if(filt==="DSO")l=l.filter(g=>g.locs>=3||g.class2==="DSO"||g.class2==="EMERGING DSO");
    else if(isDealerFilt)l=l.filter(g=>g._locs>0);
    else if(filt!=="All")l=l.filter(g=>g.tier===filt||g.tier?.includes(filt));
    if(!isDealerFilt)l.sort((a,b)=>b._gap-a._gap);
    return l;
  },[enriched,filt,search,isDealerFilt]);

  // Dealer split: top spend + hurting
  const dealerTop=useMemo(()=>isDealerFilt?[...list].filter(g=>g._cy1>0).sort((a,b)=>b._cy1-a._cy1).slice(0,10):[],[list,isDealerFilt]);
  const dealerHurt=useMemo(()=>isDealerFilt?[...list].filter(g=>g._gap>0).sort((a,b)=>(b._gap-(b._ret*100))-(a._gap-(a._ret*100))).slice(0,10):[],[list,isDealerFilt]);

  const GroupCard=({g,i,accent}:{g:any,i:number,accent?:string})=>{
    const isUrgent=g._gap>5000&&g._ret<0.2;
    const isGrowing=g._cy1>g._py1&&g._py1>0;
    return <button key={g.id} className="anim" onClick={()=>goGroup(g)} style={{animationDelay:`${i*20}ms`,width:"100%",textAlign:"left",background:T.s1,border:`1px solid ${accent?accent:isUrgent?"rgba(248,113,113,.15)":T.b1}`,borderRadius:14,padding:"14px 16px",marginBottom:8,cursor:"pointer"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{fixGroupName(g)}</div>
          <div style={{fontSize:10,color:T.t3,marginTop:2}}>{g._locs} loc{g._locs>1?"s":""} · {getTierLabel(g.tier)}{isDealerFilt?<span style={{color:T.cyan}}> · {filt}</span>:""}</div>
        </div>
        <div style={{display:"flex",gap:4,alignItems:"center"}}>
          {isGrowing&&<span style={{flexShrink:0,borderRadius:999,background:"rgba(52,211,153,.09)",border:"1px solid rgba(52,211,153,.22)",padding:"2px 8px",fontSize:9,fontWeight:700,color:T.green}}>Growing</span>}
          {isUrgent&&<span style={{flexShrink:0,borderRadius:999,background:"rgba(248,113,113,.09)",border:"1px solid rgba(248,113,113,.22)",padding:"2px 8px",fontSize:9,fontWeight:700,color:T.red}}>Urgent</span>}
          <Chev/>
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:16}}>
        <Pill l="PY" v={$$(g._py1)} c={T.t2}/>
        <Pill l="CY" v={$$(g._cy1)} c={T.blue}/>
        <Pill l="Gap" v={g._gap<=0?`+${$$(Math.abs(g._gap))}`:$$(g._gap)} c={g._gap<=0?T.green:T.red}/>
        <div style={{marginLeft:"auto"}}><Pill l="Ret" v={Math.round(g._ret*100)+"%"} c={g._ret>0.5?T.green:g._ret>0.25?T.amber:T.red}/></div>
      </div>
    </button>;
  };

  return <div style={{padding:"12px 16px 80px"}}>
    <div className="hide-sb" style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4,marginBottom:12}}>
      {fs.map(f=><button key={f} onClick={()=>setFilt(f)} style={{flexShrink:0,whiteSpace:"nowrap",padding:"6px 14px",borderRadius:8,fontSize:12,fontWeight:600,cursor:"pointer",border:`1px solid ${filt===f?"rgba(79,142,247,.25)":T.b2}`,background:filt===f?"rgba(79,142,247,.12)":T.s2,color:filt===f?T.blue:T.t3,fontFamily:"inherit"}}>{f}</button>)}
    </div>
    <div style={{position:"relative",marginBottom:12}}>
      <svg style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",width:14,height:14,color:T.t4}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      <input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search groups…" style={{width:"100%",height:40,borderRadius:10,border:`1px solid ${T.b1}`,background:T.s1,color:T.t1,fontSize:13,paddingLeft:36,paddingRight:12,outline:"none",fontFamily:"inherit"}}/>
    </div>

    {isDealerFilt ? <>
      {/* ── DEALER SPLIT VIEW ── */}
      <div style={{marginBottom:14,padding:"10px 14px",borderRadius:10,background:"rgba(79,142,247,.06)",border:"1px solid rgba(79,142,247,.12)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:11,fontWeight:700,color:T.blue}}>{filt} Territory</span>
        <span style={{fontSize:10,color:T.t4}}>{list.length} groups</span>
      </div>

      {/* TOP ACCOUNTS */}
      <div style={{marginBottom:10,display:"flex",alignItems:"center",gap:8}}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.green} strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        <span style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.green}}>Top Accounts — {filt}</span>
      </div>
      {dealerTop.length===0
        ? <div style={{fontSize:11,color:T.t4,marginBottom:16,padding:"10px 14px",background:T.s1,borderRadius:10}}>No active {filt} accounts this quarter</div>
        : dealerTop.map((g,i)=><GroupCard key={g.id} g={g} i={i} accent="rgba(52,211,153,.15)"/>)
      }

      {/* HURTING YOU */}
      <div style={{marginTop:8,marginBottom:10,display:"flex",alignItems:"center",gap:8}}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.red} strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <span style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.red}}>Hurting You — {filt}</span>
      </div>
      {dealerHurt.length===0
        ? <div style={{fontSize:11,color:T.t4,padding:"10px 14px",background:T.s1,borderRadius:10}}>No significant gaps with {filt}</div>
        : dealerHurt.map((g,i)=><GroupCard key={g.id} g={g} i={i} accent="rgba(248,113,113,.15)"/>)
      }
    </> : <>
      {/* ── STANDARD LIST VIEW ── */}
      <div style={{marginBottom:8,fontSize:10,color:T.t4}}>{list.length} groups</div>
      {list.slice(0,50).map((g,i)=><GroupCard key={g.id} g={g} i={i}/>)}
      {list.length>50&&<div style={{textAlign:"center",padding:16,fontSize:11,color:T.t4}}>Showing top 50 of {list.length} groups. Use search to find more.</div>}
    </>}
  </div>;
}

// ─── GROUP DETAIL ────────────────────────────────────────────────
function GroupDetail({group,goMain,goAcct}) {
  const [q,setQ]=useState("1");
  const qk=q;
  const py=group.pyQ?.[qk]||0;const cy=group.cyQ?.[qk]||0;
  const gap=py-cy;const ret=py>0?Math.round(cy/py*100):0;

  return <div style={{paddingBottom:80}}>
    <div style={{position:"sticky",top:52,zIndex:40,background:"rgba(10,10,15,.9)",backdropFilter:"blur(20px)",borderBottom:`1px solid ${T.b3}`,padding:"10px 16px"}}>
      <button onClick={goMain} style={{background:"none",border:"none",color:T.blue,cursor:"pointer",display:"flex",alignItems:"center",gap:4,fontSize:13,fontWeight:600,fontFamily:"inherit"}}><Back/> Groups</button>
    </div>
    <div style={{padding:"16px 16px 0"}}>
      <div className="anim" style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:16,padding:16,marginBottom:16}}>
        <div style={{fontSize:16,fontWeight:700,marginBottom:4}}>{fixGroupName(group)}</div>
        <div style={{fontSize:11,color:T.t3,marginBottom:12}}>{group.locs} locations · {getTierLabel(group.tier)}</div>
        {/* Quarter selector */}
        <div style={{display:"flex",gap:4,marginBottom:12}}>
          {["1","2","3","4","FY"].map(qr=>(
            <button key={qr} onClick={()=>setQ(qr)} style={{flex:1,padding:"6px 0",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",border:`1px solid ${q===qr?"rgba(79,142,247,.25)":T.b2}`,background:q===qr?"rgba(79,142,247,.12)":T.s2,color:q===qr?T.blue:T.t3,fontFamily:"inherit"}}>{qr==="FY"?"FY":`Q${qr}`}</button>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8}}>
          <Stat l="PY" v={$$(py)} c={T.t2}/><Stat l="CY" v={$$(cy)} c={T.blue}/><Stat l="Gap" v={gap<=0?`+${$$(Math.abs(gap))}`:$$(gap)} c={gap<=0?T.green:T.red}/><Stat l="Ret" v={ret+"%"} c={ret>30?T.green:ret>15?T.amber:T.red}/>
        </div>
      </div>
      <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.t3,marginBottom:8}}>Locations ({group.children.length})</div>
      {group.children.map((c,i)=>{
        const cPy=c.pyQ?.[qk]||0;const cCy=c.cyQ?.[qk]||0;const cGap=cPy-cCy;const cRet=cPy>0?Math.round(cCy/cPy*100):0;
        return <button key={c.id} className="anim" onClick={()=>goAcct(c)} style={{animationDelay:`${i*30}ms`,width:"100%",textAlign:"left",background:T.s1,border:`1px solid ${T.b1}`,borderRadius:12,padding:"12px 14px",marginBottom:8,cursor:"pointer"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
            <div style={{fontSize:12,fontWeight:600,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</div><Chev/>
          </div>
          <div style={{fontSize:10,color:T.t3,marginBottom:6}}>{c.city}, {c.st}{c.dealer&&c.dealer!=="Unknown"?<span style={{color:T.cyan}}> · {c.dealer}</span>:""} · Last {c.last}d ago</div>
          <div style={{display:"flex",gap:12}}>
            <Pill l="PY" v={$$(cPy)} c={T.t2}/><Pill l="CY" v={$$(cCy)} c={T.blue}/><Pill l="Gap" v={cGap<=0?`+${$$(Math.abs(cGap))}`:$$(cGap)} c={cGap<=0?T.green:T.red}/><div style={{marginLeft:"auto"}}><Pill l="Ret" v={cRet+"%"} c={T.t3}/></div>
          </div>
          {(c.products||[]).length>0&&<div style={{marginTop:8,display:"flex",gap:4,flexWrap:"wrap"}}>
            {c.products.slice(0,4).map((p,j)=>{
              const pCy=p[`cy${qk}`]||0;const pPy=p[`py${qk}`]||0;
              return <span key={j} style={{fontSize:8,color:pPy>200&&pCy===0?T.red:T.t3,background:pPy>200&&pCy===0?"rgba(248,113,113,.06)":T.s2,borderRadius:4,padding:"2px 5px",border:`1px solid ${pPy>200&&pCy===0?"rgba(248,113,113,.12)":T.b2}`}}>{p.n.split(" ")[0]} {pPy>200&&pCy===0?"!$0":$$(pCy)}</span>;
            })}
          </div>}
        </button>;
      })}
    </div>
  </div>;
}

// ─── ACCOUNT DETAIL ──────────────────────────────────────────────
function AcctDetail({acct,goBack,adjs,setAdjs,groups,goGroup}) {
  const [q,setQ]=useState("1");
  const [showForm,setShowForm]=useState(false);
  const [toast,setToast]=useState(null);
  const [aiState,setAiState]=useState("idle"); // idle | loading | done | error
  const [aiText,setAiText]=useState("");
  const qk=q;

  const myAdj=adjs.filter(m=>m.acctId===acct.id);
  const adjTotal=myAdj.reduce((s,m)=>s+m.credited,0);
  const acctTier=acct.tier||acct.gTier||"Standard";
  const tierRate=getTierRate(acctTier);
  const isAccel=isAccelTier(acctTier);
  const acctType=getTierLabel(acctTier);

  // Parent group + siblings
  const parentGroup=useMemo(()=>acct.gId?(groups||[]).find(g=>g.id===acct.gId):null,[groups,acct.gId]);
  const siblings=useMemo(()=>parentGroup?( parentGroup.children?.filter(c=>c.id!==acct.id)||[]).sort((a,b)=>((b.pyQ?.["1"]||0)-(b.cyQ?.["1"]||0))-((a.pyQ?.["1"]||0)-(a.cyQ?.["1"]||0))):[]  ,[parentGroup,acct.id]);

  const pyVal=acct.pyQ?.[qk]||0;
  const cyBase=acct.cyQ?.[qk]||0;
  const cyVal=qk==="1"?cyBase+adjTotal:cyBase;
  const gap=pyVal-cyVal;
  const ret=pyVal>0?cyVal/pyVal:0;

  const products=acct.products||[];
  const buying=products.filter(p=>(p[`cy${qk}`]||0)>0).sort((a,b)=>(b[`cy${qk}`]||0)-(a[`cy${qk}`]||0));
  const stopped=products.filter(p=>(p[`py${qk}`]||0)>100&&(p[`cy${qk}`]||0)===0);
  const allProdNames=products.map(p=>p.n);
  const xsell=["KERR CLEANSE","MAXCEM ELITE","DEMI PLUS","SONICFILL 3","PREMISE"].filter(n=>!allProdNames.some(an=>an.includes(n.split(" ")[0])));

  const runAI = async () => {
    setAiState("loading"); setAiText("");
    const payload = {
      name: acct.name, city: acct.city, state: acct.st,
      tier: acctType, dealer: acct.dealer||"Unknown",
      group: acct.gName||"None", lastOrderDays: acct.last,
      Q1_PY: pyVal, Q1_CY: cyVal, gap, retentionPct: Math.round(ret*100),
      buying: buying.slice(0,6).map(p=>({name:p.n, py:p[`py1`]||0, cy:p[`cy1`]||0})),
      stopped: stopped.slice(0,5).map(p=>({name:p.n, py:p[`py1`]||0})),
      crossSellOpportunities: xsell,
      groupLocations: (parentGroup?.locs||1),
    };
    const prompt = `You are an AI assistant for Ken Scott, a dental territory sales manager for Kerr dental products covering CT/MA/RI/NY.

Here is the account data for one of Ken's accounts:
${JSON.stringify(payload, null, 2)}

Write a concise, plain-English sales rep briefing in 3-4 short paragraphs. Cover:
1. Account health snapshot — what the retention and gap numbers mean in plain English
2. What stopped or declined and why it might matter
3. The single best action Ken should take on his next visit, specific and direct
4. Any upsell or cross-sell angle worth mentioning

Be direct, specific, and helpful. Write like a smart sales coach, not a chatbot. No bullet lists — prose only. Keep it under 180 words.`;

    try {
      const res = await fetch("/api/ai-briefing", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({prompt})
      });
      const data = await res.json();
      if (data?.text) {
        setAiText(data.text);
        setAiState("done");
      } else {
        setAiState("error");
        setAiText(data?.error || "No response received. Try again.");
      }
    } catch(e) {
      setAiState("error");
      setAiText("Connection error. Check network and try again.");
    }
  };

  return <div style={{paddingBottom:80}}>
    <div style={{position:"sticky",top:52,zIndex:40,background:"rgba(10,10,15,.9)",backdropFilter:"blur(20px)",borderBottom:`1px solid ${T.b3}`,padding:"10px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <button onClick={goBack} style={{background:"none",border:"none",color:T.blue,cursor:"pointer",display:"flex",alignItems:"center",gap:4,fontSize:13,fontWeight:600,fontFamily:"inherit"}}><Back/> Back</button>
      <button onClick={()=>aiState==="idle"||aiState==="error"?runAI():setAiState("idle")} style={{background:aiState==="done"?"rgba(167,139,250,.12)":"rgba(167,139,250,.08)",border:`1px solid ${aiState==="done"?"rgba(167,139,250,.3)":"rgba(167,139,250,.18)"}`,borderRadius:8,padding:"5px 12px",fontSize:11,fontWeight:700,color:T.purple,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:5}}>
        {aiState==="loading"?<><span style={{animation:"pulse 1s infinite"}}>●</span> Thinking...</>:aiState==="done"?"✦ AI Briefing":"✦ AI Briefing"}
      </button>
    </div>
    <div style={{padding:"16px 16px 0"}}>
      {toast&&<div className="anim" style={{background:"rgba(52,211,153,.12)",border:"1px solid rgba(52,211,153,.25)",borderRadius:12,padding:"12px 16px",marginBottom:12,display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:16,color:T.green,fontWeight:700}}>+</span>
        <div><div style={{fontSize:13,fontWeight:700,color:T.green}}>Sale recorded!</div><div style={{fontSize:11,color:T.t3}}>+{$f(toast)} credited → Q1 updated</div></div>
      </div>}

      {/* AI BRIEFING CARD */}
      {(aiState==="loading"||aiState==="done"||aiState==="error")&&<div className="anim" style={{background:`linear-gradient(135deg,${T.s1},rgba(167,139,250,.06))`,border:`1px solid rgba(167,139,250,.2)`,borderRadius:16,padding:16,marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{display:"flex",alignItems:"center",gap:7}}>
            <span style={{fontSize:14,color:T.purple}}>✦</span>
            <span style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.purple}}>AI Account Briefing</span>
          </div>
          <button onClick={()=>{setAiState("idle");setAiText("");}} style={{background:"none",border:"none",color:T.t4,cursor:"pointer",fontSize:16,lineHeight:1}}>✕</button>
        </div>
        {aiState==="loading"&&<div style={{display:"flex",flexDirection:"column",gap:8}}>
          {[100,80,90,60].map((w,i)=><div key={i} style={{height:10,borderRadius:5,background:T.s3,width:`${w}%`,animation:"pulse 1.5s infinite",animationDelay:`${i*150}ms`}}/>)}
          <div style={{fontSize:11,color:T.t4,marginTop:4}}>Analyzing account data...</div>
        </div>}
        {aiState==="done"&&<div style={{fontSize:12,color:T.t2,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{aiText}</div>}
        {aiState==="error"&&<div style={{fontSize:12,color:T.red}}>{aiText}</div>}
      </div>}

      {/* ACCOUNT HEADER */}
      <div className="anim" style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:16,padding:16,marginBottom:12}}>
        <div style={{fontSize:16,fontWeight:700}}>{acct.name}</div>
        <div style={{fontSize:11,color:T.t3,marginTop:2}}>{acct.city}, {acct.st} · <span style={{color:isAccel?T.amber:T.t3}}>{acctType}</span> · Last {acct.last}d ago</div>
        {(()=>{const h=getHealthStatus(ret,gap,cyVal,pyVal);return <div style={{display:"inline-flex",alignItems:"center",marginTop:6,fontSize:10,fontWeight:700,color:h.color,background:h.bg,border:`1px solid ${h.border}`,borderRadius:999,padding:"3px 10px",letterSpacing:".2px"}}>{h.label}</div>;})()}
        <div style={{fontSize:10,color:T.t4,marginTop:2,display:"flex",gap:8,flexWrap:"wrap"}}>
          {acct.gName&&<span>Group: {acct.gName}</span>}
          {acct.dealer&&acct.dealer!=="Unknown"&&<span style={{color:T.cyan}}>Dealer: {acct.dealer}</span>}
        </div>

        {/* QUARTER SELECTOR */}
        <div style={{display:"flex",gap:4,marginTop:12,marginBottom:12}}>
          {["1","2","3","4","FY"].map(qr=>(
            <button key={qr} onClick={()=>setQ(qr)} style={{flex:1,padding:"6px 0",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",border:`1px solid ${q===qr?"rgba(79,142,247,.25)":T.b2}`,background:q===qr?"rgba(79,142,247,.12)":T.s2,color:q===qr?T.blue:T.t3,fontFamily:"inherit"}}>{qr==="FY"?"FY":`Q${qr}`}</button>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8}}>
          <Stat l="PY" v={$$(pyVal)} c={T.t2}/>
          <Stat l="CY" v={$$(cyVal)} c={T.blue}/>
          <Stat l="Gap" v={gap<=0?`+${$$(Math.abs(gap))}`:$$(gap)} c={gap<=0?T.green:T.red}/>
          <Stat l="Ret" v={pc(ret)} c={ret>.3?T.green:ret>.15?T.amber:T.red}/>
        </div>
        {qk!=="1"&&<div style={{marginTop:6,fontSize:10,color:T.t4,textAlign:"center"}}>Showing {qk==="FY"?"Full Year":`Q${qk}`}. Manual adjustments apply to Q1.</div>}
        {myAdj.length>0&&qk==="1"&&<div style={{marginTop:8,borderRadius:8,background:"rgba(52,211,153,.06)",border:"1px solid rgba(52,211,153,.12)",padding:"8px 10px"}}>
          <div style={{fontSize:10,fontWeight:600,color:T.green,marginBottom:4}}>Adjustments ({myAdj.length})</div>
          {myAdj.map(a=><div key={a.id} style={{fontSize:10,color:T.t3,display:"flex",justifyContent:"space-between",marginBottom:2}}><span>{a.desc||"Manual"}</span><span className="m" style={{color:T.green,fontWeight:600}}>+{$f(a.credited)}</span></div>)}
        </div>}
      </div>

      {/* PARENT GROUP SUMMARY */}
      {parentGroup&&<div className="anim" style={{animationDelay:"60ms",background:T.s1,border:`1px solid rgba(79,142,247,.18)`,borderRadius:16,padding:16,marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.blue}}>Parent Group</div>
          <button onClick={()=>goGroup(parentGroup)} style={{background:"rgba(79,142,247,.08)",border:"1px solid rgba(79,142,247,.15)",borderRadius:8,padding:"3px 10px",fontSize:10,fontWeight:600,color:T.blue,cursor:"pointer",fontFamily:"inherit"}}>View Group →</button>
        </div>
        <div style={{fontSize:14,fontWeight:700,marginBottom:2}}>{fixGroupName(parentGroup)}</div>
        <div style={{fontSize:10,color:T.t3,marginBottom:10}}>{parentGroup.locs} location{parentGroup.locs>1?"s":""} · {getTierLabel(parentGroup.tier)}</div>
        {(()=>{
          const gPy=parentGroup.pyQ?.["1"]||0;
          const gCy=parentGroup.cyQ?.["1"]||0;
          const gGap=gPy-gCy;
          const gRet=gPy>0?gCy/gPy:0;
          const thisLocPct=gCy>0?(acct.cyQ?.["1"]||0)/gCy:0;
          return <>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6,marginBottom:10}}>
              <Stat l="PY" v={$$(gPy)} c={T.t2}/>
              <Stat l="CY" v={$$(gCy)} c={T.blue}/>
              <Stat l="Gap" v={gGap<=0?`+${$$(Math.abs(gGap))}`:$$(gGap)} c={gGap<=0?T.green:T.red}/>
              <Stat l="Ret" v={Math.round(gRet*100)+"%"} c={gRet>.5?T.green:gRet>.25?T.amber:T.red}/>
            </div>
            <div style={{fontSize:10,color:T.t4}}>This location = <span style={{color:T.cyan,fontWeight:700}}>{Math.round(thisLocPct*100)}%</span> of group's Q1 CY spend</div>
          </>;
        })()}

        {/* SIBLING LOCATIONS */}
        {siblings.length>0&&<>
          <div style={{borderTop:`1px solid ${T.b1}`,marginTop:12,paddingTop:12,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.t3,marginBottom:8}}>Other Locations ({siblings.length})</div>
          {siblings.slice(0,6).map((s,i)=>{
            const sPy=s.pyQ?.["1"]||0;const sCy=s.cyQ?.["1"]||0;
            const sGap=sPy-sCy;const sRet=sPy>0?Math.round(sCy/sPy*100):0;
            const isDown=sGap>0&&sRet<50;
            return <div key={s.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",borderRadius:10,background:isDown?"rgba(248,113,113,.04)":T.s2,border:`1px solid ${isDown?"rgba(248,113,113,.1)":T.b2}`,marginBottom:6}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:11,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.name}</div>
                <div style={{fontSize:9,color:T.t4,marginTop:1}}>{s.city}, {s.st}{s.dealer&&s.dealer!=="Unknown"?<span style={{color:T.cyan}}> · {s.dealer}</span>:""}</div>
              </div>
              <div style={{display:"flex",gap:8,flexShrink:0,marginLeft:8}}>
                <Pill l="CY" v={$$(sCy)} c={T.blue}/>
                <Pill l="Gap" v={sGap<=0?`+${$$(Math.abs(sGap))}`:$$(sGap)} c={sGap<=0?T.green:T.red}/>
                <Pill l="Ret" v={sRet+"%"} c={sRet>50?T.green:sRet>25?T.amber:T.red}/>
              </div>
            </div>;
          })}
          {siblings.length>6&&<div style={{fontSize:10,color:T.t4,textAlign:"center",padding:"4px 0"}}>+{siblings.length-6} more locations — tap View Group</div>}
        </>}
      </div>}

      {/* VISIT PREP */}
      <div className="anim" style={{animationDelay:"80ms",background:T.s1,border:`1px solid ${T.b1}`,borderRadius:16,padding:16,marginBottom:12}}>
        <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.blue,marginBottom:10}}>Visit Prep Briefing</div>
        {buying.length>0&&<div style={{marginBottom:12}}>
          <div style={{fontSize:10,fontWeight:600,color:T.green,marginBottom:6}}>Currently Buying ({buying.length})</div>
          {buying.slice(0,8).map((p,i)=>{
            const pPy=p[`py${qk}`]||0;const pCy=p[`cy${qk}`]||0;
            return <div key={i} style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
              <span style={{fontSize:11,color:T.t2,flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.n}</span>
              <span className="m" style={{fontSize:10,color:T.t4,width:50,textAlign:"right"}}>{$$(pPy)}</span>
              <span style={{fontSize:8,color:T.t4}}>→</span>
              <span className="m" style={{fontSize:10,color:T.blue,width:50,textAlign:"right"}}>{$$(pCy)}</span>
              <div style={{width:50,height:4,borderRadius:2,background:T.s3,overflow:"hidden"}}><div className="bar-g" style={{height:"100%",borderRadius:2,width:`${Math.min(pPy>0?pCy/pPy*100:0,100)}%`,background:pPy>0&&pCy/pPy>.3?T.green:T.amber}}/></div>
            </div>;
          })}
        </div>}
        {stopped.length>0&&<div style={{marginBottom:12}}>
          <div style={{fontSize:10,fontWeight:600,color:T.red,marginBottom:6}}>Stopped Buying ({stopped.length})</div>
          {stopped.slice(0,6).map((p,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 8px",borderRadius:6,background:"rgba(248,113,113,.04)",border:"1px solid rgba(248,113,113,.08)",marginBottom:4}}>
            <span style={{fontSize:11}}>{p.n}</span>
            <span className="m" style={{fontSize:10,color:T.red}}>Was {$$(p[`py${qk}`]||0)} → $0</span>
          </div>)}
          {stopped.length>0&&<div style={{marginTop:6,fontSize:10,color:T.t3,fontStyle:"italic"}}>"I noticed {stopped[0]?.n} dropped off. Supply issue or switch? We have new promos..."</div>}
        </div>}
        {xsell.length>0&&<div>
          <div style={{fontSize:10,fontWeight:600,color:T.purple,marginBottom:6}}>Cross-Sell White Space</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
            {xsell.map((n,i)=><span key={i} style={{fontSize:10,color:T.purple,background:"rgba(167,139,250,.06)",border:"1px solid rgba(167,139,250,.12)",borderRadius:6,padding:"3px 8px"}}>{n}</span>)}
          </div>
        </div>}
      </div>

      {/* NEXT BEST MOVE */}
      {(()=>{
        const moves = [];
        // 1. Stopped products — highest value first
        const topStopped = [...stopped].sort((a,b)=>(b[`py${qk}`]||0)-(a[`py${qk}`]||0));
        if (topStopped.length === 1) moves.push({icon:"🎯", color:T.red, text:`Re-engage on ${topStopped[0].n} — was ${$$(topStopped[0][`py${qk}`]||0)} last year, nothing this quarter.`});
        else if (topStopped.length > 1) moves.push({icon:"🎯", color:T.red, text:`${topStopped.length} products stopped. Lead with ${topStopped[0].n} (was ${$$(topStopped[0][`py${qk}`]||0)}) — ask what changed.`});
        // 2. Tier upsell
        const nt = normalizeTier(acctTier);
        if (nt === "Silver") moves.push({icon:"⬆️", color:T.amber, text:`Gold upgrade saves doctor ~6% vs Silver MSRP. At ${$$(cyVal)} spend, that's a meaningful difference — worth the conversation.`});
        else if (nt === "Standard" && pyVal > 1000) moves.push({icon:"⬆️", color:T.amber, text:`Not on Accelerate. At ${$$(pyVal)} PY spend, Silver tier would meaningfully lower their cost. Pitch the program.`});
        // 3. Cross-sell white space
        if (xsell.length > 0) moves.push({icon:"💡", color:T.purple, text:`Not buying ${xsell.slice(0,2).join(" or ")}. High-volume Kerr products with no history here — good conversation starter.`});
        // 4. Retention recovery if no stopped products
        if (moves.length < 2 && ret < 0.5 && gap > 500) moves.push({icon:"📞", color:T.blue, text:`Retention at ${Math.round(ret*100)}% — ${$$(gap)} gap to close. Check in on supply chain, competitor activity, or budget cycle.`});
        // 5. Growing — reinforce
        if (cyVal > pyVal) moves.push({icon:"✅", color:T.green, text:`Up ${$$(cyVal-pyVal)} vs last year. Reinforce the relationship — ask about upcoming procedures to lock in Q2.`});
        if (moves.length === 0) return null;
        return <div className="anim" style={{animationDelay:"120ms",background:`linear-gradient(135deg,${T.s1},rgba(79,142,247,.04))`,border:`1px solid rgba(79,142,247,.15)`,borderRadius:16,padding:16,marginBottom:12}}>
          <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.blue,marginBottom:12}}>Next Best Move</div>
          {moves.slice(0,3).map((m,i)=><div key={i} style={{display:"flex",gap:10,marginBottom:i<moves.slice(0,3).length-1?10:0}}>
            <span style={{fontSize:14,flexShrink:0,lineHeight:1.4}}>{m.icon}</span>
            <div style={{fontSize:12,color:T.t2,lineHeight:1.5,borderLeft:`2px solid ${m.color}`,paddingLeft:10}}>{m.text}</div>
          </div>)}
        </div>;
      })()}

      {/* PRODUCT BREAKDOWN BARS */}
      <div className="anim" style={{animationDelay:"160ms",background:T.s1,border:`1px solid ${T.b1}`,borderRadius:16,padding:16,marginBottom:12}}>
        <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.t3,marginBottom:10}}>Product Breakdown — {qk==="FY"?"Full Year":`Q${qk}`}</div>
        {products.sort((a,b)=>Math.abs(b[`py${qk}`]||0)-Math.abs(a[`py${qk}`]||0)).slice(0,10).map((p,i)=>{
          const pPy=Math.abs(p[`py${qk}`]||0);const pCy=Math.abs(p[`cy${qk}`]||0);
          const mx=Math.max(...products.map(x=>Math.abs(x[`py${qk}`]||0)),1);
          return <div key={i} style={{marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:11,color:T.t2}}>{p.n}</span><span className="m" style={{fontSize:10,color:pCy===0&&pPy>100?T.red:T.t3}}>{$$(pCy)} / {$$(pPy)}</span></div>
            <div style={{position:"relative",height:12,borderRadius:3,background:T.s3,overflow:"hidden"}}>
              <div style={{position:"absolute",top:0,left:0,height:"50%",width:`${pPy/mx*100}%`,background:"rgba(255,255,255,.08)"}}/>
              <div className="bar-g" style={{animationDelay:`${i*60}ms`,position:"absolute",bottom:0,left:0,height:"50%",width:`${pCy/mx*100}%`,background:pCy===0?T.red:`linear-gradient(90deg,${T.blue},${T.cyan})`}}/>
            </div>
          </div>;
        })}
        <div style={{display:"flex",gap:12,marginTop:8,fontSize:9,color:T.t4}}><span>▬ PY (top)</span><span style={{color:T.blue}}>▬ CY (bottom)</span></div>
      </div>

      {/* MANUAL SALE */}
      <div className="anim" style={{animationDelay:"240ms",background:T.s1,border:`1px solid ${T.b1}`,borderRadius:16,padding:16,marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.amber}}>Add Manual Sale</div>
          <button onClick={()=>setShowForm(!showForm)} style={{background:"rgba(251,191,36,.08)",border:"1px solid rgba(251,191,36,.15)",borderRadius:8,color:T.amber,cursor:"pointer",fontSize:11,fontWeight:600,padding:"4px 10px",fontFamily:"inherit"}}>{showForm?"Cancel":"+ Add"}</button>
        </div>
        {showForm&&<SaleCalculator acctTier={acctTier} tierRate={tierRate} isAccel={isAccel} acctType={acctType} onAdd={(credited,detail)=>{
          setAdjs(prev=>[...prev,{id:Date.now(),acctId:acct.id,acctName:acct.name,...detail,credited}]);
          setToast(credited);setShowForm(false);
          setTimeout(()=>setToast(null),4000);
        }}/>}
        {!showForm&&myAdj.length===0&&<div style={{fontSize:11,color:T.t4,textAlign:"center",padding:8}}>Search product by name or SKU#, enter doctor spend → auto-calculates credited revenue.</div>}
      </div>
    </div>
  </div>;
}

// ─── SALE CALCULATOR ─────────────────────────────────────────────
function SaleCalculator({acctTier,tierRate,isAccel,acctType,onAdd}) {
  const [search,setSearch]=useState("");
  const [selSku,setSelSku]=useState(null);
  const [docSpend,setDocSpend]=useState("");

  const results=search.length>=2?SKU.filter(p=>{
    const q=search.toLowerCase();
    return p[0].toLowerCase().includes(q)||p[1].toLowerCase().includes(q)||p[2].toLowerCase().includes(q);
  }).slice(0,8):[];

  const calc=useMemo(()=>{
    if(!selSku||!docSpend||parseFloat(docSpend)<=0)return null;
    const spend=parseFloat(docSpend);
    const [sku,desc,cat,stdWS,stdMSRP,diaWS,diaMSRP,platWS,platMSRP,goldWS,goldMSRP,silvWS,silvMSRP]=selSku;
    let tierMSRP,tierWS;
    if(isAccel){
      const t=acctTier.includes("-")?acctTier.split("-")[1]:acctTier;
      if(t==="Diamond"){tierMSRP=diaMSRP;tierWS=diaWS;}
      else if(t==="Platinum"){tierMSRP=platMSRP;tierWS=platWS;}
      else if(t==="Gold"){tierMSRP=goldMSRP;tierWS=goldWS;}
      else if(t==="Silver"){tierMSRP=silvMSRP;tierWS=silvWS;}
      else{tierMSRP=stdMSRP;tierWS=stdWS;}
    }else{tierMSRP=stdMSRP;tierWS=stdWS;}
    const units=spend/tierMSRP;
    const totalWS=stdWS*units;
    const totalCredited=tierWS*units;
    const totalCB=totalWS-totalCredited;
    return{units,totalWS,totalCredited,totalCB,tierMSRP,tierWS,stdMSRP,stdWS,desc,sku};
  },[selSku,docSpend,acctTier,isAccel]);

  return <div style={{background:T.s2,borderRadius:12,padding:14,border:`1px solid ${T.b2}`}}>
    <div style={{fontSize:10,color:T.t3,marginBottom:10}}>
      {isAccel?<>Account: <strong style={{color:T.amber}}>Accelerate {acctTier}</strong></>:<>Account: <strong style={{color:T.green}}>{acctType}</strong> — full wholesale credit</>}
    </div>
    <div style={{marginBottom:10}}>
      <label style={{fontSize:11,color:T.t1,display:"block",marginBottom:4,fontWeight:600}}>1. Search Product</label>
      {selSku?<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",borderRadius:8,background:"rgba(79,142,247,.08)",border:"1px solid rgba(79,142,247,.2)"}}>
        <div><div style={{fontSize:12,fontWeight:600,color:T.t1}}>#{selSku[0]} — {selSku[1]}</div><div style={{fontSize:10,color:T.t3}}>{selSku[2]} · Std MSRP ${selSku[4]}</div></div>
        <button onClick={()=>{setSelSku(null);setDocSpend("");setSearch("")}} style={{background:"none",border:"none",color:T.t4,cursor:"pointer",fontSize:16,fontFamily:"inherit"}}>✕</button>
      </div>:<div>
        <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Type SKU# or product name..." style={{width:"100%",height:40,borderRadius:8,border:`1px solid ${T.b1}`,background:T.s1,color:T.t1,fontSize:13,padding:"0 12px",outline:"none",fontFamily:"inherit"}}/>
        {results.length>0&&<div style={{marginTop:4,borderRadius:8,border:`1px solid ${T.b1}`,background:T.s1,maxHeight:200,overflowY:"auto"}}>
          {results.map(p=><button key={p[0]} onClick={()=>{setSelSku(p);setSearch("")}} style={{width:"100%",textAlign:"left",padding:"8px 12px",background:"none",border:"none",borderBottom:`1px solid ${T.b1}`,color:T.t1,cursor:"pointer",fontFamily:"inherit",fontSize:11}}>
            <div style={{fontWeight:600}}>#{p[0]} — {p[1]}</div>
            <div style={{fontSize:9,color:T.t4}}>{p[2]} · MSRP ${p[4]}</div>
          </button>)}
        </div>}
      </div>}
    </div>
    {selSku&&<div style={{marginBottom:10}}>
      <label style={{fontSize:11,color:T.t1,display:"block",marginBottom:4,fontWeight:600}}>2. Doctor Spend ($)</label>
      <div style={{position:"relative"}}>
        <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:16,color:T.t4,fontFamily:"'JetBrains Mono',monospace"}}>$</span>
        <input type="number" value={docSpend} onChange={e=>setDocSpend(e.target.value)} placeholder="e.g. 5000" style={{width:"100%",height:42,borderRadius:8,border:`1px solid ${T.b1}`,background:T.s1,color:T.t1,fontSize:16,padding:"0 12px 0 30px",outline:"none",fontFamily:"'JetBrains Mono',monospace"}}/>
      </div>
    </div>}
    {calc&&<div style={{background:"rgba(79,142,247,.06)",border:"1px solid rgba(79,142,247,.12)",borderRadius:8,padding:12,marginBottom:10}}>
      <div style={{fontSize:10,fontWeight:700,color:T.blue,marginBottom:8}}>Calculation Breakdown</div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.t3,marginBottom:3}}><span>Doctor spent</span><span className="m" style={{color:T.t1}}>{$f(parseFloat(docSpend))}</span></div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.t3,marginBottom:3}}><span>÷ ${calc.tierMSRP.toFixed(2)}/unit MSRP</span><span className="m" style={{color:T.t1}}>{calc.units.toFixed(1)} units</span></div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.t3,marginBottom:3}}><span>× ${calc.stdWS.toFixed(2)} std wholesale/unit</span><span className="m" style={{color:T.t1}}>{$f(calc.totalWS)}</span></div>
      {isAccel&&calc.totalCB>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.t3,marginBottom:3}}><span>{acctTier} chargeback</span><span className="m" style={{color:T.red}}>-{$f(calc.totalCB)}</span></div>}
      <div style={{borderTop:`1px solid ${T.b2}`,marginTop:6,paddingTop:6,display:"flex",justifyContent:"space-between",fontSize:14,fontWeight:700}}>
        <span style={{color:T.t1}}>→ Your Q1 Credit</span>
        <span className="m" style={{color:T.green,fontSize:16}}>{$f(calc.totalCredited)}</span>
      </div>
    </div>}
    {calc?<button onClick={()=>onAdd(calc.totalCredited,{desc:`${calc.desc} (${calc.units.toFixed(1)} units)`,ws:calc.totalWS,tierRate,sku:calc.sku})} style={{width:"100%",height:42,borderRadius:10,border:"none",background:`linear-gradient(90deg,${T.blue},${T.cyan})`,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
      Apply +{$f(calc.totalCredited)} → Updates Q1
    </button>:<div style={{padding:8,textAlign:"center",fontSize:11,color:T.t4}}>Search a product, enter doctor spend → see credited amount</div>}
  </div>;
}

// ─── STANDALONE CALCULATOR TAB ───────────────────────────────────
// ─── DASHBOARD TAB ───────────────────────────────────────────────
function DashTab({groups, q1CY, q1Att, q1Gap, scored}) {
  const totalPY = groups.reduce((s,g) => s+(g.pyQ?.["1"]||0), 0);
  const totalLocs = groups.reduce((s,g) => s+g.locs, 0);
  const activeAccts = groups.reduce((s,g) => s+g.children.filter(c=>(c.cyQ?.["1"]||0)>0).length, 0);

  // Revenue by tier
  const tierRevenue = {Standard:0, Silver:0, Gold:0, Platinum:0, Diamond:0};
  groups.forEach(g => {
    g.children.forEach(c => {
      const cy = c.cyQ?.["1"]||0;
      if (cy <= 0) return;
      const t = normalizeTier(g.tier||c.tier);
      if (t in tierRevenue) tierRevenue[t] += cy;
      else tierRevenue["Standard"] += cy;
    });
  });
  const tierTotal = Object.values(tierRevenue).reduce((s,v)=>s+v,0)||1;
  const tierColors = {Standard:T.t3, Silver:T.cyan, Gold:T.amber, Platinum:T.purple, Diamond:T.blue};

  // Top 5 groups by CY
  const top5 = [...groups]
    .filter(g => (g.cyQ?.["1"]||0) > 0)
    .sort((a,b) => (b.cyQ?.["1"]||0)-(a.cyQ?.["1"]||0))
    .slice(0,5);

  // Q1 attainment status
  const ahead = q1Att >= 1.0;
  const onTrack = !ahead && q1Att >= 0.85;
  const statusColor = ahead ? T.green : onTrack ? T.amber : T.red;

  const [calcTier, setCalcTier] = useState("Standard");
  const [calcSearch, setCalcSearch] = useState("");
  const [calcSku, setCalcSku] = useState(null);
  const [calcSpend, setCalcSpend] = useState("");

  const calcIsAccel = isAccelTier(calcTier);
  const calcRate = getTierRate(calcTier);
  const calcResults = calcSearch.length>=2 ? SKU.filter(p=>{
    const q=calcSearch.toLowerCase();
    return p[0].toLowerCase().includes(q)||p[1].toLowerCase().includes(q)||p[2].toLowerCase().includes(q);
  }).slice(0,8) : [];

  const calc = useMemo(()=>{
    if(!calcSku||!calcSpend||parseFloat(calcSpend)<=0) return null;
    const spend=parseFloat(calcSpend);
    const [sku,desc,cat,stdWS,stdMSRP,diaWS,diaMSRP,platWS,platMSRP,goldWS,goldMSRP,silvWS,silvMSRP]=calcSku;
    let tierMSRP,tierWS;
    if(calcIsAccel){
      const t=calcTier.includes("-")?calcTier.split("-")[1]:calcTier;
      if(t==="Diamond"){tierMSRP=diaMSRP;tierWS=diaWS;}
      else if(t==="Platinum"){tierMSRP=platMSRP;tierWS=platWS;}
      else if(t==="Gold"){tierMSRP=goldMSRP;tierWS=goldWS;}
      else if(t==="Silver"){tierMSRP=silvMSRP;tierWS=silvWS;}
      else{tierMSRP=stdMSRP;tierWS=stdWS;}
    } else {tierMSRP=stdMSRP;tierWS=stdWS;}
    const units=spend/tierMSRP;
    const totalWS=stdWS*units;
    const totalCredited=tierWS*units;
    const totalCB=totalWS-totalCredited;
    return{units,totalWS,totalCredited,totalCB,tierMSRP,tierWS,stdMSRP,stdWS,desc,sku,cat};
  },[calcSku,calcSpend,calcTier,calcIsAccel]);

  return <div style={{padding:"16px 16px 80px"}}>

    {/* ── CY REVENUE + ATTAINMENT ── */}
    <div className="anim" style={{background:`linear-gradient(135deg,${T.s1},rgba(79,142,247,.06))`,border:`1px solid ${T.b1}`,borderRadius:16,padding:16,marginBottom:12,boxShadow:"0 4px 24px rgba(0,0,0,.4)"}}>
      <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1.2px",color:T.t3,marginBottom:12}}>Territory · Q1 {new Date().getFullYear()}</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        <div>
          <div style={{fontSize:9,color:T.t4,marginBottom:3}}>CY Revenue</div>
          <div className="m" style={{fontSize:22,fontWeight:800,color:T.t1}}>{$$(q1CY)}</div>
          <div style={{fontSize:10,color:T.t3,marginTop:2}}>vs {$$(totalPY)} PY</div>
        </div>
        <div>
          <div style={{fontSize:9,color:T.t4,marginBottom:3}}>Attainment</div>
          <div className="m" style={{fontSize:22,fontWeight:800,color:statusColor}}>{pc(q1Att)}</div>
          <div style={{fontSize:10,color:T.t3,marginTop:2}}>of {$$(778915)} target</div>
        </div>
      </div>
      <Bar pct={q1Att*100} color={`linear-gradient(90deg,${statusColor},${ahead?T.cyan:onTrack?T.orange:T.red})`}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:12}}>
        <div style={{borderRadius:8,background:T.s2,padding:8,textAlign:"center"}}>
          <div style={{fontSize:9,color:T.t4}}>Groups</div>
          <div className="m" style={{fontSize:14,fontWeight:700}}>{groups.length}</div>
        </div>
        <div style={{borderRadius:8,background:T.s2,padding:8,textAlign:"center"}}>
          <div style={{fontSize:9,color:T.t4}}>Locations</div>
          <div className="m" style={{fontSize:14,fontWeight:700}}>{totalLocs}</div>
        </div>
        <div style={{borderRadius:8,background:T.s2,padding:8,textAlign:"center"}}>
          <div style={{fontSize:9,color:T.t4}}>Active CY</div>
          <div className="m" style={{fontSize:14,fontWeight:700,color:T.green}}>{activeAccts}</div>
        </div>
      </div>
    </div>

    {/* ── REVENUE BY TIER ── */}
    <div className="anim" style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:14,padding:14,marginBottom:12}}>
      <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.t3,marginBottom:12}}>Revenue by Tier</div>
      {Object.entries(tierRevenue).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).map(([tier,rev])=>{
        const pct = rev/tierTotal*100;
        const col = tierColors[tier]||T.t3;
        return <div key={tier} style={{marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
            <span style={{fontSize:11,color:col,fontWeight:600}}>{tier==="Standard"?"Private Practice":`Accelerate ${tier}`}</span>
            <span className="m" style={{fontSize:11,color:T.t1,fontWeight:700}}>{$$(rev)}</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{flex:1}}><Bar pct={pct} color={`linear-gradient(90deg,${col},${col}88)`}/></div>
            <span style={{fontSize:9,color:T.t4,minWidth:32,textAlign:"right"}}>{pct.toFixed(0)}%</span>
          </div>
        </div>;
      })}
      {tierTotal===1&&<div style={{fontSize:11,color:T.t4}}>No data — upload a CSV.</div>}
    </div>

    {/* ── TOP 5 GROUPS ── */}
    <div className="anim" style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:14,padding:14,marginBottom:16}}>
      <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.t3,marginBottom:10}}>Top 5 Groups by CY Revenue</div>
      {top5.length===0&&<div style={{fontSize:11,color:T.t4}}>No data — upload a CSV.</div>}
      {top5.map((g,i)=>{
        const cy=g.cyQ?.["1"]||0; const py=g.pyQ?.["1"]||0;
        const up=cy>=py;
        return <div key={g.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:i<top5.length-1?`1px solid ${T.b1}`:"none"}}>
          <span className="m" style={{fontSize:11,color:T.t4,minWidth:16}}>#{i+1}</span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{fixGroupName(g)}</div>
            <div style={{fontSize:9,color:T.t3}}>{g.locs} loc · {getTierLabel(g.tier)}</div>
          </div>
          <div style={{textAlign:"right",flexShrink:0}}>
            <div className="m" style={{fontSize:12,fontWeight:700,color:T.blue}}>{$$(cy)}</div>
            <div style={{fontSize:9,color:up?T.green:T.red}}>{up?"+":""}{$$(cy-py)} vs PY</div>
          </div>
        </div>;
      })}
    </div>

    {/* ── QUICK SALE CALCULATOR ── */}
    <div className="anim" style={{background:`linear-gradient(135deg,${T.s1},rgba(251,191,36,.04))`,border:`1px solid ${T.b1}`,borderRadius:16,padding:16,marginBottom:16}}>
      <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.amber,marginBottom:12}}>Quick Sale Calculator</div>
      <div style={{fontSize:11,color:T.t3,marginBottom:16}}>Search any Kerr product, enter doctor spend, see your credited revenue instantly.</div>
      <div style={{marginBottom:14}}>
        <label style={{fontSize:11,color:T.t1,display:"block",marginBottom:6,fontWeight:600}}>Account Tier</label>
        <div className="hide-sb" style={{display:"flex",gap:4,overflowX:"auto"}}>
          {["Standard","Top 100","Silver","Gold","Platinum","Diamond"].map(t=>(
            <button key={t} onClick={()=>setCalcTier(t)} style={{flexShrink:0,padding:"6px 12px",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",border:`1px solid ${calcTier===t?"rgba(251,191,36,.25)":T.b2}`,background:calcTier===t?"rgba(251,191,36,.08)":T.s2,color:calcTier===t?T.amber:T.t3,fontFamily:"inherit"}}>{t}{ACCEL_RATES[t]?` (${ACCEL_RATES[t]*100}%)`:""}</button>
          ))}
        </div>
      </div>
      <div style={{marginBottom:12}}>
        <label style={{fontSize:11,color:T.t1,display:"block",marginBottom:4,fontWeight:600}}>Search Product</label>
        {calcSku?<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",borderRadius:8,background:"rgba(79,142,247,.08)",border:"1px solid rgba(79,142,247,.2)"}}>
          <div><div style={{fontSize:12,fontWeight:600,color:T.t1}}>#{calcSku[0]} — {calcSku[1]}</div><div style={{fontSize:10,color:T.t3}}>{calcSku[2]} · Std MSRP ${calcSku[4]}</div></div>
          <button onClick={()=>{setCalcSku(null);setCalcSpend("");setCalcSearch("")}} style={{background:"none",border:"none",color:T.t4,cursor:"pointer",fontSize:16}}>✕</button>
        </div>:<div>
          <input type="text" value={calcSearch} onChange={e=>setCalcSearch(e.target.value)} placeholder="Type SKU# or product name..." style={{width:"100%",height:40,borderRadius:8,border:`1px solid ${T.b1}`,background:T.s1,color:T.t1,fontSize:13,padding:"0 12px",outline:"none",fontFamily:"inherit"}}/>
          {calcResults.length>0&&<div style={{marginTop:4,borderRadius:8,border:`1px solid ${T.b1}`,background:T.s1,maxHeight:200,overflowY:"auto"}}>
            {calcResults.map(p=><button key={p[0]} onClick={()=>{setCalcSku(p);setCalcSearch("")}} style={{width:"100%",textAlign:"left",padding:"8px 12px",background:"none",border:"none",borderBottom:`1px solid ${T.b1}`,color:T.t1,cursor:"pointer",fontFamily:"inherit",fontSize:11}}>
              <div style={{fontWeight:600}}>#{p[0]} — {p[1]}</div>
              <div style={{fontSize:9,color:T.t4}}>{p[2]} · MSRP ${p[4]}</div>
            </button>)}
          </div>}
        </div>}
      </div>
      {calcSku&&<div style={{marginBottom:12}}>
        <label style={{fontSize:11,color:T.t1,display:"block",marginBottom:4,fontWeight:600}}>Doctor Spend ($)</label>
        <div style={{position:"relative"}}>
          <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:16,color:T.t4,fontFamily:"'JetBrains Mono',monospace"}}>$</span>
          <input type="number" value={calcSpend} onChange={e=>setCalcSpend(e.target.value)} placeholder="e.g. 5000" style={{width:"100%",height:42,borderRadius:8,border:`1px solid ${T.b1}`,background:T.s1,color:T.t1,fontSize:16,padding:"0 12px 0 30px",outline:"none",fontFamily:"'JetBrains Mono',monospace"}}/>
        </div>
      </div>}
      {calc&&<div style={{background:"rgba(79,142,247,.06)",border:"1px solid rgba(79,142,247,.12)",borderRadius:8,padding:12}}>
        <div style={{fontSize:10,fontWeight:700,color:T.blue,marginBottom:8}}>Calculation Breakdown</div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.t3,marginBottom:3}}><span>Doctor spent</span><span className="m" style={{color:T.t1}}>{$f(parseFloat(calcSpend))}</span></div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.t3,marginBottom:3}}><span>÷ ${calc.tierMSRP.toFixed(2)}/unit ({calcIsAccel?calcTier:"std"} MSRP)</span><span className="m" style={{color:T.t1}}>{calc.units.toFixed(1)} units</span></div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.t3,marginBottom:3}}><span>× ${calc.stdWS.toFixed(2)} std wholesale/unit</span><span className="m" style={{color:T.t1}}>{$f(calc.totalWS)}</span></div>
        {calcIsAccel&&calc.totalCB>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.t3,marginBottom:3}}><span>{calcTier} chargeback ({calcRate*100}%)</span><span className="m" style={{color:T.red}}>-{$f(calc.totalCB)}</span></div>}
        <div style={{borderTop:`1px solid ${T.b2}`,marginTop:6,paddingTop:6,display:"flex",justifyContent:"space-between",fontSize:14,fontWeight:700}}>
          <span style={{color:T.t1}}>Your Credit</span>
          <span className="m" style={{color:T.green,fontSize:18}}>{$f(calc.totalCredited)}</span>
        </div>
      </div>}
    </div>
    <div style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:12,padding:12,fontSize:10,color:T.t3}}>
      <strong>How it works:</strong> Doctor spend ÷ tier MSRP = units. Units × std wholesale = raw wholesale. Accelerate tiers subtract chargeback (Silver 20%, Gold 24%, Platinum 30%, Diamond 36%). Standard / Top 100 / Private = 0%.
    </div>
  </div>;
}

function CalcTab() {
  const [tier,setTier]=useState("Standard");
  const [search,setSearch]=useState("");
  const [selSku,setSelSku]=useState(null);
  const [docSpend,setDocSpend]=useState("");

  const isAccel=isAccelTier(tier);
  const tierRate=getTierRate(tier);
  const results=search.length>=2?SKU.filter(p=>{
    const q=search.toLowerCase();
    return p[0].toLowerCase().includes(q)||p[1].toLowerCase().includes(q)||p[2].toLowerCase().includes(q);
  }).slice(0,8):[];

  const calc=useMemo(()=>{
    if(!selSku||!docSpend||parseFloat(docSpend)<=0)return null;
    const spend=parseFloat(docSpend);
    const [sku,desc,cat,stdWS,stdMSRP,diaWS,diaMSRP,platWS,platMSRP,goldWS,goldMSRP,silvWS,silvMSRP]=selSku;
    let tierMSRP,tierWS;
    if(isAccel){
      const t=tier.includes("-")?tier.split("-")[1]:tier;
      if(t==="Diamond"){tierMSRP=diaMSRP;tierWS=diaWS;}
      else if(t==="Platinum"){tierMSRP=platMSRP;tierWS=platWS;}
      else if(t==="Gold"){tierMSRP=goldMSRP;tierWS=goldWS;}
      else if(t==="Silver"){tierMSRP=silvMSRP;tierWS=silvWS;}
      else{tierMSRP=stdMSRP;tierWS=stdWS;}
    }else{tierMSRP=stdMSRP;tierWS=stdWS;}
    const units=spend/tierMSRP;
    const totalWS=stdWS*units;
    const totalCredited=tierWS*units;
    const totalCB=totalWS-totalCredited;
    return{units,totalWS,totalCredited,totalCB,tierMSRP,tierWS,stdMSRP,stdWS,desc,sku,cat};
  },[selSku,docSpend,tier,isAccel]);

  return <div style={{padding:"16px 16px 80px"}}>
    <div className="anim" style={{background:`linear-gradient(135deg,${T.s1},rgba(251,191,36,.04))`,border:`1px solid ${T.b1}`,borderRadius:16,padding:16,marginBottom:16}}>
      <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.amber,marginBottom:12}}>Product Sale Calculator</div>
      <div style={{fontSize:11,color:T.t3,marginBottom:16}}>Search any Kerr product, enter doctor spend, see your credited revenue instantly.</div>

      {/* Tier selector */}
      <div style={{marginBottom:14}}>
        <label style={{fontSize:11,color:T.t1,display:"block",marginBottom:6,fontWeight:600}}>Account Tier</label>
        <div className="hide-sb" style={{display:"flex",gap:4,overflowX:"auto"}}>
          {["Standard","Top 100","Silver","Gold","Platinum","Diamond"].map(t=>(
            <button key={t} onClick={()=>setTier(t)} style={{flexShrink:0,padding:"6px 12px",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",border:`1px solid ${tier===t?"rgba(251,191,36,.25)":T.b2}`,background:tier===t?"rgba(251,191,36,.08)":T.s2,color:tier===t?T.amber:T.t3,fontFamily:"inherit"}}>{t}{ACCEL_RATES[t]?` (${ACCEL_RATES[t]*100}%)`:""}</button>
          ))}
        </div>
      </div>

      {/* Product search */}
      <div style={{marginBottom:12}}>
        <label style={{fontSize:11,color:T.t1,display:"block",marginBottom:4,fontWeight:600}}>Search Product</label>
        {selSku?<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",borderRadius:8,background:"rgba(79,142,247,.08)",border:"1px solid rgba(79,142,247,.2)"}}>
          <div><div style={{fontSize:12,fontWeight:600,color:T.t1}}>#{selSku[0]} — {selSku[1]}</div><div style={{fontSize:10,color:T.t3}}>{selSku[2]} · Std MSRP ${selSku[4]}</div></div>
          <button onClick={()=>{setSelSku(null);setDocSpend("");setSearch("")}} style={{background:"none",border:"none",color:T.t4,cursor:"pointer",fontSize:16}}>✕</button>
        </div>:<div>
          <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Type SKU# or product name..." style={{width:"100%",height:40,borderRadius:8,border:`1px solid ${T.b1}`,background:T.s1,color:T.t1,fontSize:13,padding:"0 12px",outline:"none",fontFamily:"inherit"}}/>
          {results.length>0&&<div style={{marginTop:4,borderRadius:8,border:`1px solid ${T.b1}`,background:T.s1,maxHeight:200,overflowY:"auto"}}>
            {results.map(p=><button key={p[0]} onClick={()=>{setSelSku(p);setSearch("")}} style={{width:"100%",textAlign:"left",padding:"8px 12px",background:"none",border:"none",borderBottom:`1px solid ${T.b1}`,color:T.t1,cursor:"pointer",fontFamily:"inherit",fontSize:11}}>
              <div style={{fontWeight:600}}>#{p[0]} — {p[1]}</div>
              <div style={{fontSize:9,color:T.t4}}>{p[2]} · MSRP ${p[4]}</div>
            </button>)}
          </div>}
        </div>}
      </div>

      {selSku&&<div style={{marginBottom:12}}>
        <label style={{fontSize:11,color:T.t1,display:"block",marginBottom:4,fontWeight:600}}>Doctor Spend ($)</label>
        <div style={{position:"relative"}}>
          <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:16,color:T.t4,fontFamily:"'JetBrains Mono',monospace"}}>$</span>
          <input type="number" value={docSpend} onChange={e=>setDocSpend(e.target.value)} placeholder="e.g. 5000" style={{width:"100%",height:42,borderRadius:8,border:`1px solid ${T.b1}`,background:T.s1,color:T.t1,fontSize:16,padding:"0 12px 0 30px",outline:"none",fontFamily:"'JetBrains Mono',monospace"}}/>
        </div>
      </div>}

      {calc&&<div style={{background:"rgba(79,142,247,.06)",border:"1px solid rgba(79,142,247,.12)",borderRadius:8,padding:12}}>
        <div style={{fontSize:10,fontWeight:700,color:T.blue,marginBottom:8}}>Calculation Breakdown</div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.t3,marginBottom:3}}><span>Doctor spent</span><span className="m" style={{color:T.t1}}>{$f(parseFloat(docSpend))}</span></div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.t3,marginBottom:3}}><span>÷ ${calc.tierMSRP.toFixed(2)}/unit ({isAccel?tier:"std"} MSRP)</span><span className="m" style={{color:T.t1}}>{calc.units.toFixed(1)} units</span></div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.t3,marginBottom:3}}><span>× ${calc.stdWS.toFixed(2)} std wholesale/unit</span><span className="m" style={{color:T.t1}}>{$f(calc.totalWS)}</span></div>
        {isAccel&&calc.totalCB>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.t3,marginBottom:3}}><span>{tier} chargeback ({getTierRate(tier)*100}%)</span><span className="m" style={{color:T.red}}>-{$f(calc.totalCB)}</span></div>}
        <div style={{borderTop:`1px solid ${T.b2}`,marginTop:6,paddingTop:6,display:"flex",justifyContent:"space-between",fontSize:14,fontWeight:700}}>
          <span style={{color:T.t1}}>→ Your Credit</span>
          <span className="m" style={{color:T.green,fontSize:18}}>{$f(calc.totalCredited)}</span>
        </div>
      </div>}
    </div>

    <div style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:12,padding:12,fontSize:10,color:T.t3}}>
      <strong>How it works:</strong> Doctor spend ÷ tier MSRP = units. Units × std wholesale = raw wholesale. For Accelerate tiers, subtract chargeback (Silver 20%, Gold 24%, Platinum 30%, Diamond 36%). Standard / Top 100 / Private = 0% chargeback.
    </div>
  </div>;
}

// ─── ESTIMATOR TAB ───────────────────────────────────────────────
function EstTab({pct,setPct,q1CY,groups}) {
  // Calculate PY base from actual data: sum of all Q1 PY spending that happened Mar 20-31
  // We approximate: Q1 PY total * (12/90) ≈ last ~12 days of Q1
  const q1PyTotal=groups.reduce((s,g)=>s+(g.pyQ?.["1"]||0),0);
  // ~13% of Q1 = last 12 days of March
  const pyBase=Math.round(q1PyTotal*12/90);
  const pyAccts=groups.reduce((s,g)=>s+g.children.filter(c=>(c.pyQ?.["1"]||0)>0).length,0);

  const est=pyBase*(pct/100);
  const proj=q1CY+est;
  const projAtt=proj/Q1_TARGET;
  const projGap=Q1_TARGET-proj;

  return <div style={{padding:"16px 16px 80px"}}>
    <div className="anim" style={{background:`linear-gradient(135deg,${T.s1},rgba(79,142,247,.04))`,border:`1px solid ${T.b1}`,borderRadius:16,padding:16,marginBottom:16}}>
      <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.blue,marginBottom:12}}>Q1 Completion Estimator</div>
      <div style={{fontSize:11,color:T.t3,marginBottom:16}}>Last year, <strong style={{color:T.t1}}>{pyAccts.toLocaleString()} accounts</strong> bought <strong style={{color:T.t1}}>{$f(pyBase)}</strong> credited in Mar 20-31. How much repeats?</div>
      <div style={{marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
          <span style={{fontSize:10,color:T.t4}}>50%</span>
          <span className="m" style={{fontSize:14,fontWeight:800,color:pct>=100?T.green:T.amber}}>{pct}%</span>
          <span style={{fontSize:10,color:T.t4}}>130%</span>
        </div>
        <input type="range" min="50" max="130" value={pct} onChange={e=>setPct(parseInt(e.target.value))}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
        <div style={{background:T.s2,borderRadius:10,padding:12}}><div style={{fontSize:9,color:T.t4,marginBottom:2}}>Expected Mar 20-31</div><div className="m" style={{fontSize:18,fontWeight:800}}>{$f(est)}</div></div>
        <div style={{background:T.s2,borderRadius:10,padding:12}}><div style={{fontSize:9,color:T.t4,marginBottom:2}}>Projected Q1</div><div className="m" style={{fontSize:18,fontWeight:800,color:projAtt>=1?T.green:T.blue}}>{$f(proj)}</div></div>
      </div>
      <div style={{background:T.s2,borderRadius:10,padding:12}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:10,color:T.t3}}>Projected Attainment</span><span className="m" style={{fontSize:14,fontWeight:800,color:projAtt>=1?T.green:projAtt>=.9?T.amber:T.red}}>{(projAtt*100).toFixed(1)}%</span></div>
        <Bar pct={projAtt*100} color={projAtt>=1?`linear-gradient(90deg,${T.green},${T.cyan})`:`linear-gradient(90deg,${T.blue},${T.cyan})`}/>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:6,fontSize:10,color:T.t4}}><span>CY: {$f(q1CY)}</span><span>Target: {$f(Q1_TARGET)}</span></div>
      </div>
      {projGap>0?<div style={{marginTop:12,borderRadius:10,background:"rgba(248,113,113,.06)",border:"1px solid rgba(248,113,113,.12)",padding:12}}>
        <div style={{fontSize:11,color:T.red,fontWeight:600}}>Still {$f(projGap)} short</div>
        <div style={{fontSize:10,color:T.t3,marginTop:4}}>{$f(DAYS_LEFT>0?projGap/DAYS_LEFT:0)}/day beyond projections needed.</div>
      </div>:<div style={{marginTop:12,borderRadius:10,background:"rgba(52,211,153,.06)",border:"1px solid rgba(52,211,153,.12)",padding:12}}>
        <div style={{fontSize:11,color:T.green,fontWeight:600}}>On track! {$f(Math.abs(projGap))} over target.</div>
      </div>}
    </div>
    <div style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:12,padding:12,fontSize:10,color:T.t3}}>
      <strong></strong> PY base ({$f(pyBase)}) is calculated from your actual Q1 2025 data — the last ~12 days of March spending. Slider models what percentage of that repeats this year.
    </div>
  </div>;
}
