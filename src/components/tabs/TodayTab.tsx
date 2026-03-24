"use client";
// @ts-nocheck
import { useState, useMemo } from "react";
import { T, Q1_TARGET, FY_TARGET, DAYS_LEFT, QUARTER_TARGETS, daysLeftInQuarter, HOME_LAT, HOME_LNG } from "@/lib/tokens";
import { normalizeTier, isAccelTier } from "@/lib/tier";
import { $$, $f, pc } from "@/lib/format";
import { Bar, Chev, AccountId } from "@/components/primitives";
import { BADGER } from "@/lib/data";
import { scorePriority, BUCKET_STYLE } from "@/lib/priority";

function DashboardTab({scored,goAcct,q1CY,q1Gap,q1Att,adjCount,totalAdj,groups,goGroup,activeQ:activeQProp,weeklyDelta}) {
  const [search, setSearch] = useState("");
  const [odDone, setOdDone] = useState<Record<string,{outcome:string,amt:number,note?:string}>>(() => {
    try { return JSON.parse(localStorage.getItem("overdrive_done") || "{}"); } catch { return {}; }
  });
  const [odNotePrompt, setOdNotePrompt] = useState<{id:string,outcome:string,amt:number}|null>(null);
  const [odNoteText, setOdNoteText] = useState("");
  const [tripAnchor, setTripAnchor] = useState<any>(null);
  const [deltaOpenState, setDeltaOpenState] = useState(true);

  const saveDone = (id: string, outcome: string, amt: number, note?: string) => {
    const updated = {...odDone, [id]: {outcome, amt, ...(note ? {note} : {})}};
    setOdDone(updated);
    try { localStorage.setItem("overdrive_done", JSON.stringify(updated)); } catch {}
  };
  const promptOutcome = (e: React.MouseEvent, id: string, outcome: string, amt: number) => {
    e.stopPropagation();
    setOdNotePrompt({id, outcome, amt});
    setOdNoteText("");
  };
  const commitOutcome = () => {
    if (!odNotePrompt) return;
    saveDone(odNotePrompt.id, odNotePrompt.outcome, odNotePrompt.amt, odNoteText.trim() || undefined);
    setOdNotePrompt(null);
    setOdNoteText("");
  };
  const clearDone = (id: string) => {
    const updated = {...odDone};
    delete updated[id];
    setOdDone(updated);
    try { localStorage.setItem("overdrive_done", JSON.stringify(updated)); } catch {}
  };

  // ── Active quarter — comes from parent (AccelerateApp), falls back to "1" ──
  const activeQ = activeQProp || "1";

  // ── KPI scope: 2-button [Qn] / [FY] — auto-defaults to activeQ ──
  const [kpiScopePref, setKpiScopePref] = useState<string>(() => {
    try { return localStorage.getItem("cmd_kpi_scope") || ""; } catch { return ""; }
  });
  const kpiScope = kpiScopePref || activeQ;
  const setKpiScope = (s: string) => {
    setKpiScopePref(s);
    try { localStorage.setItem("cmd_kpi_scope", s); } catch {}
  };

  // ── KPI data ──
  const kpiData = useMemo(() => {
    if (kpiScope === "FY") {
      const qs = ["1","2","3","4"];
      const cy = (groups||[]).reduce((s:number,g:any) => s + qs.reduce((t,q) => t+(g.cyQ?.[q]||0),0), 0);
      const py = (groups||[]).reduce((s:number,g:any) => s + qs.reduce((t,q) => t+(g.pyQ?.[q]||0),0), 0);
      const att = FY_TARGET > 0 ? cy / FY_TARGET : 0;
      const gap = Math.max(0, FY_TARGET - cy);
      return { cy, py, target: FY_TARGET, att, gap, perDay: 0, isFY: true };
    }
    if (kpiScope === activeQ) {
      const py = (groups||[]).reduce((s:number,g:any)=>s+(g.pyQ?.[activeQ]||0),0);
      const target = QUARTER_TARGETS[activeQ] || Q1_TARGET;
      const dLeft = daysLeftInQuarter(activeQ);
      return { cy: q1CY, py, target, att: q1Att, gap: Math.max(0, q1Gap),
               perDay: dLeft > 0 && q1Gap > 0 ? q1Gap / dLeft : 0, isFY: false };
    }
    const cy = (groups||[]).reduce((s:number,g:any)=>s+(g.cyQ?.[kpiScope]||0),0);
    const py = (groups||[]).reduce((s:number,g:any)=>s+(g.pyQ?.[kpiScope]||0),0);
    const att = py > 0 ? cy / py : 0;
    const gap = Math.max(0, py - cy);
    return { cy, py, target: py, att, gap, perDay: daysLeftInQuarter(kpiScope) > 0 && gap > 0 ? gap / daysLeftInQuarter(kpiScope) : 0, isFY: false };
  }, [kpiScope, groups, q1CY, q1Gap, q1Att, activeQ]);

  // ── OVERDRIVE ENGINE ──
  const overdrive = useMemo(() => {
    if (!scored.length) return null;

    const dLeft = daysLeftInQuarter(activeQ);
    const isEndgame = dLeft <= 5;
    const isSprint  = dLeft <= 14;
    const isCruise  = dLeft > 30;
    const modeLabel = isEndgame ? "🔴 Endgame" : isSprint ? "🟡 Sprint" : isCruise ? "🟢 Pipeline" : "🟠 Push";

    const distMiles = (lat?: number, lng?: number): number => {
      if (!lat || !lng) return 999;
      const R = 3958.8;
      const dLat = (lat - HOME_LAT) * Math.PI / 180;
      const dLng = (lng - HOME_LNG) * Math.PI / 180;
      const a = Math.sin(dLat/2)**2 + Math.cos(HOME_LAT * Math.PI/180) * Math.cos(lat * Math.PI/180) * Math.sin(dLng/2)**2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    };

    const scoreAccount = (a: any, track: string) => {
      const py = a.pyQ?.[activeQ] || 0;
      const cy = a.cyQ?.[activeQ] || 0;
      const gap = py - cy;
      const retPct = py > 0 ? cy / py : 0;
      const badger = BADGER[a.id] || BADGER[a.gId] || null;

      let prob = track === "uplift"
        ? (retPct > 0.7 ? 0.78 : retPct > 0.4 ? 0.62 : 0.48)
        : (py > 2000 ? 0.28 : py > 800 ? 0.40 : 0.52);

      if (isSprint || isEndgame) {
        if (py > 3000) prob += 0.15;
        else if (py > 1500) prob += 0.10;
        else if (py > 500) prob += 0.05;
      }
      if (track === "uplift") {
        prob += 0.08;
        if (isSprint || isEndgame) prob += 0.07;
      }
      const hasDealer = a.dealer && a.dealer !== "All Other";
      if (hasDealer) prob += 0.04;
      if (badger) {
        if (badger.doctor) prob += 0.05;
        if (badger.orders) prob += 0.05;
        if (badger.dealerRep) prob += 0.04;
        if (badger.notes) prob += 0.03;
        if (badger.feel && parseFloat(badger.feel) >= 4) prob += 0.06;
        if (badger.feel && parseFloat(badger.feel) <= 2) prob -= 0.08;
        if (badger.lastVisit) {
          const daysSince = (Date.now() - new Date(badger.lastVisit).getTime()) / 86400000;
          if (daysSince < 30) prob += 0.08;
          else if (daysSince < 60) prob += 0.05;
          else if (daysSince < 90) prob += 0.02;
          else if (daysSince > 180) prob -= 0.04;
        }
      }
      const products = a.products || [];
      const buying = products.filter((p: any) => (p.cy1 || 0) > 0).map((p: any) => p.n?.toLowerCase() || "");
      const hasXsell = (
        (!buying.some((p: any) => p.includes("simplishade")) && buying.some((p: any) => p.includes("harmonize") || p.includes("herculite"))) ||
        (!buying.some((p: any) => p.includes("optibond 360")) && buying.some((p: any) => p.includes("optibond"))) ||
        (!buying.some((p: any) => p.includes("sonicfill")) && buying.some((p: any) => p.includes("composite") || p.includes("herculite"))) ||
        (!buying.some((p: any) => p.includes("maxcem")) && buying.some((p: any) => p.includes("cement") || p.includes("rely")))
      );
      if (hasXsell) prob += 0.04;

      const lat = badger?.lat || a.lat;
      const lng = badger?.lng || a.lng;
      const miles = distMiles(lat, lng);
      let distScore = 0;
      if (miles < 20) distScore = 0.08;
      else if (miles < 40) distScore = 0.05;
      else if (miles < 60) distScore = 0.02;
      else if (miles > 100) distScore = -0.05;

      if (isEndgame && track === "dark") prob *= 0.5;
      if (isSprint && track === "dark") prob *= 0.75;
      prob = Math.min(Math.max(prob, 0.05), 0.95);

      const askPct = isEndgame ? 1.0 : isSprint ? 0.85 : 0.70;
      const ask = track === "uplift"
        ? Math.min(gap, Math.max(150, gap * askPct))
        : py * (isEndgame ? 0.4 : isSprint ? 0.55 : 0.65);

      const visitScore = ask * Math.min(prob + distScore, 0.95);
      const callScore  = ask * prob;

      return {
        ...a, gap: track === "uplift" ? gap : py, ask, prob, track,
        visitScore, callScore, miles, hasDealer, hasBadger: !!badger,
        hasXsell, badgerFeel: badger?.feel ? parseFloat(badger.feel) : null,
        signals: [
          py > 1500 && (isSprint || isEndgame) ? "Bought in March PY" : null,
          track === "uplift" ? "Active buyer" : "Gone dark",
          hasDealer ? `Via ${a.dealer}` : null,
          badger?.orders ? `Orders: ${badger.orders}` : null,
          badger?.feel && parseFloat(badger.feel) >= 4 ? "Strong relationship" : null,
          hasXsell ? "Cross-sell opp" : null,
          miles < 40 ? `${Math.round(miles)}mi away` : null,
        ].filter(Boolean),
      };
    };

    const darkMaxPY = isEndgame ? 800 : isSprint ? 2000 : 999999;
    const upliftRaw = scored
      .filter((a: any) => (a.cyQ?.[activeQ]||0) > 0 && (a.pyQ?.[activeQ]||0) > (a.cyQ?.[activeQ]||0))
      .map((a: any) => scoreAccount(a, "uplift"));
    const darkRaw = scored
      .filter((a: any) => (a.cyQ?.[activeQ]||0) === 0 && (a.pyQ?.[activeQ]||0) > 200 && (a.pyQ?.[activeQ]||0) <= darkMaxPY)
      .map((a: any) => scoreAccount(a, "dark"));
    const allCandidates = [...new Map([...upliftRaw, ...darkRaw].map((a: any) => [a.id, a])).values()];

    const VISIT_MAX_SOLO = 75;
    const VISIT_MAX_CLUSTERED = 120;
    const withCoords = allCandidates.filter((a: any) => {
      const b = BADGER[a.id] || BADGER[a.gId];
      return (b?.lat && b?.lng) || (a.lat && a.lng);
    }).map((a: any) => {
      const b = BADGER[a.id] || BADGER[a.gId];
      return {...a, _lat: b?.lat || a.lat, _lng: b?.lng || a.lng};
    });

    const clustered = allCandidates.map((a: any) => {
      const b = BADGER[a.id] || BADGER[a.gId];
      const aLat = b?.lat || a.lat;
      const aLng = b?.lng || a.lng;
      const nearbyAccounts = withCoords.filter((nb: any) => {
        if (nb.id === a.id) return false;
        const d = distMiles(aLat, aLng);
        const dB = distMiles(nb._lat, nb._lng);
        return Math.abs(d - dB) < 20 && nb.ask > 200;
      });
      const clusterCount = nearbyAccounts.length;
      const solo = a.miles < VISIT_MAX_SOLO;
      const clusteredVisit = a.miles < VISIT_MAX_CLUSTERED && clusterCount >= 2;
      const visitEligible = solo || clusteredVisit;
      let adjustedVisitScore = a.visitScore;
      if (!visitEligible) adjustedVisitScore = 0;
      else if (a.miles > 60 && clusterCount >= 2) adjustedVisitScore *= 1.2;
      return {
        ...a, clusterCount, visitEligible, adjustedVisitScore,
        nearbyAccounts: nearbyAccounts.slice(0,8),
        nearbyNames: nearbyAccounts.slice(0,3).map((nb: any) => nb.name),
        signals: [
          ...(a.signals||[]),
          clusterCount >= 2 ? `${clusterCount} nearby accts` : null,
          !visitEligible && a.miles > 75 ? `${Math.round(a.miles)}mi — call instead` : null,
        ].filter(Boolean),
      };
    });

    const visitList = clustered
      .filter((a: any) => a.visitEligible && a.track === "uplift")
      .sort((a: any, b: any) => b.adjustedVisitScore - a.adjustedVisitScore)
      .slice(0, 5);
    const visitIds = new Set(visitList.map((a: any) => a.id));
    const callList = clustered
      .filter((a: any) => !visitIds.has(a.id))
      .sort((a: any, b: any) => b.callScore - a.callScore)
      .slice(0, 10);

    const dealerGroups: Record<string, any[]> = {};
    clustered.forEach((a: any) => {
      if (a.dealer && a.dealer !== "All Other") {
        dealerGroups[a.dealer] = dealerGroups[a.dealer] || [];
        dealerGroups[a.dealer].push(a);
      }
    });
    const dealerActions = Object.entries(dealerGroups)
      .map(([dealer, accts]) => {
        const top = (accts as any[]).sort((a: any, b: any) => b.callScore - a.callScore).slice(0, 3);
        return { dealer, accts: top, totalAsk: top.reduce((s: number, a: any) => s + a.ask, 0) };
      })
      .sort((a, b) => b.totalAsk - a.totalAsk)
      .slice(0, 3);

    const doneTotal = Object.values(odDone).reduce((s, v: any) => s + (v.amt || 0), 0);
    const pending = clustered.filter((a: any) => !odDone[a.id]);
    const conservative = doneTotal + pending.reduce((s: number, a: any) => s + a.ask * Math.min(a.prob * 0.65, 1), 0);
    const base = doneTotal + pending.reduce((s: number, a: any) => s + a.ask * a.prob, 0);
    const aggressive = doneTotal + pending.reduce((s: number, a: any) => s + a.ask * Math.min(a.prob * 1.35, 1), 0);

    return { visitList, callList, dealerActions, conservative, base, aggressive, doneTotal,
             totalTargets: clustered.length, modeLabel, isEndgame, isSprint, allCandidates: clustered };
  }, [scored, odDone]);

  // ── Today Focus: top 5 from overdrive (visits first, then calls) ──
  const todayFocus = useMemo(() => {
    if (!overdrive) return [];
    const seen = new Set<string>();
    const list: any[] = [];
    for (const a of [...overdrive.visitList, ...overdrive.callList]) {
      if (!seen.has(a.id) && list.length < 5) { seen.add(a.id); list.push(a); }
    }
    return list;
  }, [overdrive]);

  // ── Recovery: next accounts beyond Today Focus, sorted by priority score ──
  const recovery = useMemo(() => {
    if (!overdrive) return [];
    const focusIds = new Set(todayFocus.map((a:any) => a.id));
    return overdrive.allCandidates
      .filter((a:any) => !focusIds.has(a.id))
      .map((a:any) => {
        const p = scorePriority(a, activeQ);
        return {...a, _priorityScore:p.priorityScore, _priorityBucket:p.priorityBucket,
                _priorityReason:p.priorityReason, _rootStrength:p.rootStrength};
      })
      .sort((a:any,b:any) => b._priorityScore - a._priorityScore)
      .slice(0, 8);
  }, [overdrive, todayFocus, activeQ]);

  // ── Protect: strong accounts worth defending (always uses activeQ) ──
  const protect = useMemo(() => {
    return scored
      .filter((a:any) => {
        const cy = a.cyQ?.[activeQ]||0;
        const py = a.pyQ?.[activeQ]||0;
        return cy >= py * 0.85 && py > 500 && cy > 0;
      })
      .sort((a:any,b:any) => (b.cyQ?.[activeQ]||0) - (a.cyQ?.[activeQ]||0))
      .slice(0, 5);
  }, [scored, activeQ]);

  // ── Search ──
  const q = search.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!q) return [];
    return scored.filter((a:any) =>
      a.name?.toLowerCase().includes(q) ||
      a.city?.toLowerCase().includes(q) ||
      a.st?.toLowerCase().includes(q) ||
      a.addr?.toLowerCase().includes(q) ||
      a.gName?.toLowerCase().includes(q) ||
      (a.city && a.st && `${a.city} ${a.st}`.toLowerCase().includes(q))
    ).slice(0, 30);
  }, [q, scored]);

  // KPI styling
  const { att, cy, gap, perDay, target, isFY } = kpiData;
  const ahead = att >= 1.0;
  const onTrack = !ahead && att >= 0.85;
  const statusColor = ahead ? T.green : onTrack ? T.amber : T.red;
  const statusLabel = ahead ? (isFY ? "Ahead of FY" : "Ahead") : onTrack ? "On Track" : "Behind";

  const visitIds = useMemo(() => new Set((overdrive?.visitList||[]).map((a:any)=>a.id)), [overdrive]);

  return <div style={{padding:"0 0 80px"}}>

    {/* ── SEARCH BAR ── */}
    <div style={{position:"relative",margin:"16px 16px 12px"}}>
      <svg style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",width:15,height:15,color:T.t4}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      <input type="search" value={search} onChange={e=>setSearch(e.target.value)}
        placeholder="Search by office name or city…"
        style={{width:"100%",height:42,borderRadius:12,border:`1px solid ${search?T.blue+"44":T.b1}`,background:T.s1,color:T.t1,fontSize:13,paddingLeft:38,paddingRight:search?36:12,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
      {search&&<button onClick={()=>setSearch("")} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:T.t4,cursor:"pointer",fontSize:16,lineHeight:1}}>✕</button>}
    </div>

    {/* ── SEARCH RESULTS ── */}
    {q ? <div style={{padding:"0 16px"}}>
      <div style={{fontSize:10,color:T.t4,marginBottom:10}}>{searchResults.length} result{searchResults.length!==1?"s":""} for "{search}"</div>
      {searchResults.length===0&&<div style={{padding:"24px 0",textAlign:"center",color:T.t4,fontSize:12}}>No accounts found.</div>}
      {searchResults.map((a,i)=>{
        const py=a.pyQ?.[activeQ]||0; const cy=a.cyQ?.[activeQ]||0; const gap=py-cy;
        const ret=py>0?cy/py:0;
        return <button key={a.id} className="anim" onClick={()=>goAcct(a)}
          style={{animationDelay:`${i*15}ms`,width:"100%",textAlign:"left",background:T.s1,
            border:`1px solid ${T.b1}`,borderRadius:14,padding:"12px 14px",marginBottom:8,cursor:"pointer"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
            <div style={{flex:1,minWidth:0}}>
              <AccountId name={a.name} gName={a.gName} size="md"/>
              <div style={{fontSize:10,color:T.t3,marginTop:2}}>
                {a.addr ? a.addr + ', ' : ''}{a.city}, {a.st}
                {isAccelTier(a.gTier||a.tier)&&<span style={{color:T.amber}}> · {normalizeTier(a.gTier||a.tier)}</span>}
              </div>
            </div>
            <div style={{textAlign:"right",flexShrink:0,marginLeft:12}}>
              <div className="m" style={{fontSize:12,fontWeight:700,color:gap>0?T.red:gap<0?T.green:T.t4}}>{gap>0?`-${$$(gap)}`:gap<0?`+${$$(-gap)}`:"Even"}</div>
              <div className="m" style={{fontSize:10,color:T.t4}}>{Math.round(ret*100)}% ret</div>
            </div>
            <Chev/>
          </div>
          <div style={{display:"flex",gap:12,alignItems:"center"}}>
            <div><span style={{fontSize:9,textTransform:"uppercase",color:T.t3}}>PY </span><span className="m" style={{fontSize:12,fontWeight:700,color:T.t2}}>{$$(py)}</span></div>
            <div><span style={{fontSize:9,textTransform:"uppercase",color:T.t3}}>CY </span><span className="m" style={{fontSize:12,fontWeight:700,color:T.blue}}>{$$(cy)}</span></div>
            {a.score>0&&<span className="m" style={{fontSize:9,fontWeight:700,color:a.score>=50?T.red:T.amber,background:a.score>=50?"rgba(248,113,113,.08)":"rgba(251,191,36,.08)",borderRadius:4,padding:"2px 6px"}}>{a.score}pt</span>}
          </div>
        </button>;
      })}
    </div> :

    /* ── COMMAND CENTER ── */
    <div style={{padding:"0 16px"}}>

      {/* ── WEEKLY DELTA ── */}
      {weeklyDelta && (weeklyDelta.reactivated.length > 0 || weeklyDelta.wentDark.length > 0 || weeklyDelta.bigMovers.length > 0) && (()=>{
        const {reactivated,wentDark,bigMovers,snapshotAge,q} = weeklyDelta;
        const [deltaOpen, setDeltaOpen] = [deltaOpenState, setDeltaOpenState];
        return <div className="anim" style={{background:T.s1,border:,borderRadius:16,marginBottom:12,overflow:"hidden"}}>
          <button onClick={()=>setDeltaOpen(!deltaOpen)} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit"}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:11,fontWeight:700,color:T.t1}}>What changed</span>
              <span style={{fontSize:9,color:T.t4}}>vs {snapshotAge}</span>
              {reactivated.length>0&&<span style={{fontSize:9,fontWeight:700,color:T.green,background:"rgba(52,211,153,.1)",borderRadius:4,padding:"1px 6px"}}>+{reactivated.length} back</span>}
              {wentDark.length>0&&<span style={{fontSize:9,fontWeight:700,color:T.red,background:"rgba(248,113,113,.1)",borderRadius:4,padding:"1px 6px"}}>{wentDark.length} dark</span>}
              {bigMovers.length>0&&<span style={{fontSize:9,fontWeight:700,color:T.amber,background:"rgba(251,191,36,.1)",borderRadius:4,padding:"1px 6px"}}>{bigMovers.length} moved</span>}
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.t4} strokeWidth="2" style={{transform:deltaOpen?"rotate(180deg)":"none",transition:"transform .2s"}}><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          {deltaOpen && <div style={{padding:"0 16px 14px"}}>
            {reactivated.length>0&&<>
              <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.green,marginBottom:6}}>Reactivated — back from /bin/sh</div>
              {reactivated.map((item:any)=>(
                <button key={item.id} onClick={()=>goAcct(scored.find((a:any)=>a.id===item.id)||item)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",width:"100%",padding:"7px 0",borderBottom:,background:"none",border:"none",borderBottom:,cursor:"pointer",fontFamily:"inherit"}}>
                  <div style={{textAlign:"left"}}><div style={{fontSize:12,fontWeight:600,color:T.t1}}>{item.name}</div><div style={{fontSize:9,color:T.t4}}>{item.city}, {item.st} · PY {41(item.py)}</div></div>
                  <div style={{textAlign:"right",flexShrink:0}}><div className="m" style={{fontSize:12,fontWeight:700,color:T.green}}>+{41(item.currCY)}</div><div style={{fontSize:9,color:T.t4}}>was /bin/sh</div></div>
                </button>
              ))}
              <div style={{marginBottom:10}}/>
            </>}
            {wentDark.length>0&&<>
              <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.red,marginBottom:6,marginTop:reactivated.length>0?4:0}}>Went dark — dropped to /bin/sh</div>
              {wentDark.map((item:any)=>(
                <button key={item.id} onClick={()=>goAcct(scored.find((a:any)=>a.id===item.id)||item)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",width:"100%",padding:"7px 0",background:"none",border:"none",borderBottom:,cursor:"pointer",fontFamily:"inherit"}}>
                  <div style={{textAlign:"left"}}><div style={{fontSize:12,fontWeight:600,color:T.t1}}>{item.name}</div><div style={{fontSize:9,color:T.t4}}>{item.city}, {item.st} · PY {41(item.py)}</div></div>
                  <div style={{textAlign:"right",flexShrink:0}}><div className="m" style={{fontSize:12,fontWeight:700,color:T.red}}>-{41(item.prevCY)}</div><div style={{fontSize:9,color:T.t4}}>now /bin/sh</div></div>
                </button>
              ))}
              <div style={{marginBottom:10}}/>
            </>}
            {bigMovers.length>0&&<>
              <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.amber,marginBottom:6,marginTop:(reactivated.length>0||wentDark.length>0)?4:0}}>Big movers — significant change</div>
              {bigMovers.map((item:any)=>(
                <button key={item.id} onClick={()=>goAcct(scored.find((a:any)=>a.id===item.id)||item)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",width:"100%",padding:"7px 0",background:"none",border:"none",borderBottom:,cursor:"pointer",fontFamily:"inherit"}}>
                  <div style={{textAlign:"left"}}><div style={{fontSize:12,fontWeight:600,color:T.t1}}>{item.name}</div><div style={{fontSize:9,color:T.t4}}>{item.city}, {item.st} · PY {41(item.py)}</div></div>
                  <div style={{textAlign:"right",flexShrink:0}}><div className="m" style={{fontSize:12,fontWeight:700,color:item.diff>0?T.green:T.red}}>{item.diff>0?"+":""}{41(item.diff)}</div><div style={{fontSize:9,color:T.t4}}>{41(item.prevCY)} → {41(item.currCY)}</div></div>
                </button>
              ))}
            </>}
          </div>}
        </div>;
      })()}

      {/* ── KPI STRIP ── */}
      <div className="anim" style={{background:`linear-gradient(135deg,${T.s1},rgba(79,142,247,.05))`,border:`1px solid ${T.b1}`,borderRadius:16,padding:16,marginBottom:16,boxShadow:"0 4px 24px rgba(0,0,0,.4)"}}>

        {/* Header: title + scope toggle */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1.2px",color:T.t3}}>
              {isFY ? "Full Year" : `Q${kpiScope} Quota Pace`}
            </span>
            {adjCount>0&&<span style={{fontSize:9,color:T.green,background:"rgba(52,211,153,.08)",borderRadius:4,padding:"1px 6px"}}>+{adjCount} adj</span>}
          </div>
          <div style={{display:"flex",gap:3}}>
            <button onClick={()=>setKpiScope(activeQ)} style={{
              padding:"4px 11px",borderRadius:7,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
              border:`1px solid ${kpiScope!=="FY"?"rgba(79,142,247,.4)":T.b2}`,
              background:kpiScope!=="FY"?"rgba(79,142,247,.18)":T.s2,
              color:kpiScope!=="FY"?T.blue:T.t3,transition:"all 0.15s"
            }}>Q{activeQ}</button>
            <button onClick={()=>setKpiScope("FY")} style={{
              padding:"4px 11px",borderRadius:7,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
              border:`1px solid ${kpiScope==="FY"?"rgba(79,142,247,.4)":T.b2}`,
              background:kpiScope==="FY"?"rgba(79,142,247,.18)":T.s2,
              color:kpiScope==="FY"?T.blue:T.t3,transition:"all 0.15s"
            }}>FY</button>
          </div>
        </div>

        {/* Attainment hero */}
        <div style={{display:"flex",alignItems:"baseline",gap:12,marginBottom:8}}>
          <span className="m" style={{fontSize:32,fontWeight:800,color:statusColor}}>{pc(att)}</span>
          <span style={{fontSize:12,color:T.t3}}>{$$(cy)} / {$$(target)}</span>
          <span style={{fontSize:10,fontWeight:700,color:statusColor,borderRadius:999,padding:"2px 10px",
            background:ahead?"rgba(52,211,153,.1)":onTrack?"rgba(251,191,36,.1)":"rgba(248,113,113,.1)",
            border:`1px solid ${statusColor}44`,marginLeft:"auto"}}>{statusLabel}</span>
        </div>
        <Bar pct={att*100} color={`linear-gradient(90deg,${statusColor},${ahead?T.cyan:onTrack?T.orange:T.red})`}/>

        {/* KPI grid */}
        <div style={{display:"grid",gridTemplateColumns:isFY?"1fr 1fr":"1fr 1fr 1fr",gap:8,marginTop:10}}>
          <div style={{borderRadius:8,background:"rgba(248,113,113,.06)",border:"1px solid rgba(248,113,113,.12)",padding:10}}>
            <div style={{fontSize:9,color:T.t3}}>{gap<=0?"Surplus":"Gap to close"}</div>
            <div className="m" style={{fontSize:15,fontWeight:700,color:gap<=0?T.green:T.red}}>{gap<=0?`+${$$(-gap)}`:$$(gap)}</div>
          </div>
          {!isFY&&<div style={{borderRadius:8,background:"rgba(79,142,247,.06)",border:"1px solid rgba(79,142,247,.12)",padding:10}}>
            <div style={{fontSize:9,color:T.t3}}>$/day needed</div>
            <div className="m" style={{fontSize:15,fontWeight:700,color:T.blue}}>{$f(perDay)}</div>
          </div>}
          {overdrive&&<div style={{borderRadius:8,background:"rgba(167,139,250,.06)",border:"1px solid rgba(167,139,250,.12)",padding:10}}>
            <div style={{fontSize:9,color:T.t3}}>Pipeline (base)</div>
            <div className="m" style={{fontSize:15,fontWeight:700,color:T.purple}}>{$f(overdrive.base)}</div>
          </div>}
        </div>

        {/* Projected landing — only show when gap exists and overdrive is active */}
        {!isFY&&overdrive&&DAYS_LEFT>0&&gap>0&&<div style={{marginTop:10,borderTop:`1px solid ${T.b2}`,paddingTop:10}}>
          <div style={{fontSize:9,color:T.t4,textTransform:"uppercase",letterSpacing:"1px",marginBottom:7}}>Projected Q{kpiScope} Landing</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
            {[
              {label:"Conservative",val:cy+overdrive.conservative,color:T.amber},
              {label:"Base",val:cy+overdrive.base,color:T.blue},
              {label:"Best Case",val:cy+overdrive.aggressive,color:T.green},
            ].map(s=>(
              <div key={s.label} style={{borderRadius:8,background:T.s2,padding:"7px 6px",textAlign:"center"}}>
                <div style={{fontSize:9,color:T.t3,marginBottom:2}}>{s.label}</div>
                <div className="m" style={{fontSize:11,fontWeight:800,color:s.val>=target?T.green:s.color}}>{$$(s.val)}</div>
                <div style={{fontSize:8,color:s.val>=target?T.green:T.t4,marginTop:1}}>{s.val>=target?"✓ hits":"-"+$$(target-s.val)}</div>
              </div>
            ))}
          </div>
        </div>}

        {overdrive?.doneTotal>0&&<div style={{marginTop:8,padding:"5px 10px",borderRadius:8,background:"rgba(52,211,153,.06)",border:"1px solid rgba(52,211,153,.12)",fontSize:10,color:T.green,display:"flex",justifyContent:"space-between"}}>
          <span>Logged outcomes</span><span className="m" style={{fontWeight:700}}>+{$f(overdrive.doneTotal)}</span>
        </div>}
      </div>

      {/* ── TODAY FOCUS ── */}
      {todayFocus.length>0&&<div style={{marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
          <div style={{width:7,height:7,borderRadius:"50%",background:T.amber,animation:"pulse 2s infinite",flexShrink:0}}/>
          <span style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1.2px",color:T.amber}}>Today Focus</span>
          <span style={{fontSize:10,color:T.t4,marginLeft:"auto"}}>{overdrive?.modeLabel} · {DAYS_LEFT}d left</span>
        </div>
        {todayFocus.map((a:any,i:number)=>{
          const done = odDone[a.id];
          const isVisit = visitIds.has(a.id);
          return <div key={a.id} className="anim" style={{animationDelay:`${i*20}ms`,marginBottom:6}}>
            <button onClick={()=>goAcct(a)} style={{width:"100%",textAlign:"left",
              background:done?"rgba(52,211,153,.06)":T.s1,
              border:`1px solid ${done?"rgba(52,211,153,.2)":isVisit?"rgba(34,211,238,.2)":"rgba(167,139,250,.2)"}`,
              borderLeft:`3px solid ${done?T.green:isVisit?T.cyan:T.purple}`,
              borderRadius:12,padding:"11px 12px",cursor:"pointer",
              display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:3}}>
                  <span style={{fontSize:9,fontWeight:700,
                    color:isVisit?T.cyan:T.purple,
                    background:isVisit?"rgba(34,211,238,.1)":"rgba(167,139,250,.1)",
                    borderRadius:4,padding:"1px 5px"}}>{isVisit?"🚗 Visit":"📞 Call"}</span>
                  <span className="m" style={{fontSize:9,fontWeight:700,color:T.amber,background:"rgba(251,191,36,.08)",borderRadius:4,padding:"1px 5px"}}>{$f(a.ask)} ask · {Math.round(a.prob*100)}%</span>
                </div>
                <AccountId name={a.name} gName={a.gName} size="md" color={done?T.t3:undefined}/>
                {!done&&<div style={{fontSize:10,color:T.t3,marginTop:2}}>
                  {a.city}, {a.st}{a.miles&&a.miles<100?<span style={{color:T.t4}}> · {Math.round(a.miles)}mi</span>:""}
                </div>}
                {!done&&a.signals?.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:3,marginTop:4}}>
                  {a.signals.slice(0,3).map((s:string,si:number)=>(
                    <span key={si} style={{fontSize:9,color:T.t2,background:"rgba(255,255,255,.06)",borderRadius:4,padding:"1px 6px",border:"1px solid rgba(255,255,255,.12)"}}>{s}</span>
                  ))}
                </div>}
                {!done&&a.clusterCount>=2&&<div style={{display:"flex",alignItems:"center",gap:6,marginTop:4}}>
                  <span style={{fontSize:9,color:T.cyan}}>📍 {a.clusterCount} nearby</span>
                  <button onClick={e=>{e.stopPropagation();setTripAnchor(a);}}
                    style={{background:"rgba(34,211,238,.1)",border:"1px solid rgba(34,211,238,.25)",borderRadius:5,padding:"2px 8px",fontSize:9,fontWeight:700,color:T.cyan,cursor:"pointer",fontFamily:"inherit"}}>Plan Trip →</button>
                </div>}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:4,flexShrink:0,marginLeft:8}}>
                {done
                  ? <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:1}}>
                      <span style={{fontSize:10,fontWeight:700,color:done.outcome==="lost"?T.red:T.green}}>{done.outcome==="lost"?"✗ Lost":`${$f(done.amt)} ✓`}</span>
                      {done.note&&<span style={{fontSize:9,color:T.t3,maxWidth:90,textAlign:"right",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{done.note}</span>}
                    </div>
                  : <div style={{display:"flex",gap:4}}>
                      <button onClick={e=>promptOutcome(e,a.id,"won",a.ask)} style={{background:"rgba(52,211,153,.12)",border:"1px solid rgba(52,211,153,.25)",borderRadius:6,padding:"3px 8px",fontSize:9,fontWeight:700,color:T.green,cursor:"pointer",fontFamily:"inherit"}}>✓ Win</button>
                      <button onClick={e=>promptOutcome(e,a.id,"partial",a.ask*0.5)} style={{background:"rgba(251,191,36,.08)",border:"1px solid rgba(251,191,36,.2)",borderRadius:6,padding:"3px 8px",fontSize:9,fontWeight:700,color:T.amber,cursor:"pointer",fontFamily:"inherit"}}>½</button>
                      <button onClick={e=>promptOutcome(e,a.id,"lost",0)} style={{background:"rgba(248,113,113,.08)",border:"1px solid rgba(248,113,113,.2)",borderRadius:6,padding:"3px 8px",fontSize:9,fontWeight:700,color:T.red,cursor:"pointer",fontFamily:"inherit"}}>✗</button>
                    </div>
                }
                {done&&<button onClick={e=>{e.stopPropagation();clearDone(a.id);}} style={{background:"none",border:"none",color:T.t4,cursor:"pointer",fontSize:12}}>↩</button>}
              </div>
            </button>
          </div>;
        })}
      </div>}

      {/* ── RECOVERY OPPORTUNITIES ── */}
      {recovery.length>0&&<div style={{marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
          <div style={{width:7,height:7,borderRadius:"50%",background:T.red,flexShrink:0}}/>
          <span style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1.2px",color:T.red}}>Recovery</span>
          <span style={{fontSize:10,color:T.t4,marginLeft:"auto"}}>{recovery.length} accounts</span>
        </div>
        <div style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:14,overflow:"hidden"}}>
          {recovery.map((a:any,i:number)=>{
            const done=odDone[a.id];
            const isDark=a.track==="dark";
            const isLast=i===recovery.length-1;
            const bStyle = BUCKET_STYLE[a._priorityBucket ?? "Recover"];
            return <button key={a.id} className="anim" onClick={()=>goAcct(a)}
              style={{animationDelay:`${i*15}ms`,width:"100%",textAlign:"left",
                background:done?"rgba(52,211,153,.04)":"transparent",
                border:"none",borderBottom:isLast?"none":`1px solid ${T.b2}`,
                borderLeft:`3px solid ${bStyle.leftAccent}`,
                padding:"9px 12px",cursor:"pointer",
                display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:11,fontWeight:600,color:done?T.t3:T.t1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",textDecoration:done?"line-through":"none"}}>{a.name}</div>
                {a.gName&&a.gName!==a.name&&<div style={{fontSize:9,color:T.cyan,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.gName}</div>}
                <div style={{fontSize:9,color:T.t3,marginTop:1}}>
                  {a._priorityReason&&<span style={{color:bStyle.color}}>{a._priorityReason} — </span>}
                  {$f(a.ask)} ask · {Math.round(a.prob*100)}%
                </div>
              </div>
              <div style={{display:"flex",gap:4,flexShrink:0,marginLeft:8,alignItems:"center"}}>
                <span className="m" style={{fontSize:10,fontWeight:700,color:T.amber}}>{$f(a.ask*a.prob)}</span>
                {done
                  ? <span style={{fontSize:9,fontWeight:700,color:done.outcome==="lost"?T.red:T.green}}>{done.outcome==="lost"?"✗":"✓"}</span>
                  : <div style={{display:"flex",gap:3}}>
                      <button onClick={e=>promptOutcome(e,a.id,"won",a.ask)} style={{background:"rgba(52,211,153,.12)",border:"1px solid rgba(52,211,153,.25)",borderRadius:5,padding:"2px 6px",fontSize:8,fontWeight:700,color:T.green,cursor:"pointer",fontFamily:"inherit"}}>✓</button>
                      <button onClick={e=>promptOutcome(e,a.id,"lost",0)} style={{background:"rgba(248,113,113,.08)",border:"1px solid rgba(248,113,113,.2)",borderRadius:5,padding:"2px 6px",fontSize:8,fontWeight:700,color:T.red,cursor:"pointer",fontFamily:"inherit"}}>✗</button>
                    </div>
                }
                {done&&<button onClick={e=>{e.stopPropagation();clearDone(a.id);}} style={{background:"none",border:"none",color:T.t4,cursor:"pointer",fontSize:11}}>↩</button>}
              </div>
            </button>;
          })}
        </div>
      </div>}

      {/* ── DEALER PUSH ── */}
      {overdrive?.dealerActions.length>0&&<div style={{marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
          <div style={{width:7,height:7,borderRadius:"50%",background:T.blue,flexShrink:0}}/>
          <span style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1.2px",color:T.blue}}>Dealer Push</span>
        </div>
        {overdrive.dealerActions.map((d:any,i:number)=>(
          <div key={d.dealer} style={{background:T.s1,border:"1px solid rgba(79,142,247,.15)",borderRadius:12,padding:"10px 12px",marginBottom:6}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
              <span style={{fontSize:11,fontWeight:700,color:T.blue}}>{d.dealer}</span>
              <span style={{fontSize:10,color:T.amber,fontWeight:700}}>{$f(d.totalAsk)} potential</span>
            </div>
            <div style={{fontSize:10,color:T.t3,marginBottom:3}}>Push reorder on:</div>
            {d.accts.map((a:any)=><div key={a.id} style={{fontSize:10,color:T.t2,paddingLeft:8,marginTop:2}}>· {a.name} ({a.city}) — {$f(a.ask)}</div>)}
          </div>
        ))}
      </div>}

      {/* ── MOMENTUM / PROTECT ── */}
      {protect.length>0&&<div style={{marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
          <div style={{width:7,height:7,borderRadius:"50%",background:T.green,flexShrink:0}}/>
          <span style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1.2px",color:T.green}}>Momentum / Protect</span>
          <span style={{fontSize:10,color:T.t4,marginLeft:"auto"}}>Q{activeQ}</span>
        </div>
        <div style={{background:T.s1,border:"1px solid rgba(52,211,153,.15)",borderRadius:14,overflow:"hidden"}}>
          {protect.map((a:any,i:number)=>{
            const pCy=a.cyQ?.[activeQ]||0; const pPy=a.pyQ?.[activeQ]||0;
            const isLast=i===protect.length-1;
            return <button key={a.id} className="anim" onClick={()=>goAcct(a)}
              style={{animationDelay:`${i*15}ms`,width:"100%",textAlign:"left",
                background:"transparent",border:"none",
                borderBottom:isLast?"none":`1px solid ${T.b2}`,
                borderLeft:"3px solid rgba(52,211,153,.4)",
                padding:"9px 12px",cursor:"pointer",
                display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:11,fontWeight:600,color:T.t1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.name}</div>
                {a.gName&&a.gName!==a.name&&<div style={{fontSize:9,color:T.cyan,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.gName}</div>}
                <div style={{fontSize:9,color:T.t3,marginTop:1}}>{a.city}, {a.st}{isAccelTier(a.gTier||a.tier)?<span style={{color:T.amber}}> · {normalizeTier(a.gTier||a.tier)}</span>:""}</div>
              </div>
              <div style={{flexShrink:0,marginLeft:10,textAlign:"right"}}>
                <div className="m" style={{fontSize:11,fontWeight:700,color:T.green}}>{$$(pCy)}</div>
                <div style={{fontSize:9,color:T.t4}}>{pc(pPy>0?pCy/pPy:1)} ret</div>
              </div>
              <Chev/>
            </button>;
          })}
        </div>
      </div>}

      {scored.length===0&&<div style={{padding:"40px 0",textAlign:"center",color:T.t4,fontSize:12}}>Upload a CSV to get started.</div>}

    </div>}

    {/* ── TRIP PLANNER MODAL ── */}
    {tripAnchor&&(()=>{
      const anchor = tripAnchor;
      const nearby = anchor.nearbyAccounts || [];
      const allStops = [anchor, ...nearby].filter(Boolean);
      const totalAsk = allStops.reduce((s:number,a:any)=>s+(a.ask||0),0);
      const totalExpected = allStops.reduce((s:number,a:any)=>s+(a.ask||0)*(a.prob||0),0);
      const buildRoute = () => {
        const stops = allStops.map((a:any) => {
          const b = BADGER[a.id] || BADGER[a.gId];
          if (b?.address) return b.address;
          if (a.addr) return a.addr;
          return `${a.name}, ${a.city}, ${a.st}`;
        });
        const origin = encodeURIComponent("Thomaston, CT");
        const dest = encodeURIComponent(stops[stops.length-1]);
        const waypoints = stops.slice(0,-1).map((s:string)=>encodeURIComponent(s)).join("|");
        const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}${waypoints?`&waypoints=${waypoints}`:""}&travelmode=driving`;
        window.open(url,"_blank");
      };
      return <div style={{position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,.75)",backdropFilter:"blur(8px)",display:"flex",flexDirection:"column",justifyContent:"flex-end"}} onClick={()=>setTripAnchor(null)}>
        <div style={{background:T.s1,borderRadius:"20px 20px 0 0",padding:20,maxHeight:"80vh",display:"flex",flexDirection:"column"}} onClick={e=>e.stopPropagation()}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
            <div>
              <div style={{fontSize:13,fontWeight:700}}>Trip Plan</div>
              <div style={{fontSize:10,color:T.t3,marginTop:1}}>{allStops.length} stops · {$f(totalAsk)} ask · {$f(totalExpected)} expected</div>
            </div>
            <button onClick={()=>setTripAnchor(null)} style={{background:"none",border:"none",color:T.t4,cursor:"pointer",fontSize:18}}>✕</button>
          </div>
          <button onClick={buildRoute} style={{width:"100%",background:`linear-gradient(90deg,${T.blue},${T.cyan})`,border:"none",borderRadius:10,padding:"10px 0",fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer",fontFamily:"inherit",marginBottom:14,marginTop:8}}>
            🗺 Open Full Route in Google Maps
          </button>
          <div style={{overflowY:"auto",flex:1}}>
            {allStops.map((a:any,i:number)=>{
              const done = odDone[a.id];
              const isAnchor = i===0;
              return <div key={a.id} style={{background:isAnchor?`rgba(251,191,36,.06)`:T.s2,
                border:`1px solid ${isAnchor?"rgba(251,191,36,.25)":T.b1}`,borderRadius:12,padding:"10px 12px",marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                      <span style={{fontSize:9,fontWeight:700,color:isAnchor?T.amber:T.t4,background:isAnchor?"rgba(251,191,36,.1)":T.s1,borderRadius:4,padding:"1px 5px"}}>{isAnchor?"ANCHOR":`STOP ${i+1}`}</span>
                      {done&&<span style={{fontSize:9,fontWeight:700,color:done.outcome==="lost"?T.red:T.green}}>{done.outcome==="lost"?"✗ Lost":`✓ ${done.outcome}`}</span>}
                    </div>
                    <AccountId name={a.name} gName={a.gName} size="md"/>
                    <div style={{fontSize:10,color:T.t3,marginTop:1}}>{a.city}, {a.st} · {Math.round(a.miles||0)}mi from home</div>
                    <div style={{fontSize:10,color:T.t3,marginTop:1}}>Ask <span style={{color:T.amber,fontWeight:600}}>{$f(a.ask)}</span> · {Math.round((a.prob||0)*100)}% likely</div>
                    {done?.note&&<div style={{fontSize:9,color:T.t4,marginTop:3,fontStyle:"italic"}}>"{done.note}"</div>}
                  </div>
                  <div style={{display:"flex",gap:4,flexShrink:0,marginLeft:8}}>
                    {done
                      ? <button onClick={()=>clearDone(a.id)} style={{background:"none",border:"none",color:T.t4,cursor:"pointer",fontSize:12}}>↩</button>
                      : <>
                          <button onClick={e=>promptOutcome(e,a.id,"won",a.ask)} style={{background:"rgba(52,211,153,.12)",border:"1px solid rgba(52,211,153,.25)",borderRadius:6,padding:"4px 8px",fontSize:9,fontWeight:700,color:T.green,cursor:"pointer",fontFamily:"inherit"}}>✓ Win</button>
                          <button onClick={e=>promptOutcome(e,a.id,"partial",a.ask*0.5)} style={{background:"rgba(251,191,36,.08)",border:"1px solid rgba(251,191,36,.2)",borderRadius:6,padding:"4px 8px",fontSize:9,fontWeight:700,color:T.amber,cursor:"pointer",fontFamily:"inherit"}}>½</button>
                          <button onClick={e=>promptOutcome(e,a.id,"lost",0)} style={{background:"rgba(248,113,113,.08)",border:"1px solid rgba(248,113,113,.2)",borderRadius:6,padding:"4px 8px",fontSize:9,fontWeight:700,color:T.red,cursor:"pointer",fontFamily:"inherit"}}>✗</button>
                        </>
                    }
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
          <span style={{fontSize:10,color:T.t4,fontWeight:600}}>{odNotePrompt.outcome!=="lost"?`+${$f(odNotePrompt.amt)} credited`:""}</span>
        </div>
        <div style={{fontSize:11,color:T.t3,marginBottom:10}}>Optional · tap outside or press Enter to skip</div>
        <input autoFocus type="text" value={odNoteText} onChange={e=>setOdNoteText(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&commitOutcome()}
          placeholder={odNotePrompt.outcome==="won"?"e.g. Dr. committed to SonicFill 3 trial":odNotePrompt.outcome==="partial"?"e.g. Ordered MaxCem, passed on composites":"e.g. On contract through Q3, revisit then"}
          style={{width:"100%",height:44,borderRadius:10,border:`1px solid ${T.b1}`,background:T.s2,color:T.t1,fontSize:13,padding:"0 12px",outline:"none",fontFamily:"inherit",marginBottom:12,boxSizing:"border-box"}}/>
        <button onClick={commitOutcome} style={{width:"100%",background:odNotePrompt.outcome==="won"?`linear-gradient(90deg,${T.green},${T.cyan})`:odNotePrompt.outcome==="partial"?`linear-gradient(90deg,${T.amber},rgba(251,191,36,.7))`:`linear-gradient(90deg,${T.red},rgba(248,113,113,.7))`,border:"none",borderRadius:10,padding:"11px 0",fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer",fontFamily:"inherit"}}>
          {odNoteText.trim()?"Save Note & Log →":"Log Without Note →"}
        </button>
      </div>
    </div>}

  </div>;
}

export default DashboardTab;

