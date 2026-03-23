"use client";
// @ts-nocheck
import { useState, useMemo } from "react";
import { T } from "@/lib/tokens";
import { $$, $f, pc } from "@/lib/format";

let SCHEIN_REPS: {fsc:any[], es:any[]} = {fsc:[], es:[]};
let BADGER: Record<string, any> = {};
let DEALERS: Record<string, string> = {};
try { BADGER = require("@/data/badger-lookup.json"); } catch(e) {}
try { DEALERS = require("@/data/dealers").DEALERS; } catch(e) {}
try { SCHEIN_REPS = require("@/data/schein-ct-reps.json"); } catch(e) {}

let OVERLAYS_REF: any = { nameOverrides:{}, contacts:{}, fscReps:{}, activityLogs:{}, research:{}, dealerOverrides:{}, groups:{}, groupDetaches:[], groupMoves:{} };

const Stat = ({l,v,c}) => <div style={{background:T.s2,borderRadius:8,padding:"8px 10px",textAlign:"center"}}><div style={{fontSize:9,textTransform:"uppercase",color:T.t3,marginBottom:2}}>{l}</div><div className="m" style={{fontSize:14,fontWeight:700,color:c}}>{v}</div></div>;
const Back = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>;
const Chev = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{opacity:.4,flexShrink:0}}><path d="M9 18l6-6-6-6"/></svg>;
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

// ─── STANDALONE CALCULATOR TAB ───────────────────────────────────
// ─── DASHBOARD TAB ───────────────────────────────────────────────
// ─── MAP / ROUTE TAB ─────────────────────────────────────────────
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
  const [mainTab, setMainTab] = useState<"dealers"|"team">("dealers");
  const [selDist,setSelDist] = useState<string|null>(null);
  const [selRep,setSelRep]  = useState<string|null>(null); // null = all reps view
  const [selGroup,setSelGroup] = useState<string|null>(null); // gId of selected group in rep drill-down
  const [showAddRep,setShowAddRep] = useState(false);
  const [newRepName,setNewRepName] = useState("");
  const [newRepPhone,setNewRepPhone] = useState("");
  const [newRepNotes,setNewRepNotes] = useState("");
  const [cocallDist, setCocallDist] = useState<string|null>(null);
  const [cocallOpen, setCocallOpen] = useState<boolean>(() => {
    try { return localStorage.getItem("cocall_open") === "true"; } catch { return false; }
  });
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
    // ── SCHEIN TEAM DIRECTORY ──
  if (mainTab === "team") {
    return <div style={{paddingBottom:80}}>
      <div style={{position:"sticky",top:52,zIndex:40,background:"rgba(10,10,15,.9)",backdropFilter:"blur(20px)",borderBottom:"1px solid "+T.b3,padding:"12px 16px"}}>
        <div style={{display:"flex",gap:6}}>
          <button onClick={()=>setMainTab("dealers")} style={{flex:1,padding:"7px 0",borderRadius:8,fontSize:11,fontWeight:700,cursor:"pointer",border:"1px solid "+T.b2,background:T.s2,color:T.t3,fontFamily:"inherit"}}>Dealers</button>
          <button onClick={()=>setMainTab("team")} style={{flex:1,padding:"7px 0",borderRadius:8,fontSize:11,fontWeight:700,cursor:"pointer",border:"1px solid rgba(79,142,247,.3)",background:"rgba(79,142,247,.15)",color:T.blue,fontFamily:"inherit"}}>Schein Team</button>
        </div>
      </div>
      <div style={{padding:"16px"}}>
        <div style={{fontSize:10,color:T.t4,marginBottom:14}}>Henry Schein · CT Territory Roster</div>
        <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.cyan,marginBottom:10}}>{"FSC — Field Sales Consultants ("+SCHEIN_REPS.fsc.length+")"}</div>
        {SCHEIN_REPS.fsc.map((r:any,i:number)=>(
          <div key={i} style={{background:T.s1,border:"1px solid "+T.b1,borderRadius:12,padding:"12px 14px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:700,color:T.t1}}>{r.name}</div>
              <div style={{fontSize:10,color:T.t4,marginTop:1}}>{r.email}</div>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0,marginLeft:12}}>
              <span style={{fontSize:11,fontFamily:"monospace",color:T.t3}}>{r.phone}</span>
              <a href={"tel:"+r.phone.replace(/[^0-9]/g,"")} style={{background:"rgba(34,211,153,.1)",border:"1px solid rgba(34,211,153,.25)",borderRadius:8,padding:"5px 12px",fontSize:11,fontWeight:700,color:T.green,textDecoration:"none"}}>Call</a>
            </div>
          </div>
        ))}
        <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.amber,marginBottom:10,marginTop:20}}>{"ES — Equipment Specialists ("+SCHEIN_REPS.es.length+")"}</div>
        {SCHEIN_REPS.es.map((r:any,i:number)=>(
          <div key={i} style={{background:T.s1,border:"1px solid "+T.b1,borderRadius:12,padding:"12px 14px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:700,color:T.t1}}>{r.name}</div>
              <div style={{fontSize:10,color:T.t4,marginTop:1}}>{r.email}</div>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0,marginLeft:12}}>
              <span style={{fontSize:11,fontFamily:"monospace",color:T.t3}}>{r.phone}</span>
              <a href={"tel:"+r.phone.replace(/[^0-9]/g,"")} style={{background:"rgba(34,211,153,.1)",border:"1px solid rgba(34,211,153,.25)",borderRadius:8,padding:"5px 12px",fontSize:11,fontWeight:700,color:T.green,textDecoration:"none"}}>Call</a>
            </div>
          </div>
        ))}
      </div>
    </div>;
  }

  return <div style={{paddingBottom:80}}>
      <div style={{position:"sticky",top:52,zIndex:40,background:"rgba(10,10,15,.9)",backdropFilter:"blur(20px)",borderBottom:`1px solid ${T.b3}`,padding:"10px 16px",display:"flex",alignItems:"center",gap:10}}>
        <div style={{display:"flex",gap:6,marginBottom:0}}>
          <button onClick={()=>setMainTab("dealers")} style={{flex:1,padding:"5px 0",borderRadius:7,fontSize:10,fontWeight:700,cursor:"pointer",border:"1px solid rgba(79,142,247,.25)",background:"rgba(79,142,247,.12)",color:T.blue,fontFamily:"inherit"}}>Dealers</button>
          <button onClick={()=>setMainTab("team")} style={{flex:1,padding:"5px 0",borderRadius:7,fontSize:10,fontWeight:700,cursor:"pointer",border:`1px solid ${T.b2}`,background:T.s2,color:T.t3,fontFamily:"inherit"}}>Schein Team</button>
        </div>
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
                <AccountId name={a.name} gName={a.gName} size="md"/>
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
    {/* ── FSC CO-CALL PLANNER ── */}
    <div style={{background:`linear-gradient(135deg,${T.s1},rgba(167,139,250,.06))`,border:`1px solid rgba(167,139,250,.2)`,borderRadius:16,padding:14,marginBottom:14}}>
      <button onClick={()=>{const next=!cocallOpen;setCocallOpen(next);try{localStorage.setItem("cocall_open",String(next));}catch{}}} style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:0}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:16}}>🤝</span>
          <div style={{textAlign:"left"}}>
            <div style={{fontSize:13,fontWeight:700,color:T.purple}}>FSC Co-Call Planner</div>
            <div style={{fontSize:10,color:T.t3}}>Build a hit list to share with your dealer rep</div>
          </div>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.t4} strokeWidth="2" style={{transform:cocallOpen?"rotate(180deg)":"none",transition:"transform .2s"}}><path d="M6 9l6 6 6-6"/></svg>
      </button>

      {cocallOpen&&<div style={{marginTop:12}}>
        {/* Distributor picker */}
        <div style={{display:"flex",gap:6,marginBottom:12}}>
          {DIST_ORDER.map(d=>(
            <button key={d} onClick={()=>setCocallDist(cocallDist===d?null:d)} style={{
              flex:1,padding:"8px 0",borderRadius:8,border:"none",fontFamily:"inherit",fontSize:11,fontWeight:700,cursor:"pointer",
              background:cocallDist===d?(DIST_COLORS[d]||T.s2):T.s2,
              color:cocallDist===d?(DIST_TEXT[d]||T.t1):T.t3,
              borderWidth:1,borderStyle:"solid",
              borderColor:cocallDist===d?(DIST_BORDER[d]||T.b1):T.b1,
            }}>{d}</button>
          ))}
        </div>

        {cocallDist&&(()=>{
          // Build ranked co-call list for selected distributor
          const B = typeof BADGER!=='undefined'?BADGER:{};
          const distAccts = scored
            .filter((a:any) => a.dealer === cocallDist)
            .filter((a:any) => (a.pyQ?.["1"]||0) > 100 || (a.cyQ?.["1"]||0) > 100) // has meaningful history
            .map((a:any) => {
              const py = a.pyQ?.["1"]||0, cy = a.cyQ?.["1"]||0, gap = py - cy;
              const deadProducts = (a.products||[]).filter((p:any) => (p.py1||0) > 100 && (p.cy1||0) === 0);
              // Co-call score: gap matters most, but also prioritize accounts with prior purchases (FSC has a relationship)
              let ccScore = 0;
              if(gap > 5000) ccScore += 40;
              else if(gap > 2000) ccScore += 25;
              else if(gap > 500) ccScore += 15;
              else if(gap > 0) ccScore += 5;
              if(py > 5000) ccScore += 15; // big account = more leverage
              else if(py > 2000) ccScore += 10;
              else if(py > 500) ccScore += 5;
              if(deadProducts.length > 0) ccScore += deadProducts.length * 5; // lost products = talking point
              if(a.visitPriority === "NOW") ccScore += 10;
              else if(a.visitPriority === "SOON") ccScore += 5;
              if(cy > 0 && gap > 0) ccScore += 8; // still buying but down = winnable
              return {...a, ccScore, gap, deadProducts};
            })
            .filter((a:any) => a.ccScore > 0 && a.gap > 0)
            .sort((a:any,b:any) => b.ccScore - a.ccScore)
            .slice(0, 10);

          // Get FSC info for this distributor
          const fscEntries: any[] = [];
          Object.entries(OVERLAYS_REF.fscReps||{}).forEach(([gId, distMap]:any) => {
            if(distMap[cocallDist]) {
              const fsc = distMap[cocallDist];
              const g = (groups||[]).find((g:any)=>g.id===gId);
              if(fsc.name && !fscEntries.find((e:any)=>e.name===fsc.name)) {
                fscEntries.push({...fsc, groupName: g?.name||gId});
              }
            }
          });
          // Also check localStorage
          distAccts.forEach((a:any) => {
            try {
              const lsk = `groupFSC:${a.gId}:${cocallDist}`;
              const local = JSON.parse(localStorage.getItem(lsk)||"null");
              if(local?.name && !fscEntries.find((e:any)=>e.name===local.name)) fscEntries.push(local);
            } catch {}
          });

          const totalGap = distAccts.reduce((s:number,a:any)=>s+a.gap,0);

          if(distAccts.length === 0) return <div style={{fontSize:11,color:T.t4,textAlign:"center",padding:"12px 0"}}>No down accounts for {cocallDist} with enough history for a co-call.</div>;

          return <div>
            {/* FSC contact if known */}
            {fscEntries.length>0&&<div style={{background:"rgba(167,139,250,.06)",border:"1px solid rgba(167,139,250,.12)",borderRadius:10,padding:"8px 12px",marginBottom:10,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div><div style={{fontSize:10,color:T.purple,fontWeight:600}}>{cocallDist} FSC: {fscEntries[0].name}</div>{fscEntries[0].phone&&<div style={{fontSize:9,color:T.t3}}>{fscEntries[0].phone}</div>}</div>
              {fscEntries[0].phone&&<a href={`tel:${fscEntries[0].phone.replace(/\D/g,"")}`} style={{background:"rgba(167,139,250,.1)",border:"1px solid rgba(167,139,250,.2)",borderRadius:6,padding:"3px 10px",fontSize:10,fontWeight:600,color:T.purple,textDecoration:"none"}}>Call</a>}
            </div>}

            {/* Summary */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{fontSize:10,color:T.t4}}>Top {distAccts.length} co-call targets · {$$(totalGap)} gap</div>
              <button onClick={()=>{
                // Copy shareable text to clipboard
                const lines = distAccts.slice(0,8).map((a:any,i:number) => {
                  const dp = a.deadProducts?.length>0 ? ` (lost: ${a.deadProducts.map((p:any)=>p.n).slice(0,2).join(", ")})` : "";
                  return `${i+1}. ${a.name} — ${a.city} — gap $${Math.round(a.gap).toLocaleString()}${dp}`;
                });
                const txt = `${cocallDist} Co-Call Targets (${new Date().toLocaleDateString()}):\n${lines.join("\n")}\n\nTotal gap: $${Math.round(totalGap).toLocaleString()}`;
                navigator.clipboard?.writeText(txt).then(()=>{}).catch(()=>{});
              }} style={{background:"rgba(167,139,250,.08)",border:"1px solid rgba(167,139,250,.15)",borderRadius:6,padding:"3px 10px",fontSize:9,fontWeight:700,color:T.purple,cursor:"pointer",fontFamily:"inherit"}}>
                📋 Copy List
              </button>
            </div>

            {/* Ranked accounts */}
            {distAccts.map((a:any,i:number)=>{
              const py=a.pyQ?.["1"]||0, cy=a.cyQ?.["1"]||0;
              const chipColor = a.visitPriority==="NOW"?"#f87171":a.visitPriority==="SOON"?"#fbbf24":"#34d399";
              // Find parent group totals for this distributor
              const parentGroup = (groups||[]).find((g:any)=>g.id===a.gId);
              const isMultiLoc = parentGroup && parentGroup.children && parentGroup.children.length > 1;
              const gPY = isMultiLoc ? (parentGroup.pyQ?.["1"]||0) : 0;
              const gCY = isMultiLoc ? (parentGroup.cyQ?.["1"]||0) : 0;
              const gGap = gPY - gCY;
              const gLocs = isMultiLoc ? parentGroup.children.length : 0;
              // Count how many of this group's locations are on this distributor
              const distLocs = isMultiLoc ? parentGroup.children.filter((c:any)=>c.dealer===cocallDist).length : 0;
              return <button key={a.id} className="anim" onClick={()=>goAcct(a)}
                style={{animationDelay:`${i*25}ms`,width:"100%",textAlign:"left",background:T.s2,border:`1px solid ${a.gap>2000?"rgba(248,113,113,.15)":T.b1}`,borderLeft:isMultiLoc?`3px solid ${T.cyan}`:`1px solid ${a.gap>2000?"rgba(248,113,113,.15)":T.b1}`,borderRadius:12,padding:"12px 14px",marginBottom:8,cursor:"pointer",fontFamily:"inherit"}}>
                {/* Row 1: Rank + Name + Priority + Gap */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:5}}>
                  <div style={{display:"flex",alignItems:"center",gap:7,flex:1,minWidth:0}}>
                    <span style={{fontSize:13,fontWeight:800,color:T.purple,flexShrink:0,width:20}}>{i+1}</span>
                    <AccountId name={a.name} size="md"/>
                    <span style={{flexShrink:0,fontSize:8,fontWeight:700,borderRadius:4,padding:"2px 5px",background:`${chipColor}20`,color:chipColor}}>{a.visitPriority}</span>
                  </div>
                  <span style={{fontSize:13,fontWeight:700,color:T.red,fontFamily:"'JetBrains Mono',monospace",flexShrink:0,marginLeft:8}}>-{$$(a.gap)}</span>
                </div>
                {/* Row 2: Location details + PY/CY */}
                <div style={{paddingLeft:27,marginBottom:isMultiLoc?6:0}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{fontSize:10,color:T.t3}}>{a.city}{a.st?`, ${a.st}`:""}</div>
                    <div style={{fontSize:10,color:T.t3,fontFamily:"'JetBrains Mono',monospace"}}>PY {$$(py)} → CY {$$(cy)}</div>
                  </div>
                  {a.deadProducts?.length>0&&<div style={{fontSize:9,color:T.amber,marginTop:3}}>Lost: {a.deadProducts.slice(0,3).map((p:any)=>p.n).join(", ")}</div>}
                </div>
                {/* Row 3: Parent group context — only for multi-location groups */}
                {isMultiLoc&&<div style={{paddingLeft:27,marginTop:4,paddingTop:6,borderTop:`1px solid ${T.b1}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{fontSize:9,color:T.cyan}}>↳ {a.gName?.slice(0,30)} · {gLocs} locs{distLocs<gLocs?` (${distLocs} ${cocallDist})`:""}</div>
                    <div style={{fontSize:9,color:T.cyan,fontFamily:"'JetBrains Mono',monospace"}}>Group: PY {$$(gPY)} → CY {$$(gCY)}{gGap>0?<span style={{color:"#f87171"}}> (-{$$(gGap)})</span>:""}</div>
                  </div>
                </div>}
              </button>;
            })}

            {/* Google Maps route for top accounts */}
            {(()=>{
              const withGps = distAccts.filter((a:any)=>B[a.id]?.lat).slice(0,8);
              if(withGps.length<2) return null;
              const addrOf = (a:any) => {
                const addr = B[a.id]?.address || "";
                if(addr && /^\d/.test(addr)) return addr;
                return `${a.city||""}, ${a.st||"CT"}`;
              };
              const origin = encodeURIComponent("Thomaston, CT");
              const dest = encodeURIComponent(addrOf(withGps[withGps.length-1]));
              const waypoints = withGps.slice(0,-1).map((a:any)=>encodeURIComponent(addrOf(a))).join("|");
              const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&waypoints=${waypoints}&travelmode=driving`;
              return <a href={url} target="_blank" rel="noopener" style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,width:"100%",padding:"10px 0",borderRadius:10,border:"none",background:`linear-gradient(90deg,${T.purple},${T.blue})`,color:"#fff",fontSize:12,fontWeight:700,textDecoration:"none",marginTop:8,fontFamily:"inherit"}}>
                🗺️ Route Top {withGps.length} in Maps
              </a>;
            })()}
          </div>;
        })()}
      </div>}
    </div>
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


export default DealersTab;
