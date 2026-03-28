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
        <div style={{fontSize:13,color:"#6b6b80",marginBottom:12,maxWidth:320}}>Accelerate hit an unexpected error. Tap below to reload.</div>
        <div style={{fontSize:11,color:"#ff6b6b",marginBottom:16,maxWidth:360,wordBreak:"break-all",background:"rgba(255,100,100,.08)",border:"1px solid rgba(255,100,100,.2)",borderRadius:8,padding:"8px 12px",textAlign:"left"}}>{String(this.state.err)}<br/><br/>{this.state.info?.componentStack?.slice(0,300)}</div>
        <button onClick={()=>this.setState({err:null,info:null})} style={{padding:"10px 24px",background:"#4f8ef7",color:"#fff",border:"none",borderRadius:10,cursor:"pointer",fontFamily:"inherit",fontSize:14,fontWeight:600}}>
          Reload App
        </button>
      </div>;
    }
    return this.props.children;
  }
}

// ─── TAB ERROR BOUNDARY ───────────────────────────────────────────
// Wraps only the tab content area so a runtime error in one tab
// does not unmount the header or nav bar.
//
// Usage: <TabErrorBoundary key={tab+(view?.type||"")} onReset={fn}>
//   {tab content}
// </TabErrorBoundary>
//
// key includes current tab + view type so the boundary automatically
// resets when Ken taps a different tab — no stale error state.
class TabErrorBoundary extends Component<
  {children:any; onReset:()=>void},
  {err:any; info:any}
> {
  constructor(p:any){super(p);this.state={err:null,info:null};}
  static getDerivedStateFromError(e:any){return{err:e};}
  componentDidCatch(e:any,i:any){this.setState({err:e,info:i});}
  render(){
    if(this.state.err){
      return (
        <div style={{padding:"20px 16px 80px",minHeight:"60vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"rgba(248,113,113,.08)",border:"1px solid rgba(248,113,113,.22)",borderRadius:14,padding:"20px 18px",maxWidth:420,width:"100%",textAlign:"center"}}>
            <div style={{fontSize:28,marginBottom:10}}>⚡</div>
            <div style={{fontSize:15,fontWeight:700,color:"#f0f0f5",marginBottom:6}}>This tab hit an error</div>
            <div style={{fontSize:12,color:"#a0a0b8",marginBottom:14,lineHeight:1.5}}>
              The rest of the app is still running. Tap below to return to Today, or try a different tab.
            </div>
            <div style={{fontSize:10,color:"#f87171",background:"rgba(248,113,113,.07)",border:"1px solid rgba(248,113,113,.15)",borderRadius:8,padding:"8px 10px",marginBottom:14,textAlign:"left",wordBreak:"break-all",fontFamily:"monospace",maxHeight:80,overflow:"hidden"}}>
              {String(this.state.err).slice(0,200)}
            </div>
            <button
              onClick={()=>{this.setState({err:null,info:null});this.props.onReset();}}
              style={{padding:"10px 24px",background:"#4f8ef7",color:"#fff",border:"none",borderRadius:10,cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:700}}
            >
              Return to Today
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Static data — single source of truth in src/lib/data.ts
import { BADGER, PARENT_NAMES, DEALERS, PARENT_DEALERS, WEEK_ROUTES, OVERLAYS_REF as _OVERLAYS_REF_INIT, EMPTY_OVERLAYS } from "@/lib/data";
import * as DataModule from "@/lib/data";
import { applyGroupCreates } from "@/lib/mergeGroups";

// OVERLAYS: runtime-loaded from data/overlays.json via API — NOT a static import
// Default empty shape used until loadOverlays() resolves on app mount
// OVERLAYS_REF and EMPTY_OVERLAYS live in @/lib/data — imported above
// All tabs import OVERLAYS_REF from there so mutations are shared
let OVERLAYS_REF: any = _OVERLAYS_REF_INIT;

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

  // 4. GROUP CREATES — delegated to pure fn in src/lib/mergeGroups.ts (A16.4)
  // Extracted for unit testability. applyGroupCreates() is side-effect-free.
  result = applyGroupCreates(result, OV.groups || {}, nameMap);

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
import { T, Q1_TARGET, FY_TARGET, DAYS_LEFT, QUARTER_TARGETS, daysLeftInQuarter, getQuarterTarget, currentCalendarQuarter } from "@/lib/tokens";
import {
  ACCEL_RATES, normalizeTier, isTop100, normalizePracticeType,
  getTierRate, isAccelTier, getTierLabel, extractGroupName,
} from "@/lib/tier";
import { $$, $f, pc, scoreAccount, getHealthStatus } from "@/lib/format";
import { Back, Chev, Pill, Stat, Bar, AccountId, fixGroupName, cleanParentName, BAD_GROUP_NAMES } from "@/components/primitives";
import { parseCSV, parseCSVLine, processCSVData, setDealers } from "@/lib/csv";
import { diffDatasets, checkOverlayIntegrity } from "@/lib/dataDiff";
import { mergeCrmCandidates, applyCrmToGroups, EMPTY_CRM_STORE } from "@/lib/crm";
import { buildSalesRecords, mergeSalesRecords, deriveSalesRollups, EMPTY_SALES_STORE, toCompactSalesStore, hydrateSalesStore, computeFrequencyMap } from "@/lib/sales";
import { buildSnapshot, computeDelta, saveSnapshot, loadSnapshot } from "@/lib/weeklyDelta";

import { SKU } from "@/data/sku-data";
import GroupsTab from "@/components/tabs/GroupsTab";
import DashTab from "@/components/tabs/DashTab";
import MapTab from "@/components/tabs/MapTab";
import EstTab from "@/components/tabs/EstTab";
// ─── PHASE 4: Tab components extracted to src/components/tabs/ ────
import DashboardTab from "@/components/tabs/TodayTab";
import GroupDetail from "@/components/tabs/GroupDetail";
import AcctDetail from "@/components/tabs/AcctDetail";
import DealersTab from "@/components/tabs/DealersTab";
import OutreachTab from "@/components/tabs/OutreachTab";
import AdminTab from "@/components/tabs/AdminTab";
import TasksTab from "@/components/tabs/TasksTab";
// ─── PHASE 5: Tab components extracted to src/components/tabs/ ────

// ─── ICONS (local — nav bar only) ────────────────────────────────
const UploadIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
const IconTask    = ({c}:{c:string}) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>;
const IconBolt    = ({c}:{c:string}) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>;
const IconGroup   = ({c}:{c:string}) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const IconChart   = ({c}:{c:string}) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
const IconMap     = ({c}:{c:string}) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>;
const IconSliders = ({c}:{c:string}) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>;
const IconDealer  = ({c}:{c:string}) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
const IconMail    = ({c}:{c:string}) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>;
const IconAdmin   = ({c}:{c:string}) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M12 14c-5 0-8 2-8 3v1h16v-1c0-1-3-3-8-3z"/><path d="M18 3l2 2-8 8-4-4 2-2 2 2z" strokeWidth="1.5"/></svg>;
const IconMore    = ({c}:{c:string}) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>;

// Back, Chev, Pill, Stat, Bar, AccountId, fixGroupName, cleanParentName, BAD_GROUP_NAMES
// are all imported from @/components/primitives above.

// ─── SKU PRICING (2025 Kerr Accelerate Formulary +3% for 2026) ──
// [sku, desc, cat, stdWS, stdMSRP, diaWS, diaMSRP, platWS, platMSRP, goldWS, goldMSRP, silvWS, silvMSRP]
// MAIN APP
// ═════════════════════════════════════════════════════════════════
export default function App() {
  return <ErrorBoundary><AppInner/></ErrorBoundary>;
}
function AppInner() {
  const [tab, setTab] = useState("today");
  const [tasks, setTasks] = useState<any[]>(() => {
    try {
      const cached = localStorage.getItem("accel_tasks_v1");
      if (cached) return JSON.parse(cached);
    } catch {}
    return [];
  });
  const addTask = (data: any, linkedAcct?: any, linkedGroup?: any) => {
    const newTask = {
      id: Date.now(),
      ...data,
      accountId: linkedAcct?.id || null,
      accountName: linkedAcct?.name || null,
      groupId: linkedGroup?.id || null,
      groupName: linkedGroup ? (linkedGroup.name || linkedGroup.id) : null,
      completed: false,
      createdAt: new Date().toISOString(),
    };
    setTasks(prev => {
      const next = [newTask, ...prev];
      try { localStorage.setItem("accel_tasks_v1", JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const completeTask = (id: number) => {
    setTasks(prev => {
      const next = prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
      try { localStorage.setItem("accel_tasks_v1", JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const deleteTask = (id: number) => {
    setTasks(prev => {
      const next = prev.filter(t => t.id !== id);
      try { localStorage.setItem("accel_tasks_v1", JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const [view, setView] = useState(null);
  const [showMore, setShowMore] = useState(false);
  const [adjs, setAdjs] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem("accel_adjs_v1") || "[]"); } catch { return []; }
  });
  // Persist adjs to overlays (cross-device durable) + localStorage cache (fast path)
  // Debounced 800ms so rapid adj taps don't spam GitHub with commits
  const adjsSaveTimerRef = useRef<any>(null);
  useEffect(() => {
    try { localStorage.setItem("accel_adjs_v1", JSON.stringify(adjs)); } catch {}
    if (adjsSaveTimerRef.current) clearTimeout(adjsSaveTimerRef.current);
    adjsSaveTimerRef.current = setTimeout(() => {
      // Use atomic patch to save adjs — no full overlay replacement
      fetch("/api/save-overlay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ops: [{ op: "replaceSection", section: "adjs", value: adjs }] }),
      }).then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          if (data.overlays) setOverlays(data.overlays);
        }
      }).catch(() => {});
    }, 800);
  }, [adjs]);

  const [estPct, setEstPct] = useState(90);
  const [gFilt, setGFilt] = useState("Multi-Location");
  const [gSearch, setGSearch] = useState("");
  const [dataSource, setDataSource] = useState("preloaded");
  const [groups, setGroups] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadMsg, setUploadMsg] = useState(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const fileRef = useRef(null);

  // ── ACTIVE QUARTER ────────────────────────────────────────────
  // Auto-detected from loaded data, user-overridable, persisted to localStorage.
  // Empty string means "not yet set" — auto-detect fires after data loads.
  const [activeQ, setActiveQState] = useState<string>(() => {
    try { return localStorage.getItem("active_quarter") || ""; } catch { return ""; }
  });
  const setActiveQ = (q: string) => {
    setActiveQState(q);
    try { localStorage.setItem("active_quarter", q); } catch {}
  };

  // ── OVERLAY STATE ─────────────────────────────────────────────
  // overlays: runtime-loaded from data/overlays.json, never wiped by CSV upload
  const [overlays, setOverlaysState] = useState<any>(EMPTY_OVERLAYS);
  const [crmStore, setCrmStore] = useState<any>(EMPTY_CRM_STORE);
  const [salesStore, setSalesStore] = useState<any>(EMPTY_SALES_STORE);
  const salesStoreRef = useRef<any>(EMPTY_SALES_STORE);
  // Keep ref in sync so handleUpload (useCallback []) always sees current store
  salesStoreRef.current = salesStore;
  const [weeklyDelta, setWeeklyDelta] = useState<any>(null);
  const [overlaySaveStatus, setOverlaySaveStatus] = useState<"idle"|"saving"|"saved"|"error">("idle");
  const [overlaySaveError, setOverlaySaveError] = useState<string|null>(null);
  // A15.2: explicit warnings when GitHub load fails AND no local cache is available
  const [crmLoadWarning, setCrmLoadWarning] = useState<string|null>(null);
  const [salesLoadWarning, setSalesLoadWarning] = useState<string|null>(null);

  // Keep OVERLAYS_REF in sync — both local and shared DataModule ref
  const setOverlays = (next: any) => {
    OVERLAYS_REF = next;
    DataModule.OVERLAYS_REF = next;
    setOverlaysState(next);
  };

  // ── CENTRAL PERSISTENCE SERVICE ───────────────────────────────
  // All overlay saves go through here. Updates state immediately, writes to GitHub durably.
  // Shows real error if durable save fails — never silent.

  // NEW: Atomic patch-based overlay saves. Client sends ops, API reads current from GitHub,
  // applies ops, validates, writes back. No stale data stomping.
  const patchOverlay = async (ops: any[]): Promise<boolean> => {
    setOverlaySaveStatus("saving");
    setOverlaySaveError(null);
    try {
      const res = await fetch("/api/save-overlay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ops }),
      });
      const data = await res.json();
      if (res.status === 422 && data.code === "OVERLAY_INTEGRITY_BLOCKED") {
        setOverlaySaveStatus("error");
        setOverlaySaveError("Blocked: " + (data.violations?.[0]?.detail || data.error));
        return false;
      }
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Save failed");
      }
      // Update local state with canonical overlay returned from API
      if (data.overlays) setOverlays(data.overlays);
      setOverlaySaveStatus("saved");
      setTimeout(() => setOverlaySaveStatus("idle"), 3000);
      return true;
    } catch (err: any) {
      setOverlaySaveStatus("error");
      setOverlaySaveError(err.message || "Failed to save — check connection");
      return false;
    }
  };

  // LEGACY: Full-overlay save (deprecated — use patchOverlay for new code)
  const saveOverlays = async (next: any): Promise<boolean> => {
    // 1. Update in-memory immediately
    setOverlays(next);
    // 2. Write to GitHub durably (no localStorage cache — always load fresh)
    setOverlaySaveStatus("saving");
    setOverlaySaveError(null);
    try {
      const res = await fetch("/api/save-overlay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overlays: next }),
      });
      const data = await res.json();
      if (res.status === 409 && data.code === "OVERLAY_WIPE_PREVENTED") {
        setOverlaySaveStatus("error");
        setOverlaySaveError("Save blocked — app loaded before data was ready. Your data on GitHub is safe. Please reload.");
        return false;
      }
      if (res.status === 422 && data.code === "OVERLAY_INTEGRITY_BLOCKED") {
        setOverlaySaveStatus("error");
        setOverlaySaveError("Blocked: " + (data.violations?.[0]?.detail || data.error));
        return false;
      }
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Save failed");
      }
      // Update local state with canonical overlay returned from API
      if (data.overlays) setOverlays(data.overlays);
      setOverlaySaveStatus("saved");
      setTimeout(() => setOverlaySaveStatus("idle"), 3000);
      return true;
    } catch (err: any) {
      setOverlaySaveStatus("error");
      setOverlaySaveError(err.message || "Failed to save — check connection");
      return false;
    }
  };

  // Re-apply group overrides after a move — triggers re-render so parent group shows new child
  const reapplyGroupOverrides = () => {
    setGroups(prev => prev ? applyGroupOverrides([...prev]) : prev);
  };

  // Hydrate dealer info onto groups (handles preloaded data that was built without dealer field)
  const hydrateDealer = (grps) => {
    if (!grps) return grps;
    return grps.map(g => ({
      ...g,
      children: g.children?.map(c => ({
        ...c,
        dealer: (c.dealer && c.dealer !== "Unknown" && c.dealer !== "All Other") ? c.dealer : (DEALERS[c.id] || PARENT_DEALERS[g.id] || "All Other")
      }))
    }));
  };

  // Roll up group-level pyQ/cyQ from children when missing.
  // preloaded-data.ts was built without group totals; CSV uploads include them.
  // This ensures all downstream code can safely read g.pyQ["1"] etc.
  const rollupGroupTotals = (grps) => {
    if (!grps) return grps;
    return grps.map(g => {
      if (g.pyQ && Object.keys(g.pyQ).length > 0) return g;
      const pyQ: Record<string,number> = {};
      const cyQ: Record<string,number> = {};
      (g.children || []).forEach((c:any) => {
        Object.entries(c.pyQ || {}).forEach(([k,v]:any) => { pyQ[k] = (pyQ[k]||0) + v; });
        Object.entries(c.cyQ || {}).forEach(([k,v]:any) => { cyQ[k] = (cyQ[k]||0) + v; });
      });
      return { ...g, pyQ, cyQ };
    });
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
      // ALWAYS load fresh from GitHub. No localStorage cache — it was the root cause
      // of stale data stomping fixes applied directly on GitHub.
      let loadedOverlays = EMPTY_OVERLAYS;
      try {
        // Clear stale localStorage cache on boot (one-time migration)
        try { localStorage.removeItem("overlay_cache_v2"); } catch {}
        const res = await fetch("/api/load-overlay");
        if (res.ok) {
          const { overlays: fresh } = await res.json();
          if (fresh) {
            loadedOverlays = fresh;
            // Restore adjs from GitHub overlays (cross-device sync)
            if (Array.isArray(fresh.adjs)) {
              setAdjs(fresh.adjs);
              try { localStorage.setItem("accel_adjs_v1", JSON.stringify(fresh.adjs)); } catch {}
            }
          }
        }
      } catch {}
      setOverlays(loadedOverlays);

      // ── Load CRM Accounts ──
      // Try localStorage cache first (fast path), then fetch from GitHub in background.
      // Never blocks rendering — if CRM is empty the app works normally.
      try {
        const cachedCrm = localStorage.getItem("crm_accounts_v1");
        if (cachedCrm) {
          const parsed = JSON.parse(cachedCrm);
          setCrmStore(parsed);
        }
      } catch {}
      // A15.2: track whether we have a cache before the async fetch resolves
      const hadCrmCache = !!localStorage.getItem("crm_accounts_v1");
      fetch("/api/load-crm").then(async (res) => {
        const data = await res.json();
        if (res.ok && data.crm?.accounts) {
          setCrmStore(data.crm);
          try { localStorage.setItem("crm_accounts_v1", JSON.stringify(data.crm)); } catch {}
          setCrmLoadWarning(null);
        } else if (!res.ok) {
          // Only surface the error if there was nothing in cache to fall back on
          if (!hadCrmCache) setCrmLoadWarning(data.error || "CRM data failed to load from GitHub");
        }
      }).catch((err: any) => {
        if (!hadCrmCache) setCrmLoadWarning(`CRM fetch failed: ${err.message}`);
      });

      // ── Load Sales History ──
      // Load from localStorage cache; re-derive rollups on boot.
      let bootSalesStore: any = null;
      try {
        const cachedSales = localStorage.getItem("sales_history_v1");
        if (cachedSales) {
          bootSalesStore = hydrateSalesStore(JSON.parse(cachedSales));
          setSalesStore(bootSalesStore);
        }
      } catch {}
      // A15.2: track whether we have a cache before the async fetch resolves
      const hadSalesCache = !!localStorage.getItem("sales_history_v1");
      // Fetch fresh from GitHub in background (same pattern as CRM)
      fetch("/api/load-sales").then(async (res) => {
        const data = await res.json();
        if (res.ok && data.sales?.records) {
          const hydrated = hydrateSalesStore(data.sales);
          setSalesStore(hydrated);
          try { localStorage.setItem("sales_history_v1", JSON.stringify(toCompactSalesStore(hydrated))); } catch {}
          setSalesLoadWarning(null);
        } else if (!res.ok) {
          if (!hadSalesCache) setSalesLoadWarning(data.error || "Sales history failed to load from GitHub");
        }
      }).catch((err: any) => {
        if (!hadSalesCache) setSalesLoadWarning(`Sales fetch failed: ${err.message}`);
      });

      // ── Load Base Data ──
      try {
        const saved = localStorage.getItem("accel_data_v2");
        if (saved) {
          const parsed = JSON.parse(saved);
          // Re-derive rollups from full sales history if available
          const baseGroups = bootSalesStore
            ? deriveSalesRollups(bootSalesStore, parsed.groups)
            : parsed.groups;
          setGroups(applyGroupOverrides(applyOverlays(rollupGroupTotals(hydrateDealer(baseGroups)))));
          setDataSource(`CSV uploaded ${parsed.generated}`);
          setLoading(false);
          return;
        }
      } catch {}

      try {
        const { PRELOADED } = require("@/data/preloaded-data");
        // Apply manual-parents remap to preloaded data so structural groups
        // (like Downtown DDS) show correctly even before a CSV upload.
        const { applyManualParents } = require("@/lib/csv");
        const remappedGroups = applyManualParents ? applyManualParents(PRELOADED.groups) : PRELOADED.groups;
        const preloadedGroups = applyGroupOverrides(applyOverlays(rollupGroupTotals(hydrateDealer(remappedGroups))));
        setGroups(preloadedGroups);
        setDataSource(`Pre-loaded ${PRELOADED.generated} · upload CSV to refresh`);
        // Auto-detect activeQ from data if not already set
        setActiveQState(prev => {
          if (prev) return prev;
          const qTotals: Record<string,number> = {};
          preloadedGroups.forEach((g: any) => {
            ["1","2","3","4"].forEach(q => { qTotals[q] = (qTotals[q]||0) + (g.cyQ?.[q]||0); });
          });
          const best = Object.entries(qTotals).filter(([,v])=>v>0).sort(([a],[b])=>parseInt(b)-parseInt(a))[0];
          const detected = best ? best[0] : "1";
          // If Q1 has ended and we'd default to Q1, bump to current calendar quarter
          const calQ = currentCalendarQuarter();
          const effective = (detected === "1" && daysLeftInQuarter("1") === 0) ? calQ : detected;
          try { localStorage.setItem("active_quarter", effective); } catch {}
          return effective;
        });
      } catch {
        setGroups([]);
        setDataSource("No data — upload CSV");
      }
      setLoading(false);
    };
    boot();
  }, []);

  // ── VERSION CHECK — poll every 3 min, show banner if new deploy detected ──
  useEffect(() => {
    const builtSha = (process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || "dev").slice(0, 10);
    const check = async () => {
      try {
        const res = await fetch("/api/version?t=" + Date.now());
        if (!res.ok) return;
        const { sha } = await res.json();
        if (sha && sha !== "dev" && builtSha !== "dev" && !sha.startsWith(builtSha) && !builtSha.startsWith(sha.slice(0,10))) {
          setUpdateAvailable(true);
        }
      } catch {}
    };
    check();
    const id = setInterval(check, 3 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // Handle CSV upload
  const handleUpload = useCallback((e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadMsg("Processing CSV...");
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target.result as string;
        const rows = parseCSV(text);
        const result = processCSVData(rows, text, file.name);

        // Load previous dataset for diff (before overwriting)
        let prevGroups: any[] = [];
        try {
          const prev = localStorage.getItem("accel_data_v2");
          if (prev) prevGroups = JSON.parse(prev).groups || [];
        } catch {}

        // Diff new vs previous
        const diff = diffDatasets(prevGroups, result.groups);
        const isFirstUpload = prevGroups.length === 0;

        // Check all overlay sections for orphaned references
        const integrity = checkOverlayIntegrity(OVERLAYS_REF, result.groups);

        // Merge CRM candidates — identity fields extracted from this upload
        // merged into the persistent CRM store (fill-blanks-only policy).
        // Persisted to GitHub async so it never blocks the upload flow.
        if (result.crmCandidates && Object.keys(result.crmCandidates).length > 0) {
          setCrmStore((prevCrm: any) => {
            const nextCrm = mergeCrmCandidates(prevCrm || EMPTY_CRM_STORE, result.crmCandidates);
            try { localStorage.setItem("crm_accounts_v1", JSON.stringify(nextCrm)); } catch {}
            // Async GitHub persist — fire and forget, failure is non-fatal
            fetch("/api/save-crm", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ crm: nextCrm }),
            }).catch(() => { /* CRM save failed — cached locally */ });
            return nextCrm;
          });
        }

        // Merge sales records — raw rows from this upload de-duped into
        // the persistent sales-history store. After merging, re-derive
        // pyQ/cyQ/products/last from the full accumulated history so
        // overlapping weekly exports accumulate rather than replace.
        // Fire-and-forget persist — never blocks the upload flow.
        let baseGroupsForDisplay = result.groups;
        if (result.rawSalesRows && result.rawSalesRows.length > 0) {
          const batchId = `batch_${Date.now()}_${result.rawSalesRows.length}`;
          const newRecords = buildSalesRecords(result.rawSalesRows, batchId);
          // Compute merged store directly using ref — no localStorage dependency
          const nextSales = mergeSalesRecords(
            salesStoreRef.current || EMPTY_SALES_STORE,
            newRecords,
            { id: batchId, filename: result.report?.filename || "", uploadedAt: new Date().toISOString(), rowCount: result.rawSalesRows.length }
          );
          setSalesStore(nextSales);
          // Compact format: ~2.5MB vs ~8.6MB full — fits Vercel 4.5MB body limit
          const compactSales = toCompactSalesStore(nextSales);
          try { localStorage.setItem("sales_history_v1", JSON.stringify(compactSales)); } catch {}
          // GitHub is the primary persistent store — fire and forget
          fetch("/api/save-sales", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sales: compactSales }),
          }).catch(() => {});
          // Re-derive rollups directly from merged store — no localStorage needed
          baseGroupsForDisplay = deriveSalesRollups(nextSales, result.groups);
        }

        // Apply CRM identity, then overlays on top of derived base data
        const uploadedGroups = applyGroupOverrides(applyOverlays(applyCrmToGroups(rollupGroupTotals(hydrateDealer(baseGroupsForDisplay)), crmStore)));
        // Guard: never wipe existing state with an empty/zero result
        const totalRev = uploadedGroups.reduce((s:number,g:any)=>(s+(g.pyQ?.["1"]||0)+(g.cyQ?.["1"]||0)),0);
        if (uploadedGroups.length === 0 || totalRev === 0) {
          setUploadMsg("ERR CSV parsed but found no revenue — app data unchanged");
          setTimeout(() => setUploadMsg(null), 7000);
          return;
        }
        setGroups(uploadedGroups);
        // Auto-detect activeQ from uploaded data
        setActiveQState(prev => {
          const qTotals: Record<string,number> = {};
          uploadedGroups.forEach((g: any) => {
            ["1","2","3","4"].forEach(q => { qTotals[q] = (qTotals[q]||0) + (g.cyQ?.[q]||0); });
          });
          const best = Object.entries(qTotals).filter(([,v])=>v>0).sort(([a],[b])=>parseInt(b)-parseInt(a))[0];
          const detected = best ? best[0] : (prev || "1");
          try { localStorage.setItem("active_quarter", detected); } catch {}
          return detected;
        });
        setDataSource(`Updated ${result.generated}`);
        // Save groups + metadata only — omit rawSalesRows (too large for localStorage)
        try {
          localStorage.setItem("accel_data_v2", JSON.stringify({
            groups: result.groups,
            generated: result.generated,
            report: result.report,
          }));
        } catch {}
        try { localStorage.setItem("import_report_v1", JSON.stringify(result.report)); } catch {}

        // Build upload message
        let msg = `✓ Loaded ${result.groups.length} accounts`;
        if (!isFirstUpload) {
          const parts: string[] = [];
          if (diff.addedAccounts)   parts.push(`+${diff.addedAccounts} new`);
          if (diff.removedAccounts) parts.push(`−${diff.removedAccounts} removed`);
          if (diff.changedRevenue)  parts.push(`~${diff.changedRevenue} updated`);
          if (parts.length) msg += ` · ${parts.join(" · ")}`;
        }
        // Only warn about contact/activity orphans — custom group refs are expected
        // when overlay groups reference accounts not in current CSV slice
        const criticalSections = (integrity.affectedSections || []).filter(
          (s: string) => !["custom groups"].includes(s)
        );
        if (criticalSections.length > 0) {
          msg += ` · ⚠ ${integrity.missingIds.length} overlay ref${integrity.missingIds.length > 1 ? "s" : ""} orphaned (${criticalSections.join(", ")})`;
        }
        setUploadMsg(msg);
        setTimeout(() => setUploadMsg(null), integrity.missingIds.length > 0 ? 10000 : 5000);
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
    // Recursively extract leaf nodes — preloaded-data nests children 2 levels deep
    const extractLeaves = (g: any, children: any[]): any[] => {
      return children.flatMap(c => {
        if (c.children && c.children.length > 0 && !c.products) {
          // This is a wrapper node — recurse into its children
          return extractLeaves(g, c.children);
        }
        // Skip any stub/expansion child that has no revenue data
        // These are accounts in the MDM system with no actual orders
        if (!c.pyQ && !c.cyQ) return [];
        // Ensure pyQ and cyQ always exist as objects so downstream code never crashes
        const safeC = { ...c, pyQ: c.pyQ || {}, cyQ: c.cyQ || {}, products: c.products || [] };
        return [{ ...safeC, gName: fixGroupName(g), gId: g.id, gTier: g.tier }];
      });
    };
    return groups.flatMap(g => extractLeaves(g, g.children || []));
  }, [groups]);

  const totalAdjQ1 = adjs.reduce((s,a) => s + a.credited, 0);

  // Grouped Private: single-location groups sharing an address across different dealers
  const groupedPrivates = useMemo(() => {
    if (!groups) return [];
    const norm = (s:string) => s?.toLowerCase()
      .replace(/[.,#()]/g,'')
      .replace(/\bstreet\b/g,'st').replace(/\bavenue\b/g,'ave').replace(/\broad\b/g,'rd')
      .replace(/\bdrive\b/g,'dr').replace(/\bboulevard\b/g,'blvd')
      .replace(/\s+/g,' ').trim() || '';
    const map: Record<string,any[]> = {};
    groups.forEach((g:any) => {
      if (g.locs !== 1) return;
      const c = (g.children||[])[0];
      if (!c?.addr) return;
      const key = norm(`${c.addr} ${c.city||''} ${c.st||''}`);
      if (key.length < 8) return;
      if (!map[key]) map[key] = [];
      map[key].push(g);
    });
    return Object.values(map)
      .filter(gs => gs.length >= 2)
      .map(gs => {
        const sorted = [...gs].sort((a:any,b:any) => (b.pyQ?.["1"]||0) - (a.pyQ?.["1"]||0));
        const c0 = sorted[0].children?.[0];
        const dealers = [...new Set(gs.map((g:any) => g.children?.[0]?.dealer || 'All Other'))];
        const py1 = gs.reduce((s:number,g:any) => s+(g.pyQ?.["1"]||0), 0);
        const cy1 = gs.reduce((s:number,g:any) => s+(g.cyQ?.["1"]||0), 0);
        return {
          id: `gp-${sorted[0].id}`, name: c0?.name || sorted[0].name,
          addr: c0?.addr||'', city: c0?.city||'', st: c0?.st||'',
          locs: 1, dealers, _groups: gs,
          pyQ: {"1":py1}, cyQ: {"1":cy1},
          _py1: py1, _cy1: cy1, _gap: py1-cy1, _ret: py1>0?cy1/py1:1, _locs: 1,
          isGroupedPrivate: true, class2: "Private Practice",
          tier: c0?.tier||"Standard",
        };
      });
  }, [groups]);

  // Compute Q1 totals from data
  const q1CYFromData = useMemo(() => {
    if (!groups) return 0;
    return groups.reduce((s,g) => s + (g.cyQ?.[activeQ||"1"]||0), 0);
  }, [groups, activeQ]);

  const q1CY = q1CYFromData + totalAdjQ1;
  const activeTarget = getQuarterTarget(activeQ||"1");
  const q1Gap = activeTarget - q1CY;
  const q1Att = q1CY / activeTarget;

  // Score all accounts — use combined sibling totals for gap/priority when addr siblings exist
  // A16: pre-compute frequency index from sales history before scoring.
  // Maps childId → { avgIntervalDays, orderCount, freqScore } — tells the
  // scoring engine how overdue each account is relative to its own pattern.
  const freqMap = useMemo(() => {
    const lastDays: Record<string, number> = {};
    allChildren.forEach((a: any) => { if (a.last !== undefined && a.last < 999) lastDays[a.id] = a.last; });
    return computeFrequencyMap(salesStore, lastDays);
  }, [salesStore, allChildren]);

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
        ...scoreAccount(scoreBase, activeQ || "1", freqMap[a.id]),
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
  }, [allChildren, adjs, activeQ, freqMap]);

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
            borderRadius:999,padding:"2px 8px"}}>{pc(q1Att)} · {daysLeftInQuarter(activeQ||"1") > 0 ? `${daysLeftInQuarter(activeQ||"1")}d left` : "Q ended"}</div>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {/* Quarter switcher — only show quarters with any CY data */}
          {(()=>{
            const qs = ["1","2","3","4"].filter(q=>(groups||[]).some(g=>(g.cyQ?.[q]||0)>0));
            if(qs.length<=1) return null;
            return <div style={{display:"flex",gap:3}}>
              {qs.map(q=>(
                <button key={q} onClick={()=>setActiveQ(q)} style={{
                  padding:"2px 8px",borderRadius:6,fontSize:10,fontWeight:700,cursor:"pointer",
                  border:`1px solid ${(activeQ||"1")===q?"rgba(79,142,247,.4)":T.b1}`,
                  background:(activeQ||"1")===q?"rgba(79,142,247,.15)":T.s2,
                  color:(activeQ||"1")===q?T.blue:T.t4,fontFamily:"inherit",transition:"all .15s"
                }}>Q{q}</button>
              ))}
            </div>;
          })()}
          <button onClick={()=>fileRef.current?.click()} style={{background:"rgba(79,142,247,.08)",border:`1px solid rgba(79,142,247,.15)`,borderRadius:8,padding:"4px 10px",display:"flex",alignItems:"center",gap:5,cursor:"pointer",color:T.blue,fontSize:10,fontWeight:600,fontFamily:"inherit"}}><UploadIcon/> CSV</button>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleUpload} style={{display:"none"}}/>
          <div className="m" style={{border:`1px solid ${dataSource.startsWith("Pre-loaded")?"rgba(251,191,36,.3)":T.b1}`,background:T.s2,borderRadius:999,padding:"3px 10px",fontSize:10,fontWeight:500,color:dataSource.startsWith("Pre-loaded")?T.amber:T.t4}}>{dataSource}</div>
        </div>
      </header>

      {/* UPLOAD MESSAGE */}
      {uploadMsg && <div className="anim" style={{margin:"8px 16px",padding:"10px 14px",borderRadius:10,background:uploadMsg.startsWith("✓")?"rgba(52,211,153,.08)":"rgba(248,113,113,.08)",border:`1px solid ${uploadMsg.startsWith("✓")?"rgba(52,211,153,.15)":"rgba(248,113,113,.15)"}`,fontSize:12,color:uploadMsg.startsWith("✓")?T.green:uploadMsg.startsWith("ERR")?T.red:T.t3}}>{uploadMsg}</div>}
      {overlaySaveStatus==="saving"&&<div className="anim" style={{margin:"0 16px 8px",padding:"6px 12px",borderRadius:8,background:"rgba(79,142,247,.08)",border:"1px solid rgba(79,142,247,.15)",fontSize:11,color:T.blue}}>💾 Saving...</div>}
      {overlaySaveStatus==="saved"&&<div className="anim" style={{margin:"0 16px 8px",padding:"6px 12px",borderRadius:8,background:"rgba(52,211,153,.08)",border:"1px solid rgba(52,211,153,.15)",fontSize:11,color:T.green}}>✓ Saved</div>}
      {overlaySaveStatus==="error"&&<div className="anim" style={{margin:"0 16px 8px",padding:"6px 12px",borderRadius:8,background:"rgba(248,113,113,.08)",border:"1px solid rgba(248,113,113,.15)",fontSize:11,color:T.red}}>⚠ Save failed: {overlaySaveError} — your change is cached locally but not backed up yet.</div>}
      {/* A15.2: CRM / sales load failure banners — only shown when no local cache fallback existed */}
      {false && crmLoadWarning && null}
      {false && salesLoadWarning && null}
      {updateAvailable&&<button className="anim" onClick={()=>window.location.reload()} style={{display:"block",width:"calc(100% - 32px)",margin:"0 16px 8px",padding:"10px 14px",borderRadius:10,background:"rgba(79,142,247,.12)",border:"1px solid rgba(79,142,247,.3)",fontSize:12,fontWeight:700,color:T.blue,cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>⬆ New update available — tap to reload (your data is saved)</button>}

      {/* TAB CONTENT */}
      {/* goSmart: always route child taps through the parent group when group has >1 loc.
          Private practices (locs=1) and multi-dealer same-address offices go straight to AcctDetail
          since the AcctDetail IS their combined summary. */}
      <TabErrorBoundary key={tab+(view?.type||"")} onReset={()=>{setTab("today");setView(null);}}>
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
        const goGroupFn = (g:any) => { window.scrollTo(0,0); setView({type:"group", data:g}); };
        const goAcctFn = (a:any, from?:any) => { window.scrollTo(0,0); setView({type:"acct", data:a, from}); };
        return <>
          {!view && tab==="today" && <DashboardTab scored={scored} goAcct={goSmartFn} q1CY={q1CY} q1Gap={q1Gap} q1Att={q1Att} adjCount={adjs.length} totalAdj={totalAdjQ1} groups={groups||[]} goGroup={goGroupFn} activeQ={activeQ||"1"} weeklyDelta={weeklyDelta} tasks={tasks} onCompleteTask={completeTask} onGoTasks={()=>{setTab("tasks");setView(null);}}/> }
          {!view && tab==="groups" && <GroupsTab groups={groups||[]} goGroup={goGroupFn} filt={gFilt} setFilt={setGFilt} search={gSearch} setSearch={setGSearch} groupedPrivates={groupedPrivates}/>}
          {!view && tab==="map" && <MapTab/>}
          {!view && tab==="calc" && <DashTab groups={groups||[]} q1CY={q1CY} q1Att={q1Att} q1Gap={q1Gap} scored={scored} goAcct={goSmartFn} activeQ={activeQ||"1"}/>}
          {!view && tab==="est" && <EstTab pct={estPct} setPct={setEstPct} q1CY={q1CY} groups={groups||[]} goAcct={goSmartFn}/>}
          {!view && tab==="dealers" && <DealersTab scored={scored} groups={groups||[]} goAcct={goSmartFn} goGroup={goGroupFn} activeQ={activeQ||"1"} overlays={overlays} saveOverlays={saveOverlays} patchOverlay={patchOverlay}/>}
          {!view && tab==="outreach" && <OutreachTab scored={scored}/>}
          {!view && tab==="tasks" && <TasksTab tasks={tasks} onAddTask={(data)=>addTask(data)} onCompleteTask={completeTask} onDeleteTask={deleteTask}/>}
          {!view && tab==="admin" && <AdminTab groups={groups||[]} scored={scored} overlays={overlays} saveOverlays={saveOverlays} patchOverlay={patchOverlay} salesStore={salesStore}/>}
          {view?.type==="group" && <GroupDetail group={view.data} groups={groups||[]} goMain={()=>setView(null)} overlays={overlays} saveOverlays={saveOverlays} patchOverlay={patchOverlay} goAcct={(a:any)=>setView({type:"acct",data:{...a,gName:fixGroupName(view.data),gId:view.data.id,gTier:view.data.tier},from:view.data})} salesStore={salesStore}/>}
          {view?.type==="acct" && <AcctDetail acct={view.data} goBack={()=>view?.from?setView({type:"group",data:view.from}):setView(null)} adjs={adjs} setAdjs={setAdjs} groups={groups||[]} goGroup={goGroupFn} overlays={overlays} saveOverlays={saveOverlays} patchOverlay={patchOverlay} reapplyGroupOverrides={reapplyGroupOverrides} goAcct={(s:any)=>setView({type:"acct",data:{...s,gId:view.data.gId,gName:view.data.gName},from:view?.from})} salesStore={salesStore}/>}
        </>;
      })()}
      </TabErrorBoundary>

      {/* MORE MENU OVERLAY */}
      {showMore && <div style={{position:"fixed",inset:0,zIndex:90,background:"rgba(0,0,0,.6)",backdropFilter:"blur(4px)"}} onClick={()=>setShowMore(false)}>
        <div style={{position:"absolute",bottom:58,left:"50%",transform:"translateX(-50%)",width:"calc(100% - 32px)",maxWidth:928,background:T.s1,border:`1px solid ${T.b2}`,borderRadius:16,padding:"8px 0",boxShadow:"0 -8px 32px rgba(0,0,0,.5)"}} onClick={e=>e.stopPropagation()}>
          {[{k:"calc",l:"Pricing",I:IconChart,desc:"SKU pricing & margin calculator"},{k:"map",l:"Route",I:IconMap,desc:"Week routes & Google Maps"},{k:"est",l:"Forecast",I:IconSliders,desc:"Q1 close estimator"},{k:"outreach",l:"Outreach",I:IconMail,desc:"AI email campaigns"},{k:"admin",l:"Admin",I:IconAdmin,desc:"Groups, contacts, data fixes"}].map(t=>(
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
          {[{k:"today",l:"Today",I:IconBolt},{k:"groups",l:"Accounts",I:IconGroup},{k:"dealers",l:"Dealers",I:IconDealer},{k:"tasks",l:"Tasks",I:IconTask}].map(t=>(
            <button key={t.k} onClick={()=>{setTab(t.k);setView(null);setShowMore(false)}} style={{background:"none",border:"none",display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"4px 16px",cursor:"pointer",color:tab===t.k&&!view&&!showMore?T.blue:T.t4}}>
              <t.I c={tab===t.k&&!view&&!showMore?T.blue:T.t4}/>
              <span style={{fontSize:9,fontWeight:600,letterSpacing:".5px"}}>{t.l}</span>
            </button>
          ))}
          <button onClick={()=>setShowMore(!showMore)} style={{background:"none",border:"none",display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"4px 16px",cursor:"pointer",color:showMore||["map","est","outreach","admin","calc"].includes(tab)?T.blue:T.t4}}>
            <IconMore c={showMore||["map","est","outreach","admin","calc"].includes(tab)?T.blue:T.t4}/>
            <span style={{fontSize:9,fontWeight:600,letterSpacing:".5px"}}>More</span>
          </button>
        </div>
      </nav>
    </div>
  );
}








