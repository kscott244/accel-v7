"use client";
// @ts-nocheck
import { useState, useMemo } from "react";
import { T, DAYS_LEFT, Q1_TARGET, FY_TARGET, QUARTER_TARGETS, daysLeftInQuarter, HOME_LAT, HOME_LNG } from "@/lib/tokens";
import { normalizeTier, isAccelTier } from "@/lib/tier";
import { $$, $f, pc } from "@/lib/format";
import { Bar, Chev, AccountId, GroupBadge, fixGroupName } from "@/components/primitives";
import NewAddsSection from "@/components/tabs/NewAddsSection";
import { BADGER } from "@/lib/data";
import { buildDailyPlan, ACTION_LABEL, ACTION_COLOR } from "@/lib/dailyPlan";
import { buildNotices } from "@/lib/notices";
import NoticesPanel from "@/components/tabs/NoticesPanel";
import EstTab from "@/components/tabs/EstTab";
import EstTab from "@/components/tabs/EstTab";

// ── Bucket config ────────────────────────────────────────────────────────────
const BUCKETS = {
  hitList:   { label: "Hit List",    emoji: "🎯", color: "#f87171", bg: "rgba(248,113,113,.08)",  border: "rgba(248,113,113,.25)"  },
  easyWin:   { label: "Easy Wins",   emoji: "⚡", color: "#34d399", bg: "rgba(52,211,153,.08)",   border: "rgba(52,211,153,.25)"   },
  atRisk:    { label: "At Risk",     emoji: "🚨", color: "#fbbf24", bg: "rgba(251,191,36,.08)",   border: "rgba(251,191,36,.25)"   },
  followUp:  { label: "Follow Up",   emoji: "📋", color: "#4f8ef7", bg: "rgba(79,142,247,.08)",   border: "rgba(79,142,247,.25)"   },
  deadWeight:{ label: "Skip for Now",emoji: "⏭",  color: "#7878a0", bg: "rgba(120,120,160,.06)",  border: "rgba(120,120,160,.15)"  },
};

// ── Compact action card ───────────────────────────────────────────────────────
function ActionCard({a, bucket, done, onTap, onWin, onHalf, onLoss, onUndo, isVisit, groupLocsMap, groups, goGroup, showAddress=true}:any) {
  const bk = BUCKETS[bucket];
  return (
    <div style={{marginBottom:6}}>
      <button onClick={()=>onTap(a)} style={{
        width:"100%", textAlign:"left",
        background: done ? "rgba(52,211,153,.05)" : T.s1,
        border:`1px solid ${done ? "rgba(52,211,153,.2)" : bk.border}`,
        borderLeft:`3px solid ${done ? T.green : bk.color}`,
        borderRadius:12, padding:"10px 12px", cursor:"pointer",
        display:"flex", justifyContent:"space-between", alignItems:"center", gap:8,
      }}>
        <div style={{flex:1, minWidth:0}}>
          {/* Row 1: bucket badge + ask */}
          <div style={{display:"flex", alignItems:"center", gap:4, marginBottom:3}}>
            <span style={{fontSize:8, fontWeight:700, color:bk.color,
              background:bk.bg, borderRadius:3, padding:"1px 5px",
              textTransform:"uppercase", letterSpacing:".5px"}}>
              {bk.emoji} {bucket==="hitList" ? (isVisit ? "Visit" : "Call") : bk.label}
            </span>
            {a.ask>0 && <span style={{fontSize:8, fontWeight:700, color:T.amber,
              background:"rgba(251,191,36,.06)", borderRadius:3, padding:"1px 5px"}}>
              {$f(a.ask)}{a.prob ? ` · ${Math.round(a.prob*100)}%` : ""}
            </span>}
          </div>
          {/* Row 2: name */}
          <AccountId name={a.name} gName={a.gName} size="md"
            color={done ? T.t3 : undefined} locs={groupLocsMap?.[a.gId]}/>
          {/* Row 3: address + group badge */}
          {showAddress && !done && (a.city||a.addr) && (
            <div style={{fontSize:9, color:T.t4, marginTop:2, overflow:"hidden",
              textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
              {[a.addr, [a.city,a.st].filter(Boolean).join(" ")].filter(Boolean).join(", ")}
              {a.miles && a.miles < 100 && <span> · {Math.round(a.miles)}mi</span>}
            </div>
          )}
          {/* Row 4: signals */}
          {!done && a.signals?.length > 0 && (
            <div style={{display:"flex", flexWrap:"wrap", gap:3, marginTop:4}}>
              {a.signals.slice(0,2).map((s:string,i:number) => (
                <span key={i} style={{fontSize:8, color:T.t3,
                  background:"rgba(255,255,255,.05)", borderRadius:3,
                  padding:"1px 5px", border:"1px solid rgba(255,255,255,.08)"}}>
                  {s}
                </span>
              ))}
            </div>
          )}
          {/* Cluster trip button */}
          {!done && a.clusterCount >= 2 && onWin && (
            <div style={{marginTop:4, fontSize:9, color:T.cyan}}>
              📍 {a.clusterCount} nearby
            </div>
          )}
        </div>
        {/* Right: outcome controls */}
        <div style={{display:"flex", alignItems:"center", gap:3, flexShrink:0}}>
          {done ? (
            <>
              <span style={{fontSize:10, fontWeight:700,
                color:done.outcome==="lost" ? T.red : T.green}}>
                {done.outcome==="lost" ? "✗" : `+${$f(done.amt)}`}
              </span>
              {onUndo && <button onClick={e=>{e.stopPropagation();onUndo(a.id);}}
                style={{background:"none",border:"none",color:T.t4,cursor:"pointer",fontSize:11,padding:"0 2px"}}>↩</button>}
            </>
          ) : onWin ? (
            <>
              <button onClick={e=>onWin(e,a.id,"won",a.ask)}
                style={{background:"rgba(52,211,153,.12)",border:"1px solid rgba(52,211,153,.25)",
                  borderRadius:5,padding:"3px 7px",fontSize:9,fontWeight:700,color:T.green,cursor:"pointer",fontFamily:"inherit"}}>✓</button>
              {onHalf && <button onClick={e=>onHalf(e,a.id,"partial",a.ask*0.5)}
                style={{background:"rgba(251,191,36,.08)",border:"1px solid rgba(251,191,36,.2)",
                  borderRadius:5,padding:"3px 6px",fontSize:9,fontWeight:700,color:T.amber,cursor:"pointer",fontFamily:"inherit"}}>½</button>}
              <button onClick={e=>onLoss(e,a.id,"lost",0)}
                style={{background:"rgba(248,113,113,.08)",border:"1px solid rgba(248,113,113,.2)",
                  borderRadius:5,padding:"3px 7px",fontSize:9,fontWeight:700,color:T.red,cursor:"pointer",fontFamily:"inherit"}}>✗</button>
            </>
          ) : <Chev/>}
        </div>
      </button>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function BucketHeader({bucket, count, subtitle, open, onToggle}:any) {
  const bk = BUCKETS[bucket];
  return (
    <button onClick={onToggle} style={{
      width:"100%", display:"flex", alignItems:"center", gap:8,
      background:"none", border:"none", cursor:"pointer", fontFamily:"inherit",
      padding:"10px 0 6px", marginBottom:0,
    }}>
      <div style={{width:6,height:6,borderRadius:"50%",background:bk.color,flexShrink:0}}/>
      <span style={{fontSize:10,fontWeight:700,textTransform:"uppercase",
        letterSpacing:"1.2px",color:bk.color}}>{bk.label}</span>
      <span style={{fontSize:10,color:T.t4,marginLeft:"auto"}}>{count}</span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.t4} strokeWidth="2.5"
        style={{transform:open?"rotate(180deg)":"none",transition:"transform .15s",flexShrink:0}}>
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
function DashboardTab({scored,goAcct,q1CY,q1Gap,q1Att,adjCount,totalAdj,groups,goGroup,activeQ:activeQProp,weeklyDelta,tasks=[],onCompleteTask,onGoTasks,overlays,patchOverlay,estPct=90,setEstPct}) {
  const activeQ = activeQProp || "1";

  // ── Daily Success Plan ─────────────────────────────────────────────────────
  const dailyPlan = useMemo(() => buildDailyPlan(groups, overlays, tasks, { qk: activeQ, maxItems: 5 }),
    [groups, overlays, tasks, activeQ]);

  // ── Assistant Notices ──────────────────────────────────────────────────────
  const notices = useMemo(() => buildNotices(groups, overlays, { qk: activeQ, maxItems: 6 }),
    [groups, overlays, activeQ]);

  const dismissNotice = (id) => {
    const current = overlays?.noticeDismissals || [];
    if (current.includes(id)) return;
    if (patchOverlay) patchOverlay([{ op: "set", path: "noticeDismissals", value: [...current, id] }]);
  };

  const [search, setSearch]           = useState("");
  const [odDone, setOdDone]           = useState(() => {
    try { return JSON.parse(localStorage.getItem("overdrive_done") || "{}"); } catch { return {}; }
  });
  const [odNotePrompt, setOdNotePrompt] = useState(null);
  const [odNoteText, setOdNoteText]     = useState("");
  const [tripAnchor, setTripAnchor]     = useState(null);
  const [deltaOpen, setDeltaOpen]       = useState(true);
  const [showNewAdds, setShowNewAdds]   = useState(false);
  const [openBuckets, setOpenBuckets]   = useState({
    hitList:true, easyWin:true, atRisk:true, followUp:true, deadWeight:false,
  });
  const [showForecast, setShowForecast] = useState(false);
  const [noticesOpen, setNoticesOpen]   = useState(false);

  const [kpiScopePref, setKpiScopePref] = useState(() => {
    try { return localStorage.getItem("kpi_scope_v1") || ""; } catch { return ""; }
  });
  const kpiScope = kpiScopePref || activeQ;
  const setKpiScope = (v:string) => {
    setKpiScopePref(v);
    try { localStorage.setItem("kpi_scope_v1", v); } catch {}
  };

  const toggleBucket = (k:string) => setOpenBuckets(p => ({...p,[k]:!p[k]}));

  const saveDone = (id:string, outcome:string, amt:number, note?:string) => {
    const updated = {...odDone, [id]:{outcome,amt,...(note?{note}:{})}};
    setOdDone(updated);
    try { localStorage.setItem("overdrive_done", JSON.stringify(updated)); } catch {}
  };
  const clearDone = (id:string) => {
    const next = {...odDone}; delete next[id];
    setOdDone(next);
    try { localStorage.setItem("overdrive_done", JSON.stringify(next)); } catch {}
  };
  const promptOutcome = (e:any, id:string, outcome:string, amt:number) => {
    e.stopPropagation();
    setOdNotePrompt({id, outcome, amt});
    setOdNoteText("");
  };
  const commitOutcome = () => {
    if (!odNotePrompt) return;
    saveDone(odNotePrompt.id, odNotePrompt.outcome, odNotePrompt.amt, odNoteText.trim()||undefined);
    setOdNotePrompt(null); setOdNoteText("");
  };

  // ── KPI data ─────────────────────────────────────────────────────────────
  const kpiData = useMemo(() => {
    const isFY = kpiScope === "FY";
    const target = isFY ? FY_TARGET : (QUARTER_TARGETS?.[kpiScope] || Q1_TARGET);
    const cy     = isFY ? (scored.reduce((s:number,a:any)=>s+Object.values(a.cyQ||{}).reduce((x:number,v:any)=>x+(v||0),0),0)) : q1CY;
    const gap    = Math.max(0, target - cy);
    const att    = target > 0 ? cy / target : 0;
    const dLeft  = daysLeftInQuarter(isFY ? "4" : kpiScope);
    const perDay = dLeft > 0 ? gap / dLeft : 0;
    return { isFY, target, cy, gap, att, perDay };
  }, [kpiScope, q1CY, scored]);

  // ── Scoring engine (preserved entirely) ─────────────────────────────────
  const overdrive = useMemo(() => {
    if (!scored.length) return null;
    const dLeft = daysLeftInQuarter(activeQ);
    const isEndgame = dLeft <= 5;
    const isSprint  = dLeft <= 14;
    const modeLabel = dLeft === 0 ? "✅ Q1 Complete" : isEndgame ? "🔴 Endgame" : isSprint ? "🟡 Sprint" : dLeft > 30 ? "🟢 Pipeline" : "🟠 Push";

    const distMiles = (lat?:number, lng?:number):number => {
      if (!lat || !lng) return 999;
      const R=3958.8, dLat=(lat-HOME_LAT)*Math.PI/180, dLng=(lng-HOME_LNG)*Math.PI/180;
      const a=Math.sin(dLat/2)**2+Math.cos(HOME_LAT*Math.PI/180)*Math.cos(lat*Math.PI/180)*Math.sin(dLng/2)**2;
      return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
    };

    const scoreAccount = (a:any, track:string) => {
      const py=a.pyQ?.[activeQ]||0, cy=a.cyQ?.[activeQ]||0, gap=py-cy;
      const retPct=py>0?cy/py:0;
      const badger=BADGER[a.id]||BADGER[a.gId]||null;
      let prob=track==="uplift"?(retPct>0.7?0.78:retPct>0.4?0.62:0.48):(py>2000?0.28:py>800?0.40:0.52);
      if(isSprint||isEndgame){if(py>3000)prob+=0.15;else if(py>1500)prob+=0.10;else if(py>500)prob+=0.05;}
      if(track==="uplift"){prob+=0.08;if(isSprint||isEndgame)prob+=0.07;}
      const hasDealer=a.dealer&&a.dealer!=="All Other";
      if(hasDealer)prob+=0.04;
      if(badger){
        if(badger.doctor)prob+=0.05;if(badger.orders)prob+=0.05;if(badger.dealerRep)prob+=0.04;
        if(badger.notes)prob+=0.03;
        if(badger.feel&&parseFloat(badger.feel)>=4)prob+=0.06;
        if(badger.feel&&parseFloat(badger.feel)<=2)prob-=0.08;
        if(badger.lastVisit){const d=(Date.now()-new Date(badger.lastVisit).getTime())/86400000;
          if(d<30)prob+=0.08;else if(d<60)prob+=0.05;else if(d<90)prob+=0.02;else if(d>180)prob-=0.04;}
      }
      const products=a.products||[];
      const buying=products.filter((p:any)=>(p.cy1||0)>0).map((p:any)=>p.n?.toLowerCase()||"");
      const hasXsell=(
        (!buying.some((p:any)=>p.includes("simplishade"))&&buying.some((p:any)=>p.includes("harmonize")||p.includes("herculite")))||
        (!buying.some((p:any)=>p.includes("optibond 360"))&&buying.some((p:any)=>p.includes("optibond")))||
        (!buying.some((p:any)=>p.includes("sonicfill"))&&buying.some((p:any)=>p.includes("composite")||p.includes("herculite")))||
        (!buying.some((p:any)=>p.includes("maxcem"))&&buying.some((p:any)=>p.includes("cement")||p.includes("rely")))
      );
      if(hasXsell)prob+=0.04;
      const lat=badger?.lat||a.lat, lng2=badger?.lng||a.lng;
      const miles=distMiles(lat,lng2);
      let distScore=0;
      if(miles<20)distScore=0.08;else if(miles<40)distScore=0.05;else if(miles<60)distScore=0.02;else if(miles>100)distScore=-0.05;
      if(isEndgame&&track==="dark")prob*=0.5;if(isSprint&&track==="dark")prob*=0.75;
      prob=Math.min(Math.max(prob,0.05),0.95);
      const askPct=isEndgame?1.0:isSprint?0.85:0.70;
      const ask=track==="uplift"?Math.min(gap,Math.max(150,gap*askPct)):py*(isEndgame?0.4:isSprint?0.55:0.65);
      const visitScore=ask*Math.min(prob+distScore,0.95);
      const callScore=ask*prob;
      return {...a,gap:track==="uplift"?gap:py,ask,prob,track,visitScore,callScore,miles,hasDealer,
        hasBadger:!!badger,hasXsell,badgerFeel:badger?.feel?parseFloat(badger.feel):null,
        signals:[
          py>1500&&(isSprint||isEndgame)?"Bought in March PY":null,
          track==="uplift"?"Active buyer":"Gone dark",
          hasDealer?`Via ${a.dealer}`:null,
          badger?.orders?`Orders: ${badger.orders}`:null,
          badger?.feel&&parseFloat(badger.feel)>=4?"Strong relationship":null,
          hasXsell?"Cross-sell opp":null,
          miles<40?`${Math.round(miles)}mi away`:null,
        ].filter(Boolean),
      };
    };

    const darkMaxPY=isEndgame?800:isSprint?2000:999999;
    const upliftRaw=scored.filter((a:any)=>(a.cyQ?.[activeQ]||0)>0&&(a.pyQ?.[activeQ]||0)>(a.cyQ?.[activeQ]||0)).map((a:any)=>scoreAccount(a,"uplift"));
    const darkRaw=scored.filter((a:any)=>(a.cyQ?.[activeQ]||0)===0&&(a.pyQ?.[activeQ]||0)>500&&(a.pyQ?.[activeQ]||0)<=darkMaxPY).map((a:any)=>scoreAccount(a,"dark"));
    const allCandidates=[...new Map([...upliftRaw,...darkRaw].map((a:any)=>[a.id,a])).values()];

    const withCoords=allCandidates.filter((a:any)=>{const b=BADGER[a.id]||BADGER[a.gId];return(b?.lat&&b?.lng)||(a.lat&&a.lng);}).map((a:any)=>{const b=BADGER[a.id]||BADGER[a.gId];return{...a,_lat:b?.lat||a.lat,_lng:b?.lng||a.lng};});
    const clustered=allCandidates.map((a:any)=>{
      const b=BADGER[a.id]||BADGER[a.gId];const aLat=b?.lat||a.lat;const aLng=b?.lng||a.lng;
      const nearbyAccounts=withCoords.filter((nb:any)=>{if(nb.id===a.id)return false;const d=distMiles(aLat,aLng);const dB=distMiles(nb._lat,nb._lng);return Math.abs(d-dB)<20&&nb.ask>200;});
      const clusterCount=nearbyAccounts.length;
      const solo=a.miles<75;const clusteredVisit=a.miles<120&&clusterCount>=2;const visitEligible=solo||clusteredVisit;
      let adjVS=a.visitScore;if(!visitEligible)adjVS=0;else if(a.miles>60&&clusterCount>=2)adjVS*=1.2;
      return{...a,clusterCount,visitEligible,adjustedVisitScore:adjVS,
        nearbyAccounts:nearbyAccounts.slice(0,8),nearbyNames:nearbyAccounts.slice(0,3).map((nb:any)=>nb.name),
        signals:[...(a.signals||[]),clusterCount>=2?`${clusterCount} nearby accts`:null,!visitEligible&&a.miles>75?`${Math.round(a.miles)}mi — call instead`:null].filter(Boolean),
      };
    });

    const visitList=clustered.filter((a:any)=>a.visitEligible&&a.track==="uplift").sort((a:any,b:any)=>b.adjustedVisitScore-a.adjustedVisitScore).slice(0,5);
    const visitIds=new Set(visitList.map((a:any)=>a.id));
    const callList=clustered.filter((a:any)=>!visitIds.has(a.id)).sort((a:any,b:any)=>b.callScore-a.callScore).slice(0,8);
    const dealerGroups={};
    clustered.forEach((a:any)=>{if(a.dealer&&a.dealer!=="All Other"){dealerGroups[a.dealer]=dealerGroups[a.dealer]||[];dealerGroups[a.dealer].push(a);}});
    const dealerActions=Object.entries(dealerGroups).map(([dealer,accts])=>{const top=(accts as any[]).sort((a:any,b:any)=>b.callScore-a.callScore).slice(0,3);return{dealer,accts:top,totalAsk:top.reduce((s:number,a:any)=>s+a.ask,0)};}).sort((a,b)=>b.totalAsk-a.totalAsk).slice(0,3);
    const doneTotal=Object.values(odDone).reduce((s,v:any)=>s+(v.amt||0),0);
    const pending=clustered.filter((a:any)=>!odDone[a.id]);
    const conservative=doneTotal+pending.reduce((s:number,a:any)=>s+a.ask*Math.min(a.prob*0.65,1),0);
    const base=doneTotal+pending.reduce((s:number,a:any)=>s+a.ask*a.prob,0);
    const aggressive=doneTotal+pending.reduce((s:number,a:any)=>s+a.ask*Math.min(a.prob*1.35,1),0);
    return{visitList,callList,dealerActions,conservative,base,aggressive,doneTotal,
      totalTargets:clustered.length,modeLabel,isEndgame,isSprint,allCandidates:clustered};
  },[scored,odDone,activeQ]);

  // ── Mission buckets ──────────────────────────────────────────────────────
  const visitIds = useMemo(()=>new Set((overdrive?.visitList||[]).map((a:any)=>a.id)),[overdrive]);

  // HIT LIST: top 6 pending — visits first, then calls
  const hitList = useMemo(()=>{
    if(!overdrive)return[];
    const seen=new Set<string>(),list:any[]=[];
    for(const a of [...overdrive.visitList,...overdrive.callList,...(overdrive.allCandidates||[])]){
      if(!seen.has(a.id)&&!odDone[a.id]&&list.length<6){seen.add(a.id);list.push(a);}
    }
    return list;
  },[overdrive,odDone]);

  // EASY WINS: uplift accounts with high prob (>0.65) and gap < $1500 — quick reorders
  const easyWins = useMemo(()=>{
    if(!overdrive)return[];
    const hitIds=new Set(hitList.map((a:any)=>a.id));
    return(overdrive.allCandidates||[])
      .filter((a:any)=>!hitIds.has(a.id)&&!odDone[a.id]&&a.track==="uplift"&&a.prob>=0.65&&(a.ask||0)<1500&&(a.ask||0)>=150)
      .sort((a:any,b:any)=>b.prob-a.prob)
      .slice(0,5);
  },[overdrive,hitList,odDone]);

  // AT RISK: active accounts declining fast (cyQ > 0, ret < 55%, py > 800) — not already hit
  const atRisk = useMemo(()=>{
    const hitIds=new Set(hitList.map((a:any)=>a.id));
    const easyIds=new Set(easyWins.map((a:any)=>a.id));
    return scored
      .filter((a:any)=>{
        const cy=a.cyQ?.[activeQ]||0,py=a.pyQ?.[activeQ]||0;
        return cy>0&&py>800&&cy/py<0.55&&!hitIds.has(a.id)&&!easyIds.has(a.id)&&!odDone[a.id];
      })
      .sort((a:any,b:any)=>{
        const gapA=(a.pyQ?.[activeQ]||0)-(a.cyQ?.[activeQ]||0);
        const gapB=(b.pyQ?.[activeQ]||0)-(b.cyQ?.[activeQ]||0);
        return gapB-gapA;
      })
      .slice(0,6);
  },[scored,hitList,easyWins,activeQ,odDone]);

  // FOLLOW UP: due tasks + protect accounts (≥85% ret) that haven't been visited in 60+ days
  const followUp = useMemo(()=>{
    const todayStr=new Date().toISOString().slice(0,10);
    const dueTasks=(tasks||[]).filter((t:any)=>!t.completed&&t.dueDate<=todayStr);
    const protectAccts=scored
      .filter((a:any)=>{
        const cy=a.cyQ?.[activeQ]||0,py=a.pyQ?.[activeQ]||0;
        if(cy<py*0.85||py<500||cy<=0)return false;
        const b=BADGER[a.id]||BADGER[a.gId];
        if(!b?.lastVisit)return true; // no record = worth checking
        const days=(Date.now()-new Date(b.lastVisit).getTime())/86400000;
        return days>60;
      })
      .sort((a:any,b:any)=>(b.cyQ?.[activeQ]||0)-(a.cyQ?.[activeQ]||0))
      .slice(0,5);
    return{tasks:dueTasks,accounts:protectAccts};
  },[scored,tasks,activeQ]);

  // DEAD WEIGHT: low value, low probability — skip for now
  const deadWeight = useMemo(()=>{
    const hitIds=new Set(hitList.map((a:any)=>a.id));
    const easyIds=new Set(easyWins.map((a:any)=>a.id));
    const riskIds=new Set(atRisk.map((a:any)=>a.id));
    return scored
      .filter((a:any)=>{
        const py=a.pyQ?.[activeQ]||0,cy=a.cyQ?.[activeQ]||0;
        if(hitIds.has(a.id)||easyIds.has(a.id)||riskIds.has(a.id))return false;
        if(py<200&&cy<200)return true; // tiny account
        if(py>0&&cy>0&&cy/py>=0.85&&py<500)return true; // stable but tiny
        return false;
      })
      .sort((a:any,b:any)=>(a.pyQ?.[activeQ]||0)-(b.pyQ?.[activeQ]||0))
      .slice(0,8);
  },[scored,hitList,easyWins,atRisk,activeQ]);

  // ── Search ───────────────────────────────────────────────────────────────
  const groupLocsMap = useMemo(()=>{const m={};(groups||[]).forEach((g:any)=>{m[g.id]=g.locs||1;});return m;},[groups]);
  const q = search.trim().toLowerCase();
  const searchResults = useMemo(()=>{
    if(!q)return[];
    const matches=scored.filter((a:any)=>a.name?.toLowerCase().includes(q)||a.city?.toLowerCase().includes(q)||a.addr?.toLowerCase().includes(q)||a.gName?.toLowerCase().includes(q));
    const parentIds=new Set<string>();const childOnly:any[]=[];
    matches.forEach((a:any)=>{
      const gNameMatch=a.gName?.toLowerCase().includes(q);
      const childMatch=a.name?.toLowerCase().includes(q)||a.city?.toLowerCase().includes(q)||a.addr?.toLowerCase().includes(q);
      const pg=(groups||[]).find((g:any)=>g.id===a.gId);
      if(gNameMatch&&pg&&pg.locs>1)parentIds.add(a.gId);
      else if(childMatch)childOnly.push(a);
    });
    const results:any[]=[];
    parentIds.forEach(gId=>{const pg=(groups||[]).find((g:any)=>g.id===gId);if(pg)results.push({_isParent:true,_group:pg});});
    childOnly.forEach(a=>{if(!parentIds.has(a.gId))results.push(a);});
    return results.slice(0,30);
  },[q,scored,groups]);

  // ── KPI strip values ─────────────────────────────────────────────────────
  const {att,cy,gap,perDay,target,isFY}=kpiData;
  const ahead=att>=1.0,onTrack=!ahead&&att>=0.85;
  const statusColor=ahead?T.green:onTrack?T.amber:T.red;
  const statusLabel=ahead?(isFY?"Ahead of FY":"Ahead"):onTrack?"On Track":"Behind";

  return <div style={{padding:"0 0 80px"}}>

    {/* ── SEARCH BAR ── */}
    <div style={{position:"relative",margin:"12px 16px 10px"}}>
      <svg style={{position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",width:14,height:14,color:T.t4}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      <input type="search" value={search} onChange={e=>setSearch(e.target.value)}
        placeholder="Search offices or cities…"
        style={{width:"100%",height:40,borderRadius:10,border:`1px solid ${search?T.blue+"44":T.b1}`,background:T.s1,color:T.t1,fontSize:13,paddingLeft:34,paddingRight:search?34:12,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
      {search&&<button onClick={()=>setSearch("")} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:T.t4,cursor:"pointer",fontSize:15,lineHeight:1}}>✕</button>}
    </div>

    {/* ── SEARCH RESULTS ── */}
    {q ? <div style={{padding:"0 16px"}}>
      <div style={{fontSize:10,color:T.t4,marginBottom:8}}>{searchResults.length} result{searchResults.length!==1?"s":""} for "{search}"</div>
      {searchResults.length===0&&<div style={{padding:"24px 0",textAlign:"center",color:T.t4,fontSize:12}}>No accounts found.</div>}
      {searchResults.map((r,i)=>{
        if(r._isParent){
          const g=r._group;const gpy=g.pyQ?.[activeQ]||0;const gcy=g.cyQ?.[activeQ]||0;const ggap=gpy-gcy;
          return <button key={g.id} className="anim" onClick={()=>goGroup(g)}
            style={{animationDelay:`${i*15}ms`,width:"100%",textAlign:"left",background:T.s1,border:`1px solid rgba(34,211,238,.15)`,borderLeft:`3px solid ${T.cyan}`,borderRadius:12,padding:"11px 14px",marginBottom:8,cursor:"pointer"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:700,color:T.t1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{fixGroupName(g)}</div>
                <div style={{fontSize:9,color:T.t3}}>{g.locs} locations{isAccelTier(g.tier)&&<span style={{color:T.amber}}> · {normalizeTier(g.tier)}</span>}</div>
              </div>
              <div style={{textAlign:"right",flexShrink:0,marginLeft:12}}>
                <div className="m" style={{fontSize:12,fontWeight:700,color:ggap>0?T.red:T.green}}>{ggap>0?`-${$$(ggap)}`:`+${$$(-ggap)}`}</div>
                <div style={{fontSize:9,color:T.t4}}>{Math.round(gpy>0?gcy/gpy*100:0)}% ret</div>
              </div>
              <Chev/>
            </div>
          </button>;
        }
        const a=r;const py=a.pyQ?.[activeQ]||0;const cy=a.cyQ?.[activeQ]||0;const gap=py-cy;
        return <button key={a.id} className="anim" onClick={()=>goAcct(a)}
          style={{animationDelay:`${i*15}ms`,width:"100%",textAlign:"left",background:T.s1,border:`1px solid ${T.b1}`,borderRadius:12,padding:"11px 14px",marginBottom:8,cursor:"pointer"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{flex:1,minWidth:0}}>
              <AccountId name={a.name} gName={a.gName} size="md" locs={groupLocsMap[a.gId]}/>
              <div style={{fontSize:9,color:T.t3}}>{[a.city,a.st].filter(Boolean).join(", ")}{isAccelTier(a.gTier||a.tier)&&<span style={{color:T.amber}}> · {normalizeTier(a.gTier||a.tier)}</span>}</div>
            </div>
            <div style={{textAlign:"right",flexShrink:0,marginLeft:12}}>
              <div className="m" style={{fontSize:12,fontWeight:700,color:gap>0?T.red:T.green}}>{gap>0?`-${$$(gap)}`:`+${$$(-gap)}`}</div>
              <div style={{fontSize:9,color:T.t4}}>{Math.round(py>0?cy/py*100:0)}% ret</div>
            </div>
            <Chev/>
          </div>
        </button>;
      })}
    </div> :

      {/* ── KPI STRIP ── */}
      <div className="anim" style={{background:`linear-gradient(135deg,${T.s1},rgba(79,142,247,.04))`,border:`1px solid ${T.b1}`,borderRadius:14,padding:"12px 14px",marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"1.2px",color:T.t3}}>
              {isFY?"Full Year":`Q${kpiScope} Pace`}
            </span>
            {adjCount>0&&<span style={{fontSize:8,color:T.green,background:"rgba(52,211,153,.08)",borderRadius:3,padding:"1px 5px"}}>+{adjCount} adj</span>}
          </div>
          <div style={{display:"flex",gap:4,alignItems:"center"}}>
            {[activeQ,"FY"].map(s=>(
              <button key={s} onClick={()=>setKpiScope(s)} style={{
                padding:"3px 9px",borderRadius:6,fontSize:9,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
                border:`1px solid ${kpiScope===s?"rgba(79,142,247,.4)":T.b2}`,
                background:kpiScope===s?"rgba(79,142,247,.18)":T.s2,
                color:kpiScope===s?T.blue:T.t3}}>
                {s==="FY"?"FY":`Q${s}`}
              </button>
            ))}
            <button onClick={()=>setShowForecast(p=>!p)} style={{
              padding:"3px 9px",borderRadius:6,fontSize:9,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
              border:`1px solid ${showForecast?"rgba(251,191,36,.4)":T.b2}`,
              background:showForecast?"rgba(251,191,36,.15)":T.s2,
              color:showForecast?T.amber:T.t3}}>
              Forecast
            </button>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"baseline",gap:10,marginBottom:6}}>
          <span className="m" style={{fontSize:28,fontWeight:800,color:statusColor}}>{pc(att)}</span>
          <span style={{fontSize:11,color:T.t3}}>{$$(cy)} / {$$(target)}</span>
          <span style={{fontSize:9,fontWeight:700,color:statusColor,borderRadius:999,padding:"2px 8px",
            background:ahead?"rgba(52,211,153,.1)":onTrack?"rgba(251,191,36,.1)":"rgba(248,113,113,.1)",
            border:`1px solid ${statusColor}44`,marginLeft:"auto"}}>{statusLabel}</span>
        </div>
        <Bar pct={att*100} color={`linear-gradient(90deg,${statusColor},${ahead?T.cyan:onTrack?T.orange:T.red})`}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginTop:8}}>
          <div style={{borderRadius:7,background:"rgba(248,113,113,.06)",border:"1px solid rgba(248,113,113,.12)",padding:"7px 8px"}}>
            <div style={{fontSize:8,color:T.t3}}>Gap</div>
            <div className="m" style={{fontSize:13,fontWeight:700,color:gap<=0?T.green:T.red}}>{gap<=0?`+${$$(-gap)}`:$$(gap)}</div>
          </div>
          <div style={{borderRadius:7,background:"rgba(79,142,247,.06)",border:"1px solid rgba(79,142,247,.12)",padding:"7px 8px"}}>
            <div style={{fontSize:8,color:T.t3}}>$/day</div>
            <div className="m" style={{fontSize:13,fontWeight:700,color:T.blue}}>{$f(perDay)}</div>
          </div>
          {overdrive&&<div style={{borderRadius:7,background:"rgba(167,139,250,.06)",border:"1px solid rgba(167,139,250,.12)",padding:"7px 8px"}}>
            <div style={{fontSize:8,color:T.t3}}>Pipeline</div>
            <div className="m" style={{fontSize:13,fontWeight:700,color:T.purple}}>{$f(overdrive.base)}</div>
          </div>}
        </div>
        {overdrive?.modeLabel&&<div style={{marginTop:6,fontSize:9,color:T.t4,textAlign:"center"}}>{overdrive.modeLabel}{DAYS_LEFT>0?` · ${DAYS_LEFT}d left`:""}</div>}
        {overdrive?.doneTotal>0&&<div style={{marginTop:6,padding:"4px 8px",borderRadius:6,background:"rgba(52,211,153,.06)",border:"1px solid rgba(52,211,153,.12)",fontSize:9,color:T.green,display:"flex",justifyContent:"space-between"}}>
          <span>Logged today</span><span className="m" style={{fontWeight:700}}>+{$f(overdrive.doneTotal)}</span>
        </div>}
      </div>

      {/* ── FORECAST (inline) ── */}
      {showForecast&&<div style={{marginBottom:10}}>
        <EstTab pct={estPct} setPct={setEstPct} q1CY={q1CY} groups={groups} goAcct={goAcct}/>
      </div>}

      {/* ── NOTICES BADGE ── */}
      {notices.length>0&&<button onClick={()=>setNoticesOpen(p=>!p)} className="anim" style={{
        width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",
        background:noticesOpen?"rgba(248,113,113,.06)":T.s1,
        border:`1px solid ${noticesOpen?"rgba(248,113,113,.2)":T.b1}`,
        borderRadius:10,padding:"9px 12px",marginBottom:noticesOpen?6:10,cursor:"pointer",fontFamily:"inherit"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:14}}>🔔</span>
          <div style={{textAlign:"left"}}>
            <div style={{fontSize:11,fontWeight:700,color:T.t1}}>
              {notices.filter(n=>n.severity==="high").length>0
                ? <span style={{color:T.red}}>{notices.filter(n=>n.severity==="high").length} urgent</span>
                : <span style={{color:T.amber}}>{notices.length} notice{notices.length!==1?"s":""}</span>}
              {notices.filter(n=>n.severity!=="high").length>0&&notices.filter(n=>n.severity==="high").length>0&&
                <span style={{color:T.t3,fontWeight:400}}> · {notices.filter(n=>n.severity!=="high").length} more</span>}
            </div>
            <div style={{fontSize:9,color:T.t4}}>Accounts needing attention</div>
          </div>
        </div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{transform:noticesOpen?"rotate(90deg)":"none",transition:"transform .2s"}}><path d="M9 18l6-6-6-6"/></svg>
      </button>}
      {noticesOpen&&<div style={{marginBottom:10}}>
        <NoticesPanel notices={notices} onDismiss={dismissNotice}
          onOpen={(groupId) => { const g=(groups||[]).find((gr)=>gr.id===groupId); if(g)goGroup(g); }}/>
      </div>}

      {/* ── DAILY SUCCESS PLAN ── */}
      {dailyPlan.length > 0 && (
        <div style={{padding:"12px 16px 0"}}>
          <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:"#4f8ef7",marginBottom:8}}>
            Today's Plan
          </div>
          {dailyPlan.map((item, i) => {
            const ac = ACTION_COLOR[item.actionType];
            const al = ACTION_LABEL[item.actionType];
            return (
              <div key={item.groupId} className="anim" style={{
                animationDelay:`${i*30}ms`,
                background:"rgba(10,10,15,.95)",
                border:`1px solid ${ac}30`,
                borderLeft:`3px solid ${ac}`,
                borderRadius:12, padding:"10px 13px", marginBottom:7,
              }}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:5}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:3,flexWrap:"wrap"}}>
                      <span style={{fontSize:9,fontWeight:700,color:ac,background:`${ac}18`,borderRadius:4,padding:"1px 7px",border:`1px solid ${ac}30`}}>
                        {al}
                      </span>
                      {item.signals.map((s:string,j:number) => (
                        <span key={j} style={{fontSize:8,color:"#7878a0",background:"rgba(255,255,255,.04)",borderRadius:3,padding:"1px 5px"}}>
                          {s}
                        </span>
                      ))}
                    </div>
                    <div style={{fontSize:13,fontWeight:700,color:"#e2e2ea",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {item.groupName}
                    </div>
                    <div style={{fontSize:10,color:"#9090a8",marginTop:2,lineHeight:1.4}}>
                      {item.why}
                    </div>
                    {item.contactName && (
                      <div style={{display:"flex",alignItems:"center",gap:6,marginTop:4,flexWrap:"wrap"}}>
                        <span style={{fontSize:9,color:item.pathColor}}>{item.pathLabel}</span>
                        <span style={{fontSize:10,fontWeight:600,color:"#c0c0d8"}}>{item.contactName}</span>
                        {item.contactPhone && (
                          <a href={`tel:${item.contactPhone.replace(/\D/g,"")}`}
                            style={{fontSize:9,color:"#22d3ee",textDecoration:"none"}}>
                            {item.contactPhone}
                          </a>
                        )}
                      </div>
                    )}
                    {!item.contactName && (
                      <div style={{fontSize:9,color:item.pathColor,marginTop:4}}>{item.pathLabel}</div>
                    )}
                  </div>
                  {/* Go button */}
                  <button onClick={() => { const g = (groups||[]).find((gr:any) => gr.id === item.groupId); if(g) goGroup(g); }}
                    style={{flexShrink:0,marginLeft:10,padding:"5px 10px",borderRadius:8,fontSize:10,fontWeight:700,
                      background:`${ac}15`,border:`1px solid ${ac}30`,color:ac,cursor:"pointer",fontFamily:"inherit"}}>
                    Go →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── NEW ADDS BANNER ── */}
      <button onClick={()=>setShowNewAdds(!showNewAdds)} className="anim" style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",background:showNewAdds?"rgba(248,113,113,.06)":T.s1,border:`1px solid ${showNewAdds?"rgba(248,113,113,.2)":T.b1}`,borderRadius:10,padding:"9px 12px",marginBottom:10,cursor:"pointer",fontFamily:"inherit"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:14}}>🆕</span>
          <div>
            <div style={{fontSize:11,fontWeight:700,color:T.t1}}>New Adds · Q1</div>
            <div style={{fontSize:9,color:T.t3}}>First-time product purchases · follow up within 90 days</div>
          </div>
        </div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{transform:showNewAdds?"rotate(90deg)":"none",transition:"transform .2s"}}><path d="M9 18l6-6-6-6"/></svg>
      </button>
      {showNewAdds&&<div style={{marginBottom:12}}><NewAddsSection groups={groups} goAcct={goAcct} goGroup={goGroup}/></div>}

      {/* ── WEEKLY DELTA ── */}
      {weeklyDelta&&(weeklyDelta.reactivated.length>0||weeklyDelta.wentDark.length>0||weeklyDelta.bigMovers.length>0)&&(()=>{
        const{reactivated,wentDark,bigMovers,snapshotAge}=weeklyDelta;
        return <div className="anim" style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:12,marginBottom:12,overflow:"hidden"}}>
          <button onClick={()=>setDeltaOpen(!deltaOpen)} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit"}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:10,fontWeight:700,color:T.t1}}>What changed</span>
              <span style={{fontSize:9,color:T.t4}}>vs {snapshotAge}</span>
              {reactivated.length>0&&<span style={{fontSize:8,fontWeight:700,color:T.green,background:"rgba(52,211,153,.1)",borderRadius:3,padding:"1px 5px"}}>+{reactivated.length}</span>}
              {wentDark.length>0&&<span style={{fontSize:8,fontWeight:700,color:T.red,background:"rgba(248,113,113,.1)",borderRadius:3,padding:"1px 5px"}}>{wentDark.length} dark</span>}
            </div>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.t4} strokeWidth="2" style={{transform:deltaOpen?"rotate(180deg)":"none",transition:"transform .2s"}}><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          {deltaOpen&&<div style={{padding:"0 14px 12px"}}>
            {reactivated.length>0&&<><div style={{fontSize:8,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.green,marginBottom:5}}>Back from $0</div>
              {reactivated.map((item:any)=>(
                <button key={item.id} onClick={()=>goAcct(scored.find((a:any)=>a.id===item.id)||item)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",width:"100%",padding:"6px 0",background:"none",border:"none",borderBottom:`1px solid ${T.b2}`,cursor:"pointer",fontFamily:"inherit"}}>
                  <div style={{textAlign:"left"}}><div style={{fontSize:11,fontWeight:600,color:T.t1}}>{item.name}</div><div style={{fontSize:9,color:T.t4}}>{item.city}, {item.st}</div></div>
                  <div className="m" style={{fontSize:11,fontWeight:700,color:T.green}}>+{$$(item.currCY)}</div>
                </button>
              ))}<div style={{marginBottom:8}}/></>}
            {wentDark.length>0&&<><div style={{fontSize:8,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.red,marginBottom:5}}>Went dark</div>
              {wentDark.map((item:any)=>(
                <button key={item.id} onClick={()=>goAcct(scored.find((a:any)=>a.id===item.id)||item)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",width:"100%",padding:"6px 0",background:"none",border:"none",borderBottom:`1px solid ${T.b2}`,cursor:"pointer",fontFamily:"inherit"}}>
                  <div style={{textAlign:"left"}}><div style={{fontSize:11,fontWeight:600,color:T.t1}}>{item.name}</div><div style={{fontSize:9,color:T.t4}}>{item.city}, {item.st}</div></div>
                  <div className="m" style={{fontSize:11,fontWeight:700,color:T.red}}>-{$$(item.prevCY)}</div>
                </button>
              ))}</>}
          </div>}
        </div>;
      })()}

      {/* ── MISSION BUCKETS ── */}

      {/* HIT LIST */}
      {hitList.length>0&&<>
        <BucketHeader bucket="hitList" count={`${hitList.filter((a:any)=>!odDone[a.id]).length} pending`} open={openBuckets.hitList} onToggle={()=>toggleBucket("hitList")}/>
        {openBuckets.hitList&&hitList.map((a:any)=>(
          <ActionCard key={a.id} a={a} bucket="hitList" done={odDone[a.id]} isVisit={visitIds.has(a.id)}
            onTap={goAcct} groupLocsMap={groupLocsMap} groups={groups} goGroup={goGroup}
            onWin={promptOutcome} onHalf={promptOutcome} onLoss={promptOutcome} onUndo={clearDone}/>
        ))}
        <div style={{marginBottom:8}}/>
      </>}

      {/* EASY WINS */}
      {easyWins.length>0&&<>
        <BucketHeader bucket="easyWin" count={`${easyWins.length}`} open={openBuckets.easyWin} onToggle={()=>toggleBucket("easyWin")}/>
        {openBuckets.easyWin&&easyWins.map((a:any)=>(
          <ActionCard key={a.id} a={a} bucket="easyWin" done={odDone[a.id]}
            onTap={goAcct} groupLocsMap={groupLocsMap} groups={groups} goGroup={goGroup}
            onWin={promptOutcome} onHalf={promptOutcome} onLoss={promptOutcome} onUndo={clearDone}/>
        ))}
        <div style={{marginBottom:8}}/>
      </>}

      {/* AT RISK */}
      {atRisk.length>0&&<>
        <BucketHeader bucket="atRisk" count={`${atRisk.length}`} open={openBuckets.atRisk} onToggle={()=>toggleBucket("atRisk")}/>
        {openBuckets.atRisk&&<div style={{background:T.s1,border:`1px solid ${BUCKETS.atRisk.border}`,borderRadius:12,overflow:"hidden",marginBottom:0}}>
          {atRisk.map((a:any,i:number)=>{
            const py=a.pyQ?.[activeQ]||0,cy=a.cyQ?.[activeQ]||0,gap=py-cy;
            const isLast=i===atRisk.length-1;
            return <button key={a.id} className="anim" onClick={()=>goAcct(a)}
              style={{animationDelay:`${i*15}ms`,width:"100%",textAlign:"left",background:"transparent",
                border:"none",borderBottom:isLast?"none":`1px solid ${T.b2}`,
                borderLeft:`3px solid ${BUCKETS.atRisk.color}`,
                padding:"9px 12px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{flex:1,minWidth:0}}>
                <AccountId name={a.name} gName={a.gName} size="sm" locs={groupLocsMap[a.gId]}/>
                <div style={{fontSize:9,color:T.t4,marginTop:1}}>{[a.city,a.st].filter(Boolean).join(", ")} · <span style={{color:BUCKETS.atRisk.color}}>{$$(gap)} gap · {Math.round(cy/py*100)}% ret</span></div>
              </div>
              <Chev/>
            </button>;
          })}
        </div>}
        <div style={{marginBottom:8}}/>
      </>}

      {/* FOLLOW UP */}
      {(followUp.tasks.length>0||followUp.accounts.length>0)&&<>
        <BucketHeader bucket="followUp" count={`${followUp.tasks.length+followUp.accounts.length}`} open={openBuckets.followUp} onToggle={()=>toggleBucket("followUp")}/>
        {openBuckets.followUp&&<div style={{background:T.s1,border:`1px solid ${BUCKETS.followUp.border}`,borderRadius:12,overflow:"hidden"}}>
          {followUp.tasks.map((t:any,i:number)=>{
            const isLast=i===followUp.tasks.length-1&&followUp.accounts.length===0;
            const overdue=t.dueDate<new Date().toISOString().slice(0,10);
            return <div key={t.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderBottom:isLast?"none":`1px solid ${T.b2}`,borderLeft:`3px solid ${BUCKETS.followUp.color}`}}>
              <button onClick={()=>onCompleteTask&&onCompleteTask(t.id)} style={{width:16,height:16,borderRadius:4,border:`2px solid ${T.b2}`,background:"none",cursor:"pointer",flexShrink:0}}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:11,fontWeight:600,color:T.t1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.action}</div>
                {(t.accountName||t.groupName)&&<div style={{fontSize:9,color:T.cyan}}>{t.accountName||t.groupName}</div>}
              </div>
              <span style={{fontSize:9,fontWeight:700,color:overdue?T.red:T.amber,flexShrink:0}}>{overdue?"Overdue":"Today"}</span>
            </div>;
          })}
          {followUp.accounts.map((a:any,i:number)=>{
            const isLast=i===followUp.accounts.length-1;
            const cy=a.cyQ?.[activeQ]||0,py=a.pyQ?.[activeQ]||0;
            return <button key={a.id} className="anim" onClick={()=>goAcct(a)}
              style={{width:"100%",textAlign:"left",background:"transparent",border:"none",
                borderBottom:isLast?"none":`1px solid ${T.b2}`,
                borderLeft:`3px solid ${BUCKETS.followUp.color}`,
                padding:"9px 12px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{flex:1,minWidth:0}}>
                <AccountId name={a.name} gName={a.gName} size="sm" locs={groupLocsMap[a.gId]}/>
                <div style={{fontSize:9,color:T.t4,marginTop:1}}>{[a.city,a.st].filter(Boolean).join(", ")} · <span style={{color:T.green}}>{$$(cy)} CY · {Math.round(py>0?cy/py*100:100)}% ret</span></div>
              </div>
              <Chev/>
            </button>;
          })}
        </div>}
        <div style={{marginBottom:8}}/>
      </>}

      {/* DEAD WEIGHT */}
      {deadWeight.length>0&&<>
        <BucketHeader bucket="deadWeight" count={`${deadWeight.length}`} open={openBuckets.deadWeight} onToggle={()=>toggleBucket("deadWeight")}/>
        {openBuckets.deadWeight&&<div style={{background:T.s1,border:`1px solid ${BUCKETS.deadWeight.border}`,borderRadius:12,overflow:"hidden"}}>
          {deadWeight.map((a:any,i:number)=>{
            const py=a.pyQ?.[activeQ]||0,cy=a.cyQ?.[activeQ]||0;
            const isLast=i===deadWeight.length-1;
            return <button key={a.id} className="anim" onClick={()=>goAcct(a)}
              style={{width:"100%",textAlign:"left",background:"transparent",border:"none",
                borderBottom:isLast?"none":`1px solid ${T.b2}`,
                borderLeft:`3px solid ${BUCKETS.deadWeight.color}`,
                padding:"8px 12px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:11,color:T.t3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.name}</div>
                <div style={{fontSize:9,color:T.t4}}>{[a.city,a.st].filter(Boolean).join(", ")} · PY {$$(py)}</div>
              </div>
              <Chev/>
            </button>;
          })}
        </div>}
        <div style={{marginBottom:8}}/>
      </>}

      {scored.length===0&&<div style={{padding:"40px 0",textAlign:"center",color:T.t4,fontSize:12}}>Upload a CSV to get started.</div>}

    </div>}

    {/* ── TRIP PLANNER MODAL ── */}
    {tripAnchor&&(()=>{
      const anchor=tripAnchor;const nearby=anchor.nearbyAccounts||[];const allStops=[anchor,...nearby];
      const totalAsk=allStops.reduce((s:number,a:any)=>s+(a.ask||0),0);
      const totalExp=allStops.reduce((s:number,a:any)=>s+(a.ask||0)*(a.prob||0),0);
      const buildRoute=()=>{
        const stops=allStops.map((a:any)=>{const b=BADGER[a.id]||BADGER[a.gId];return b?.address||a.addr||`${a.name}, ${a.city}, ${a.st}`;});
        const origin=encodeURIComponent("Thomaston, CT");const dest=encodeURIComponent(stops[stops.length-1]);
        const wp=stops.slice(0,-1).map((s:string)=>encodeURIComponent(s)).join("|");
        window.open(`https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}${wp?`&waypoints=${wp}`:""}&travelmode=driving`,"_blank");
      };
      return <div style={{position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,.75)",backdropFilter:"blur(8px)",display:"flex",flexDirection:"column",justifyContent:"flex-end"}} onClick={()=>setTripAnchor(null)}>
        <div style={{background:T.s1,borderRadius:"20px 20px 0 0",padding:20,maxHeight:"80vh",display:"flex",flexDirection:"column"}} onClick={e=>e.stopPropagation()}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
            <div><div style={{fontSize:13,fontWeight:700}}>Trip Plan</div><div style={{fontSize:10,color:T.t3}}>{allStops.length} stops · {$f(totalAsk)} ask · {$f(totalExp)} expected</div></div>
            <button onClick={()=>setTripAnchor(null)} style={{background:"none",border:"none",color:T.t4,cursor:"pointer",fontSize:18}}>✕</button>
          </div>
          <button onClick={buildRoute} style={{width:"100%",background:`linear-gradient(90deg,${T.blue},${T.cyan})`,border:"none",borderRadius:10,padding:"10px 0",fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer",fontFamily:"inherit",marginBottom:14,marginTop:8}}>🗺 Open Route in Maps</button>
          <div style={{overflowY:"auto",flex:1}}>
            {allStops.map((a:any,i:number)=>{
              const done=odDone[a.id];const isAnchor=i===0;
              return <div key={a.id} style={{background:isAnchor?"rgba(251,191,36,.06)":T.s2,border:`1px solid ${isAnchor?"rgba(251,191,36,.25)":T.b1}`,borderRadius:12,padding:"10px 12px",marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                      <span style={{fontSize:8,fontWeight:700,color:isAnchor?T.amber:T.t4,background:isAnchor?"rgba(251,191,36,.1)":T.s1,borderRadius:3,padding:"1px 5px"}}>{isAnchor?"ANCHOR":`STOP ${i+1}`}</span>
                      {done&&<span style={{fontSize:8,fontWeight:700,color:done.outcome==="lost"?T.red:T.green}}>{done.outcome==="lost"?"✗":"✓"}</span>}
                    </div>
                    <AccountId name={a.name} gName={a.gName} size="md" locs={groupLocsMap[a.gId]}/>
                    <div style={{fontSize:10,color:T.t3,marginTop:1}}>{[a.addr,[a.city,a.st].filter(Boolean).join(" ")].filter(Boolean).join(", ")} · {Math.round(a.miles||0)}mi</div>
                    <div style={{fontSize:10,color:T.t3}}>Ask <span style={{color:T.amber,fontWeight:600}}>{$f(a.ask)}</span> · {Math.round((a.prob||0)*100)}%</div>
                  </div>
                  <div style={{display:"flex",gap:3,flexShrink:0,marginLeft:8}}>
                    {done?<button onClick={()=>clearDone(a.id)} style={{background:"none",border:"none",color:T.t4,cursor:"pointer",fontSize:12}}>↩</button>:<>
                      <button onClick={e=>promptOutcome(e,a.id,"won",a.ask)} style={{background:"rgba(52,211,153,.12)",border:"1px solid rgba(52,211,153,.25)",borderRadius:5,padding:"3px 7px",fontSize:9,fontWeight:700,color:T.green,cursor:"pointer",fontFamily:"inherit"}}>✓</button>
                      <button onClick={e=>promptOutcome(e,a.id,"partial",a.ask*0.5)} style={{background:"rgba(251,191,36,.08)",border:"1px solid rgba(251,191,36,.2)",borderRadius:5,padding:"3px 7px",fontSize:9,fontWeight:700,color:T.amber,cursor:"pointer",fontFamily:"inherit"}}>½</button>
                      <button onClick={e=>promptOutcome(e,a.id,"lost",0)} style={{background:"rgba(248,113,113,.08)",border:"1px solid rgba(248,113,113,.2)",borderRadius:5,padding:"3px 7px",fontSize:9,fontWeight:700,color:T.red,cursor:"pointer",fontFamily:"inherit"}}>✗</button>
                    </>}
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
          <span style={{fontSize:10,color:T.t4,fontWeight:600}}>{odNotePrompt.outcome!=="lost"?`+${$f(odNotePrompt.amt)}`:""}</span>
        </div>
        <div style={{fontSize:11,color:T.t3,marginBottom:10}}>Optional · tap outside or press Enter to skip</div>
        <input autoFocus type="text" value={odNoteText} onChange={e=>setOdNoteText(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&commitOutcome()}
          placeholder={odNotePrompt.outcome==="won"?"e.g. Dr. committed to SonicFill trial":odNotePrompt.outcome==="partial"?"e.g. Ordered MaxCem, passed on composites":"e.g. On contract through Q3"}
          style={{width:"100%",height:44,borderRadius:10,border:`1px solid ${T.b1}`,background:T.s2,color:T.t1,fontSize:13,padding:"0 12px",outline:"none",fontFamily:"inherit",marginBottom:12,boxSizing:"border-box"}}/>
        <button onClick={commitOutcome} style={{width:"100%",background:odNotePrompt.outcome==="won"?`linear-gradient(90deg,${T.green},${T.cyan})`:odNotePrompt.outcome==="partial"?`linear-gradient(90deg,${T.amber},rgba(251,191,36,.7))`:`linear-gradient(90deg,${T.red},rgba(248,113,113,.7))`,border:"none",borderRadius:10,padding:"11px 0",fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer",fontFamily:"inherit"}}>
          {odNoteText.trim()?"Save Note & Log →":"Log Without Note →"}
        </button>
      </div>
    </div>}

  </div>;
}

export default DashboardTab;
