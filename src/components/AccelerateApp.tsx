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

// ─── OVERLAY EDGE CASES (Phase 2 audit, verified March 2026) ──────────
// - Stale childIds in group_creates: handled — stub entries created (line ~166)
// - groupDetaches referencing missing fromGroupId: safe — forEach silently skips
// - Contact overlays for non-existent IDs: safe — creates BADGER entry, harmless
// - nameOverrides for IDs not in any group: safe — map has unused entries
// - Empty overlays object: safe — all sections default to {} or []

// ─── EXTRACTED MODULES (Phase 3) ─────────────────────────────────
// These were inline in this file. Extracted to src/lib/ for reuse and clarity.
import { T, Q1_TARGET, FY_TARGET, DAYS_LEFT, HOME_LAT, HOME_LNG } from "@/lib/tokens";
import {
  ACCEL_RATES, normalizeTier, isTop100, normalizePracticeType,
  getTierRate, isAccelTier, getTierLabel, extractGroupName,
} from "@/lib/tier";
import { $$, $f, pc, scoreAccount, getHealthStatus } from "@/lib/format";
import { parseCSV, parseCSVLine, processCSVData, setDealers } from "@/lib/csv";

import { SKU } from "@/data/sku-data";
import GroupsTab from "@/components/tabs/GroupsTab";
import DashTab from "@/components/tabs/DashTab";
import MapTab from "@/components/tabs/MapTab";
import EstTab from "@/components/tabs/EstTab";
// ─── PHASE 4: Tab components extracted to src/components/tabs/ ────
import TodayTab from "@/components/tabs/TodayTab";
import GroupDetail from "@/components/tabs/GroupDetail";
import AcctDetail from "@/components/tabs/AcctDetail";
import DealersTab from "@/components/tabs/DealersTab";
import OutreachTab from "@/components/tabs/OutreachTab";
import AdminTab from "@/components/tabs/AdminTab";
// ─── PHASE 5: Tab components extracted to src/components/tabs/ ────

// ─── ICONS ───────────────────────────────────────────────────────
const Back = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>;
const Chev = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{opacity:.4,flexShrink:0}}><path d="M9 18l6-6-6-6"/></svg>;
const UploadIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
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
const cleanParentName = (name) => {
  if (!name) return "";
  return name.replace(/\s*:\s*Master-CM\d+$/i, "").trim();
};
const fixGroupName = (g) => {
  if (!g) return "Unknown";
  const authName = PARENT_NAMES[g.id];
  if (authName && !BAD_GROUP_NAMES.has(authName)) return authName;
  const cleaned = cleanParentName(g.name);
  if (cleaned && !BAD_GROUP_NAMES.has(cleaned)) return cleaned;
  if (g.children?.length === 1) return g.children[0].name;
  if (g.children?.length > 1) return `${g.children[0].name} (+${g.children.length-1})`;
  return cleaned || g.id || "Unknown";
};

// ─── SMALL COMPONENTS ────────────────────────────────────────────
const Pill = ({l,v,c}) => <div><span style={{fontSize:9,textTransform:"uppercase",color:T.t3}}>{l} </span><span className="m" style={{fontSize:12,fontWeight:700,color:c}}>{v}</span></div>;
const Stat = ({l,v,c}) => <div style={{background:T.s2,borderRadius:8,padding:"8px 10px",textAlign:"center"}}><div style={{fontSize:9,textTransform:"uppercase",color:T.t3,marginBottom:2}}>{l}</div><div className="m" style={{fontSize:14,fontWeight:700,color:c}}>{v}</div></div>;
const Bar = ({pct, color}) => <div style={{width:"100%",height:6,borderRadius:3,background:T.s3,overflow:"hidden"}}><div className="bar-g" style={{height:"100%",borderRadius:3,width:`${Math.min(Math.max(pct,0),100)}%`,background:color||`linear-gradient(90deg,${T.blue},${T.cyan})`}}/></div>;

// ─── SHARED ACCOUNT IDENTITY ─────────────────────────────────────
const AccountId = ({name, gName, size="md", color}:{name:string, gName?:string, size?:"sm"|"md"|"lg", color?:string}) => {
  const showParent = gName && gName !== name && gName.toLowerCase() !== name.toLowerCase();
  const fs = size==="sm"?11:size==="lg"?15:12;
  const fw = size==="sm"?500:size==="lg"?700:600;
  const pfs = size==="sm"?9:size==="lg"?11:10;
  return <div style={{minWidth:0,overflow:"hidden"}}>
    <div style={{fontSize:fs,fontWeight:fw,color:color||T.t1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</div>
    {showParent&&<div style={{fontSize:pfs,color:T.cyan,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginTop:1}}>↳ {gName}</div>}
  </div>;
};

// ─── SKU PRICING (2025 Kerr Accelerate Formulary +3% for 2026) ──
// [sku, desc, cat, stdWS, stdMSRP, diaWS, diaMSRP, platWS, platMSRP, goldWS, goldMSRP, silvWS, silvMSRP]
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
          <div style={{borderTop:`1px solid ${T.b1}`,margin:"4px 16px 0",padding:"8px 0 4px",display:"flex",justifyContent:"center"}}>
            <span style={{fontSize:9,color:T.t4,letterSpacing:".5px",fontFamily:"monospace"}}>{(process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA||"dev").slice(0,7)}</span>
          </div>
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

