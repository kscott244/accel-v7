"use client";
// @ts-nocheck

import { useState, useMemo } from "react";
import { T } from "@/lib/tokens";
import { getTierLabel } from "@/lib/tier";
import { $$, pc } from "@/lib/format";
import { fixGroupName, Pill, Bar, Chev } from "@/components/primitives";
import { scorePriority, BUCKET_STYLE } from "@/lib/priority";

// Filters split into two semantic rows
const STATUS_FILTERS = ["All","Urgent","Multi-Location","Private","DSO","Top 100","Diamond","Platinum","Gold"];
const DEALER_FILTER_LIST = ["Schein","Patterson","Benco","Darby"];
const DEALER_FILTERS = new Set(DEALER_FILTER_LIST);

// ── ACCOUNT CARD ─────────────────────────────────────────────────
function AccountCard({g, i, goGroup, isDealerFilt, filt}) {
  const bucket   = g._priorityBucket ?? "Watch";
  const bStyle   = BUCKET_STYLE[bucket];
  const retPct   = Math.min(100, Math.round(g._ret * 100));
  const retColor = g._ret >= 0.7 ? T.green : g._ret >= 0.4 ? T.amber : T.red;
  const barColor = `linear-gradient(90deg,${retColor},${retColor}99)`;
  // Subtitle: priorityReason is the most useful signal; fall back to locs · tier
  const subtitle = g._priorityReason
    ? g._priorityReason + (isDealerFilt ? ` · ${filt}` : "")
    : `${g._locs} loc${g._locs!==1?"s":""} · ${getTierLabel(g.tier,g.class2)}${isDealerFilt ? ` · ${filt}` : ""}`;

  return (
    <button className="anim" onClick={() => goGroup(g)}
      style={{animationDelay:`${i*15}ms`, width:"100%", textAlign:"left",
        background:T.s1, borderRadius:14, padding:"12px 14px", marginBottom:7,
        cursor:"pointer", border:`1px solid ${bStyle.border}`,
        borderLeft:`3px solid ${bStyle.leftAccent}`}}>

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

      {/* Row 3: PY / CY / single priority badge */}
      <div style={{display:"flex",alignItems:"center",gap:14,marginTop:7}}>
        <Pill l="PY" v={$$(g._py1)} c={T.t2}/>
        <Pill l="CY" v={$$(g._cy1)} c={T.blue}/>
        <span style={{marginLeft:"auto",fontSize:9,fontWeight:700,color:bStyle.color,
          background:bStyle.bg,borderRadius:4,padding:"2px 7px",
          border:`1px solid ${bStyle.border}`}}>{bucket}</span>
        <Chev/>
      </div>
    </button>
  );
}

// ── GP CARD — same-address multi-dealer practice ─────────────────
function GPCard({gp, i, goGroup}) {
  const isGrowing = gp._cy1 > gp._py1 && gp._py1 > 0;
  const ret       = gp._ret;
  const retColor  = ret >= 0.7 ? T.green : ret >= 0.4 ? T.amber : T.red;
  const retPct    = Math.min(100, Math.round(ret * 100));

  return (
    <div className="anim" style={{animationDelay:`${i*15}ms`, background:T.s1,
      border:"1px solid rgba(120,120,160,.22)", borderLeft:"3px solid rgba(120,120,160,.5)",
      borderRadius:14, padding:"12px 14px", marginBottom:7}}>

      {/* Row 1: name + gap */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:5}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:700,color:T.t1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {gp.name}
          </div>
          <div style={{fontSize:10,color:T.t3,marginTop:1}}>
            {gp.city}{gp.st?`, ${gp.st}`:""} · Private · {gp.dealers.length} dealers
          </div>
        </div>
        <div style={{flexShrink:0,marginLeft:12,textAlign:"right"}}>
          <div className="m" style={{fontSize:13,fontWeight:700,color:gp._gap<=0?T.green:T.red}}>
            {gp._gap<=0?`+${$$(Math.abs(gp._gap))}`:$$(gp._gap)}
          </div>
          <div style={{fontSize:10,color:retColor,fontWeight:600,marginTop:1}}>{retPct}% ret</div>
        </div>
      </div>

      {/* Row 2: bar */}
      <Bar pct={retPct} color={`linear-gradient(90deg,${retColor},${retColor}99)`}/>

      {/* Row 3: dealer chips */}
      <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:8,marginBottom:6}}>
        {gp._groups.map((g:any)=>{
          const d = g.children?.[0]?.dealer||"All Other";
          const py = g.pyQ?.["1"]||0;
          return <button key={g.id} onClick={e=>{e.stopPropagation();goGroup(g);}}
            style={{fontSize:9,padding:"3px 9px",borderRadius:6,
              background:"rgba(79,142,247,.08)",border:"1px solid rgba(79,142,247,.2)",
              color:T.blue,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>
            {d} · {$$(py)}
          </button>;
        })}
      </div>

      {/* Row 4: metrics */}
      <div style={{display:"flex",alignItems:"center",gap:14}}>
        <Pill l="PY" v={$$(gp._py1)} c={T.t2}/>
        <Pill l="CY" v={$$(gp._cy1)} c={T.blue}/>
        {isGrowing&&<span style={{marginLeft:"auto",fontSize:9,fontWeight:700,color:T.green,
          background:"rgba(52,211,153,.08)",borderRadius:4,padding:"2px 7px",
          border:"1px solid rgba(52,211,153,.18)"}}>Growing</span>}
      </div>
    </div>
  );
}

// ── SECTION LABEL ────────────────────────────────────────────────
const SectionLabel = ({label, color, count=null}) => (
  <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:10,marginTop:4}}>
    <div style={{width:7,height:7,borderRadius:"50%",background:color,flexShrink:0}}/>
    <span style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1.2px",color}}>{label}</span>
    {count!=null&&<span style={{fontSize:10,color:T.t4,marginLeft:"auto"}}>{count}</span>}
  </div>
);

// ── MAIN COMPONENT ───────────────────────────────────────────────
export default function GroupsTab({groups,goGroup,filt,setFilt,search,setSearch,groupedPrivates=[]}) {
  const isDealerFilt = DEALER_FILTERS.has(filt);

  const gpGroupIds = useMemo(
    () => new Set(groupedPrivates.flatMap(gp=>gp._groups.map(g=>g.id))),
    [groupedPrivates]
  );

  const enriched = useMemo(() => groups.map(g => {
    const kids = isDealerFilt ? g.children?.filter(c=>c.dealer===filt)||[] : g.children||[];
    const py1  = isDealerFilt ? kids.reduce((s,c)=>s+(c.pyQ?.["1"]||0),0) : (g.pyQ?.["1"]||0);
    const cy1  = isDealerFilt ? kids.reduce((s,c)=>s+(c.cyQ?.["1"]||0),0) : (g.cyQ?.["1"]||0);
    const gap  = py1 - cy1;
    const ret  = py1 > 0 ? cy1/py1 : 1;
    const locs = isDealerFilt ? kids.length : g.locs;
    const base = {...g, _py1:py1, _cy1:cy1, _gap:gap, _ret:ret, _locs:locs};
    const p = scorePriority(base, "1");
    return {...base, _priorityScore:p.priorityScore, _priorityBucket:p.priorityBucket,
            _rootStrength:p.rootStrength, _priorityReason:p.priorityReason};
  }), [groups, filt, isDealerFilt]);

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
    if (filt==="Urgent")          l = l.filter(g=>g._gap>2000&&g._ret<0.3);
    else if (filt==="Multi-Location") l = l.filter(g=>g.locs>=2);
    else if (filt==="Private")    l = l.filter(g=>g.locs===1&&!gpGroupIds.has(g.id));
    else if (filt==="Top 100")    l = l.filter(g=>g.tier==="Top 100"||g.tier?.startsWith("Top 100"));
    else if (filt==="DSO")        l = l.filter(g=>g.locs>=3||g.class2==="DSO"||g.class2==="EMERGING DSO");
    else if (isDealerFilt)        l = l.filter(g=>g._locs>0);
    else if (filt!=="All")        l = l.filter(g=>g.tier===filt||g.tier?.includes(filt));
    if (!isDealerFilt) l.sort((a,b) => b._priorityScore - a._priorityScore);
    return l;
  }, [enriched, filt, search, isDealerFilt, gpGroupIds]);

  const gpList = useMemo(() => {
    if (filt!=="Private" && filt!=="All") return [];
    let gps = [...groupedPrivates];
    if (search) {
      const q = search.toLowerCase();
      gps = gps.filter(gp=>gp.name.toLowerCase().includes(q)||gp.addr?.toLowerCase().includes(q)||gp.city?.toLowerCase().includes(q));
    }
    return gps.sort((a,b)=>b._gap-a._gap);
  }, [groupedPrivates, filt, search]);

  // For dealer view: split into growing vs hurting
  const dealerTop  = useMemo(() => isDealerFilt ? [...list].filter(g=>g._cy1>0&&g._ret>=0.7&&g._py1>0).sort((a,b)=>b._cy1-a._cy1) : [], [list, isDealerFilt]);
  const dealerHurt = useMemo(() => isDealerFilt ? [...list].filter(g=>g._gap>500&&g._ret<0.6).sort((a,b)=>b._gap-a._gap) : [], [list, isDealerFilt]);

  const statusLine = filt==="All"
    ? `${list.length} total · ${enriched.filter(g=>g.locs>=2).length} multi-loc · ${groupedPrivates.length} multi-dealer`
    : filt==="Multi-Location" ? `${list.length} groups · 2+ locations`
    : filt==="Private"  ? `${list.length} single-dealer · ${gpList.length} multi-dealer`
    : filt==="Urgent"   ? `${list.length} accounts need attention`
    : isDealerFilt      ? `${list.length} ${filt} accounts · ${dealerTop.length} top · ${dealerHurt.length} hurting`
    : `${list.length} groups`;

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

      {/* ── FILTER PILLS — Row 1: Status ── */}
      <div className="hide-sb" style={{display:"flex",gap:5,overflowX:"auto",padding:"0 16px 2px",marginBottom:5}}>
        {STATUS_FILTERS.map(f=>(
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

      {/* ── FILTER PILLS — Row 2: Dealer ── */}
      <div className="hide-sb" style={{display:"flex",gap:5,overflowX:"auto",padding:"0 16px 2px",marginBottom:10,alignItems:"center"}}>
        <span style={{fontSize:9,fontWeight:700,color:T.t4,textTransform:"uppercase",letterSpacing:"1px",flexShrink:0,marginRight:2}}>Rep</span>
        {DEALER_FILTER_LIST.map(f=>(
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
        {statusLine}
      </div>

      {/* ── CONTENT ── */}
      <div style={{padding:"0 16px"}}>

        {isDealerFilt ? <>
          {/* DEALER VIEW — two named sections, single column */}
          <SectionLabel label={`${filt} — Top Accounts`} color={T.green} count={dealerTop.length}/>
          {dealerTop.length===0
            ? <div style={{fontSize:11,color:T.t4,padding:"10px 14px",background:T.s1,borderRadius:12,marginBottom:12}}>No active {filt} accounts this quarter</div>
            : dealerTop.map((g,i)=><AccountCard key={g.id} g={g} i={i} goGroup={goGroup} isDealerFilt filt={filt}/>)
          }
          <div style={{marginTop:4}}/>
          <SectionLabel label={`${filt} — Hurting`} color={T.red} count={dealerHurt.length}/>
          {dealerHurt.length===0
            ? <div style={{fontSize:11,color:T.t4,padding:"10px 14px",background:T.s1,borderRadius:12}}>No significant gaps with {filt}</div>
            : dealerHurt.map((g,i)=><AccountCard key={g.id} g={g} i={i} goGroup={goGroup} isDealerFilt filt={filt}/>)
          }

        </> : <>
          {/* STANDARD VIEW — sorted by priority score */}

          {/* Multi-dealer privates (Private + All only) */}
          {gpList.length>0&&<>
            <SectionLabel label="Multi-Dealer Practices" color="#9b9bc0" count={gpList.length}/>
            {gpList.map((gp,i)=><GPCard key={gp.id} gp={gp} i={i} goGroup={goGroup}/>)}
            {list.length>0&&<div style={{borderTop:`1px solid ${T.b2}`,margin:"12px 0 12px",opacity:.5}}/>}
          </>}

          {/* Main account list */}
          {list.length===0&&!gpList.length
            ? <div style={{padding:"40px 0",textAlign:"center",color:T.t4,fontSize:12}}>No accounts match this filter.</div>
            : list.map((g,i)=><AccountCard key={g.id} g={g} i={i} goGroup={goGroup} isDealerFilt={isDealerFilt} filt={filt}/>)
          }
        </>}

      </div>
    </div>
  );
}
