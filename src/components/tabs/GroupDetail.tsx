"use client";
// @ts-nocheck
import { useState, useMemo } from "react";
import { T } from "@/lib/tokens";
import { $$, $f, pc } from "@/lib/format";
import { getTierLabel } from "@/lib/tier";
import { BADGER, OVERLAYS_REF } from "@/lib/data";
import { Back, Chev, Pill, Stat, AccountId, fixGroupName } from "@/components/primitives";

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

function GroupDetail({group,goMain,goAcct,overlays,saveOverlays,salesStore=null}) {
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

  // ── Path 2: Product drill → which child accounts are up/down on this product ──
  if (selProduct) {
    const allProds = [...groupBuying, ...groupStopped];
    const prod = allProds.find(p => p.name === selProduct);
    const childBreakdown = (group.children||[]).map((c:any) => {
      const p = (c.products||[]).find((pr:any) => pr.n === selProduct);
      return { ...c, prodPY: p?(p[`py${qk}`]||0):0, prodCY: p?(p[`cy${qk}`]||0):0 };
    }).filter((c:any) => c.prodPY > 0 || c.prodCY > 0)
      .sort((a:any,b:any) => (b.prodPY-b.prodCY)-(a.prodPY-a.prodCY));

    // Monthly aggregation across all group children
    const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const childIds = new Set((group.children||[]).map((c:any) => c.id));
    const allGroupProdRecs = salesStore?.records
      ? (Object.values(salesStore.records) as any[]).filter((r:any) => childIds.has(r.childId) && r.l3 === selProduct)
      : [];
    const hasMonthData = allGroupProdRecs.length > 0;
    const monthBuckets: Record<number,{py:number,cy:number}> = {};
    for (let m=1; m<=12; m++) monthBuckets[m]={py:0,cy:0};
    allGroupProdRecs.forEach((r:any) => {
      const m = r.month||1;
      if (m>=1&&m<=12) { monthBuckets[m].py += r.py||0; monthBuckets[m].cy += r.cy||0; }
    });
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
            ? <div style={{fontSize:11,color:T.t4,textAlign:"center",padding:"16px 0"}}>No monthly history — upload a CSV to populate</div>
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
                <div style={{display:"flex",gap:10,marginTop:8,justifyContent:"flex-end"}}>
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
        <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.t4,marginBottom:4}}>Group Total</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8}}>
          <Stat l="PY" v={$$(py)} c={T.t2}/><Stat l="CY" v={$$(cy)} c={T.blue}/><Stat l="Gap" v={gap<=0?`+${$$(Math.abs(gap))}`:$$(gap)} c={gap<=0?T.green:T.red}/><Stat l="Ret" v={ret+"%"} c={ret>30?T.green:ret>15?T.amber:T.red}/>
        </div>
      </div>

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
          <div style={{fontSize:10,color:T.t3,marginBottom:6}}>{c.city}, {c.st}{c.dealer&&c.dealer!=="All Other"?<span style={{color:T.cyan}}> · {c.dealer}</span>:""} · Last {c.last}d ago</div>
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


export default GroupDetail;

