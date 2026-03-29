"use client";
// @ts-nocheck
import { useState, useMemo } from "react";
import { T } from "@/lib/tokens";
import { $$, $f, pc } from "@/lib/format";
import { getTierLabel } from "@/lib/tier";
import { BADGER, OVERLAYS_REF } from "@/lib/data";
import { Back, Chev, Pill, Stat, Bar, AccountId, GroupBadge, fixGroupName } from "@/components/primitives";
import { TaskWidget } from "@/components/tabs/TasksTab";
import { buildDsoCard, BENCH_AVG, type BenchMode } from "@/lib/dsoWarRoom";
import { bestContact, contactGaps, bestPathIn, migrateLegacyContact, buildContact, PATH_IN_LABEL, PATH_IN_COLOR } from "@/lib/contacts";
import type { Contact } from "@/types";

let SCHEIN_REPS: {fsc:any[], es:any[]} = {fsc:[], es:[]};
try {
  const ctReps   = require("@/data/schein-ct-reps.json");
  const allReps  = require("@/data/dealer-reps.json")?.Schein || {fsc:[], es:[]};
  // Merge both files; deduplicate by lowercase email
  const seen = new Set<string>();
  const dedup = (list: any[]) => list.filter(r => {
    const key = (r.email||r.name||"").toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  SCHEIN_REPS = {
    fsc: dedup([...ctReps.fsc, ...allReps.fsc]),
    es:  dedup([...ctReps.es,  ...allReps.es]),
  };
} catch(e) {}

const SCOPE_LABELS = ["Decision Maker","Practice Manager","Regional / DSO","Coordinator"];
const SCOPE_COLORS_KEYS = ["cyan","blue","purple","t4"];
const STATUS_PILL: Record<string,{label:string,color:string}> = {
  open:    {label:"Open",    color:"#34d399"},
  closed:  {label:"Closed",  color:"#f87171"},
  changed: {label:"Changed", color:"#fbbf24"},
  unknown: {label:"Unknown", color:"#7878a0"},
};

function GroupDetail({group,groups=[],goMain,goAcct,overlays,patchOverlay,salesStore=null,onAddTask=null}) {
  const [q,setQ]=useState("1");
  const [showAllLocs,setShowAllLocs]=useState(false);
  const qk=q;

  // ── Merge group state ──
  const [showMerge, setShowMerge] = useState(false);
  const [mergeSearch, setMergeSearch] = useState("");
  const [mergeTarget, setMergeTarget] = useState<any>(null);
  const [mergeSaving, setMergeSaving] = useState(false);
  const [mergeToast, setMergeToast] = useState<string|null>(null);
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
    if (patchOverlay) {
      const groupFSC = { ...(OVERLAYS_REF.fscReps?.[group.id] || {}), [dist]: data };
      patchOverlay([{ op: "set", path: `fscReps.${group.id}`, value: groupFSC }]);
    }
  };
  const removeFSC = (dist:string) => {
    try { localStorage.removeItem(fscKey(dist)); } catch {}
    // Remove from overlays durably
    if (patchOverlay) {
      const groupFSC = { ...(OVERLAYS_REF.fscReps?.[group.id] || {}) };
      delete groupFSC[dist];
      patchOverlay([{ op: "set", path: `fscReps.${group.id}`, value: groupFSC }]);
    }
  };

  // All known distributors — always show full list so FSC reps can be added
  // regardless of whether dealer mapping matched (accounts may show "All Other")
  const KNOWN_DISTS = ["Benco","Darby","DDS Dental","Dental City","Patterson","Schein"];
  // Detect which distributors are present in this group's children
  const groupDists = useMemo(()=>{
    const distDedupeSet = new Set<string>(KNOWN_DISTS);
    (group.children||[]).forEach((c:any) => { if(c.dealer && c.dealer!=="All Other") distDedupeSet.add(c.dealer); });
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
  const [prodView, setProdView] = useState<string>("location");
  // Inline month expansion — separate from full-screen selProduct drill
  const [expandedProduct, setExpandedProduct] = useState<string|null>(null);
  const [editDist, setEditDist] = useState<string|null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const [rosterSearch, setRosterSearch] = useState("");
  const filteredRoster = rosterSearch.trim().length > 0
    ? [...SCHEIN_REPS.fsc, ...SCHEIN_REPS.es].filter(r =>
        r.name.toLowerCase().includes(rosterSearch.toLowerCase()))
    : [...SCHEIN_REPS.fsc, ...SCHEIN_REPS.es];

  const pickFromRoster = (rep:any) => {
    setEditName(rep.name);
    setEditPhone(rep.phone);
    // pre-fill email as notes hint
    setEditNotes(rep.email);
    setRosterSearch("");
  };

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

  // ── Group-level contacts (not tied to distributor) ──
  const [groupContacts, setGroupContacts] = useState<Contact[]>(()=>{
    const raw = overlays?.groupContacts?.[group.id]
      || (() => { try { return JSON.parse(localStorage.getItem(`grpContacts:${group.id}`)||"[]"); } catch { return []; } })();
    return (raw as any[]).map((c: any) => migrateLegacyContact(c, group.id));
  });
  const [showContactForm, setShowContactForm] = useState(false);
  const [editContact, setEditContact] = useState<any>(null);
  const [cName, setCName] = useState("");
  const [cRole, setCRole] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [cNotes, setCNotes] = useState("");
  const [cIsPrimary, setCIsPrimary] = useState(false);
  const [cSource, setCSource] = useState<"manual"|"research"|"badger"|"csv"|"unknown">("manual");
  const [cConfidence, setCConfidence] = useState<"verified"|"likely"|"unverified"|"stale">("unverified");

  const openContactForm = (c?:Contact) => {
    setEditContact(c||null);
    setCName(c?.name||""); setCRole(c?.role||""); setCPhone(c?.phone||"");
    setCEmail(c?.email||""); setCNotes(c?.notes||"");
    setCIsPrimary(c?.isPrimary||false);
    setCSource((c?.source)||"manual");
    setCConfidence((c?.confidence)||"unverified");
    setShowContactForm(true);
  };
  const saveContact = () => {
    if (!cName.trim()) return;
    const entry = buildContact(
      { name:cName, role:cRole, phone:cPhone, email:cEmail, notes:cNotes, isPrimary:cIsPrimary, source:cSource, confidence:cConfidence },
      group.id, editContact?.id
    );
    let updated: Contact[];
    if (cIsPrimary) {
      const demoted = groupContacts.map(c => ({ ...c, isPrimary: false }));
      updated = editContact ? demoted.map(c => c.id===editContact.id ? entry : c) : [...demoted, entry];
    } else {
      updated = editContact ? groupContacts.map(c => c.id===editContact.id ? entry : c) : [...groupContacts, entry];
    }
    setGroupContacts(updated);
    try { localStorage.setItem(`grpContacts:${group.id}`, JSON.stringify(updated)); } catch {}
    if (patchOverlay) { patchOverlay([{ op: "set", path: `groupContacts.${group.id}`, value: updated }]); }
    setShowContactForm(false);
  };
  const deleteContact = (id:number) => {
    const updated = groupContacts.filter(c => c.id !== id);
    setGroupContacts(updated);
    try { localStorage.setItem(`grpContacts:${group.id}`, JSON.stringify(updated)); } catch {}
    if (patchOverlay) {
      patchOverlay([{ op: "set", path: `groupContacts.${group.id}`, value: updated }]);
    }
  };

  // ── Group-level notes ──
  const [groupNote, setGroupNote] = useState<string>(()=>{
    const fromOverlay = overlays?.groupNotes?.[group.id];
    if (fromOverlay) return fromOverlay;
    try { return localStorage.getItem(`grpNote:${group.id}`)||""; } catch { return ""; }
  });
  const [noteSaved, setNoteSaved] = useState(false);
  const saveNote = (val:string) => {
    setGroupNote(val);
    try { localStorage.setItem(`grpNote:${group.id}`, val); } catch {}
    if (patchOverlay) {
      patchOverlay([{ op: "set", path: `groupNotes.${group.id}`, value: val }]);
    }
    setNoteSaved(true);
    setTimeout(()=>setNoteSaved(false), 2000);
  };

  // Distributor revenue breakdown for this group
  const distBreakdown = useMemo(()=>{
    const map: Record<string,{cy:number,py:number,locs:number}> = {};
    (group.children||[]).forEach((c:any)=>{
      const d = c.dealer || "All Other";
      if(!map[d]) map[d]={cy:0,py:0,locs:0};
      map[d].cy += c.cyQ?.[qk]||0;
      map[d].py += c.pyQ?.[qk]||0;
      map[d].locs++;
    });
    const totalCY = Object.values(map).reduce((s,v)=>s+v.cy,0);
    const totalPY = Object.values(map).reduce((s,v)=>s+v.py,0);
    return {
      rows: Object.entries(map)
        .map(([dist,v])=>({
          dist, ...v,
          cyPct: totalCY>0 ? v.cy/totalCY : 0,
          pyPct: totalPY>0 ? v.py/totalPY : 0,
        }))
        .sort((a,b)=>b.cy-a.cy),
      totalCY, totalPY,
    };
  },[group,qk]);

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

  // Product signals — hoisted to avoid identical filter/sort in nextBestMoves + briefLines
  const productSignals = useMemo(()=>({
    topStop:    groupStopped.filter((p:any)=>p.py>=500)[0],
    topAtRisk:  groupBuying.filter((p:any)=>p.py>500&&p.cy/p.py<0.6&&p.cy>0).sort((a:any,b:any)=>(b.py-b.cy)-(a.py-a.cy))[0],
    topGrowing: groupBuying.filter((p:any)=>p.py>200&&p.cy/p.py>1.15).sort((a:any,b:any)=>(b.cy/b.py)-(a.cy/a.py))[0],
  }),[groupBuying,groupStopped]);

  const hasProducts = groupBuying.length>0 || groupStopped.length>0;

  // ── Opportunity signals ──────────────────────────────────────────────
  const opportunitySignals = useMemo(()=>{
    const signals: {type:string; label:string; detail:string; color:string; icon:string}[] = [];
    const numLocs = (group.children||[]).length || 1;

    // Win-back: stopped products with meaningful PY
    const topStopped = groupStopped.filter((p:any)=>p.py>=500).slice(0,3);
    topStopped.forEach((p:any)=>{
      signals.push({
        type:"winback",
        label: `Win-back: ${p.name.split(" ").slice(0,2).join(" ")}`,
        detail: `Was ${$$(p.py)} PY — now $0`,
        color: T.red,
        icon: "↩",
      });
    });

    // Momentum: products growing >15% vs PY
    const growing = groupBuying.filter((p:any)=>p.py>200&&p.cy/p.py>1.15).sort((a:any,b:any)=>(b.cy/b.py)-(a.cy/a.py)).slice(0,2);
    growing.forEach((p:any)=>{
      const pct = Math.round(p.cy/p.py*100-100);
      signals.push({
        type:"momentum",
        label: `${p.name.split(" ").slice(0,2).join(" ")} momentum`,
        detail: `+${pct}% vs PY · ${$$(p.cy)} CY`,
        color: T.green,
        icon: "↑",
      });
    });

    // At-risk: products declining 40–99% (bought but shrinking fast)
    const atRisk = groupBuying.filter((p:any)=>p.py>500&&p.cy/p.py<0.6&&p.cy>0).sort((a:any,b:any)=>(b.py-b.cy)-(a.py-a.cy)).slice(0,2);
    atRisk.forEach((p:any)=>{
      const pct = Math.round(p.cy/p.py*100);
      signals.push({
        type:"atrisk",
        label: `${p.name.split(" ").slice(0,2).join(" ")} at risk`,
        detail: `${pct}% of PY · gap ${$$(p.py-p.cy)}`,
        color: T.amber,
        icon: "⚠",
      });
    });

    // Partial penetration: active product at <60% of locations
    if (numLocs > 1) {
      const partial = groupBuying
        .filter((p:any)=>p.locsCY.length>0 && p.locsCY.length < numLocs * 0.6 && p.cy>300)
        .sort((a:any,b:any)=>b.cy-a.cy).slice(0,2);
      partial.forEach((p:any)=>{
        signals.push({
          type:"partial",
          label: `${p.name.split(" ").slice(0,2).join(" ")} partial`,
          detail: `${p.locsCY.length} of ${numLocs} locs buying`,
          color: T.purple,
          icon: "◑",
        });
      });
    }

    return signals.slice(0,6);
  },[groupBuying, groupStopped, group, qk]);




  // Sort children by gap descending (biggest gap first = highest spend priority)
  const sortedChildren = useMemo(() => {
    return [...(group.children||[])].sort((a:any,b:any) => {
      const aGap = (a.pyQ?.[qk]||0) - (a.cyQ?.[qk]||0);
      const bGap = (b.pyQ?.[qk]||0) - (b.cyQ?.[qk]||0);
      return bGap - aGap;
    });
  }, [group, qk]);

  // ── Next Best Moves ───────────────────────────────────────────────────
  const nextBestMoves = useMemo(()=>{
    const moves: {rank:number; action:string; why:string; color:string}[] = [];
    const numLocs = (group.children||[]).length || 1;

    // Highest-gap child → focus first
    const topChild = sortedChildren.length > 0 ? sortedChildren[0] : null;
    if (topChild) {
      const cGap = (topChild.pyQ?.[qk]||0) - (topChild.cyQ?.[qk]||0);
      if (cGap > 500) {
        const shortName = topChild.name ? topChild.name.split(" ").slice(0,3).join(" ") : "top location";
        moves.push({
          rank: 1,
          action: `Prioritize ${shortName} first`,
          why: `Biggest gap in group — ${$$(cGap)} vs PY`,
          color: T.red,
        });
      }
    }

    // Win-back: top stopped product + how many locs
    const { topStop, topAtRisk, topGrowing } = productSignals;
    if (topStop) {
      const lc = topStop.locsDown?.length || 0;
      const pShort = topStop.name.split(" ").slice(0,3).join(" ");
      moves.push({
        rank: moves.length + 1,
        action: `Win back ${pShort}`,
        why: `${lc > 0 ? lc + " loc" + (lc!==1?"s":"") + " stopped buying" : "dropped to $0"} · was ${$$(topStop.py)}`,
        color: T.red,
      });
    }

    // Partial penetration: expand into non-buying locs
    if (numLocs > 1) {
      const partial = groupBuying
        .filter((p:any)=>p.locsCY.length>0 && p.locsCY.length < numLocs * 0.6 && p.cy>300)
        .sort((a:any,b:any)=>b.cy-a.cy)[0];
      if (partial) {
        const pShort = partial.name.split(" ").slice(0,3).join(" ");
        const missing = numLocs - partial.locsCY.length;
        moves.push({
          rank: moves.length + 1,
          action: `Expand ${pShort} to ${missing} more loc${missing!==1?"s":""}`,
          why: `Only ${partial.locsCY.length} of ${numLocs} locations buying`,
          color: T.purple,
        });
      }
    }

    // Momentum: reinforce what's growing
    if (topGrowing) {
      const pct = Math.round(topGrowing.cy/topGrowing.py*100-100);
      const pShort = topGrowing.name.split(" ").slice(0,3).join(" ");
      moves.push({
        rank: moves.length + 1,
        action: `Reinforce ${pShort} momentum`,
        why: `+${pct}% vs PY — keep it going`,
        color: T.green,
      });
    }

    // At-risk recovery: defend a fast-declining active product
    if (topAtRisk) {
      const pShort = topAtRisk.name.split(" ").slice(0,3).join(" ");
      moves.push({
        rank: moves.length + 1,
        action: `Defend ${pShort} — declining fast`,
        why: `${Math.round(topAtRisk.cy/topAtRisk.py*100)}% of PY · gap ${$$(topAtRisk.py-topAtRisk.cy)}`,
        color: T.amber,
      });
    }

    return moves.slice(0,4);
  },[sortedChildren, productSignals, group, qk]);


  // ── Account Brief (deterministic, no API) ────────────────────────────
  const [briefOpen, setBriefOpen] = useState(false);

  // ── Group AI Research (A15) ──
  const [resLoading, setResLoading] = useState(false);
  const [resResult, setResResult] = useState<any>(null);
  const [resDismissed, setResDismissed] = useState(false);
  const [suggestedMerges, setSuggestedMerges] = useState<any[]>([]);
  const [ghostLocations, setGhostLocations] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem(`ghost_locs:${group.id}`) || "[]"); } catch { return []; }
  });
  const [mergeMatchLoading, setMergeMatchLoading] = useState(false);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(()=>new Set());
  const [savedResContacts, setSavedResContacts] = useState<Set<number>>(()=>new Set());
  const [resWebsiteSaved, setResWebsiteSaved] = useState(false);

  const runGroupResearch = async () => {
    setResLoading(true);
    setResDismissed(false);
    setResResult(null);
    setSavedResContacts(new Set());
    setResWebsiteSaved(false);
    const groupName = fixGroupName(group);
    const children = group.children || [];
    const firstChild = children[0] || {};
    const childNames = [...new Set(children.map((c:any)=>c.name).filter(Boolean))];
    const addresses = children.map((c:any)=>[c.address,c.city,c.st,c.zip].filter(Boolean).join(" ")).filter(Boolean).slice(0,3);
    const topCities = [...new Set(children.map((c:any)=>c.city).filter(Boolean))].slice(0,4).join(", ");
    const topDealer = distBreakdown.rows[0]?.dist || "";
    const topProds = groupBuying.slice(0,5).map((p:any)=>p.name);
    const ownerType = group.class2 || "Private Practice";
    const ownership = ownerType.toLowerCase().includes("dso") ? "dso" : "independent";
    const savedDoctors = (overlays?.groupContacts?.[group.id]||[]).filter((c:any)=>c.name?.toLowerCase().startsWith("dr")).map((c:any)=>c.name).slice(0,2);
    try {
      const res = await fetch("/api/deep-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: groupName,
          childNames,
          city: topCities,
          state: firstChild.st || "",
          address: addresses[0] || "",
          addresses,
          dealer: topDealer,
          products: topProds,
          ownership,
          gName: groupName,
          acctId: group.id,
          doctor: savedDoctors[0] || "",
          tier: group.tier || "Standard",
          score: group.score || 0,
        }),
      });
      const data = await res.json();
      const intel = data.intel || {};
      if (data.error || data.errorCode) {
        const isQuota = data.errorCode === "PROVIDER_QUOTA";
        const isProviderErr = data.errorCode === "PROVIDER_ERROR";
        const userMsg = data.userMessage
          || (isQuota ? "Research is temporarily unavailable — the AI provider key has hit its usage limit." : null)
          || (isProviderErr ? "Research is temporarily unavailable. The AI provider returned an error." : null)
          || "No intel found. The practice may not have a web presence.";
        setResResult({
          status: userMsg,
          isProviderError: !!(isQuota || isProviderErr),
          isQuotaError: !!isQuota,
          ownership: "", website: "", contacts: [], hooks: [], talkingPoints: [],
        });
        setResLoading(false); return;
      }
      const intelResult = {
        status: intel.statusNote || intel.status || "Practice found.",
        statusPill: (intel.status as string) || "unknown",
        ownership: intel.ownershipNote || "",
        competitive: intel.competitive || "",
        website: intel.website || "",
        contacts: (intel.contacts||[]).map((c:any) => ({
          name: c.name,
          role: c.role,
          phone: c.phone || "",
          email: c.email || "",
          scope: c.tier || 2,
        })),
        hooks: intel.hooks || [],
        talkingPoints: intel.talkingPoints || [],
      };
      setResResult(intelResult);
      // Cross-reference research locations against existing children — add unknowns as ghost locations
      const resLocations: any[] = intel.locations || [];
      if (resLocations.length > 0) {
        const existingAddrs = new Set(
          (group.children||[]).map((c:any) => (c.addr||c.address||"").toLowerCase().trim()).filter(Boolean)
        );
        const existingNames = new Set(
          (group.children||[]).map((c:any) => (c.name||"").toLowerCase().replace(/[^a-z0-9]/g,""))
        );
        const newGhosts = resLocations.filter((loc:any) => {
          const locAddr = (loc.address||"").toLowerCase().trim();
          const locName = (loc.name||"").toLowerCase().replace(/[^a-z0-9]/g,"");
          const addrMatch = locAddr && existingAddrs.has(locAddr);
          const nameMatch = locName.length > 4 && existingNames.has(locName);
          return !addrMatch && !nameMatch;
        }).map((loc:any) => ({
          id: `ghost-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
          name: loc.name || "Unknown Location",
          city: loc.city || "",
          st: loc.state || loc.st || "",
          addr: loc.address || "",
          zip: loc.zip || "",
          isGhost: true,
          pyQ: {}, cyQ: {}, products: [],
        }));
        if (newGhosts.length > 0) {
          setGhostLocations(prev => {
            // Dedupe by name
            const existingGhostNames = new Set(prev.map((g:any) => g.name.toLowerCase()));
            const fresh = newGhosts.filter((g:any) => !existingGhostNames.has(g.name.toLowerCase()));
            const next = [...prev, ...fresh];
            try { localStorage.setItem(`ghost_locs:${group.id}`, JSON.stringify(next)); } catch {}
            return next;
          });
        }
      }
      // Auto-trigger merge matching whenever intel returns
      if (groups?.length > 0) {
        setMergeMatchLoading(true);
        setSuggestedMerges([]);
        try {
          const existingIds = new Set([
            group.id,
            ...(group.children||[]).map((c:any)=>c.id),
            ...(OVERLAYS_REF.groups?.[group.id]?.childIds||[]),
          ]);
          // Build rich candidates: one entry per child location with all available signals
          const candidates: any[] = [];
          groups
            .filter((g:any) => g.id !== group.id)
            .forEach((g:any) => {
              if (existingIds.has(g.id)) return;
              const gLabel = fixGroupName(g);
              (g.children||[g]).forEach((c:any) => {
                candidates.push({
                  id: g.id,
                  name: gLabel,
                  city: c.city || "",
                  st: c.st || "",
                  address: c.addr || c.address || "",
                  zip: c.zip || "",
                  email: c.email || "",
                  doctor: c.doctor || "",
                  locationName: c.name || "",
                });
              });
            });
          // Dedupe by group id, keeping richest entry per group
          const seen = new Map<string,any>();
          candidates.forEach(c => {
            const ex = seen.get(c.id);
            const score = (c.address?1:0)+(c.email?1:0)+(c.zip?1:0);
            const exScore = ex ? (ex.address?1:0)+(ex.email?1:0)+(ex.zip?1:0) : -1;
            if (!ex || score > exScore) seen.set(c.id, c);
          });
          const deduped = [...seen.values()].slice(0, 800);
          const matchRes = await fetch("/api/find-group-matches", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              intel,
              acct: { name: fixGroupName(group), city: topCities, st: firstChild.st||"", address: addresses[0]||"" },
              accounts: deduped,
            }),
          });
          const matchData = await matchRes.json();
          const matches = (matchData.matches||[]).filter((m:any) => m.id && !existingIds.has(m.id));
          setSuggestedMerges(matches);
        } catch(e) { console.error("merge match error", e); }
        setMergeMatchLoading(false);
      }
    } catch(e) {
      setResResult({ status: "Research unavailable. Check connection.", ownership: "", website: "", contacts: [], hooks: [], talkingPoints: [] });
    }
    setResLoading(false);
  };

  const saveResContact = (c:any, idx:number) => {
    const entry = buildContact(
      { name:c.name||"Unknown", role:c.role||"", phone:c.phone||"", email:c.email||"",
        notes:"From AI research", isPrimary:false, source:"research", confidence:"likely" },
      group.id, Date.now() + idx
    );
    const updated = [...groupContacts, entry];
    setGroupContacts(updated);
    try { localStorage.setItem("grpContacts:" + group.id, JSON.stringify(updated)); } catch {}
    if (patchOverlay) {
      patchOverlay([{ op: "set", path: `groupContacts.${group.id}`, value: updated }]);
    }
    setSavedResContacts(prev => new Set([...prev, idx]));
  };

  const saveResNotes = () => {
    if (!resResult) return;
    const pts = (resResult.talkingPoints||[]).map((p:string,i:number) => `${i+1}. ${p}`).join("
");
    const hooks = (resResult.hooks||[]).map((h:string) => `· ${h}`).join("
");
    const comp = resResult.competitive ? `
Competitive: ${resResult.competitive}` : "";
    const lines = ["[AI Call Prep]", pts, hooks ? "
Also:
"+hooks : "", comp].filter(Boolean).join("
");
    const newNote = groupNote ? groupNote + "

" + lines : lines;
    saveNote(newNote);
  };

  const saveResWebsite = () => {
    if (!resResult?.website) return;
    const updated = [...groupContacts, {
      id: Date.now(),
      name: "Website",
      role: "Online",
      phone: "",
      email: "",
      notes: "Website: " + resResult.website,
      savedAt: new Date().toISOString(),
    }];
    setGroupContacts(updated);
    try { localStorage.setItem("grpContacts:" + group.id, JSON.stringify(updated)); } catch {}
    if (patchOverlay) {
      patchOverlay([{ op: "set", path: `groupContacts.${group.id}`, value: updated }]);
    }
    setResWebsiteSaved(true);
  };

  const briefLines = useMemo(()=>{
    const lines: {text:string; color:string}[] = [];
    const numLocs = (group.children||[]).length || 1;
    const groupName = fixGroupName(group);

    // 1. Health summary sentence
    if (cy > py && py > 0) {
      const pct = Math.round(cy/py*100-100);
      lines.push({ text: `${groupName} is growing — up ${pct}% vs PY with ${$$(cy)} CY.`, color: T.green });
    } else if (py === 0) {
      lines.push({ text: `${groupName} is a new account with no prior-year baseline yet.`, color: T.blue });
    } else if (ret >= 70) {
      lines.push({ text: `${groupName} is tracking well at ${ret}% of PY (${$$(cy)} of ${$$(py)}).`, color: T.green });
    } else if (ret >= 40) {
      const gapAmt = py - cy;
      lines.push({ text: `${groupName} is at risk — ${ret}% retention leaves a ${$$(gapAmt)} gap vs PY.`, color: T.amber });
    } else {
      const gapAmt = py - cy;
      lines.push({ text: `${groupName} is in a critical state — only ${ret}% of PY, down ${$$(gapAmt)}.`, color: T.red });
    }

    // 2. Biggest risk: top-gap child or top at-risk product
    const topChild = sortedChildren[0];
    const topChildGap = topChild ? ((topChild.pyQ?.[qk]||0) - (topChild.cyQ?.[qk]||0)) : 0;
    const { topStop, topAtRisk, topGrowing } = productSignals;
    if (topChildGap > 1000 && numLocs > 1) {
      const shortName = topChild.name?.split(" ").slice(0,3).join(" ") || "top location";
      lines.push({ text: `Biggest drag is ${shortName}, which is down ${$$(topChildGap)} vs PY.`, color: T.red });
    } else if (topAtRisk) {
      const pShort = topAtRisk.name.split(" ").slice(0,3).join(" ");
      const pct = Math.round(topAtRisk.cy/topAtRisk.py*100);
      lines.push({ text: `${pShort} is at risk — only ${pct}% of PY with a ${$$(topAtRisk.py-topAtRisk.cy)} gap.`, color: T.amber });
    }

    // 3. Biggest opportunity: win-back or expansion
    const partial = numLocs > 1
      ? groupBuying.filter((p:any)=>p.locsCY.length>0 && p.locsCY.length < numLocs*0.6 && p.cy>300).sort((a:any,b:any)=>b.cy-a.cy)[0]
      : null;
    if (topStop) {
      const pShort = topStop.name.split(" ").slice(0,3).join(" ");
      const lc = topStop.locsDown?.length || 0;
      lines.push({ text: `Biggest win-back is ${pShort}${lc>0?`, stopped at ${lc} loc${lc!==1?"s":""}`:""} after ${$$(topStop.py)} PY.`, color: T.red });
    } else if (partial) {
      const pShort = partial.name.split(" ").slice(0,3).join(" ");
      const missing = numLocs - partial.locsCY.length;
      lines.push({ text: `${pShort} is only at ${partial.locsCY.length} of ${numLocs} locs — ${missing} location${missing!==1?"s":""} not yet buying.`, color: T.purple });
    }

    // 4. Momentum signal if any
    if (topGrowing) {
      const pShort = topGrowing.name.split(" ").slice(0,3).join(" ");
      const pct = Math.round(topGrowing.cy/topGrowing.py*100-100);
      lines.push({ text: `${pShort} is showing momentum at +${pct}% vs PY — worth reinforcing.`, color: T.green });
    }

    // 5. Best immediate move (mirror top nextBestMove)
    const topMove = nextBestMoves[0];
    if (topMove) {
      lines.push({ text: `Best immediate move: ${topMove.action.toLowerCase()} — ${topMove.why.toLowerCase()}.`, color: T.blue });
    }

    return lines.slice(0,5);
  },[group, cy, py, ret, qk, sortedChildren, productSignals, nextBestMoves]);


  // ── Merge: search results ──
  const alreadyMergedIds = useMemo(() => {
    const ids = new Set<string>();
    Object.values(OVERLAYS_REF.groups||{}).forEach((g:any) => {
      (g.childIds||[]).forEach((cid:string) => ids.add(cid));
    });
    return ids;
  }, [overlays]);

  const mergeResults = useMemo(() => {
    if (!mergeSearch.trim()) return [];
    const mq = mergeSearch.trim().toLowerCase();
    return groups.filter((g:any) => {
      if (g.id === group.id) return false; // can't merge with self
      if (alreadyMergedIds.has(g.id)) return false; // already absorbed elsewhere
      return fixGroupName(g).toLowerCase().includes(mq) ||
        g.name?.toLowerCase().includes(mq) ||
        g.children?.some((c:any) => c.name?.toLowerCase().includes(mq));
    }).slice(0, 10);
  }, [mergeSearch, groups, group.id, alreadyMergedIds]);

  // ── Path 2: Product drill → which child accounts are up/down on this product ──
  if (selProduct) {
    const allProds = [...groupBuying, ...groupStopped];
    const prod = allProds.find(p => p.name === selProduct);
    const childBreakdown = (group.children||[]).map((c:any) => {
      const p = (c.products||[]).find((pr:any) => pr.n === selProduct);
      return { ...c, prodPY: p?(p[`py${qk}`]||0):0, prodCY: p?(p[`cy${qk}`]||0):0 };
    }).filter((c:any) => c.prodPY > 0 || c.prodCY > 0)
      .sort((a:any,b:any) => (b.prodPY-b.prodCY)-(a.prodPY-a.prodCY));

    // Monthly aggregation -- real invoice months from salesStore, or quarterly estimate
    const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const childIds = new Set((group.children||[]).map((c:any) => c.id));
    const allGroupProdRecs = salesStore?.records
      ? (Object.values(salesStore.records) as any[]).filter((r:any) => childIds.has(r.childId) && r.l3 === selProduct)
      : [];
    const hasRealMonthData = allGroupProdRecs.length > 0;
    const salesStoreLoading = !salesStore || Object.keys(salesStore.records||{}).length === 0;
    const Q_TO_MONTHS: Record<number,number[]> = {1:[1,2,3],2:[4,5,6],3:[7,8,9],4:[10,11,12]};
    const staticBuckets: Record<number,{py:number,cy:number}> = {};
    for (let m=1; m<=12; m++) staticBuckets[m]={py:0,cy:0};
    if (!hasRealMonthData && prod) {
      ([1,2,3,4] as number[]).forEach((q:number) => {
        staticBuckets[Q_TO_MONTHS[q][0]].py += ((prod as any)[`py${q}`]||0)/3;
        staticBuckets[Q_TO_MONTHS[q][1]].py += ((prod as any)[`py${q}`]||0)/3;
        staticBuckets[Q_TO_MONTHS[q][2]].py += ((prod as any)[`py${q}`]||0)/3;
        staticBuckets[Q_TO_MONTHS[q][0]].cy += ((prod as any)[`cy${q}`]||0)/3;
        staticBuckets[Q_TO_MONTHS[q][1]].cy += ((prod as any)[`cy${q}`]||0)/3;
        staticBuckets[Q_TO_MONTHS[q][2]].cy += ((prod as any)[`cy${q}`]||0)/3;
      });
    }
    const monthBuckets: Record<number,{py:number,cy:number}> = hasRealMonthData
      ? (() => { const b: Record<number,{py:number,cy:number}>={};for(let m=1;m<=12;m++)b[m]={py:0,cy:0};allGroupProdRecs.forEach((r:any)=>{const m=r.month||1;if(m>=1&&m<=12){b[m].py+=r.py||0;b[m].cy+=r.cy||0;}});return b;})()
      : staticBuckets;
    const hasMonthData = hasRealMonthData || (!!prod && ([1,2,3,4] as number[]).some((q:number)=>((prod as any)[`py${q}`]||0)+((prod as any)[`cy${q}`]||0)>0));
    const maxMonthVal = Math.max(...Object.values(monthBuckets).flatMap(v=>[v.py,v.cy]),1);
    const MAX_BAR_H = 64;

    return <div style={{paddingBottom:80}}>
      <div style={{position:"sticky",top:52,zIndex:40,background:"rgba(10,10,15,.9)",backdropFilter:"blur(20px)",borderBottom:`1px solid ${T.b3}`,padding:"10px 16px"}}>
        <button onClick={()=>setSelProduct(null)} style={{background:"none",border:"none",color:T.blue,cursor:"pointer",display:"flex",alignItems:"center",gap:4,fontSize:13,fontWeight:600,fontFamily:"inherit"}}><Back/> {fixGroupName(group)}</button>
      </div>
      <div style={{padding:"16px 16px 0"}}>
        <div className="anim" style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:16,padding:16,marginBottom:12}}>
          <div style={{fontSize:15,fontWeight:700,marginBottom:4}}>{selProduct}</div>
          <div style={{fontSize:11,color:T.t3,marginBottom:12}}>{fixGroupName(group)} · all locations</div>
          {prod&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8}}>
            <Stat l="PY" v={$$(prod.py)} c={T.t2}/>
            <Stat l="CY" v={$$(prod.cy)} c={T.blue}/>
            <Stat l="Gap" v={(prod.py-prod.cy)<=0?`+${$$(Math.abs(prod.py-prod.cy))}`:$$(prod.py-prod.cy)} c={(prod.py-prod.cy)<=0?T.green:T.red}/>
            <Stat l="Locs" v={`${prod.locsCY.length}/${prod.locsPY.length}`} c={T.t3}/>
          </div>}
        </div>
        {/* View toggle */}
        <div style={{display:"flex",gap:6,marginBottom:12}}>
          {(["location","month"] as const).map(v=>(
            <button key={v} onClick={()=>setProdView(v)}
              style={{flex:1,padding:"7px 0",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
                border:`1px solid ${prodView===v?"rgba(79,142,247,.25)":T.b2}`,
                background:prodView===v?"rgba(79,142,247,.12)":T.s2,
                color:prodView===v?T.blue:T.t3}}>
              {v==="location"?"By Location":"By Month"}
            </button>
          ))}
        </div>
        {/* By Location view */}
        {prodView==="location"&&<>
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
                <AccountId name={c.name} size="md"/>
                <div style={{fontSize:10,color:T.t3}}>{[c.addr,[c.city,c.st,c.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ")}{c.dealer?<span style={{color:T.cyan}}> · {c.dealer}</span>:""}</div>
                {isStopped&&<div style={{fontSize:9,color:T.red,marginTop:2,fontWeight:600}}>STOPPED · was {$$(c.prodPY)}</div>}
                {isNew&&<div style={{fontSize:9,color:T.green,marginTop:2,fontWeight:600}}>NEW BUYER</div>}
              </div>
              <div style={{textAlign:"right",flexShrink:0,marginLeft:10}}>
                <div style={{fontSize:11,fontWeight:700,color:isStopped?T.red:T.blue,fontFamily:"monospace"}}>{$$(c.prodCY)}</div>
                {c.prodPY>0&&<div style={{fontSize:9,color:gap>0?T.red:T.green,fontFamily:"monospace"}}>{gap>0?"-":"+"}${Math.round(Math.abs(gap))}</div>}
              </div>
            </button>;
          })}
        </>}
        {/* By Month view */}
        {prodView==="month"&&<div className="anim" style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:14,padding:14,marginBottom:8}}>
          {!hasMonthData
            ? <div style={{fontSize:11,color:T.t4,textAlign:"center",padding:"16px 0"}}>{salesStoreLoading ? "Loading..." : "No data for this product."}</div>
            : <>
                <div style={{display:"flex",gap:2,alignItems:"flex-end",height:MAX_BAR_H+24}}>
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(m=>{
                    const d = monthBuckets[m];
                    const pyH = Math.round(d.py/maxMonthVal*MAX_BAR_H);
                    const cyH = Math.round(d.cy/maxMonthVal*MAX_BAR_H);
                    const stopped = d.py>50&&d.cy===0;
                    return <div key={m} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:0}}>
                      <div style={{width:"100%",height:MAX_BAR_H,display:"flex",alignItems:"flex-end",justifyContent:"center",gap:1}}>
                        <div style={{width:"46%",height:pyH||2,background:"rgba(120,120,160,.28)",borderRadius:"2px 2px 0 0",flexShrink:0}}/>
                        <div style={{width:"46%",height:cyH||(stopped?3:0),background:stopped?"rgba(248,113,113,.55)":"linear-gradient(0deg,#4f8ef7,#22d3ee)",borderRadius:"2px 2px 0 0",flexShrink:0}}/>
                      </div>
                      <span style={{fontSize:7,color:T.t4,marginTop:3,lineHeight:1}}>{MONTHS_SHORT[m-1]}</span>
                    </div>;
                  })}
                </div>
                <div style={{display:"flex",gap:10,marginTop:8,justifyContent:"flex-end",alignItems:"center"}}>
                    {!hasRealMonthData&&<span style={{fontSize:8,color:T.t4,fontStyle:"italic",marginRight:"auto"}}>Est. by quarter</span>}
                  <span style={{fontSize:9,color:T.t4,display:"flex",alignItems:"center",gap:3}}>
                    <span style={{display:"inline-block",width:8,height:8,background:"rgba(120,120,160,.35)",borderRadius:1}}/>PY
                  </span>
                  <span style={{fontSize:9,color:T.blue,display:"flex",alignItems:"center",gap:3}}>
                    <span style={{display:"inline-block",width:8,height:8,background:T.blue,borderRadius:1}}/>CY
                  </span>
                </div>
              </>
          }
        </div>}
      </div>
    </div>;
  }

  // Health status
  const healthColor = ret >= 70 ? T.green : ret >= 40 ? T.amber : T.red;
  const healthLabel = cy > py && py > 0 ? "Growing" : ret >= 60 ? "Stable" : ret >= 25 ? "Recoverable" : py === 0 ? "New" : "Critical";



  const executeMerge = (target:any) => {
    if (!target || mergeSaving) return;
    setMergeSaving(true);
    // A15.3: store leaf IDs directly rather than group IDs.
    //
    // A16.2 fix: merge direction awareness.
    // Previously this always wrote into groups[group.id] (the current group),
    // which meant merging a single account INTO an existing multi-loc group
    // would create a bogus wrapper on the small account instead of adding it
    // to the big group. Now we detect direction:
    //   - If target is a larger/CSV-native group → write into target (absorb current into target)
    //   - If current is larger or both are overlays → write into current (original behavior)
    const existingEntry = OVERLAYS_REF.groups?.[group.id];
    const targetOverlay = OVERLAYS_REF.groups?.[target.id];

    // Leaf IDs for current group
    const currentLeafIds: string[] = existingEntry?.childIds?.length
      ? [...existingEntry.childIds]
      : (group.children||[]).length > 0
        ? (group.children||[]).map((c:any) => c.id)
        : [group.id];

    // Leaf IDs for target group
    const targetLeafIds: string[] = targetOverlay?.childIds?.length
      ? [...targetOverlay.childIds]
      : (target.children||[]).length > 0
        ? (target.children||[]).map((c:any) => c.id)
        : [target.id];

    // Direction: absorb current INTO target when target is bigger (more native children)
    // or target is a CSV-native group (no overlay entry) with multiple locations.
    // Also absorb if target has an existing overlay entry (user already curated it).
    const targetIsLarger = targetLeafIds.length > currentLeafIds.length;
    const targetIsCsvNative = !targetOverlay && (target.children||[]).length > 1;
    const targetHasOverlay = !!targetOverlay;
    const absorbIntoTarget = targetIsLarger || targetIsCsvNative || targetHasOverlay;

    // Build merged child list under the winning parent.
    // A16.3 KEY FIX: when absorbing current INTO target, we include the source
    // group's own ID in childIds (not just its leaf children). This is critical
    // for top-level single-loc groups (e.g. Middletown) whose id === their only
    // child's id. Step 4b in applyOverlays removes top-level groups whose id is
    // in childIdSet — so the source group disappears from the card list.
    // Step 4d then re-expands it via mergedSourceGroups, recovering its financial data.
    // Including only leaf IDs (not the group ID itself) left the source group
    // alive as a top-level orphan card because its own id was never in childIdSet.
    const baseIds = absorbIntoTarget ? targetLeafIds : currentLeafIds;
    // For the source side: always include the source group's own id so Step 4b
    // can remove it from top-level result. Its children will be expanded by Step 4d.
    const sourceGroupId = absorbIntoTarget ? group.id : target.id;
    const addIds  = absorbIntoTarget ? currentLeafIds : targetLeafIds;
    const merged  = [...baseIds];
    // Add source group id first (Step 4b removal key)
    if (!merged.includes(sourceGroupId)) merged.push(sourceGroupId);
    // Add any leaf ids not already present (handles overlay-based source groups)
    addIds.forEach((id:string) => { if (!merged.includes(id)) merged.push(id); });

    const winnerGroup  = absorbIntoTarget ? target : group;
    const winnerEntry  = absorbIntoTarget ? targetOverlay : existingEntry;

    const groupEntry = {
      id: winnerGroup.id,
      name: fixGroupName(winnerGroup),
      tier: winnerGroup.tier || "Standard",
      class2: winnerGroup.class2 || "Private Practice",
      childIds: merged,
      source: "manual-merge",
      createdAt: winnerEntry?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    patchOverlay([{ op: "set", path: `groups.${winnerGroup.id}`, value: groupEntry }]).then((ok:boolean) => {
      setMergeSaving(false);
      if (ok) {
        setMergeToast(`✅ Merged ${fixGroupName(target)} into ${fixGroupName(group)}`);
        setMergeTarget(null);
        setShowMerge(false);
        setMergeSearch("");
        setTimeout(() => setMergeToast(null), 4000);
        // Reload to see merged group
        // reload removed — merge is already in memory via setOverlays; reload caused stale GitHub fetch to wipe the save
      } else {
        setMergeToast("❌ Save failed — try again");
        setTimeout(() => setMergeToast(null), 3000);
      }
    });
  };

  return <div style={{paddingBottom:80}}>

    {/* ── STICKY HEADER ── */}
    <div style={{position:"sticky",top:52,zIndex:40,background:"rgba(10,10,15,.9)",backdropFilter:"blur(20px)",borderBottom:`1px solid ${T.b3}`,padding:"10px 16px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <button onClick={goMain} style={{background:"none",border:"none",color:T.blue,cursor:"pointer",display:"flex",alignItems:"center",gap:4,fontSize:13,fontWeight:600,fontFamily:"inherit"}}><Back/> Groups</button>
        <button onClick={runGroupResearch} disabled={resLoading}
          style={{background:"rgba(34,211,238,.08)",border:"1px solid rgba(34,211,238,.2)",borderRadius:8,padding:"4px 12px",fontSize:10,fontWeight:700,color:resLoading?"rgba(34,211,238,.5)":T.cyan,cursor:resLoading?"not-allowed":"pointer",fontFamily:"inherit"}}>
          {resLoading ? "Searching..." : (resResult ? "Re-research" : "Research")}
        </button>
      </div>
    </div>

    <div style={{padding:"12px 16px 0"}}>

      {/* ── HERO ── */}
      <div className="anim" style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:14,padding:"12px 14px",marginBottom:10}}>

        {/* Name + health + merge */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:15,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{fixGroupName(group)}</div>
            <div style={{fontSize:10,color:T.t3,marginTop:1}}>{group.locs} location{group.locs!==1?"s":""} · {getTierLabel(group.tier,group.class2)}</div>
          </div>
          <div style={{display:"flex",gap:5,flexShrink:0,marginLeft:8,alignItems:"center"}}>
            <span style={{fontSize:9,fontWeight:700,color:healthColor,background:`${healthColor}14`,border:`1px solid ${healthColor}30`,borderRadius:5,padding:"2px 8px"}}>{healthLabel}</span>
            <button onClick={()=>{setShowMerge(true);setMergeSearch("");setMergeTarget(null);}} style={{fontSize:9,fontWeight:700,color:T.purple,background:"rgba(167,139,250,.08)",border:"1px solid rgba(167,139,250,.18)",borderRadius:5,padding:"2px 8px",cursor:"pointer",fontFamily:"inherit"}}>⊕ Merge</button>
          </div>
        </div>

        {/* Merge toast */}
        {mergeToast&&<div style={{marginBottom:8,padding:"7px 10px",borderRadius:7,fontSize:11,fontWeight:600,color:mergeToast.startsWith("✅")?T.green:T.red,background:mergeToast.startsWith("✅")?"rgba(52,211,153,.08)":"rgba(248,113,113,.08)",border:`1px solid ${mergeToast.startsWith("✅")?"rgba(52,211,153,.2)":"rgba(248,113,113,.2)"}`}}>{mergeToast}</div>}

        {/* Quarter selector */}
        <div style={{display:"flex",gap:3,marginBottom:10}}>
          {["1","2","3","4","FY"].map(qr=>(
            <button key={qr} onClick={()=>setQ(qr)} style={{flex:1,padding:"5px 0",borderRadius:7,fontSize:10,fontWeight:600,cursor:"pointer",border:`1px solid ${q===qr?"rgba(79,142,247,.25)":T.b2}`,background:q===qr?"rgba(79,142,247,.12)":T.s2,color:q===qr?T.blue:T.t3,fontFamily:"inherit"}}>{qr==="FY"?"FY":`Q${qr}`}</button>
          ))}
        </div>

        {/* Stats strip */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6}}>
          <Stat l="PY" v={$$(py)} c={T.t2}/>
          <Stat l="CY" v={$$(cy)} c={T.blue}/>
          <Stat l="Gap" v={gap<=0?`+${$$(Math.abs(gap))}`:$$(gap)} c={gap<=0?T.green:T.red}/>
          <Stat l="Ret" v={ret+"%"} c={healthColor}/>
        </div>

        {/* Account Brief — collapsible */}
        {briefLines.length>0&&<div style={{marginTop:10,borderTop:`1px solid ${T.b2}`,paddingTop:8}}>
          <button onClick={()=>setBriefOpen(v=>!v)} style={{background:"none",border:"none",padding:0,cursor:"pointer",display:"flex",alignItems:"center",gap:6,fontFamily:"inherit",width:"100%",textAlign:"left"}}>
            <span style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.cyan}}>Intel Brief</span>
            <span style={{fontSize:10,color:T.t4,marginLeft:"auto",transition:"transform .2s",display:"inline-block",transform:briefOpen?"rotate(90deg)":"rotate(0deg)"}}>›</span>
          </button>
          {briefOpen&&<div style={{marginTop:7,display:"flex",flexDirection:"column",gap:5}}>
            {briefLines.map((line,i)=>(
              <div key={i} style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                <span style={{width:4,height:4,borderRadius:"50%",background:line.color,flexShrink:0,marginTop:6}}/>
                <span style={{fontSize:11,color:T.t2,lineHeight:1.5}}>{line.text}</span>
              </div>
            ))}
          </div>}
        </div>}
      </div>

      {/* ── DSO BENCHMARK PANEL ── */}
      {(group.class2==="DSO"||group.class2==="EMERGING DSO"||(group.class2||"").toUpperCase().includes("DSO"))&&(()=>{
        const card=buildDsoCard(group,"avg");
        const pctBelow=card.benchQ>0?Math.round((card.benchGapQ/card.benchQ)*100):0;
        if(card.benchGapQ<=0)return null;
        return <div className="anim" style={{background:"rgba(248,113,113,.05)",border:"1px solid rgba(248,113,113,.2)",borderRadius:14,padding:"12px 14px",marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.red}}>Benchmark Gap</div>
            <div style={{fontSize:9,color:T.t4}}>{card.locs} offices · avg $747/office</div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:8}}>
            <div style={{background:T.s2,borderRadius:8,padding:"6px 8px"}}>
              <div style={{fontSize:8,color:T.t4,marginBottom:1}}>CY Q1</div>
              <div style={{fontSize:13,fontWeight:700,color:T.blue}}>{card.cy1>=1000?`$${Math.round(card.cy1/1000)}K`:`$${Math.round(card.cy1)}`}</div>
            </div>
            <div style={{background:T.s2,borderRadius:8,padding:"6px 8px"}}>
              <div style={{fontSize:8,color:T.t4,marginBottom:1}}>Benchmark</div>
              <div style={{fontSize:13,fontWeight:700,color:T.t2}}>{card.benchQ>=1000?`$${Math.round(card.benchQ/1000)}K`:`$${Math.round(card.benchQ)}`}</div>
            </div>
            <div style={{background:"rgba(248,113,113,.08)",borderRadius:8,padding:"6px 8px"}}>
              <div style={{fontSize:8,color:T.t4,marginBottom:1}}>Gap</div>
              <div style={{fontSize:13,fontWeight:700,color:T.red}}>{card.benchGapQ>=1000?`$${Math.round(card.benchGapQ/1000)}K`:`$${Math.round(card.benchGapQ)}`}</div>
            </div>
          </div>
          <div style={{fontSize:9,color:T.t3,lineHeight:1.5}}>{card.statement}</div>
        </div>;
      })()}

      {/* ── WHAT TO DO NEXT ── */}
      {nextBestMoves.length>0&&<div className="anim" style={{animationDelay:"8ms",background:T.s1,border:`1px solid rgba(79,142,247,.2)`,borderLeft:`3px solid ${T.blue}`,borderRadius:14,padding:"12px 14px",marginBottom:10}}>
        <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.blue,marginBottom:8}}>Next Move</div>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {nextBestMoves.map((m,i)=>(
            <div key={i} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"9px 10px",background:T.s2,borderRadius:10,border:`1px solid ${m.color}18`}}>
              <div style={{width:18,height:18,borderRadius:"50%",background:`${m.color}18`,border:`1px solid ${m.color}40`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}>
                <span style={{fontSize:8,fontWeight:700,color:m.color}}>{i+1}</span>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:11,fontWeight:700,color:T.t1,lineHeight:1.3}}>{m.action}</div>
                <div style={{fontSize:10,color:T.t3,marginTop:2,lineHeight:1.3}}>{m.why}</div>
              </div>
              <div style={{width:3,height:28,borderRadius:2,background:m.color,flexShrink:0,marginTop:4,opacity:.7}}/>
            </div>
          ))}
        </div>
      </div>}

      {/* ── OPPORTUNITIES ── */}
      {opportunitySignals.length>0&&<div className="anim" style={{animationDelay:"12ms",background:T.s1,border:`1px solid ${T.b1}`,borderRadius:14,padding:"12px 14px",marginBottom:10}}>
        <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.orange,marginBottom:10}}>Opportunities</div>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {opportunitySignals.map((sig,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 10px",background:T.s2,borderRadius:10,border:`1px solid ${sig.color}18`}}>
              <span style={{fontSize:13,width:18,textAlign:"center",flexShrink:0,color:sig.color}}>{sig.icon}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:11,fontWeight:700,color:T.t1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sig.label}</div>
                <div style={{fontSize:10,color:T.t3,marginTop:1}}>{sig.detail}</div>
              </div>
              <div style={{width:3,height:24,borderRadius:2,background:sig.color,flexShrink:0,opacity:.6}}/>
            </div>
          ))}
        </div>
      </div>}

      {/* ── LOCATIONS ── */}
      {sortedChildren.length>0&&<div className="anim" style={{animationDelay:"16ms",marginBottom:10}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}>
          <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.t3}}>Locations · {sortedChildren.length}</div>
          {sortedChildren.length>3&&<button onClick={()=>setShowAllLocs(v=>!v)} style={{background:"none",border:"none",fontSize:9,color:T.blue,cursor:"pointer",fontFamily:"inherit",padding:0}}>{showAllLocs?"Show less":"Show all"}</button>}
        </div>
        {(showAllLocs?sortedChildren:sortedChildren.slice(0,3)).map((c,i)=>{
          const cPy=c.pyQ?.[qk]||0;const cCy=c.cyQ?.[qk]||0;const cGap=cPy-cCy;const cRet=cPy>0?Math.round(cCy/cPy*100):0;
          const cRetColor=cRet>=70?T.green:cRet>=40?T.amber:T.red;
          const borderColor=cGap>2000?"rgba(248,113,113,.2)":cGap<=0&&cPy>0?"rgba(52,211,153,.15)":T.b1;
          return <button key={c.id} className="anim" onClick={()=>goAcct(c)} style={{animationDelay:`${i*25}ms`,width:"100%",textAlign:"left",background:T.s1,border:`1px solid ${borderColor}`,borderRadius:11,padding:"10px 12px",marginBottom:6,cursor:"pointer"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
              <div style={{fontSize:12,fontWeight:600,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</div>
              <Chev/>
            </div>
            <div style={{fontSize:9,color:T.t3,marginBottom:5}}>
              {[c.addr,[c.city,c.st].filter(Boolean).join(" ")].filter(Boolean).join(", ")}
              {c.dealer&&c.dealer!=="All Other"&&<span style={{color:T.cyan}}> · {c.dealer}</span>}
              {c.last!=null&&<span style={{color:T.t4}}> · Last {c.last}d</span>}
            </div>
            <div style={{display:"flex",gap:10}}>
              <Pill l="PY" v={$$(cPy)} c={T.t2}/><Pill l="CY" v={$$(cCy)} c={T.blue}/><Pill l="Gap" v={cGap<=0?`+${$$(Math.abs(cGap))}`:$$(cGap)} c={cGap<=0?T.green:T.red}/><div style={{marginLeft:"auto"}}><Pill l="Ret" v={cRet+"%"} c={cRetColor}/></div>
            </div>
            {(c.products||[]).length>0&&<div style={{marginTop:6,display:"flex",gap:3,flexWrap:"wrap"}}>
              {c.products.slice(0,4).map((p,j)=>{const pCy=p[`cy${qk}`]||0;const pPy=p[`py${qk}`]||0;return <span key={j} style={{fontSize:8,color:pPy>200&&pCy===0?T.red:T.t3,background:pPy>200&&pCy===0?"rgba(248,113,113,.06)":T.s2,borderRadius:3,padding:"2px 4px",border:`1px solid ${pPy>200&&pCy===0?"rgba(248,113,113,.12)":T.b2}`}}>{p.n.split(" ")[0]} {pPy>200&&pCy===0?"!$0":$$(pCy)}</span>;})}
            </div>}
          </button>;
        })}
        {!showAllLocs&&sortedChildren.length>3&&<button onClick={()=>setShowAllLocs(true)} style={{width:"100%",padding:"6px 0",borderRadius:9,background:T.s1,border:`1px solid ${T.b1}`,fontSize:11,color:T.blue,cursor:"pointer",fontFamily:"inherit",marginBottom:6}}>↓ Show all {sortedChildren.length} locations</button>}
        {ghostLocations.map((c:any,i:number)=>(
          <div key={c.id} style={{background:"rgba(167,139,250,.04)",border:"1px dashed rgba(167,139,250,.3)",borderRadius:11,padding:"10px 12px",marginBottom:6,opacity:.8}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
              <div style={{fontSize:12,fontWeight:600,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:T.t2}}>{c.name}</div>
              <span style={{fontSize:8,fontWeight:700,color:T.purple,background:"rgba(167,139,250,.15)",borderRadius:3,padding:"2px 6px",border:"1px solid rgba(167,139,250,.3)",flexShrink:0,marginLeft:8}}>NEW ✦</span>
            </div>
            {(c.city||c.addr)&&<div style={{fontSize:9,color:T.t4,marginBottom:4}}>{c.addr?`${c.addr}, `:""}{c.city}{c.st?`, ${c.st}`:""}{c.zip?` ${c.zip}`:""}</div>}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:9,color:T.purple,fontStyle:"italic"}}>Found in research · not yet in territory data</div>
              <button onClick={()=>setGhostLocations(prev=>{const next=prev.filter((_:any,j:number)=>j!==i);try{localStorage.setItem(`ghost_locs:${group.id}`,JSON.stringify(next));}catch{}return next;})} style={{background:"none",border:"none",color:T.t4,fontSize:9,cursor:"pointer",fontFamily:"inherit",padding:0}}>dismiss</button>
            </div>
          </div>
        ))}
      </div>}

      {/* ── PRODUCTS ── */}
      {hasProducts&&(()=>{
        const MONTHS_S=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        const QMAP:Record<number,string>={1:"Q1",2:"Q1",3:"Q1",4:"Q2",5:"Q2",6:"Q2",7:"Q3",8:"Q3",9:"Q3",10:"Q4",11:"Q4",12:"Q4"};
        const childIdSet=new Set((group.children||[]).map((c:any)=>c.id));
        const monthData=(prodName:string)=>{
          const recs=salesStore?.records?(Object.values(salesStore.records) as any[]).filter((r:any)=>childIdSet.has(r.childId)&&r.l3===prodName):[];
          const mb:Record<number,{py:number,cy:number}>={};
          for(let m=1;m<=12;m++)mb[m]={py:0,cy:0};
          recs.forEach((r:any)=>{const m=r.month||1;if(m>=1&&m<=12){mb[m].py+=r.py||0;mb[m].cy+=r.cy||0;}});
          return [12,11,10,9,8,7,6,5,4,3,2,1].filter(m=>mb[m].py>0||mb[m].cy>0).map(m=>({m,label:MONTHS_S[m-1],q:QMAP[m],py:mb[m].py,cy:mb[m].cy}));
        };
        const MonthTable=({rows}:any)=>rows.length===0
          ?<div style={{fontSize:10,color:T.t4,textAlign:"center",padding:"6px 0"}}>No monthly data · upload CSV to populate</div>
          :<>
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:4,marginBottom:4,paddingBottom:4,borderBottom:"1px solid rgba(255,255,255,.05)"}}>
              {["Month","Q","PY","CY"].map(h=><span key={h} style={{fontSize:8,fontWeight:700,color:T.t4,textTransform:"uppercase",letterSpacing:".5px"}}>{h}</span>)}
            </div>
            {rows.map(({m,label,q,py,cy}:any)=>(
              <div key={m} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:4,padding:"3px 0",borderBottom:"1px solid rgba(255,255,255,.03)"}}>
                <span style={{fontSize:10,color:T.t2}}>{label}</span>
                <span style={{fontSize:9,color:T.t4}}>{q}</span>
                <span className="m" style={{fontSize:10,color:T.t3,fontFamily:"monospace"}}>{$$(py)}</span>
                <span className="m" style={{fontSize:10,color:(py-cy)>0?T.red:(py-cy)<0?T.green:T.blue,fontFamily:"monospace",fontWeight:600}}>{$$(cy)}</span>
              </div>
            ))}
          </>;
        return <div className="anim" style={{animationDelay:"20ms",background:T.s1,border:`1px solid ${T.b1}`,borderRadius:14,padding:"12px 14px",marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.blue}}>Products</div>
            <span style={{fontSize:9,color:T.t4}}>tap · monthly history</span>
          </div>
          {groupStopped.length>0&&<>
            <div style={{fontSize:10,fontWeight:700,color:T.red,marginBottom:7}}>Stopped ({groupStopped.length})</div>
            {groupStopped.map((p,i)=>{
              const isExp=expandedProduct===p.name;
              return <div key={i} style={{marginBottom:8,borderRadius:8,background:"rgba(248,113,113,.04)",border:`1px solid ${isExp?"rgba(248,113,113,.25)":"rgba(248,113,113,.08)"}`,overflow:"hidden"}}>
                <div onClick={()=>setExpandedProduct(isExp?null:p.name)} style={{padding:"8px 10px",cursor:"pointer"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:p.locsDown.length>0?4:0}}>
                    <span style={{fontSize:11,fontWeight:600,color:T.t1}}>{p.name}</span>
                    <div style={{display:"flex",alignItems:"center",gap:7}}>
                      <span className="m" style={{fontSize:10,color:T.red}}>Was {$$(p.py)} → $0</span>
                      <span onClick={e=>{e.stopPropagation();setSelProduct(p.name);}} style={{fontSize:9,color:T.t4,cursor:"pointer",textDecoration:"underline"}}>Locs</span>
                      <span style={{fontSize:10,color:T.t3,transition:"transform .2s",display:"inline-block",transform:isExp?"rotate(90deg)":"rotate(0deg)"}}>›</span>
                    </div>
                  </div>
                  {p.locsDown.length>0&&<div style={{fontSize:9,color:T.t4,lineHeight:1.5}}>
                    {p.locsDown.slice(0,3).map((l:string)=>l.split(" ").slice(0,2).join(" ")).join(" · ")}{p.locsDown.length>3&&<span> +{p.locsDown.length-3} more</span>}
                  </div>}
                </div>
                {isExp&&<div style={{borderTop:"1px solid rgba(248,113,113,.1)",background:"rgba(0,0,0,.2)",padding:"8px 10px"}}><MonthTable rows={monthData(p.name)}/></div>}
              </div>;
            })}
          </>}
          {groupBuying.length>0&&<>
            {groupStopped.length>0&&<div style={{marginBottom:8}}/>}
            <div style={{fontSize:10,fontWeight:700,color:T.green,marginBottom:7}}>Buying ({groupBuying.length})</div>
            {groupBuying.slice(0,10).map((p,i)=>{
              const mx=groupBuying[0]?.cy||1;const trend=p.py>0?p.cy/p.py:1;const pGap=p.py-p.cy;
              const isExp2=expandedProduct===p.name;
              return <div key={i} style={{marginBottom:7,borderRadius:8,border:`1px solid ${isExp2?"rgba(79,142,247,.2)":"transparent"}`,overflow:"hidden"}}>
                <div onClick={()=>setExpandedProduct(isExp2?null:p.name)} style={{cursor:"pointer"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                    <span style={{fontSize:11,color:T.t2,flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>
                    <div style={{display:"flex",gap:5,flexShrink:0,marginLeft:8,alignItems:"center"}}>
                      <span className="m" style={{fontSize:9,color:T.t4}}>{$$(p.py)}</span>
                      <span className="m" style={{fontSize:10,color:trend>=0.8?T.blue:T.amber,fontWeight:600}}>{$$(p.cy)}</span>
                      {pGap>0&&<span className="m" style={{fontSize:9,color:T.red,fontWeight:600}}>-{$$(pGap)}</span>}
                      <span onClick={e=>{e.stopPropagation();setSelProduct(p.name);}} style={{fontSize:9,color:T.t4,cursor:"pointer",textDecoration:"underline"}}>Locs</span>
                      <span style={{fontSize:10,color:T.t3,transition:"transform .2s",display:"inline-block",transform:isExp2?"rotate(90deg)":"rotate(0deg)"}}>›</span>
                    </div>
                  </div>
                  <div style={{height:3,borderRadius:2,background:T.s3,overflow:"hidden"}}>
                    <div className="bar-g" style={{animationDelay:`${i*40}ms`,height:"100%",borderRadius:2,width:`${Math.min(p.cy/mx*100,100)}%`,background:trend>=0.8?`linear-gradient(90deg,${T.blue},${T.cyan})`:T.amber}}/>
                  </div>
                  {p.locsDown.length>0&&<div style={{fontSize:9,color:T.amber,marginTop:2}}>⚠ {p.locsDown.slice(0,2).map((l:string)=>l.split(" ").slice(0,2).join(" ")).join(", ")} stopped</div>}
                </div>
                {isExp2&&<div style={{borderTop:"1px solid rgba(79,142,247,.1)",background:"rgba(0,0,0,.15)",padding:"8px 4px 4px",marginTop:6}}><MonthTable rows={monthData(p.name)}/></div>}
              </div>;
            })}
          </>}
        </div>;
      })()}

      {/* ── DISTRIBUTOR LEVERAGE ── */}
      {distBreakdown.rows.length>0&&<div className="anim" style={{animationDelay:"24ms",background:T.s1,border:`1px solid ${T.b1}`,borderRadius:14,padding:"12px 14px",marginBottom:10}}>
        <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.orange,marginBottom:10}}>Distributor Leverage</div>
        {distBreakdown.rows.map((row,i)=>{
          const DIST_COLOR:Record<string,string>={Schein:"#4f8ef7",Patterson:"#a78bfa",Benco:"#22d3ee",Darby:"#fbbf24","DDS Dental":"#f97316","Dental City":"#10b981","All Other":"#7878a0"};
          const dc=DIST_COLOR[row.dist]||"#7878a0";
          const shareDelta=row.cyPct-row.pyPct;
          const trend=row.py>0?row.cy/row.py:null;
          const fsc=fscMap[row.dist];
          const childCount=(group.children||[]).filter((c:any)=>c.dealer===row.dist).length;
          return <div key={row.dist} style={{marginBottom:i<distBreakdown.rows.length-1?14:0}}>
            {/* Dist header */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
              <div style={{display:"flex",alignItems:"center",gap:5}}>
                <span style={{fontSize:10,fontWeight:700,color:dc,background:`${dc}18`,borderRadius:4,padding:"2px 7px"}}>{row.dist}</span>
                <span style={{fontSize:9,color:T.t4}}>{row.locs} loc{row.locs!==1?"s":""}</span>
                {shareDelta>0.03&&<span style={{fontSize:9,color:T.green,fontWeight:600}}>▲ share</span>}
                {shareDelta<-0.03&&<span style={{fontSize:9,color:T.red,fontWeight:600}}>▼ share</span>}
              </div>
              <div style={{textAlign:"right"}}>
                <span className="m" style={{fontSize:12,fontWeight:700,color:T.t1}}>{$$(row.cy)}</span>
                <span style={{fontSize:9,color:T.t4,marginLeft:4}}>{Math.round(row.cyPct*100)}%</span>
                {trend!==null&&<span style={{fontSize:9,color:trend>=0.9?T.green:trend>=0.7?T.amber:T.red,marginLeft:5,fontWeight:600}}>{Math.round(trend*100)}%</span>}
              </div>
            </div>
            {/* Share bar */}
            <div style={{height:5,borderRadius:3,background:T.s3,overflow:"hidden",marginBottom:1}}>
              <div className="bar-g" style={{animationDelay:`${i*60}ms`,height:"100%",borderRadius:3,width:`${row.cyPct*100}%`,background:`linear-gradient(90deg,${dc},${dc}99)`}}/>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:3,marginBottom:8}}>
              <div style={{flex:1,height:2,borderRadius:2,background:T.s3,overflow:"hidden"}}>
                <div style={{height:"100%",borderRadius:2,width:`${row.pyPct*100}%`,background:`${dc}40`}}/>
              </div>
              <span style={{fontSize:8,color:T.t4,flexShrink:0}}>{$$(row.py)} PY</span>
            </div>
            {/* Inline FSC rep */}
            {groupDists.includes(row.dist)&&<div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 10px",background:T.s2,borderRadius:8,border:`1px solid ${T.b2}`}}>
              <span style={{fontSize:9,color:T.t4,flexShrink:0}}>FSC</span>
              {fsc
                ?<div style={{flex:1,minWidth:0,display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:11,fontWeight:600,color:T.t1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{fsc.name}</span>
                    {fsc.phone&&<a href={`tel:${fsc.phone.replace(/\D/g,"")}`} style={{fontSize:9,color:T.cyan,textDecoration:"none",flexShrink:0}}>📞 {fsc.phone}</a>}
                  </div>
                :<span style={{fontSize:10,color:T.t4,fontStyle:"italic",flex:1}}>No FSC</span>
              }
              <div style={{display:"flex",gap:4,flexShrink:0}}>
                {fsc?.phone&&<a href={`tel:${fsc.phone.replace(/\D/g,"")}`} style={{background:"rgba(34,211,153,.1)",border:"1px solid rgba(34,211,153,.2)",borderRadius:5,padding:"2px 7px",fontSize:9,fontWeight:600,color:T.green,textDecoration:"none"}}>Call</a>}
                <button onClick={()=>openEdit(row.dist)} style={{background:"rgba(79,142,247,.08)",border:"1px solid rgba(79,142,247,.15)",borderRadius:5,padding:"2px 7px",fontSize:9,fontWeight:600,color:T.blue,cursor:"pointer",fontFamily:"inherit"}}>{fsc?"Edit":"+ Add"}</button>
                {fsc?.source==="manual"&&<button onClick={()=>deleteRep(row.dist)} style={{background:"none",border:"none",color:T.t4,cursor:"pointer",fontSize:10,padding:"0 2px"}}>✕</button>}
              </div>
            </div>}
          </div>;
        })}
        {/* Schein roster edit modal */}
        {editDist&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={e=>{if(e.target===e.currentTarget)setEditDist(null)}}>
          <div style={{background:T.s1,borderRadius:"20px 20px 0 0",padding:24,width:"100%",maxWidth:480,paddingBottom:40}}>
            <div style={{fontSize:13,fontWeight:700,marginBottom:16}}>FSC for {editDist}</div>
            <div style={{marginBottom:10}}>
              <div style={{fontSize:10,color:T.t3,marginBottom:4,fontWeight:600}}>Name *</div>
              <input value={editName} onChange={e=>setEditName(e.target.value)} placeholder="Rep name" style={{width:"100%",background:T.s2,border:`1px solid ${T.b1}`,borderRadius:8,padding:"8px 10px",fontSize:13,color:T.t1,fontFamily:"inherit"}}/>
            </div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:10,color:T.t3,marginBottom:6,fontWeight:600}}>Pick from Schein Roster (CT + NE)</div>
              <input value={rosterSearch} onChange={e=>setRosterSearch(e.target.value)}
                placeholder="Search FSC or ES by name"
                style={{width:"100%",background:T.s2,border:"1px solid "+T.b1,borderRadius:8,padding:"7px 10px",fontSize:12,color:T.t1,fontFamily:"inherit",marginBottom:6}}/>
              {rosterSearch.trim().length>0&&<div style={{maxHeight:160,overflowY:"auto",borderRadius:8,border:"1px solid "+T.b1,background:T.s2}}>
                {filteredRoster.length===0&&<div style={{padding:"10px",fontSize:11,color:T.t4}}>No matches</div>}
                {filteredRoster.map((r:any,i:number)=>(
                  <button key={i} onClick={()=>pickFromRoster(r)}
                    style={{width:"100%",textAlign:"left",padding:"8px 12px",background:"none",border:"none",borderBottom:"1px solid "+T.b2,color:T.t1,cursor:"pointer",fontFamily:"inherit"}}>
                    <div style={{fontSize:12,fontWeight:600}}>{r.name}</div>
                    <div style={{fontSize:10,color:T.t4}}>{r.phone}</div>
                  </button>
                ))}
              </div>}
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

      {/* ── CONTACTS ── */}
      <div className="anim" style={{animationDelay:"28ms",background:T.s1,border:`1px solid ${T.b1}`,borderRadius:14,padding:"12px 14px",marginBottom:10}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:groupContacts.length>0||((resResult?.contacts||[]).length>0)?10:0}}>
          <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.purple}}>Contacts</div>
          <button onClick={()=>openContactForm()} style={{background:"rgba(167,139,250,.1)",border:"1px solid rgba(167,139,250,.2)",borderRadius:6,padding:"2px 8px",fontSize:9,fontWeight:700,color:T.purple,cursor:"pointer",fontFamily:"inherit"}}>+ Add</button>
        </div>

        {/* Saved contacts */}
        {groupContacts.map((c:any,i:number)=>(
          <div key={c.id} style={{borderTop:i>0?`1px solid ${T.b2}`:"none",paddingTop:i>0?9:0,marginTop:i>0?9:0}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:700,color:T.t1}}>{c.name}</div>
                {c.role&&<div style={{fontSize:10,color:T.purple,marginTop:1}}>{c.role}</div>}
                <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:4}}>
                  {c.phone&&<a href={`tel:${c.phone.replace(/\D/g,"")}`} style={{fontSize:10,color:T.cyan,textDecoration:"none"}}>{c.phone}</a>}
                  {c.email&&<a href={`mailto:${c.email}`} style={{fontSize:10,color:T.blue,textDecoration:"none"}}>{c.email}</a>}
                </div>
                {c.notes&&<div style={{fontSize:10,color:T.t3,marginTop:3,fontStyle:"italic",lineHeight:1.4}}>{c.notes}</div>}
              </div>
              <div style={{display:"flex",gap:5,flexShrink:0,marginLeft:8}}>
                {c.phone&&<a href={`tel:${c.phone.replace(/\D/g,"")}`} style={{background:"rgba(34,211,153,.1)",border:"1px solid rgba(34,211,153,.2)",borderRadius:5,padding:"2px 7px",fontSize:9,fontWeight:600,color:T.green,textDecoration:"none"}}>Call</a>}
                <button onClick={()=>openContactForm(c)} style={{background:"rgba(79,142,247,.08)",border:"1px solid rgba(79,142,247,.15)",borderRadius:5,padding:"2px 7px",fontSize:9,fontWeight:600,color:T.blue,cursor:"pointer",fontFamily:"inherit"}}>Edit</button>
                <button onClick={()=>deleteContact(c.id)} style={{background:"none",border:"none",color:T.t4,cursor:"pointer",fontSize:11,padding:"0 2px"}}>✕</button>
              </div>
            </div>
          </div>
        ))}

        {/* Research-found contacts */}
        {resResult&&!resLoading&&(resResult.contacts||[]).length>0&&<>
          {groupContacts.length>0&&<div style={{borderTop:`1px solid ${T.b2}`,margin:"8px 0"}}/>}
          <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",color:T.t4,letterSpacing:"1px",marginBottom:7}}>From Research</div>
          {(resResult.contacts||[]).map((c:any,i:number)=>{
            const SCOPE_LABELS=["Decision Maker","Practice Manager","Regional / DSO","Coordinator"];
            const SCOPE_COLORS_KEYS=["cyan","blue","purple","t4"];
            const sl=SCOPE_LABELS[(c.scope||1)-1]||SCOPE_LABELS[0];
            const sc=T[SCOPE_COLORS_KEYS[(c.scope||1)-1]]||T.t4;
            const isSaved=savedResContacts.has(i);
            return <div key={i} style={{padding:"8px 10px",background:(c.scope||1)===1?"rgba(34,211,238,.04)":T.s2,borderRadius:8,marginBottom:6,border:(c.scope||1)===1?"1px solid rgba(34,211,238,.15)":"1px solid transparent"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:1}}>
                    <div style={{fontSize:12,fontWeight:700,color:T.t1}}>{c.name||"Unknown"}</div>
                    <span style={{fontSize:8,fontWeight:700,color:sc,background:sc+"18",borderRadius:3,padding:"1px 5px",flexShrink:0}}>{sl}</span>
                  </div>
                  {c.role&&<div style={{fontSize:10,color:T.t3,marginBottom:3}}>{c.role}</div>}
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {c.phone&&<a href={`tel:${c.phone.replace(/\D/g,"")}`} style={{fontSize:10,color:T.cyan,textDecoration:"none"}}>📞 {c.phone}</a>}
                    {c.email&&<a href={`mailto:${c.email}`} style={{fontSize:10,color:T.blue,textDecoration:"none"}}>✉ {c.email}</a>}
                  </div>
                </div>
                <button onClick={()=>saveResContact(c,i)} disabled={isSaved}
                  style={{background:isSaved?"rgba(52,211,153,.1)":"rgba(79,142,247,.1)",border:"1px solid "+(isSaved?"rgba(52,211,153,.2)":"rgba(79,142,247,.2)"),borderRadius:5,padding:"3px 8px",fontSize:9,fontWeight:700,color:isSaved?T.green:T.blue,cursor:isSaved?"default":"pointer",fontFamily:"inherit",flexShrink:0,marginLeft:8}}>
                  {isSaved?"Saved":"+ Save"}
                </button>
              </div>
            </div>;
          })}
        </>}

        {groupContacts.length===0&&(!resResult||resDismissed||(resResult.contacts||[]).length===0)&&<div style={{fontSize:11,color:T.t4,paddingTop:6}}>No contacts yet. Hit Research to find contacts, or add manually.</div>}
      </div>

      {/* ── TASKS ── */}
      {onAddTask&&<TaskWidget group={group} tasks={overlays?.tasks||[]} onAddTask={onAddTask}/>}

      {/* ── GROUP NOTES ── */}
      <div className="anim" style={{animationDelay:"32ms",background:T.s1,border:`1px solid ${T.b1}`,borderRadius:14,padding:"12px 14px",marginBottom:10}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.amber}}>Notes</div>
          {noteSaved&&<span style={{fontSize:9,color:T.green}}>✓ Saved</span>}
        </div>
        <textarea
          value={groupNote}
          onChange={e=>setGroupNote(e.target.value)}
          onBlur={e=>saveNote(e.target.value)}
          placeholder={`Notes for ${fixGroupName(group)} — intel, patterns, relationships, anything that applies across all locations...`}
          rows={4}
          style={{width:"100%",background:T.s2,border:`1px solid ${T.b1}`,borderRadius:8,padding:"9px 11px",fontSize:12,color:T.t1,fontFamily:"inherit",resize:"none",lineHeight:1.5,outline:"none",boxSizing:"border-box"}}
        />
        <div style={{marginTop:4,fontSize:9,color:T.t4}}>Auto-saves when you leave</div>
      </div>

      {/* ── AI GROUP INTEL ── */}
      {(resLoading||(resResult&&!resDismissed))&&<div className="anim" style={{background:T.s1,border:"1px solid rgba(34,211,238,.2)",borderRadius:14,padding:"12px 14px",marginBottom:10}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{display:"flex",alignItems:"center",gap:7}}>
            <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.cyan}}>Group Intel</div>
            {resResult&&resResult.statusPill&&!resLoading&&(()=>{const sp=STATUS_PILL[resResult.statusPill]||STATUS_PILL.unknown;return<span style={{fontSize:9,fontWeight:700,color:sp.color,background:sp.color+"20",borderRadius:4,padding:"2px 7px"}}>{sp.label}</span>;})()}
          </div>
          {!resLoading&&<button onClick={()=>setResDismissed(true)} style={{background:"none",border:"none",color:T.t4,cursor:"pointer",fontSize:15,lineHeight:1,padding:"0 4px"}}>×</button>}
        </div>
        {resLoading&&<div style={{display:"flex",flexDirection:"column",gap:8}}>{[80,60,90].map((w,i)=><div key={i} style={{height:11,borderRadius:5,background:T.s3,width:w+"%",opacity:.6}}/>)}</div>}
        {resResult&&!resLoading&&<>
          {resResult.status&&(resResult.isProviderError
            ?<div style={{padding:"8px 10px",background:"rgba(248,113,113,.07)",border:"1px solid rgba(248,113,113,.2)",borderRadius:8,marginBottom:8}}>
                <div style={{fontSize:9,fontWeight:700,color:"#f87171",textTransform:"uppercase",letterSpacing:"1px",marginBottom:3}}>{resResult.isQuotaError?"Usage Limit Reached":"Research Unavailable"}</div>
                <div style={{fontSize:11,color:T.t2,lineHeight:1.5}}>{resResult.status}</div>
                {resResult.isQuotaError&&<div style={{fontSize:10,color:T.t4,marginTop:4}}>Check console.anthropic.com to add credits.</div>}
              </div>
            :<div style={{fontSize:12,color:T.t2,lineHeight:1.5,marginBottom:8}}>{resResult.status}</div>
          )}
          {resResult.ownership&&<div style={{fontSize:11,color:T.t3,marginBottom:8,fontStyle:"italic"}}>{resResult.ownership}</div>}
          {resResult.competitive&&<div style={{padding:"7px 10px",background:"rgba(251,191,36,.06)",border:"1px solid rgba(251,191,36,.15)",borderRadius:8,marginBottom:8}}>
            <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",color:T.amber,letterSpacing:"1px",marginBottom:3}}>Competitive Signal</div>
            <div style={{fontSize:11,color:T.t2,lineHeight:1.5}}>{resResult.competitive}</div>
          </div>}
          {resResult.website&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,padding:"7px 10px",background:T.s2,borderRadius:8}}>
            <span style={{fontSize:11,color:T.blue,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{resResult.website}</span>
            <button onClick={saveResWebsite} disabled={resWebsiteSaved} style={{background:resWebsiteSaved?"rgba(52,211,153,.1)":"rgba(79,142,247,.1)",border:"1px solid "+(resWebsiteSaved?"rgba(52,211,153,.2)":"rgba(79,142,247,.2)"),borderRadius:5,padding:"2px 7px",fontSize:9,fontWeight:700,color:resWebsiteSaved?T.green:T.blue,cursor:resWebsiteSaved?"default":"pointer",fontFamily:"inherit",flexShrink:0,marginLeft:8}}>{resWebsiteSaved?"Saved":"Save"}</button>
          </div>}
          {((resResult.talkingPoints||[]).length>0||(resResult.hooks||[]).length>0)&&<div style={{marginBottom:4}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}>
              <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",color:T.t4,letterSpacing:"1px"}}>Call Prep</div>
              <button onClick={saveResNotes} style={{background:"rgba(251,191,36,.08)",border:"1px solid rgba(251,191,36,.2)",borderRadius:5,padding:"1px 7px",fontSize:9,fontWeight:700,color:T.amber,cursor:"pointer",fontFamily:"inherit"}}>+ Add to Notes</button>
            </div>
            {(resResult.talkingPoints||[]).map((tp:string,i:number)=>(
              <div key={"tp-"+i} style={{fontSize:11,color:T.t1,lineHeight:1.5,display:"flex",gap:7,alignItems:"flex-start",marginBottom:5,padding:"6px 9px",background:T.s2,borderRadius:7}}>
                <span style={{color:T.cyan,flexShrink:0,fontWeight:700,fontSize:9,marginTop:1}}>{i+1}</span>
                <span>{tp}</span>
              </div>
            ))}
            {(resResult.hooks||[]).length>0&&<>
              {(resResult.talkingPoints||[]).length>0&&<div style={{fontSize:8,color:T.t4,textTransform:"uppercase",letterSpacing:"1px",marginTop:7,marginBottom:4}}>Also worth mentioning</div>}
              {(resResult.hooks||[]).map((h:string,i:number)=>(
                <div key={"h-"+i} style={{fontSize:11,color:T.t3,lineHeight:1.5,display:"flex",gap:5,alignItems:"flex-start",marginBottom:3}}>
                  <span style={{color:T.t4,flexShrink:0}}>·</span><span>{h}</span>
                </div>
              ))}
            </>}
          </div>}
        </>}
      </div>}

      {/* ── SUGGESTED MERGES ── */}
      {(mergeMatchLoading||suggestedMerges.filter(m=>!dismissedSuggestions.has(m.id)).length>0)&&<div className="anim" style={{background:T.s1,border:`1px solid rgba(167,139,250,.25)`,borderRadius:14,padding:"12px 14px",marginBottom:10}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.purple}}>🔗 Suggested Merges</div>
          {mergeMatchLoading&&<div style={{fontSize:10,color:T.t4}}>Scanning...</div>}
        </div>
        {mergeMatchLoading&&<div style={{height:10,borderRadius:5,background:T.s3,width:"60%",opacity:.5}}/>}
        {suggestedMerges.filter(m=>!dismissedSuggestions.has(m.id)).map((m:any)=>{
          const matchedGroup=groups.find((g:any)=>g.id===m.id);
          const mName=matchedGroup?fixGroupName(matchedGroup):m.id;
          const mLocs=matchedGroup?.locs||matchedGroup?.children?.length||1;
          const mPY=matchedGroup?Object.values(matchedGroup.pyQ||{}).reduce((s:any,v:any)=>s+v,0):0;
          return <div key={m.id} style={{padding:"9px 11px",background:T.s2,borderRadius:9,marginBottom:7,border:`1px solid ${T.purple}20`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:700,color:T.t1}}>{mName}</div>
                <div style={{fontSize:9,color:T.t3,marginTop:1}}>{mLocs} loc{mLocs!==1?"s":""} · PY ${(mPY/1000).toFixed(1)}k</div>
                <div style={{fontSize:10,color:T.purple,marginTop:2,fontStyle:"italic"}}>{m.reason}</div>
              </div>
            </div>
            <div style={{display:"flex",gap:6,marginTop:6}}>
              <button onClick={async()=>{
                if(!patchOverlay)return;
                const canonicalId=group.id;
                const existingChildIds=(group.childIds||[group.id,...(group.children||[]).map((c:any)=>c.id)]);
                const newChildIds=[...new Set([...existingChildIds,m.id])];
                const next={...OVERLAYS_REF,groups:{...OVERLAYS_REF.groups,[canonicalId]:{...(OVERLAYS_REF.groups?.[canonicalId]||{}),id:canonicalId,name:fixGroupName(group),tier:group.tier||"Standard",class2:group.class2||"Private Practice",childIds:newChildIds,source:"manual-merge",updatedAt:new Date().toISOString()}}};
                await patchOverlay([{op:"set",path:`groups.${canonicalId}`,value:next.groups[canonicalId]}]);
                setSuggestedMerges(prev=>prev.filter(s=>s.id!==m.id));
              }} style={{flex:1,padding:"6px 0",borderRadius:7,background:`${T.purple}18`,border:`1px solid ${T.purple}40`,color:T.purple,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Merge</button>
              <button onClick={()=>setDismissedSuggestions(prev=>new Set([...prev,m.id]))} style={{padding:"6px 12px",borderRadius:7,background:T.s1,border:`1px solid ${T.b2}`,color:T.t4,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>Skip</button>
            </div>
          </div>;
        })}
      </div>}

    </div>

    {/* ── CONTACT MODAL ── */}
    {showContactForm&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={e=>{if(e.target===e.currentTarget)setShowContactForm(false)}}>
      <div style={{background:T.s1,borderRadius:"20px 20px 0 0",padding:24,width:"100%",maxWidth:480,paddingBottom:40}}>
        <div style={{fontSize:13,fontWeight:700,marginBottom:16}}>{editContact?"Edit Contact":"Add Contact"}</div>
        {[
          {label:"Name *",val:cName,set:setCName,ph:"e.g. Gabrielle Martin",type:"text"},
          {label:"Role / Title",val:cRole,set:setCRole,ph:"e.g. Special Markets Rep — RI",type:"text"},
          {label:"Phone",val:cPhone,set:setCPhone,ph:"(xxx) xxx-xxxx",type:"tel"},
          {label:"Email",val:cEmail,set:setCEmail,ph:"email@schein.com",type:"email"},
        ].map(({label,val,set,ph,type})=>(
          <div key={label} style={{marginBottom:10}}>
            <div style={{fontSize:10,color:T.t3,marginBottom:4,fontWeight:600}}>{label}</div>
            <input value={val} onChange={e=>set(e.target.value)} placeholder={ph} type={type} style={{width:"100%",background:T.s2,border:`1px solid ${T.b1}`,borderRadius:8,padding:"8px 10px",fontSize:13,color:T.t1,fontFamily:"inherit"}}/>
          </div>
        ))}
        <div style={{marginBottom:16}}>
          <div style={{fontSize:10,color:T.t3,marginBottom:4,fontWeight:600}}>Notes</div>
          <textarea value={cNotes} onChange={e=>setCNotes(e.target.value)} placeholder="Relationship context, best time to reach..." rows={3} style={{width:"100%",background:T.s2,border:`1px solid ${T.b1}`,borderRadius:8,padding:"8px 10px",fontSize:12,color:T.t1,fontFamily:"inherit",resize:"none"}}/>
        </div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={()=>setShowContactForm(false)} style={{flex:1,padding:"10px 0",borderRadius:10,fontSize:13,fontWeight:600,cursor:"pointer",border:`1px solid ${T.b1}`,background:T.s2,color:T.t3,fontFamily:"inherit"}}>Cancel</button>
          <button onClick={saveContact} disabled={!cName.trim()} style={{flex:2,padding:"10px 0",borderRadius:10,fontSize:13,fontWeight:700,cursor:cName.trim()?"pointer":"not-allowed",border:"none",background:cName.trim()?T.purple:"rgba(167,139,250,.3)",color:"#fff",fontFamily:"inherit"}}>Save</button>
        </div>
      </div>
    </div>}

    {/* ── MERGE MODAL ── */}

        {/* ── MERGE GROUP MODAL ── */}
    {showMerge&&<div style={{position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,.75)",backdropFilter:"blur(8px)",display:"flex",flexDirection:"column",justifyContent:"flex-end"}} onClick={()=>{setShowMerge(false);setMergeTarget(null);}}>
      <div style={{background:T.s1,borderRadius:"20px 20px 0 0",padding:20,maxHeight:"80vh",display:"flex",flexDirection:"column"}} onClick={e=>e.stopPropagation()}>

        {!mergeTarget ? <>
          {/* ── SEARCH STEP ── */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div>
              <div style={{fontSize:14,fontWeight:700}}>Absorb Group</div>
              <div style={{fontSize:10,color:T.t3,marginTop:2}}>Merge another group into <span style={{color:T.cyan,fontWeight:600}}>{fixGroupName(group)}</span></div>
            </div>
            <button onClick={()=>setShowMerge(false)} style={{background:"none",border:"none",color:T.t4,cursor:"pointer",fontSize:18}}>✕</button>
          </div>
          <input autoFocus type="text" value={mergeSearch} onChange={e=>setMergeSearch(e.target.value)}
            placeholder="Search by group or office name…"
            style={{width:"100%",height:42,borderRadius:10,border:`1px solid ${mergeSearch?T.blue+"44":T.b1}`,background:T.s2,color:T.t1,fontSize:13,padding:"0 14px",outline:"none",fontFamily:"inherit",boxSizing:"border-box",marginBottom:10}}/>
          <div style={{overflowY:"auto",flex:1,maxHeight:"50vh"}}>
            {mergeSearch.trim() && mergeResults.length===0 && <div style={{fontSize:11,color:T.t4,textAlign:"center",padding:"16px 0"}}>No groups found.</div>}
            {mergeResults.map((g:any,i:number) => {
              const gpy=g.pyQ?.["1"]||0; const gcy=g.cyQ?.["1"]||0; const ggap=gpy-gcy;
              const topDealer = (g.children||[]).reduce((acc:any,c:any) => {
                const d=c.dealer||"All Other"; acc[d]=(acc[d]||0)+1; return acc;
              }, {} as Record<string,number>);
              const dealerStr = Object.entries(topDealer).sort((a:any,b:any)=>b[1]-a[1]).slice(0,2).map(([d,n])=>`${d} ${n}`).join(", ");
              const childNames = (g.children||[]).slice(0,2).map((c:any) => c.name).filter(Boolean);
              const cityStr = g.children?.[0]?.city && g.children?.[0]?.st ? `${g.children[0].city}, ${g.children[0].st}` : "";
              return <button key={g.id} onClick={()=>setMergeTarget(g)}
                style={{width:"100%",textAlign:"left",background:T.s2,border:`1px solid ${T.b2}`,borderRadius:12,padding:"12px 14px",marginBottom:7,cursor:"pointer",fontFamily:"inherit"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:700,color:T.t1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{fixGroupName(g)}</div>
                    <div style={{fontSize:10,color:T.t3,marginTop:2}}>{g.locs||1} loc{(g.locs||1)!==1?"s":""}{cityStr?` · ${cityStr}`:""}{dealerStr?` · ${dealerStr}`:""}</div>
                    {childNames.length>0&&<div style={{fontSize:9,color:T.t4,marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      Offices: {childNames.join(", ")}{(g.children||[]).length>2?` +${(g.children||[]).length-2} more`:""}
                    </div>}
                  </div>
                  <div style={{textAlign:"right",flexShrink:0,marginLeft:10}}>
                    <div className="m" style={{fontSize:11,fontWeight:700,color:ggap>0?T.red:ggap<0?T.green:T.t4}}>{ggap>0?`-${$$(ggap)}`:ggap<0?`+${$$(-ggap)}`:"Even"}</div>
                  </div>
                </div>
                <div style={{display:"flex",gap:10}}>
                  <Pill l="PY" v={$$(gpy)} c={T.t2}/><Pill l="CY" v={$$(gcy)} c={T.blue}/>
                </div>
              </button>;
            })}
          </div>
        </> : <>
          {/* ── CONFIRM STEP ── */}
          {(()=>{
            const tpy=mergeTarget.pyQ?.["1"]||0; const tcy=mergeTarget.cyQ?.["1"]||0;
            const combinedLocs = (group.locs||1) + (mergeTarget.locs||1);
            const combinedPY = py + tpy;
            const combinedCY = cy + tcy;
            const combinedGap = combinedPY - combinedCY;
            const isLarge = combinedLocs > 30;
            return <>
              <div style={{fontSize:14,fontWeight:700,marginBottom:12}}>Confirm Merge</div>
              {/* Current group */}
              <div style={{background:T.s2,border:`1px solid rgba(34,211,238,.2)`,borderLeft:`3px solid ${T.cyan}`,borderRadius:10,padding:"10px 14px",marginBottom:8}}>
                <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",color:T.cyan,letterSpacing:"1px",marginBottom:4}}>Destination (this group)</div>
                <div style={{fontSize:13,fontWeight:700,color:T.t1}}>{fixGroupName(group)}</div>
                <div style={{fontSize:10,color:T.t3,marginTop:2}}>{group.locs} loc{group.locs!==1?"s":""} · PY {$$(py)} · CY {$$(cy)}</div>
              </div>
              <div style={{textAlign:"center",fontSize:12,color:T.purple,fontWeight:700,margin:"4px 0"}}>⊕ absorbs</div>
              {/* Target group */}
              <div style={{background:T.s2,border:`1px solid rgba(167,139,250,.2)`,borderLeft:`3px solid ${T.purple}`,borderRadius:10,padding:"10px 14px",marginBottom:12}}>
                <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",color:T.purple,letterSpacing:"1px",marginBottom:4}}>Will be merged in</div>
                <div style={{fontSize:13,fontWeight:700,color:T.t1}}>{fixGroupName(mergeTarget)}</div>
                <div style={{fontSize:10,color:T.t3,marginTop:2}}>{mergeTarget.locs||1} loc{(mergeTarget.locs||1)!==1?"s":""} · PY {$$(tpy)} · CY {$$(tcy)}</div>
                {(mergeTarget.children||[]).length>0&&<div style={{fontSize:9,color:T.t4,marginTop:3}}>
                  Offices: {(mergeTarget.children||[]).slice(0,3).map((c:any)=>c.name).join(", ")}{(mergeTarget.children||[]).length>3?` +${(mergeTarget.children||[]).length-3} more`:""}
                </div>}
              </div>
              {/* Combined result */}
              <div style={{background:"rgba(79,142,247,.06)",border:"1px solid rgba(79,142,247,.15)",borderRadius:10,padding:"10px 14px",marginBottom:12}}>
                <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",color:T.blue,letterSpacing:"1px",marginBottom:4}}>Combined Result</div>
                <div style={{display:"flex",gap:14,alignItems:"center"}}>
                  <span style={{fontSize:12,fontWeight:700,color:T.t1}}>{combinedLocs} locations</span>
                  <Pill l="PY" v={$$(combinedPY)} c={T.t2}/><Pill l="CY" v={$$(combinedCY)} c={T.blue}/>
                  <span className="m" style={{fontSize:10,fontWeight:700,color:combinedGap>0?T.red:T.green}}>{combinedGap>0?`-${$$(combinedGap)}`:`+${$$(Math.abs(combinedGap))}`}</span>
                </div>
              </div>
              {isLarge&&<div style={{background:"rgba(251,191,36,.08)",border:"1px solid rgba(251,191,36,.2)",borderRadius:8,padding:"8px 12px",marginBottom:12,fontSize:11,color:T.amber,fontWeight:600}}>
                ⚠ This creates a large group ({combinedLocs} locations). Make sure these practices are actually related.
              </div>}
              <div style={{display:"flex",gap:10}}>
                <button onClick={()=>setMergeTarget(null)} style={{flex:1,padding:"11px 0",borderRadius:10,fontSize:13,fontWeight:600,cursor:"pointer",border:`1px solid ${T.b1}`,background:T.s2,color:T.t3,fontFamily:"inherit"}}>Back</button>
                <button onClick={()=>executeMerge(mergeTarget)} disabled={mergeSaving}
                  style={{flex:2,padding:"11px 0",borderRadius:10,fontSize:13,fontWeight:700,cursor:mergeSaving?"not-allowed":"pointer",border:"none",
                    background:mergeSaving?"rgba(167,139,250,.3)":`linear-gradient(90deg,${T.purple},${T.blue})`,color:"#fff",fontFamily:"inherit"}}>
                  {mergeSaving?"Saving…":"Absorb Group"}
                </button>
              </div>
            </>;
          })()}
        </>}
      </div>
    </div>}
  </div>;
}


export default GroupDetail;
