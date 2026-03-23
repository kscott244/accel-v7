"use client";
// @ts-nocheck
import { useState, useMemo } from "react";
import { T, Q1_TARGET, DAYS_LEFT, HOME_LAT, HOME_LNG } from "@/lib/tokens";
import { normalizeTier, isAccelTier } from "@/lib/tier";
import { $$, $f, pc, scoreAccount } from "@/lib/format";

let BADGER: Record<string, any> = {};
try { BADGER = require("@/data/badger-lookup.json"); } catch(e) {}

const Pill = ({l,v,c}) => <div><span style={{fontSize:9,textTransform:"uppercase",color:T.t3}}>{l} </span><span className="m" style={{fontSize:12,fontWeight:700,color:c}}>{v}</span></div>;
const Bar = ({pct, color}) => <div style={{width:"100%",height:6,borderRadius:3,background:T.s3,overflow:"hidden"}}><div className="bar-g" style={{height:"100%",borderRadius:3,width:`${Math.min(Math.max(pct,0),100)}%`,background:color||`linear-gradient(90deg,${T.blue},${T.cyan})`}}/></div>;
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

function TodayTab({scored,goAcct,q1CY,q1Gap,q1Att,adjCount,totalAdj,groups,goGroup}) {
  const [scope, setScope] = useState<string>(() => {
    try { return localStorage.getItem("today_scope") || "1"; } catch { return "1"; }
  });
  const setAndSaveScope = (s: string) => {
    setScope(s);
    try { localStorage.setItem("today_scope", s); } catch {}
  };

  // ── Scoped totals: PY vs CY for selected scope across all groups ──
  const scopeTotals = useMemo(() => {
    if (!groups) return {py:0, cy:0};
    const py = groups.reduce((s,g) => s + (g.pyQ?.[scope]||0), 0);
    const cy = groups.reduce((s,g) => s + (g.cyQ?.[scope]||0), 0);
    return {py, cy};
  }, [groups, scope]);

  // ── Scoped scored: rescore all accounts for the selected scope ──
  // Only needed when scope ≠ "1" (Q1 scored array is already computed at App level)
  const scopedScored = useMemo(() => {
    if (scope === "1") return scored; // use existing Q1 scored — already adjusted
    return scored.map(a => {
      const py = a.pyQ?.[scope] || 0;
      const cy = a.cyQ?.[scope] || 0;
      const scoreBase = {...a, pyQ:{...a.pyQ, [scope]: py}, cyQ:{...a.cyQ, [scope]: cy}};
      return {
        ...a,
        ...scoreAccount(scoreBase, scope),
        // override py/cy/gap/ret for display in this scope
        py, cy, gap: py-cy, ret: py>0 ? cy/py : 0,
      };
    }).sort((a:any,b:any) => b.score - a.score);
  }, [scored, scope]);

  // ── Scoped group rolls: re-aggregate groups for selected scope ──
  const scopedGroups = useMemo(() => {
    const gMap: Record<string,any> = {};
    scopedScored.forEach(a => {
      if(!a.gId) return;
      if(!gMap[a.gId]) gMap[a.gId] = {gId:a.gId, gName:a.gName||a.gId, gTier:a.gTier||"", children:[], totalPY:0, totalCY:0, maxScore:0};
      const g = gMap[a.gId];
      g.children.push(a);
      g.totalPY += (a.pyQ?.[scope]||0);
      g.totalCY += (a.cyQ?.[scope]||0);
      if((a.score||0) > g.maxScore) g.maxScore = a.score;
    });
    return Object.values(gMap)
      .map((g:any) => ({
        ...g,
        totalGap: g.totalPY - g.totalCY,
        totalRet: g.totalPY > 0 ? g.totalCY / g.totalPY : 0,
        children: [...g.children].sort((a:any,b:any) => (b.gap||0) - (a.gap||0)),
      }))
      .filter((g:any) => g.totalGap > 0 || g.maxScore >= 20)
      .sort((a:any,b:any) => b.totalGap - a.totalGap);
  }, [scopedScored, scope]);
  const [search, setSearch] = useState("");
  const [odDone, setOdDone] = useState<Record<string,{outcome:string,amt:number,note?:string}>>(() => {
    try { return JSON.parse(localStorage.getItem("overdrive_done") || "{}"); } catch { return {}; }
  });
  const [odNotePrompt, setOdNotePrompt] = useState<{id:string,outcome:string,amt:number}|null>(null);
  const [odNoteText, setOdNoteText] = useState("");
  const [odOpen, setOdOpen] = useState<boolean>(() => {
    try { return localStorage.getItem("overdrive_open") !== "false"; } catch { return true; }
  });
  const [tripAnchor, setTripAnchor] = useState<any>(null);
  const toggleOd = () => {
    const next = !odOpen;
    setOdOpen(next);
    try { localStorage.setItem("overdrive_open", String(next)); } catch {}
  };

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

  // ── OVERDRIVE ENGINE — full signal scoring ──
  const overdrive = useMemo(() => {
    if (!scored.length) return null;

    // Time pressure bands
    const isEndgame = DAYS_LEFT <= 5;
    const isSprint  = DAYS_LEFT <= 14;
    const isCruise  = DAYS_LEFT > 30;
    const modeLabel = isEndgame ? "🔴 Endgame" : isSprint ? "🟡 Sprint" : isCruise ? "🟢 Pipeline" : "🟠 Push";

    // Haversine distance from Thomaston CT (miles)
    const distMiles = (lat?: number, lng?: number): number => {
      if (!lat || !lng) return 999;
      const R = 3958.8;
      const dLat = (lat - HOME_LAT) * Math.PI / 180;
      const dLng = (lng - HOME_LNG) * Math.PI / 180;
      const a = Math.sin(dLat/2)**2 + Math.cos(HOME_LAT * Math.PI/180) * Math.cos(lat * Math.PI/180) * Math.sin(dLng/2)**2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    };

    // Score a single account across all available signals
    const scoreAccount = (a: any, track: string) => {
      const py = a.pyQ?.["1"] || 0;
      const cy = a.cyQ?.["1"] || 0;
      const gap = py - cy;
      const retPct = py > 0 ? cy / py : 0;
      const badger = BADGER[a.id] || BADGER[a.gId] || null;

      // ── BASE PROBABILITY from retention ──
      let prob = track === "uplift"
        ? (retPct > 0.7 ? 0.78 : retPct > 0.4 ? 0.62 : 0.48)
        : (py > 2000 ? 0.28 : py > 800 ? 0.40 : 0.52);

      // ── SIGNAL BOOSTS ──

      // 1. Bought in March last year → highest possible signal for sprint/endgame
      //    PY Q1 data IS the last 12 weeks of March — accounts with high PY Q1 were buying in this window
      if (isSprint || isEndgame) {
        if (py > 3000) prob += 0.15;
        else if (py > 1500) prob += 0.10;
        else if (py > 500) prob += 0.05;
      }

      // 2. Actively buying this year, small gap → very high probability
      if (track === "uplift") {
        prob += 0.08; // already in buying mode this year
        if (isSprint || isEndgame) prob += 0.07; // extra boost end of quarter
      }

      // 3. Has dealer contact → can coordinate outreach in parallel
      const hasDealer = a.dealer && a.dealer !== "Unknown";
      if (hasDealer) prob += 0.04;

      // 4. Has Badger field intel → we know who to call
      if (badger) {
        if (badger.doctor) prob += 0.05;      // know the doctor's name
        if (badger.orders) prob += 0.05;      // know who places orders
        if (badger.dealerRep) prob += 0.04;   // know dealer rep by name
        if (badger.notes) prob += 0.03;       // have visit notes
        if (badger.feel && parseFloat(badger.feel) >= 4) prob += 0.06; // strong relationship
        if (badger.feel && parseFloat(badger.feel) <= 2) prob -= 0.08; // weak relationship
        // Recently visited → warmer relationship
        if (badger.lastVisit) {
          const daysSince = (Date.now() - new Date(badger.lastVisit).getTime()) / 86400000;
          if (daysSince < 30) prob += 0.08;
          else if (daysSince < 60) prob += 0.05;
          else if (daysSince < 90) prob += 0.02;
          else if (daysSince > 180) prob -= 0.04; // gone cold
        }
      }

      // 5. Cross-sell opportunity → reason to call beyond just gap
      const products = a.products || [];
      const buying = products.filter((p: any) => (p.cy1 || 0) > 0).map((p: any) => p.n?.toLowerCase() || "");
      const hasXsell = (
        (!buying.some((p: any) => p.includes("simplishade")) && buying.some((p: any) => p.includes("harmonize") || p.includes("herculite"))) ||
        (!buying.some((p: any) => p.includes("optibond 360")) && buying.some((p: any) => p.includes("optibond"))) ||
        (!buying.some((p: any) => p.includes("sonicfill")) && buying.some((p: any) => p.includes("composite") || p.includes("herculite"))) ||
        (!buying.some((p: any) => p.includes("maxcem")) && buying.some((p: any) => p.includes("cement") || p.includes("rely")))
      );
      if (hasXsell) prob += 0.04;

      // 6. Distance — closer = more likely you'll actually visit
      const lat = badger?.lat || a.lat;
      const lng = badger?.lng || a.lng;
      const miles = distMiles(lat, lng);
      let distScore = 0;
      if (miles < 20) distScore = 0.08;
      else if (miles < 40) distScore = 0.05;
      else if (miles < 60) distScore = 0.02;
      else if (miles > 100) distScore = -0.05; // far accounts are harder to squeeze in

      // For visit list only — distance matters a LOT for in-person
      // For calls — distance doesn't matter, use 0
      const distBoost = distScore;

      // Time pressure adjustments
      if (isEndgame && track === "dark") prob *= 0.5;
      if (isSprint && track === "dark") prob *= 0.75;

      prob = Math.min(Math.max(prob, 0.05), 0.95); // clamp 5-95%

      // Ask amount
      const askPct = isEndgame ? 1.0 : isSprint ? 0.85 : 0.70;
      const ask = track === "uplift"
        ? Math.min(gap, Math.max(150, gap * askPct))
        : py * (isEndgame ? 0.4 : isSprint ? 0.55 : 0.65);

      const visitScore = ask * Math.min(prob + distBoost, 0.95);  // distance matters for visits
      const callScore  = ask * prob;                               // distance irrelevant for calls

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

    // ── BUILD CANDIDATE POOLS ──
    const darkMaxPY = isEndgame ? 800 : isSprint ? 2000 : 999999;

    const upliftRaw = scored
      .filter((a: any) => (a.cyQ?.["1"]||0) > 0 && (a.pyQ?.["1"]||0) > (a.cyQ?.["1"]||0))
      .map((a: any) => scoreAccount(a, "uplift"));

    const darkRaw = scored
      .filter((a: any) => (a.cyQ?.["1"]||0) === 0 && (a.pyQ?.["1"]||0) > 200 && (a.pyQ?.["1"]||0) <= darkMaxPY)
      .map((a: any) => scoreAccount(a, "dark"));

    const allCandidates = [...new Map([...upliftRaw, ...darkRaw].map((a: any) => [a.id, a])).values()];

    // ── VISIT LIST — cluster-aware routing ──
    // Step 1: Hard distance gate. >75 miles = call/dealer only, NOT a visit
    // unless the account has enough cluster value to justify the drive
    const VISIT_MAX_SOLO = 75;    // won't visit solo if farther than this
    const VISIT_MAX_CLUSTERED = 120; // will visit if 2+ accounts within 20mi of each other

    // Find accounts with GPS coords
    const withCoords = allCandidates.filter((a: any) => {
      const badger = BADGER[a.id] || BADGER[a.gId];
      return (badger?.lat && badger?.lng) || (a.lat && a.lng);
    }).map((a: any) => {
      const badger = BADGER[a.id] || BADGER[a.gId];
      return {...a, _lat: badger?.lat || a.lat, _lng: badger?.lng || a.lng};
    });

    // For each candidate, find how many other accounts are within 20 miles
    const clustered = allCandidates.map((a: any) => {
      const badger = BADGER[a.id] || BADGER[a.gId];
      const aLat = badger?.lat || a.lat;
      const aLng = badger?.lng || a.lng;

      // Count nearby accounts with gaps
      const nearbyAccounts = withCoords.filter((b: any) => {
        if (b.id === a.id) return false;
        const d = distMiles(aLat, aLng);
        const dB = distMiles(b._lat, b._lng);
        // Both within 20 miles of each other AND both have meaningful gaps
        return Math.abs(d - dB) < 20 && b.ask > 200;
      });

      const clusterValue = nearbyAccounts.reduce((s: number, b: any) => s + b.ask * b.prob, 0);
      const clusterCount = nearbyAccounts.length;

      // Determine if this account qualifies for a visit
      const solo = a.miles < VISIT_MAX_SOLO;
      const clusteredVisit = a.miles < VISIT_MAX_CLUSTERED && clusterCount >= 2;
      const visitEligible = solo || clusteredVisit;

      // Visit score: heavily penalize far solo accounts
      let adjustedVisitScore = a.visitScore;
      if (!visitEligible) adjustedVisitScore = 0; // force to call list
      else if (a.miles > 60 && clusterCount >= 2) adjustedVisitScore *= 1.2; // bonus for clusters worth driving to

      return {
        ...a, clusterCount, clusterValue, visitEligible, adjustedVisitScore,
        nearbyAccounts: nearbyAccounts.slice(0,8), // full objects for trip planner
        nearbyNames: nearbyAccounts.slice(0,3).map((b: any) => b.name),
        signals: [
          ...(a.signals||[]),
          clusterCount >= 2 ? `${clusterCount} nearby accts` : null,
          !visitEligible && a.miles > 75 ? `${Math.round(a.miles)}mi — call instead` : null,
        ].filter(Boolean),
      };
    });

    // Visit list: only visit-eligible, sorted by adjustedVisitScore
    const visitList = clustered
      .filter((a: any) => a.visitEligible && a.track === "uplift")
      .sort((a: any, b: any) => b.adjustedVisitScore - a.adjustedVisitScore)
      .slice(0, 5);

    // ── CALL LIST — far accounts + dark + remaining uplift ──
    // Far accounts that got blocked from visit list go here
    const visitIds = new Set(visitList.map((a: any) => a.id));
    const callCandidates = clustered
      .filter((a: any) => !visitIds.has(a.id))
      .sort((a: any, b: any) => b.callScore - a.callScore);
    const callList = callCandidates.slice(0, 10);

    // ── DEALER PUSH ──
    const dealerGroups: Record<string, any[]> = {};
    clustered.forEach((a: any) => {
      if (a.dealer && a.dealer !== "Unknown") {
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

    // ── PROJECTIONS ──
    const allTargets = clustered;
    const doneTotal = Object.values(odDone).reduce((s, v: any) => s + (v.amt || 0), 0);
    const pending = allTargets.filter((a: any) => !odDone[a.id]);
    const conservative = doneTotal + pending.reduce((s: number, a: any) => s + a.ask * Math.min(a.prob * 0.65, 1), 0);
    const base = doneTotal + pending.reduce((s: number, a: any) => s + a.ask * a.prob, 0);
    const aggressive = doneTotal + pending.reduce((s: number, a: any) => s + a.ask * Math.min(a.prob * 1.35, 1), 0);

    return { visitList, callList, dealerActions, conservative, base, aggressive, doneTotal,
             totalTargets: allTargets.length, modeLabel, isEndgame, isSprint };
  }, [scored, odDone]);

  // ── Section 1: Q1 status
  const ahead = q1Att >= 1.0;
  const onTrack = !ahead && q1Att >= 0.85;
  const statusColor = ahead ? T.green : onTrack ? T.amber : T.red;
  const statusLabel = ahead ? "Ahead of Target" : onTrack ? "On Track" : "Behind Target";
  const statusBg = ahead ? "rgba(52,211,153,.08)" : onTrack ? "rgba(251,191,36,.08)" : "rgba(248,113,113,.08)";
  const statusBorder = ahead ? "rgba(52,211,153,.18)" : onTrack ? "rgba(251,191,36,.18)" : "rgba(248,113,113,.18)";

  // ── Search filter — matches office name, city, state, group name
  const q = search.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!q) return [];
    return scored.filter(a =>
      a.name?.toLowerCase().includes(q) ||
      a.city?.toLowerCase().includes(q) ||
      a.st?.toLowerCase().includes(q) ||
      a.addr?.toLowerCase().includes(q) ||
      a.gName?.toLowerCase().includes(q) ||
      (a.city && a.st && `${a.city} ${a.st}`.toLowerCase().includes(q))
    ).slice(0, 30);
  }, [q, scored]);

  // ── Section 2: Wins & Momentum
  const growing = scored
    .filter(a => (a.cyQ?.["1"]||0) > 0 && (a.pyQ?.["1"]||0) > 0 && (a.cyQ?.["1"]||0) > (a.pyQ?.["1"]||0))
    .sort((a,b) => ((b.cyQ?.["1"]||0)-(b.pyQ?.["1"]||0)) - ((a.cyQ?.["1"]||0)-(a.pyQ?.["1"]||0)))
    .slice(0,5);
  const healthyAccel = scored
    .filter(a => isAccelTier(a.gTier||a.tier) && a.ret >= 0.6 && (a.cyQ?.["1"]||0) > 0)
    .sort((a,b) => (b.cyQ?.["1"]||0) - (a.cyQ?.["1"]||0))
    .slice(0,5);

  // ── Section 3: Group-first action list — uses scopedGroups (scope-aware)
  // scoredGroups is now scopedGroups defined above with scope state

  // ── Group health lookup: gId → {totalPY, totalCY, isHealthy}
  const groupHealthMap = useMemo(() => {
    const map: Record<string,{totalPY:number,totalCY:number,isHealthy:boolean}> = {};
    scopedGroups.forEach((g:any) => {
      map[g.gId] = {
        totalPY: g.totalPY,
        totalCY: g.totalCY,
        isHealthy: g.totalCY >= g.totalPY,
      };
    });
    return map;
  }, [scopedGroups]);

  const isGroupAccount = (a:any) => {
    const grp = (groups||[]).find((g:any) => g.id === a.gId);
    return grp && grp.locs > 1;
  };

  const suppressedByRule = (a:any): "none"|"rule1"|"rule2" => {
    // Rule 1: multi-dealer private practice, combined on track (only meaningful for Q scopes)
    if (scope !== "FY" && a.hasSiblings && a.combinedPY > 0 && a.combinedCY >= a.combinedPY) return "rule1";
    // Rule 2: child of a multi-location group where group overall is healthy
    if (a.gId && isGroupAccount(a)) {
      const gh = groupHealthMap[a.gId];
      if (gh && gh.isHealthy) return "rule2";
    }
    return "none";
  };

  const hotGroups = scopedGroups
    .filter((g:any) => g.totalCY < g.totalPY)
    .filter((g:any) => g.maxScore >= 50)
    .slice(0,12);
  const followGroups = scopedGroups
    .filter((g:any) => g.totalCY < g.totalPY)
    .filter((g:any) => g.maxScore >= 20 && g.maxScore < 50)
    .slice(0,12);

  // ── Group Watch: healthy-group children that are individually underperforming
  // These are lower priority than a genuinely down account, but still worth flagging
  const groupWatch = useMemo(() => {
    return scopedScored
      .filter((a:any) => {
        if (!a.gId || !isGroupAccount(a)) return false;
        const gh = groupHealthMap[a.gId];
        if (!gh || !gh.isHealthy) return false;
        return (a.gap || 0) > 200 && a.score >= 20;
      })
      .sort((a:any,b:any) => (b.gap||0) - (a.gap||0))
      .slice(0,15);
  }, [scopedScored, groupHealthMap]);

  const hot = scopedScored.filter((a:any) => suppressedByRule(a) === "none" && a.score >= 50).slice(0,10);
  const followUp = scopedScored.filter((a:any) => suppressedByRule(a) === "none" && a.score >= 20 && a.score < 50).slice(0,10);

  // ── Group-first action card for Today tab
  const GroupActionCard = ({g, i, isHot, goAcct, goGroup, groups}: any) => {
    const [expanded, setExpanded] = useState(false);
    const gap = g.totalGap;
    const ret = Math.round(g.totalRet * 100);
    const worstChildren = g.children.filter((c:any) => (c.gap||0) > 0).slice(0,5);
    const topChild = worstChildren[0];
    // Find full group object for goGroup
    const fullGroup = (groups||[]).find((gr:any) => gr.id === g.gId);
    return (
      <div className="anim" style={{animationDelay:`${i*25}ms`,background:T.s1,
        border:`1px solid ${isHot?"rgba(248,113,113,.18)":T.b1}`,
        borderRadius:14,padding:"12px 14px",marginBottom:8}}>
        {/* Group header row */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
          <div style={{flex:1,minWidth:0,cursor:"pointer"}} onClick={()=>fullGroup&&goGroup(fullGroup)}>
            <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:2}}>
              <span style={{fontSize:10,fontWeight:700,color:isHot?T.red:T.amber,
                background:isHot?"rgba(248,113,113,.08)":"rgba(251,191,36,.08)",
                borderRadius:4,padding:"2px 6px"}}>{g.maxScore}pt</span>
              <span style={{fontSize:10,color:T.t4}}>{g.children.length} loc{g.children.length>1?"s":""}</span>
              {isAccelTier(g.gTier)&&<span style={{fontSize:9,color:T.amber}}>{normalizeTier(g.gTier)}</span>}
            </div>
            <div style={{fontSize:13,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:T.t1}}>{g.gName}</div>
          </div>
          <div style={{textAlign:"right",flexShrink:0,marginLeft:12}}>
            <div className="m" style={{fontSize:13,fontWeight:700,color:gap>0?T.red:T.green}}>{gap>0?`-${$$(gap)}`:$$(Math.abs(gap))}</div>
            <div className="m" style={{fontSize:10,color:T.t4}}>{ret}% ret</div>
          </div>
        </div>
        {/* Top hurting child — only show when group has multiple locations */}
        {topChild&&g.children.length>1&&<div style={{borderTop:`1px solid ${T.b2}`,paddingTop:6,marginTop:2}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}
            onClick={()=>goAcct({...topChild,gName:g.gName,gId:g.gId,gTier:g.gTier})}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:4}}>
                <span style={{fontSize:8,color:T.red,fontWeight:700}}>▼</span>
                <span style={{fontSize:11,fontWeight:600,color:T.t1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{topChild.name}</span>
                {topChild.dealer&&topChild.dealer!=="Unknown"&&<span style={{fontSize:9,color:T.cyan,flexShrink:0}}>· {topChild.dealer}</span>}
              </div>
              {/* Down products on worst child */}
              {(topChild.products||[]).filter((p:any)=>(p.py1||p.pyQ?.["1"]||0)>100&&(p.cy1||p.cyQ?.["1"]||0)===0).slice(0,3).map((p:any,j:number)=>(
                <span key={j} style={{fontSize:8,color:T.red,background:"rgba(248,113,113,.06)",borderRadius:3,padding:"1px 4px",marginRight:3,border:"1px solid rgba(248,113,113,.1)"}}>{p.n?.split(" ")[0]} $0</span>
              ))}
            </div>
            <div style={{flexShrink:0,marginLeft:8,textAlign:"right"}}>
              <span className="m" style={{fontSize:11,fontWeight:700,color:T.red}}>-{$$((topChild.gap||0))}</span>
              <Chev/>
            </div>
          </div>
        </div>}
        {/* Expand/collapse remaining children */}
        {worstChildren.length>1&&<>
          <button onClick={()=>setExpanded(!expanded)}
            style={{width:"100%",marginTop:6,background:"none",border:"none",cursor:"pointer",
              fontSize:10,color:T.t4,textAlign:"left",padding:"2px 0",fontFamily:"inherit",
              display:"flex",alignItems:"center",gap:4}}>
            <span style={{color:T.blue}}>{expanded?"▲ Hide":"▼ Show"} {worstChildren.length-1} more location{worstChildren.length>2?"s":""}</span>
          </button>
          {expanded&&worstChildren.slice(1).map((c:any,j:number)=>(
            <div key={c.id} style={{borderTop:`1px solid ${T.b2}`,paddingTop:5,marginTop:5,
              display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}
              onClick={()=>goAcct({...c,gName:g.gName,gId:g.gId,gTier:g.gTier})}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:11,fontWeight:500,color:T.t2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</div>
                {c.dealer&&c.dealer!=="Unknown"&&<span style={{fontSize:9,color:T.cyan}}>{c.dealer}</span>}
              </div>
              <div style={{flexShrink:0,marginLeft:8,display:"flex",alignItems:"center",gap:4}}>
                <span className="m" style={{fontSize:11,fontWeight:600,color:T.red}}>-{$$(c.gap||0)}</span>
                <Chev/>
              </div>
            </div>
          ))}
        </>}
      </div>
    );
  };

  const AcctCard = ({a, i, showHot=false}) => {
    const dispGap = a.hasSiblings ? a.combinedGap : a.gap;
    const dispRet = a.hasSiblings && a.combinedPY > 0 ? a.combinedCY / a.combinedPY : a.ret;
    return (
    <button className="anim" onClick={()=>goAcct(a)}
      style={{animationDelay:`${i*25}ms`,width:"100%",textAlign:"left",background:T.s1,
        border:`1px solid ${showHot?"rgba(248,113,113,.18)":T.b1}`,borderRadius:14,
        padding:"12px 14px",marginBottom:8,cursor:"pointer"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:5}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap",marginBottom:3}}>
            <span className="m" style={{fontSize:10,fontWeight:700,
              color:a.score>=60?T.red:a.score>=40?T.amber:T.t3,
              background:a.score>=60?"rgba(248,113,113,.08)":a.score>=40?"rgba(251,191,36,.08)":T.s2,
              borderRadius:4,padding:"2px 6px"}}>{a.score}pt</span>
            {showHot&&<span style={{fontSize:8,color:T.red,fontWeight:700,background:"rgba(248,113,113,.08)",borderRadius:4,padding:"1px 4px"}}>HOT</span>}
            {a.adjCount>0&&<span style={{fontSize:9,color:T.green,background:"rgba(52,211,153,.08)",borderRadius:4,padding:"2px 5px"}}>+adj</span>}
            {a.hasSiblings&&<span style={{fontSize:8,color:T.cyan,background:"rgba(34,211,238,.08)",border:`1px solid rgba(34,211,238,.2)`,borderRadius:4,padding:"1px 5px",fontWeight:700}}>+{a.siblingCount} dealer{a.siblingCount>1?"s":""}</span>}
          </div>
          <AccountId name={a.name} gName={a.gName} size="md"/>
          <div style={{fontSize:10,color:T.t3,marginTop:2}}>{a.city}, {a.st} · {isAccelTier(a.gTier||a.tier)?<span style={{color:T.amber}}>{normalizeTier(a.gTier||a.tier)}</span>:"Private"}</div>
        </div>
        <div style={{textAlign:"right",flexShrink:0,marginLeft:12}}>
          <div className="m" style={{fontSize:12,fontWeight:700,color:dispGap>0?T.red:T.green}}>{dispGap>0?`-${$$(dispGap)}`:$$(Math.abs(dispGap))}</div>
          <div className="m" style={{fontSize:10,color:T.t4}}>{pc(dispRet)} ret{a.hasSiblings&&<span style={{color:T.cyan}}> all</span>}</div>
        </div>
        <Chev/>
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
        {(a.reasons||[]).slice(0,4).map((r,j)=><span key={j} style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:9,color:T.t2,background:"rgba(255,255,255,.06)",borderRadius:4,padding:"2px 7px",border:"1px solid rgba(255,255,255,.14)",fontWeight:500}}>{r.label}<span style={{color:T.amber,fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>+{r.pts}</span></span>)}
      </div>
    </button>
  );};



  const SectionHeader = ({label, color, count, pulse=false}) => (
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,marginTop:4}}>
      <div style={{width:7,height:7,borderRadius:"50%",background:color,flexShrink:0,animation:pulse?"pulse 2s infinite":"none"}}/>
      <span style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1.2px",color}}>{label}</span>
      {count!=null&&<span style={{fontSize:10,color:T.t4,marginLeft:"auto"}}>{count}</span>}
    </div>
  );

  return <div style={{padding:"16px 16px 80px"}}>

    {/* ── SEARCH BAR ── */}
    <div style={{position:"relative",marginBottom:16}}>
      <svg style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",width:15,height:15,color:T.t4}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      <input type="search" value={search} onChange={e=>setSearch(e.target.value)}
        placeholder="Search by office name or city…"
        style={{width:"100%",height:42,borderRadius:12,border:`1px solid ${search?T.blue+"44":T.b1}`,background:T.s1,color:T.t1,fontSize:13,paddingLeft:38,paddingRight:search?36:12,outline:"none",fontFamily:"inherit"}}/>
      {search&&<button onClick={()=>setSearch("")} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:T.t4,cursor:"pointer",fontSize:16,lineHeight:1}}>✕</button>}
    </div>

    {/* ── SEARCH RESULTS ── */}
    {q ? <>
      <div style={{fontSize:10,color:T.t4,marginBottom:10}}>{searchResults.length} result{searchResults.length!==1?"s":""} for "{search}"</div>
      {searchResults.length===0&&<div style={{padding:"24px 0",textAlign:"center",color:T.t4,fontSize:12}}>No accounts found.</div>}
      {searchResults.map((a,i)=>{
        const py=a.pyQ?.["1"]||0; const cy=a.cyQ?.["1"]||0; const gap=py-cy;
        const ret=py>0?cy/py:0;
        return <button key={a.id} className="anim" onClick={()=>goAcct(a)}
          style={{animationDelay:`${i*15}ms`,width:"100%",textAlign:"left",background:T.s1,
            border:`1px solid ${T.b1}`,borderRadius:14,padding:"12px 14px",marginBottom:8,cursor:"pointer"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
            <div style={{flex:1,minWidth:0}}>
              <AccountId name={a.name} gName={a.gName} size="md"/>
              <div style={{fontSize:10,color:T.t3,marginTop:2}}>
                {a.addr ? a.addr + ', ' : ''}{a.city}, {a.st}
                {a.gName&&a.gName!==a.name&&<span style={{color:T.t4}}> · {a.gName}</span>}
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
            <Pill l="PY" v={$$(py)} c={T.t2}/>
            <Pill l="CY" v={$$(cy)} c={T.blue}/>
            {a.score>0&&<span className="m" style={{fontSize:9,fontWeight:700,color:a.score>=50?T.red:T.amber,background:a.score>=50?"rgba(248,113,113,.08)":"rgba(251,191,36,.08)",borderRadius:4,padding:"2px 6px"}}>{a.score}pt</span>}
          </div>
        </button>;
      })}
    </> :

    /* ── NORMAL TODAY CONTENT ── */
    <>
    {/* ── SCOPE SELECTOR + PROGRESS CARD ── */}
    <div className="anim" style={{background:`linear-gradient(135deg,${T.s1},rgba(79,142,247,.06))`,border:`1px solid ${T.b1}`,borderRadius:16,padding:16,marginBottom:16,boxShadow:"0 4px 24px rgba(0,0,0,.4)"}}>

      {/* Scope pills */}
      <div style={{display:"flex",gap:5,marginBottom:14}}>
        {(["1","2","3","4","FY"] as const).map(s => {
          const isActive = scope === s;
          const label = s === "FY" ? "FY" : `Q${s}`;
          return <button key={s} onClick={()=>setAndSaveScope(s)}
            style={{flex:1,padding:"5px 0",borderRadius:8,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
              border:`1px solid ${isActive?"rgba(79,142,247,.4)":T.b2}`,
              background:isActive?"rgba(79,142,247,.18)":T.s2,
              color:isActive?T.blue:T.t3,
              transition:"all 0.15s"}}>{label}</button>;
        })}
      </div>

      {scope === "1" ? <>
        {/* ── Q1 view: target attainment (existing logic) ── */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <span style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1.2px",color:T.t3}}>Q1 Progress</span>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:10,fontWeight:700,color:statusColor,background:statusBg,border:`1px solid ${statusBorder}`,borderRadius:999,padding:"2px 10px"}}>{statusLabel}</span>
            <span className="m" style={{fontSize:10,fontWeight:700,color:T.amber}}>{DAYS_LEFT}d left</span>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"baseline",gap:12,marginBottom:8}}>
          <span className="m" style={{fontSize:30,fontWeight:800,color:statusColor}}>{pc(q1Att)}</span>
          <span style={{fontSize:12,color:T.t3}}>{$$(q1CY)} / {$$(Q1_TARGET)}</span>
        </div>
        <Bar pct={q1Att*100} color={`linear-gradient(90deg,${statusColor},${ahead?T.cyan:onTrack?T.orange:T.red})`}/>
        {adjCount>0&&<div style={{marginTop:8,padding:"5px 10px",borderRadius:8,background:"rgba(52,211,153,.06)",border:"1px solid rgba(52,211,153,.12)",fontSize:10,color:T.green}}>+{adjCount} adj: +{$f(totalAdj)}</div>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:10}}>
          <div style={{borderRadius:8,background:"rgba(248,113,113,.06)",border:"1px solid rgba(248,113,113,.12)",padding:10}}>
            <div style={{fontSize:9,color:T.t3}}>Gap to close</div>
            <div className="m" style={{fontSize:16,fontWeight:700,color:q1Gap<=0?T.green:T.red}}>{q1Gap<=0?`+${$$(-q1Gap)}`:$$(q1Gap)}</div>
          </div>
          <div style={{borderRadius:8,background:"rgba(79,142,247,.06)",border:"1px solid rgba(79,142,247,.12)",padding:10}}>
            <div style={{fontSize:9,color:T.t3}}>$/day needed</div>
            <div className="m" style={{fontSize:16,fontWeight:700,color:T.blue}}>{$f(DAYS_LEFT>0&&q1Gap>0?q1Gap/DAYS_LEFT:0)}</div>
          </div>
        </div>
      </> : (() => {
        /* ── Non-Q1 view: PY vs CY comparison ── */
        const sPY = scopeTotals.py;
        const sCY = scopeTotals.cy;
        const sGap = sPY - sCY;
        const sRet = sPY > 0 ? sCY / sPY : 0;
        const sAhead = sCY >= sPY;
        const sColor = sAhead ? T.green : sRet >= 0.85 ? T.amber : T.red;
        const sLabel = scope === "FY"
          ? (sAhead ? "Ahead of PY" : `${Math.round(sRet*100)}% of PY pace`)
          : (sAhead ? `Q${scope} Ahead` : `Q${scope} Behind`);
        const scopeTitle = scope === "FY" ? "Full Year — CY vs PY" : `Q${scope} — CY vs PY`;
        return <>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <span style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1.2px",color:T.t3}}>{scopeTitle}</span>
            <span style={{fontSize:10,fontWeight:700,color:sColor,background:sAhead?"rgba(52,211,153,.08)":"rgba(248,113,113,.08)",border:`1px solid ${sAhead?"rgba(52,211,153,.2)":"rgba(248,113,113,.2)"}`,borderRadius:999,padding:"2px 10px"}}>{sLabel}</span>
          </div>
          <div style={{display:"flex",alignItems:"baseline",gap:12,marginBottom:8}}>
            <span className="m" style={{fontSize:30,fontWeight:800,color:sColor}}>{Math.round(sRet*100)}%</span>
            <span style={{fontSize:12,color:T.t3}}>of prior year</span>
          </div>
          <Bar pct={Math.min(sRet*100,100)} color={`linear-gradient(90deg,${sColor},${sAhead?T.cyan:T.red})`}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:10}}>
            <div style={{borderRadius:8,background:T.s2,border:`1px solid ${T.b1}`,padding:10}}>
              <div style={{fontSize:9,color:T.t3}}>Prior Year</div>
              <div className="m" style={{fontSize:14,fontWeight:700,color:T.t2}}>{$$(sPY)}</div>
            </div>
            <div style={{borderRadius:8,background:T.s2,border:`1px solid ${T.b1}`,padding:10}}>
              <div style={{fontSize:9,color:T.t3}}>Current Year</div>
              <div className="m" style={{fontSize:14,fontWeight:700,color:T.blue}}>{$$(sCY)}</div>
            </div>
            <div style={{borderRadius:8,background:sAhead?"rgba(52,211,153,.06)":"rgba(248,113,113,.06)",border:`1px solid ${sAhead?"rgba(52,211,153,.12)":"rgba(248,113,113,.12)"}`,padding:10}}>
              <div style={{fontSize:9,color:T.t3}}>{sAhead?"Ahead":"Gap"}</div>
              <div className="m" style={{fontSize:14,fontWeight:700,color:sColor}}>{sAhead?"+":"-"}{$$(Math.abs(sGap))}</div>
            </div>
          </div>
          {scope === "FY" && sPY > 0 && <div style={{marginTop:10,padding:"6px 10px",borderRadius:8,background:"rgba(79,142,247,.06)",border:"1px solid rgba(79,142,247,.12)",fontSize:10,color:T.t3}}>
            Accounts below show YTD gaps vs prior year — action list reflects full-year performance
          </div>}
        </>;
      })()}
    </div>

    {/* ── OVERDRIVE — Q1 only ── */}
    {scope === "1" && overdrive&&DAYS_LEFT>0&&q1Gap>0&&<div className="anim" style={{marginBottom:16}}>
      {/* Overdrive toggle header */}
      <button onClick={toggleOd} style={{
        width:"100%", textAlign:"left", cursor:"pointer", fontFamily:"inherit",
        background: odOpen
          ? `linear-gradient(135deg,rgba(251,191,36,.12),rgba(251,191,36,.04))`
          : T.s1,
        border: `1px solid ${odOpen ? "rgba(251,191,36,.35)" : T.b2}`,
        borderRadius: odOpen ? "14px 14px 0 0" : 14,
        padding:"12px 14px",
        transition:"all 0.2s",
        marginBottom: odOpen ? 0 : 0,
      }}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:7}}>
            <span style={{fontSize:16, filter: odOpen ? "none" : "grayscale(1)", opacity: odOpen ? 1 : 0.4}}>⚡</span>
            <span style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",
              color: odOpen ? T.amber : T.t4,
              transition:"color 0.2s",
            }}>Overdrive</span>
            <span style={{fontSize:9,color: odOpen ? T.amber : T.t4,
              background: odOpen ? "rgba(251,191,36,.1)" : T.s2,
              borderRadius:999,padding:"2px 8px",
              transition:"all 0.2s",
            }}>{overdrive.modeLabel} · {DAYS_LEFT}d · {overdrive.totalTargets} targets</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {overdrive.doneTotal>0&&<span style={{fontSize:10,fontWeight:700,color:T.green}}>+{$f(overdrive.doneTotal)}</span>}
            <span style={{fontSize:12,color: odOpen ? T.amber : T.t4,
              transform: odOpen ? "rotate(0deg)" : "rotate(-90deg)",
              transition:"transform 0.2s, color 0.2s",
              display:"inline-block",
            }}>▼</span>
          </div>
        </div>
        {!odOpen&&<div style={{fontSize:10,color:T.t4,marginTop:3}}>
          Tap to activate your end-of-quarter game plan
        </div>}
      </button>

      {/* Overdrive content — only shown when open */}
      {odOpen&&<div style={{
        background:`linear-gradient(180deg,rgba(251,191,36,.04) 0%,transparent 60%)`,
        border:"1px solid rgba(251,191,36,.2)",
        borderTop:"none",
        borderRadius:"0 0 14px 14px",
        padding:"12px 14px 14px",
      }}>

      {/* Projected landing */}
      <div style={{background:`linear-gradient(135deg,${T.s1},rgba(251,191,36,.05))`,border:"1px solid rgba(251,191,36,.15)",borderRadius:14,padding:12,marginBottom:10}}>
        <div style={{fontSize:9,textTransform:"uppercase",color:T.t4,letterSpacing:"1px",marginBottom:8}}>Projected Q1 Landing from Overdrive</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
          {[
            {label:"Conservative",val:q1CY+overdrive.conservative,color:T.amber},
            {label:"Base",val:q1CY+overdrive.base,color:T.blue},
            {label:"Best Case",val:q1CY+overdrive.aggressive,color:T.green},
          ].map(s=>(
            <div key={s.label} style={{borderRadius:8,background:T.s2,padding:"8px 6px",textAlign:"center"}}>
              <div style={{fontSize:9,color:T.t3,marginBottom:3}}>{s.label}</div>
              <div className="m" style={{fontSize:11,fontWeight:800,color:s.val>=Q1_TARGET?T.green:s.color}}>{$$(s.val)}</div>
              <div style={{fontSize:8,color:s.val>=Q1_TARGET?T.green:T.t4,marginTop:1}}>{s.val>=Q1_TARGET?"✓ hits target":`${$$(Q1_TARGET-s.val)} short`}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Visit Today */}
      {overdrive.visitList.length>0&&<div style={{marginBottom:10}}>
        <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.cyan,marginBottom:6,display:"flex",alignItems:"center",gap:5}}>
          <span>🚗</span> Visit Today — {overdrive.visitList.length} stops
        </div>
        {overdrive.visitList.map((a,i)=>{
          const done = odDone[a.id];
          return <div key={a.id} className="anim" style={{animationDelay:`${i*20}ms`,marginBottom:6}}>
            <button onClick={()=>goAcct(a)} style={{width:"100%",textAlign:"left",background:done?"rgba(52,211,153,.06)":T.s1,
              border:`1px solid ${done?"rgba(52,211,153,.2)":"rgba(34,211,238,.15)"}`,borderRadius:12,padding:"10px 12px",cursor:"pointer",
              display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
                  textDecoration:done?"line-through":"none",color:done?T.t3:T.t1}}>{a.name}</div>
                {a.gName&&a.gName!==a.name&&<div style={{fontSize:9,color:T.cyan,marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:600,letterSpacing:".2px"}}>{a.gName}</div>}
                <div style={{fontSize:10,color:T.t3,marginTop:1}}>{a.city}, {a.st} · Ask <span style={{color:T.amber,fontWeight:700}}>{$f(a.ask)}</span> · {Math.round(a.prob*100)}% likely</div>
              {a.clusterCount>=2&&<div style={{display:"flex",alignItems:"center",gap:8,marginTop:4}}>
                <div style={{fontSize:9,color:T.cyan}}>📍 {a.clusterCount} other accounts nearby</div>
                <button onClick={e=>{e.stopPropagation();setTripAnchor(a);}} style={{background:"rgba(34,211,238,.1)",border:"1px solid rgba(34,211,238,.25)",borderRadius:6,padding:"2px 8px",fontSize:9,fontWeight:700,color:T.cyan,cursor:"pointer",fontFamily:"inherit"}}>Plan Trip →</button>
              </div>}
              {a.signals?.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:3,marginTop:4}}>
                {a.signals.slice(0,4).map((s:string,si:number)=>(
                  <span key={si} style={{fontSize:9,color:T.t2,background:"rgba(255,255,255,.06)",borderRadius:4,padding:"2px 7px",border:"1px solid rgba(255,255,255,.14)",fontWeight:500}}>{s}</span>
                ))}
              </div>}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0,marginLeft:8}}>
                {done
                  ? <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:1}}>
                      <span style={{fontSize:10,fontWeight:700,color:done.outcome==="lost"?T.red:T.green}}>{done.outcome==="lost"?"✗ Lost":`${$f(done.amt)} ✓`}</span>
                      {done.note&&<span style={{fontSize:9,color:T.t3,maxWidth:90,textAlign:"right",lineHeight:1.3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{done.note}</span>}
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

      {/* Call List */}
      {overdrive.callList.length>0&&<div style={{marginBottom:10}}>
        <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.purple,marginBottom:6,display:"flex",alignItems:"center",gap:5}}>
          <span>📞</span> Call List — {overdrive.callList.length} accounts
        </div>
        {overdrive.callList.map((a,i)=>{
          const done = odDone[a.id];
          const isDark = a.track === "dark";
          return <button key={a.id} className="anim" onClick={()=>goAcct(a)}
            style={{animationDelay:`${i*15}ms`,width:"100%",textAlign:"left",background:done?"rgba(52,211,153,.04)":T.s1,
              border:`1px solid ${done?"rgba(52,211,153,.15)":isDark?"rgba(248,113,113,.15)":"rgba(167,139,250,.15)"}`,
              borderRadius:12,padding:"9px 12px",marginBottom:5,cursor:"pointer",
              display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
                textDecoration:done?"line-through":"none",color:done?T.t3:T.t1}}>{a.name}</div>
              {a.gName&&a.gName!==a.name&&<div style={{fontSize:9,color:T.cyan,marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:600,letterSpacing:".2px"}}>{a.gName}</div>}
              <div style={{fontSize:10,color:T.t3,marginTop:1}}>
                {isDark
                  ? <span style={{color:T.red}}>⚠ Gone dark — </span>
                  : <span style={{color:T.purple}}>Partial buyer — </span>
                }
                <span style={{color:T.amber,fontWeight:700}}>{$f(a.ask)}</span> ask · {Math.round(a.prob*100)}% likely
              </div>
              {a.signals?.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:3,marginTop:4}}>
                {a.signals.slice(0,4).map((s:string,si:number)=>(
                  <span key={si} style={{fontSize:9,color:T.t2,background:"rgba(255,255,255,.06)",borderRadius:4,padding:"2px 7px",border:"1px solid rgba(255,255,255,.14)",fontWeight:500}}>{s}</span>
                ))}
              </div>}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:5,flexShrink:0,marginLeft:8}}>
              {done
                ? <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:1}}>
                    <span style={{fontSize:10,fontWeight:700,color:done.outcome==="lost"?T.red:T.green}}>{done.outcome==="lost"?"✗ Lost":`${$f(done.amt)} ✓`}</span>
                    {done.note&&<span style={{fontSize:9,color:T.t3,maxWidth:90,textAlign:"right",lineHeight:1.3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{done.note}</span>}
                  </div>
                : <>
                    <button onClick={e=>promptOutcome(e,a.id,"won",a.ask)} style={{background:"rgba(52,211,153,.12)",border:"1px solid rgba(52,211,153,.25)",borderRadius:6,padding:"3px 8px",fontSize:9,fontWeight:700,color:T.green,cursor:"pointer",fontFamily:"inherit"}}>✓</button>
                    <button onClick={e=>promptOutcome(e,a.id,"lost",0)} style={{background:"rgba(248,113,113,.08)",border:"1px solid rgba(248,113,113,.2)",borderRadius:6,padding:"3px 8px",fontSize:9,fontWeight:700,color:T.red,cursor:"pointer",fontFamily:"inherit"}}>✗</button>
                  </>
              }
              {done&&<button onClick={e=>{e.stopPropagation();clearDone(a.id);}} style={{background:"none",border:"none",color:T.t4,cursor:"pointer",fontSize:12}}>↩</button>}
              <Chev/>
            </div>
          </button>;
        })}
      </div>}

      {/* Dealer Actions */}
      {overdrive.dealerActions.length>0&&<div>
        <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.blue,marginBottom:6,display:"flex",alignItems:"center",gap:5}}>
          <span>🤝</span> Dealer Push
        </div>
        {overdrive.dealerActions.map((d,i)=>(
          <div key={d.dealer} className="anim" style={{animationDelay:`${i*20}ms`,background:T.s1,
            border:"1px solid rgba(79,142,247,.15)",borderRadius:12,padding:"10px 12px",marginBottom:6}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
              <span style={{fontSize:11,fontWeight:700,color:T.blue}}>{d.dealer}</span>
              <span style={{fontSize:10,color:T.amber,fontWeight:700}}>{$f(d.totalAsk)} potential</span>
            </div>
            <div style={{fontSize:10,color:T.t3}}>Ask your {d.dealer} DSM to push reorder on:</div>
            {d.accts.map(a=><div key={a.id} style={{fontSize:10,color:T.t2,marginTop:3,paddingLeft:8}}>· {a.name} ({a.city}) — {$f(a.ask)}</div>)}
          </div>
        ))}
      </div>}
      </div>}  {/* close odOpen content */}
    </div>}  {/* close overdrive outer */}

    {/* ── TRIP PLANNER MODAL ── */}
    {tripAnchor&&(()=>{
      const anchor = tripAnchor;
      const nearby = anchor.nearbyAccounts || [];
      const allStops = [anchor, ...nearby].filter(Boolean);
      const totalAsk = allStops.reduce((s:number,a:any)=>s+(a.ask||0),0);
      const totalExpected = allStops.reduce((s:number,a:any)=>s+(a.ask||0)*(a.prob||0),0);

      // Build Google Maps multi-stop route from Thomaston
      const buildRoute = () => {
        const stops = allStops
          .map((a:any) => {
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
          {/* Header */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
            <div>
              <div style={{fontSize:13,fontWeight:700}}>Trip Plan</div>
              <div style={{fontSize:10,color:T.t3,marginTop:1}}>{allStops.length} stops · {$f(totalAsk)} ask · {$f(totalExpected)} expected</div>
            </div>
            <button onClick={()=>setTripAnchor(null)} style={{background:"none",border:"none",color:T.t4,cursor:"pointer",fontSize:18}}>✕</button>
          </div>

          {/* Route button */}
          <button onClick={buildRoute} style={{width:"100%",background:`linear-gradient(90deg,${T.blue},${T.cyan})`,border:"none",borderRadius:10,padding:"10px 0",fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer",fontFamily:"inherit",marginBottom:14,marginTop:8}}>
            🗺 Open Full Route in Google Maps
          </button>

          {/* Stop list */}
          <div style={{overflowY:"auto",flex:1}}>
            {allStops.map((a:any,i:number)=>{
              const done = odDone[a.id];
              const isAnchor = i===0;
              return <div key={a.id} style={{background:isAnchor?`rgba(251,191,36,.06)`:T.s2,
                border:`1px solid ${isAnchor?"rgba(251,191,36,.25)":T.b1}`,
                borderRadius:12,padding:"10px 12px",marginBottom:8,
              }}>
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
          placeholder={odNotePrompt.outcome==="won"?"e.g. Dr. committed to SonicFill 3 trial, reorder in 2 wks":odNotePrompt.outcome==="partial"?"e.g. Ordered MaxCem, passed on composites":"e.g. On contract through Q3, revisit then"}
          style={{width:"100%",height:44,borderRadius:10,border:`1px solid ${T.b1}`,background:T.s2,color:T.t1,fontSize:13,padding:"0 12px",outline:"none",fontFamily:"inherit",marginBottom:12,boxSizing:"border-box"}}/>
        <button onClick={commitOutcome} style={{width:"100%",background:odNotePrompt.outcome==="won"?`linear-gradient(90deg,${T.green},${T.cyan})`:odNotePrompt.outcome==="partial"?`linear-gradient(90deg,${T.amber},rgba(251,191,36,.7))`:`linear-gradient(90deg,${T.red},rgba(248,113,113,.7))`,border:"none",borderRadius:10,padding:"11px 0",fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer",fontFamily:"inherit"}}>
          {odNoteText.trim()?"Save Note & Log →":"Log Without Note →"}
        </button>
      </div>
    </div>}

    {/* ── SECTION 2: WINS & MOMENTUM ── */}
    <div className="anim" style={{background:`linear-gradient(135deg,${T.s1},rgba(52,211,153,.04))`,border:"1px solid rgba(52,211,153,.1)",borderRadius:16,padding:14,marginBottom:16}}>
      <SectionHeader label="Wins & Momentum" color={T.green}/>
      {growing.length===0&&healthyAccel.length===0&&(
        <div style={{fontSize:11,color:T.t4,padding:"8px 0"}}>Upload fresh CSV data to see momentum accounts.</div>
      )}
      {growing.length>0&&<>
        <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.t4,marginBottom:6}}>Growing vs Last Year</div>
        {growing.map((a,i)=>{
          const py=a.pyQ?.["1"]||0; const cy=a.cyQ?.["1"]||0; const lift=py>0?((cy-py)/py*100):0;
          return <button key={a.id} className="anim" onClick={()=>goAcct(a)}
            style={{animationDelay:`${i*20}ms`,display:"flex",alignItems:"center",justifyContent:"space-between",
              width:"100%",textAlign:"left",padding:"9px 12px",marginBottom:6,borderRadius:10,background:T.s2,
              border:"1px solid rgba(52,211,153,.15)",cursor:"pointer"}}>
            <div style={{flex:1,minWidth:0}}>
              <AccountId name={a.name} gName={a.gName} size="md"/>
              <div style={{fontSize:10,color:T.t3}}>{a.city}, {a.st}</div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0,marginLeft:12}}>
              <div style={{textAlign:"right"}}>
                <div className="m" style={{fontSize:12,fontWeight:700,color:T.green}}>+{$$(cy-py)}</div>
                <div style={{fontSize:9,color:T.green}}>+{lift.toFixed(0)}% vs PY</div>
              </div>
              <Chev/>
            </div>
          </button>;
        })}
      </>}
      {healthyAccel.length>0&&<>
        <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.t4,marginTop:growing.length>0?10:0,marginBottom:6}}>Healthy Accelerate Accounts</div>
        {healthyAccel.map((a,i)=>{
          const tier=normalizeTier(a.gTier||a.tier);
          return <button key={a.id} className="anim" onClick={()=>goAcct(a)}
            style={{animationDelay:`${i*20}ms`,display:"flex",alignItems:"center",justifyContent:"space-between",
              width:"100%",textAlign:"left",padding:"9px 12px",marginBottom:6,borderRadius:10,background:T.s2,
              border:"1px solid rgba(251,191,36,.15)",cursor:"pointer"}}>
            <div style={{flex:1,minWidth:0}}>
              <AccountId name={a.name} gName={a.gName} size="md"/>
              <div style={{fontSize:10,color:T.t3}}>{a.city}, {a.st} · <span style={{color:T.amber}}>{tier}</span></div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0,marginLeft:12}}>
              <div style={{textAlign:"right"}}>
                <div className="m" style={{fontSize:12,fontWeight:700,color:T.blue}}>{$$(a.cyQ?.["1"]||0)}</div>
                <div style={{fontSize:9,color:T.green}}>{pc(a.ret)} ret</div>
              </div>
              <Chev/>
            </div>
          </button>;
        })}
      </>}
    </div>

    {/* ── SECTION 3: GROUP-FIRST ACTION LIST ── */}
    <div>
      {hotGroups.length>0&&<>
        <SectionHeader label="Hot" color={T.red} count={`${hotGroups.length} group${hotGroups.length>1?"s":""}`} pulse={true}/>
        <div style={{fontSize:10,color:T.t4,marginBottom:10}}>{scope==="FY"?"Down vs prior year · highest gap":"Highest urgency · Act this week"}</div>
        <div>
          {hotGroups.map((g:any,i:number)=><GroupActionCard key={g.gId} g={g} i={i} isHot={true} goAcct={goAcct} goGroup={goGroup} groups={groups}/>)}
        </div>
      </>}
      {followGroups.length>0&&<>
        <div style={{marginTop:hotGroups.length>0?4:0}}>
          <SectionHeader label="Follow Up" color={T.amber} count={`${followGroups.length} group${followGroups.length>1?"s":""}`}/>
          <div style={{fontSize:10,color:T.t4,marginBottom:10}}>{scope==="FY"?"Moderate YTD gap vs prior year":"Worth a call this week"}</div>
          <div>
            {followGroups.map((g:any,i:number)=><GroupActionCard key={g.gId} g={g} i={i} isHot={false} goAcct={goAcct} goGroup={goGroup} groups={groups}/>)}
          </div>
        </div>
      </>}
      {hotGroups.length===0&&followGroups.length===0&&(
        <div style={{padding:"24px 0",textAlign:"center",color:T.t4,fontSize:12}}>No scored accounts — upload a CSV to get started.</div>
      )}

      {/* ── GROUP WATCH: healthy-group children individually underperforming ── */}
      {groupWatch.length>0&&<div style={{marginTop:16}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
          <span style={{fontSize:12,fontWeight:700,color:T.blue,letterSpacing:.5,textTransform:"uppercase"}}>Group Watch</span>
          <span style={{fontSize:10,color:T.t4,background:T.s2,borderRadius:10,padding:"1px 7px"}}>{groupWatch.length}</span>
        </div>
        <div style={{fontSize:10,color:T.t4,marginBottom:10,lineHeight:1.5}}>
          Individually down · parent group on track · may reflect bulk buying · lower priority unless a nearby sibling is over-performing
        </div>
        {groupWatch.map((a:any,i:number)=>{
          const badger = BADGER[a.id]||BADGER[a.gId]||null;
          const gh = groupHealthMap[a.gId];
          const grpRet = gh && gh.totalPY>0 ? Math.round(gh.totalCY/gh.totalPY*100) : null;
          return (
            <div key={a.id} className="anim" style={{animationDelay:`${i*30}ms`,background:T.s1,border:`1px solid rgba(79,142,247,.15)`,borderRadius:14,padding:"12px 14px",marginBottom:8,cursor:"pointer"}}
              onClick={()=>goAcct(a)}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                <div style={{flex:1,minWidth:0}}>
                  <AccountId name={a.name} gName={a.gName} size="md"/>
                  <div style={{fontSize:10,color:T.t3,marginTop:1}}>{ a.city||""}{a.dealer?<span style={{color:T.t4}}> · {a.dealer}</span>:""}</div>
                </div>
                <div style={{textAlign:"right",flexShrink:0,marginLeft:10}}>
                  <div style={{fontSize:13,fontWeight:700,color:T.amber}} className="m">−${Math.round(a.gap).toLocaleString()}</div>
                  <div style={{fontSize:10,color:T.t4}} className="m">{Math.round(a.ret*100)}% ret</div>
                </div>
              </div>
              {grpRet!==null&&<div style={{fontSize:10,color:T.t4,background:T.s2,borderRadius:6,padding:"3px 8px",display:"inline-flex",alignItems:"center",gap:4}}>
                <span style={{color:"rgba(52,211,153,.8)"}}>●</span>&nbsp;Group {grpRet}% · ${Math.round(gh!.totalCY).toLocaleString()} CY vs ${Math.round(gh!.totalPY).toLocaleString()} PY
              </div>}
              {badger?.feel&&<div style={{marginTop:6,fontSize:10,color:T.t3}}>Feel: {badger.feel}</div>}
            </div>
          );
        })}
      </div>}
    </div>
    </>}
  </div>;
}

export default TodayTab;
