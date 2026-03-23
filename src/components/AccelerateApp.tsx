"use client";
// @ts-nocheck

import { useState, useMemo, useCallback, useRef, useEffect, Component } from "react";

// ─── ERROR BOUNDARY ───────────────────────────────────────────────
class ErrorBoundary extends Component<{children:any},{err:any,info:any}> {
  constructor(p:any){super(p);this.state={err:null,info:null};}
  static getDerivedStateFromError(e:any){return{err:e};}
  componentDidCatch(e:any,i:any){this.setState({err:e,info:i});}
  render(){
    if(this.state.err){
      return <div style={{padding:40,background:"#0a0a0f",color:"#e2e2ea",fontFamily:"'DM Sans',sans-serif",minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center"}}>
        <div style={{fontSize:32,marginBottom:12}}>⚡</div>
        <div style={{fontSize:16,fontWeight:700,marginBottom:8}}>Something went wrong</div>
        <div style={{fontSize:13,color:"#6b6b80",marginBottom:20,maxWidth:320}}>Accelerate hit an unexpected error. Tap below to reload.</div>
        <button onClick={()=>this.setState({err:null,info:null})} style={{padding:"10px 24px",background:"#4f8ef7",color:"#fff",border:"none",borderRadius:10,cursor:"pointer",fontFamily:"inherit",fontSize:14,fontWeight:600}}>
          Reload App
        </button>
      </div>;
    }
    return this.props.children;
  }
}

// Static data — loads if available, gracefully degrades if not
let DEALERS: Record<string, string> = {};
let WEEK_ROUTES: any = { routes: {}, unplaced: [] };
let BADGER: Record<string, any> = {};
let PARENT_NAMES: Record<string, string> = {};
// DEALERS, BADGER, WEEK_ROUTES remain static base data

try { DEALERS = require("@/data/dealers").DEALERS; } catch(e) {}
try { WEEK_ROUTES = require("@/data/week-routes.json"); } catch(e) {}
try { BADGER = require("@/data/badger-lookup.json"); } catch(e) {}
try { PARENT_NAMES = require("@/data/parent-names.json"); } catch(e) {}

// OVERLAYS: runtime-loaded from data/overlays.json via API — NOT a static import
// Default empty shape used until loadOverlays() resolves on app mount
const EMPTY_OVERLAYS: any = {
  schemaVersion: 2, lastUpdated: new Date().toISOString(),
  groups: {}, groupDetaches: [], groupMoves: {}, nameOverrides: {},
  contacts: {}, fscReps: {}, activityLogs: {}, research: {}, dealerOverrides: {},
};
// Module-level ref so applyOverlays() (called outside React) can access current overlays
let OVERLAYS_REF: any = EMPTY_OVERLAYS;

// ─── APPLY OVERLAYS ─────────────────────────────────────────────
// Applies all user-authored overlays on top of base data.
// Reads from OVERLAYS_REF (set at runtime from data/overlays.json).
// Survives CSV uploads because overlays are stored separately.
function applyOverlays(grps: any[]): any[] {
  if (!grps) return grps;
  const OV = OVERLAYS_REF;
  let result = [...grps];

  // 1. NAME OVERRIDES
  const nameMap: Record<string,string> = OV.nameOverrides || {};
  if (Object.keys(nameMap).length > 0) {
    result = result.map(g => ({
      ...g,
      name: nameMap[g.id] || g.name,
      children: (g.children||[]).map((c:any) => ({ ...c, name: nameMap[c.id] || c.name }))
    }));
  }

  // 2. CONTACT OVERRIDES — inject into BADGER at runtime so AcctDetail can read them
  const contacts = OV.contacts || {};
  Object.entries(contacts).forEach(([id, co]: any) => {
    if (!BADGER[id]) BADGER[id] = {};
    if (co.contactName && !BADGER[id].contactName) BADGER[id].contactName = co.contactName;
    if (co.email && !BADGER[id].email) BADGER[id].email = co.email;
    if (co.phone && !BADGER[id].phone) BADGER[id].phone = co.phone;
    if (co.address && !BADGER[id].address) BADGER[id].address = co.address;
    if (co.website && !BADGER[id].website) BADGER[id].website = co.website;
    if (co.contacts?.length && !BADGER[id].contacts) BADGER[id].contacts = co.contacts;
  });

  // 3. GROUP DETACHES — remove child from wrong parent, make standalone
  (OV.groupDetaches||[]).forEach((detach:any) => {
    const childId = detach.childId;
    let detachedChild: any = null;
    result = result.map(g => {
      if (g.id !== detach.fromGroupId) return g;
      const kept = (g.children||[]).filter((c:any) => {
        if (c.id === childId) { detachedChild = c; return false; }
        return true;
      });
      return { ...g, children: kept, locs: kept.length };
    });
    if (detachedChild && !result.find(g => g.id === detach.newGroupId)) {
      result.push({
        id: detach.newGroupId, name: detach.newGroupName || detachedChild.name,
        tier: detachedChild.tier||"Standard", class2: detachedChild.class2||"Private Practice",
        locs: 1, pyQ: detachedChild.pyQ||{}, cyQ: detachedChild.cyQ||{},
        children: [{ ...detachedChild, gId: detach.newGroupId, gName: detach.newGroupName||detachedChild.name }],
      });
    }
  });

  // 4. GROUP CREATES — build custom groups from childIds
  // The preloaded data nests children 2-3 levels deep:
  //   top-level group → child wrapper (no products) → grandchild leaf (has products/city/dealer)
  // We must build the leafByChildId map FIRST from the full result tree,
  // then remove the pre-baked group, then pull children from the map directly.
  
  // Step 4a: Build a deep leafByChildId map from ALL groups BEFORE removing anything.
  // Recurse up to 2 levels to find the richest (most products) version of each child.
  const leafByChildId: Record<string,any> = {};
  const updateLeaf = (id: string, candidate: any) => {
    const existing = leafByChildId[id];
    if (!existing || (candidate.products||[]).length > (existing.products||[]).length
        || (!existing.city && candidate.city)) {
      leafByChildId[id] = candidate;
    }
  };
  result.forEach(g => {
    (g.children||[]).forEach((c:any) => {
      if (c.children && c.children.length > 0) {
        // This child is a wrapper — its real data is in its children
        c.children.forEach((leaf:any) => updateLeaf(c.id, leaf));
      } else {
        updateLeaf(c.id, c);
      }
    });
  });

  Object.values(OV.groups||{}).forEach((create:any) => {
    const childIdSet = new Set(create.childIds || []);
    const children: any[] = [];
    let totalPY: Record<string,number> = {};
    let totalCY: Record<string,number> = {};

    // Step 4b: Remove the pre-existing baked group from result
    result = result.filter(g => g.id !== create.id);

    // Step 4c: Remove these childIds from wherever they currently live in result
    // (they may be children of the removed group or standalone groups)
    result = result.map(g => {
      const kept: any[] = [];
      (g.children||[]).forEach((c:any) => {
        if (childIdSet.has(c.id)) return; // remove from old parent
        // Also remove wrapper children whose grandchildren match
        if (c.children && c.children.some((gc:any) => childIdSet.has(gc.id))) return;
        kept.push(c);
      });
      return { ...g, children: kept, locs: kept.length };
    });

    // Step 4d: Build the children array from the leaf map
    (create.childIds||[]).forEach((cid:string) => {
      const leaf = leafByChildId[cid];
      if (leaf) {
        children.push({ ...leaf, id: cid, gId: create.id, gName: create.name });
      }
      // Unfound childIds added below as stubs
    });

    // Roll up financials
    children.forEach((c:any) => {
      Object.entries(c.pyQ||{}).forEach(([q,v]:any) => { totalPY[q] = (totalPY[q]||0) + v; });
      Object.entries(c.cyQ||{}).forEach(([q,v]:any) => { totalCY[q] = (totalCY[q]||0) + v; });
    });

    // Add any childIds not found anywhere in base data
    (create.childIds||[]).forEach((cid:string) => {
      if (!children.find(c => c.id === cid)) {
        children.push({ id: cid, name: nameMap[cid]||cid, gId: create.id, gName: create.name,
          pyQ: {}, cyQ: {}, products: [], tier: "Standard", class2: "Private Practice" });
      }
    });

    if (children.length > 0) {
      result.unshift({
        id: create.id, name: create.name,
        tier: create.tier||"Standard", class2: create.class2||"Private Practice",
        dsoName: create.dsoName||create.name, locs: children.length,
        pyQ: totalPY, cyQ: totalCY, children,
      });
    }
  });

  return result;
}

// ─── DESIGN TOKENS ───────────────────────────────────────────────
const T = {
  bg: "#0a0a0f", s1: "#12121a", s2: "#1a1a25", s3: "#222230", s4: "#2a2a3a",
  b1: "rgba(255,255,255,.06)", b2: "rgba(255,255,255,.08)", b3: "rgba(255,255,255,.04)",
  t1: "#f0f0f5", t2: "#c8c8d0", t3: "#a0a0b8", t4: "#7878a0",
  blue: "#4f8ef7", cyan: "#22d3ee", green: "#34d399", amber: "#fbbf24",
  red: "#f87171", purple: "#a78bfa", orange: "#fb923c",
};

const Q1_TARGET = 778915;

const FY_TARGET = 3158094;
const DAYS_LEFT = Math.max(0, Math.ceil((new Date(2026, 2, 31).getTime() - new Date().getTime()) / 86400000));
// Thomaston CT home base coordinates — used for distance scoring in Overdrive
const HOME_LAT = 41.6723;
const HOME_LNG = -73.0720;

// ─── TIER / CHARGEBACK RULES ──────────────────────────────────────
// The Tableau export uses a single "Acct Type" field that conflates two
// separate things: (1) pricing tier and (2) Top 100 spend ranking.
// These rules untangle that permanently so no future upload can break it.
//
// PRICING TIER → chargeback rate:
//   Standard, Top 100, HOUSE ACCOUNTS = 0%  (Top 100 is a ranking, NOT a tier)
//   Top 100-Gold = Gold rate (24%)           (strip the ranking prefix)
//   Top 100-Diamond = Diamond rate (36%)     (strip the ranking prefix)
//   Silver=20%, Gold=24%, Platinum=30%, Diamond=36%
//
// PRACTICE TYPE → comes from Sds Cust Class2, NOT Acct Type:
//   DSO, EMERGING DSO, COMMUNITY HEALTHCARE, GOVERNMENT, SCHOOLS, STANDARD(=Private Practice)

const ACCEL_RATES: Record<string,number> = { Silver: 0.20, Gold: 0.24, Platinum: 0.30, Diamond: 0.36 };

// Clean pricing tier — strips Top 100 ranking, normalizes everything to 5 values
const normalizeTier = (raw) => {
  if (!raw) return "Standard";
  const t = raw.trim();
  // These are rankings or account categories, not pricing tiers — all = 0% chargeback
  if (t === "HOUSE ACCOUNTS") return "Standard";
  if (t === "Top 100") return "Standard";
  // "Top 100-Gold" → "Gold", "Top 100-Diamond" → "Diamond" (strip ranking prefix)
  if (t.startsWith("Top 100-")) return t.split("-")[1];
  // Valid tiers
  if (t in ACCEL_RATES) return t;
  return "Standard";
};

// Is this account in the Top 100 spend ranking? Separate from tier.
const isTop100 = (raw) => {
  if (!raw) return false;
  return raw.trim().startsWith("Top 100");
};

// Practice type from Sds Cust Class2 — this is the RIGHT place for account type
const normalizePracticeType = (class2) => {
  const c = (class2||"").trim().toUpperCase();
  if (c === "DSO") return "DSO";
  if (c === "EMERGING DSO") return "Emerging DSO";
  if (c === "COMMUNITY HEALTHCARE") return "Community Health";
  if (c === "GOVERNMENT") return "Government";
  if (c === "SCHOOLS") return "School";
  return "Private Practice"; // STANDARD → Private Practice
};

const getTierRate = (tier) => ACCEL_RATES[normalizeTier(tier)] || 0;
const isAccelTier = (tier) => normalizeTier(tier) in ACCEL_RATES;

const getTierLabel = (tier, class2?) => {
  const n = normalizeTier(tier);
  if (n === "Standard") return normalizePracticeType(class2);
  return `Accelerate ${n}`;
};

// ─── GROUP NAME RULES ─────────────────────────────────────────────
// Parent Name field always comes as "Real Name : Master-CMxxxxxx"
// Strip the suffix → always gives a real group name, never a tier
// Class 4 is unreliable — often contains the tier name instead of group name
const extractGroupName = (parentName, class4?, fallbackChildName?) => {
  // Rule 1: Strip " : Master-CMxxxxxx" from Parent Name → most reliable source
  const fromParent = (parentName||"").replace(/\s*:\s*Master-CM\d+$/i, "").trim();
  const BAD = new Set(["STANDARD","HOUSE ACCOUNTS","SILVER","GOLD","PLATINUM","DIAMOND",
                       "TOP 100","GRAND TOTAL","TOTAL",""]);
  if (fromParent && !BAD.has(fromParent.toUpperCase())) return fromParent;
  // Rule 2: Class 4 if it's not a generic tier name
  const c4 = (class4||"").trim();
  if (c4 && !BAD.has(c4.toUpperCase())) return c4;
  // Rule 3: Fall back to child name
  return fallbackChildName || "";
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
// SVG nav icons
const IconBolt    = ({c}:{c:string}) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>;
const IconGroup   = ({c}:{c:string}) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const IconChart   = ({c}:{c:string}) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
const IconMap     = ({c}:{c:string}) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>;
const IconSliders = ({c}:{c:string}) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>;
const IconDealer  = ({c}:{c:string}) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
const IconMail    = ({c}:{c:string}) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>;
const IconAdmin   = ({c}:{c:string}) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M12 14c-5 0-8 2-8 3v1h16v-1c0-1-3-3-8-3z"/><path d="M18 3l2 2-8 8-4-4 2-2 2 2z" strokeWidth="1.5"/></svg>;
const IconMore    = ({c}:{c:string}) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>;

// ─── DISPLAY NAME FIXER ──────────────────────────────────────────
const BAD_GROUP_NAMES = new Set(["STANDARD","Standard","HOUSE ACCOUNTS","House Accounts","SILVER","GOLD","PLATINUM","DIAMOND","TOP 100","Silver","Gold","Platinum","Diamond","Top 100",""]);
// Strip " : Master-CMxxxxxx" suffix from Tableau parent names
const cleanParentName = (name) => {
  if (!name) return "";
  return name.replace(/\s*:\s*Master-CM\d+$/i, "").trim();
};
const fixGroupName = (g) => {
  if (!g) return "Unknown";
  // 1. Try authoritative name from offices.json parent names (highest priority)
  const authName = PARENT_NAMES[g.id];
  if (authName && !BAD_GROUP_NAMES.has(authName)) return authName;
  // 2. Try cleaned stored name
  const cleaned = cleanParentName(g.name);
  if (cleaned && !BAD_GROUP_NAMES.has(cleaned)) return cleaned;
  // 3. Fall back to child names
  if (g.children?.length === 1) return g.children[0].name;
  if (g.children?.length > 1) return `${g.children[0].name} (+${g.children.length-1})`;
  return cleaned || g.id || "Unknown";
};

// ─── SMALL COMPONENTS ────────────────────────────────────────────
const Pill = ({l,v,c}) => <div><span style={{fontSize:9,textTransform:"uppercase",color:T.t3}}>{l} </span><span className="m" style={{fontSize:12,fontWeight:700,color:c}}>{v}</span></div>;
const Stat = ({l,v,c}) => <div style={{background:T.s2,borderRadius:8,padding:"8px 10px",textAlign:"center"}}><div style={{fontSize:9,textTransform:"uppercase",color:T.t3,marginBottom:2}}>{l}</div><div className="m" style={{fontSize:14,fontWeight:700,color:c}}>{v}</div></div>;
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
// Rules are permanent — future uploads with the same Tableau headers
// will always produce clean, consistent output regardless of what
// values Tableau puts in Acct Type or Class 4.
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
    // Skip grand total rows
    if ((row["Parent Name"]||"").startsWith("Grand Total")) continue;
    if ((row["Parent MDM ID"]||"") === "Total") continue;

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

    if (!childId || !parentId) continue;

    // ── RULE: PY and CY from this Tableau export are already credited wholesale ──
    // Do NOT apply chargeback to them — they come in post-chargeback
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

    // ── RULE: Pricing tier comes from Acct Type, normalized through clean rules ──
    // ── RULE: Practice type comes from Sds Cust Class2, not Acct Type ──
    if (!childInfo[childId]) {
      childInfo[childId] = {
        name: row["Child Name"]||"",
        city: row["City"]||"",
        st: row["State"]||"",
        addr: row["Addr"]||"",
        tier: normalizeTier(row["Acct Type"]),
        top100: isTop100(row["Acct Type"]),
        class2: row["Sds Cust Class2"]||"",
        parentId,
      };
    }

    // ── RULE: Group name always comes from Parent Name field (strip suffix) ──
    // ── NEVER use Class 4 as primary source — it's often a tier name ──
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

  const groups = [];
  for (const [pid, childIds] of Object.entries(parentChildren)) {
    const pi = parentInfo[pid] || {};
    const children = [];
    const gPy = {}; const gCy = {};

    for (const cid of childIds) {
      const ci = childInfo[cid] || {};
      const pyQ = {}; const cyQ = {};
      for (const [k,v] of Object.entries(childPyQ[cid]||{})) { pyQ[String(k)] = Math.round(v as number); }
      for (const [k,v] of Object.entries(childCyQ[cid]||{})) { cyQ[String(k)] = Math.round(v as number); }

      // ── RULE: PY/CY already credited — no chargeback adjustment needed ──
      const products = [];
      for (const [l3, vals] of Object.entries(childProds[cid]||{})) {
        const p: any = { n: l3 };
        for (const [k,v] of Object.entries(vals as any)) { p[k] = Math.round(v as number); }
        if (Math.abs(p.pyFY||0) >= 50 || Math.abs(p.cyFY||0) >= 25) products.push(p);
      }
      products.sort((a,b) => Math.abs(b.pyFY||0) - Math.abs(a.pyFY||0));

      const last = childLastDate[cid];
      const daysSince = last ? Math.round((ref.getTime() - last.getTime()) / 86400000) : 999;

      const hasMoney = Object.values(pyQ).some(v=>v!==0) || Object.values(cyQ).some(v=>v!==0);
      if (!hasMoney) continue;

      children.push({
        id: cid,
        name: ci.name,
        city: ci.city,
        st: ci.st,
        addr: ci.addr||"",
        tier: ci.tier||"Standard",
        top100: ci.top100||false,
        class2: ci.class2||"",
        last: daysSince,
        pyQ, cyQ,
        products: products.slice(0,10),
        dealer: DEALERS[cid] || "Unknown"
      });

      for (const [k,v] of Object.entries(pyQ)) gPy[k] = (gPy[k]||0) + (v as number);
      for (const [k,v] of Object.entries(cyQ)) gCy[k] = (gCy[k]||0) + (v as number);
    }

    if (children.length === 0) continue;
    children.sort((a,b) => ((b.pyQ["1"]||0)-(b.cyQ["1"]||0)) - ((a.pyQ["1"]||0)-(a.cyQ["1"]||0)));

    // ── RULE: Group name is set during processing via extractGroupName ──
    // Final fallback only if extractGroupName returned empty
    let gName = pi.name || (children.length === 1 ? children[0].name : `${children[0].name} (+${children.length-1})`);

    groups.push({
      id: pid,
      name: gName,
      tier: pi.tier||"Standard",
      class2: pi.class2||"Private Practice",
      locs: children.length,
      pyQ: gPy,
      cyQ: gCy,
      children
    });
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
["910861-1","Demi Pro LED Curing System","DEMI PRO",1549.0,2582.0,1022.34,1277.93,1120.28,1436.09,1231.22,1619.91,1315.69,1777.82],
["N56CA","Simile A2 Syringe","SIMILE",60.21,100.34,30.89,38.61,36.06,46.23,42.07,55.36,45.07,60.91],
["34338","Herculite Ultra Syringe A2","HERCULITE ULTRA",107.94,179.89,82.12,102.65,87.22,111.81,92.6,121.84,97.98,132.4],
["35640","Nexus RMGI Kit 3x5g Syringes","NEXUS RMGI",110.73,184.54,73.08,91.35,80.03,102.61,87.55,115.22,93.12,125.87],
];

// ═════════════════════════════════════════════════════════════════
// MAIN APP
// ═════════════════════════════════════════════════════════════════
export default function App() {
  return <ErrorBoundary><AppInner/></ErrorBoundary>;
}
function AppInner() {
  const [tab, setTab] = useState("today");
  const [view, setView] = useState(null);
  const [showMore, setShowMore] = useState(false);
  const [adjs, setAdjs] = useState([]);
  const [estPct, setEstPct] = useState(90);
  const [gFilt, setGFilt] = useState("All");
  const [gSearch, setGSearch] = useState("");
  const [dataSource, setDataSource] = useState("preloaded");
  const [groups, setGroups] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadMsg, setUploadMsg] = useState(null);
  const fileRef = useRef(null);

  // ── OVERLAY STATE ─────────────────────────────────────────────
  // overlays: runtime-loaded from data/overlays.json, never wiped by CSV upload
  const [overlays, setOverlaysState] = useState<any>(EMPTY_OVERLAYS);
  const [overlaySaveStatus, setOverlaySaveStatus] = useState<"idle"|"saving"|"saved"|"error">("idle");
  const [overlaySaveError, setOverlaySaveError] = useState<string|null>(null);

  // Keep OVERLAYS_REF in sync so applyOverlays() (called outside React) always has current data
  const setOverlays = (next: any) => {
    OVERLAYS_REF = next;
    setOverlaysState(next);
  };

  // ── CENTRAL PERSISTENCE SERVICE ───────────────────────────────
  // All overlay saves go through here. Updates state immediately, writes to GitHub durably.
  // Shows real error if durable save fails — never silent.
  const saveOverlays = async (next: any): Promise<boolean> => {
    // 1. Update in-memory immediately
    setOverlays(next);
    // 2. Cache to localStorage
    try { localStorage.setItem("overlay_cache", JSON.stringify(next)); } catch {}
    // 3. Write to GitHub durably
    setOverlaySaveStatus("saving");
    setOverlaySaveError(null);
    try {
      const res = await fetch("/api/save-overlay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overlays: next }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Save failed");
      }
      setOverlaySaveStatus("saved");
      setTimeout(() => setOverlaySaveStatus("idle"), 3000);
      return true;
    } catch (err: any) {
      setOverlaySaveStatus("error");
      setOverlaySaveError(err.message || "Failed to save — check connection");
      return false;
    }
  };

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

  // Apply group moves from overlays (durable) + localStorage (session cache)
  const applyGroupOverrides = (grps) => {
    if (!grps) return grps;
    const overrides: {childId:string, targetGroupId:string}[] = [];
    // From overlays.groupMoves (permanent — survives cache clear)
    Object.values(OVERLAYS_REF.groupMoves||{}).forEach((m:any) => {
      if (m.childId && m.targetGroupId) overrides.push(m);
    });
    // From localStorage (session fallback for any moves not yet synced)
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith("group-override:")) {
          const val = JSON.parse(localStorage.getItem(key) || "{}");
          if (val.childId && val.targetGroupId && !overrides.find(o => o.childId === val.childId)) {
            overrides.push(val);
          }
        }
      }
    } catch {}
    if (overrides.length === 0) return grps;

    // Build lookup: childId → target group id
    const overrideMap: Record<string, string> = {};
    overrides.forEach(o => { overrideMap[o.childId] = o.targetGroupId; });

    // 1. Remove overridden children from their current groups and collect them
    const displaced: Record<string, any[]> = {}; // targetGroupId → children[]
    const cleaned = grps.map(g => {
      const kept: any[] = [];
      const moved: any[] = [];
      (g.children || []).forEach(c => {
        if (overrideMap[c.id]) {
          moved.push(c);
          const tgt = overrideMap[c.id];
          displaced[tgt] = displaced[tgt] || [];
          displaced[tgt].push(c);
        } else {
          kept.push(c);
        }
      });
      if (moved.length === 0) return g;
      const newPY = kept.reduce((s,c) => s + (c.pyQ?.["1"]||0), 0);
      const newCY = kept.reduce((s,c) => s + (c.cyQ?.["1"]||0), 0);
      return {...g, children: kept, locs: kept.length, pyQ: {...g.pyQ, "1": newPY}, cyQ: {...g.cyQ, "1": newCY}};
    });

    // 2. Add displaced children to their target groups
    return cleaned.map(g => {
      const incoming = displaced[g.id];
      if (!incoming || incoming.length === 0) return g;
      const newChildren = [...(g.children || []), ...incoming];
      const newPY = newChildren.reduce((s,c) => s + (c.pyQ?.["1"]||0), 0);
      const newCY = newChildren.reduce((s,c) => s + (c.cyQ?.["1"]||0), 0);
      return {...g, children: newChildren, locs: newChildren.length, pyQ: {...g.pyQ, "1": newPY}, cyQ: {...g.cyQ, "1": newCY}};
    });
  };

  // ── DATA LOADING ON MOUNT ────────────────────────────────────
  // Step 1: Load overlays from GitHub (durable user data)
  // Step 2: Load base data (CSV upload or preloaded)
  // Step 3: Apply overlays on top of base data → final state
  useEffect(() => {
    const boot = async () => {
      // ── Load Overlays ──
      let loadedOverlays = EMPTY_OVERLAYS;
      try {
        // Try localStorage cache first (fast)
        const cached = localStorage.getItem("overlay_cache");
        if (cached) {
          loadedOverlays = JSON.parse(cached);
        }
        // Always fetch fresh from GitHub in background to stay current
        fetch("/api/load-overlay").then(async (res) => {
          if (res.ok) {
            const { overlays: fresh } = await res.json();
            if (fresh) {
              setOverlays(fresh);
              try { localStorage.setItem("overlay_cache", JSON.stringify(fresh)); } catch {}
              // Reapply overlays onto current groups with fresh data
              setGroups(prev => prev ? applyGroupOverrides(applyOverlays(prev.map((g:any) => ({...g})))) : prev);
            }
          }
        }).catch(() => { /* Overlay fetch failed — using cached data */ });
      } catch {}
      setOverlays(loadedOverlays);

      // ── Load Base Data ──
      try {
        const saved = localStorage.getItem("accel_data");
        if (saved) {
          const parsed = JSON.parse(saved);
          setGroups(applyGroupOverrides(applyOverlays(hydrateDealer(parsed.groups))));
          setDataSource(`CSV uploaded ${parsed.generated}`);
          setLoading(false);
          return;
        }
      } catch {}

      try {
        const { PRELOADED } = require("@/data/preloaded-data");
        setGroups(applyGroupOverrides(applyOverlays(hydrateDealer(PRELOADED.groups))));
        setDataSource(`Pre-loaded ${PRELOADED.generated}`);
      } catch {
        setGroups([]);
        setDataSource("No data — upload CSV");
      }
      setLoading(false);
    };
    boot();
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

        // Build set of all child IDs in new base data for conflict checking
        const newChildIds = new Set(result.groups.flatMap((g:any) => (g.children||[]).map((c:any) => c.id)));

        // Check for overlay conflicts (group children that no longer exist in new data)
        const missingIds: string[] = [];
        Object.values(OVERLAYS_REF.groups||{}).forEach((grp:any) => {
          (grp.childIds||[]).forEach((cid:string) => {
            if (!newChildIds.has(cid)) missingIds.push(cid);
          });
        });

        // Apply overlays on top of new base data
        setGroups(applyGroupOverrides(applyOverlays(hydrateDealer(result.groups))));
        setDataSource(`CSV uploaded ${result.generated}`);
        localStorage.setItem("accel_data", JSON.stringify(result));

        const warn = missingIds.length > 0 ? ` ⚠ ${missingIds.length} overlay account(s) not found in new data` : "";
        setUploadMsg(`OK Loaded ${result.groups.length} groups from CSV${warn}`);
        setTimeout(() => setUploadMsg(null), missingIds.length > 0 ? 8000 : 4000);
      } catch(err: any) {
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

  // Score all accounts — use combined sibling totals for gap/priority when addr siblings exist
  const scored = useMemo(() => {
    // First pass: build a quick id→cyQ1 map so siblings can look up adjusted CY
    const adjCYMap: Record<string,number> = {};
    allChildren.forEach(a => {
      const myAdj = adjs.filter(m => m.acctId === a.id);
      adjCYMap[a.id] = (a.cyQ?.["1"]||0) + myAdj.reduce((s,m) => s + m.credited, 0);
    });

    return allChildren.map(a => {
      const myAdj = adjs.filter(m => m.acctId === a.id);
      const adjCY = adjCYMap[a.id];
      const adjusted = { ...a, cyQ: { ...a.cyQ, "1": adjCY }, adjCount: myAdj.length };

      // Enrich addr from Badger if not already set
      const b = BADGER[a.id] || BADGER[a.gId] || null;
      const addr = a.addr || (b?.address ? b.address.split(',')[0].trim() : "");

      // Compute combined totals across same-address siblings (different groups)
      const siblings: any[] = a.addrSiblings || [];
      let combinedPY = a.pyQ?.["1"] || 0;
      let combinedCY = adjCY;
      if(siblings.length > 0) {
        siblings.forEach((s:any) => {
          combinedPY += s.pyQ1 || 0;
          combinedCY += adjCYMap[s.id] ?? s.cyQ1 ?? 0;
        });
      }
      const hasSiblings = siblings.length > 0;

      // Score using COMBINED totals so priority reflects true account health
      const scoreBase = hasSiblings
        ? { ...adjusted, pyQ: { ...adjusted.pyQ, "1": combinedPY }, cyQ: { ...adjusted.cyQ, "1": combinedCY } }
        : adjusted;

      return {
        ...adjusted, addr,
        ...scoreAccount(scoreBase, "1"),
        // Store combined for display
        combinedPY, combinedCY,
        combinedGap: combinedPY - combinedCY,
        hasSiblings,
        siblingCount: siblings.length,
        // Keep individual for dealer breakdown
        indivPY: a.pyQ?.["1"] || 0,
        indivCY: adjCY,
      };
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
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{fontSize:15,fontWeight:700}}>Ken <span style={{color:T.blue}}>Scott</span></div>
          {q1CY>0&&<div className="m" style={{fontSize:10,fontWeight:700,
            color:q1Att>=1?T.green:q1Att>=.85?T.amber:T.red,
            background:q1Att>=1?"rgba(52,211,153,.1)":q1Att>=.85?"rgba(251,191,36,.1)":"rgba(248,113,113,.1)",
            border:`1px solid ${q1Att>=1?"rgba(52,211,153,.2)":q1Att>=.85?"rgba(251,191,36,.2)":"rgba(248,113,113,.2)"}`,
            borderRadius:999,padding:"2px 8px"}}>{pc(q1Att)} · {DAYS_LEFT}d left</div>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <button onClick={()=>fileRef.current?.click()} style={{background:"rgba(79,142,247,.08)",border:`1px solid rgba(79,142,247,.15)`,borderRadius:8,padding:"4px 10px",display:"flex",alignItems:"center",gap:5,cursor:"pointer",color:T.blue,fontSize:10,fontWeight:600,fontFamily:"inherit"}}><UploadIcon/> CSV</button>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleUpload} style={{display:"none"}}/>
          <div className="m" style={{border:`1px solid ${T.b1}`,background:T.s2,borderRadius:999,padding:"3px 10px",fontSize:10,fontWeight:500,color:T.t4}}>{dataSource}</div>
        </div>
      </header>

      {/* UPLOAD MESSAGE */}
      {uploadMsg && <div className="anim" style={{margin:"8px 16px",padding:"10px 14px",borderRadius:10,background:uploadMsg.startsWith("OK")?"rgba(52,211,153,.08)":"rgba(248,113,113,.08)",border:`1px solid ${uploadMsg.startsWith("OK")?"rgba(52,211,153,.15)":"rgba(248,113,113,.15)"}`,fontSize:12,color:uploadMsg.startsWith("OK")?T.green:uploadMsg.startsWith("ERR")?T.red:T.t3}}>{uploadMsg}</div>}
      {overlaySaveStatus==="saving"&&<div className="anim" style={{margin:"0 16px 8px",padding:"6px 12px",borderRadius:8,background:"rgba(79,142,247,.08)",border:"1px solid rgba(79,142,247,.15)",fontSize:11,color:T.blue}}>💾 Saving...</div>}
      {overlaySaveStatus==="saved"&&<div className="anim" style={{margin:"0 16px 8px",padding:"6px 12px",borderRadius:8,background:"rgba(52,211,153,.08)",border:"1px solid rgba(52,211,153,.15)",fontSize:11,color:T.green}}>✓ Saved</div>}
      {overlaySaveStatus==="error"&&<div className="anim" style={{margin:"0 16px 8px",padding:"6px 12px",borderRadius:8,background:"rgba(248,113,113,.08)",border:"1px solid rgba(248,113,113,.15)",fontSize:11,color:T.red}}>⚠ Save failed: {overlaySaveError} — your change is cached locally but not backed up yet.</div>}

      {/* TAB CONTENT */}
      {/* goSmart: always route child taps through the parent group when group has >1 loc.
          Private practices (locs=1) and multi-dealer same-address offices go straight to AcctDetail
          since the AcctDetail IS their combined summary. */}
      {(() => {
        const goSmartFn = (a: any, fromGroup?: any) => {
          const parentGroup = (groups||[]).find((g:any) => g.id === (a.gId||a.id));
          if (parentGroup && parentGroup.locs > 1) {
            // Multi-location group — show group summary first, with this child's context
            setView({type:"group", data: parentGroup});
          } else {
            // Single-location or private practice — AcctDetail IS the summary
            setView({type:"acct", data: a, from: fromGroup});
          }
        };
        const goGroupFn = (g:any) => setView({type:"group", data:g});
        const goAcctFn = (a:any, from?:any) => setView({type:"acct", data:a, from});
        return <>
          {!view && tab==="today" && <TodayTab scored={scored} goAcct={goSmartFn} q1CY={q1CY} q1Gap={q1Gap} q1Att={q1Att} adjCount={adjs.length} totalAdj={totalAdjQ1} groups={groups||[]} goGroup={goGroupFn}/>}
          {!view && tab==="groups" && <GroupsTab groups={groups||[]} goGroup={goGroupFn} filt={gFilt} setFilt={setGFilt} search={gSearch} setSearch={setGSearch}/>}
          {!view && tab==="map" && <MapTab/>}
          {!view && tab==="calc" && <DashTab groups={groups||[]} q1CY={q1CY} q1Att={q1Att} q1Gap={q1Gap} scored={scored} goAcct={goSmartFn}/>}
          {!view && tab==="est" && <EstTab pct={estPct} setPct={setEstPct} q1CY={q1CY} groups={groups||[]} goAcct={goSmartFn}/>}
          {!view && tab==="dealers" && <DealersTab scored={scored} groups={groups||[]} goAcct={goAcctFn} goGroup={goGroupFn}/>}
          {!view && tab==="outreach" && <OutreachTab scored={scored}/>}
          {!view && tab==="admin" && <AdminTab groups={groups||[]} scored={scored} overlays={overlays} saveOverlays={saveOverlays}/>}
          {view?.type==="group" && <GroupDetail group={view.data} goMain={()=>setView(null)} overlays={overlays} saveOverlays={saveOverlays} goAcct={(a:any)=>setView({type:"acct",data:{...a,gName:fixGroupName(view.data),gId:view.data.id,gTier:view.data.tier},from:view.data})}/>}
          {view?.type==="acct" && <AcctDetail acct={view.data} goBack={()=>view?.from?setView({type:"group",data:view.from}):setView(null)} adjs={adjs} setAdjs={setAdjs} groups={groups||[]} goGroup={goGroupFn} overlays={overlays} saveOverlays={saveOverlays}/>}
        </>;
      })()}

      {/* MORE MENU OVERLAY */}
      {showMore && <div style={{position:"fixed",inset:0,zIndex:90,background:"rgba(0,0,0,.6)",backdropFilter:"blur(4px)"}} onClick={()=>setShowMore(false)}>
        <div style={{position:"absolute",bottom:58,left:"50%",transform:"translateX(-50%)",width:"calc(100% - 32px)",maxWidth:928,background:T.s1,border:`1px solid ${T.b2}`,borderRadius:16,padding:"8px 0",boxShadow:"0 -8px 32px rgba(0,0,0,.5)"}} onClick={e=>e.stopPropagation()}>
          {[{k:"map",l:"Route",I:IconMap,desc:"Week routes & Google Maps"},{k:"est",l:"Close",I:IconSliders,desc:"Q1 completion estimator"},{k:"outreach",l:"Outreach",I:IconMail,desc:"AI email campaigns"},{k:"admin",l:"Admin",I:IconAdmin,desc:"Groups, contacts, data fixes"}].map(t=>(
            <button key={t.k} onClick={()=>{setTab(t.k);setView(null);setShowMore(false)}} style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"12px 16px",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",color:tab===t.k?T.blue:T.t2}}>
              <t.I c={tab===t.k?T.blue:T.t3}/>
              <div style={{textAlign:"left"}}><div style={{fontSize:13,fontWeight:600}}>{t.l}</div><div style={{fontSize:10,color:T.t4}}>{t.desc}</div></div>
            </button>
          ))}
        </div>
      </div>}

      {/* NAV BAR */}
      <nav style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:960,zIndex:100,borderTop:`1px solid ${T.b1}`,background:"rgba(10,10,15,.92)",backdropFilter:"blur(32px)"}}>
        <div style={{display:"flex",height:56,alignItems:"center",justifyContent:"space-around",padding:"0 4px"}}>
          {[{k:"today",l:"Today",I:IconBolt},{k:"groups",l:"Groups",I:IconGroup},{k:"dealers",l:"Dealers",I:IconDealer},{k:"calc",l:"Dash",I:IconChart}].map(t=>(
            <button key={t.k} onClick={()=>{setTab(t.k);setView(null);setShowMore(false)}} style={{background:"none",border:"none",display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"4px 12px",cursor:"pointer",color:tab===t.k&&!view&&!showMore?T.blue:T.t4}}>
              <t.I c={tab===t.k&&!view&&!showMore?T.blue:T.t4}/>
              <span style={{fontSize:9,fontWeight:600,letterSpacing:".5px"}}>{t.l}</span>
            </button>
          ))}
          <button onClick={()=>setShowMore(!showMore)} style={{background:"none",border:"none",display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"4px 12px",cursor:"pointer",color:showMore||["map","est","outreach","admin"].includes(tab)?T.blue:T.t4}}>
            <IconMore c={showMore||["map","est","outreach","admin"].includes(tab)?T.blue:T.t4}/>
            <span style={{fontSize:9,fontWeight:600,letterSpacing:".5px"}}>More</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

// ─── TODAY TAB ────────────────────────────────────────────────────
function TodayTab({scored,goAcct,q1CY,q1Gap,q1Att,adjCount,totalAdj,groups,goGroup}) {
  const [scope, setScope] = useState<string>(() => {
    try { return localStorage.getItem("today_scope") || "1"; } catch { return "1"; }
  });
  const setAndSaveScope = (s: string) => {
    setScope(s);
    try { localStorage.setItem("today_scope", s); } catch {}
  };

  // ── Scoped totals: PY vs CY for selected scope across all groups ──
  const scopeTotals = useMemo(() => {
    if (!groups) return {py:0, cy:0};
    const py = groups.reduce((s,g) => s + (g.pyQ?.[scope]||0), 0);
    const cy = groups.reduce((s,g) => s + (g.cyQ?.[scope]||0), 0);
    return {py, cy};
  }, [groups, scope]);

  // ── Scoped scored: rescore all accounts for the selected scope ──
  // Only needed when scope ≠ "1" (Q1 scored array is already computed at App level)
  const scopedScored = useMemo(() => {
    if (scope === "1") return scored; // use existing Q1 scored — already adjusted
    return scored.map(a => {
      const py = a.pyQ?.[scope] || 0;
      const cy = a.cyQ?.[scope] || 0;
      const scoreBase = {...a, pyQ:{...a.pyQ, [scope]: py}, cyQ:{...a.cyQ, [scope]: cy}};
      return {
        ...a,
        ...scoreAccount(scoreBase, scope),
        // override py/cy/gap/ret for display in this scope
        py, cy, gap: py-cy, ret: py>0 ? cy/py : 0,
      };
    }).sort((a:any,b:any) => b.score - a.score);
  }, [scored, scope]);

  // ── Scoped group rolls: re-aggregate groups for selected scope ──
  const scopedGroups = useMemo(() => {
    const gMap: Record<string,any> = {};
    scopedScored.forEach(a => {
      if(!a.gId) return;
      if(!gMap[a.gId]) gMap[a.gId] = {gId:a.gId, gName:a.gName||a.gId, gTier:a.gTier||"", children:[], totalPY:0, totalCY:0, maxScore:0};
      const g = gMap[a.gId];
      g.children.push(a);
      g.totalPY += (a.pyQ?.[scope]||0);
      g.totalCY += (a.cyQ?.[scope]||0);
      if((a.score||0) > g.maxScore) g.maxScore = a.score;
    });
    return Object.values(gMap)
      .map((g:any) => ({
        ...g,
        totalGap: g.totalPY - g.totalCY,
        totalRet: g.totalPY > 0 ? g.totalCY / g.totalPY : 0,
        children: [...g.children].sort((a:any,b:any) => (b.gap||0) - (a.gap||0)),
      }))
      .filter((g:any) => g.totalGap > 0 || g.maxScore >= 20)
      .sort((a:any,b:any) => b.totalGap - a.totalGap);
  }, [scopedScored, scope]);
  const [search, setSearch] = useState("");
  const [odDone, setOdDone] = useState<Record<string,{outcome:string,amt:number,note?:string}>>(() => {
    try { return JSON.parse(localStorage.getItem("overdrive_done") || "{}"); } catch { return {}; }
  });
  const [odNotePrompt, setOdNotePrompt] = useState<{id:string,outcome:string,amt:number}|null>(null);
  const [odNoteText, setOdNoteText] = useState("");
  const [odOpen, setOdOpen] = useState<boolean>(() => {
    try { return localStorage.getItem("overdrive_open") !== "false"; } catch { return true; }
  });
  const [tripAnchor, setTripAnchor] = useState<any>(null);
  const toggleOd = () => {
    const next = !odOpen;
    setOdOpen(next);
    try { localStorage.setItem("overdrive_open", String(next)); } catch {}
  };

  const saveDone = (id: string, outcome: string, amt: number, note?: string) => {
    const updated = {...odDone, [id]: {outcome, amt, ...(note ? {note} : {})}};
    setOdDone(updated);
    try { localStorage.setItem("overdrive_done", JSON.stringify(updated)); } catch {}
  };
  const promptOutcome = (e: React.MouseEvent, id: string, outcome: string, amt: number) => {
    e.stopPropagation();
    setOdNotePrompt({id, outcome, amt});
    setOdNoteText("");
  };
  const commitOutcome = () => {
    if (!odNotePrompt) return;
    saveDone(odNotePrompt.id, odNotePrompt.outcome, odNotePrompt.amt, odNoteText.trim() || undefined);
    setOdNotePrompt(null);
    setOdNoteText("");
  };

  const clearDone = (id: string) => {
    const updated = {...odDone};
    delete updated[id];
    setOdDone(updated);
    try { localStorage.setItem("overdrive_done", JSON.stringify(updated)); } catch {}
  };

  // ── OVERDRIVE ENGINE — full signal scoring ──
  const overdrive = useMemo(() => {
    if (!scored.length) return null;

    // Time pressure bands
    const isEndgame = DAYS_LEFT <= 5;
    const isSprint  = DAYS_LEFT <= 14;
    const isCruise  = DAYS_LEFT > 30;
    const modeLabel = isEndgame ? "🔴 Endgame" : isSprint ? "🟡 Sprint" : isCruise ? "🟢 Pipeline" : "🟠 Push";

    // Haversine distance from Thomaston CT (miles)
    const distMiles = (lat?: number, lng?: number): number => {
      if (!lat || !lng) return 999;
      const R = 3958.8;
      const dLat = (lat - HOME_LAT) * Math.PI / 180;
      const dLng = (lng - HOME_LNG) * Math.PI / 180;
      const a = Math.sin(dLat/2)**2 + Math.cos(HOME_LAT * Math.PI/180) * Math.cos(lat * Math.PI/180) * Math.sin(dLng/2)**2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    };

    // Score a single account across all available signals
    const scoreAccount = (a: any, track: string) => {
      const py = a.pyQ?.["1"] || 0;
      const cy = a.cyQ?.["1"] || 0;
      const gap = py - cy;
      const retPct = py > 0 ? cy / py : 0;
      const badger = BADGER[a.id] || BADGER[a.gId] || null;

      // ── BASE PROBABILITY from retention ──
      let prob = track === "uplift"
        ? (retPct > 0.7 ? 0.78 : retPct > 0.4 ? 0.62 : 0.48)
        : (py > 2000 ? 0.28 : py > 800 ? 0.40 : 0.52);

      // ── SIGNAL BOOSTS ──

      // 1. Bought in March last year → highest possible signal for sprint/endgame
      //    PY Q1 data IS the last 12 weeks of March — accounts with high PY Q1 were buying in this window
      if (isSprint || isEndgame) {
        if (py > 3000) prob += 0.15;
        else if (py > 1500) prob += 0.10;
        else if (py > 500) prob += 0.05;
      }

      // 2. Actively buying this year, small gap → very high probability
      if (track === "uplift") {
        prob += 0.08; // already in buying mode this year
        if (isSprint || isEndgame) prob += 0.07; // extra boost end of quarter
      }

      // 3. Has dealer contact → can coordinate outreach in parallel
      const hasDealer = a.dealer && a.dealer !== "Unknown";
      if (hasDealer) prob += 0.04;

      // 4. Has Badger field intel → we know who to call
      if (badger) {
        if (badger.doctor) prob += 0.05;      // know the doctor's name
        if (badger.orders) prob += 0.05;      // know who places orders
        if (badger.dealerRep) prob += 0.04;   // know dealer rep by name
        if (badger.notes) prob += 0.03;       // have visit notes
        if (badger.feel && parseFloat(badger.feel) >= 4) prob += 0.06; // strong relationship
        if (badger.feel && parseFloat(badger.feel) <= 2) prob -= 0.08; // weak relationship
        // Recently visited → warmer relationship
        if (badger.lastVisit) {
          const daysSince = (Date.now() - new Date(badger.lastVisit).getTime()) / 86400000;
          if (daysSince < 30) prob += 0.08;
          else if (daysSince < 60) prob += 0.05;
          else if (daysSince < 90) prob += 0.02;
          else if (daysSince > 180) prob -= 0.04; // gone cold
        }
      }

      // 5. Cross-sell opportunity → reason to call beyond just gap
      const products = a.products || [];
      const buying = products.filter((p: any) => (p.cy1 || 0) > 0).map((p: any) => p.n?.toLowerCase() || "");
      const hasXsell = (
        (!buying.some((p: any) => p.includes("simplishade")) && buying.some((p: any) => p.includes("harmonize") || p.includes("herculite"))) ||
        (!buying.some((p: any) => p.includes("optibond 360")) && buying.some((p: any) => p.includes("optibond"))) ||
        (!buying.some((p: any) => p.includes("sonicfill")) && buying.some((p: any) => p.includes("composite") || p.includes("herculite"))) ||
        (!buying.some((p: any) => p.includes("maxcem")) && buying.some((p: any) => p.includes("cement") || p.includes("rely")))
      );
      if (hasXsell) prob += 0.04;

      // 6. Distance — closer = more likely you'll actually visit
      const lat = badger?.lat || a.lat;
      const lng = badger?.lng || a.lng;
      const miles = distMiles(lat, lng);
      let distScore = 0;
      if (miles < 20) distScore = 0.08;
      else if (miles < 40) distScore = 0.05;
      else if (miles < 60) distScore = 0.02;
      else if (miles > 100) distScore = -0.05; // far accounts are harder to squeeze in

      // For visit list only — distance matters a LOT for in-person
      // For calls — distance doesn't matter, use 0
      const distBoost = distScore;

      // Time pressure adjustments
      if (isEndgame && track === "dark") prob *= 0.5;
      if (isSprint && track === "dark") prob *= 0.75;

      prob = Math.min(Math.max(prob, 0.05), 0.95); // clamp 5-95%

      // Ask amount
      const askPct = isEndgame ? 1.0 : isSprint ? 0.85 : 0.70;
      const ask = track === "uplift"
        ? Math.min(gap, Math.max(150, gap * askPct))
        : py * (isEndgame ? 0.4 : isSprint ? 0.55 : 0.65);

      const visitScore = ask * Math.min(prob + distBoost, 0.95);  // distance matters for visits
      const callScore  = ask * prob;                               // distance irrelevant for calls

      return {
        ...a, gap: track === "uplift" ? gap : py, ask, prob, track,
        visitScore, callScore, miles, hasDealer, hasBadger: !!badger,
        hasXsell, badgerFeel: badger?.feel ? parseFloat(badger.feel) : null,
        signals: [
          py > 1500 && (isSprint || isEndgame) ? "Bought in March PY" : null,
          track === "uplift" ? "Active buyer" : "Gone dark",
          hasDealer ? `Via ${a.dealer}` : null,
          badger?.orders ? `Orders: ${badger.orders}` : null,
          badger?.feel && parseFloat(badger.feel) >= 4 ? "Strong relationship" : null,
          hasXsell ? "Cross-sell opp" : null,
          miles < 40 ? `${Math.round(miles)}mi away` : null,
        ].filter(Boolean),
      };
    };

    // ── BUILD CANDIDATE POOLS ──
    const darkMaxPY = isEndgame ? 800 : isSprint ? 2000 : 999999;

    const upliftRaw = scored
      .filter((a: any) => (a.cyQ?.["1"]||0) > 0 && (a.pyQ?.["1"]||0) > (a.cyQ?.["1"]||0))
      .map((a: any) => scoreAccount(a, "uplift"));

    const darkRaw = scored
      .filter((a: any) => (a.cyQ?.["1"]||0) === 0 && (a.pyQ?.["1"]||0) > 200 && (a.pyQ?.["1"]||0) <= darkMaxPY)
      .map((a: any) => scoreAccount(a, "dark"));

    const allCandidates = [...new Map([...upliftRaw, ...darkRaw].map((a: any) => [a.id, a])).values()];

    // ── VISIT LIST — cluster-aware routing ──
    // Step 1: Hard distance gate. >75 miles = call/dealer only, NOT a visit
    // unless the account has enough cluster value to justify the drive
    const VISIT_MAX_SOLO = 75;    // won't visit solo if farther than this
    const VISIT_MAX_CLUSTERED = 120; // will visit if 2+ accounts within 20mi of each other

    // Find accounts with GPS coords
    const withCoords = allCandidates.filter((a: any) => {
      const badger = BADGER[a.id] || BADGER[a.gId];
      return (badger?.lat && badger?.lng) || (a.lat && a.lng);
    }).map((a: any) => {
      const badger = BADGER[a.id] || BADGER[a.gId];
      return {...a, _lat: badger?.lat || a.lat, _lng: badger?.lng || a.lng};
    });

    // For each candidate, find how many other accounts are within 20 miles
    const clustered = allCandidates.map((a: any) => {
      const badger = BADGER[a.id] || BADGER[a.gId];
      const aLat = badger?.lat || a.lat;
      const aLng = badger?.lng || a.lng;

      // Count nearby accounts with gaps
      const nearbyAccounts = withCoords.filter((b: any) => {
        if (b.id === a.id) return false;
        const d = distMiles(aLat, aLng);
        const dB = distMiles(b._lat, b._lng);
        // Both within 20 miles of each other AND both have meaningful gaps
        return Math.abs(d - dB) < 20 && b.ask > 200;
      });

      const clusterValue = nearbyAccounts.reduce((s: number, b: any) => s + b.ask * b.prob, 0);
      const clusterCount = nearbyAccounts.length;

      // Determine if this account qualifies for a visit
      const solo = a.miles < VISIT_MAX_SOLO;
      const clusteredVisit = a.miles < VISIT_MAX_CLUSTERED && clusterCount >= 2;
      const visitEligible = solo || clusteredVisit;

      // Visit score: heavily penalize far solo accounts
      let adjustedVisitScore = a.visitScore;
      if (!visitEligible) adjustedVisitScore = 0; // force to call list
      else if (a.miles > 60 && clusterCount >= 2) adjustedVisitScore *= 1.2; // bonus for clusters worth driving to

      return {
        ...a, clusterCount, clusterValue, visitEligible, adjustedVisitScore,
        nearbyAccounts: nearbyAccounts.slice(0,8), // full objects for trip planner
        nearbyNames: nearbyAccounts.slice(0,3).map((b: any) => b.name),
        signals: [
          ...(a.signals||[]),
          clusterCount >= 2 ? `${clusterCount} nearby accts` : null,
          !visitEligible && a.miles > 75 ? `${Math.round(a.miles)}mi — call instead` : null,
        ].filter(Boolean),
      };
    });

    // Visit list: only visit-eligible, sorted by adjustedVisitScore
    const visitList = clustered
      .filter((a: any) => a.visitEligible && a.track === "uplift")
      .sort((a: any, b: any) => b.adjustedVisitScore - a.adjustedVisitScore)
      .slice(0, 5);

    // ── CALL LIST — far accounts + dark + remaining uplift ──
    // Far accounts that got blocked from visit list go here
    const visitIds = new Set(visitList.map((a: any) => a.id));
    const callCandidates = clustered
      .filter((a: any) => !visitIds.has(a.id))
      .sort((a: any, b: any) => b.callScore - a.callScore);
    const callList = callCandidates.slice(0, 10);

    // ── DEALER PUSH ──
    const dealerGroups: Record<string, any[]> = {};
    clustered.forEach((a: any) => {
      if (a.dealer && a.dealer !== "Unknown") {
        dealerGroups[a.dealer] = dealerGroups[a.dealer] || [];
        dealerGroups[a.dealer].push(a);
      }
    });
    const dealerActions = Object.entries(dealerGroups)
      .map(([dealer, accts]) => {
        const top = (accts as any[]).sort((a: any, b: any) => b.callScore - a.callScore).slice(0, 3);
        return { dealer, accts: top, totalAsk: top.reduce((s: number, a: any) => s + a.ask, 0) };
      })
      .sort((a, b) => b.totalAsk - a.totalAsk)
      .slice(0, 3);

    // ── PROJECTIONS ──
    const allTargets = clustered;
    const doneTotal = Object.values(odDone).reduce((s, v: any) => s + (v.amt || 0), 0);
    const pending = allTargets.filter((a: any) => !odDone[a.id]);
    const conservative = doneTotal + pending.reduce((s: number, a: any) => s + a.ask * Math.min(a.prob * 0.65, 1), 0);
    const base = doneTotal + pending.reduce((s: number, a: any) => s + a.ask * a.prob, 0);
    const aggressive = doneTotal + pending.reduce((s: number, a: any) => s + a.ask * Math.min(a.prob * 1.35, 1), 0);

    return { visitList, callList, dealerActions, conservative, base, aggressive, doneTotal,
             totalTargets: allTargets.length, modeLabel, isEndgame, isSprint };
  }, [scored, odDone]);

  // ── Section 1: Q1 status
  const ahead = q1Att >= 1.0;
  const onTrack = !ahead && q1Att >= 0.85;
  const statusColor = ahead ? T.green : onTrack ? T.amber : T.red;
  const statusLabel = ahead ? "Ahead of Target" : onTrack ? "On Track" : "Behind Target";
  const statusBg = ahead ? "rgba(52,211,153,.08)" : onTrack ? "rgba(251,191,36,.08)" : "rgba(248,113,113,.08)";
  const statusBorder = ahead ? "rgba(52,211,153,.18)" : onTrack ? "rgba(251,191,36,.18)" : "rgba(248,113,113,.18)";

  // ── Search filter — matches office name, city, state, group name
  const q = search.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!q) return [];
    return scored.filter(a =>
      a.name?.toLowerCase().includes(q) ||
      a.city?.toLowerCase().includes(q) ||
      a.st?.toLowerCase().includes(q) ||
      a.addr?.toLowerCase().includes(q) ||
      a.gName?.toLowerCase().includes(q) ||
      (a.city && a.st && `${a.city} ${a.st}`.toLowerCase().includes(q))
    ).slice(0, 30);
  }, [q, scored]);

  // ── Section 2: Wins & Momentum
  const growing = scored
    .filter(a => (a.cyQ?.["1"]||0) > 0 && (a.pyQ?.["1"]||0) > 0 && (a.cyQ?.["1"]||0) > (a.pyQ?.["1"]||0))
    .sort((a,b) => ((b.cyQ?.["1"]||0)-(b.pyQ?.["1"]||0)) - ((a.cyQ?.["1"]||0)-(a.pyQ?.["1"]||0)))
    .slice(0,5);
  const healthyAccel = scored
    .filter(a => isAccelTier(a.gTier||a.tier) && a.ret >= 0.6 && (a.cyQ?.["1"]||0) > 0)
    .sort((a,b) => (b.cyQ?.["1"]||0) - (a.cyQ?.["1"]||0))
    .slice(0,5);

  // ── Section 3: Group-first action list — uses scopedGroups (scope-aware)
  // scoredGroups is now scopedGroups defined above with scope state

  // ── Group health lookup: gId → {totalPY, totalCY, isHealthy}
  const groupHealthMap = useMemo(() => {
    const map: Record<string,{totalPY:number,totalCY:number,isHealthy:boolean}> = {};
    scopedGroups.forEach((g:any) => {
      map[g.gId] = {
        totalPY: g.totalPY,
        totalCY: g.totalCY,
        isHealthy: g.totalCY >= g.totalPY,
      };
    });
    return map;
  }, [scopedGroups]);

  const isGroupAccount = (a:any) => {
    const grp = (groups||[]).find((g:any) => g.id === a.gId);
    return grp && grp.locs > 1;
  };

  const suppressedByRule = (a:any): "none"|"rule1"|"rule2" => {
    // Rule 1: multi-dealer private practice, combined on track (only meaningful for Q scopes)
    if (scope !== "FY" && a.hasSiblings && a.combinedPY > 0 && a.combinedCY >= a.combinedPY) return "rule1";
    // Rule 2: child of a multi-location group where group overall is healthy
    if (a.gId && isGroupAccount(a)) {
      const gh = groupHealthMap[a.gId];
      if (gh && gh.isHealthy) return "rule2";
    }
    return "none";
  };

  const hotGroups = scopedGroups
    .filter((g:any) => g.totalCY < g.totalPY)
    .filter((g:any) => g.maxScore >= 50)
    .slice(0,12);
  const followGroups = scopedGroups
    .filter((g:any) => g.totalCY < g.totalPY)
    .filter((g:any) => g.maxScore >= 20 && g.maxScore < 50)
    .slice(0,12);

  // ── Group Watch: healthy-group children that are individually underperforming
  // These are lower priority than a genuinely down account, but still worth flagging
  const groupWatch = useMemo(() => {
    return scopedScored
      .filter((a:any) => {
        if (!a.gId || !isGroupAccount(a)) return false;
        const gh = groupHealthMap[a.gId];
        if (!gh || !gh.isHealthy) return false;
        return (a.gap || 0) > 200 && a.score >= 20;
      })
      .sort((a:any,b:any) => (b.gap||0) - (a.gap||0))
      .slice(0,15);
  }, [scopedScored, groupHealthMap]);

  const hot = scopedScored.filter((a:any) => suppressedByRule(a) === "none" && a.score >= 50).slice(0,10);
  const followUp = scopedScored.filter((a:any) => suppressedByRule(a) === "none" && a.score >= 20 && a.score < 50).slice(0,10);

  // ── Group-first action card for Today tab
  const GroupActionCard = ({g, i, isHot, goAcct, goGroup, groups}: any) => {
    const [expanded, setExpanded] = useState(false);
    const gap = g.totalGap;
    const ret = Math.round(g.totalRet * 100);
    const worstChildren = g.children.filter((c:any) => (c.gap||0) > 0).slice(0,5);
    const topChild = worstChildren[0];
    // Find full group object for goGroup
    const fullGroup = (groups||[]).find((gr:any) => gr.id === g.gId);
    return (
      <div className="anim" style={{animationDelay:`${i*25}ms`,background:T.s1,
        border:`1px solid ${isHot?"rgba(248,113,113,.18)":T.b1}`,
        borderRadius:14,padding:"12px 14px",marginBottom:8}}>
        {/* Group header row */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
          <div style={{flex:1,minWidth:0,cursor:"pointer"}} onClick={()=>fullGroup&&goGroup(fullGroup)}>
            <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:2}}>
              <span style={{fontSize:10,fontWeight:700,color:isHot?T.red:T.amber,
                background:isHot?"rgba(248,113,113,.08)":"rgba(251,191,36,.08)",
                borderRadius:4,padding:"2px 6px"}}>{g.maxScore}pt</span>
              <span style={{fontSize:10,color:T.t4}}>{g.children.length} loc{g.children.length>1?"s":""}</span>
              {isAccelTier(g.gTier)&&<span style={{fontSize:9,color:T.amber}}>{normalizeTier(g.gTier)}</span>}
            </div>
            <div style={{fontSize:13,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:T.t1}}>{g.gName}</div>
          </div>
          <div style={{textAlign:"right",flexShrink:0,marginLeft:12}}>
            <div className="m" style={{fontSize:13,fontWeight:700,color:gap>0?T.red:T.green}}>{gap>0?`-${$$(gap)}`:$$(Math.abs(gap))}</div>
            <div className="m" style={{fontSize:10,color:T.t4}}>{ret}% ret</div>
          </div>
        </div>
        {/* Top hurting child — only show when group has multiple locations */}
        {topChild&&g.children.length>1&&<div style={{borderTop:`1px solid ${T.b2}`,paddingTop:6,marginTop:2}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}
            onClick={()=>goAcct({...topChild,gName:g.gName,gId:g.gId,gTier:g.gTier})}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:4}}>
                <span style={{fontSize:8,color:T.red,fontWeight:700}}>▼</span>
                <span style={{fontSize:11,fontWeight:600,color:T.t1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{topChild.name}</span>
                {topChild.dealer&&topChild.dealer!=="Unknown"&&<span style={{fontSize:9,color:T.cyan,flexShrink:0}}>· {topChild.dealer}</span>}
              </div>
              {/* Down products on worst child */}
              {(topChild.products||[]).filter((p:any)=>(p.py1||p.pyQ?.["1"]||0)>100&&(p.cy1||p.cyQ?.["1"]||0)===0).slice(0,3).map((p:any,j:number)=>(
                <span key={j} style={{fontSize:8,color:T.red,background:"rgba(248,113,113,.06)",borderRadius:3,padding:"1px 4px",marginRight:3,border:"1px solid rgba(248,113,113,.1)"}}>{p.n?.split(" ")[0]} $0</span>
              ))}
            </div>
            <div style={{flexShrink:0,marginLeft:8,textAlign:"right"}}>
              <span className="m" style={{fontSize:11,fontWeight:700,color:T.red}}>-{$$((topChild.gap||0))}</span>
              <Chev/>
            </div>
          </div>
        </div>}
        {/* Expand/collapse remaining children */}
        {worstChildren.length>1&&<>
          <button onClick={()=>setExpanded(!expanded)}
            style={{width:"100%",marginTop:6,background:"none",border:"none",cursor:"pointer",
              fontSize:10,color:T.t4,textAlign:"left",padding:"2px 0",fontFamily:"inherit",
              display:"flex",alignItems:"center",gap:4}}>
            <span style={{color:T.blue}}>{expanded?"▲ Hide":"▼ Show"} {worstChildren.length-1} more location{worstChildren.length>2?"s":""}</span>
          </button>
          {expanded&&worstChildren.slice(1).map((c:any,j:number)=>(
            <div key={c.id} style={{borderTop:`1px solid ${T.b2}`,paddingTop:5,marginTop:5,
              display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}
              onClick={()=>goAcct({...c,gName:g.gName,gId:g.gId,gTier:g.gTier})}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:11,fontWeight:500,color:T.t2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</div>
                {c.dealer&&c.dealer!=="Unknown"&&<span style={{fontSize:9,color:T.cyan}}>{c.dealer}</span>}
              </div>
              <div style={{flexShrink:0,marginLeft:8,display:"flex",alignItems:"center",gap:4}}>
                <span className="m" style={{fontSize:11,fontWeight:600,color:T.red}}>-{$$(c.gap||0)}</span>
                <Chev/>
              </div>
            </div>
          ))}
        </>}
      </div>
    );
  };

  const AcctCard = ({a, i, showHot=false}) => {
    const dispGap = a.hasSiblings ? a.combinedGap : a.gap;
    const dispRet = a.hasSiblings && a.combinedPY > 0 ? a.combinedCY / a.combinedPY : a.ret;
    return (
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
            {a.hasSiblings&&<span style={{fontSize:8,color:T.cyan,background:"rgba(34,211,238,.08)",border:`1px solid rgba(34,211,238,.2)`,borderRadius:4,padding:"1px 5px",fontWeight:700}}>+{a.siblingCount} dealer{a.siblingCount>1?"s":""}</span>}
          </div>
          <div style={{fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.name}</div>
          <div style={{fontSize:10,color:T.t3,marginTop:2}}>{a.city}, {a.st} · {isAccelTier(a.gTier||a.tier)?<span style={{color:T.amber}}>{normalizeTier(a.gTier||a.tier)}</span>:"Private"}</div>
        </div>
        <div style={{textAlign:"right",flexShrink:0,marginLeft:12}}>
          <div className="m" style={{fontSize:12,fontWeight:700,color:dispGap>0?T.red:T.green}}>{dispGap>0?`-${$$(dispGap)}`:$$(Math.abs(dispGap))}</div>
          <div className="m" style={{fontSize:10,color:T.t4}}>{pc(dispRet)} ret{a.hasSiblings&&<span style={{color:T.cyan}}> all</span>}</div>
        </div>
        <Chev/>
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
        {a.reasons.slice(0,4).map((r,j)=><span key={j} style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:9,color:T.t2,background:"rgba(255,255,255,.06)",borderRadius:4,padding:"2px 7px",border:"1px solid rgba(255,255,255,.14)",fontWeight:500}}>{r.label}<span style={{color:T.amber,fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>+{r.pts}</span></span>)}
      </div>
    </button>
  );};



  const SectionHeader = ({label, color, count, pulse=false}) => (
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,marginTop:4}}>
      <div style={{width:7,height:7,borderRadius:"50%",background:color,flexShrink:0,animation:pulse?"pulse 2s infinite":"none"}}/>
      <span style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1.2px",color}}>{label}</span>
      {count!=null&&<span style={{fontSize:10,color:T.t4,marginLeft:"auto"}}>{count}</span>}
    </div>
  );

  return <div style={{padding:"16px 16px 80px"}}>

    {/* ── SEARCH BAR ── */}
    <div style={{position:"relative",marginBottom:16}}>
      <svg style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",width:15,height:15,color:T.t4}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      <input type="search" value={search} onChange={e=>setSearch(e.target.value)}
        placeholder="Search by office name or city…"
        style={{width:"100%",height:42,borderRadius:12,border:`1px solid ${search?T.blue+"44":T.b1}`,background:T.s1,color:T.t1,fontSize:13,paddingLeft:38,paddingRight:search?36:12,outline:"none",fontFamily:"inherit"}}/>
      {search&&<button onClick={()=>setSearch("")} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:T.t4,cursor:"pointer",fontSize:16,lineHeight:1}}>✕</button>}
    </div>

    {/* ── SEARCH RESULTS ── */}
    {q ? <>
      <div style={{fontSize:10,color:T.t4,marginBottom:10}}>{searchResults.length} result{searchResults.length!==1?"s":""} for "{search}"</div>
      {searchResults.length===0&&<div style={{padding:"24px 0",textAlign:"center",color:T.t4,fontSize:12}}>No accounts found.</div>}
      {searchResults.map((a,i)=>{
        const py=a.pyQ?.["1"]||0; const cy=a.cyQ?.["1"]||0; const gap=py-cy;
        const ret=py>0?cy/py:0;
        return <button key={a.id} className="anim" onClick={()=>goAcct(a)}
          style={{animationDelay:`${i*15}ms`,width:"100%",textAlign:"left",background:T.s1,
            border:`1px solid ${T.b1}`,borderRadius:14,padding:"12px 14px",marginBottom:8,cursor:"pointer"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.name}</div>
              <div style={{fontSize:10,color:T.t3,marginTop:2}}>
                {a.addr ? a.addr + ', ' : ''}{a.city}, {a.st}
                {a.gName&&a.gName!==a.name&&<span style={{color:T.t4}}> · {a.gName}</span>}
                {isAccelTier(a.gTier||a.tier)&&<span style={{color:T.amber}}> · {normalizeTier(a.gTier||a.tier)}</span>}
              </div>
            </div>
            <div style={{textAlign:"right",flexShrink:0,marginLeft:12}}>
              <div className="m" style={{fontSize:12,fontWeight:700,color:gap>0?T.red:gap<0?T.green:T.t4}}>{gap>0?`-${$$(gap)}`:gap<0?`+${$$(-gap)}`:"Even"}</div>
              <div className="m" style={{fontSize:10,color:T.t4}}>{Math.round(ret*100)}% ret</div>
            </div>
            <Chev/>
          </div>
          <div style={{display:"flex",gap:12,alignItems:"center"}}>
            <Pill l="PY" v={$$(py)} c={T.t2}/>
            <Pill l="CY" v={$$(cy)} c={T.blue}/>
            {a.score>0&&<span className="m" style={{fontSize:9,fontWeight:700,color:a.score>=50?T.red:T.amber,background:a.score>=50?"rgba(248,113,113,.08)":"rgba(251,191,36,.08)",borderRadius:4,padding:"2px 6px"}}>{a.score}pt</span>}
          </div>
        </button>;
      })}
    </> :

    /* ── NORMAL TODAY CONTENT ── */
    <>
    {/* ── SCOPE SELECTOR + PROGRESS CARD ── */}
    <div className="anim" style={{background:`linear-gradient(135deg,${T.s1},rgba(79,142,247,.06))`,border:`1px solid ${T.b1}`,borderRadius:16,padding:16,marginBottom:16,boxShadow:"0 4px 24px rgba(0,0,0,.4)"}}>

      {/* Scope pills */}
      <div style={{display:"flex",gap:5,marginBottom:14}}>
        {(["1","2","3","4","FY"] as const).map(s => {
          const isActive = scope === s;
          const label = s === "FY" ? "FY" : `Q${s}`;
          return <button key={s} onClick={()=>setAndSaveScope(s)}
            style={{flex:1,padding:"5px 0",borderRadius:8,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
              border:`1px solid ${isActive?"rgba(79,142,247,.4)":T.b2}`,
              background:isActive?"rgba(79,142,247,.18)":T.s2,
              color:isActive?T.blue:T.t3,
              transition:"all 0.15s"}}>{label}</button>;
        })}
      </div>

      {scope === "1" ? <>
        {/* ── Q1 view: target attainment (existing logic) ── */}
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
      </> : (() => {
        /* ── Non-Q1 view: PY vs CY comparison ── */
        const sPY = scopeTotals.py;
        const sCY = scopeTotals.cy;
        const sGap = sPY - sCY;
        const sRet = sPY > 0 ? sCY / sPY : 0;
        const sAhead = sCY >= sPY;
        const sColor = sAhead ? T.green : sRet >= 0.85 ? T.amber : T.red;
        const sLabel = scope === "FY"
          ? (sAhead ? "Ahead of PY" : `${Math.round(sRet*100)}% of PY pace`)
          : (sAhead ? `Q${scope} Ahead` : `Q${scope} Behind`);
        const scopeTitle = scope === "FY" ? "Full Year — CY vs PY" : `Q${scope} — CY vs PY`;
        return <>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <span style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1.2px",color:T.t3}}>{scopeTitle}</span>
            <span style={{fontSize:10,fontWeight:700,color:sColor,background:sAhead?"rgba(52,211,153,.08)":"rgba(248,113,113,.08)",border:`1px solid ${sAhead?"rgba(52,211,153,.2)":"rgba(248,113,113,.2)"}`,borderRadius:999,padding:"2px 10px"}}>{sLabel}</span>
          </div>
          <div style={{display:"flex",alignItems:"baseline",gap:12,marginBottom:8}}>
            <span className="m" style={{fontSize:30,fontWeight:800,color:sColor}}>{Math.round(sRet*100)}%</span>
            <span style={{fontSize:12,color:T.t3}}>of prior year</span>
          </div>
          <Bar pct={Math.min(sRet*100,100)} color={`linear-gradient(90deg,${sColor},${sAhead?T.cyan:T.red})`}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:10}}>
            <div style={{borderRadius:8,background:T.s2,border:`1px solid ${T.b1}`,padding:10}}>
              <div style={{fontSize:9,color:T.t3}}>Prior Year</div>
              <div className="m" style={{fontSize:14,fontWeight:700,color:T.t2}}>{$$(sPY)}</div>
            </div>
            <div style={{borderRadius:8,background:T.s2,border:`1px solid ${T.b1}`,padding:10}}>
              <div style={{fontSize:9,color:T.t3}}>Current Year</div>
              <div className="m" style={{fontSize:14,fontWeight:700,color:T.blue}}>{$$(sCY)}</div>
            </div>
            <div style={{borderRadius:8,background:sAhead?"rgba(52,211,153,.06)":"rgba(248,113,113,.06)",border:`1px solid ${sAhead?"rgba(52,211,153,.12)":"rgba(248,113,113,.12)"}`,padding:10}}>
              <div style={{fontSize:9,color:T.t3}}>{sAhead?"Ahead":"Gap"}</div>
              <div className="m" style={{fontSize:14,fontWeight:700,color:sColor}}>{sAhead?"+":"-"}{$$(Math.abs(sGap))}</div>
            </div>
          </div>
          {scope === "FY" && sPY > 0 && <div style={{marginTop:10,padding:"6px 10px",borderRadius:8,background:"rgba(79,142,247,.06)",border:"1px solid rgba(79,142,247,.12)",fontSize:10,color:T.t3}}>
            Accounts below show YTD gaps vs prior year — action list reflects full-year performance
          </div>}
        </>;
      })()}
    </div>

    {/* ── OVERDRIVE — Q1 only ── */}
    {scope === "1" && overdrive&&DAYS_LEFT>0&&q1Gap>0&&<div className="anim" style={{marginBottom:16}}>
      {/* Overdrive toggle header */}
      <button onClick={toggleOd} style={{
        width:"100%", textAlign:"left", cursor:"pointer", fontFamily:"inherit",
        background: odOpen
          ? `linear-gradient(135deg,rgba(251,191,36,.12),rgba(251,191,36,.04))`
          : T.s1,
        border: `1px solid ${odOpen ? "rgba(251,191,36,.35)" : T.b2}`,
        borderRadius: odOpen ? "14px 14px 0 0" : 14,
        padding:"12px 14px",
        transition:"all 0.2s",
        marginBottom: odOpen ? 0 : 0,
      }}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:7}}>
            <span style={{fontSize:16, filter: odOpen ? "none" : "grayscale(1)", opacity: odOpen ? 1 : 0.4}}>⚡</span>
            <span style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",
              color: odOpen ? T.amber : T.t4,
              transition:"color 0.2s",
            }}>Overdrive</span>
            <span style={{fontSize:9,color: odOpen ? T.amber : T.t4,
              background: odOpen ? "rgba(251,191,36,.1)" : T.s2,
              borderRadius:999,padding:"2px 8px",
              transition:"all 0.2s",
            }}>{overdrive.modeLabel} · {DAYS_LEFT}d · {overdrive.totalTargets} targets</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {overdrive.doneTotal>0&&<span style={{fontSize:10,fontWeight:700,color:T.green}}>+{$f(overdrive.doneTotal)}</span>}
            <span style={{fontSize:12,color: odOpen ? T.amber : T.t4,
              transform: odOpen ? "rotate(0deg)" : "rotate(-90deg)",
              transition:"transform 0.2s, color 0.2s",
              display:"inline-block",
            }}>▼</span>
          </div>
        </div>
        {!odOpen&&<div style={{fontSize:10,color:T.t4,marginTop:3}}>
          Tap to activate your end-of-quarter game plan
        </div>}
      </button>

      {/* Overdrive content — only shown when open */}
      {odOpen&&<div style={{
        background:`linear-gradient(180deg,rgba(251,191,36,.04) 0%,transparent 60%)`,
        border:"1px solid rgba(251,191,36,.2)",
        borderTop:"none",
        borderRadius:"0 0 14px 14px",
        padding:"12px 14px 14px",
      }}>

      {/* Projected landing */}
      <div style={{background:`linear-gradient(135deg,${T.s1},rgba(251,191,36,.05))`,border:"1px solid rgba(251,191,36,.15)",borderRadius:14,padding:12,marginBottom:10}}>
        <div style={{fontSize:9,textTransform:"uppercase",color:T.t4,letterSpacing:"1px",marginBottom:8}}>Projected Q1 Landing from Overdrive</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
          {[
            {label:"Conservative",val:q1CY+overdrive.conservative,color:T.amber},
            {label:"Base",val:q1CY+overdrive.base,color:T.blue},
            {label:"Best Case",val:q1CY+overdrive.aggressive,color:T.green},
          ].map(s=>(
            <div key={s.label} style={{borderRadius:8,background:T.s2,padding:"8px 6px",textAlign:"center"}}>
              <div style={{fontSize:9,color:T.t3,marginBottom:3}}>{s.label}</div>
              <div className="m" style={{fontSize:11,fontWeight:800,color:s.val>=Q1_TARGET?T.green:s.color}}>{$$(s.val)}</div>
              <div style={{fontSize:8,color:s.val>=Q1_TARGET?T.green:T.t4,marginTop:1}}>{s.val>=Q1_TARGET?"✓ hits target":`${$$(Q1_TARGET-s.val)} short`}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Visit Today */}
      {overdrive.visitList.length>0&&<div style={{marginBottom:10}}>
        <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.cyan,marginBottom:6,display:"flex",alignItems:"center",gap:5}}>
          <span>🚗</span> Visit Today — {overdrive.visitList.length} stops
        </div>
        {overdrive.visitList.map((a,i)=>{
          const done = odDone[a.id];
          return <div key={a.id} className="anim" style={{animationDelay:`${i*20}ms`,marginBottom:6}}>
            <button onClick={()=>goAcct(a)} style={{width:"100%",textAlign:"left",background:done?"rgba(52,211,153,.06)":T.s1,
              border:`1px solid ${done?"rgba(52,211,153,.2)":"rgba(34,211,238,.15)"}`,borderRadius:12,padding:"10px 12px",cursor:"pointer",
              display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
                  textDecoration:done?"line-through":"none",color:done?T.t3:T.t1}}>{a.name}</div>
                <div style={{fontSize:10,color:T.t3,marginTop:1}}>{a.city}, {a.st} · Ask <span style={{color:T.amber,fontWeight:700}}>{$f(a.ask)}</span> · {Math.round(a.prob*100)}% likely</div>
              {a.clusterCount>=2&&<div style={{display:"flex",alignItems:"center",gap:8,marginTop:4}}>
                <div style={{fontSize:9,color:T.cyan}}>📍 {a.clusterCount} other accounts nearby</div>
                <button onClick={e=>{e.stopPropagation();setTripAnchor(a);}} style={{background:"rgba(34,211,238,.1)",border:"1px solid rgba(34,211,238,.25)",borderRadius:6,padding:"2px 8px",fontSize:9,fontWeight:700,color:T.cyan,cursor:"pointer",fontFamily:"inherit"}}>Plan Trip →</button>
              </div>}
              {a.signals?.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:3,marginTop:4}}>
                {a.signals.slice(0,4).map((s:string,si:number)=>(
                  <span key={si} style={{fontSize:9,color:T.t2,background:"rgba(255,255,255,.06)",borderRadius:4,padding:"2px 7px",border:"1px solid rgba(255,255,255,.14)",fontWeight:500}}>{s}</span>
                ))}
              </div>}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0,marginLeft:8}}>
                {done
                  ? <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:1}}>
                      <span style={{fontSize:10,fontWeight:700,color:done.outcome==="lost"?T.red:T.green}}>{done.outcome==="lost"?"✗ Lost":`${$f(done.amt)} ✓`}</span>
                      {done.note&&<span style={{fontSize:9,color:T.t3,maxWidth:90,textAlign:"right",lineHeight:1.3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{done.note}</span>}
                    </div>
                  : <div style={{display:"flex",gap:4}}>
                      <button onClick={e=>promptOutcome(e,a.id,"won",a.ask)} style={{background:"rgba(52,211,153,.12)",border:"1px solid rgba(52,211,153,.25)",borderRadius:6,padding:"3px 8px",fontSize:9,fontWeight:700,color:T.green,cursor:"pointer",fontFamily:"inherit"}}>✓ Win</button>
                      <button onClick={e=>promptOutcome(e,a.id,"partial",a.ask*0.5)} style={{background:"rgba(251,191,36,.08)",border:"1px solid rgba(251,191,36,.2)",borderRadius:6,padding:"3px 8px",fontSize:9,fontWeight:700,color:T.amber,cursor:"pointer",fontFamily:"inherit"}}>½</button>
                      <button onClick={e=>promptOutcome(e,a.id,"lost",0)} style={{background:"rgba(248,113,113,.08)",border:"1px solid rgba(248,113,113,.2)",borderRadius:6,padding:"3px 8px",fontSize:9,fontWeight:700,color:T.red,cursor:"pointer",fontFamily:"inherit"}}>✗</button>
                    </div>
                }
                {done&&<button onClick={e=>{e.stopPropagation();clearDone(a.id);}} style={{background:"none",border:"none",color:T.t4,cursor:"pointer",fontSize:12}}>↩</button>}
              </div>
            </button>
          </div>;
        })}
      </div>}

      {/* Call List */}
      {overdrive.callList.length>0&&<div style={{marginBottom:10}}>
        <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.purple,marginBottom:6,display:"flex",alignItems:"center",gap:5}}>
          <span>📞</span> Call List — {overdrive.callList.length} accounts
        </div>
        {overdrive.callList.map((a,i)=>{
          const done = odDone[a.id];
          const isDark = a.track === "dark";
          return <button key={a.id} className="anim" onClick={()=>goAcct(a)}
            style={{animationDelay:`${i*15}ms`,width:"100%",textAlign:"left",background:done?"rgba(52,211,153,.04)":T.s1,
              border:`1px solid ${done?"rgba(52,211,153,.15)":isDark?"rgba(248,113,113,.15)":"rgba(167,139,250,.15)"}`,
              borderRadius:12,padding:"9px 12px",marginBottom:5,cursor:"pointer",
              display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
                textDecoration:done?"line-through":"none",color:done?T.t3:T.t1}}>{a.name}</div>
              <div style={{fontSize:10,color:T.t3,marginTop:1}}>
                {isDark
                  ? <span style={{color:T.red}}>⚠ Gone dark — </span>
                  : <span style={{color:T.purple}}>Partial buyer — </span>
                }
                <span style={{color:T.amber,fontWeight:700}}>{$f(a.ask)}</span> ask · {Math.round(a.prob*100)}% likely
              </div>
              {a.signals?.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:3,marginTop:4}}>
                {a.signals.slice(0,4).map((s:string,si:number)=>(
                  <span key={si} style={{fontSize:9,color:T.t2,background:"rgba(255,255,255,.06)",borderRadius:4,padding:"2px 7px",border:"1px solid rgba(255,255,255,.14)",fontWeight:500}}>{s}</span>
                ))}
              </div>}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:5,flexShrink:0,marginLeft:8}}>
              {done
                ? <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:1}}>
                    <span style={{fontSize:10,fontWeight:700,color:done.outcome==="lost"?T.red:T.green}}>{done.outcome==="lost"?"✗ Lost":`${$f(done.amt)} ✓`}</span>
                    {done.note&&<span style={{fontSize:9,color:T.t3,maxWidth:90,textAlign:"right",lineHeight:1.3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{done.note}</span>}
                  </div>
                : <>
                    <button onClick={e=>promptOutcome(e,a.id,"won",a.ask)} style={{background:"rgba(52,211,153,.12)",border:"1px solid rgba(52,211,153,.25)",borderRadius:6,padding:"3px 8px",fontSize:9,fontWeight:700,color:T.green,cursor:"pointer",fontFamily:"inherit"}}>✓</button>
                    <button onClick={e=>promptOutcome(e,a.id,"lost",0)} style={{background:"rgba(248,113,113,.08)",border:"1px solid rgba(248,113,113,.2)",borderRadius:6,padding:"3px 8px",fontSize:9,fontWeight:700,color:T.red,cursor:"pointer",fontFamily:"inherit"}}>✗</button>
                  </>
              }
              {done&&<button onClick={e=>{e.stopPropagation();clearDone(a.id);}} style={{background:"none",border:"none",color:T.t4,cursor:"pointer",fontSize:12}}>↩</button>}
              <Chev/>
            </div>
          </button>;
        })}
      </div>}

      {/* Dealer Actions */}
      {overdrive.dealerActions.length>0&&<div>
        <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.blue,marginBottom:6,display:"flex",alignItems:"center",gap:5}}>
          <span>🤝</span> Dealer Push
        </div>
        {overdrive.dealerActions.map((d,i)=>(
          <div key={d.dealer} className="anim" style={{animationDelay:`${i*20}ms`,background:T.s1,
            border:"1px solid rgba(79,142,247,.15)",borderRadius:12,padding:"10px 12px",marginBottom:6}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
              <span style={{fontSize:11,fontWeight:700,color:T.blue}}>{d.dealer}</span>
              <span style={{fontSize:10,color:T.amber,fontWeight:700}}>{$f(d.totalAsk)} potential</span>
            </div>
            <div style={{fontSize:10,color:T.t3}}>Ask your {d.dealer} DSM to push reorder on:</div>
            {d.accts.map(a=><div key={a.id} style={{fontSize:10,color:T.t2,marginTop:3,paddingLeft:8}}>· {a.name} ({a.city}) — {$f(a.ask)}</div>)}
          </div>
        ))}
      </div>}
      </div>}  {/* close odOpen content */}
    </div>}  {/* close overdrive outer */}

    {/* ── TRIP PLANNER MODAL ── */}
    {tripAnchor&&(()=>{
      const anchor = tripAnchor;
      const nearby = anchor.nearbyAccounts || [];
      const allStops = [anchor, ...nearby].filter(Boolean);
      const totalAsk = allStops.reduce((s:number,a:any)=>s+(a.ask||0),0);
      const totalExpected = allStops.reduce((s:number,a:any)=>s+(a.ask||0)*(a.prob||0),0);

      // Build Google Maps multi-stop route from Thomaston
      const buildRoute = () => {
        const stops = allStops
          .map((a:any) => {
            const b = BADGER[a.id] || BADGER[a.gId];
            if (b?.address) return b.address;
            if (a.addr) return a.addr;
            return `${a.name}, ${a.city}, ${a.st}`;
          });
        const origin = encodeURIComponent("Thomaston, CT");
        const dest = encodeURIComponent(stops[stops.length-1]);
        const waypoints = stops.slice(0,-1).map((s:string)=>encodeURIComponent(s)).join("|");
        const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}${waypoints?`&waypoints=${waypoints}`:""}&travelmode=driving`;
        window.open(url,"_blank");
      };

      return <div style={{position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,.75)",backdropFilter:"blur(8px)",display:"flex",flexDirection:"column",justifyContent:"flex-end"}} onClick={()=>setTripAnchor(null)}>
        <div style={{background:T.s1,borderRadius:"20px 20px 0 0",padding:20,maxHeight:"80vh",display:"flex",flexDirection:"column"}} onClick={e=>e.stopPropagation()}>
          {/* Header */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
            <div>
              <div style={{fontSize:13,fontWeight:700}}>Trip Plan</div>
              <div style={{fontSize:10,color:T.t3,marginTop:1}}>{allStops.length} stops · {$f(totalAsk)} ask · {$f(totalExpected)} expected</div>
            </div>
            <button onClick={()=>setTripAnchor(null)} style={{background:"none",border:"none",color:T.t4,cursor:"pointer",fontSize:18}}>✕</button>
          </div>

          {/* Route button */}
          <button onClick={buildRoute} style={{width:"100%",background:`linear-gradient(90deg,${T.blue},${T.cyan})`,border:"none",borderRadius:10,padding:"10px 0",fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer",fontFamily:"inherit",marginBottom:14,marginTop:8}}>
            🗺 Open Full Route in Google Maps
          </button>

          {/* Stop list */}
          <div style={{overflowY:"auto",flex:1}}>
            {allStops.map((a:any,i:number)=>{
              const done = odDone[a.id];
              const isAnchor = i===0;
              return <div key={a.id} style={{background:isAnchor?`rgba(251,191,36,.06)`:T.s2,
                border:`1px solid ${isAnchor?"rgba(251,191,36,.25)":T.b1}`,
                borderRadius:12,padding:"10px 12px",marginBottom:8,
              }}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                      <span style={{fontSize:9,fontWeight:700,color:isAnchor?T.amber:T.t4,background:isAnchor?"rgba(251,191,36,.1)":T.s1,borderRadius:4,padding:"1px 5px"}}>{isAnchor?"ANCHOR":`STOP ${i+1}`}</span>
                      {done&&<span style={{fontSize:9,fontWeight:700,color:done.outcome==="lost"?T.red:T.green}}>{done.outcome==="lost"?"✗ Lost":`✓ ${done.outcome}`}</span>}
                    </div>
                    <div style={{fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.name}</div>
                    <div style={{fontSize:10,color:T.t3,marginTop:1}}>{a.city}, {a.st} · {Math.round(a.miles||0)}mi from home</div>
                    <div style={{fontSize:10,color:T.t3,marginTop:1}}>Ask <span style={{color:T.amber,fontWeight:600}}>{$f(a.ask)}</span> · {Math.round((a.prob||0)*100)}% likely</div>
                    {done?.note&&<div style={{fontSize:9,color:T.t4,marginTop:3,fontStyle:"italic"}}>"{done.note}"</div>}
                  </div>
                  <div style={{display:"flex",gap:4,flexShrink:0,marginLeft:8}}>
                    {done
                      ? <button onClick={()=>clearDone(a.id)} style={{background:"none",border:"none",color:T.t4,cursor:"pointer",fontSize:12}}>↩</button>
                      : <>
                          <button onClick={e=>promptOutcome(e,a.id,"won",a.ask)} style={{background:"rgba(52,211,153,.12)",border:"1px solid rgba(52,211,153,.25)",borderRadius:6,padding:"4px 8px",fontSize:9,fontWeight:700,color:T.green,cursor:"pointer",fontFamily:"inherit"}}>✓ Win</button>
                          <button onClick={e=>promptOutcome(e,a.id,"partial",a.ask*0.5)} style={{background:"rgba(251,191,36,.08)",border:"1px solid rgba(251,191,36,.2)",borderRadius:6,padding:"4px 8px",fontSize:9,fontWeight:700,color:T.amber,cursor:"pointer",fontFamily:"inherit"}}>½</button>
                          <button onClick={e=>promptOutcome(e,a.id,"lost",0)} style={{background:"rgba(248,113,113,.08)",border:"1px solid rgba(248,113,113,.2)",borderRadius:6,padding:"4px 8px",fontSize:9,fontWeight:700,color:T.red,cursor:"pointer",fontFamily:"inherit"}}>✗</button>
                        </>
                    }
                  </div>
                </div>
              </div>;
            })}
          </div>
        </div>
      </div>;
    })()}

    {/* ── OUTCOME NOTE MODAL ── */}
    {odNotePrompt&&<div style={{position:"fixed",inset:0,zIndex:210,background:"rgba(0,0,0,.72)",backdropFilter:"blur(8px)",display:"flex",alignItems:"flex-end"}} onClick={commitOutcome}>
      <div style={{width:"100%",background:T.s1,borderRadius:"20px 20px 0 0",padding:20}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
          <div style={{fontSize:13,fontWeight:700,color:odNotePrompt.outcome==="won"?T.green:odNotePrompt.outcome==="partial"?T.amber:T.red}}>
            {odNotePrompt.outcome==="won"?"✓ Win — add a note?":odNotePrompt.outcome==="partial"?"½ Partial — add a note?":"✗ Lost — what happened?"}
          </div>
          <span style={{fontSize:10,color:T.t4,fontWeight:600}}>{odNotePrompt.outcome!=="lost"?`+${$f(odNotePrompt.amt)} credited`:""}</span>
        </div>
        <div style={{fontSize:11,color:T.t3,marginBottom:10}}>Optional · tap outside or press Enter to skip</div>
        <input autoFocus type="text" value={odNoteText} onChange={e=>setOdNoteText(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&commitOutcome()}
          placeholder={odNotePrompt.outcome==="won"?"e.g. Dr. committed to SonicFill 3 trial, reorder in 2 wks":odNotePrompt.outcome==="partial"?"e.g. Ordered MaxCem, passed on composites":"e.g. On contract through Q3, revisit then"}
          style={{width:"100%",height:44,borderRadius:10,border:`1px solid ${T.b1}`,background:T.s2,color:T.t1,fontSize:13,padding:"0 12px",outline:"none",fontFamily:"inherit",marginBottom:12,boxSizing:"border-box"}}/>
        <button onClick={commitOutcome} style={{width:"100%",background:odNotePrompt.outcome==="won"?`linear-gradient(90deg,${T.green},${T.cyan})`:odNotePrompt.outcome==="partial"?`linear-gradient(90deg,${T.amber},rgba(251,191,36,.7))`:`linear-gradient(90deg,${T.red},rgba(248,113,113,.7))`,border:"none",borderRadius:10,padding:"11px 0",fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer",fontFamily:"inherit"}}>
          {odNoteText.trim()?"Save Note & Log →":"Log Without Note →"}
        </button>
      </div>
    </div>}

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
          return <button key={a.id} className="anim" onClick={()=>goAcct(a)}
            style={{animationDelay:`${i*20}ms`,display:"flex",alignItems:"center",justifyContent:"space-between",
              width:"100%",textAlign:"left",padding:"9px 12px",marginBottom:6,borderRadius:10,background:T.s2,
              border:"1px solid rgba(52,211,153,.15)",cursor:"pointer"}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.name}</div>
              <div style={{fontSize:10,color:T.t3}}>{a.city}, {a.st}</div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0,marginLeft:12}}>
              <div style={{textAlign:"right"}}>
                <div className="m" style={{fontSize:12,fontWeight:700,color:T.green}}>+{$$(cy-py)}</div>
                <div style={{fontSize:9,color:T.green}}>+{lift.toFixed(0)}% vs PY</div>
              </div>
              <Chev/>
            </div>
          </button>;
        })}
      </>}
      {healthyAccel.length>0&&<>
        <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.t4,marginTop:growing.length>0?10:0,marginBottom:6}}>Healthy Accelerate Accounts</div>
        {healthyAccel.map((a,i)=>{
          const tier=normalizeTier(a.gTier||a.tier);
          return <button key={a.id} className="anim" onClick={()=>goAcct(a)}
            style={{animationDelay:`${i*20}ms`,display:"flex",alignItems:"center",justifyContent:"space-between",
              width:"100%",textAlign:"left",padding:"9px 12px",marginBottom:6,borderRadius:10,background:T.s2,
              border:"1px solid rgba(251,191,36,.15)",cursor:"pointer"}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.name}</div>
              <div style={{fontSize:10,color:T.t3}}>{a.city}, {a.st} · <span style={{color:T.amber}}>{tier}</span></div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0,marginLeft:12}}>
              <div style={{textAlign:"right"}}>
                <div className="m" style={{fontSize:12,fontWeight:700,color:T.blue}}>{$$(a.cyQ?.["1"]||0)}</div>
                <div style={{fontSize:9,color:T.green}}>{pc(a.ret)} ret</div>
              </div>
              <Chev/>
            </div>
          </button>;
        })}
      </>}
    </div>

    {/* ── SECTION 3: GROUP-FIRST ACTION LIST ── */}
    <div>
      {hotGroups.length>0&&<>
        <SectionHeader label="Hot" color={T.red} count={`${hotGroups.length} group${hotGroups.length>1?"s":""}`} pulse={true}/>
        <div style={{fontSize:10,color:T.t4,marginBottom:10}}>{scope==="FY"?"Down vs prior year · highest gap":"Highest urgency · Act this week"}</div>
        <div>
          {hotGroups.map((g:any,i:number)=><GroupActionCard key={g.gId} g={g} i={i} isHot={true} goAcct={goAcct} goGroup={goGroup} groups={groups}/>)}
        </div>
      </>}
      {followGroups.length>0&&<>
        <div style={{marginTop:hotGroups.length>0?4:0}}>
          <SectionHeader label="Follow Up" color={T.amber} count={`${followGroups.length} group${followGroups.length>1?"s":""}`}/>
          <div style={{fontSize:10,color:T.t4,marginBottom:10}}>{scope==="FY"?"Moderate YTD gap vs prior year":"Worth a call this week"}</div>
          <div>
            {followGroups.map((g:any,i:number)=><GroupActionCard key={g.gId} g={g} i={i} isHot={false} goAcct={goAcct} goGroup={goGroup} groups={groups}/>)}
          </div>
        </div>
      </>}
      {hotGroups.length===0&&followGroups.length===0&&(
        <div style={{padding:"24px 0",textAlign:"center",color:T.t4,fontSize:12}}>No scored accounts — upload a CSV to get started.</div>
      )}

      {/* ── GROUP WATCH: healthy-group children individually underperforming ── */}
      {groupWatch.length>0&&<div style={{marginTop:16}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
          <span style={{fontSize:12,fontWeight:700,color:T.blue,letterSpacing:.5,textTransform:"uppercase"}}>Group Watch</span>
          <span style={{fontSize:10,color:T.t4,background:T.s2,borderRadius:10,padding:"1px 7px"}}>{groupWatch.length}</span>
        </div>
        <div style={{fontSize:10,color:T.t4,marginBottom:10,lineHeight:1.5}}>
          Individually down · parent group on track · may reflect bulk buying · lower priority unless a nearby sibling is over-performing
        </div>
        {groupWatch.map((a:any,i:number)=>{
          const badger = BADGER[a.id]||BADGER[a.gId]||null;
          const gh = groupHealthMap[a.gId];
          const grpRet = gh && gh.totalPY>0 ? Math.round(gh.totalCY/gh.totalPY*100) : null;
          return (
            <div key={a.id} className="anim" style={{animationDelay:`${i*30}ms`,background:T.s1,border:`1px solid rgba(79,142,247,.15)`,borderRadius:14,padding:"12px 14px",marginBottom:8,cursor:"pointer"}}
              onClick={()=>goAcct(a)}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:700,color:T.t1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{a.name}</div>
                  <div style={{fontSize:10,color:T.t3,marginTop:1}}>{a.gName&&a.gName!==a.name?`${a.gName} · `:""}{ a.city||""}{a.dealer?<span style={{color:T.t4}}> · {a.dealer}</span>:""}</div>
                </div>
                <div style={{textAlign:"right",flexShrink:0,marginLeft:10}}>
                  <div style={{fontSize:13,fontWeight:700,color:T.amber}} className="m">−${Math.round(a.gap).toLocaleString()}</div>
                  <div style={{fontSize:10,color:T.t4}} className="m">{Math.round(a.ret*100)}% ret</div>
                </div>
              </div>
              {grpRet!==null&&<div style={{fontSize:10,color:T.t4,background:T.s2,borderRadius:6,padding:"3px 8px",display:"inline-flex",alignItems:"center",gap:4}}>
                <span style={{color:"rgba(52,211,153,.8)"}}>●</span>&nbsp;Group {grpRet}% · ${Math.round(gh!.totalCY).toLocaleString()} CY vs ${Math.round(gh!.totalPY).toLocaleString()} PY
              </div>}
              {badger?.feel&&<div style={{marginTop:6,fontSize:10,color:T.t3}}>Feel: {badger.feel}</div>}
            </div>
          );
        })}
      </div>}
    </div>
    </>}
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
          <div style={{fontSize:10,color:T.t3,marginTop:2}}>{g._locs} loc{g._locs>1?"s":""} · {getTierLabel(g.tier,g.class2)}{isDealerFilt?<span style={{color:T.cyan}}> · {filt}</span>:""}</div>
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
function GroupDetail({group,goMain,goAcct,overlays,saveOverlays}) {
  const [q,setQ]=useState("1");
  const qk=q;
  const py=group.pyQ?.[qk]||0;const cy=group.cyQ?.[qk]||0;
  const gap=py-cy;const ret=py>0?Math.round(cy/py*100):0;

  // ── FSC (distributor rep) management at group level ──────────────
  const fscKey = (dist:string) => `groupFSC:${group.id}:${dist}`;
  const loadFSC = (dist:string) => {
    try { return JSON.parse(localStorage.getItem(fscKey(dist))||"null"); } catch { return null; }
  };
  const saveFSC = (dist:string, data:any) => {
    try { localStorage.setItem(fscKey(dist), JSON.stringify(data)); } catch {}
    // Persist to overlays durably
    if (saveOverlays) {
      const groupFSC = { ...(OVERLAYS_REF.fscReps?.[group.id] || {}), [dist]: data };
      const next = { ...OVERLAYS_REF, fscReps: { ...(OVERLAYS_REF.fscReps||{}), [group.id]: groupFSC } };
      saveOverlays(next);
    }
  };
  const removeFSC = (dist:string) => {
    try { localStorage.removeItem(fscKey(dist)); } catch {}
    // Remove from overlays durably
    if (saveOverlays) {
      const groupFSC = { ...(OVERLAYS_REF.fscReps?.[group.id] || {}) };
      delete groupFSC[dist];
      const next = { ...OVERLAYS_REF, fscReps: { ...(OVERLAYS_REF.fscReps||{}), [group.id]: groupFSC } };
      saveOverlays(next);
    }
  };

  // Detect which distributors are present in this group's children
  const groupDists = useMemo(()=>{
    const distDedupeSet = new Set();
    (group.children||[]).forEach((c:any) => { if(c.dealer && c.dealer!=="Unknown") distDedupeSet.add(c.dealer); });
    return [...distDedupeSet].sort();
  },[group]);

  // Build FSC map: dist → {name, phone, notes, source:"badger"|"manual"}
  const [fscMap, setFscMap] = useState<Record<string,any>>(()=>{
    const m:Record<string,any> = {};
    groupDists.forEach(d => {
      // Priority 1: overlays.fscReps (durable — survives cache clear)
      const fromOverlay = overlays?.fscReps?.[group.id]?.[d];
      if (fromOverlay) { m[d] = {...fromOverlay, source:"overlay"}; return; }
      // Priority 2: localStorage (fast cache for recent saves)
      const manual = loadFSC(d);
      if(manual) { m[d] = {...manual, source:"manual"}; return; }
      // Priority 3: Badger Maps data
      const child = (group.children||[]).find((c:any) => c.dealer===d && BADGER[c.id]?.dealerRep);
      if(child) { m[d] = {name: BADGER[child.id].dealerRep, source:"badger"}; }
    });
    return m;
  });

  const [selProduct, setSelProduct] = useState<string|null>(null);
  const [editDist, setEditDist] = useState<string|null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const openEdit = (dist:string) => {
    const existing = fscMap[dist];
    setEditName(existing?.name||"");
    setEditPhone(existing?.phone||"");
    setEditNotes(existing?.notes||"");
    setEditDist(dist);
  };
  const saveEdit = () => {
    if(!editDist) return;
    const data = {name:editName.trim(), phone:editPhone.trim(), notes:editNotes.trim()};
    saveFSC(editDist, data);
    setFscMap(prev=>({...prev, [editDist]:{...data, source:"manual"}}));
    setEditDist(null);
  };
  const deleteRep = (dist:string) => {
    removeFSC(dist);
    setFscMap(prev=>{ const n={...prev}; delete n[dist]; return n; });
  };

  // Roll up products across all children
  const {groupBuying, groupStopped} = useMemo(()=>{
    const prodMap: Record<string,{py:number,cy:number,locsPY:string[],locsCY:string[],locsDown:string[]}> = {};
    (group.children||[]).forEach((c:any)=>{
      (c.products||[]).forEach((p:any)=>{
        const pPy = p[`py${qk}`]||0;
        const pCy = p[`cy${qk}`]||0;
        if(Math.abs(pPy)<10 && Math.abs(pCy)<10) return;
        if(!prodMap[p.n]) prodMap[p.n]={py:0,cy:0,locsPY:[],locsCY:[],locsDown:[]};
        prodMap[p.n].py += pPy;
        prodMap[p.n].cy += pCy;
        if(pPy>50) prodMap[p.n].locsPY.push(c.name);
        if(pCy>0) prodMap[p.n].locsCY.push(c.name);
        if(pPy>50 && pCy===0) prodMap[p.n].locsDown.push(c.name);
      });
    });
    const allProds = Object.entries(prodMap).map(([name,v])=>({name,...v}));
    const groupBuying = allProds.filter(p=>p.cy>0).sort((a,b)=>b.cy-a.cy);
    const groupStopped = allProds.filter(p=>p.py>100&&p.cy===0).sort((a,b)=>b.py-a.py);
    return {groupBuying, groupStopped};
  },[group,qk]);

  const hasProducts = groupBuying.length>0 || groupStopped.length>0;

  // ── Path 2: Product drill → which child accounts are up/down on this product ──
  if (selProduct) {
    const allProds = [...groupBuying, ...groupStopped];
    const prod = allProds.find(p => p.name === selProduct);
    const childBreakdown = (group.children||[]).map((c:any) => {
      const p = (c.products||[]).find((pr:any) => pr.n === selProduct);
      return { ...c, prodPY: p?(p[`py${qk}`]||0):0, prodCY: p?(p[`cy${qk}`]||0):0 };
    }).filter((c:any) => c.prodPY > 0 || c.prodCY > 0)
      .sort((a:any,b:any) => (b.prodPY-b.prodCY)-(a.prodPY-a.prodCY));

    return <div style={{paddingBottom:80}}>
      <div style={{position:"sticky",top:52,zIndex:40,background:"rgba(10,10,15,.9)",backdropFilter:"blur(20px)",borderBottom:`1px solid ${T.b3}`,padding:"10px 16px"}}>
        <button onClick={()=>setSelProduct(null)} style={{background:"none",border:"none",color:T.blue,cursor:"pointer",display:"flex",alignItems:"center",gap:4,fontSize:13,fontWeight:600,fontFamily:"inherit"}}><Back/> {fixGroupName(group)}</button>
      </div>
      <div style={{padding:"16px 16px 0"}}>
        <div className="anim" style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:16,padding:16,marginBottom:16}}>
          <div style={{fontSize:15,fontWeight:700,marginBottom:4}}>{selProduct}</div>
          <div style={{fontSize:11,color:T.t3,marginBottom:12}}>{fixGroupName(group)} · all locations</div>
          {prod&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8}}>
            <Stat l="PY" v={$$(prod.py)} c={T.t2}/>
            <Stat l="CY" v={$$(prod.cy)} c={T.blue}/>
            <Stat l="Gap" v={(prod.py-prod.cy)<=0?`+${$$(Math.abs(prod.py-prod.cy))}`:$$(prod.py-prod.cy)} c={(prod.py-prod.cy)<=0?T.green:T.red}/>
            <Stat l="Locs" v={`${prod.locsCY.length}/${prod.locsPY.length}`} c={T.t3}/>
          </div>}
        </div>
        <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.t3,marginBottom:8}}>By Location</div>
        {childBreakdown.length===0&&<div style={{fontSize:12,color:T.t4,textAlign:"center",padding:"20px 0"}}>No location data for this product.</div>}
        {childBreakdown.map((c:any,i:number)=>{
          const gap=c.prodPY-c.prodCY;
          const isStopped=c.prodPY>0&&c.prodCY===0;
          const isNew=c.prodPY===0&&c.prodCY>0;
          return <button key={c.id} className="anim" onClick={()=>goAcct(c)}
            style={{animationDelay:`${i*25}ms`,width:"100%",textAlign:"left",background:T.s1,
              border:`1px solid ${isStopped?"rgba(248,113,113,.2)":gap>0?"rgba(251,191,36,.15)":T.b1}`,
              borderRadius:12,padding:"11px 13px",marginBottom:7,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginBottom:2}}>{c.name}</div>
              <div style={{fontSize:10,color:T.t3}}>{c.city}, {c.st}{c.dealer?<span style={{color:T.cyan}}> · {c.dealer}</span>:""}</div>
              {isStopped&&<div style={{fontSize:9,color:T.red,marginTop:2,fontWeight:600}}>STOPPED · was {$$(c.prodPY)}</div>}
              {isNew&&<div style={{fontSize:9,color:T.green,marginTop:2,fontWeight:600}}>NEW BUYER</div>}
            </div>
            <div style={{textAlign:"right",flexShrink:0,marginLeft:10}}>
              <div style={{fontSize:11,fontWeight:700,color:isStopped?T.red:T.blue,fontFamily:"monospace"}}>{$$(c.prodCY)}</div>
              {c.prodPY>0&&<div style={{fontSize:9,color:gap>0?T.red:T.green,fontFamily:"monospace"}}>{gap>0?"-":"+"}${Math.round(Math.abs(gap))}</div>}
            </div>
          </button>;
        })}
      </div>
    </div>;
  }

  return <div style={{paddingBottom:80}}>
    <div style={{position:"sticky",top:52,zIndex:40,background:"rgba(10,10,15,.9)",backdropFilter:"blur(20px)",borderBottom:`1px solid ${T.b3}`,padding:"10px 16px"}}>
      <button onClick={goMain} style={{background:"none",border:"none",color:T.blue,cursor:"pointer",display:"flex",alignItems:"center",gap:4,fontSize:13,fontWeight:600,fontFamily:"inherit"}}><Back/> Groups</button>
    </div>
    <div style={{padding:"16px 16px 0"}}>
      <div className="anim" style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:16,padding:16,marginBottom:16}}>
        <div style={{fontSize:16,fontWeight:700,marginBottom:4}}>{fixGroupName(group)}</div>
        <div style={{fontSize:11,color:T.t3,marginBottom:12}}>{group.locs} locations · {getTierLabel(group.tier,group.class2)}</div>
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

      {/* FSC / DISTRIBUTOR REPS */}
      {groupDists.length>0&&<div className="anim" style={{animationDelay:"20ms",background:T.s1,border:`1px solid ${T.b1}`,borderRadius:16,padding:16,marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.cyan}}>FSC Contacts</div>
          <div style={{fontSize:9,color:T.t4}}>Applies to all locations in this group</div>
        </div>
        {groupDists.map(dist=>{
          const fsc = fscMap[dist];
          const distColor = dist==="Schein"?"rgba(79,142,247,1)":dist==="Patterson"?"rgba(168,85,247,1)":dist==="Benco"?"rgba(34,211,153,1)":dist==="Darby"?"rgba(251,146,60,1)":"rgba(148,163,184,1)";
          const childCount = (group.children||[]).filter((c:any)=>c.dealer===dist).length;
          return <div key={dist} style={{marginBottom:8,padding:"10px 12px",borderRadius:10,background:T.s2,border:`1px solid ${T.b2}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,flex:1,minWidth:0}}>
                <span style={{fontSize:10,fontWeight:700,color:distColor,background:`${distColor}18`,borderRadius:5,padding:"2px 7px",flexShrink:0}}>{dist}</span>
                <span style={{fontSize:9,color:T.t4,flexShrink:0}}>{childCount} loc{childCount!==1?"s":""}</span>
                {fsc
                  ? <div style={{flex:1,minWidth:0}}>
                      <span style={{fontSize:12,fontWeight:600,color:T.t1,display:"block",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{fsc.name}</span>
                      {fsc.phone&&<a href={`tel:${fsc.phone.replace(/\D/g,"")}`} style={{fontSize:10,color:T.cyan,textDecoration:"none"}}>{fsc.phone}</a>}
                      {fsc.source==="badger"&&!fsc.phone&&<span style={{fontSize:9,color:T.t4,fontStyle:"italic"}}> from Badger</span>}
                    </div>
                  : <span style={{fontSize:11,color:T.t4,fontStyle:"italic"}}>No FSC assigned</span>
                }
              </div>
              <div style={{display:"flex",gap:6,flexShrink:0,marginLeft:8}}>
                {fsc?.phone&&<a href={`tel:${fsc.phone.replace(/\D/g,"")}`} style={{background:"rgba(34,211,153,.1)",border:"1px solid rgba(34,211,153,.2)",borderRadius:6,padding:"3px 8px",fontSize:10,fontWeight:600,color:T.green,textDecoration:"none",display:"flex",alignItems:"center"}}>Call</a>}
                <button onClick={()=>openEdit(dist)} style={{background:"rgba(79,142,247,.08)",border:"1px solid rgba(79,142,247,.15)",borderRadius:6,padding:"3px 8px",fontSize:10,fontWeight:600,color:T.blue,cursor:"pointer",fontFamily:"inherit"}}>{fsc?"Edit":"+ Add"}</button>
                {fsc?.source==="manual"&&<button onClick={()=>deleteRep(dist)} style={{background:"none",border:"none",color:T.t4,cursor:"pointer",fontSize:11,padding:"2px 4px"}}>✕</button>}
              </div>
            </div>
            {fsc?.notes&&<div style={{marginTop:6,fontSize:10,color:T.t3,fontStyle:"italic",lineHeight:1.4}}>{fsc.notes}</div>}
          </div>;
        })}
        {/* Edit modal */}
        {editDist&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={e=>{if(e.target===e.currentTarget)setEditDist(null)}}>
          <div style={{background:T.s1,borderRadius:"20px 20px 0 0",padding:24,width:"100%",maxWidth:480,paddingBottom:40}}>
            <div style={{fontSize:13,fontWeight:700,marginBottom:16}}>FSC for {editDist}</div>
            <div style={{marginBottom:10}}>
              <div style={{fontSize:10,color:T.t3,marginBottom:4,fontWeight:600}}>Name *</div>
              <input value={editName} onChange={e=>setEditName(e.target.value)} placeholder="Rep name" style={{width:"100%",background:T.s2,border:`1px solid ${T.b1}`,borderRadius:8,padding:"8px 10px",fontSize:13,color:T.t1,fontFamily:"inherit"}}/>
            </div>
            <div style={{marginBottom:10}}>
              <div style={{fontSize:10,color:T.t3,marginBottom:4,fontWeight:600}}>Phone</div>
              <input value={editPhone} onChange={e=>setEditPhone(e.target.value)} placeholder="(xxx) xxx-xxxx" type="tel" style={{width:"100%",background:T.s2,border:`1px solid ${T.b1}`,borderRadius:8,padding:"8px 10px",fontSize:13,color:T.t1,fontFamily:"inherit"}}/>
            </div>
            <div style={{marginBottom:16}}>
              <div style={{fontSize:10,color:T.t3,marginBottom:4,fontWeight:600}}>Notes</div>
              <textarea value={editNotes} onChange={e=>setEditNotes(e.target.value)} placeholder="Relationship notes, schedule, anything useful..." rows={3} style={{width:"100%",background:T.s2,border:`1px solid ${T.b1}`,borderRadius:8,padding:"8px 10px",fontSize:12,color:T.t1,fontFamily:"inherit",resize:"none"}}/>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setEditDist(null)} style={{flex:1,padding:"10px 0",borderRadius:10,fontSize:13,fontWeight:600,cursor:"pointer",border:`1px solid ${T.b1}`,background:T.s2,color:T.t3,fontFamily:"inherit"}}>Cancel</button>
              <button onClick={saveEdit} disabled={!editName.trim()} style={{flex:2,padding:"10px 0",borderRadius:10,fontSize:13,fontWeight:700,cursor:editName.trim()?"pointer":"not-allowed",border:"none",background:editName.trim()?T.blue:"rgba(79,142,247,.3)",color:"#fff",fontFamily:"inherit"}}>Save FSC</button>
            </div>
          </div>
        </div>}
      </div>}

      {/* GROUP PRODUCT ROLLUP */}
      {hasProducts&&<div className="anim" style={{animationDelay:"40ms",background:T.s1,border:`1px solid ${T.b1}`,borderRadius:16,padding:16,marginBottom:16}}>
        <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.blue,marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span>Group Product Health</span>
          <span style={{fontSize:9,color:T.t4,fontWeight:400,textTransform:"none",letterSpacing:0}}>Tap product to see by location</span>
        </div>

        {/* Stopped across group */}
        {groupStopped.length>0&&<div style={{marginBottom:groupBuying.length>0?14:0}}>
          <div style={{fontSize:10,fontWeight:700,color:T.red,marginBottom:8}}>Stopped Buying ({groupStopped.length} products)</div>
          {groupStopped.map((p,i)=>(
            <div key={i} onClick={()=>setSelProduct(p.name)} style={{marginBottom:10,padding:"8px 10px",borderRadius:8,background:"rgba(248,113,113,.04)",border:"1px solid rgba(248,113,113,.08)",cursor:"pointer"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:p.locsDown.length>0?4:0}}>
                <span style={{fontSize:12,fontWeight:600,color:T.t1}}>{p.name}</span>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span className="m" style={{fontSize:10,color:T.red,flexShrink:0}}>Was {$$(p.py)} → $0</span>
                  <Chev/>
                </div>
              </div>
              {p.locsDown.length>0&&<div style={{fontSize:9,color:T.t4,lineHeight:1.5}}>
                {p.locsDown.slice(0,3).map(l=>l.split(' ').slice(0,2).join(' ')).join(' · ')}
                {p.locsDown.length>3&&<span> +{p.locsDown.length-3} more</span>}
              </div>}
            </div>
          ))}
        </div>}

        {/* Buying across group */}
        {groupBuying.length>0&&<div>
          <div style={{fontSize:10,fontWeight:700,color:T.green,marginBottom:8}}>Currently Buying ({groupBuying.length} products)</div>
          {groupBuying.slice(0,8).map((p,i)=>{
            const mx=groupBuying[0]?.cy||1;
            const trend=p.py>0?p.cy/p.py:1;
            return <div key={i} onClick={()=>setSelProduct(p.name)} style={{marginBottom:8,cursor:"pointer"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                <span style={{fontSize:11,color:T.t2,flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>
                <div style={{display:"flex",gap:8,flexShrink:0,marginLeft:8,alignItems:"center"}}>
                  <span className="m" style={{fontSize:9,color:T.t3}}>{$$(p.py)}</span>
                  <span style={{fontSize:9,color:T.t3}}>→</span>
                  <span className="m" style={{fontSize:10,color:trend>=0.8?T.blue:T.amber,fontWeight:600}}>{$$(p.cy)}</span>
                  <Chev/>
                </div>
              </div>
              <div style={{height:4,borderRadius:2,background:T.s3,overflow:"hidden"}}>
                <div className="bar-g" style={{animationDelay:`${i*40}ms`,height:"100%",borderRadius:2,width:`${Math.min(p.cy/mx*100,100)}%`,background:trend>=0.8?`linear-gradient(90deg,${T.blue},${T.cyan})`:T.amber}}/>
              </div>
              {p.locsDown.length>0&&<div style={{fontSize:9,color:T.amber,marginTop:2}}>
                ⚠ {p.locsDown.slice(0,2).map(l=>l.split(' ').slice(0,2).join(' ')).join(', ')} stopped
              </div>}
            </div>;
          })}
        </div>}
      </div>}

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
function AcctDetail({acct,goBack,adjs,setAdjs,groups,goGroup,overlays,saveOverlays}) {
  const [q,setQ]=useState("1");
  const [showForm,setShowForm]=useState(false);
  const [toast,setToast]=useState(null);
  const [aiState,setAiState]=useState("idle");
  const [aiText,setAiText]=useState("");
  const [drState,setDrState]=useState("idle");
  const [drIntel,setDrIntel]=useState<any>(null);
  const [savedContacts,setSavedContacts]=useState<any>(null);
  const [showMoveModal,setShowMoveModal]=useState(false);
  const [moveSearch,setMoveSearch]=useState("");
  const [groupOverride,setGroupOverride]=useState<any>(null);
  const [actLog,setActLog]=useState<any[]>([]);
  const [actType,setActType]=useState("visit");
  const [actContact,setActContact]=useState("");
  const [actNotes,setActNotes]=useState("");
  const [actFollowUp,setActFollowUp]=useState("");
  const [showActForm,setShowActForm]=useState(false);
  const storageKey = `contact:${acct.id}`;
  const overrideKey = `group-override:${acct.id}`;
  const actLogKey = `actlog:${acct.id}`;

  // Load saved contacts + group override + activity log from storage on mount
  useEffect(() => {
    // Load contact: overlays is durable source, localStorage is fast cache fallback
    try {
      const fromOverlay = overlays?.contacts?.[acct.id];
      if (fromOverlay) {
        setSavedContacts(fromOverlay);
      } else {
        const v = localStorage.getItem(storageKey);
        if (v) setSavedContacts(JSON.parse(v));
      }
    } catch {}
    // Load group move: overlays.groupMoves is durable, localStorage is fallback
    try {
      const fromOverlay = overlays?.groupMoves?.[acct.id];
      if (fromOverlay) {
        setGroupOverride(fromOverlay);
      } else {
        const v = localStorage.getItem(overrideKey);
        if (v) setGroupOverride(JSON.parse(v));
      }
    } catch {}
    // Load activity log: merge overlays (durable) with localStorage (recent unsynced)
    try {
      const fromOverlay: any[] = overlays?.activityLogs?.[acct.id] || [];
      const fromLocal: any[] = (() => { try { return JSON.parse(localStorage.getItem(actLogKey)||"[]"); } catch { return []; } })();
      const overlayIds = new Set(fromOverlay.map((e:any) => e.id));
      const merged = [...fromOverlay, ...fromLocal.filter((e:any) => !overlayIds.has(e.id))];
      merged.sort((a:any,b:any) => b.id - a.id);
      if (merged.length > 0) setActLog(merged);
    } catch {}
  }, [acct.id]);

  // Group search for move modal
  const moveResults = useMemo(() => {
    if (!moveSearch.trim()) return [];
    const q = moveSearch.trim().toLowerCase();
    return (groups||[]).filter(g =>
      g.id !== acct.gId &&
      (g.name?.toLowerCase().includes(q) ||
       fixGroupName(g).toLowerCase().includes(q))
    ).slice(0, 8);
  }, [moveSearch, groups, acct.gId]);

  const applyGroupOverride = (targetGroup) => {
    const override = {
      childId: acct.id,
      childName: acct.name,
      targetGroupId: targetGroup.id,
      targetGroupName: fixGroupName(targetGroup),
      savedAt: new Date().toISOString(),
    };
    try { localStorage.setItem(overrideKey, JSON.stringify(override)); } catch {}
    setGroupOverride(override);
    setShowMoveModal(false);
    setMoveSearch("");
    setToast({msg:`Moved to ${fixGroupName(targetGroup)}`, color:T.green});
    setTimeout(()=>setToast(null), 3000);
    // Persist to overlays durably
    if (saveOverlays) {
      const next = { ...OVERLAYS_REF, groupMoves: { ...(OVERLAYS_REF.groupMoves||{}), [acct.id]: override } };
      saveOverlays(next);
    }
  };

  const myAdj=adjs.filter(m=>m.acctId===acct.id);
  const adjTotal=myAdj.reduce((s,m)=>s+m.credited,0);
  const acctTier=acct.tier||acct.gTier||"Standard";
  const tierRate=getTierRate(acctTier);
  const isAccel=isAccelTier(acctTier);
  const acctType=getTierLabel(acctTier);
  const qk=q;

  // Parent group + siblings
  // Parent group — uses override group if set, otherwise natural group from data
  const parentGroup=useMemo(()=>{
    const overrideGroupId = groupOverride?.targetGroupId;
    if (overrideGroupId) return (groups||[]).find(g=>g.id===overrideGroupId) || null;
    return acct.gId ? (groups||[]).find(g=>g.id===acct.gId) : null;
  },[groups,acct.gId,groupOverride]);
  const siblings=useMemo(()=>parentGroup?( parentGroup.children?.filter(c=>c.id!==acct.id)||[]).sort((a,b)=>((b.pyQ?.["1"]||0)-(b.cyQ?.["1"]||0))-((a.pyQ?.["1"]||0)-(a.cyQ?.["1"]||0))):[]  ,[parentGroup,acct.id]);

  // Badger Maps intel — keyed by Master-CM id
  const badger = useMemo(()=> BADGER[acct.id] || BADGER[acct.gId] || null, [acct.id, acct.gId]);

  const pyVal=acct.pyQ?.[qk]||0;
  const cyBase=acct.cyQ?.[qk]||0;
  const cyVal=qk==="1"?cyBase+adjTotal:cyBase;
  const gap=pyVal-cyVal;
  const ret=pyVal>0?cyVal/pyVal:0;

  const products=acct.products||[];
  const buying=products.filter(p=>(p[`cy${qk}`]||0)>0).sort((a,b)=>(b[`cy${qk}`]||0)-(a[`cy${qk}`]||0));
  const stopped=products.filter(p=>(p[`py${qk}`]||0)>100&&(p[`cy${qk}`]||0)===0);
  const allProdNames=products.map(p=>p.n);
  // Smart cross-sell: category-aware suggestions based on what they're NOT buying
  // Each entry: [matchKeyword, suggestLabel, pitch]
  const XSELL_OPPS = [
    // Composite — newest options by practice profile
    { kw:"HARMONIZE",    label:"Harmonize",            pitch:"Premium aesthetic composite — ideal for high-cosmetic practices. Nano-optimized filler, exceptional polish." },
    { kw:"SIMPLISHADE",  label:"SimpliShade",          pitch:"Simplified shade system for larger practices — fewer shades, faster workflow, less chair time." },
    { kw:"SONICFILL",    label:"SonicFill 3",          pitch:"Sonic-activated bulk-fill composite — one shade, posterior-focused, huge time saver." },
    // Cement
    { kw:"MAXCEM",       label:"MaxCem Elite Chroma",  pitch:"Self-adhesive resin cement with color-change indicator — no more guessing cleanup. Upgrade from plain MaxCem." },
    // Bond — newest
    { kw:"OPTIBOND 360", label:"OptiBond Universal 360", pitch:"Newest universal bond — 360° etching pattern, works self-etch or total-etch, broadest clinical coverage." },
    // Pedo
    { kw:"NEXUS",        label:"Nexus RMGI",           pitch:"RMGI for pediatric — strong fluoride release, moisture tolerant, ideal for pedo practices." },
    // Curing light — newest
    { kw:"DEMI",         label:"Demi Pro",             pitch:"Newest curing light — just launched, upgraded from Demi Plus. Broader spectrum, faster cure times." },
  ];
  const xsell = XSELL_OPPS.filter(o => !allProdNames.some(n => n.toUpperCase().includes(o.kw)));

  const runAI = async () => {
    setAiState("loading"); setAiText("");
    const payload = {
      name: acct.name, city: acct.city, state: acct.st,
      tier: acctType, dealer: acct.dealer||"Unknown",
      group: acct.gName||"None", lastOrderDays: acct.last,
      Q1_PY: pyVal, Q1_CY: cyVal, gap, retentionPct: Math.round(ret*100),
      buying: buying.slice(0,6).map(p=>({name:p.n, py:p[`py1`]||0, cy:p[`cy1`]||0})),
      stopped: stopped.slice(0,5).map(p=>({name:p.n, py:p[`py1`]||0})),
      crossSellOpportunities: xsell.map(o=>o.label),
      groupLocations: (parentGroup?.locs||1),
      fieldIntel: badger ? {
        doctor: badger.doctor||null,
        orders: badger.orders||null,
        dealerRep: badger.dealerRep||null,
        feel: badger.feel||null,
        notes: badger.notes||null,
        lastVisit: badger.lastVisit||null,
        visitNotes: badger.visitNotes||null,
      } : null,
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

  const runDeepResearch = async () => {
    setDrState("loading"); setDrIntel(null);
    try {
      const res = await fetch("/api/deep-research", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          name: acct.name,
          city: acct.city,
          state: acct.st,
          address: acct.addr || badger?.address || "",
          dealer: acct.dealer||"Unknown",
          products: buying.slice(0,5).map(p=>p.n),
          doctor: badger?.doctor || "",
          gName: acct.gName || "",
          acctId: acct.id,
          ownership: badger?.ownership || null,
          gap: Math.round(gap),
          retentionPct: Math.round(ret*100),
          Q1_PY: Math.round(pyVal),
          Q1_CY: Math.round(cyVal),
          buying: buying.slice(0,6).map(p=>({name:p.n,cy:Math.round(p["cy1"]||0),py:Math.round(p["py1"]||0)})),
          stopped: stopped.slice(0,5).map(p=>({name:p.n,py:Math.round(p["py1"]||0)})),
          xsell: xsell.slice(0,3).map(o=>({label:o.label,pitch:o.pitch})),
          tier: acctType,
        })
      });
      const data = await res.json();
      if (data?.intel) {
        setDrIntel(data.intel);
        setDrState("done");
        // Save contact info to persistent storage (localStorage + auto-committed to patches.json by API)
        const contacts = {
          contactName: data.intel.contacts?.[0]?.name || data.intel.contactName || null,
          phone: data.intel.contacts?.[0]?.phone || data.intel.phone || null,
          email: data.intel.contacts?.[0]?.email || data.intel.email || null,
          website: data.intel.website || null,
          contacts: data.intel.contacts || [],
          savedAt: new Date().toISOString(),
          practiceName: acct.name,
        };
        const hasContact = contacts.contactName || contacts.phone || contacts.email || contacts.website || contacts.contacts.length > 0;
        if (hasContact) {
          try { localStorage.setItem(storageKey, JSON.stringify(contacts)); } catch {}
          setSavedContacts(contacts);
          // Persist to overlays durably
          if (saveOverlays) {
            const next = { ...OVERLAYS_REF, contacts: { ...(OVERLAYS_REF.contacts||{}), [acct.id]: contacts } };
            saveOverlays(next);
          }
        }
      } else {
        setDrState("error");
        setDrIntel({error: data?.error || "Research failed. Try again."});
      }
    } catch(e) {
      setDrState("error");
      setDrIntel({error:"Connection error. Check network and try again."});
    }
  };

  return <div style={{paddingBottom:80}}>
    <div style={{position:"sticky",top:52,zIndex:40,background:"rgba(10,10,15,.9)",backdropFilter:"blur(20px)",borderBottom:`1px solid ${T.b3}`,padding:"10px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <button onClick={goBack} style={{background:"none",border:"none",color:T.blue,cursor:"pointer",display:"flex",alignItems:"center",gap:4,fontSize:13,fontWeight:600,fontFamily:"inherit"}}><Back/> Back</button>
      <div style={{display:"flex",gap:6}}>
        <button onClick={()=>drState==="idle"||drState==="error"?runDeepResearch():setDrState("idle")} style={{background:drState==="done"?"rgba(34,211,238,.12)":"rgba(34,211,238,.06)",border:`1px solid ${drState==="done"?"rgba(34,211,238,.35)":"rgba(34,211,238,.18)"}`,borderRadius:8,padding:"5px 10px",fontSize:11,fontWeight:700,color:T.cyan,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:4}}>
          {drState==="loading"?<><span style={{animation:"pulse 1s infinite"}}>●</span> Searching...</>:"🔍 Research"}
        </button>
        <button onClick={()=>aiState==="idle"||aiState==="error"?runAI():setAiState("idle")} style={{background:aiState==="done"?"rgba(167,139,250,.12)":"rgba(167,139,250,.08)",border:`1px solid ${aiState==="done"?"rgba(167,139,250,.3)":"rgba(167,139,250,.18)"}`,borderRadius:8,padding:"5px 10px",fontSize:11,fontWeight:700,color:T.purple,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:5}}>
          {aiState==="loading"?<><span style={{animation:"pulse 1s infinite"}}>●</span> Thinking...</>:"✦ Briefing"}
        </button>
      </div>
    </div>
    <div style={{padding:"16px 16px 0"}}>
      {toast&&<div className="anim" style={{background:"rgba(52,211,153,.12)",border:"1px solid rgba(52,211,153,.25)",borderRadius:12,padding:"12px 16px",marginBottom:12,display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:16,color:T.green,fontWeight:700}}>+</span>
        <div><div style={{fontSize:13,fontWeight:700,color:T.green}}>Sale recorded!</div><div style={{fontSize:11,color:T.t3}}>+{$f(toast)} credited → Q1 updated</div></div>
      </div>}

      {/* DEEP RESEARCH CARD */}
      {(drState==="loading"||drState==="done"||drState==="error")&&<div className="anim" style={{background:`linear-gradient(135deg,${T.s1},rgba(34,211,238,.05))`,border:`1px solid rgba(34,211,238,.25)`,borderRadius:16,padding:16,marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{display:"flex",alignItems:"center",gap:7}}>
            <span style={{fontSize:13}}>🔍</span>
            <span style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.cyan}}>Live Practice Intel</span>
          </div>
          <button onClick={()=>{setDrState("idle");setDrIntel(null);}} style={{background:"none",border:"none",color:T.t4,cursor:"pointer",fontSize:16,lineHeight:1}}>✕</button>
        </div>
        {drState==="loading"&&<div style={{display:"flex",flexDirection:"column",gap:8}}>
          {[90,70,80,50,85].map((w,i)=><div key={i} style={{height:10,borderRadius:5,background:T.s3,width:`${w}%`,animation:"pulse 1.5s infinite",animationDelay:`${i*200}ms`}}/>)}
          <div style={{fontSize:11,color:T.t4,marginTop:4}}>Searching the web for practice intel...</div>
        </div>}
        {drState==="error"&&<div style={{fontSize:12,color:T.red}}>{drIntel?.error||"Research failed."}</div>}
        {drState==="done"&&drIntel&&!drIntel.parseError&&<div>
          {/* Status */}
          {drIntel.statusNote&&<div style={{marginBottom:10,padding:"8px 10px",borderRadius:8,background:drIntel.status==="changed"?"rgba(248,113,113,.08)":drIntel.status==="closed"?"rgba(248,113,113,.12)":"rgba(52,211,153,.06)",border:`1px solid ${drIntel.status==="open"?"rgba(52,211,153,.15)":"rgba(248,113,113,.15)"}`}}>
            <div style={{fontSize:9,textTransform:"uppercase",color:T.t4,marginBottom:2}}>Practice Status</div>
            <div style={{fontSize:11,fontWeight:600,color:drIntel.status==="open"?T.green:drIntel.status==="closed"?T.red:T.amber}}>{drIntel.statusNote}</div>
          </div>}
          {/* Contact info */}
          {(drIntel.phone||drIntel.email||drIntel.contactName||drIntel.website)&&<div style={{marginBottom:10,display:"flex",flexWrap:"wrap",gap:8}}>
            {drIntel.contactName&&<div><div style={{fontSize:9,color:T.t3,textTransform:"uppercase",marginBottom:1}}>Contact</div><div style={{fontSize:11,fontWeight:600}}>{drIntel.contactName}</div></div>}
            {drIntel.phone&&<div><div style={{fontSize:9,color:T.t3,textTransform:"uppercase",marginBottom:1}}>Phone</div><a href={`tel:${drIntel.phone}`} style={{fontSize:11,fontWeight:600,color:T.cyan,textDecoration:"none"}}>{drIntel.phone}</a></div>}
            {drIntel.email&&<div><div style={{fontSize:9,color:T.t3,textTransform:"uppercase",marginBottom:1}}>Email</div><div style={{fontSize:11,fontWeight:600,color:T.cyan}}>{drIntel.email}</div></div>}
            {drIntel.website&&<div><div style={{fontSize:9,color:T.t3,textTransform:"uppercase",marginBottom:1}}>Website</div><a href={drIntel.website} target="_blank" rel="noreferrer" style={{fontSize:11,fontWeight:600,color:T.blue,textDecoration:"none"}}>Visit →</a></div>}
          </div>}
          {/* Ownership */}
          {drIntel.ownershipNote&&<div style={{marginBottom:10}}>
            <div style={{fontSize:9,color:T.t3,textTransform:"uppercase",marginBottom:3}}>Ownership</div>
            <div style={{fontSize:11,color:T.t2}}>{drIntel.ownershipNote}</div>
          </div>}
          {/* Hooks */}
          {drIntel.hooks?.length>0&&<div style={{marginBottom:10}}>
            <div style={{fontSize:9,color:T.t3,textTransform:"uppercase",marginBottom:6}}>Relationship Hooks</div>
            {drIntel.hooks.map((h,i)=><div key={i} style={{display:"flex",gap:6,alignItems:"flex-start",marginBottom:5}}>
              <span style={{color:T.amber,marginTop:1,fontSize:10}}>◆</span>
              <span style={{fontSize:11,color:T.t2,lineHeight:1.5}}>{h}</span>
            </div>)}
          </div>}
          {/* Competitive */}
          {drIntel.competitive&&<div style={{marginBottom:10,padding:"8px 10px",borderRadius:8,background:"rgba(248,113,113,.05)",border:"1px solid rgba(248,113,113,.1)"}}>
            <div style={{fontSize:9,color:T.t3,textTransform:"uppercase",marginBottom:2}}>Competitive Signal</div>
            <div style={{fontSize:11,color:T.t2}}>{drIntel.competitive}</div>
          </div>}
          {/* Talking points */}
          {drIntel.talkingPoints?.length>0&&<div>
            <div style={{fontSize:9,color:T.t3,textTransform:"uppercase",marginBottom:6}}>Talking Points for Your Visit</div>
            {drIntel.talkingPoints.map((p,i)=><div key={i} style={{display:"flex",gap:6,alignItems:"flex-start",marginBottom:6,padding:"6px 8px",borderRadius:7,background:"rgba(79,142,247,.05)",border:"1px solid rgba(79,142,247,.1)"}}>
              <span style={{color:T.blue,fontWeight:700,fontSize:10,marginTop:1,flexShrink:0}}>{i+1}.</span>
              <span style={{fontSize:11,color:T.t1,lineHeight:1.5}}>{p}</span>
            </div>)}
          </div>}
          {drIntel.searchedAt&&<div style={{fontSize:9,color:T.t4,marginTop:8,textAlign:"right"}}>Researched {new Date(drIntel.searchedAt).toLocaleTimeString()}</div>}
        </div>}
        {drState==="done"&&drIntel?.parseError&&<div style={{fontSize:11,color:T.t2,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{drIntel.rawText}</div>}
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
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div style={{fontSize:16,fontWeight:700,flex:1,minWidth:0,paddingRight:8}}>{acct.name}</div>
          <button onClick={()=>setShowMoveModal(true)} style={{flexShrink:0,background:"rgba(79,142,247,.08)",border:"1px solid rgba(79,142,247,.18)",borderRadius:8,padding:"4px 9px",fontSize:10,fontWeight:600,color:T.blue,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>Move →</button>
        </div>
        <div style={{fontSize:11,color:T.t3,marginTop:2}}>{acct.city}, {acct.st} · <span style={{color:isAccel?T.amber:T.t3}}>{acctType}</span> · Last {acct.last}d ago</div>
        {groupOverride&&<div style={{marginTop:4,fontSize:10,color:T.amber,display:"flex",alignItems:"center",gap:4}}>
          <span>⚠ Overridden → {groupOverride.targetGroupName}</span>
          <button onClick={()=>{try { localStorage.removeItem(overrideKey); } catch {} setGroupOverride(null);}} style={{background:"none",border:"none",color:T.t4,cursor:"pointer",fontSize:11,padding:"0 2px"}}>✕</button>
        </div>}
        {(()=>{const h=getHealthStatus(ret,gap,cyVal,pyVal);return <div style={{display:"inline-flex",alignItems:"center",marginTop:6,fontSize:10,fontWeight:700,color:h.color,background:h.bg,border:`1px solid ${h.border}`,borderRadius:999,padding:"3px 10px",letterSpacing:".2px"}}>{h.label}</div>;})()}
        <div style={{fontSize:10,color:T.t4,marginTop:2,display:"flex",gap:8,flexWrap:"wrap"}}>
          {acct.gName&&<span>Group: {groupOverride?groupOverride.targetGroupName:acct.gName}</span>}
          {acct.dealer&&acct.dealer!=="Unknown"&&<span style={{color:T.cyan}}>Dealer: {acct.dealer}{acct.dealerFlag&&<span title="Dealer assignment flagged for review — rep data conflicts with Tableau export" style={{marginLeft:4,fontSize:9,color:T.amber,fontWeight:700,cursor:"help"}}>⚠?</span>}</span>}
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

      {/* MULTI-DEALER COMBINED VIEW */}
      {(()=>{
        const sibs:any[] = acct.addrSiblings || [];
        if(sibs.length === 0) return null;
        const [expanded, setExpanded] = useState(false);
        const combPY = acct.combinedPY ?? ((acct.pyQ?.["1"]||0) + sibs.reduce((s:number,x:any)=>s+(x.pyQ1||0),0));
        const combCY = acct.combinedCY ?? ((acct.cyQ?.["1"]||0) + sibs.reduce((s:number,x:any)=>s+(x.cyQ1||0),0));
        const combGap = combPY - combCY;
        const combRet = combPY > 0 ? Math.round(combCY/combPY*100) : 0;
        // Build dealer share rows — this account + siblings
        const allAccts = [
          {name: acct.name, dealer: acct.dealer||'Unknown', pyQ1: acct.pyQ?.["1"]||0, cyQ1: acct.cyQ?.["1"]||0, id: acct.id, isSelf: true},
          ...sibs.map((s:any) => ({...s, isSelf: false}))
        ].filter(a => (a.pyQ1||0) > 0 || (a.cyQ1||0) > 0)
         .sort((a,b) => (b.pyQ1||0) - (a.pyQ1||0));
        const isActuallyUp = combGap <= 0;
        return <div className="anim" style={{animationDelay:"30ms",background:"rgba(34,211,238,.04)",border:`1px solid rgba(34,211,238,.15)`,borderRadius:16,padding:14,marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:10,fontWeight:700,color:T.cyan,textTransform:"uppercase",letterSpacing:"1px"}}>All Distributors</span>
              <span style={{fontSize:9,color:T.cyan,background:"rgba(34,211,238,.1)",borderRadius:4,padding:"1px 5px",border:"1px solid rgba(34,211,238,.2)"}}>{sibs.length+1} dealers</span>
            </div>
            <button onClick={()=>setExpanded(!expanded)} style={{background:"none",border:"none",color:T.cyan,cursor:"pointer",fontSize:10,fontWeight:600,fontFamily:"inherit"}}>{expanded?"Hide":"Breakdown"}</button>
          </div>
          {/* Combined totals — the TRUE number */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:expanded?12:0}}>
            <Stat l="PY" v={$$(combPY)} c={T.t2}/>
            <Stat l="CY" v={$$(combCY)} c={T.blue}/>
            <Stat l="True Gap" v={combGap<=0?`+${$$(Math.abs(combGap))}`:$$(combGap)} c={isActuallyUp?T.green:T.red}/>
            <Stat l="Ret" v={combRet+"%"} c={combRet>30?T.green:combRet>15?T.amber:T.red}/>
          </div>
          {isActuallyUp&&<div style={{fontSize:10,color:T.green,marginBottom:expanded?10:0}}>✓ Account is net positive across all distributors</div>}
          {/* Dealer breakdown — expandable */}
          {expanded&&<div>
            <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.t4,marginBottom:8}}>Dealer Share</div>
            {allAccts.map((a,i)=>{
              const py = a.pyQ1||0; const cy = a.cyQ1||0;
              const pyPct = combPY > 0 ? Math.round(py/combPY*100) : 0;
              const cyPct = combCY > 0 ? Math.round(cy/combCY*100) : 0;
              const pctShift = cyPct - pyPct;
              const barW = Math.max(cyPct, pyPct);
              return <div key={a.id} style={{marginBottom:10,padding:"8px 10px",borderRadius:8,background:a.isSelf?"rgba(79,142,247,.06)":T.s2,border:`1px solid ${a.isSelf?"rgba(79,142,247,.15)":T.b2}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                  <div style={{flex:1,minWidth:0}}>
                    <span style={{fontSize:11,fontWeight:600,color:a.isSelf?T.blue:T.t1}}>{a.name}</span>
                    {a.isSelf&&<span style={{fontSize:8,color:T.blue,marginLeft:5}}>← this account</span>}
                    <div style={{fontSize:9,color:T.t4}}>{a.dealer}</div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0,marginLeft:8}}>
                    <div style={{fontSize:10,fontWeight:600,fontFamily:"'DM Mono',monospace",color:T.blue}}>{$$(cy)}</div>
                    <div style={{fontSize:9,color:T.t4,fontFamily:"'DM Mono',monospace"}}>{$$(py)} PY</div>
                  </div>
                </div>
                {/* Share bar */}
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <div style={{flex:1,height:4,borderRadius:2,background:T.s3,overflow:"hidden"}}>
                    <div style={{height:"100%",borderRadius:2,width:`${Math.min(cyPct,100)}%`,background:cyPct>=pyPct?`linear-gradient(90deg,${T.blue},${T.cyan})`:T.amber,transition:"width .4s ease"}}/>
                  </div>
                  <span style={{fontSize:9,color:T.t3,flexShrink:0,minWidth:50,textAlign:"right"}}>
                    <span style={{color:T.t2,fontWeight:600}}>{cyPct}%</span>
                    {pctShift !== 0 && <span style={{color:pctShift>0?T.green:T.red,marginLeft:3}}>{pctShift>0?"+":""}{pctShift}%</span>}
                    {" PY "+pyPct+"%"}
                  </span>
                </div>
              </div>;
            })}
          </div>}
        </div>;
      })()}

      {/* MOVE TO GROUP MODAL — outside account header card */}
      {showMoveModal&&<div style={{position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,.7)",backdropFilter:"blur(8px)",display:"flex",flexDirection:"column",justifyContent:"flex-end"}} onClick={()=>{setShowMoveModal(false);setMoveSearch("");}}>
        <div style={{background:T.s1,borderRadius:"20px 20px 0 0",padding:20,maxHeight:"70vh",display:"flex",flexDirection:"column"}} onClick={e=>e.stopPropagation()}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{fontSize:13,fontWeight:700}}>Move to Group</div>
            <button onClick={()=>{setShowMoveModal(false);setMoveSearch("");}} style={{background:"none",border:"none",color:T.t4,cursor:"pointer",fontSize:18}}>✕</button>
          </div>
          <div style={{fontSize:11,color:T.t3,marginBottom:12}}>Moving: <strong style={{color:T.t1}}>{acct.name}</strong></div>
          <input autoFocus type="search" value={moveSearch} onChange={e=>setMoveSearch(e.target.value)}
            placeholder="Search groups…"
            style={{width:"100%",height:40,borderRadius:10,border:`1px solid ${T.b1}`,background:T.s2,color:T.t1,fontSize:13,padding:"0 12px",outline:"none",fontFamily:"inherit",marginBottom:12}}/>
          <div style={{overflowY:"auto",flex:1}}>
            {moveSearch.trim()&&moveResults.length===0&&<div style={{padding:"20px 0",textAlign:"center",color:T.t4,fontSize:12}}>No groups found</div>}
            {moveResults.map(g=>(
              <button key={g.id} onClick={()=>applyGroupOverride(g)}
                style={{width:"100%",textAlign:"left",background:T.s2,border:`1px solid ${T.b1}`,borderRadius:12,padding:"10px 14px",marginBottom:8,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontSize:13,fontWeight:600}}>{fixGroupName(g)}</div>
                  <div style={{fontSize:10,color:T.t3,marginTop:2}}>{g.locs} location{g.locs!==1?"s":""} · {getTierLabel(g.tier,g.class2)}</div>
                </div>
                <Chev/>
              </button>
            ))}
            {!moveSearch.trim()&&<div style={{padding:"20px 0",textAlign:"center",color:T.t4,fontSize:12}}>Type a group name to search</div>}
          </div>
        </div>
      </div>}

      {/* BADGER INTEL CARD */}
      {badger&&(badger.doctor||badger.orders||badger.dealerRep||badger.notes||badger.visitNotes||badger.feel)&&<div className="anim" style={{animationDelay:"50ms",background:T.s1,border:`1px solid rgba(34,211,238,.15)`,borderRadius:16,padding:16,marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.cyan} strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.cyan}}>Field Intel</span>
          </div>
          {badger.feel&&<div style={{display:"flex",gap:2}}>{[1,2,3,4,5].map(i=><div key={i} style={{width:8,height:8,borderRadius:"50%",background:i<=parseFloat(badger.feel)?T.amber:"rgba(255,255,255,.1)"}}/>)}</div>}
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:badger.notes||badger.visitNotes?10:0}}>
          {badger.doctor&&<div style={{minWidth:0}}>
            <div style={{fontSize:9,textTransform:"uppercase",color:T.t3,marginBottom:1}}>Doctor</div>
            <div style={{fontSize:11,fontWeight:600,color:T.t1}}>{badger.doctor}</div>
          </div>}
          {badger.orders&&<div style={{minWidth:0}}>
            <div style={{fontSize:9,textTransform:"uppercase",color:T.t3,marginBottom:1}}>Orders</div>
            <div style={{fontSize:11,fontWeight:600,color:T.t1}}>{badger.orders}</div>
          </div>}
          {badger.dealerRep&&<div style={{minWidth:0}}>
            <div style={{fontSize:9,textTransform:"uppercase",color:T.t3,marginBottom:1}}>Dealer Rep</div>
            <div style={{fontSize:11,fontWeight:600,color:T.cyan}}>{badger.dealerRep}</div>
          </div>}
          {badger.accelLevel&&<div style={{minWidth:0}}>
            <div style={{fontSize:9,textTransform:"uppercase",color:T.t3,marginBottom:1}}>Accel Level</div>
            <div style={{fontSize:11,fontWeight:600,color:T.amber}}>{badger.accelLevel}</div>
          </div>}
        </div>
        {badger.notes&&<div style={{fontSize:11,color:T.t2,lineHeight:1.5,background:T.s2,borderRadius:8,padding:"8px 10px",marginBottom:badger.visitNotes?8:0,whiteSpace:"pre-wrap"}}>{badger.notes.replace(/\\n/g,'\n')}</div>}
        {badger.visitNotes&&<div>
          <div style={{fontSize:9,textTransform:"uppercase",color:T.t3,marginBottom:3}}>Last Visit{badger.lastVisit?` · ${badger.lastVisit}`:""}</div>
          <div style={{fontSize:11,color:T.t3,lineHeight:1.5,fontStyle:"italic"}}>"{badger.visitNotes}"</div>
        </div>}
        {badger.phone&&<div style={{marginTop:10}}>
          <a href={`tel:${badger.phone}`} style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:10,color:T.cyan,textDecoration:"none",background:"rgba(34,211,238,.06)",border:"1px solid rgba(34,211,238,.12)",borderRadius:8,padding:"4px 10px"}}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.5 19.79 19.79 0 0 1 1.58 4.92 2 2 0 0 1 3.55 2.73h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10a16 16 0 0 0 6 6l.87-.87a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 17.5z"/></svg>
            {badger.phone}
          </a>
        </div>}
        {/* Saved Research Contacts — with hierarchy */}
        {savedContacts&&(savedContacts.contactName||savedContacts.contacts?.length>0)&&<div style={{marginTop:12,paddingTop:10,borderTop:`1px solid ${T.b2}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <div style={{fontSize:9,textTransform:"uppercase",color:T.t3,letterSpacing:"1px"}}>Contacts</div>
            <div style={{fontSize:8,color:T.t4}}>{savedContacts.savedAt?new Date(savedContacts.savedAt).toLocaleDateString():""}</div>
          </div>
          {/* Primary contact always visible */}
          {(savedContacts.contacts?.length>0?savedContacts.contacts:[{name:savedContacts.contactName,email:savedContacts.email,phone:savedContacts.phone,role:"",tier:1}]).slice(0,1).map((c:any,i:number)=>(
            <div key={i} style={{marginBottom:4}}>
              <div style={{fontSize:11,fontWeight:700,color:T.t1}}>{c.name}</div>
              {c.role&&<div style={{fontSize:9,color:T.t4,marginBottom:2}}>{c.role}</div>}
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {c.email&&<a href={`mailto:${c.email}`} style={{fontSize:10,color:T.cyan,textDecoration:"none"}}>{c.email}</a>}
                {c.phone&&<a href={`tel:${c.phone}`} style={{fontSize:10,color:T.green,textDecoration:"none"}}>{c.phone}</a>}
              </div>
            </div>
          ))}
          {/* Additional contacts collapsed */}
          {savedContacts.contacts?.length>1&&savedContacts.contacts.slice(1).map((c:any,i:number)=>(
            <div key={i} style={{borderTop:`1px solid ${T.b3}`,paddingTop:4,marginTop:4}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
                <div style={{fontSize:10,fontWeight:600,color:T.t2}}>{c.name}</div>
                <div style={{fontSize:9,color:T.t4}}>{c.role}</div>
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:1}}>
                {c.email&&<a href={`mailto:${c.email}`} style={{fontSize:9,color:T.cyan,textDecoration:"none"}}>{c.email}</a>}
                {c.phone&&<a href={`tel:${c.phone}`} style={{fontSize:9,color:T.green,textDecoration:"none"}}>{c.phone}</a>}
              </div>
            </div>
          ))}
          {savedContacts.website&&<div style={{marginTop:4}}><a href={savedContacts.website} target="_blank" rel="noreferrer" style={{fontSize:9,color:T.blue,textDecoration:"none"}}>🌐 {savedContacts.website.replace(/^https?:\/\//,"")}</a></div>}
        </div>}
      </div>}

      {/* SAVED CONTACTS — standalone card when no Badger data */}
      {!badger&&savedContacts&&(savedContacts.contactName||savedContacts.contacts?.length>0)&&<div className="anim" style={{animationDelay:"50ms",background:T.s1,border:`1px solid rgba(34,211,238,.15)`,borderRadius:16,padding:16,marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.cyan} strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.cyan}}>Contacts</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{fontSize:9,color:T.t4}}>{savedContacts.savedAt?new Date(savedContacts.savedAt).toLocaleDateString():""}</div>
            <button onClick={()=>{try { localStorage.removeItem(storageKey); } catch {} setSavedContacts(null);}} style={{background:"none",border:"none",color:T.t4,cursor:"pointer",fontSize:13,lineHeight:1,padding:2}}>✕</button>
          </div>
        </div>
        {/* All contacts in hierarchy order */}
        {(savedContacts.contacts?.length>0?savedContacts.contacts:[{name:savedContacts.contactName,email:savedContacts.email,phone:savedContacts.phone,role:"",tier:1}]).map((c:any,i:number)=>(
          <div key={i} style={{borderTop:i>0?`1px solid ${T.b2}`:"none",paddingTop:i>0?8:0,marginTop:i>0?8:0}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:2}}>
              <div style={{fontSize:12,fontWeight:700,color:i===0?T.t1:T.t2}}>{c.name}</div>
              {c.role&&<div style={{fontSize:9,color:T.t4,background:T.s2,borderRadius:4,padding:"1px 6px"}}>{c.role}</div>}
            </div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
              {c.email&&<a href={`mailto:${c.email}`} style={{fontSize:11,color:T.cyan,textDecoration:"none"}}>{c.email}</a>}
              {c.phone&&<a href={`tel:${c.phone}`} style={{fontSize:11,color:T.green,textDecoration:"none"}}>{c.phone}</a>}
            </div>
          </div>
        ))}
        {savedContacts.website&&<div style={{marginTop:8,paddingTop:8,borderTop:`1px solid ${T.b2}`}}>
          <a href={savedContacts.website} target="_blank" rel="noreferrer" style={{fontSize:11,color:T.blue,textDecoration:"none"}}>🌐 {savedContacts.website.replace(/^https?:\/\//,"")}</a>
        </div>}
      </div>}

      {/* PARENT GROUP SUMMARY */}
      {parentGroup&&<div className="anim" style={{animationDelay:"60ms",background:T.s1,border:`1px solid rgba(79,142,247,.18)`,borderRadius:16,padding:16,marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.blue}}>Parent Group</div>
          <button onClick={()=>goGroup(parentGroup)} style={{background:"rgba(79,142,247,.08)",border:"1px solid rgba(79,142,247,.15)",borderRadius:8,padding:"3px 10px",fontSize:10,fontWeight:600,color:T.blue,cursor:"pointer",fontFamily:"inherit"}}>View Group →</button>
        </div>
        <div style={{fontSize:14,fontWeight:700,marginBottom:2}}>{fixGroupName(parentGroup)}</div>
        <div style={{fontSize:10,color:T.t3,marginBottom:10}}>{parentGroup.locs} location{parentGroup.locs>1?"s":""} · {getTierLabel(parentGroup.tier,parentGroup.class2)}</div>
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
            return <button key={s.id} className="anim" onClick={()=>goAcct(s)}
              style={{animationDelay:`${i*20}ms`,display:"flex",alignItems:"center",justifyContent:"space-between",
                width:"100%",textAlign:"left",padding:"8px 10px",borderRadius:10,
                background:isDown?"rgba(248,113,113,.04)":T.s2,
                border:`1px solid ${isDown?"rgba(248,113,113,.15)":T.b2}`,
                marginBottom:6,cursor:"pointer"}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:11,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.name}</div>
                <div style={{fontSize:9,color:T.t4,marginTop:1}}>{s.city}, {s.st}{s.dealer&&s.dealer!=="Unknown"?<span style={{color:T.cyan}}> · {s.dealer}</span>:""}</div>
              </div>
              <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0,marginLeft:8}}>
                <Pill l="CY" v={$$(sCy)} c={T.blue}/>
                <Pill l="Gap" v={sGap<=0?`+${$$(Math.abs(sGap))}`:$$(sGap)} c={sGap<=0?T.green:T.red}/>
                <Pill l="Ret" v={sRet+"%"} c={sRet>50?T.green:sRet>25?T.amber:T.red}/>
                <Chev/>
              </div>
            </button>;
          })}
          {siblings.length>6&&<div style={{fontSize:10,color:T.t4,textAlign:"center",padding:"4px 0"}}>+{siblings.length-6} more locations — tap View Group</div>}
        </>}
      </div>}

      {/* VISIT PREP */}
      <div className="anim" style={{animationDelay:"80ms",background:T.s1,border:`1px solid ${T.b1}`,borderRadius:16,padding:16,marginBottom:12}}>
        <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.blue,marginBottom:10}}>Account Intel</div>
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
          <div style={{display:"flex",flexDirection:"column",gap:5}}>
            {xsell.slice(0,4).map((o,i)=><div key={i} style={{borderRadius:7,background:"rgba(167,139,250,.05)",border:"1px solid rgba(167,139,250,.12)",padding:"6px 10px"}}>
              <div style={{fontSize:10,fontWeight:700,color:T.purple,marginBottom:2}}>{o.label}</div>
              <div style={{fontSize:10,color:T.t3,lineHeight:1.4}}>{o.pitch}</div>
            </div>)}
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
        if (xsell.length > 0) moves.push({icon:"💡", color:T.purple, text:`Not buying ${xsell.slice(0,2).map(o=>o.label).join(" or ")}. ${xsell[0].pitch}`});
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
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:11,color:T.t2}}>{p.n}</span><span className="m" style={{fontSize:10,color:pCy===0&&pPy>100?T.red:T.t3}}>{$$(pPy)} / {$$(pCy)}</span></div>
            <div style={{position:"relative",height:12,borderRadius:3,background:T.s3,overflow:"hidden"}}>
              <div style={{position:"absolute",top:0,left:0,height:"50%",width:`${pPy/mx*100}%`,background:"rgba(255,255,255,.08)"}}/>
              <div className="bar-g" style={{animationDelay:`${i*60}ms`,position:"absolute",bottom:0,left:0,height:"50%",width:`${pCy/mx*100}%`,background:pCy===0?T.red:`linear-gradient(90deg,${T.blue},${T.cyan})`}}/>
            </div>
          </div>;
        })}
        <div style={{display:"flex",gap:12,marginTop:8,fontSize:9,color:T.t4}}><span>▬ PY</span><span style={{color:T.blue}}>▬ CY</span></div>
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

      {/* ACTIVITY LOG */}
      {(()=>{
        const ACT_ICONS:Record<string,string>={visit:"🚗",call:"📞",email:"📧",event:"🎓"};
        const saveEntry = () => {
          if(!actNotes.trim()&&!actContact.trim()) return;
          const entry={id:Date.now(),type:actType,contact:actContact.trim(),notes:actNotes.trim(),followUp:actFollowUp.trim(),ts:new Date().toISOString()};
          const updated=[entry,...actLog];
          setActLog(updated);
          try{localStorage.setItem(actLogKey,JSON.stringify(updated.slice(0,50)));}catch{}
          // Persist to overlays durably
          if (saveOverlays) {
            const next = { ...OVERLAYS_REF, activityLogs: { ...(OVERLAYS_REF.activityLogs||{}), [acct.id]: updated.slice(0,50) } };
            saveOverlays(next);
          }
          setActContact("");setActNotes("");setActFollowUp("");setShowActForm(false);
        };
        return <div className="anim" style={{animationDelay:"280ms",background:T.s1,border:`1px solid ${T.b1}`,borderRadius:16,padding:16,marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:showActForm||actLog.length>0?10:0}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.cyan}}>Activity Log</span>
              {actLog.length>0&&<span style={{fontSize:9,color:T.t4,background:T.s2,borderRadius:10,padding:"1px 6px"}}>{actLog.length}</span>}
            </div>
            <button onClick={()=>setShowActForm(!showActForm)} style={{background:"rgba(34,211,238,.08)",border:"1px solid rgba(34,211,238,.18)",borderRadius:8,color:T.cyan,cursor:"pointer",fontSize:11,fontWeight:600,padding:"4px 10px",fontFamily:"inherit"}}>{showActForm?"Cancel":"+ Log"}</button>
          </div>
          {showActForm&&<div style={{marginBottom:12}}>
            <div style={{display:"flex",gap:5,marginBottom:10}}>
              {([["visit","🚗 Visit"],["call","📞 Call"],["email","📧 Email"],["event","🎓 Event"]] as [string,string][]).map(([v,l])=>(
                <button key={v} onClick={()=>setActType(v)} style={{flex:1,padding:"6px 0",borderRadius:8,fontSize:10,cursor:"pointer",border:`1px solid ${actType===v?"rgba(34,211,238,.4)":T.b2}`,background:actType===v?"rgba(34,211,238,.12)":T.s2,color:actType===v?T.cyan:T.t3,fontFamily:"inherit",fontWeight:600}}>{l}</button>
              ))}
            </div>
            <input type="text" value={actContact} onChange={e=>setActContact(e.target.value)}
              placeholder="Contact name (optional)"
              style={{width:"100%",height:36,borderRadius:8,border:`1px solid ${T.b1}`,background:T.s2,color:T.t1,fontSize:12,padding:"0 10px",outline:"none",fontFamily:"inherit",marginBottom:7,boxSizing:"border-box"}}/>
            <textarea value={actNotes} onChange={e=>setActNotes(e.target.value)}
              placeholder="Notes from this visit / call…"
              rows={3}
              style={{width:"100%",borderRadius:8,border:`1px solid ${T.b1}`,background:T.s2,color:T.t1,fontSize:12,padding:"8px 10px",outline:"none",fontFamily:"inherit",marginBottom:7,resize:"none",boxSizing:"border-box",lineHeight:1.5}}/>
            <input type="text" value={actFollowUp} onChange={e=>setActFollowUp(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&saveEntry()}
              placeholder="Follow-up action (optional)"
              style={{width:"100%",height:36,borderRadius:8,border:`1px solid ${T.b1}`,background:T.s2,color:T.t1,fontSize:12,padding:"0 10px",outline:"none",fontFamily:"inherit",marginBottom:10,boxSizing:"border-box"}}/>
            <button onClick={saveEntry} style={{width:"100%",background:`linear-gradient(90deg,${T.cyan},${T.blue})`,border:"none",borderRadius:8,padding:"10px 0",fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer",fontFamily:"inherit"}}>Save Activity</button>
          </div>}
          {actLog.length===0&&!showActForm&&<div style={{fontSize:11,color:T.t4,textAlign:"center",padding:"6px 0"}}>No activity logged. Tap + Log after visits, calls, or emails.</div>}
          {actLog.slice(0,8).map((entry,i)=>{
            const d=new Date(entry.ts);
            const dateStr=d.toLocaleDateString("en-US",{month:"short",day:"numeric"});
            const timeStr=d.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"});
            return <div key={entry.id} style={{borderTop:`1px solid ${T.b1}`,paddingTop:10,marginTop:i>0?0:2,paddingBottom:i<Math.min(actLog.length,8)-1?10:0}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:3}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:12}}>{ACT_ICONS[entry.type]||"📋"}</span>
                  <span style={{fontSize:11,fontWeight:700,color:T.t1,textTransform:"capitalize"}}>{entry.type}</span>
                  {entry.contact&&<span style={{fontSize:10,color:T.cyan}}>· {entry.contact}</span>}
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:9,color:T.t4}}>{dateStr} {timeStr}</span>
                  <button onClick={()=>{const upd=actLog.filter(e=>e.id!==entry.id);setActLog(upd);try{localStorage.setItem(actLogKey,JSON.stringify(upd));}catch{}}} style={{background:"none",border:"none",color:T.t4,cursor:"pointer",fontSize:11,padding:0,lineHeight:1}}>✕</button>
                </div>
              </div>
              {entry.notes&&<div style={{fontSize:11,color:T.t2,lineHeight:1.5,paddingLeft:22,marginBottom:entry.followUp?3:0}}>{entry.notes}</div>}
              {entry.followUp&&<div style={{fontSize:10,color:T.amber,paddingLeft:22,display:"flex",alignItems:"center",gap:4}}><span>→</span>{entry.followUp}</div>}
            </div>;
          })}
          {actLog.length>8&&<div style={{fontSize:10,color:T.t4,textAlign:"center",paddingTop:8}}>+{actLog.length-8} older entries</div>}
        </div>;
      })()}
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
function DashTab({groups, q1CY, q1Att, q1Gap, scored, goAcct}) {
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
    <div className="anim" style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:14,padding:14,marginBottom:12}}>
      <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.t3,marginBottom:10}}>Top 5 Groups by CY Revenue</div>
      {top5.length===0&&<div style={{fontSize:11,color:T.t4}}>No data — upload a CSV.</div>}
      {top5.map((g,i)=>{
        const cy=g.cyQ?.["1"]||0; const py=g.pyQ?.["1"]||0;
        const up=cy>=py;
        return <div key={g.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:i<top5.length-1?`1px solid ${T.b1}`:"none"}}>
          <span className="m" style={{fontSize:11,color:T.t4,minWidth:16}}>#{i+1}</span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{fixGroupName(g)}</div>
            <div style={{fontSize:9,color:T.t3}}>{g.locs} loc · {getTierLabel(g.tier,g.class2)}</div>
          </div>
          <div style={{textAlign:"right",flexShrink:0}}>
            <div className="m" style={{fontSize:12,fontWeight:700,color:T.blue}}>{$$(cy)}</div>
            <div style={{fontSize:9,color:up?T.green:T.red}}>{up?"+":""}{$$(cy-py)} vs PY</div>
          </div>
        </div>;
      })}
    </div>

    {/* ── GAP LEADERBOARD ── */}
    {(()=>{
      const topGap = scored.filter(a=>(a.pyQ?.["1"]||0)>0&&a.gap>0).slice(0,10);
      if (!topGap.length) return null;
      const maxGap = topGap[0]?.gap||1;
      return <div className="anim" style={{background:T.s1,border:`1px solid rgba(248,113,113,.15)`,borderRadius:14,padding:14,marginBottom:12}}>
        <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.red,marginBottom:4}}>Gap Leaderboard — Top 10 Recovery Targets</div>
        <div style={{fontSize:10,color:T.t4,marginBottom:12}}>Accounts with the largest Q1 CY vs PY shortfall</div>
        {topGap.map((a,i)=>{
          const barPct = (a.gap/maxGap)*100;
          return <button key={a.id} onClick={()=>goAcct&&goAcct(a)} style={{display:"block",width:"100%",textAlign:"left",background:"none",border:"none",padding:0,marginBottom:10,cursor:"pointer"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:3}}>
              <div style={{flex:1,minWidth:0,display:"flex",alignItems:"center",gap:5}}>
                <span className="m" style={{fontSize:9,color:T.t4}}>#{i+1}</span>
                <span style={{fontSize:11,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.name}</span>
                <span style={{fontSize:9,color:T.t3}}>{a.city}, {a.st}</span>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0,marginLeft:8}}>
                <span className="m" style={{fontSize:11,fontWeight:700,color:T.red}}>-{$$(a.gap)}</span>
                <span style={{fontSize:9,color:T.t4}}>{Math.round(a.ret*100)}% ret</span>
                <Chev/>
              </div>
            </div>
            <div style={{height:4,borderRadius:2,background:T.s3,overflow:"hidden"}}>
              <div style={{height:"100%",borderRadius:2,width:`${barPct}%`,background:`linear-gradient(90deg,${T.red},${T.orange})`}}/>
            </div>
          </button>;
        })}
      </div>;
    })()}

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

// ─── MAP / ROUTE TAB ─────────────────────────────────────────────
function MapTab() {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const onPinClickRef = useRef<(a:any)=>void>(()=>{});
  const [selDay, setSelDay] = useState<string|null>(null);
  const [selAcct, setSelAcct] = useState<any>(null);

  // Always-fresh callback ref — update only when selAcct setter identity changes (never)
  onPinClickRef.current = (a) => setSelAcct(a);

  const days = Object.keys(WEEK_ROUTES.routes||{});

  // Memoized — only recomputes when selDay changes, NOT on every render
  const displayed = useMemo(()=>
    selDay
      ? (WEEK_ROUTES.routes[selDay]||[]).map(a=>({...a,day:selDay}))
      : days.flatMap(d=>(WEEK_ROUTES.routes[d]||[]).map(a=>({...a,day:d})))
  , [selDay]);

  const vpColor = (vp) => {
    if (vp==="NOW") return T.red;
    if (vp==="SOON") return T.amber;
    return T.green;
  };

  // Ken's home base — used as route origin
  const HOME_BASE = "Thomaston, CT";

  const openGoogleMaps = (accts) => {
    const withGps = accts.filter(a=>a.lat&&a.lng);
    if (!withGps.length) return;

    // Build address string: prefer full address, fall back to "City, State"
    const addrOf = (a) => {
      const addr = (a.address||"").trim();
      // Use full address if it has a street number, otherwise city+state
      if (addr && /^\d/.test(addr)) return addr;
      return `${a.city||""}, ${a.state||"CT"}`;
    };

    if (withGps.length === 1) {
      const dest = encodeURIComponent(addrOf(withGps[0]));
      window.open(`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(HOME_BASE)}&destination=${dest}&travelmode=driving`,"_blank");
      return;
    }

    // Multi-stop: origin=home, destination=last stop, waypoints=everything in between
    const origin = encodeURIComponent(HOME_BASE);
    const destination = encodeURIComponent(addrOf(withGps[withGps.length-1]));
    const waypointList = withGps.slice(0,-1).map(a=>encodeURIComponent(addrOf(a))).join("|");
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypointList}&travelmode=driving`;
    window.open(url,"_blank");
  };

  // Map only rebuilds when selDay changes — NOT when selAcct changes
  useEffect(()=>{
    if (!mapRef.current) return;
    if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current=null; }

    const pts = displayed.filter(a=>a.lat&&a.lng);
    if (!pts.length) return;

    const loadLeaflet = () => new Promise<void>((res) => {
      if ((window as any).L) { res(); return; }
      const css = document.createElement("link");
      css.rel="stylesheet"; css.href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
      document.head.appendChild(css);
      const js = document.createElement("script");
      js.src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
      js.onload=()=>res();
      document.head.appendChild(js);
    });

    loadLeaflet().then(()=>{
      const L = (window as any).L;
      if (!mapRef.current || mapInstanceRef.current) return;
      const avgLat = pts.reduce((s,a)=>s+a.lat,0)/pts.length;
      const avgLng = pts.reduce((s,a)=>s+a.lng,0)/pts.length;
      const map = L.map(mapRef.current, {zoomControl:true}).setView([avgLat,avgLng],10);
      mapInstanceRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
        attribution:'© OpenStreetMap',maxZoom:18
      }).addTo(map);

      if (selDay) {
        const coords = pts.map(a=>[a.lat,a.lng]);
        L.polyline(coords,{color:"rgba(79,142,247,.5)",weight:2,dashArray:"6,4"}).addTo(map);
      }

      pts.forEach((a,i)=>{
        const col = vpColor(a.vp||"");
        const svgIcon = L.divIcon({
          className:"",
          html:`<div style="width:28px;height:28px;border-radius:50%;background:${T.s1};border:2.5px solid ${col};display:flex;align-items:center;justify-content:center;font-family:monospace;font-size:10px;font-weight:800;color:${col};box-shadow:0 2px 8px rgba(0,0,0,.5);cursor:pointer">${selDay?i+1:""}</div>`,
          iconSize:[28,28], iconAnchor:[14,14]
        });
        const marker = L.marker([a.lat,a.lng],{icon:svgIcon}).addTo(map);
        // Always route through ref — never captures stale state
        marker.on("click", () => onPinClickRef.current(a));
      });

      if (pts.length>1) map.fitBounds(L.latLngBounds(pts.map(a=>[a.lat,a.lng])),{padding:[24,24]});
    });

    return ()=>{ if(mapInstanceRef.current){mapInstanceRef.current.remove();mapInstanceRef.current=null;} };
  },[selDay]); // ← only selDay, NOT displayed or selAcct — prevents popover from triggering rebuild

  const dayColors = ["#4f8ef7","#22d3ee","#34d399","#fbbf24","#a78bfa"];

  return <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 112px)",position:"relative"}}>

    {/* Day filter pills */}
    <div style={{padding:"10px 16px 0",flexShrink:0}}>
      <div className="hide-sb" style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:8}}>
        <button onClick={()=>{setSelDay(null);setSelAcct(null)}} style={{flexShrink:0,padding:"5px 14px",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",border:`1px solid ${!selDay?"rgba(79,142,247,.3)":T.b2}`,background:!selDay?"rgba(79,142,247,.12)":T.s2,color:!selDay?T.blue:T.t3,fontFamily:"inherit"}}>All Days</button>
        {days.map((d,i)=>{
          const col=dayColors[i%dayColors.length];
          const cnt=(WEEK_ROUTES.routes[d]||[]).length;
          return <button key={d} onClick={()=>{setSelDay(d===selDay?null:d);setSelAcct(null)}} style={{flexShrink:0,padding:"5px 14px",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",border:`1px solid ${selDay===d?col+"55":T.b2}`,background:selDay===d?col+"18":T.s2,color:selDay===d?col:T.t3,fontFamily:"inherit"}}>{d} <span style={{opacity:.7,fontSize:9}}>({cnt})</span></button>;
        })}
      </div>

      {/* Route button */}
      {selDay&&(WEEK_ROUTES.routes[selDay]||[]).filter(a=>a.lat).length>0&&(
        <button onClick={()=>openGoogleMaps((WEEK_ROUTES.routes[selDay]||[]))} style={{width:"100%",marginBottom:8,padding:"8px 0",borderRadius:10,border:"none",background:`linear-gradient(90deg,${T.blue},${T.cyan})`,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
          <IconMap c="#fff"/> Open {selDay} Route in Google Maps
        </button>
      )}
    </div>

    {/* Map */}
    <div ref={mapRef} style={{flex:1,minHeight:0,background:T.s2}}/>

    {/* Account popover — fixed so it's always visible above nav bar */}
    {selAcct&&<div className="anim" style={{position:"fixed",bottom:64,left:0,right:0,margin:"0 12px",zIndex:200,background:T.s1,border:`1px solid rgba(79,142,247,.3)`,borderRadius:16,padding:14,boxShadow:"0 8px 40px rgba(0,0,0,.7)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{selAcct.name}</div>
          <div style={{fontSize:10,color:T.t3,marginTop:1}}>{selAcct.city}, {selAcct.state} · <span style={{color:vpColor(selAcct.vp),fontWeight:700}}>{selAcct.vp||"—"}</span>{selAcct.zone?` · ${selAcct.zone}`:""}</div>
        </div>
        <button onClick={()=>setSelAcct(null)} style={{background:"none",border:"none",color:T.t4,cursor:"pointer",fontSize:18,lineHeight:1,paddingLeft:8,flexShrink:0}}>✕</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:10}}>
        <div style={{background:T.s2,borderRadius:8,padding:"6px 8px",textAlign:"center"}}>
          <div style={{fontSize:8,color:T.t4}}>Q1 2025</div>
          <div className="m" style={{fontSize:12,fontWeight:700,color:T.t2}}>{$$(selAcct.q1_2025||selAcct.py||0)}</div>
        </div>
        <div style={{background:T.s2,borderRadius:8,padding:"6px 8px",textAlign:"center"}}>
          <div style={{fontSize:8,color:T.t4}}>Q1 2026</div>
          <div className="m" style={{fontSize:12,fontWeight:700,color:T.blue}}>{$$(selAcct.q1_2026||selAcct.cy||0)}</div>
        </div>
        <div style={{background:T.s2,borderRadius:8,padding:"6px 8px",textAlign:"center"}}>
          <div style={{fontSize:8,color:T.t4}}>Gap</div>
          {(()=>{const g=(selAcct.q1_2025||selAcct.py||0)-(selAcct.q1_2026||selAcct.cy||0);return <div className="m" style={{fontSize:12,fontWeight:700,color:g>0?T.red:T.green}}>{g>0?$$(g):"+"+$$(Math.abs(g))}</div>;})()} 
        </div>
      </div>
      {selAcct.flag&&<div style={{fontSize:10,color:T.amber,background:"rgba(251,191,36,.06)",border:"1px solid rgba(251,191,36,.15)",borderRadius:8,padding:"5px 8px",marginBottom:8}}>{selAcct.flag}</div>}
      {selAcct.intel&&<div style={{fontSize:10,color:T.t3,lineHeight:1.5,marginBottom:8,maxHeight:56,overflow:"hidden"}}>{selAcct.intel}</div>}
      <div style={{display:"flex",gap:6}}>
        {selAcct.phone&&<a href={`tel:${selAcct.phone}`} style={{flex:1,padding:"7px 0",borderRadius:8,border:`1px solid ${T.b2}`,background:T.s2,color:T.t1,fontSize:11,fontWeight:600,textAlign:"center",textDecoration:"none",display:"block"}}>{selAcct.phone}</a>}
        {selAcct.lat&&selAcct.lng&&<a href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(HOME_BASE)}&destination=${encodeURIComponent(((selAcct.address||"").trim()&&/^\d/.test((selAcct.address||"").trim()))?selAcct.address:`${selAcct.city}, ${selAcct.state||"CT"}`)}&travelmode=driving`} target="_blank" rel="noreferrer" style={{flex:1,padding:"7px 0",borderRadius:8,border:"none",background:`linear-gradient(90deg,${T.blue},${T.cyan})`,color:"#fff",fontSize:11,fontWeight:600,textAlign:"center",textDecoration:"none",display:"block"}}>Navigate →</a>}
      </div>
    </div>}

    {/* Legend */}
    <div style={{padding:"6px 16px",flexShrink:0,display:"flex",gap:12,alignItems:"center",borderTop:`1px solid ${T.b1}`}}>
      {[["NOW",T.red],["SOON",T.amber],["ON TRACK",T.green]].map(([l,c])=>(
        <div key={l} style={{display:"flex",alignItems:"center",gap:4}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:c}}/>
          <span style={{fontSize:9,color:T.t4}}>{l}</span>
        </div>
      ))}
      <span style={{marginLeft:"auto",fontSize:9,color:T.t4}}>{displayed.filter(a=>a.lat).length} mapped · {displayed.filter(a=>!a.lat).length} no GPS</span>
    </div>
  </div>;
}

// ─── DEALERS TAB ─────────────────────────────────────────────────
const DIST_ORDER = ["Schein","Patterson","Benco","Darby"];
const DIST_COLORS: Record<string,string> = {
  Schein:"rgba(79,142,247,.18)", Patterson:"rgba(167,139,250,.18)",
  Benco:"rgba(34,211,238,.18)", Darby:"rgba(251,191,36,.18)"
};
const DIST_TEXT: Record<string,string> = {
  Schein:"#4f8ef7", Patterson:"#a78bfa", Benco:"#22d3ee", Darby:"#fbbf24"
};
const DIST_BORDER: Record<string,string> = {
  Schein:"rgba(79,142,247,.35)", Patterson:"rgba(167,139,250,.35)",
  Benco:"rgba(34,211,238,.35)", Darby:"rgba(251,191,36,.35)"
};
// Strings that mean "no rep name — just a distributor label"
const NO_REP_LABELS = new Set(["schein","henry schein","patterson","benco","darby","direct","all other","unknown",""]);

function isNoRep(s:string|undefined):boolean {
  if(!s) return true;
  return NO_REP_LABELS.has(s.trim().toLowerCase());
}

const PRI_ORDER:Record<string,number> = {NOW:0,SOON:1,"ON TRACK":2,PROTECT:3,PIPELINE:4};

function DealersTab({scored,groups,goAcct,goGroup}:{scored:any[],groups:any[],goAcct:(a:any)=>void,goGroup:(g:any)=>void}) {
  const [selDist,setSelDist] = useState<string|null>(null);
  const [selRep,setSelRep]  = useState<string|null>(null); // null = all reps view
  const [selGroup,setSelGroup] = useState<string|null>(null); // gId of selected group in rep drill-down
  const [showAddRep,setShowAddRep] = useState(false);
  const [newRepName,setNewRepName] = useState("");
  const [newRepPhone,setNewRepPhone] = useState("");
  const [newRepNotes,setNewRepNotes] = useState("");
  const [manualReps,setManualReps] = useState<Record<string,any[]>>(()=>{
    try { return JSON.parse(localStorage.getItem("dealer_manual_reps")||"{}"); } catch { return {}; }
  });

  const saveManualReps = (updated:Record<string,any[]>) => {
    setManualReps(updated);
    try { localStorage.setItem("dealer_manual_reps", JSON.stringify(updated)); } catch {}
  };

  // Build per-distributor stats from scored accounts — includes all accounts
  const distStats = useMemo(()=>{
    const ALL_BUCKETS = [...DIST_ORDER, "All Other", "Unknown"];
    const map:Record<string,{accts:any[],cy:number,py:number,nowCount:number}> = {};
    ALL_BUCKETS.forEach(d=>{ map[d]={accts:[],cy:0,py:0,nowCount:0}; });
    scored.forEach(a=>{
      const d = a.dealer || "Unknown";
      if(!map[d]) map[d]={accts:[],cy:0,py:0,nowCount:0};
      const cy=a.cyQ?.["1"]||0, py=a.pyQ?.["1"]||0;
      map[d].accts.push(a);
      map[d].cy+=cy; map[d].py+=py;
      if(a.visitPriority==="NOW") map[d].nowCount++;
    });
    // Merge Unknown into All Other
    if(map["Unknown"]) {
      map["All Other"].accts.push(...map["Unknown"].accts);
      map["All Other"].cy += map["Unknown"].cy;
      map["All Other"].py += map["Unknown"].py;
      map["All Other"].nowCount += map["Unknown"].nowCount;
    }
    return map;
  },[scored]);

  // Extract distributor hint from a freeform rep string
  // e.g. "Dave R - Benco" → "Benco", "Jeff T - Schein" → "Schein", "Lyndon" → null
  // Manual rep→distributor overrides for reps whose names contain no distributor hint.
  // Key = rep name lowercased (partial match ok), Value = distributor.
  // Add new entries here as you identify them in the field.
  const REP_DIST_OVERRIDES: Record<string,string> = {
    "vincent parrillo": "Patterson",
    // Add more below as needed, e.g.:
    // "john smith": "Benco",
  };

  const repDistHint = (rep:string): string|null => {
    const r = rep.toLowerCase().trim();
    // Check manual overrides first (exact or partial match)
    for(const [key, dist] of Object.entries(REP_DIST_OVERRIDES)) {
      if(r.includes(key) || key.includes(r)) return dist;
    }
    // Then check for distributor name embedded in rep string
    if(r.includes("schein") || r.includes("henry schein")) return "Schein";
    if(r.includes("patterson")) return "Patterson";
    if(r.includes("benco")) return "Benco";
    if(r.includes("darby")) return "Darby";
    return null; // no distributor hint — rep could belong to any
  };

  // For selected distributor: group accounts by rep.
  // Rules:
  // 1. Rep on any child in a group → owns ALL same-distributor siblings in that group.
  // 2. Rep logged on wrong-distributor child (e.g. Lyndon-Benco on a Schein child):
  //    a. If a correct-distributor sibling exists → use it (sibling resolution).
  //    b. If no correct sibling exists → trust the rep's hint, include the account
  //       under the rep for the correct distributor (don't silently drop it).
  const repGroups = useMemo(()=>{
    if(!selDist) return null;
    const B = typeof BADGER !== "undefined" ? BADGER : {};

    // Build gId → group lookup
    const groupById: Record<string,any> = {};
    groups.forEach(g => { groupById[g.id] = g; });

    // --- Step 1: Build gId → repName map ---
    // Source A: groupFSC localStorage assignments (highest priority — you set these manually)
    const gIdToRep: Record<string,string> = {};
    groups.forEach(g => {
      try {
        const saved = localStorage.getItem(`groupFSC:${g.id}:${selDist}`);
        if(saved) {
          const data = JSON.parse(saved);
          if(data?.name) gIdToRep[g.id] = data.name;
        }
      } catch {}
    });

    // Source B: Badger dealerRep on child accounts (fallback)
    const groupHasCorrectDealer: Record<string,boolean> = {};
    scored.forEach(a => {
      if(a.dealer === selDist && a.gId) groupHasCorrectDealer[a.gId] = true;
    });

    scored.forEach(a => {
      if(gIdToRep[a.gId]) return; // already assigned via groupFSC
      const badger = B[a.id];
      const rep = badger?.dealerRep;
      if(isNoRep(rep)) return;
      const hint = repDistHint(rep!);
      if(hint && hint !== selDist) return;
      if(!hint && a.dealer !== selDist) return;
      const repKey = rep!.trim();
      if(a.dealer === selDist && a.gId && !gIdToRep[a.gId]) {
        gIdToRep[a.gId] = repKey;
      } else if(hint === selDist && a.gId && groupHasCorrectDealer[a.gId] && !gIdToRep[a.gId]) {
        gIdToRep[a.gId] = repKey;
      }
    });

    // --- Step 2: For each rep, collect the parent groups they own (for selDist) ---
    // Roll up: rep → { gId → { group, children (selDist only), totalPY, totalCY } }
    const repToGroups: Record<string, Record<string,any>> = {"__none__": {}};

    // For each scored account that belongs to selDist, roll into its parent group under the right rep
    scored.forEach(a => {
      if(a.dealer !== selDist) return;
      const rep = a.gId ? gIdToRep[a.gId] : undefined;
      const repKey = rep || "__none__";
      if(!repToGroups[repKey]) repToGroups[repKey] = {};

      const gId = a.gId || `__single__${a.id}`;
      const gObj = a.gId ? groupById[a.gId] : null;
      if(!repToGroups[repKey][gId]) {
        repToGroups[repKey][gId] = {
          gId,
          gName: a.gName || a.name,
          gObj,
          children: [],
          totalPY: 0,
          totalCY: 0,
          maxVisitPriority: a.visitPriority,
        };
      }
      const bucket = repToGroups[repKey][gId];
      bucket.children.push(a);
      bucket.totalPY += a.pyQ?.["1"] || 0;
      bucket.totalCY += a.cyQ?.["1"] || 0;
      // Track highest priority child
      const PO = {NOW:0,SOON:1,"ON TRACK":2,PROTECT:3,PIPELINE:4};
      if((PO[a.visitPriority]??9) < (PO[bucket.maxVisitPriority]??9)) bucket.maxVisitPriority = a.visitPriority;
    });

    // Convert inner objects to sorted arrays
    const result: Record<string, any[]> = {};
    Object.entries(repToGroups).forEach(([rep, gMap]) => {
      result[rep] = Object.values(gMap).sort((a,b) => (b.totalPY - b.totalCY) - (a.totalPY - a.totalCY));
    });

    return result;
  },[selDist, scored, groups, distStats]);

  // Sort accounts by visit priority
  const sortByPriority = (accts:any[]) =>
    [...accts].sort((a,b)=>(PRI_ORDER[a.visitPriority]??9)-(PRI_ORDER[b.visitPriority]??9));

  // Groups to show under selected rep
  const repGroupsList = useMemo(()=>{
    if(!repGroups || !selRep) return [];
    return repGroups[selRep] || [];
  },[repGroups,selRep]);

  // Children of selected group (for selDist) — shown when user taps a group in rep view
  const selGroupData = useMemo(()=>{
    if(!selRep || !selGroup || !repGroups) return null;
    const list = repGroups[selRep] || [];
    return list.find((g:any) => g.gId === selGroup) || null;
  },[repGroups, selRep, selGroup]);

  const PRI_CHIP:Record<string,{bg:string,color:string}> = {
    NOW:{bg:"rgba(248,113,113,.12)",color:"#f87171"},
    SOON:{bg:"rgba(251,191,36,.10)",color:"#fbbf24"},
    "ON TRACK":{bg:"rgba(52,211,153,.10)",color:"#34d399"},
    PROTECT:{bg:"rgba(79,142,247,.10)",color:"#4f8ef7"},
    PIPELINE:{bg:"rgba(167,139,250,.10)",color:"#a78bfa"},
  };

  // ── Level 3: Group children view (rep → group → children) ──
  if(selDist && selRep !== null && selGroup && selGroupData) {
    const children = sortByPriority(selGroupData.children || []);
    const totalPY = selGroupData.totalPY;
    const totalCY = selGroupData.totalCY;
    const gap = totalPY - totalCY;
    const ret = totalPY > 0 ? Math.round(totalCY/totalPY*100) : 0;
    return <div style={{paddingBottom:80}}>
      <div style={{position:"sticky",top:52,zIndex:40,background:"rgba(10,10,15,.9)",backdropFilter:"blur(20px)",borderBottom:`1px solid ${T.b3}`,padding:"10px 16px",display:"flex",alignItems:"center",gap:10}}>
        <button onClick={()=>setSelGroup(null)} style={{background:"none",border:"none",color:T.blue,cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"inherit",display:"flex",alignItems:"center",gap:4}}><Back/> {selRep==="__none__"?"No Rep":selRep}</button>
      </div>
      <div style={{padding:"16px 16px 0"}}>
        {/* Group header card */}
        <div style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:14,padding:"12px 14px",marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:15,fontWeight:700,color:T.t1,marginBottom:2}}>{selGroupData.gName}</div>
              <div style={{fontSize:10,color:T.t3}}>{selDist} · {children.length} location{children.length!==1?"s":""}</div>
            </div>
            {selGroupData.gObj&&<button onClick={()=>goGroup(selGroupData.gObj)} style={{background:"rgba(79,142,247,.08)",border:"1px solid rgba(79,142,247,.15)",borderRadius:8,padding:"4px 10px",fontSize:10,fontWeight:600,color:T.blue,cursor:"pointer",fontFamily:"inherit",flexShrink:0,marginLeft:10}}>Group →</button>}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8}}>
            <Stat l="PY" v={$$(totalPY)} c={T.t2}/>
            <Stat l="CY" v={$$(totalCY)} c={T.blue}/>
            <Stat l="Gap" v={gap<=0?`+${$$(Math.abs(gap))}`:$$(gap)} c={gap<=0?T.green:T.red}/>
            <Stat l="Ret" v={ret+"%"} c={ret>=95?T.green:ret>=70?T.amber:T.red}/>
          </div>
        </div>
        {/* Child locations */}
        <div style={{fontSize:9,textTransform:"uppercase",color:T.t4,letterSpacing:"1px",marginBottom:8,fontWeight:700}}>Locations ({children.length})</div>
        {children.map((a:any,i:number)=>{
          const cy=a.cyQ?.["1"]||0, py=a.pyQ?.["1"]||0, gap=py-cy;
          const chip=PRI_CHIP[a.visitPriority]||PRI_CHIP["ON TRACK"];
          const isDown=gap>0;
          const locRet=py>0?Math.round(cy/py*100):0;
          return <button key={a.id} className="anim" onClick={()=>goAcct(a)}
            style={{animationDelay:`${i*20}ms`,width:"100%",textAlign:"left",background:T.s1,
              border:`1px solid ${isDown?"rgba(248,113,113,.2)":"rgba(52,211,153,.15)"}`,
              borderRadius:12,padding:"11px 13px",marginBottom:7,cursor:"pointer"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
              <div style={{display:"flex",alignItems:"center",gap:6,flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.name}</div>
                <span style={{flexShrink:0,fontSize:8,fontWeight:700,borderRadius:4,padding:"1px 5px",background:chip.bg,color:chip.color}}>{a.visitPriority}</span>
                {a.dealerFlag&&<span style={{flexShrink:0,fontSize:8,fontWeight:700,color:T.amber,background:"rgba(251,191,36,.1)",borderRadius:4,padding:"1px 5px",border:"1px solid rgba(251,191,36,.25)"}}>⚠ verify</span>}
              </div>
              <Chev/>
            </div>
            <div style={{fontSize:10,color:T.t3,marginBottom:7}}>{a.city}, {a.st}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:5}}>
              <div style={{background:T.s2,borderRadius:6,padding:"4px 6px"}}>
                <div style={{fontSize:9,color:T.t3,marginBottom:1}}>PY</div>
                <div style={{fontSize:10,fontWeight:700,color:T.t2,fontFamily:"monospace"}}>{$$(py)}</div>
              </div>
              <div style={{background:T.s2,borderRadius:6,padding:"4px 6px"}}>
                <div style={{fontSize:9,color:T.t3,marginBottom:1}}>CY</div>
                <div style={{fontSize:10,fontWeight:700,color:T.blue,fontFamily:"monospace"}}>{$$(cy)}</div>
              </div>
              <div style={{background:isDown?"rgba(248,113,113,.06)":"rgba(52,211,153,.06)",borderRadius:6,padding:"4px 6px"}}>
                <div style={{fontSize:9,color:T.t3,marginBottom:1}}>Gap</div>
                <div style={{fontSize:10,fontWeight:700,color:isDown?T.red:T.green,fontFamily:"monospace"}}>{isDown?"-":"+"}${Math.abs(gap)>=1000?`${(Math.abs(gap)/1000).toFixed(1)}k`:`${Math.round(Math.abs(gap))}`}</div>
              </div>
              <div style={{background:T.s2,borderRadius:6,padding:"4px 6px"}}>
                <div style={{fontSize:9,color:T.t3,marginBottom:1}}>Ret</div>
                <div style={{fontSize:10,fontWeight:700,color:locRet>=95?T.green:locRet>=70?T.amber:T.red,fontFamily:"monospace"}}>{locRet}%</div>
              </div>
            </div>
          </button>;
        })}
      </div>
    </div>;
  }

  // ── Level 2: Rep drill-down → parent groups ──
  if(selDist && selRep !== null) {
    const repLabel = selRep==="__none__" ? "No Rep Assigned" : selRep;
    const manuals = manualReps[selDist]||[];
    const manualEntry = manuals.find(r=>r.name===selRep);
    const totalPY = repGroupsList.reduce((s:number,g:any)=>s+g.totalPY,0);
    const totalCY = repGroupsList.reduce((s:number,g:any)=>s+g.totalCY,0);
    const totalGap = totalPY - totalCY;
    return <div style={{paddingBottom:80}}>
      <div style={{position:"sticky",top:52,zIndex:40,background:"rgba(10,10,15,.9)",backdropFilter:"blur(20px)",borderBottom:`1px solid ${T.b3}`,padding:"10px 16px",display:"flex",alignItems:"center",gap:10}}>
        <button onClick={()=>setSelRep(null)} style={{background:"none",border:"none",color:T.blue,cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"inherit",display:"flex",alignItems:"center",gap:4}}><Back/> {selDist}</button>
      </div>
      <div style={{padding:"16px 16px 0"}}>
        {/* Rep header */}
        <div style={{background:DIST_COLORS[selDist],border:`1px solid ${DIST_BORDER[selDist]}`,borderRadius:14,padding:"12px 14px",marginBottom:14}}>
          <div style={{fontSize:14,fontWeight:700,color:selRep==="__none__"?T.t3:DIST_TEXT[selDist]}}>{repLabel}</div>
          <div style={{fontSize:10,color:T.t3,marginTop:2}}>{selDist} · {repGroupsList.length} group{repGroupsList.length!==1?"s":""}</div>
          <div style={{display:"flex",gap:16,marginTop:8}}>
            <div><div style={{fontSize:9,color:T.t4}}>PY</div><div style={{fontSize:12,fontWeight:700,color:T.t2,fontFamily:"monospace"}}>{$$(totalPY)}</div></div>
            <div><div style={{fontSize:9,color:T.t4}}>CY</div><div style={{fontSize:12,fontWeight:700,color:T.blue,fontFamily:"monospace"}}>{$$(totalCY)}</div></div>
            <div><div style={{fontSize:9,color:T.t4}}>Gap</div><div style={{fontSize:12,fontWeight:700,color:totalGap>0?T.red:T.green,fontFamily:"monospace"}}>{totalGap>0?"-":"+"}${Math.abs(totalGap)>=1000?`${(Math.abs(totalGap)/1000).toFixed(1)}k`:`${Math.round(Math.abs(totalGap))}`}</div></div>
          </div>
          {manualEntry?.phone&&<a href={`tel:${manualEntry.phone}`} style={{display:"inline-flex",alignItems:"center",gap:5,marginTop:8,fontSize:10,color:T.cyan,textDecoration:"none",background:"rgba(34,211,238,.08)",border:"1px solid rgba(34,211,238,.15)",borderRadius:8,padding:"3px 10px"}}>
            📞 {manualEntry.phone}
          </a>}
          {manualEntry?.notes&&<div style={{fontSize:10,color:T.t3,marginTop:6,fontStyle:"italic"}}>{manualEntry.notes}</div>}
        </div>
        {repGroupsList.length===0&&<div style={{fontSize:12,color:T.t4,textAlign:"center",padding:"30px 0"}}>No accounts linked to this rep yet.</div>}
        {/* Parent group cards */}
        {repGroupsList.map((g:any,i:number)=>{
          const gap=g.totalPY-g.totalCY;
          const ret=g.totalPY>0?Math.round(g.totalCY/g.totalPY*100):0;
          const isDown=gap>0;
          const chip=PRI_CHIP[g.maxVisitPriority]||PRI_CHIP["ON TRACK"];
          const borderColor=isDown?"rgba(248,113,113,.2)":"rgba(52,211,153,.15)";
          return <button key={g.gId} className="anim" onClick={()=>{
            // Single-location groups: skip the intermediate children list, go straight to account detail
            if(g.children.length===1) { goAcct(g.children[0]); return; }
            setSelGroup(g.gId);
          }}
            style={{animationDelay:`${i*20}ms`,width:"100%",textAlign:"left",background:T.s1,
              border:`1px solid ${borderColor}`,
              borderRadius:12,padding:"11px 13px",marginBottom:7,cursor:"pointer"}}>
            {/* Row 1: Name + priority + chevron */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <div style={{display:"flex",alignItems:"center",gap:6,flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{g.gName}</div>
                <span style={{flexShrink:0,fontSize:8,fontWeight:700,borderRadius:4,padding:"1px 5px",background:chip.bg,color:chip.color}}>{g.maxVisitPriority}</span>
              </div>
              <Chev/>
            </div>
            {/* Row 2: city + loc count */}
            <div style={{fontSize:10,color:T.t3,marginBottom:8}}>{g.children.length} loc{g.children.length!==1?"s":""}{g.children[0]?.city?` · ${g.children[0].city}`:""}</div>
            {/* Row 3: PY / CY / Gap / Ret pills */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6}}>
              <div style={{background:T.s2,borderRadius:6,padding:"4px 6px"}}>
                <div style={{fontSize:9,color:T.t3,marginBottom:1}}>PY</div>
                <div style={{fontSize:11,fontWeight:700,color:T.t2,fontFamily:"monospace"}}>{$$(g.totalPY)}</div>
              </div>
              <div style={{background:T.s2,borderRadius:6,padding:"4px 6px"}}>
                <div style={{fontSize:9,color:T.t3,marginBottom:1}}>CY</div>
                <div style={{fontSize:11,fontWeight:700,color:T.blue,fontFamily:"monospace"}}>{$$(g.totalCY)}</div>
              </div>
              <div style={{background:isDown?"rgba(248,113,113,.06)":"rgba(52,211,153,.06)",borderRadius:6,padding:"4px 6px"}}>
                <div style={{fontSize:9,color:T.t3,marginBottom:1}}>Gap</div>
                <div style={{fontSize:11,fontWeight:700,color:isDown?T.red:T.green,fontFamily:"monospace"}}>{isDown?"-":"+"}${Math.abs(gap)>=1000?`${(Math.abs(gap)/1000).toFixed(1)}k`:`${Math.round(Math.abs(gap))}`}</div>
              </div>
              <div style={{background:T.s2,borderRadius:6,padding:"4px 6px"}}>
                <div style={{fontSize:9,color:T.t3,marginBottom:1}}>Ret</div>
                <div style={{fontSize:11,fontWeight:700,color:ret>=95?T.green:ret>=70?T.amber:T.red,fontFamily:"monospace"}}>{ret}%</div>
              </div>
            </div>
          </button>;
        })}
      </div>
    </div>;
  }

  // ── Distributor drill-down: rep list ──
  if(selDist) {
    const rg = repGroups!;
    const knownReps = Object.keys(rg).filter(k=>k!=="__none__").sort();
    const unassigned = rg["__none__"]||[];
    const manuals = (manualReps[selDist]||[]).filter(r=>!knownReps.includes(r.name));
    const distColor = DIST_TEXT[selDist];

    const repStat = (gList:any[]) => {
      const cy=gList.reduce((s,g)=>s+g.totalCY,0);
      const py=gList.reduce((s,g)=>s+g.totalPY,0);
      const nowC=gList.reduce((s,g)=>s+g.children.filter((a:any)=>a.visitPriority==="NOW").length,0);
      const acctCount=gList.reduce((s,g)=>s+g.children.length,0);
      return {cy,py,gap:py-cy,nowC,acctCount,groupCount:gList.length};
    };

    return <div style={{paddingBottom:80}}>
      <div style={{position:"sticky",top:52,zIndex:40,background:"rgba(10,10,15,.9)",backdropFilter:"blur(20px)",borderBottom:`1px solid ${T.b3}`,padding:"10px 16px",display:"flex",alignItems:"center",gap:10}}>
        <button onClick={()=>setSelDist(null)} style={{background:"none",border:"none",color:T.blue,cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"inherit",display:"flex",alignItems:"center",gap:4}}><Back/> Dealers</button>
        <span style={{fontSize:13,fontWeight:700,color:distColor}}>{selDist}</span>
      </div>
      <div style={{padding:"16px 16px 0"}}>
        {/* Known reps from Badger */}
        {knownReps.length>0&&<>
          <div style={{fontSize:9,textTransform:"uppercase",color:T.t4,letterSpacing:"1px",marginBottom:8,fontWeight:700}}>Known Reps ({knownReps.length})</div>
          {knownReps.map((rep,i)=>{
            const s=repStat(rg[rep]);
            return <button key={rep} className="anim" onClick={()=>setSelRep(rep)}
              style={{animationDelay:`${i*20}ms`,width:"100%",textAlign:"left",background:DIST_COLORS[selDist],border:`1px solid ${DIST_BORDER[selDist]}`,borderRadius:12,padding:"11px 13px",marginBottom:7,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:700,color:distColor,marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{rep}</div>
                <div style={{fontSize:10,color:T.t3}}>{s.groupCount} group{s.groupCount!==1?"s":""} · {s.acctCount} acct{s.acctCount!==1?"s":""}{s.nowC>0?<span style={{color:"#f87171"}}> · {s.nowC} NOW</span>:""}</div>
              </div>
              <div style={{display:"flex",gap:6,flexShrink:0,marginLeft:10,alignItems:"center"}}>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:10,color:T.blue,fontWeight:600,fontFamily:"'DM Mono',monospace"}}>{$$(s.cy)}</div>
                  <div style={{fontSize:9,color:s.gap>0?T.red:T.green,fontFamily:"'DM Mono',monospace"}}>{s.gap>0?`-${$$(s.gap)}`:`+${$$(Math.abs(s.gap))}`}</div>
                </div>
                <Chev/>
              </div>
            </button>;
          })}
        </>}

        {/* Manual reps not in Badger */}
        {manuals.length>0&&<>
          <div style={{fontSize:9,textTransform:"uppercase",color:T.t4,letterSpacing:"1px",marginBottom:8,marginTop:knownReps.length>0?14:0,fontWeight:700}}>Added by You</div>
          {manuals.map((r,i)=>(
            <button key={r.name} className="anim" onClick={()=>setSelRep(r.name)}
              style={{animationDelay:`${i*20}ms`,width:"100%",textAlign:"left",background:T.s1,border:`1px solid ${T.b1}`,borderRadius:12,padding:"11px 13px",marginBottom:7,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:700,color:distColor,marginBottom:2}}>{r.name}</div>
                <div style={{fontSize:10,color:T.t3}}>{r.phone||"No phone"}{r.notes?` · ${r.notes.slice(0,40)}`:""}</div>
              </div>
              <Chev/>
            </button>
          ))}
        </>}

        {/* Unassigned accounts */}
        {unassigned.length>0&&<>
          <div style={{fontSize:9,textTransform:"uppercase",color:T.t4,letterSpacing:"1px",marginBottom:8,marginTop:14,fontWeight:700}}>No Rep Assigned ({unassigned.length})</div>
          <button onClick={()=>setSelRep("__none__")}
            style={{width:"100%",textAlign:"left",background:T.s1,border:`1px solid ${T.b1}`,borderRadius:12,padding:"11px 13px",marginBottom:12,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:12,fontWeight:600,color:T.t2}}>Unassigned groups</div>
              <div style={{fontSize:10,color:T.t3}}>{unassigned.length} group{unassigned.length!==1?"s":" "} · {unassigned.reduce((s:number,g:any)=>s+g.children.length,0)} accounts · {unassigned.reduce((s:number,g:any)=>s+g.children.filter((a:any)=>a.visitPriority==="NOW").length,0)} NOW priority</div>
            </div>
            <Chev/>
          </button>
        </>}

        {/* Add Rep form */}
        <div style={{marginTop:8,background:T.s1,border:`1px solid ${T.b1}`,borderRadius:14,padding:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:showAddRep?10:0}}>
            <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.t3}}>Add Rep</div>
            <button onClick={()=>setShowAddRep(!showAddRep)} style={{background:"rgba(79,142,247,.08)",border:"1px solid rgba(79,142,247,.18)",borderRadius:8,color:T.blue,cursor:"pointer",fontSize:11,fontWeight:600,padding:"4px 10px",fontFamily:"inherit"}}>{showAddRep?"Cancel":"+ Add"}</button>
          </div>
          {showAddRep&&<div>
            <input type="text" value={newRepName} onChange={e=>setNewRepName(e.target.value)}
              placeholder="Rep name *"
              style={{width:"100%",height:38,borderRadius:8,border:`1px solid ${T.b1}`,background:T.s2,color:T.t1,fontSize:12,padding:"0 10px",outline:"none",fontFamily:"inherit",marginBottom:7,boxSizing:"border-box"}}/>
            <input type="text" value={newRepPhone} onChange={e=>setNewRepPhone(e.target.value)}
              placeholder="Phone (optional)"
              style={{width:"100%",height:38,borderRadius:8,border:`1px solid ${T.b1}`,background:T.s2,color:T.t1,fontSize:12,padding:"0 10px",outline:"none",fontFamily:"inherit",marginBottom:7,boxSizing:"border-box"}}/>
            <input type="text" value={newRepNotes} onChange={e=>setNewRepNotes(e.target.value)}
              placeholder="Notes (optional)"
              style={{width:"100%",height:38,borderRadius:8,border:`1px solid ${T.b1}`,background:T.s2,color:T.t1,fontSize:12,padding:"0 10px",outline:"none",fontFamily:"inherit",marginBottom:10,boxSizing:"border-box"}}/>
            <button onClick={()=>{
              if(!newRepName.trim()) return;
              const entry={name:newRepName.trim(),phone:newRepPhone.trim(),notes:newRepNotes.trim(),addedAt:new Date().toISOString()};
              const updated={...manualReps,[selDist]:[...(manualReps[selDist]||[]).filter(r=>r.name!==entry.name),entry]};
              saveManualReps(updated);
              setNewRepName("");setNewRepPhone("");setNewRepNotes("");setShowAddRep(false);
            }} style={{width:"100%",background:`linear-gradient(90deg,${distColor},${T.blue})`,border:"none",borderRadius:8,padding:"10px 0",fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer",fontFamily:"inherit"}}>
              Save Rep
            </button>
          </div>}
        </div>
      </div>
    </div>;
  }

  // ── Top-level: 4 distributor cards + All Other ──
  return <div style={{padding:"16px 16px 0",paddingBottom:80}}>
    {/* Territory total summary */}
    {(()=>{
      const totalCY=scored.reduce((s,a)=>s+(a.cyQ?.["1"]||0),0);
      const totalPY=scored.reduce((s,a)=>s+(a.pyQ?.["1"]||0),0);
      const totalGap=totalPY-totalCY;
      return <div style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:12,padding:"10px 14px",marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontSize:10,color:T.t3,fontWeight:600,textTransform:"uppercase",letterSpacing:"1px"}}>All Distributors · {scored.length} accounts</div>
        <div style={{display:"flex",gap:12}}>
          <div style={{textAlign:"right"}}><div style={{fontSize:8,color:T.t4}}>CY</div><div style={{fontSize:11,fontWeight:700,color:T.blue,fontFamily:"'DM Mono',monospace"}}>{$$(totalCY)}</div></div>
          <div style={{textAlign:"right"}}><div style={{fontSize:8,color:T.t4}}>Gap</div><div style={{fontSize:11,fontWeight:700,color:totalGap<=0?T.green:T.red,fontFamily:"'DM Mono',monospace"}}>{totalGap<=0?`+${$$(Math.abs(totalGap))}`:$$(totalGap)}</div></div>
        </div>
      </div>;
    })()}
    {[...DIST_ORDER,"All Other"].map(dist=>{
      const s=distStats[dist];
      if(!s||s.accts.length===0) return null;
      const gap=s.py-s.cy;
      const ret=s.py>0?s.cy/s.py:0;
      const upCount=s.accts.filter(a=>(a.cyQ?.["1"]||0)>=(a.pyQ?.["1"]||0)).length;
      const downCount=s.accts.length-upCount;
      const isAllOther=dist==="All Other";
      // repCount: only count reps whose distributor hint matches this dist
      const repCount=isAllOther?0:Object.keys(
        s.accts.reduce((m:Record<string,boolean>,a)=>{
          const b=(typeof BADGER!=="undefined"?BADGER:{})[a.id];
          const rep=b?.dealerRep;
          if(!isNoRep(rep)){
            const hint=repDistHint(rep);
            if(!hint||hint===dist) m[rep!.trim()]=true;
          }
          return m;
        },{})
      ).length;
      const cardBg=isAllOther?"rgba(85,85,112,.12)":DIST_COLORS[dist];
      const cardBorder=isAllOther?"rgba(85,85,112,.25)":DIST_BORDER[dist];
      const cardText=isAllOther?T.t3:DIST_TEXT[dist];
      return <button key={dist} className="anim" onClick={()=>{if(!isAllOther){setSelDist(dist);setSelRep(null);setShowAddRep(false);}}}
        style={{width:"100%",textAlign:"left",background:cardBg,border:`1px solid ${cardBorder}`,borderRadius:16,padding:"14px 16px",marginBottom:10,cursor:isAllOther?"default":"pointer"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
          <div>
            <div style={{fontSize:16,fontWeight:800,color:cardText,marginBottom:2}}>{dist}</div>
            <div style={{fontSize:10,color:T.t3}}>{s.accts.length} accounts{repCount>0?` · ${repCount} rep${repCount!==1?"s":""} known`:""}{isAllOther?" · no rep drill-down":""}</div>
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            {s.nowCount>0&&<span style={{fontSize:9,fontWeight:700,color:"#f87171",background:"rgba(248,113,113,.1)",border:"1px solid rgba(248,113,113,.2)",borderRadius:6,padding:"2px 7px"}}>{s.nowCount} NOW</span>}
            {!isAllOther&&<Chev/>}
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8}}>
          <Stat l="CY" v={$$(s.cy)} c={T.blue}/>
          <Stat l="PY" v={$$(s.py)} c={T.t2}/>
          <Stat l="Gap" v={gap<=0?`+${$$(Math.abs(gap))}`:$$(gap)} c={gap<=0?T.green:T.red}/>
          <Stat l="Ret" v={Math.round(ret*100)+"%"} c={ret>.7?T.green:ret>.4?T.amber:T.red}/>
        </div>
        <div style={{display:"flex",gap:8,marginTop:8}}>
          <span style={{fontSize:9,color:T.green,background:"rgba(52,211,153,.08)",border:"1px solid rgba(52,211,153,.15)",borderRadius:6,padding:"2px 8px"}}>↑ {upCount} up</span>
          <span style={{fontSize:9,color:T.red,background:"rgba(248,113,113,.08)",border:"1px solid rgba(248,113,113,.15)",borderRadius:6,padding:"2px 8px"}}>↓ {downCount} down</span>
        </div>
      </button>;
    })}
  </div>;
}

// ─── ESTIMATOR TAB ───────────────────────────────────────────────
function EstTab({pct,setPct,q1CY,groups,goAcct}) {
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

  // Build call list: all children with PY Q1 spend, sorted by PY desc
  // These are the accounts that bought last year in this window — highest priority to call
  const callList = useMemo(() => {
    const accts = [];
    for (const g of groups) {
      for (const c of g.children) {
        const py = c.pyQ?.["1"] || 0;
        const cy = c.cyQ?.["1"] || 0;
        if (py > 0) accts.push({...c, gName: g.name, gId: g.id, gTier: g.tier, py, cy, gap: py - cy});
      }
    }
    return accts.sort((a,b) => b.py - a.py);
  }, [groups]);

  // Estimated share of PY per account (proportional)
  const pyTotalForList = callList.reduce((s,a) => s + a.py, 0);

  return <div style={{padding:"16px 16px 80px"}}>
    <div className="anim" style={{background:`linear-gradient(135deg,${T.s1},rgba(79,142,247,.04))`,border:`1px solid ${T.b1}`,borderRadius:16,padding:16,marginBottom:16}}>
      <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.blue,marginBottom:12}}>Q1 Completion Estimator</div>
      <div style={{fontSize:11,color:T.t3,marginBottom:16}}>Last year, <strong style={{color:T.t1}}>{pyAccts.toLocaleString()} accounts</strong> bought <strong style={{color:T.t1}}>{$f(pyBase)}</strong> credited in Mar 20-31. How much repeats?</div>
      <div style={{marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
          <span style={{fontSize:10,color:T.t4}}>50% of PY</span>
          <span className="m" style={{fontSize:14,fontWeight:800,color:pct>=100?T.green:T.amber}}>{pct}% repeat</span>
          <span style={{fontSize:10,color:T.t4}}>130% of PY</span>
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

    {/* ── CALL LIST ── */}
    {callList.length>0&&<div className="anim" style={{animationDelay:"80ms"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:10}}>
        <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.amber}}>Mar 20-31 Call List</div>
        <div style={{fontSize:10,color:T.t4}}>{callList.length} accounts · bought last year</div>
      </div>
      <div style={{fontSize:10,color:T.t3,marginBottom:12}}>These accounts spent in the last 12 days of Q1 last year. Highest priority to call this week.</div>
      {callList.slice(0,25).map((a,i)=>{
        const estAmt = pyTotalForList > 0 ? Math.round((a.py / pyTotalForList) * est) : 0;
        const hasCY = a.cy > 0;
        return <button key={a.id} className="anim" onClick={()=>goAcct&&goAcct(a)}
          style={{animationDelay:`${i*15}ms`,width:"100%",textAlign:"left",background:T.s1,
            border:`1px solid ${hasCY?"rgba(52,211,153,.15)":T.b1}`,
            borderRadius:12,padding:"10px 12px",marginBottom:7,cursor:"pointer"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.name}</div>
              <div style={{fontSize:10,color:T.t3,marginTop:1}}>{a.city}, {a.st}
                {a.gName&&a.gName!==a.name&&<span style={{color:T.t4}}> · {a.gName}</span>}
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0,marginLeft:10}}>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:9,color:T.t4,marginBottom:1}}>PY spend</div>
                <div className="m" style={{fontSize:12,fontWeight:700,color:T.t1}}>{$f(a.py)}</div>
              </div>
              {hasCY
                ? <div style={{textAlign:"right"}}>
                    <div style={{fontSize:9,color:T.green,marginBottom:1}}>Already bought</div>
                    <div className="m" style={{fontSize:12,fontWeight:700,color:T.green}}>{$f(a.cy)}</div>
                  </div>
                : <div style={{textAlign:"right"}}>
                    <div style={{fontSize:9,color:T.amber,marginBottom:1}}>Est. opp.</div>
                    <div className="m" style={{fontSize:12,fontWeight:700,color:T.amber}}>{$f(estAmt)}</div>
                  </div>
              }
              <Chev/>
            </div>
          </div>
        </button>;
      })}
      {callList.length>25&&<div style={{fontSize:10,color:T.t4,textAlign:"center",padding:"8px 0"}}>+{callList.length-25} more accounts with PY Q1 spend</div>}
    </div>}

    <div style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:12,padding:12,fontSize:10,color:T.t3,marginTop:8}}>
      PY base ({$f(pyBase)}) is calculated from your actual Q1 2025 data — the last ~12 days of March spending. Slider models what percentage of that repeats this year.
    </div>
  </div>;
}

// ─────────────────────────────────────────────
// OUTREACH TAB
// ─────────────────────────────────────────────
function OutreachTab({scored}:{scored:any[]}) {
  const [gmailToken, setGmailToken] = useState<string|null>(null);
  const [previews, setPreviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [minGap, setMinGap] = useState(500);
  const [emailOnly, setEmailOnly] = useState(true);
  const [editIdx, setEditIdx] = useState<number|null>(null);
  const [editBody, setEditBody] = useState("");
  const [researching, setResearching] = useState(false);
  const [researchProgress, setResearchProgress] = useState<{done:number,total:number,current:string}|null>(null);
  const [researchDone, setResearchDone] = useState<string[]>([]); // account ids researched this session
  const [refreshCount, setRefreshCount] = useState(0); // incremented after research to force queue recompute

  useEffect(()=>{
    try { const t = localStorage.getItem("gmail_refresh_token"); if(t) setGmailToken(t); } catch {}
  }, []);

  useEffect(()=>{
    const p = new URLSearchParams(window.location.search);
    const status = p.get("gmail");
    const rt = p.get("refresh_token");
    if(status==="connected" && rt) {
      localStorage.setItem("gmail_refresh_token", rt);
      setGmailToken(rt);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);


  // Research top 25 down accounts via Deep Research API and save to contact cards
  async function researchTop25() {
    setResearching(true);
    setResearchProgress({done:0, total:25, current:""});
    setResearchDone([]);

    const top25 = [...scored]
      .filter(a => (a.combinedGap ?? a.q1_gap ?? 0) < 0)
      .sort((a,b) => (a.combinedGap??a.q1_gap??0) - (b.combinedGap??b.q1_gap??0))
      .slice(0, 25);

    const found: string[] = [];
    for(let i = 0; i < top25.length; i++) {
      const a = top25[i];
      setResearchProgress({done:i, total:top25.length, current:a.name});
      try {
        const badger = BADGER[a.id] || BADGER[a.gId] || null;
        const res = await fetch("/api/deep-research", {
          method: "POST",
          headers: {"Content-Type":"application/json"},
          body: JSON.stringify({
            name: a.name,
            city: a.city,
            state: a.st || a.state || "CT",
            address: badger?.address || a.addr || "",
            dealer: a.dealer || "",
            doctor: a.doctor || badger?.doctor || "",
            gName: a.gName || "",
          })
        });
        const data = await res.json();
        if(data?.intel) {
          const intel = data.intel;
          const contacts = {
            contactName: intel.contactName || null,
            phone: intel.phone || null,
            email: intel.email || null,
            website: intel.website || null,
            savedAt: new Date().toISOString(),
            practiceName: a.name,
            talkingPoints: intel.talkingPoints || [],
            hooks: intel.hooks || [],
            ownershipNote: intel.ownershipNote || null,
          };
          const hasContact = contacts.contactName || contacts.phone || contacts.email || contacts.website;
          if(hasContact) {
            try { localStorage.setItem(`contact:${a.id}`, JSON.stringify(contacts)); } catch {}
            found.push(a.id);
          }
        }
      } catch(e) { /* skip */ }
      await new Promise(r => setTimeout(r, 800));
    }
    setResearchDone(found);
    setResearchProgress({done:25, total:25, current:""});
    setRefreshCount(c => c + 1); // force downAccounts + withEmail to recompute
    setResearching(false);
  }

  const downAccounts = useMemo(()=>{
    const acctQueue: any[] = [];
    const dedupe = new Set();

    const sorted = [...scored]
      .filter(a => {
        const gap = (a.combinedGap ?? a.q1_gap ?? 0);
        return gap < 0 && Math.abs(gap) >= minGap;
      })
      .sort((a,b) => (a.combinedGap??a.q1_gap??0) - (b.combinedGap??b.q1_gap??0));

    for (const a of sorted) {
      const badger = BADGER[a.id] || BADGER[a.gId] || null;
      const email = a.email || badger?.email || null;
      const doctor = a.doctor || badger?.doctor || null;

      if(emailOnly && !email) continue;
      if(email && dedupe.has(email)) continue;
      if(email) dedupe.add(email);

      const primaryDealer = a.dealer || "your distributor";

      acctQueue.push({
        ...a,
        email,
        doctor,
        primaryDealer,
        topSkus: a.products?.filter((p:any) => (p.py1||0) > 0)
          .sort((x:any,y:any) => (y.py1||0)-(x.py1||0))
          .slice(0,3)
          .map((p:any) => ({desc: p.n, py: p.py1||0, cy: p.cy1||0})) || [],
      });

      if(acctQueue.length >= 50) break;
    }
    return acctQueue;
  }, [scored, minGap, emailOnly, refreshCount]);

  const allDownCount = scored.filter(a=>(a.combinedGap??a.q1_gap??0)<0).length;
  const withEmail = useMemo(()=>{
    const seenEmails = new Set();
    return scored.filter(a => {
      const gap = (a.combinedGap ?? a.q1_gap ?? 0);
      if(gap >= 0) return false;
      const badger = BADGER[a.id] || BADGER[a.gId] || null;
      const email = a.email || badger?.email || null;
      if(!email) return false;
      if(seenEmails.has(email)) return false;
      seenEmails.add(email);
      return true;
    }).length;
  }, [scored, refreshCount]);

  const $f = (n:number) => "$"+Math.abs(n).toLocaleString(undefined,{maximumFractionDigits:0});

  async function generatePreviews() {
    setLoading(true); setPreviews([]); setResults([]);
    try {
      // Enrich each account with saved contact data from localStorage (Deep Research results)
      const enriched = downAccounts.map(a => {
        try {
          const saved = localStorage.getItem(`contact:${a.id}`);
          if(saved) {
            const contacts = JSON.parse(saved);
            return {
              ...a,
              email: a.email || contacts.email || null,
              doctor: a.doctor || contacts.contactName || null,
              talkingPoints: contacts.talkingPoints || [],
              hooks: contacts.hooks || [],
              ownershipNote: contacts.ownershipNote || null,
            };
          }
        } catch {}
        return a;
      });
      const res = await fetch("/api/send-outreach", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({accounts: enriched, preview: true, refreshToken: null})
      });
      const data = await res.json();
      setPreviews(data.results || []);
    } catch(e:any) { alert("Error: " + e.message); }
    finally { setLoading(false); }
  }

  async function sendAll() {
    if(!gmailToken) { alert("Connect Gmail first"); return; }
    setSending(true); setResults([]);
    try {
      const accountsToSend = previews.length > 0
        ? previews.filter(p=>p.email).map(p=>({...downAccounts.find(a=>a.id===p.id)||{}, _subject:p.subject, _body:p.body}))
        : downAccounts;
      const res = await fetch("/api/send-outreach", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({accounts: accountsToSend, refreshToken: gmailToken, preview: false})
      });
      const data = await res.json();
      setResults(data.results || []);
      if(data.error) alert("Error: " + data.error);
    } catch(e:any) { alert("Send error: " + e.message); }
    finally { setSending(false); }
  }

  return <div style={{padding:"16px 12px 80px",maxWidth:680,margin:"0 auto"}}>
    <div style={{marginBottom:16}}>
      <div style={{fontSize:18,fontWeight:700,color:T.t1,marginBottom:4}}>AI Outreach</div>
      <div style={{fontSize:12,color:T.t3}}>Personalized emails to down accounts — AI writes each one based on their actual data</div>
    </div>

    {/* Research Top 25 */}
    <div style={{background:T.s1,border:`1px solid ${researching?"rgba(167,139,250,.35)":researchDone.length>0?"rgba(52,211,153,.25)":T.b1}`,borderRadius:12,padding:12,marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:researching||researchDone.length>0?8:0}}>
        <div>
          <div style={{fontSize:12,fontWeight:700,color:researchDone.length>0?T.green:T.t2}}>
            {researchDone.length>0?`✅ Researched ${researchDone.length} accounts`:"🔬 Research Top 25 Down Accounts"}
          </div>
          <div style={{fontSize:10,color:T.t4,marginTop:2}}>
            {researchDone.length>0?"Contact cards updated · emails + doctor names found":"AI searches the web for each practice — finds emails, doctor names, contact info"}
          </div>
        </div>
        <button onClick={researchTop25} disabled={researching||scored.length===0}
          style={{flexShrink:0,marginLeft:12,padding:"8px 14px",borderRadius:8,border:"none",
            background:researching?T.s2:"rgba(167,139,250,.2)",
            color:researching?T.t4:T.purple,fontSize:11,fontWeight:700,
            cursor:researching?"not-allowed":"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
          {researching?"Running...":"Run Research"}
        </button>
      </div>
      {researching&&researchProgress&&<div>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
          <span style={{fontSize:10,color:T.t3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>
            {researchProgress.current ? `Researching: ${researchProgress.current}` : "Finishing up..."}
          </span>
          <span style={{fontSize:10,color:T.purple,flexShrink:0,marginLeft:8}}>{researchProgress.done}/{researchProgress.total}</span>
        </div>
        <div style={{height:4,background:T.s2,borderRadius:2,overflow:"hidden"}}>
          <div style={{height:"100%",background:T.purple,borderRadius:2,width:`${(researchProgress.done/researchProgress.total)*100}%`,transition:"width .3s"}}/>
        </div>
      </div>}
    </div>

    <div style={{background:T.s1,border:`1px solid ${gmailToken?T.green:T.b1}`,borderRadius:12,padding:12,marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <div>
        <div style={{fontSize:12,fontWeight:700,color:gmailToken?T.green:T.t2}}>{gmailToken?"✅ Gmail Connected":"📧 Gmail Not Connected"}</div>
        <div style={{fontSize:10,color:T.t4,marginTop:2}}>{gmailToken?"Emails send from your Gmail automatically":"Connect once to enable auto-send"}</div>
      </div>
      {gmailToken
        ? <button onClick={()=>{localStorage.removeItem("gmail_refresh_token");setGmailToken(null);}} style={{fontSize:10,color:T.t4,background:"none",border:`1px solid ${T.b1}`,borderRadius:6,padding:"4px 8px",cursor:"pointer",fontFamily:"inherit"}}>Disconnect</button>
        : <button onClick={()=>{ window.location.href="/api/gmail-auth"; }} style={{fontSize:12,fontWeight:700,color:"#fff",background:T.blue,border:"none",borderRadius:8,padding:"8px 14px",cursor:"pointer",fontFamily:"inherit"}}>Connect Gmail</button>
      }
    </div>

    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
      {[{l:"Down Accounts",v:allDownCount,c:T.red},{l:"Have Email",v:withEmail,c:T.blue},{l:"In Queue",v:downAccounts.length,c:T.amber}].map(s=>(
        <div key={s.l} style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:10,padding:"10px 8px",textAlign:"center"}}>
          <div style={{fontSize:20,fontWeight:800,color:s.c}}>{s.v}</div>
          <div style={{fontSize:9,color:T.t4,marginTop:2,textTransform:"uppercase",letterSpacing:.5}}>{s.l}</div>
        </div>
      ))}
    </div>

    <div style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:10,padding:12,marginBottom:12}}>
      <div style={{fontSize:11,fontWeight:700,color:T.t2,marginBottom:10}}>Filter Queue</div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
        <span style={{fontSize:11,color:T.t3}}>Min gap: {$f(minGap)}</span>
        <input type="range" min={0} max={5000} step={250} value={minGap} onChange={e=>setMinGap(+e.target.value)} style={{width:140,accentColor:T.blue}}/>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <button onClick={()=>setEmailOnly(!emailOnly)} style={{width:18,height:18,borderRadius:4,border:`2px solid ${emailOnly?T.blue:T.b1}`,background:emailOnly?T.blue:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          {emailOnly&&<span style={{color:"#fff",fontSize:10}}>✓</span>}
        </button>
        <span style={{fontSize:11,color:T.t3}}>Email addresses only ({withEmail} accounts)</span>
      </div>
    </div>

    <div style={{display:"flex",gap:8,marginBottom:16}}>
      <button onClick={generatePreviews} disabled={loading||downAccounts.length===0}
        style={{flex:1,padding:"11px 0",borderRadius:10,border:`1px solid ${T.blue}`,background:"transparent",color:T.blue,fontSize:12,fontWeight:700,cursor:downAccounts.length>0?"pointer":"not-allowed",opacity:downAccounts.length>0?1:.4,fontFamily:"inherit"}}>
        {loading?"✍️ Writing...":"✍️ Preview ("+downAccounts.length+")"}
      </button>
      <button onClick={sendAll} disabled={sending||!gmailToken||downAccounts.length===0}
        style={{flex:1,padding:"11px 0",borderRadius:10,border:"none",background:(!gmailToken||downAccounts.length===0)?T.s2:T.blue,color:"#fff",fontSize:12,fontWeight:700,cursor:(!gmailToken||downAccounts.length===0)?"not-allowed":"pointer",fontFamily:"inherit"}}>
        {sending?"📤 Sending...":"🚀 Send All"}
      </button>
    </div>

    {results.length>0&&<div style={{background:T.s1,border:`1px solid ${T.green}`,borderRadius:10,padding:12,marginBottom:12}}>
      <div style={{fontSize:12,fontWeight:700,color:T.green}}>
        ✅ Sent {results.filter(r=>r.status==="sent").length} · Skipped {results.filter(r=>r.status==="skipped").length} · Errors {results.filter(r=>r.status==="error").length}
      </div>
      {results.filter(r=>r.status==="error").map((r,i)=>(
        <div key={i} style={{fontSize:10,color:T.red,marginTop:4}}>⚠ {r.name}: {r.reason}</div>
      ))}
    </div>}

    {previews.length>0&&<div>
      <div style={{fontSize:11,fontWeight:700,color:T.t2,marginBottom:8,textTransform:"uppercase",letterSpacing:.5}}>Preview — Review Before Sending</div>
      {previews.map((p,i)=>(
        <div key={i} style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:10,padding:12,marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
            <div>
              <div style={{fontSize:12,fontWeight:700,color:T.t1}}>{p.name}</div>
              <div style={{fontSize:10,color:T.t4}}>{p.email||"no email"}</div>
            </div>
            <button onClick={()=>{setEditIdx(editIdx===i?null:i);setEditBody(p.body);}} style={{fontSize:10,color:T.blue,background:"none",border:`1px solid ${T.blue}`,borderRadius:6,padding:"3px 8px",cursor:"pointer",fontFamily:"inherit"}}>
              {editIdx===i?"Close":"Edit"}
            </button>
          </div>
          <div style={{fontSize:10,color:T.t3,marginBottom:4}}><span style={{color:T.t4}}>Subject: </span>{p.subject}</div>
          {editIdx===i
            ? <textarea value={editBody} onChange={e=>{setEditBody(e.target.value); previews[i].body=e.target.value;}} style={{width:"100%",minHeight:120,background:T.bg,border:`1px solid ${T.blue}`,borderRadius:6,padding:8,color:T.t1,fontSize:10,fontFamily:"inherit",resize:"vertical",boxSizing:"border-box"}}/>
            : <div style={{fontSize:10,color:T.t2,whiteSpace:"pre-wrap",lineHeight:1.6,maxHeight:80,overflow:"hidden"}}>{p.body}</div>
          }
        </div>
      ))}
    </div>}

    {scored.length===0&&<div style={{textAlign:"center",padding:"40px 0",color:T.t4,fontSize:12}}>Upload a CSV to get started.</div>}
    {scored.length>0&&downAccounts.length===0&&<div style={{textAlign:"center",padding:"40px 0",color:T.t4,fontSize:12}}>No down accounts match filters. Try lowering the minimum gap.</div>}
  </div>;
}

// ─────────────────────────────────────────────────────────────────
// ADMIN TAB — Edit patches.json directly from the app
// All changes commit to GitHub automatically. No data lost on CSV reload.
// ─────────────────────────────────────────────────────────────────
function AdminTab({groups, scored, overlays, saveOverlays}:{groups:any[], scored:any[], overlays:any, saveOverlays:any}) {
  const [section, setSection] = useState<string>("groups"); // groups | detach | names | contacts
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{msg:string,ok:boolean}|null>(null);
  // Admin reads/writes from overlays prop (passed from AppInner)
  // No local patches state needed — overlays is the single source of truth

  // Search
  const [search, setSearch] = useState("");

  // Create Group form
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupClass, setNewGroupClass] = useState("Emerging DSO");
  const [childIdInput, setChildIdInput] = useState("");
  const [childIds, setChildIds] = useState<string[]>([]);
  const [editingGroup, setEditingGroup] = useState<any>(null);

  // Detach form
  const [detachSearch, setDetachSearch] = useState("");
  const [detachAccount, setDetachAccount] = useState<any>(null);
  const [detachNewName, setDetachNewName] = useState("");

  // Name override form
  const [nameSearch, setNameSearch] = useState("");
  const [nameAccount, setNameAccount] = useState<any>(null);
  const [nameNewValue, setNameNewValue] = useState("");

  // Contact form
  const [contactSearch, setContactSearch] = useState("");
  const [contactAccount, setContactAccount] = useState<any>(null);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactNote, setContactNote] = useState("");

  const showToast = (msg:string, ok=true) => {
    setToast({msg,ok});
    setTimeout(()=>setToast(null), 3500);
  };

  // Search helper — find accounts by name/ID
  const searchAccounts = (q:string) => {
    if(!q || q.length < 2) return [];
    const ql = q.toLowerCase();
    return scored.filter(a =>
      a.name?.toLowerCase().includes(ql) ||
      a.id?.toLowerCase().includes(ql) ||
      a.city?.toLowerCase().includes(ql)
    ).slice(0,8);
  };

  // Search groups
  const searchGroups = (q:string) => {
    if(!q || q.length < 2) return [];
    const ql = q.toLowerCase();
    return groups.filter(g =>
      (g.name||'').toLowerCase().includes(ql) ||
      g.id?.toLowerCase().includes(ql)
    ).slice(0,6);
  };

  // All admin saves go through saveOverlays (central persistence service)
  // This updates in-memory state, writes to localStorage cache, and commits to GitHub
  async function adminSave(nextOverlays: any, successMsg: string) {
    setSaving(true);
    const ok = await saveOverlays(nextOverlays);
    if (ok) {
      showToast(`✅ ${successMsg}`);
      setNewGroupName(""); setChildIds([]); setChildIdInput(""); setEditingGroup(null);
      setDetachAccount(null); setDetachSearch(""); setDetachNewName("");
      setNameAccount(null); setNameSearch(""); setNameNewValue("");
      setContactAccount(null); setContactSearch(""); setContactName(""); setContactEmail(""); setContactPhone(""); setContactNote("");
    } else {
      showToast("❌ Save failed — check connection", false);
    }
    setSaving(false);
  }

  const sectionBtn = (k:string, label:string) => (
    <button onClick={()=>setSection(k)} style={{
      padding:"7px 14px", borderRadius:8, border:"none", fontFamily:"inherit",
      background:section===k?"rgba(79,142,247,.2)":"transparent",
      color:section===k?T.blue:T.t3, fontSize:11, fontWeight:700, cursor:"pointer"
    }}>{label}</button>
  );

  return <div style={{padding:"16px 12px 80px",maxWidth:680,margin:"0 auto"}}>
    {/* Header */}
    <div style={{marginBottom:16}}>
      <div style={{fontSize:18,fontWeight:700,color:T.t1,marginBottom:4}}>Data Admin</div>
      <div style={{fontSize:12,color:T.t3}}>Fix groupings, names, and contacts — changes save to GitHub automatically and survive any CSV upload</div>
    </div>

    {/* Toast */}
    {toast&&<div style={{background:toast.ok?"rgba(52,211,153,.12)":"rgba(248,113,113,.12)",border:`1px solid ${toast.ok?"rgba(52,211,153,.3)":"rgba(248,113,113,.3)"}`,borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:12,color:toast.ok?T.green:T.red}}>
      {toast.msg}
    </div>}

    {/* Section tabs */}
    <div style={{display:"flex",gap:4,marginBottom:16,background:T.s1,borderRadius:10,padding:4}}>
      {sectionBtn("groups","📁 Groups")}
      {sectionBtn("detach","✂️ Detach")}
      {sectionBtn("names","✏️ Names")}
      {sectionBtn("contacts","📇 Contacts")}
      {sectionBtn("dupes","🔗 Dupes")}
    </div>

    {/* ── GROUPS SECTION ── */}
    {section==="groups"&&<div>
      {/* Existing patch groups */}
      {(Object.values(overlays?.groups||{})).length>0&&<div style={{marginBottom:16}}>
        <div style={{fontSize:11,fontWeight:700,color:T.t3,textTransform:"uppercase",letterSpacing:.5,marginBottom:8}}>Existing Custom Groups</div>
        {(Object.values(overlays?.groups||{})).map((g:any)=>(
          <div key={g.id} style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:10,padding:12,marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
              <div style={{fontSize:13,fontWeight:700,color:T.t1}}>{g.name}</div>
              <div style={{display:"flex",gap:6}}>
                <button onClick={()=>{setEditingGroup(g);setNewGroupName(g.name);setNewGroupClass(g.class2||"Emerging DSO");setChildIds(g.childIds||[]);}} style={{fontSize:10,color:T.blue,background:"none",border:`1px solid ${T.blue}`,borderRadius:6,padding:"3px 8px",cursor:"pointer",fontFamily:"inherit"}}>Edit</button>
                <button onClick={()=>{
                  if(saveOverlays){
                    const next={...OVERLAYS_REF,groups:{...(OVERLAYS_REF.groups||{})}};
                    delete next.groups[g.id];
                    saveOverlays(next).then(ok=>{ if(ok) showToast("✅ Deleted"); else showToast("❌ Delete failed",false); });
                  }
                }} disabled={saving} style={{fontSize:10,color:T.red,background:"none",border:`1px solid ${T.red}`,borderRadius:6,padding:"3px 8px",cursor:"pointer",fontFamily:"inherit"}}>Delete</button>
              </div>
            </div>
            <div style={{fontSize:10,color:T.t4}}>{g.class2} · {(g.childIds||[]).length} locations</div>
            {g.note&&<div style={{fontSize:10,color:T.t3,marginTop:4,fontStyle:"italic"}}>{g.note}</div>}
          </div>
        ))}
      </div>}

      {/* Create / Edit group form */}
      <div style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:12,padding:14}}>
        <div style={{fontSize:12,fontWeight:700,color:T.t2,marginBottom:12}}>{editingGroup?"✏️ Edit Group":"➕ Create New Group"}</div>
        
        <div style={{marginBottom:10}}>
          <div style={{fontSize:10,color:T.t3,marginBottom:4}}>Group Name</div>
          <input value={newGroupName} onChange={e=>setNewGroupName(e.target.value)} placeholder="e.g. Resolute Dental Partners"
            style={{width:"100%",padding:"9px 12px",borderRadius:8,border:`1px solid ${T.b1}`,background:T.bg,color:T.t1,fontSize:12,fontFamily:"inherit",boxSizing:"border-box"}}/>
        </div>

        <div style={{marginBottom:10}}>
          <div style={{fontSize:10,color:T.t3,marginBottom:4}}>Type</div>
          <select value={newGroupClass} onChange={e=>setNewGroupClass(e.target.value)}
            style={{width:"100%",padding:"9px 12px",borderRadius:8,border:`1px solid ${T.b1}`,background:T.bg,color:T.t1,fontSize:12,fontFamily:"inherit"}}>
            <option>Emerging DSO</option>
            <option>DSO</option>
            <option>Private Practice</option>
            <option>Academic</option>
          </select>
        </div>

        <div style={{marginBottom:10}}>
          <div style={{fontSize:10,color:T.t3,marginBottom:4}}>Add Locations — search by name, city, or address</div>
          <div style={{position:"relative",marginBottom:6}}>
            <input value={childIdInput} onChange={e=>setChildIdInput(e.target.value)}
              placeholder="Search: office name, city, doctor..."
              style={{width:"100%",padding:"10px 32px 10px 12px",borderRadius:10,border:`1px solid ${childIdInput.length>=2?T.blue:T.b1}`,background:T.bg,color:T.t1,fontSize:13,fontFamily:"inherit",boxSizing:"border-box",outline:"none"}}/>
            {childIdInput.length>=1&&<button onClick={()=>setChildIdInput("")} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:T.t4,cursor:"pointer",fontSize:14,padding:0}}>✕</button>}
          </div>
          {/* Search results */}
          {childIdInput.length>=2&&(()=>{
            const results = searchAccounts(childIdInput).filter(a=>!childIds.includes(a.id));
            if(results.length===0) return <div style={{fontSize:11,color:T.t4,padding:"8px 0",textAlign:"center"}}>No matches for "{childIdInput}"</div>;
            return <div style={{border:`1px solid ${T.b2}`,borderRadius:10,background:T.s1,overflow:"hidden",marginBottom:8,maxHeight:280,overflowY:"auto"}}>
              {results.map((a,i)=>{
                const py=a.pyQ?.["1"]||0, cy=a.cyQ?.["1"]||0;
                return <button key={a.id} onClick={()=>{setChildIds([...childIds,a.id]);setChildIdInput("");}}
                  style={{display:"flex",width:"100%",textAlign:"left",padding:"10px 12px",background:i%2===0?"transparent":"rgba(255,255,255,.02)",border:"none",borderBottom:i<results.length-1?`1px solid ${T.b1}`:"none",cursor:"pointer",fontFamily:"inherit",alignItems:"center",gap:10}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:600,color:T.t1,marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.name}</div>
                    <div style={{fontSize:10,color:T.t3}}>{a.city}{a.st?`, ${a.st}`:""}{a.gName?` · ${a.gName}`:""}</div>
                    <div style={{fontSize:9,color:T.t4,marginTop:1}}>{a.dealer||"Unknown"} · PY {$$(py)} / CY {$$(cy)}</div>
                  </div>
                  <div style={{flexShrink:0,background:"rgba(79,142,247,.1)",border:"1px solid rgba(79,142,247,.2)",borderRadius:8,padding:"4px 10px",fontSize:10,fontWeight:700,color:T.blue}}>+ Add</div>
                </button>;
              })}
            </div>;
          })()}
          {/* Selected accounts */}
          {childIds.length>0&&<div style={{marginTop:4}}>
            <div style={{fontSize:9,textTransform:"uppercase",color:T.t4,letterSpacing:"1px",marginBottom:6,fontWeight:700}}>Selected ({childIds.length}){(()=>{const t=childIds.reduce((s,id)=>{const a=scored.find(x=>x.id===id);return s+(a?.pyQ?.["1"]||0);},0);return t>0?<span style={{color:T.amber,textTransform:"none",letterSpacing:0}}> · Combined PY {$$(t)}</span>:"";})()}</div>
            {childIds.map(id=>{
              const acct = scored.find(a=>a.id===id);
              const py=acct?.pyQ?.["1"]||0, cy=acct?.cyQ?.["1"]||0;
              return <div key={id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",background:T.s2,borderRadius:8,marginBottom:4,border:`1px solid ${T.b1}`}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:11,fontWeight:600,color:T.t1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{acct?acct.name:id}</div>
                  <div style={{fontSize:9,color:T.t3}}>{acct?`${acct.city||""} · ${acct.dealer||"Unknown"} · PY ${$$(py)}`:id}</div>
                </div>
                <button onClick={()=>setChildIds(childIds.filter(x=>x!==id))} style={{background:"rgba(248,113,113,.1)",border:"1px solid rgba(248,113,113,.2)",borderRadius:6,color:T.red,cursor:"pointer",fontSize:10,fontWeight:600,padding:"3px 8px",fontFamily:"inherit",flexShrink:0}}>Remove</button>
              </div>;
            })}
          </div>}
        </div>

        <button onClick={()=>{
          if(!newGroupName.trim()||childIds.length===0){showToast("❌ Need a name and at least one account",false);return;}
          const id = editingGroup?.id || `Master-CUSTOM-${Date.now()}`;
          // Save group to overlays (durable) instead of old save-patch
        if (saveOverlays) {
          const grp = {id,name:newGroupName.trim(),class2:newGroupClass,childIds,tier:"Standard",createdAt:editingGroup?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
          const next = { ...OVERLAYS_REF, groups: { ...(OVERLAYS_REF.groups||{}), [id]: grp } };
          saveOverlays(next).then(ok => { if(ok) showToast("✅ Group saved"); else showToast("❌ Save failed",false); });
        }
        }} disabled={saving||!newGroupName.trim()||childIds.length===0}
          style={{width:"100%",padding:"11px 0",borderRadius:10,border:"none",background:(!newGroupName.trim()||childIds.length===0)?T.s2:T.blue,color:"#fff",fontSize:13,fontWeight:700,cursor:(!newGroupName.trim()||childIds.length===0)?"not-allowed":"pointer",fontFamily:"inherit"}}>
          {saving?"Saving...":editingGroup?"Update Group":"Create Group"}
        </button>
        {editingGroup&&<button onClick={()=>{setEditingGroup(null);setNewGroupName("");setChildIds([]);}} style={{width:"100%",marginTop:6,padding:"9px 0",borderRadius:10,border:`1px solid ${T.b1}`,background:"transparent",color:T.t3,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Cancel Edit</button>}
      </div>
    </div>}

    {/* ── DETACH SECTION ── */}
    {section==="detach"&&<div>
      {(overlays?.groupDetaches||[]).length>0&&<div style={{marginBottom:16}}>
        <div style={{fontSize:11,fontWeight:700,color:T.t3,textTransform:"uppercase",letterSpacing:.5,marginBottom:8}}>Current Detachments</div>
        {(overlays?.groupDetaches||[]).map((d:any)=>(
          <div key={d.childId} style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:10,padding:12,marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:12,fontWeight:700,color:T.t1}}>{d.newGroupName}</div>
              <div style={{fontSize:10,color:T.t4}}>Detached from {d.fromGroupId} · {d.reason}</div>
            </div>
            <button onClick={()=>adminSave({...OVERLAYS_REF,groupDetaches:(OVERLAYS_REF.groupDetaches||[]).filter((x:any)=>x.childId!==d.childId)},"Detach removed")} disabled={saving} style={{fontSize:10,color:T.red,background:"none",border:`1px solid ${T.red}`,borderRadius:6,padding:"3px 8px",cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>Remove</button>
          </div>
        ))}
      </div>}

      <div style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:12,padding:14}}>
        <div style={{fontSize:12,fontWeight:700,color:T.t2,marginBottom:4}}>✂️ Detach Account from Wrong Group</div>
        <div style={{fontSize:11,color:T.t4,marginBottom:12}}>Use when Kerr's MDM incorrectly parents an account under the wrong group</div>

        <div style={{marginBottom:10}}>
          <div style={{fontSize:10,color:T.t3,marginBottom:4}}>Search Account to Detach</div>
          <input value={detachSearch} onChange={e=>{setDetachSearch(e.target.value);setDetachAccount(null);}}
            placeholder="Type account name..."
            style={{width:"100%",padding:"9px 12px",borderRadius:8,border:`1px solid ${T.b1}`,background:T.bg,color:T.t1,fontSize:12,fontFamily:"inherit",boxSizing:"border-box"}}/>
          {detachSearch.length>=2&&!detachAccount&&searchAccounts(detachSearch).map(a=>(
            <button key={a.id} onClick={()=>{setDetachAccount(a);setDetachSearch(a.name);setDetachNewName(a.name);}}
              style={{display:"block",width:"100%",textAlign:"left",padding:"7px 10px",borderRadius:6,border:`1px solid ${T.b1}`,background:T.s2,color:T.t2,fontSize:11,cursor:"pointer",fontFamily:"inherit",marginTop:3}}>
              {a.name} · {a.city} · <span style={{color:T.t4}}>{a.gName||"no group"}</span>
            </button>
          ))}
        </div>

        {detachAccount&&<div>
          <div style={{background:T.s2,borderRadius:8,padding:10,marginBottom:10}}>
            <div style={{fontSize:11,fontWeight:700,color:T.amber}}>Detaching: {detachAccount.name}</div>
            <div style={{fontSize:10,color:T.t4}}>From group: {detachAccount.gName||"unknown"} ({detachAccount.gId})</div>
          </div>
          <div style={{marginBottom:10}}>
            <div style={{fontSize:10,color:T.t3,marginBottom:4}}>Standalone Group Name</div>
            <input value={detachNewName} onChange={e=>setDetachNewName(e.target.value)}
              style={{width:"100%",padding:"9px 12px",borderRadius:8,border:`1px solid ${T.b1}`,background:T.bg,color:T.t1,fontSize:12,fontFamily:"inherit",boxSizing:"border-box"}}/>
          </div>
          <button onClick={()=>{
            const det={childId:detachAccount.id,fromGroupId:detachAccount.gId,newGroupId:`${detachAccount.id}-standalone`,newGroupName:detachNewName.trim()||detachAccount.name,reason:"Manual correction via Admin tab"};
            adminSave({...OVERLAYS_REF,groupDetaches:[...(OVERLAYS_REF.groupDetaches||[]).filter((x:any)=>x.childId!==det.childId),det]},"Account detached");
          }} disabled={saving||!detachNewName.trim()}
            style={{width:"100%",padding:"11px 0",borderRadius:10,border:"none",background:T.amber,color:"#000",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
            {saving?"Saving...":"Detach Account"}
          </button>
        </div>}
      </div>
    </div>}

    {/* ── NAME OVERRIDES SECTION ── */}
    {section==="names"&&<div>
      {(Object.entries(overlays?.nameOverrides||{}).map(([id,name]:any)=>({id,name}))).length>0&&<div style={{marginBottom:16}}>
        <div style={{fontSize:11,fontWeight:700,color:T.t3,textTransform:"uppercase",letterSpacing:.5,marginBottom:8}}>Current Name Overrides</div>
        {(Object.entries(overlays?.nameOverrides||{}).map(([id,name]:any)=>({id,name}))).map((n:any)=>(
          <div key={n.id} style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:10,padding:12,marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:12,fontWeight:700,color:T.t1}}>{n.name}</div>
              <div style={{fontSize:10,color:T.t4}}>{n.id} · {n.reason}</div>
            </div>
            <button onClick={()=>{const nm={...((OVERLAYS_REF.nameOverrides)||{})};delete nm[n.id];adminSave({...OVERLAYS_REF,nameOverrides:nm},"Name override removed");}} disabled={saving} style={{fontSize:10,color:T.red,background:"none",border:`1px solid ${T.red}`,borderRadius:6,padding:"3px 8px",cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>Remove</button>
          </div>
        ))}
      </div>}

      <div style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:12,padding:14}}>
        <div style={{fontSize:12,fontWeight:700,color:T.t2,marginBottom:4}}>✏️ Fix Account Name</div>
        <div style={{fontSize:11,color:T.t4,marginBottom:12}}>Override a bad MDM name with the correct practice name</div>

        <div style={{marginBottom:10}}>
          <input value={nameSearch} onChange={e=>{setNameSearch(e.target.value);setNameAccount(null);}}
            placeholder="Search account to rename..."
            style={{width:"100%",padding:"9px 12px",borderRadius:8,border:`1px solid ${T.b1}`,background:T.bg,color:T.t1,fontSize:12,fontFamily:"inherit",boxSizing:"border-box"}}/>
          {nameSearch.length>=2&&!nameAccount&&searchAccounts(nameSearch).map(a=>(
            <button key={a.id} onClick={()=>{setNameAccount(a);setNameSearch(a.name);setNameNewValue(a.name);}}
              style={{display:"block",width:"100%",textAlign:"left",padding:"7px 10px",borderRadius:6,border:`1px solid ${T.b1}`,background:T.s2,color:T.t2,fontSize:11,cursor:"pointer",fontFamily:"inherit",marginTop:3}}>
              {a.name} · {a.city} · {a.id}
            </button>
          ))}
        </div>

        {nameAccount&&<div>
          <div style={{marginBottom:10}}>
            <div style={{fontSize:10,color:T.t3,marginBottom:4}}>New Name</div>
            <input value={nameNewValue} onChange={e=>setNameNewValue(e.target.value)}
              style={{width:"100%",padding:"9px 12px",borderRadius:8,border:`1px solid ${T.b1}`,background:T.bg,color:T.t1,fontSize:12,fontFamily:"inherit",boxSizing:"border-box"}}/>
          </div>
          <button onClick={()=>adminSave({...OVERLAYS_REF,nameOverrides:{...(OVERLAYS_REF.nameOverrides||{}),[nameAccount.id]:nameNewValue.trim()}},"Name saved")} disabled={saving||!nameNewValue.trim()}
            style={{width:"100%",padding:"11px 0",borderRadius:10,border:"none",background:T.blue,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
            {saving?"Saving...":"Save Name Override"}
          </button>
        </div>}
      </div>
    </div>}

    {/* ── CONTACTS SECTION ── */}
    {section==="contacts"&&<div>
      {(Object.entries(overlays?.contacts||{}).map(([id,c]:any)=>({id,...c}))).length>0&&<div style={{marginBottom:16}}>
        <div style={{fontSize:11,fontWeight:700,color:T.t3,textTransform:"uppercase",letterSpacing:.5,marginBottom:8}}>Saved Contacts</div>
        {(Object.entries(overlays?.contacts||{}).map(([id,c]:any)=>({id,...c}))).map((c:any)=>(
          <div key={c.id} style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:10,padding:12,marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <div style={{fontSize:12,fontWeight:700,color:T.t1}}>{c.contactName}</div>
              <div style={{fontSize:10,color:T.cyan}}>{c.email}</div>
              <div style={{fontSize:10,color:T.t4}}>{c.id}</div>
            </div>
            <button onClick={()=>{const ct={...(OVERLAYS_REF.contacts||{})};delete ct[c.id];adminSave({...OVERLAYS_REF,contacts:ct},"Contact removed");}} disabled={saving} style={{fontSize:10,color:T.red,background:"none",border:`1px solid ${T.red}`,borderRadius:6,padding:"3px 8px",cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>Remove</button>
          </div>
        ))}
      </div>}

      <div style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:12,padding:14}}>
        <div style={{fontSize:12,fontWeight:700,color:T.t2,marginBottom:4}}>📇 Add Contact Info</div>
        <div style={{fontSize:11,color:T.t4,marginBottom:12}}>Save a PM, office manager, or doctor email to an account</div>

        <div style={{marginBottom:10}}>
          <input value={contactSearch} onChange={e=>{setContactSearch(e.target.value);setContactAccount(null);}}
            placeholder="Search account..."
            style={{width:"100%",padding:"9px 12px",borderRadius:8,border:`1px solid ${T.b1}`,background:T.bg,color:T.t1,fontSize:12,fontFamily:"inherit",boxSizing:"border-box"}}/>
          {contactSearch.length>=2&&!contactAccount&&searchAccounts(contactSearch).map(a=>(
            <button key={a.id} onClick={()=>{setContactAccount(a);setContactSearch(a.name);}}
              style={{display:"block",width:"100%",textAlign:"left",padding:"7px 10px",borderRadius:6,border:`1px solid ${T.b1}`,background:T.s2,color:T.t2,fontSize:11,cursor:"pointer",fontFamily:"inherit",marginTop:3}}>
              {a.name} · {a.city} · {a.id}
            </button>
          ))}
        </div>

        {contactAccount&&<div>
          <div style={{background:T.s2,borderRadius:8,padding:8,marginBottom:10}}>
            <div style={{fontSize:11,fontWeight:700,color:T.blue}}>{contactAccount.name} · {contactAccount.city}</div>
          </div>
          {[
            {label:"Contact Name", val:contactName, set:setContactName, placeholder:"Dr. Smith or Brittany Burroughs"},
            {label:"Email", val:contactEmail, set:setContactEmail, placeholder:"email@practice.com"},
            {label:"Phone", val:contactPhone, set:setContactPhone, placeholder:"860-555-1234"},
            {label:"Note", val:contactNote, set:setContactNote, placeholder:"PM, office manager, etc."},
          ].map(f=>(
            <div key={f.label} style={{marginBottom:8}}>
              <div style={{fontSize:10,color:T.t3,marginBottom:3}}>{f.label}</div>
              <input value={f.val} onChange={e=>f.set(e.target.value)} placeholder={f.placeholder}
                style={{width:"100%",padding:"8px 10px",borderRadius:8,border:`1px solid ${T.b1}`,background:T.bg,color:T.t1,fontSize:11,fontFamily:"inherit",boxSizing:"border-box"}}/>
            </div>
          ))}
          <button onClick={()=>saveOverlays&&saveOverlays({...OVERLAYS_REF,contacts:{...(OVERLAYS_REF.contacts||{}),[contactAccount.id]:{contactName:contactName.trim()||undefined,email:contactEmail.trim()||undefined,phone:contactPhone.trim()||undefined,note:contactNote.trim()||undefined,savedAt:new Date().toISOString()}}}).then(ok=>{if(ok)showToast("✅ Contact saved");else showToast("❌ Save failed",false);})} disabled={saving||(!contactName.trim()&&!contactEmail.trim())}
            style={{width:"100%",padding:"11px 0",borderRadius:10,border:"none",background:T.blue,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
            {saving?"Saving...":"Save Contact"}
          </button>
        </div>}
      </div>
    </div>}

    {/* ── DUPLICATES REVIEW SECTION ── */}
    {section==="dupes"&&<div>
      <div style={{fontSize:14,fontWeight:700,color:T.t1,marginBottom:4}}>Duplicate Review</div>
      <div style={{fontSize:11,color:T.t3,marginBottom:14}}>Accounts at the same address in different groups. Merge the ones that are the same office — skip shared buildings with different practices.</div>
      {(()=>{
        // Build address-matched candidates from live scored data
        const normAddr = (a:string) => {
          if(!a) return '';
          let n = a.toLowerCase().trim();
          n = n.replace(/\b\d{5}(-\d{4})?\b/g,'');
          n = n.replace(/,?\s*(ct|ma|ri|ny|nj|pa)\s*$/,'');
          n = n.replace(/street/g,'st').replace(/avenue/g,'ave').replace(/road/g,'rd');
          n = n.replace(/drive/g,'dr').replace(/boulevard/g,'blvd').replace(/turnpike/g,'tpke');
          return n.replace(/[,\s]+$/,'').replace(/\s+/g,' ').trim();
        };
        const B = typeof BADGER!=='undefined'?BADGER:{};
        const addrMap: Record<string,any[]> = {};
        scored.forEach((a:any)=>{
          const addr = B[a.id]?.address || '';
          const na = normAddr(addr);
          if(na && na.length > 5) {
            if(!addrMap[na]) addrMap[na] = [];
            addrMap[na].push({...a, addr});
          }
        });

        // Filter to addresses with accounts in different groups
        const dismissed: Record<string,boolean> = (() => { try { return JSON.parse(localStorage.getItem("dupe_dismissed")||"{}"); } catch { return {}; } })();
        const merged: Record<string,boolean> = {};
        // Check which are already merged in overlays
        Object.values(overlays?.groups||{}).forEach((g:any) => {
          (g.childIds||[]).forEach((cid:string) => { merged[cid] = true; });
        });

        const candidates = Object.entries(addrMap)
          .filter(([addr, accts]) => {
            if(accts.length < 2) return false;
            const gids = new Set(accts.map((a:any) => a.gId));
            if(gids.size <= 1) return false;
            // Skip if already merged
            if(accts.every((a:any) => merged[a.id])) return false;
            // Skip dismissed
            if(dismissed[addr]) return false;
            return true;
          })
          .map(([addr, accts]) => ({
            addr,
            accts: accts.sort((a:any,b:any) => (b.pyQ?.["1"]||0) - (a.pyQ?.["1"]||0)),
            totalPY: accts.reduce((s:number,a:any) => s+(a.pyQ?.["1"]||0), 0),
            totalCY: accts.reduce((s:number,a:any) => s+(a.cyQ?.["1"]||0), 0),
          }))
          .filter(c => Math.abs(c.totalPY) + Math.abs(c.totalCY) > 50)
          .sort((a,b) => (b.totalPY+b.totalCY) - (a.totalPY+a.totalCY));

        if(candidates.length === 0) return <div style={{fontSize:12,color:T.t4,textAlign:"center",padding:"30px 0"}}>No duplicate candidates found. All address matches have been reviewed or merged.</div>;

        return <div>
          <div style={{fontSize:10,color:T.t4,marginBottom:10}}>{candidates.length} address{candidates.length!==1?"es":""} with potential duplicates</div>
          {candidates.map((c:any, ci:number) => (
            <div key={c.addr} className="anim" style={{animationDelay:`${ci*30}ms`,background:T.s1,border:`1px solid ${T.b1}`,borderRadius:14,padding:14,marginBottom:10}}>
              <div style={{fontSize:10,color:T.cyan,marginBottom:8,fontWeight:600}}>📍 {c.addr}</div>
              {c.accts.map((a:any) => {
                const py=a.pyQ?.["1"]||0, cy=a.cyQ?.["1"]||0;
                const isDSO = (groups||[]).find((g:any)=>g.id===a.gId)?.locs > 1;
                return <div key={a.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",background:T.s2,borderRadius:8,marginBottom:4}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:11,fontWeight:600,color:T.t1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.name}{isDSO?<span style={{fontSize:9,color:T.purple,marginLeft:4}}>DSO</span>:""}</div>
                    <div style={{fontSize:9,color:T.t3}}>{a.dealer||"Unknown"} · PY {$$(py)} / CY {$$(cy)} · {a.gName?.slice(0,25)}</div>
                  </div>
                </div>;
              })}
              <div style={{display:"flex",gap:6,marginTop:8}}>
                <button onClick={()=>{
                  // Merge all accounts at this address into one group
                  const primary = c.accts.reduce((best:any,a:any) => ((a.pyQ?.["1"]||0)+(a.cyQ?.["1"]||0)) > ((best.pyQ?.["1"]||0)+(best.cyQ?.["1"]||0)) ? a : best, c.accts[0]);
                  const childIds = c.accts.map((a:any) => a.id);
                  const id = `Master-MERGE-${primary.id.split("-").pop()}`;
                  if(saveOverlays) {
                    const grp = {id, name: primary.name, class2: "Private Practice", tier: "Standard",
                      childIds, note: `Merged: same address (${c.addr}). ${c.accts.length} accounts from different dealers.`,
                      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()};
                    const next = {...OVERLAYS_REF, groups:{...(OVERLAYS_REF.groups||{}), [id]: grp}};
                    saveOverlays(next).then((ok:boolean) => { if(ok) showToast(`✅ Merged ${c.accts.length} accounts as "${primary.name}"`); else showToast("❌ Merge failed",false); });
                  }
                }} style={{flex:1,padding:"8px 0",borderRadius:8,border:"none",background:T.blue,color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                  Merge ({c.accts.length} accounts)
                </button>
                <button onClick={()=>{
                  const updated = {...dismissed, [c.addr]: true};
                  try { localStorage.setItem("dupe_dismissed", JSON.stringify(updated)); } catch {}
                  showToast("Skipped — won't show again");
                }} style={{padding:"8px 14px",borderRadius:8,border:`1px solid ${T.b1}`,background:"transparent",color:T.t3,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                  Skip
                </button>
              </div>
            </div>
          ))}
        </div>;
      })()}
    </div>}
  </div>;
}
