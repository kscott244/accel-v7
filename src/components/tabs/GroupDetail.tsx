"use client";
// @ts-nocheck
import { useState, useMemo } from "react";
import { T } from "@/lib/tokens";
import { $$, $f, pc } from "@/lib/format";
import { getTierLabel } from "@/lib/tier";
import { BADGER, OVERLAYS_REF } from "@/lib/data";
import { Back, Chev, Pill, Stat, Bar, AccountId, fixGroupName } from "@/components/primitives";

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

function GroupDetail({group,groups=[],goMain,goAcct,overlays,saveOverlays,salesStore=null}) {
  const [q,setQ]=useState("1");
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
  const [groupContacts, setGroupContacts] = useState<any[]>(()=>{
    // Load from overlays (durable) or localStorage fallback
    const fromOverlay = overlays?.groupContacts?.[group.id];
    if (fromOverlay?.length) return fromOverlay;
    try { return JSON.parse(localStorage.getItem(`grpContacts:${group.id}`)||"[]"); } catch { return []; }
  });
  const [showContactForm, setShowContactForm] = useState(false);
  const [editContact, setEditContact] = useState<any>(null);
  const [cName, setCName] = useState("");
  const [cRole, setCRole] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [cNotes, setCNotes] = useState("");

  const openContactForm = (c?:any) => {
    setEditContact(c||null);
    setCName(c?.name||""); setCRole(c?.role||""); setCPhone(c?.phone||"");
    setCEmail(c?.email||""); setCNotes(c?.notes||"");
    setShowContactForm(true);
  };
  const saveContact = () => {
    if (!cName.trim()) return;
    const entry = { id: editContact?.id||Date.now(), name:cName.trim(), role:cRole.trim(), phone:cPhone.trim(), email:cEmail.trim(), notes:cNotes.trim(), savedAt:new Date().toISOString() };
    const updated = editContact
      ? groupContacts.map(c => c.id===editContact.id ? entry : c)
      : [...groupContacts, entry];
    setGroupContacts(updated);
    try { localStorage.setItem(`grpContacts:${group.id}`, JSON.stringify(updated)); } catch {}
    if (saveOverlays) {
      const next = { ...OVERLAYS_REF, groupContacts: { ...(OVERLAYS_REF.groupContacts||{}), [group.id]: updated } };
      saveOverlays(next);
    }
    setShowContactForm(false);
  };
  const deleteContact = (id:number) => {
    const updated = groupContacts.filter(c => c.id !== id);
    setGroupContacts(updated);
    try { localStorage.setItem(`grpContacts:${group.id}`, JSON.stringify(updated)); } catch {}
    if (saveOverlays) {
      const next = { ...OVERLAYS_REF, groupContacts: { ...(OVERLAYS_REF.groupContacts||{}), [group.id]: updated } };
      saveOverlays(next);
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
    if (saveOverlays) {
      const next = { ...OVERLAYS_REF, groupNotes: { ...(OVERLAYS_REF.groupNotes||{}), [group.id]: val } };
      saveOverlays(next);
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
    const topStop = groupStopped.filter((p:any)=>p.py>=500)[0];
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
    const topGrowing = groupBuying.filter((p:any)=>p.py>200&&p.cy/p.py>1.15).sort((a:any,b:any)=>(b.cy/b.py)-(a.cy/a.py))[0];
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
    const topAtRisk = groupBuying.filter((p:any)=>p.py>500&&p.cy/p.py<0.6&&p.cy>0).sort((a:any,b:any)=>(b.py-b.cy)-(a.py-a.cy))[0];
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
  },[sortedChildren, groupStopped, groupBuying, group, qk]);


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
        }),
      });
      const data = await res.json();
      const intel = data.intel || {};
      if (data.error && !intel.statusNote && !intel.status && !(intel.contacts?.length)) {
        setResResult({ status: data.error || "No intel found. The practice may not have a web presence.", ownership: "", website: "", contacts: [], hooks: [], talkingPoints: [] });
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
    const entry = {
      id: Date.now() + idx,
      name: c.name,
      role: c.role || "",
      phone: c.phone || "",
      email: c.email || "",
      notes: "From AI research",
      savedAt: new Date().toISOString(),
    };
    const updated = [...groupContacts, entry];
    setGroupContacts(updated);
    try { localStorage.setItem("grpContacts:" + group.id, JSON.stringify(updated)); } catch {}
    if (saveOverlays) {
      const next = { ...OVERLAYS_REF, groupContacts: { ...(OVERLAYS_REF.groupContacts||{}), [group.id]: updated } };
      saveOverlays(next);
    }
    setSavedResContacts(prev => new Set([...prev, idx]));
  };

  const saveResNotes = () => {
    if (!resResult) return;
    const pts = (resResult.talkingPoints||[]).map((p:string,i:number) => `${i+1}. ${p}`).join("\n");
    const hooks = (resResult.hooks||[]).map((h:string) => `· ${h}`).join("\n");
    const comp = resResult.competitive ? `\nCompetitive: ${resResult.competitive}` : "";
    const lines = ["[AI Call Prep]", pts, hooks ? "\nAlso:\n"+hooks : "", comp].filter(Boolean).join("\n");
    const newNote = groupNote ? groupNote + "\n\n" + lines : lines;
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
    if (saveOverlays) {
      const next = { ...OVERLAYS_REF, groupContacts: { ...(OVERLAYS_REF.groupContacts||{}), [group.id]: updated } };
      saveOverlays(next);
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
    const topAtRisk = groupBuying.filter((p:any)=>p.py>500&&p.cy/p.py<0.6&&p.cy>0).sort((a:any,b:any)=>(b.py-b.cy)-(a.py-a.cy))[0];
    if (topChildGap > 1000 && numLocs > 1) {
      const shortName = topChild.name?.split(" ").slice(0,3).join(" ") || "top location";
      lines.push({ text: `Biggest drag is ${shortName}, which is down ${$$(topChildGap)} vs PY.`, color: T.red });
    } else if (topAtRisk) {
      const pShort = topAtRisk.name.split(" ").slice(0,3).join(" ");
      const pct = Math.round(topAtRisk.cy/topAtRisk.py*100);
      lines.push({ text: `${pShort} is at risk — only ${pct}% of PY with a ${$$(topAtRisk.py-topAtRisk.cy)} gap.`, color: T.amber });
    }

    // 3. Biggest opportunity: win-back or expansion
    const topStop = groupStopped.filter((p:any)=>p.py>=500)[0];
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
    const topGrowing = groupBuying.filter((p:any)=>p.py>200&&p.cy/p.py>1.15).sort((a:any,b:any)=>(b.cy/b.py)-(a.cy/a.py))[0];
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
  },[group, cy, py, ret, qk, sortedChildren, groupStopped, groupBuying, nextBestMoves]);


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
    // Storing a group ID causes applyOverlays Step 4d to re-expand a group that may
    // have already been consumed by an earlier overlay iteration, producing empty
    // children or duplicated leaves when the same leaf appears in multiple groups.
    //
    // Resolution order:
    // 1. Current group: start from existing overlay childIds if present, else rendered children.
    // 2. Target: expand to leaf IDs via its overlay childIds, rendered children, or target.id.
    const existingEntry = OVERLAYS_REF.groups?.[group.id];
    const currentChildIds: string[] = existingEntry?.childIds
      ? [...existingEntry.childIds]
      : (group.children||[]).map((c:any) => c.id);

    // Resolve target to leaf-level IDs — never store a bare group ID in childIds
    const targetOverlay = OVERLAYS_REF.groups?.[target.id];
    const targetLeafIds: string[] =
      targetOverlay?.childIds?.length
        ? targetOverlay.childIds
        : (target.children||[]).length > 0
          ? (target.children||[]).map((c:any) => c.id)
          : [target.id];

    // Merge: add target leaf IDs not already present
    const merged = [...currentChildIds];
    targetLeafIds.forEach((id:string) => {
      if (!merged.includes(id)) merged.push(id);
    });

    const groupEntry = {
      id: group.id,
      name: fixGroupName(group),
      tier: group.tier || "Standard",
      class2: group.class2 || "Private Practice",
      childIds: merged,
      source: "manual-merge",
      createdAt: existingEntry?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const next = { ...OVERLAYS_REF, groups: { ...(OVERLAYS_REF.groups||{}), [group.id]: groupEntry } };
    saveOverlays(next).then((ok:boolean) => {
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
    <div style={{position:"sticky",top:52,zIndex:40,background:"rgba(10,10,15,.9)",backdropFilter:"blur(20px)",borderBottom:`1px solid ${T.b3}`,padding:"10px 16px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",width:"100%"}}>
        <button onClick={goMain} style={{background:"none",border:"none",color:T.blue,cursor:"pointer",display:"flex",alignItems:"center",gap:4,fontSize:13,fontWeight:600,fontFamily:"inherit"}}><Back/> Groups</button>
        <button onClick={runGroupResearch} disabled={resLoading}
          style={{background:"rgba(34,211,238,.08)",border:"1px solid rgba(34,211,238,.2)",borderRadius:8,padding:"4px 12px",fontSize:10,fontWeight:700,color:resLoading?"rgba(34,211,238,.5)":T.cyan,cursor:resLoading?"not-allowed":"pointer",fontFamily:"inherit",letterSpacing:".3px"}}>
          {resLoading ? "Searching..." : (resResult ? "Re-research" : "Research")}
        </button>
      </div>
    </div>
    <div style={{padding:"16px 16px 0"}}>
      <div className="anim" style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:16,padding:16,marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:16,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{fixGroupName(group)}</div>
            <div style={{fontSize:11,color:T.t3,marginTop:2}}>{group.locs} location{group.locs!==1?"s":""} · {getTierLabel(group.tier,group.class2)}</div>
          </div>
          <div style={{display:"flex",gap:6,flexShrink:0,marginLeft:8,alignItems:"center"}}>
            <span style={{fontSize:10,fontWeight:700,color:healthColor,background:`${healthColor}14`,border:`1px solid ${healthColor}30`,borderRadius:6,padding:"3px 9px"}}>{healthLabel}</span>
            <button onClick={()=>{setShowMerge(true);setMergeSearch("");setMergeTarget(null);}} style={{fontSize:9,fontWeight:700,color:T.purple,background:"rgba(167,139,250,.08)",border:"1px solid rgba(167,139,250,.18)",borderRadius:6,padding:"3px 9px",cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>⊕ Merge</button>
          </div>
        </div>
        {mergeToast&&<div style={{marginBottom:8,padding:"8px 12px",borderRadius:8,fontSize:11,fontWeight:600,color:mergeToast.startsWith("✅")?T.green:T.red,background:mergeToast.startsWith("✅")?"rgba(52,211,153,.08)":"rgba(248,113,113,.08)",border:`1px solid ${mergeToast.startsWith("✅")?"rgba(52,211,153,.2)":"rgba(248,113,113,.2)"}`}}>{mergeToast}</div>}
        {/* Retention bar */}
        <div style={{margin:"10px 0 12px"}}>
          <Bar pct={Math.min(ret,100)} color={`linear-gradient(90deg,${healthColor},${healthColor}99)`}/>
        </div>
        {/* Quarter selector */}
        <div style={{display:"flex",gap:4,marginBottom:12}}>
          {["1","2","3","4","FY"].map(qr=>(
            <button key={qr} onClick={()=>setQ(qr)} style={{flex:1,padding:"6px 0",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",border:`1px solid ${q===qr?"rgba(79,142,247,.25)":T.b2}`,background:q===qr?"rgba(79,142,247,.12)":T.s2,color:q===qr?T.blue:T.t3,fontFamily:"inherit"}}>{qr==="FY"?"FY":`Q${qr}`}</button>
          ))}
        </div>
        <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.t4,marginBottom:4}}>Group Total</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8}}>
          <Stat l="PY" v={$$(py)} c={T.t2}/><Stat l="CY" v={$$(cy)} c={T.blue}/><Stat l="Gap" v={gap<=0?`+${$$(Math.abs(gap))}`:$$(gap)} c={gap<=0?T.green:T.red}/><Stat l="Ret" v={ret+"%"} c={healthColor}/>
        </div>
        {/* ACCOUNT BRIEF toggle */}
        {briefLines.length>0&&<div style={{marginTop:12,borderTop:`1px solid ${T.b2}`,paddingTop:10}}>
          <button onClick={()=>setBriefOpen(v=>!v)} style={{background:"none",border:"none",padding:0,cursor:"pointer",display:"flex",alignItems:"center",gap:6,fontFamily:"inherit",width:"100%",textAlign:"left"}}>
            <span style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.cyan}}>Account Brief</span>
            <span style={{fontSize:10,color:T.t4,marginLeft:"auto",transition:"transform .2s",display:"inline-block",transform:briefOpen?"rotate(90deg)":"rotate(0deg)"}}>›</span>
          </button>
          {briefOpen&&<div style={{marginTop:8,display:"flex",flexDirection:"column",gap:6}}>
            {briefLines.map((line,i)=>(
              <div key={i} style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                <span style={{width:5,height:5,borderRadius:"50%",background:line.color,flexShrink:0,marginTop:5}}/>
                <span style={{fontSize:11,color:T.t2,lineHeight:1.5}}>{line.text}</span>
              </div>
            ))}
          </div>}
        </div>}
      </div>


      {/* GROUP AI INTEL (A16.1) */}
      {(resLoading || (resResult && !resDismissed)) && <div className="anim" style={{background:T.s1,border:"1px solid rgba(34,211,238,.2)",borderRadius:16,padding:16,marginBottom:16}}>
        {/* Header row */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.cyan}}>Group Intel</div>
            {resResult&&resResult.statusPill&&!resLoading&&(()=>{const sp=STATUS_PILL[resResult.statusPill]||STATUS_PILL.unknown;return<span style={{fontSize:9,fontWeight:700,color:sp.color,background:sp.color+"20",borderRadius:4,padding:"2px 7px"}}>{sp.label}</span>;})()}
          </div>
          {!resLoading&&<button onClick={()=>setResDismissed(true)} style={{background:"none",border:"none",color:T.t4,cursor:"pointer",fontSize:16,lineHeight:1,padding:"0 4px",fontFamily:"inherit"}}>x</button>}
        </div>
        {/* Loading skeleton */}
        {resLoading && <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {[80,60,90].map((w,i)=>(
            <div key={i} style={{height:12,borderRadius:6,background:T.s3,width:w+"%",opacity:.6}}/>
          ))}
        </div>}
        {resResult && !resLoading && <>
          {/* Status note */}
          {resResult.status&&<div style={{fontSize:12,color:T.t2,lineHeight:1.5,marginBottom:8}}>{resResult.status}</div>}
          {/* Ownership note */}
          {resResult.ownership&&<div style={{fontSize:11,color:T.t3,marginBottom:8,fontStyle:"italic"}}>{resResult.ownership}</div>}
          {/* Competitive intel — high-value signal */}
          {resResult.competitive&&<div style={{padding:"7px 10px",background:"rgba(251,191,36,.06)",border:"1px solid rgba(251,191,36,.15)",borderRadius:8,marginBottom:10}}>
            <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",color:T.amber,letterSpacing:"1px",marginBottom:3}}>Competitive Signal</div>
            <div style={{fontSize:11,color:T.t2,lineHeight:1.5}}>{resResult.competitive}</div>
          </div>}
          {/* Website */}
          {resResult.website&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,padding:"8px 10px",background:T.s2,borderRadius:8}}>
            <span style={{fontSize:11,color:T.blue,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{resResult.website}</span>
            <button onClick={saveResWebsite} disabled={resWebsiteSaved}
              style={{background:resWebsiteSaved?"rgba(52,211,153,.1)":"rgba(79,142,247,.1)",border:"1px solid "+(resWebsiteSaved?"rgba(52,211,153,.2)":"rgba(79,142,247,.2)"),borderRadius:6,padding:"2px 8px",fontSize:9,fontWeight:700,color:resWebsiteSaved?T.green:T.blue,cursor:resWebsiteSaved?"default":"pointer",fontFamily:"inherit",flexShrink:0,marginLeft:8}}>
              {resWebsiteSaved ? "Saved" : "Save"}
            </button>
          </div>}
          {/* Contacts — with inline call/email actions */}
          {(resResult.contacts||[]).length>0&&<div style={{marginBottom:10}}>
            <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",color:T.t4,letterSpacing:"1px",marginBottom:6}}>Contacts Found</div>
            {(resResult.contacts||[]).map((c:any,i:number)=>{
              const sl = SCOPE_LABELS[(c.scope||1)-1] || SCOPE_LABELS[0];
              const sc = T[SCOPE_COLORS_KEYS[(c.scope||1)-1]] || T.t4;
              const isSaved = savedResContacts.has(i);
              const isTopContact = (c.scope||1) === 1;
              return <div key={i} style={{padding:"9px 10px",background:isTopContact?"rgba(34,211,238,.04)":T.s2,borderRadius:8,marginBottom:6,border:isTopContact?"1px solid rgba(34,211,238,.15)":"1px solid transparent"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:1}}>
                      <div style={{fontSize:12,fontWeight:700,color:T.t1}}>{c.name||"Unknown"}</div>
                      <span style={{fontSize:9,fontWeight:700,color:sc,background:sc+"18",borderRadius:4,padding:"1px 5px",flexShrink:0}}>{sl}</span>
                    </div>
                    {c.role&&<div style={{fontSize:10,color:T.t3,marginBottom:3}}>{c.role}</div>}
                    <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                      {c.phone&&<a href={`tel:${c.phone.replace(/\D/g,"")}`} style={{fontSize:10,color:T.cyan,textDecoration:"none",display:"flex",alignItems:"center",gap:3}}>📞 {c.phone}</a>}
                      {c.email&&<a href={`mailto:${c.email}`} style={{fontSize:10,color:T.blue,textDecoration:"none",display:"flex",alignItems:"center",gap:3}}>✉ {c.email}</a>}
                    </div>
                  </div>
                  <button onClick={()=>saveResContact(c,i)} disabled={isSaved}
                    style={{background:isSaved?"rgba(52,211,153,.1)":"rgba(79,142,247,.1)",border:"1px solid "+(isSaved?"rgba(52,211,153,.2)":"rgba(79,142,247,.2)"),borderRadius:6,padding:"3px 9px",fontSize:10,fontWeight:700,color:isSaved?T.green:T.blue,cursor:isSaved?"default":"pointer",fontFamily:"inherit",flexShrink:0,marginLeft:8}}>
                    {isSaved ? "Saved" : "+ Save"}
                  </button>
                </div>
              </div>;
            })}
          </div>}
          {/* Call Prep — merged hooks + talking points into single prioritized list */}
          {((resResult.talkingPoints||[]).length>0||(resResult.hooks||[]).length>0)&&<div style={{marginBottom:4}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",color:T.t4,letterSpacing:"1px"}}>Call Prep</div>
              <button onClick={saveResNotes} style={{background:"rgba(251,191,36,.08)",border:"1px solid rgba(251,191,36,.2)",borderRadius:5,padding:"1px 7px",fontSize:9,fontWeight:700,color:T.amber,cursor:"pointer",fontFamily:"inherit"}}>+ Add to Notes</button>
            </div>
            {/* Talking points first — these are the highest-value callPrep items */}
            {(resResult.talkingPoints||[]).map((tp:string,i:number)=>(
              <div key={"tp-"+i} style={{fontSize:11,color:T.t1,lineHeight:1.5,display:"flex",gap:8,alignItems:"flex-start",marginBottom:6,padding:"7px 10px",background:T.s2,borderRadius:8}}>
                <span style={{color:T.cyan,flexShrink:0,fontWeight:700,fontSize:10,marginTop:1}}>{i+1}</span>
                <span>{tp}</span>
              </div>
            ))}
            {/* Hooks after — softer signals */}
            {(resResult.hooks||[]).length>0&&<>
              {(resResult.talkingPoints||[]).length>0&&<div style={{fontSize:9,color:T.t4,textTransform:"uppercase",letterSpacing:"1px",marginTop:8,marginBottom:4}}>Also worth mentioning</div>}
              {(resResult.hooks||[]).map((h:string,i:number)=>(
                <div key={"h-"+i} style={{fontSize:11,color:T.t3,lineHeight:1.5,display:"flex",gap:6,alignItems:"flex-start",marginBottom:4}}>
                  <span style={{color:T.t4,flexShrink:0}}>·</span><span>{h}</span>
                </div>
              ))}
            </>}
          </div>}
        </>}
      </div>}

            {/* SUGGESTED MERGES FROM RESEARCH */}
      {(mergeMatchLoading || suggestedMerges.filter(m=>!dismissedSuggestions.has(m.id)).length > 0) && <div className="anim" style={{background:T.s1,border:`1px solid rgba(167,139,250,.25)`,borderRadius:16,padding:16,marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.purple}}>🔗 Suggested Merges</div>
          {mergeMatchLoading && <div style={{fontSize:10,color:T.t4}}>Scanning...</div>}
        </div>
        {mergeMatchLoading && <div style={{height:10,borderRadius:5,background:T.s3,width:"60%",opacity:.5}}/>}
        {suggestedMerges.filter(m=>!dismissedSuggestions.has(m.id)).map((m:any)=>{
          const matchedGroup = groups.find((g:any)=>g.id===m.id);
          const mName = matchedGroup ? fixGroupName(matchedGroup) : m.id;
          const mLocs = matchedGroup?.locs || matchedGroup?.children?.length || 1;
          const mPY = matchedGroup ? Object.values(matchedGroup.pyQ||{}).reduce((s:any,v:any)=>s+v,0) : 0;
          return <div key={m.id} style={{padding:"10px 12px",background:T.s2,borderRadius:10,marginBottom:8,border:`1px solid ${T.purple}20`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:700,color:T.t1}}>{mName}</div>
                <div style={{fontSize:10,color:T.t3,marginTop:1}}>{mLocs} loc{mLocs!==1?"s":""} · PY ${(mPY/1000).toFixed(1)}k</div>
                <div style={{fontSize:10,color:T.purple,marginTop:3,fontStyle:"italic"}}>{m.reason}</div>
              </div>
            </div>
            <div style={{display:"flex",gap:6,marginTop:8}}>
              <button onClick={async ()=>{
                if (!saveOverlays) return;
                const canonicalId = group.id;
                const existingChildIds = (group.childIds||[group.id,...(group.children||[]).map((c:any)=>c.id)]);
                const newChildIds = [...new Set([...existingChildIds, m.id])];
                const next = {
                  ...OVERLAYS_REF,
                  groups: {
                    ...OVERLAYS_REF.groups,
                    [canonicalId]: {
                      ...(OVERLAYS_REF.groups?.[canonicalId]||{}),
                      id: canonicalId,
                      name: fixGroupName(group),
                      tier: group.tier||"Standard",
                      class2: group.class2||"Private Practice",
                      childIds: newChildIds,
                      source: "manual-merge",
                      updatedAt: new Date().toISOString(),
                    }
                  }
                };
                await saveOverlays(next);
                setSuggestedMerges(prev=>prev.filter(s=>s.id!==m.id));
              }} style={{flex:1,padding:"7px 0",borderRadius:8,background:`${T.purple}18`,border:`1px solid ${T.purple}40`,color:T.purple,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                + Merge
              </button>
              <button onClick={()=>setDismissedSuggestions(prev=>new Set([...prev,m.id]))}
                style={{padding:"7px 14px",borderRadius:8,background:T.s1,border:`1px solid ${T.b2}`,color:T.t4,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>
                Skip
              </button>
            </div>
          </div>;
        })}
      </div>}

      {/* NEXT BEST MOVES */}
      {nextBestMoves.length>0&&<div className="anim" style={{animationDelay:"12ms",background:T.s1,border:`1px solid rgba(79,142,247,.15)`,borderRadius:16,padding:16,marginBottom:16}}>
        <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.blue,marginBottom:12}}>Next Best Move</div>
        <div style={{display:"flex",flexDirection:"column",gap:7}}>
          {nextBestMoves.map((m,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,background:T.s2,borderRadius:10,padding:"10px 12px",border:`1px solid ${m.color}18`}}>
              <div style={{width:20,height:20,borderRadius:"50%",background:`${m.color}18`,border:`1px solid ${m.color}40`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <span style={{fontSize:9,fontWeight:700,color:m.color}}>{i+1}</span>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:11,fontWeight:700,color:T.t1,lineHeight:1.3}}>{m.action}</div>
                <div style={{fontSize:10,color:T.t3,marginTop:2,lineHeight:1.3}}>{m.why}</div>
              </div>
              <div style={{width:3,height:32,borderRadius:2,background:m.color,flexShrink:0,opacity:.7}}/>
            </div>
          ))}
        </div>
      </div>}

      {/* DISTRIBUTOR SPLIT */}
      {distBreakdown.rows.length>0&&<div className="anim" style={{animationDelay:"15ms",background:T.s1,border:`1px solid ${T.b1}`,borderRadius:16,padding:16,marginBottom:16}}>
        <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.orange,marginBottom:12}}>Distributor Split</div>
        {distBreakdown.rows.map((row,i)=>{
          const DIST_COLOR: Record<string,string> = {
            Schein:"#4f8ef7",Patterson:"#a78bfa",Benco:"#22d3ee",Darby:"#fbbf24","DDS Dental":"#f97316","Dental City":"#10b981","All Other":"#7878a0"
          };
          const c = DIST_COLOR[row.dist] || "#7878a0";
          const shareDelta = row.cyPct - row.pyPct; // gaining or losing share vs PY
          const trend = row.py > 0 ? row.cy/row.py : null;
          return <div key={row.dist} style={{marginBottom:i<distBreakdown.rows.length-1?12:0}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontSize:11,fontWeight:700,color:c,background:`${c}18`,borderRadius:5,padding:"2px 8px"}}>{row.dist}</span>
                <span style={{fontSize:9,color:T.t4}}>{row.locs} loc{row.locs!==1?"s":""}</span>
                {shareDelta > 0.03 && <span style={{fontSize:9,color:T.green,fontWeight:600}}>▲ gaining share</span>}
                {shareDelta < -0.03 && <span style={{fontSize:9,color:T.red,fontWeight:600}}>▼ losing share</span>}
              </div>
              <div style={{textAlign:"right"}}>
                <span className="m" style={{fontSize:13,fontWeight:700,color:T.t1}}>{$$(row.cy)}</span>
                <span style={{fontSize:9,color:T.t4,marginLeft:5}}>{Math.round(row.cyPct*100)}%</span>
                {trend!==null&&<span style={{fontSize:9,color:trend>=0.9?T.green:trend>=0.7?T.amber:T.red,marginLeft:6,fontWeight:600}}>{Math.round(trend*100)}%</span>}
              </div>
            </div>
            {/* CY share bar */}
            <div style={{height:6,borderRadius:3,background:T.s3,overflow:"hidden",marginBottom:2}}>
              <div className="bar-g" style={{animationDelay:`${i*60}ms`,height:"100%",borderRadius:3,width:`${row.cyPct*100}%`,background:`linear-gradient(90deg,${c},${c}99)`}}/>
            </div>
            {/* PY ghost bar for comparison */}
            <div style={{display:"flex",alignItems:"center",gap:4}}>
              <div style={{flex:1,height:3,borderRadius:2,background:T.s3,overflow:"hidden"}}>
                <div style={{height:"100%",borderRadius:2,width:`${row.pyPct*100}%`,background:`${c}40`}}/>
              </div>
              <span style={{fontSize:8,color:T.t4,flexShrink:0}}>{$$(row.py)} PY</span>
            </div>
          </div>;
        })}
      </div>}

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
            {/* Quick-pick from Schein CT roster */}
            <div style={{marginBottom:12}}>
              <div style={{fontSize:10,color:T.t3,marginBottom:6,fontWeight:600}}>Pick from Schein Roster (CT + NE)</div>
              <input value={rosterSearch} onChange={e=>setRosterSearch(e.target.value)}
                placeholder="Search FSC or ES by name"
                style={{width:"100%",background:T.s2,border:"1px solid "+T.b1,borderRadius:8,padding:"7px 10px",fontSize:12,color:T.t1,fontFamily:"inherit",marginBottom:6}}/>
              {rosterSearch.trim().length > 0 && <div style={{maxHeight:160,overflowY:"auto",borderRadius:8,border:"1px solid "+T.b1,background:T.s2}}>
                {filteredRoster.length === 0 && <div style={{padding:"10px",fontSize:11,color:T.t4}}>No matches</div>}
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

      {/* GROUP CONTACTS */}
      <div className="anim" style={{animationDelay:"30ms",background:T.s1,border:`1px solid ${T.b1}`,borderRadius:16,padding:16,marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:groupContacts.length>0?12:0}}>
          <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.purple}}>Group Contacts</div>
          <button onClick={()=>openContactForm()} style={{background:"rgba(167,139,250,.1)",border:"1px solid rgba(167,139,250,.2)",borderRadius:7,padding:"3px 10px",fontSize:10,fontWeight:700,color:T.purple,cursor:"pointer",fontFamily:"inherit"}}>+ Add</button>
        </div>
        {groupContacts.length===0&&<div style={{fontSize:11,color:T.t4,paddingTop:8}}>No contacts yet. Add distributor reps, DSO contacts, or anyone relevant to this group.</div>}
        {groupContacts.map((c:any,i:number)=>(
          <div key={c.id} style={{borderTop:i>0?`1px solid ${T.b2}`:"none",paddingTop:i>0?10:0,marginTop:i>0?10:0}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:700,color:T.t1}}>{c.name}</div>
                {c.role&&<div style={{fontSize:10,color:T.purple,marginTop:1}}>{c.role}</div>}
                <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:4}}>
                  {c.phone&&<a href={`tel:${c.phone.replace(/\D/g,"")}`} style={{fontSize:11,color:T.cyan,textDecoration:"none"}}>{c.phone}</a>}
                  {c.email&&<a href={`mailto:${c.email}`} style={{fontSize:11,color:T.blue,textDecoration:"none"}}>{c.email}</a>}
                </div>
                {c.notes&&<div style={{fontSize:10,color:T.t3,marginTop:4,fontStyle:"italic",lineHeight:1.4}}>{c.notes}</div>}
              </div>
              <div style={{display:"flex",gap:6,flexShrink:0,marginLeft:10}}>
                {c.phone&&<a href={`tel:${c.phone.replace(/\D/g,"")}`} style={{background:"rgba(34,211,153,.1)",border:"1px solid rgba(34,211,153,.2)",borderRadius:6,padding:"3px 8px",fontSize:10,fontWeight:600,color:T.green,textDecoration:"none"}}>Call</a>}
                <button onClick={()=>openContactForm(c)} style={{background:"rgba(79,142,247,.08)",border:"1px solid rgba(79,142,247,.15)",borderRadius:6,padding:"3px 8px",fontSize:10,fontWeight:600,color:T.blue,cursor:"pointer",fontFamily:"inherit"}}>Edit</button>
                <button onClick={()=>deleteContact(c.id)} style={{background:"none",border:"none",color:T.t4,cursor:"pointer",fontSize:12,padding:"2px 4px"}}>✕</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* GROUP NOTES */}
      <div className="anim" style={{animationDelay:"35ms",background:T.s1,border:`1px solid ${T.b1}`,borderRadius:16,padding:16,marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.amber}}>Group Notes</div>
          {noteSaved&&<span style={{fontSize:9,color:T.green}}>✓ Saved</span>}
        </div>
        <textarea
          value={groupNote}
          onChange={e=>setGroupNote(e.target.value)}
          onBlur={e=>saveNote(e.target.value)}
          placeholder={`Notes about ${fixGroupName(group)} as a whole — competitive intel, buying patterns, key relationships, anything that applies to all locations...`}
          rows={4}
          style={{width:"100%",background:T.s2,border:`1px solid ${T.b1}`,borderRadius:8,padding:"10px 12px",fontSize:12,color:T.t1,fontFamily:"inherit",resize:"none",lineHeight:1.5,outline:"none",boxSizing:"border-box"}}
        />
        <button onClick={()=>saveNote(groupNote)} style={{marginTop:8,background:"rgba(251,191,36,.1)",border:"1px solid rgba(251,191,36,.2)",borderRadius:8,padding:"6px 16px",fontSize:11,fontWeight:600,color:T.amber,cursor:"pointer",fontFamily:"inherit"}}>Save Note</button>
      </div>

      {/* ADD/EDIT CONTACT MODAL */}
      {showContactForm&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={e=>{if(e.target===e.currentTarget)setShowContactForm(false)}}>
        <div style={{background:T.s1,borderRadius:"20px 20px 0 0",padding:24,width:"100%",maxWidth:480,paddingBottom:40}}>
          <div style={{fontSize:13,fontWeight:700,marginBottom:16}}>{editContact?"Edit Contact":"Add Group Contact"}</div>
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
            <textarea value={cNotes} onChange={e=>setCNotes(e.target.value)} placeholder="Relationship context, how they can help, best time to reach..." rows={3} style={{width:"100%",background:T.s2,border:`1px solid ${T.b1}`,borderRadius:8,padding:"8px 10px",fontSize:12,color:T.t1,fontFamily:"inherit",resize:"none"}}/>
          </div>
          <div style={{display:"flex",gap:10}}>
            <button onClick={()=>setShowContactForm(false)} style={{flex:1,padding:"10px 0",borderRadius:10,fontSize:13,fontWeight:600,cursor:"pointer",border:`1px solid ${T.b1}`,background:T.s2,color:T.t3,fontFamily:"inherit"}}>Cancel</button>
            <button onClick={saveContact} disabled={!cName.trim()} style={{flex:2,padding:"10px 0",borderRadius:10,fontSize:13,fontWeight:700,cursor:cName.trim()?"pointer":"not-allowed",border:"none",background:cName.trim()?T.purple:"rgba(167,139,250,.3)",color:"#fff",fontFamily:"inherit"}}>Save Contact</button>
          </div>
        </div>
      </div>}


      {/* OPPORTUNITIES */}
      {opportunitySignals.length>0&&<div className="anim" style={{animationDelay:"38ms",background:T.s1,border:`1px solid ${T.b1}`,borderRadius:16,padding:16,marginBottom:16}}>
        <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.orange,marginBottom:12}}>Opportunities</div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {opportunitySignals.map((sig,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,background:T.s2,borderRadius:10,padding:"9px 12px",border:`1px solid ${sig.color}18`}}>
              <span style={{fontSize:14,width:20,textAlign:"center",flexShrink:0,color:sig.color}}>{sig.icon}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:11,fontWeight:700,color:T.t1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sig.label}</div>
                <div style={{fontSize:10,color:T.t3,marginTop:1}}>{sig.detail}</div>
              </div>
              <div style={{width:3,height:28,borderRadius:2,background:sig.color,flexShrink:0}}/>
            </div>
          ))}
        </div>
      </div>}

      {/* GROUP PRODUCT ROLLUP */}
      {hasProducts&&<div className="anim" style={{animationDelay:"40ms",background:T.s1,border:`1px solid ${T.b1}`,borderRadius:16,padding:16,marginBottom:16}}>
        <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.blue,marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span>Group Product Health</span>
          <span style={{fontSize:9,color:T.t4,fontWeight:400,textTransform:"none",letterSpacing:0}}>Tap row · monthly history</span>
        </div>

        {/* Stopped across group */}
        {groupStopped.length>0&&<div style={{marginBottom:groupBuying.length>0?14:0}}>
          <div style={{fontSize:10,fontWeight:700,color:T.red,marginBottom:8}}>Stopped Buying ({groupStopped.length} products)</div>
          {groupStopped.map((p,i)=>{
            const isExp = expandedProduct === p.name;
            const childIds2 = new Set((group.children||[]).map((c:any)=>c.id));
            const recs = salesStore?.records ? (Object.values(salesStore.records) as any[]).filter((r:any)=>childIds2.has(r.childId)&&r.l3===p.name) : [];
            // Build month rows newest-first: months 1-12, filter to rows with any data
            const MONTHS_SHORT2 = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
            const QMAP: Record<number,string> = {1:"Q1",2:"Q1",3:"Q1",4:"Q2",5:"Q2",6:"Q2",7:"Q3",8:"Q3",9:"Q3",10:"Q4",11:"Q4",12:"Q4"};
            const mb: Record<number,{py:number,cy:number}> = {};
            for(let m=1;m<=12;m++) mb[m]={py:0,cy:0};
            recs.forEach((r:any)=>{ const m=r.month||1; if(m>=1&&m<=12){mb[m].py+=r.py||0;mb[m].cy+=r.cy||0;} });
            const monthRows = [12,11,10,9,8,7,6,5,4,3,2,1].filter(m=>mb[m].py>0||mb[m].cy>0).map(m=>({m,label:MONTHS_SHORT2[m-1],q:QMAP[m],py:mb[m].py,cy:mb[m].cy}));
            return <div key={i} style={{marginBottom:10,borderRadius:8,background:"rgba(248,113,113,.04)",border:`1px solid ${isExp?"rgba(248,113,113,.25)":"rgba(248,113,113,.08)"}`,overflow:"hidden"}}>
              {/* Summary row — tap to toggle inline expansion */}
              <div onClick={()=>setExpandedProduct(isExp?null:p.name)} style={{padding:"8px 10px",cursor:"pointer"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:p.locsDown.length>0?4:0}}>
                  <span style={{fontSize:12,fontWeight:600,color:T.t1}}>{p.name}</span>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span className="m" style={{fontSize:10,color:T.red,flexShrink:0}}>Was {$$(p.py)} → $0</span>
                    {/* Details link → full-screen drill */}
                    <span onClick={e=>{e.stopPropagation();setSelProduct(p.name);}} style={{fontSize:9,color:T.t4,cursor:"pointer",textDecoration:"underline",flexShrink:0}}>Locs</span>
                    <span style={{fontSize:10,color:T.t3,transition:"transform .2s",display:"inline-block",transform:isExp?"rotate(90deg)":"rotate(0deg)"}}>›</span>
                  </div>
                </div>
                {p.locsDown.length>0&&<div style={{fontSize:9,color:T.t4,lineHeight:1.5}}>
                  {p.locsDown.slice(0,3).map(l=>l.split(" ").slice(0,2).join(" ")).join(" · ")}
                  {p.locsDown.length>3&&<span> +{p.locsDown.length-3} more</span>}
                </div>}
              </div>
              {/* Inline month table */}
              {isExp&&<div style={{borderTop:"1px solid rgba(248,113,113,.1)",background:"rgba(0,0,0,.2)",padding:"8px 10px"}}>
                {monthRows.length===0
                  ? <div style={{fontSize:10,color:T.t4,textAlign:"center",padding:"6px 0"}}>No monthly data — upload a CSV with sales data to populate</div>
                  : <>
                      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:4,marginBottom:4,paddingBottom:4,borderBottom:"1px solid rgba(255,255,255,.05)"}}>
                        {["Month","Q","PY","CY"].map(h=><span key={h} style={{fontSize:8,fontWeight:700,color:T.t4,textTransform:"uppercase",letterSpacing:"0.5px"}}>{h}</span>)}
                      </div>
                      {monthRows.map(({m,label,q,py,cy})=>(
                        <div key={m} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:4,padding:"3px 0",borderBottom:"1px solid rgba(255,255,255,.03)"}}>
                          <span style={{fontSize:10,color:T.t2}}>{label}</span>
                          <span style={{fontSize:9,color:T.t4}}>{q}</span>
                          <span className="m" style={{fontSize:10,color:T.t3,fontFamily:"monospace"}}>{$$(py)}</span>
                          <span className="m" style={{fontSize:10,color:cy>0?T.blue:T.red,fontFamily:"monospace",fontWeight:cy>0?400:600}}>{cy>0?$$(cy):"–"}</span>
                        </div>
                      ))}
                    </>
                }
              </div>}
            </div>;
          })}
        </div>}

        {/* Buying across group */}
        {groupBuying.length>0&&<div>
          <div style={{fontSize:10,fontWeight:700,color:T.green,marginBottom:8}}>Currently Buying ({groupBuying.length} products)</div>
          {groupBuying.slice(0,10).map((p,i)=>{
            const mx=groupBuying[0]?.cy||1;
            const trend=p.py>0?p.cy/p.py:1;
            const pGap=p.py-p.cy;
            const isExp2 = expandedProduct === p.name;
            const childIds3 = new Set((group.children||[]).map((c:any)=>c.id));
            const recs2 = salesStore?.records ? (Object.values(salesStore.records) as any[]).filter((r:any)=>childIds3.has(r.childId)&&r.l3===p.name) : [];
            const MONTHS_SHORT3 = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
            const QMAP2: Record<number,string> = {1:"Q1",2:"Q1",3:"Q1",4:"Q2",5:"Q2",6:"Q2",7:"Q3",8:"Q3",9:"Q3",10:"Q4",11:"Q4",12:"Q4"};
            const mb2: Record<number,{py:number,cy:number}> = {};
            for(let m=1;m<=12;m++) mb2[m]={py:0,cy:0};
            recs2.forEach((r:any)=>{ const m=r.month||1; if(m>=1&&m<=12){mb2[m].py+=r.py||0;mb2[m].cy+=r.cy||0;} });
            const monthRows2 = [12,11,10,9,8,7,6,5,4,3,2,1].filter(m=>mb2[m].py>0||mb2[m].cy>0).map(m=>({m,label:MONTHS_SHORT3[m-1],q:QMAP2[m],py:mb2[m].py,cy:mb2[m].cy}));
            return <div key={i} style={{marginBottom:8,borderRadius:8,border:`1px solid ${isExp2?"rgba(79,142,247,.2)":"transparent"}`,overflow:"hidden"}}>
              {/* Summary row */}
              <div onClick={()=>setExpandedProduct(isExp2?null:p.name)} style={{cursor:"pointer"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                  <span style={{fontSize:11,color:T.t2,flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>
                  <div style={{display:"flex",gap:6,flexShrink:0,marginLeft:8,alignItems:"center"}}>
                    <span className="m" style={{fontSize:9,color:T.t4}}>{$$(p.py)}</span>
                    <span className="m" style={{fontSize:10,color:trend>=0.8?T.blue:T.amber,fontWeight:600}}>{$$(p.cy)}</span>
                    {pGap>0&&<span className="m" style={{fontSize:9,color:T.red,fontWeight:600}}>-{$$(pGap)}</span>}
                    <span onClick={e=>{e.stopPropagation();setSelProduct(p.name);}} style={{fontSize:9,color:T.t4,cursor:"pointer",textDecoration:"underline",flexShrink:0}}>Locs</span>
                    <span style={{fontSize:10,color:T.t3,transition:"transform .2s",display:"inline-block",transform:isExp2?"rotate(90deg)":"rotate(0deg)"}}>›</span>
                  </div>
                </div>
                <div style={{height:4,borderRadius:2,background:T.s3,overflow:"hidden"}}>
                  <div className="bar-g" style={{animationDelay:`${i*40}ms`,height:"100%",borderRadius:2,width:`${Math.min(p.cy/mx*100,100)}%`,background:trend>=0.8?`linear-gradient(90deg,${T.blue},${T.cyan})`:T.amber}}/>
                </div>
                {p.locsDown.length>0&&<div style={{fontSize:9,color:T.amber,marginTop:2}}>
                  ⚠ {p.locsDown.slice(0,2).map(l=>l.split(" ").slice(0,2).join(" ")).join(", ")} stopped
                </div>}
              </div>
              {/* Inline month table */}
              {isExp2&&<div style={{borderTop:"1px solid rgba(79,142,247,.1)",background:"rgba(0,0,0,.15)",padding:"8px 4px 4px",marginTop:6}}>
                {monthRows2.length===0
                  ? <div style={{fontSize:10,color:T.t4,textAlign:"center",padding:"6px 0"}}>No monthly data — upload a CSV with sales data to populate</div>
                  : <>
                      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:4,marginBottom:4,paddingBottom:4,borderBottom:"1px solid rgba(255,255,255,.05)"}}>
                        {["Month","Q","PY","CY"].map(h=><span key={h} style={{fontSize:8,fontWeight:700,color:T.t4,textTransform:"uppercase",letterSpacing:"0.5px"}}>{h}</span>)}
                      </div>
                      {monthRows2.map(({m,label,q,py,cy})=>{
                        const mGap=py-cy;
                        return <div key={m} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:4,padding:"3px 0",borderBottom:"1px solid rgba(255,255,255,.03)"}}>
                          <span style={{fontSize:10,color:T.t2}}>{label}</span>
                          <span style={{fontSize:9,color:T.t4}}>{q}</span>
                          <span className="m" style={{fontSize:10,color:T.t3,fontFamily:"monospace"}}>{$$(py)}</span>
                          <span className="m" style={{fontSize:10,color:mGap>0?T.red:mGap<0?T.green:T.blue,fontFamily:"monospace",fontWeight:600}}>{$$(cy)}</span>
                        </div>;
                      })}
                    </>
                }
              </div>}
            </div>;
          })}
        </div>}
      </div>}

      <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.t3,marginBottom:8}}>Locations ({sortedChildren.length})</div>
      {sortedChildren.map((c,i)=>{
        const cPy=c.pyQ?.[qk]||0;const cCy=c.cyQ?.[qk]||0;const cGap=cPy-cCy;const cRet=cPy>0?Math.round(cCy/cPy*100):0;
        const cRetColor = cRet>=70?T.green:cRet>=40?T.amber:T.red;
        const borderColor = cGap>2000?"rgba(248,113,113,.2)":cGap<=0&&cPy>0?"rgba(52,211,153,.15)":T.b1;
        return <button key={c.id} className="anim" onClick={()=>goAcct(c)} style={{animationDelay:`${i*30}ms`,width:"100%",textAlign:"left",background:T.s1,border:`1px solid ${borderColor}`,borderRadius:12,padding:"12px 14px",marginBottom:8,cursor:"pointer"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
            <div style={{fontSize:12,fontWeight:600,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</div><Chev/>
          </div>
          <div style={{fontSize:10,color:T.t3,marginBottom:6}}>{c.city}, {c.st}{c.dealer&&c.dealer!=="All Other"?<span style={{color:T.cyan}}> · {c.dealer}</span>:""}{c.last!=null?` · Last ${c.last}d ago`:""}</div>
          <Bar pct={cRet} color={`linear-gradient(90deg,${cRetColor},${cRetColor}99)`}/>
          <div style={{display:"flex",gap:12,marginTop:6}}>
            <Pill l="PY" v={$$(cPy)} c={T.t2}/><Pill l="CY" v={$$(cCy)} c={T.blue}/><Pill l="Gap" v={cGap<=0?`+${$$(Math.abs(cGap))}`:$$(cGap)} c={cGap<=0?T.green:T.red}/><div style={{marginLeft:"auto"}}><Pill l="Ret" v={cRet+"%"} c={cRetColor}/></div>
          </div>
          {(c.products||[]).length>0&&<div style={{marginTop:8,display:"flex",gap:4,flexWrap:"wrap"}}>
            {c.products.slice(0,4).map((p,j)=>{
              const pCy=p[`cy${qk}`]||0;const pPy=p[`py${qk}`]||0;
              return <span key={j} style={{fontSize:8,color:pPy>200&&pCy===0?T.red:T.t3,background:pPy>200&&pCy===0?"rgba(248,113,113,.06)":T.s2,borderRadius:4,padding:"2px 5px",border:`1px solid ${pPy>200&&pCy===0?"rgba(248,113,113,.12)":T.b2}`}}>{p.n.split(" ")[0]} {pPy>200&&pCy===0?"!$0":$$(pCy)}</span>;
            })}
          </div>}
        </button>;
      })}

      {/* GHOST LOCATIONS — found in research, not in CSV */}
      {ghostLocations.map((c:any, i:number) => (
        <div key={c.id} style={{
          background: "rgba(167,139,250,.04)",
          border: "1px dashed rgba(167,139,250,.3)",
          borderRadius: 12, padding: "12px 14px", marginBottom: 8,
          opacity: 0.8
        }}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
            <div style={{fontSize:12,fontWeight:600,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:T.t2}}>{c.name}</div>
            <span style={{fontSize:9,fontWeight:700,color:T.purple,background:"rgba(167,139,250,.15)",borderRadius:4,padding:"2px 7px",border:"1px solid rgba(167,139,250,.3)",flexShrink:0,marginLeft:8}}>NEW ✦</span>
          </div>
          {(c.city||c.addr) && (
            <div style={{fontSize:10,color:T.t4,marginBottom:6}}>
              {c.addr ? `${c.addr}, ` : ""}{c.city}{c.st ? `, ${c.st}` : ""}{c.zip ? ` ${c.zip}` : ""}
            </div>
          )}
          <div style={{fontSize:10,color:T.purple,fontStyle:"italic"}}>Found in research · not yet in your territory data</div>
          <button onClick={() => setGhostLocations(prev => {
            const next = prev.filter((_:any, j:number) => j !== i);
            try { localStorage.setItem(`ghost_locs:${group.id}`, JSON.stringify(next)); } catch {}
            return next;
          })} style={{marginTop:8,background:"none",border:"none",color:T.t4,fontSize:10,cursor:"pointer",fontFamily:"inherit",padding:0}}>
            dismiss
          </button>
        </div>
      ))}
    </div>

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




