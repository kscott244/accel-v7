"use client";
// @ts-nocheck

import { useState, useMemo } from "react";
import { T } from "@/lib/tokens";
import { getTierLabel } from "@/lib/tier";
import { $$ } from "@/lib/format";
import { fixGroupName, Pill, Chev } from "@/components/primitives";

export default function GroupsTab({groups,goGroup,filt,setFilt,search,setSearch,groupedPrivates=[]}) {
  const fs=["All","Multi-Location","Private","Schein","Patterson","Benco","Darby","Top 100","Diamond","Platinum","Gold","DSO","Urgent"];
  const isDealerFilt=["Schein","Patterson","Benco","Darby"].includes(filt);

  // IDs of groups that are absorbed into a Grouped Private
  const gpGroupIds=useMemo(()=>new Set(groupedPrivates.flatMap(gp=>gp._groups.map(g=>g.id))),[groupedPrivates]);

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
    else if(filt==="Multi-Location")l=l.filter(g=>g.locs>=2);
    else if(filt==="Private")l=l.filter(g=>g.locs===1&&!gpGroupIds.has(g.id));
    else if(filt==="Top 100")l=l.filter(g=>g.tier==="Top 100"||g.tier?.startsWith("Top 100"));
    else if(filt==="DSO")l=l.filter(g=>g.locs>=3||g.class2==="DSO"||g.class2==="EMERGING DSO");
    else if(isDealerFilt)l=l.filter(g=>g._locs>0);
    else if(filt!=="All")l=l.filter(g=>g.tier===filt||g.tier?.includes(filt));
    if(!isDealerFilt)l.sort((a,b)=>b._gap-a._gap);
    return l;
  },[enriched,filt,search,isDealerFilt,gpGroupIds]);

  // Grouped Privates filtered/enriched for current view
  const gpList=useMemo(()=>{
    if(filt!=="Private"&&filt!=="All")return [];
    let gps=[...groupedPrivates];
    if(search){const q=search.toLowerCase();gps=gps.filter(gp=>gp.name.toLowerCase().includes(q)||gp.addr?.toLowerCase().includes(q)||gp.city?.toLowerCase().includes(q));}
    return gps.sort((a,b)=>b._gap-a._gap);
  },[groupedPrivates,filt,search]);

  // Top (growing/strong) + Hurting — used by both dealer and standard views
  const topList=useMemo(()=>[...list].filter(g=>g._cy1>0&&g._ret>=0.7&&g._py1>0).sort((a,b)=>b._cy1-a._cy1).slice(0,15),[list]);
  const hurtList=useMemo(()=>[...list].filter(g=>g._gap>500&&g._ret<0.6).sort((a,b)=>b._gap-a._gap).slice(0,15),[list]);
  // Dealer split aliases
  const dealerTop=useMemo(()=>isDealerFilt?topList:[],[topList,isDealerFilt]);
  const dealerHurt=useMemo(()=>isDealerFilt?hurtList:[],[hurtList,isDealerFilt]);

  // Compact half-width card for two-column layout
  const MiniCard=({g,i,side}:{g:any,i:number,side:"top"|"hurt"})=>{
    const isTop=side==="top";
    const border=isTop?"rgba(52,211,153,.2)":"rgba(248,113,113,.2)";
    const retColor=g._ret>0.7?T.green:g._ret>0.4?T.amber:T.red;
    return <button onClick={()=>goGroup(g)} style={{width:"100%",textAlign:"left",background:T.s1,border:`1px solid ${border}`,borderRadius:12,padding:"10px 12px",marginBottom:8,cursor:"pointer"}}>
      <div style={{fontSize:11,fontWeight:600,color:T.t1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginBottom:4}}>{fixGroupName(g)}</div>
      <div style={{fontSize:9,color:T.t4,marginBottom:6}}>{g._locs} loc{g._locs!==1?"s":""}{isDealerFilt?<span style={{color:T.cyan}}> · {filt}</span>:""}</div>
      <div style={{display:"flex",flexDirection:"column",gap:3}}>
        <div style={{display:"flex",justifyContent:"space-between"}}>
          <span style={{fontSize:9,color:T.t3}}>CY</span>
          <span className="m" style={{fontSize:11,fontWeight:700,color:isTop?T.green:T.blue}}>{$$(g._cy1)}</span>
        </div>
        <div style={{display:"flex",justifyContent:"space-between"}}>
          <span style={{fontSize:9,color:T.t3}}>PY</span>
          <span className="m" style={{fontSize:11,fontWeight:600,color:T.t3}}>{$$(g._py1)}</span>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:2,paddingTop:4,borderTop:`1px solid ${T.b2}`}}>
          <span style={{fontSize:9,color:T.t3}}>{isTop?"Ret":"Gap"}</span>
          <span className="m" style={{fontSize:11,fontWeight:700,color:isTop?retColor:T.red}}>{isTop?Math.round(g._ret*100)+"%":$$(g._gap)}</span>
        </div>
      </div>
    </button>;
  };

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

  // Grouped Private card — one location, multiple dealers
  const GPCard=({gp,i}:{gp:any,i:number})=>{
    const isGrowing=gp._cy1>gp._py1&&gp._py1>0;
    const ret=gp._ret;
    return <div className="anim" style={{animationDelay:`${i*20}ms`,background:T.s1,border:"1px solid rgba(120,120,160,.2)",borderRadius:14,padding:"14px 16px",marginBottom:8}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{gp.name}</div>
          <div style={{fontSize:10,color:T.t3,marginTop:2}}>{gp.city}{gp.st?`, ${gp.st}`:""} · Private</div>
        </div>
        <div style={{display:"flex",gap:4,alignItems:"center"}}>
          <span style={{flexShrink:0,borderRadius:999,background:"rgba(120,120,160,.12)",border:"1px solid rgba(120,120,160,.25)",padding:"2px 8px",fontSize:9,fontWeight:700,color:"#9b9bc0"}}>*{gp.dealers.length} dealers</span>
          {isGrowing&&<span style={{flexShrink:0,borderRadius:999,background:"rgba(52,211,153,.09)",border:"1px solid rgba(52,211,153,.22)",padding:"2px 8px",fontSize:9,fontWeight:700,color:T.green}}>Growing</span>}
        </div>
      </div>
      {/* Dealer breakdown */}
      <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:8}}>
        {gp._groups.map((g:any)=>{
          const d=g.children?.[0]?.dealer||"All Other";
          const py=g.pyQ?.["1"]||0, cy=g.cyQ?.["1"]||0;
          return <button key={g.id} onClick={()=>goGroup(g)} style={{fontSize:9,padding:"3px 8px",borderRadius:6,background:"rgba(79,142,247,.08)",border:"1px solid rgba(79,142,247,.18)",color:T.blue,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>
            {d} · PY {$$(py)}
          </button>;
        })}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:16}}>
        <Pill l="PY" v={$$(gp._py1)} c={T.t2}/>
        <Pill l="CY" v={$$(gp._cy1)} c={T.blue}/>
        <Pill l="Gap" v={gp._gap<=0?`+${$$(Math.abs(gp._gap))}`:$$(gp._gap)} c={gp._gap<=0?T.green:T.red}/>
        <div style={{marginLeft:"auto"}}><Pill l="Ret" v={Math.round(ret*100)+"%" } c={ret>0.5?T.green:ret>0.25?T.amber:T.red}/></div>
      </div>
    </div>;
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
      {/* ── TWO-COLUMN VIEW ── */}
      <div style={{marginBottom:10,fontSize:10,color:T.t4}}>
        {filt==="All"
          ? `${list.length} total · ${enriched.filter(g=>g.locs>=2).length} multi-location · ${enriched.filter(g=>g.locs===1&&!gpGroupIds.has(g.id)).length} single · ${groupedPrivates.length} multi-dealer`
          : filt==="Multi-Location" ? `${list.length} groups · 2+ locations`
          : filt==="Private" ? `${list.length} single-dealer · ${gpList.length} multi-dealer`
          : `${list.length} groups`}
      </div>

      {/* Grouped Privates section (Private + All filters) */}
      {gpList.length>0&&<>
        <div style={{marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:"#9b9bc0"}}>Multi-Dealer Privates</span>
          <span style={{fontSize:9,color:T.t4,background:"rgba(120,120,160,.1)",borderRadius:4,padding:"1px 6px"}}>{gpList.length}</span>
        </div>
        {gpList.map((gp,i)=><GPCard key={gp.id} gp={gp} i={i}/>)}
        {list.length>0&&<div style={{marginTop:12,marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.t3}}>Single-Dealer Private</span>
        </div>}
      </>}

      {/* Column headers — only for non-Private filters */}
      {filt!=="Private"&&<div style={{display:"flex",gap:8,marginBottom:8}}>
        <div style={{flex:1,display:"flex",alignItems:"center",gap:6}}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.green} strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          <span style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.green}}>Top Accounts</span>
        </div>
        <div style={{flex:1,display:"flex",alignItems:"center",gap:6}}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.red} strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <span style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.red}}>Hurting You</span>
        </div>
      </div>}

      {/* Two columns (non-Private) or flat list (Private) */}
      {filt==="Private"
        ? list.map((g,i)=><GroupCard key={g.id} g={g} i={i}/>)
        : <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
            <div style={{flex:1}}>
              {topList.length===0
                ? <div style={{fontSize:11,color:T.t4,padding:"10px 12px",background:T.s1,borderRadius:12}}>No growing accounts</div>
                : topList.map((g,i)=><MiniCard key={g.id} g={g} i={i} side="top"/>)}
            </div>
            <div style={{flex:1}}>
              {hurtList.length===0
                ? <div style={{fontSize:11,color:T.t4,padding:"10px 12px",background:T.s1,borderRadius:12}}>No significant gaps</div>
                : hurtList.map((g,i)=><MiniCard key={g.id} g={g} i={i} side="hurt"/>)}
            </div>
          </div>
      }

      {/* Full list below if searching */}
      {search&&<>
        <div style={{marginTop:16,marginBottom:8,fontSize:10,fontWeight:700,color:T.t3,textTransform:"uppercase",letterSpacing:"1px"}}>All Results</div>
        {list.slice(0,50).map((g,i)=><GroupCard key={g.id} g={g} i={i}/>)}
      </>}
    </>}
  </div>;
}
