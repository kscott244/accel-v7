"use client";
// @ts-nocheck

import { useMemo } from "react";
import { T, Q1_TARGET, DAYS_LEFT } from "@/lib/tokens";
import { $f } from "@/lib/format";
import { Bar, AccountId, Chev } from "@/components/primitives";

export default function EstTab({pct,setPct,q1CY,groups,goAcct}) {
  // Calculate PY base from actual data: sum of all Q1 PY spending that happened Mar 20-31
  // We approximate: Q1 PY total * (12/90) ≈ last ~12 days of Q1
  const q1PyTotal=groups.reduce((s,g)=>s+(g.pyQ?.["1"]||0),0);
  // ~13% of Q1 = last 12 days of March
  const pyBase=Math.round(q1PyTotal*12/90);
  const pyAccts=groups.reduce((s,g)=>s+g.children.filter(c=>(c.pyQ?.["1"]||0)>0).length,0);

  const est=pyBase*(pct/100);
  const proj=q1CY+est;
  const projAtt=proj/Q1_TARGET;
  const projGap=Q1_TARGET-proj;

  // Build call list: all children with PY Q1 spend, sorted by PY desc
  // These are the accounts that bought last year in this window — highest priority to call
  const callList = useMemo(() => {
    const accts = [];
    for (const g of groups) {
      for (const c of g.children) {
        const py = c.pyQ?.["1"] || 0;
        const cy = c.cyQ?.["1"] || 0;
        if (py > 0) accts.push({...c, gName: g.name, gId: g.id, gTier: g.tier, py, cy, gap: py - cy});
      }
    }
    return accts.sort((a,b) => b.py - a.py);
  }, [groups]);

  // Estimated share of PY per account (proportional)
  const pyTotalForList = callList.reduce((s,a) => s + a.py, 0);

  return <div style={{padding:"16px 16px 80px"}}>
    <div className="anim" style={{background:`linear-gradient(135deg,${T.s1},rgba(79,142,247,.04))`,border:`1px solid ${T.b1}`,borderRadius:16,padding:16,marginBottom:16}}>
      <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.blue,marginBottom:12}}>Q1 Completion Estimator</div>
      <div style={{fontSize:11,color:T.t3,marginBottom:16}}>Last year, <strong style={{color:T.t1}}>{pyAccts.toLocaleString()} accounts</strong> bought <strong style={{color:T.t1}}>{$f(pyBase)}</strong> credited in Mar 20-31. How much repeats?</div>
      <div style={{marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
          <span style={{fontSize:10,color:T.t4}}>50% of PY</span>
          <span className="m" style={{fontSize:14,fontWeight:800,color:pct>=100?T.green:T.amber}}>{pct}% repeat</span>
          <span style={{fontSize:10,color:T.t4}}>130% of PY</span>
        </div>
        <input type="range" min="50" max="130" value={pct} onChange={e=>setPct(parseInt(e.target.value))}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
        <div style={{background:T.s2,borderRadius:10,padding:12}}><div style={{fontSize:9,color:T.t4,marginBottom:2}}>Expected Mar 20-31</div><div className="m" style={{fontSize:18,fontWeight:800}}>{$f(est)}</div></div>
        <div style={{background:T.s2,borderRadius:10,padding:12}}><div style={{fontSize:9,color:T.t4,marginBottom:2}}>Projected Q1</div><div className="m" style={{fontSize:18,fontWeight:800,color:projAtt>=1?T.green:T.blue}}>{$f(proj)}</div></div>
      </div>
      <div style={{background:T.s2,borderRadius:10,padding:12}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:10,color:T.t3}}>Projected Attainment</span><span className="m" style={{fontSize:14,fontWeight:800,color:projAtt>=1?T.green:projAtt>=.9?T.amber:T.red}}>{(projAtt*100).toFixed(1)}%</span></div>
        <Bar pct={projAtt*100} color={projAtt>=1?`linear-gradient(90deg,${T.green},${T.cyan})`:`linear-gradient(90deg,${T.blue},${T.cyan})`}/>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:6,fontSize:10,color:T.t4}}><span>CY: {$f(q1CY)}</span><span>Target: {$f(Q1_TARGET)}</span></div>
      </div>
      {projGap>0?<div style={{marginTop:12,borderRadius:10,background:"rgba(248,113,113,.06)",border:"1px solid rgba(248,113,113,.12)",padding:12}}>
        <div style={{fontSize:11,color:T.red,fontWeight:600}}>Still {$f(projGap)} short</div>
        <div style={{fontSize:10,color:T.t3,marginTop:4}}>{$f(DAYS_LEFT>0?projGap/DAYS_LEFT:0)}/day beyond projections needed.</div>
      </div>:<div style={{marginTop:12,borderRadius:10,background:"rgba(52,211,153,.06)",border:"1px solid rgba(52,211,153,.12)",padding:12}}>
        <div style={{fontSize:11,color:T.green,fontWeight:600}}>On track! {$f(Math.abs(projGap))} over target.</div>
      </div>}
    </div>

    {/* ── CALL LIST ── */}
    {callList.length>0&&<div className="anim" style={{animationDelay:"80ms"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:10}}>
        <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.amber}}>Mar 20-31 Call List</div>
        <div style={{fontSize:10,color:T.t4}}>{callList.length} accounts · bought last year</div>
      </div>
      <div style={{fontSize:10,color:T.t3,marginBottom:12}}>These accounts spent in the last 12 days of Q1 last year. Highest priority to call this week.</div>
      {callList.slice(0,25).map((a,i)=>{
        const estAmt = pyTotalForList > 0 ? Math.round((a.py / pyTotalForList) * est) : 0;
        const hasCY = a.cy > 0;
        return <button key={a.id} className="anim" onClick={()=>goAcct&&goAcct(a)}
          style={{animationDelay:`${i*15}ms`,width:"100%",textAlign:"left",background:T.s1,
            border:`1px solid ${hasCY?"rgba(52,211,153,.15)":T.b1}`,
            borderRadius:12,padding:"10px 12px",marginBottom:7,cursor:"pointer"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div style={{flex:1,minWidth:0}}>
              <AccountId name={a.name} gName={a.gName} size="md"/>
              <div style={{fontSize:10,color:T.t3,marginTop:1}}>{a.city}, {a.st}
                {a.gName&&a.gName!==a.name&&<span style={{color:T.t4}}> · {a.gName}</span>}
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0,marginLeft:10}}>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:9,color:T.t4,marginBottom:1}}>PY spend</div>
                <div className="m" style={{fontSize:12,fontWeight:700,color:T.t1}}>{$f(a.py)}</div>
              </div>
              {hasCY
                ? <div style={{textAlign:"right"}}>
                    <div style={{fontSize:9,color:T.green,marginBottom:1}}>Already bought</div>
                    <div className="m" style={{fontSize:12,fontWeight:700,color:T.green}}>{$f(a.cy)}</div>
                  </div>
                : <div style={{textAlign:"right"}}>
                    <div style={{fontSize:9,color:T.amber,marginBottom:1}}>Est. opp.</div>
                    <div className="m" style={{fontSize:12,fontWeight:700,color:T.amber}}>{$f(estAmt)}</div>
                  </div>
              }
              <Chev/>
            </div>
          </div>
        </button>;
      })}
      {callList.length>25&&<div style={{fontSize:10,color:T.t4,textAlign:"center",padding:"8px 0"}}>+{callList.length-25} more accounts with PY Q1 spend</div>}
    </div>}

    <div style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:12,padding:12,fontSize:10,color:T.t3,marginTop:8}}>
      PY base ({$f(pyBase)}) is calculated from your actual Q1 2025 data — the last ~12 days of March spending. Slider models what percentage of that repeats this year.
    </div>
  </div>;
}
