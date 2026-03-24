"use client";
// @ts-nocheck

import { useState, useMemo } from "react";
import { T } from "@/lib/tokens";
import { getTierLabel } from "@/lib/tier";
import { $$, pc } from "@/lib/format";
import { fixGroupName, Pill, Bar, Chev } from "@/components/primitives";

const FILTERS = ["All", "Multi-Location", "Private", "DSO"];

// ── ACCOUNT CARD ─────────────────────────────────────────────────
function AccountCard({g, i, goGroup}) {
  const retPct   = Math.min(100, Math.round((g._ret||0) * 100));
  const retColor = g._ret >= 0.7 ? T.green : g._ret >= 0.4 ? T.amber : T.red;
  const barColor = `linear-gradient(90deg,${retColor},${retColor}99)`;
  const subtitle = `${g._locs} loc${g._locs!==1?"s":""} · ${getTierLabel(g.tier,g.class2)}`;

  return (
    <button className="anim" onClick={() => goGroup(g)}
      style={{animationDelay:`${i*15}ms`, width:"100%", textAlign:"left",
        background:T.s1, borderRadius:14, padding:"12px 14px", marginBottom:7,
        cursor:"pointer", border:`1px solid ${T.b1}`,
        borderLeft:`3px solid ${retColor}66`}}>

      {/* Row 1: name + gap */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:5}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:700,color:T.t1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {fixGroupName(g)}
          </div>
          <div style={{fontSize:10,color:T.t3,marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {subtitle}
          </div>
        </div>
        <div style={{flexShrink:0,marginLeft:12,textAlign:"right"}}>
          <div className="m" style={{fontSize:13,fontWeight:700,color:g._gap<=0?T.green:T.red}}>
            {g._gap<=0?`+${$$(Math.abs(g._gap))}`:$$(g._gap)}
          </div>
          <div style={{fontSize:10,color:retColor,fontWeight:600,marginTop:1}}>{retPct}% ret</div>
        </div>
      </div>

      {/* Row 2: retention bar */}
      <Bar pct={retPct} color={barColor}/>

      {/* Row 3: PY / CY */}
      <div style={{display:"flex",alignItems:"center",gap:14,marginTop:7}}>
        <Pill l="PY" v={$$(g._py1)} c={T.t2}/>
        <Pill l="CY" v={$$(g._cy1)} c={T.blue}/>
        <Chev/>
      </div>
    </button>
  );
}

// ── MAIN COMPONENT ───────────────────────────────────────────────
export default function GroupsTab({groups,goGroup,filt,setFilt,search,setSearch}) {

  const enriched = useMemo(() => groups.map(g => {
    const py1 = g.pyQ?.["1"] || 0;
    const cy1 = g.cyQ?.["1"] || 0;
    const gap = py1 - cy1;
    const ret = py1 > 0 ? cy1/py1 : 1;
    const locs = g.locs || (g.children||[]).length;
    return {...g, _py1:py1, _cy1:cy1, _gap:gap, _ret:ret, _locs:locs};
  }), [groups]);

  const list = useMemo(() => {
    let l = [...enriched];

    if (search) {
      const q = search.toLowerCase();
      l = l.filter(g =>
        fixGroupName(g).toLowerCase().includes(q) ||
        g.name.toLowerCase().includes(q) ||
        g.children?.some(c=>c.name.toLowerCase().includes(q))
      );
    }

    if (filt === "Multi-Location") l = l.filter(g => g._locs >= 2);
    else if (filt === "Private")    l = l.filter(g => g._locs === 1);
    else if (filt === "DSO")        l = l.filter(g => g._locs >= 3 || g.class2 === "DSO" || g.class2 === "EMERGING DSO");

    // Always sort by highest PY first
    l.sort((a,b) => b._py1 - a._py1);

    return l;
  }, [enriched, filt, search]);

  return (
    <div style={{padding:"0 0 80px"}}>

      {/* ── SEARCH ── */}
      <div style={{position:"relative",margin:"16px 16px 10px"}}>
        <svg style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",
          width:14,height:14,color:T.t4,pointerEvents:"none"}}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input type="search" value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="Search accounts…"
          style={{width:"100%",height:42,borderRadius:12,
            border:`1px solid ${search?T.blue+"44":T.b1}`,
            background:T.s1,color:T.t1,fontSize:13,
            paddingLeft:36,paddingRight:search?34:12,
            outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
        {search&&<button onClick={()=>setSearch("")}
          style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",
            background:"none",border:"none",color:T.t4,cursor:"pointer",fontSize:16,lineHeight:1}}>✕</button>}
      </div>

      {/* ── FILTER PILLS ── */}
      <div className="hide-sb" style={{display:"flex",gap:5,overflowX:"auto",padding:"0 16px 2px",marginBottom:10}}>
        {FILTERS.map(f=>(
          <button key={f} onClick={()=>setFilt(f)}
            style={{flexShrink:0,whiteSpace:"nowrap",padding:"5px 12px",borderRadius:7,
              fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
              border:`1px solid ${filt===f?"rgba(79,142,247,.35)":T.b2}`,
              background:filt===f?"rgba(79,142,247,.15)":T.s2,
              color:filt===f?T.blue:T.t3}}>
            {f}
          </button>
        ))}
      </div>

      {/* ── STATUS LINE ── */}
      <div style={{padding:"0 16px",marginBottom:12,fontSize:10,color:T.t4}}>
        {list.length} account{list.length!==1?"s":""}{search ? ` matching "${search}"` : ""}
      </div>

      {/* ── LIST ── */}
      <div style={{padding:"0 16px"}}>
        {list.length === 0
          ? <div style={{padding:"40px 0",textAlign:"center",color:T.t4,fontSize:12}}>No accounts match this filter.</div>
          : list.map((g,i) => <AccountCard key={g.id} g={g} i={i} goGroup={goGroup}/>)
        }
      </div>
    </div>
  );
}
