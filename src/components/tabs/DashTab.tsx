"use client";
// @ts-nocheck

import { useState, useMemo } from "react";
import { T, Q1_TARGET } from "@/lib/tokens";
import { ACCEL_RATES, normalizeTier, isAccelTier, getTierRate, getTierLabel } from "@/lib/tier";
import { $$, $f, pc } from "@/lib/format";
import { SKU } from "@/data/sku-data";
import { fixGroupName, Stat, Bar, AccountId, Chev } from "@/components/primitives";

export default function DashTab({groups, q1CY, q1Att, q1Gap, scored, goAcct}) {
  const totalPY = groups.reduce((s,g) => s+(g.pyQ?.["1"]||0), 0);
  const totalLocs = groups.reduce((s,g) => s+g.locs, 0);
  const activeAccts = groups.reduce((s,g) => s+g.children.filter(c=>(c.cyQ?.["1"]||0)>0).length, 0);

  // Revenue by tier
  const tierRevenue = {Standard:0, Silver:0, Gold:0, Platinum:0, Diamond:0};
  groups.forEach(g => {
    g.children.forEach(c => {
      const cy = c.cyQ?.["1"]||0;
      if (cy <= 0) return;
      const t = normalizeTier(g.tier||c.tier);
      if (t in tierRevenue) tierRevenue[t] += cy;
      else tierRevenue["Standard"] += cy;
    });
  });
  const tierTotal = Object.values(tierRevenue).reduce((s,v)=>s+v,0)||1;
  const tierColors = {Standard:T.t3, Silver:T.cyan, Gold:T.amber, Platinum:T.purple, Diamond:T.blue};

  // Top 5 groups by CY
  const top5 = [...groups]
    .filter(g => (g.cyQ?.["1"]||0) > 0)
    .sort((a,b) => (b.cyQ?.["1"]||0)-(a.cyQ?.["1"]||0))
    .slice(0,5);

  // Q1 attainment status
  const ahead = q1Att >= 1.0;
  const onTrack = !ahead && q1Att >= 0.85;
  const statusColor = ahead ? T.green : onTrack ? T.amber : T.red;

  const [calcTier, setCalcTier] = useState("Standard");
  const [calcSearch, setCalcSearch] = useState("");
  const [calcSku, setCalcSku] = useState(null);
  const [calcSpend, setCalcSpend] = useState("");

  const calcIsAccel = isAccelTier(calcTier);
  const calcRate = getTierRate(calcTier);
  const calcResults = calcSearch.length>=2 ? SKU.filter(p=>{
    const q=calcSearch.toLowerCase();
    return p[0].toLowerCase().includes(q)||p[1].toLowerCase().includes(q)||p[2].toLowerCase().includes(q);
  }).slice(0,8) : [];

  const calc = useMemo(()=>{
    if(!calcSku||!calcSpend||parseFloat(calcSpend)<=0) return null;
    const spend=parseFloat(calcSpend);
    const [sku,desc,cat,stdWS,stdMSRP,diaWS,diaMSRP,platWS,platMSRP,goldWS,goldMSRP,silvWS,silvMSRP]=calcSku;
    let tierMSRP,tierWS;
    if(calcIsAccel){
      const t=calcTier.includes("-")?calcTier.split("-")[1]:calcTier;
      if(t==="Diamond"){tierMSRP=diaMSRP;tierWS=diaWS;}
      else if(t==="Platinum"){tierMSRP=platMSRP;tierWS=platWS;}
      else if(t==="Gold"){tierMSRP=goldMSRP;tierWS=goldWS;}
      else if(t==="Silver"){tierMSRP=silvMSRP;tierWS=silvWS;}
      else{tierMSRP=stdMSRP;tierWS=stdWS;}
    } else {tierMSRP=stdMSRP;tierWS=stdWS;}
    const units=spend/tierMSRP;
    const totalWS=stdWS*units;
    const totalCredited=tierWS*units;
    const totalCB=totalWS-totalCredited;
    return{units,totalWS,totalCredited,totalCB,tierMSRP,tierWS,stdMSRP,stdWS,desc,sku,cat};
  },[calcSku,calcSpend,calcTier,calcIsAccel]);

  return <div style={{padding:"16px 16px 80px"}}>

    {/* ── CY REVENUE + ATTAINMENT ── */}
    <div className="anim" style={{background:`linear-gradient(135deg,${T.s1},rgba(79,142,247,.06))`,border:`1px solid ${T.b1}`,borderRadius:16,padding:16,marginBottom:12,boxShadow:"0 4px 24px rgba(0,0,0,.4)"}}>
      <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1.2px",color:T.t3,marginBottom:12}}>Territory · Q1 {new Date().getFullYear()}</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        <div>
          <div style={{fontSize:9,color:T.t4,marginBottom:3}}>CY Revenue</div>
          <div className="m" style={{fontSize:22,fontWeight:800,color:T.t1}}>{$$(q1CY)}</div>
          <div style={{fontSize:10,color:T.t3,marginTop:2}}>vs {$$(totalPY)} PY</div>
        </div>
        <div>
          <div style={{fontSize:9,color:T.t4,marginBottom:3}}>Attainment</div>
          <div className="m" style={{fontSize:22,fontWeight:800,color:statusColor}}>{pc(q1Att)}</div>
          <div style={{fontSize:10,color:T.t3,marginTop:2}}>of {$$(778915)} target</div>
        </div>
      </div>
      <Bar pct={q1Att*100} color={`linear-gradient(90deg,${statusColor},${ahead?T.cyan:onTrack?T.orange:T.red})`}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:12}}>
        <div style={{borderRadius:8,background:T.s2,padding:8,textAlign:"center"}}>
          <div style={{fontSize:9,color:T.t4}}>Groups</div>
          <div className="m" style={{fontSize:14,fontWeight:700}}>{groups.length}</div>
        </div>
        <div style={{borderRadius:8,background:T.s2,padding:8,textAlign:"center"}}>
          <div style={{fontSize:9,color:T.t4}}>Locations</div>
          <div className="m" style={{fontSize:14,fontWeight:700}}>{totalLocs}</div>
        </div>
        <div style={{borderRadius:8,background:T.s2,padding:8,textAlign:"center"}}>
          <div style={{fontSize:9,color:T.t4}}>Active CY</div>
          <div className="m" style={{fontSize:14,fontWeight:700,color:T.green}}>{activeAccts}</div>
        </div>
      </div>
    </div>

    {/* ── REVENUE BY TIER ── */}
    <div className="anim" style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:14,padding:14,marginBottom:12}}>
      <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.t3,marginBottom:12}}>Revenue by Tier</div>
      {Object.entries(tierRevenue).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).map(([tier,rev])=>{
        const pct = rev/tierTotal*100;
        const col = tierColors[tier]||T.t3;
        return <div key={tier} style={{marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
            <span style={{fontSize:11,color:col,fontWeight:600}}>{tier==="Standard"?"Private Practice":`Accelerate ${tier}`}</span>
            <span className="m" style={{fontSize:11,color:T.t1,fontWeight:700}}>{$$(rev)}</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{flex:1}}><Bar pct={pct} color={`linear-gradient(90deg,${col},${col}88)`}/></div>
            <span style={{fontSize:9,color:T.t4,minWidth:32,textAlign:"right"}}>{pct.toFixed(0)}%</span>
          </div>
        </div>;
      })}
      {tierTotal===1&&<div style={{fontSize:11,color:T.t4}}>No data — upload a CSV.</div>}
    </div>

    {/* ── TOP 5 GROUPS ── */}
    <div className="anim" style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:14,padding:14,marginBottom:12}}>
      <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.t3,marginBottom:10}}>Top 5 Groups by CY Revenue</div>
      {top5.length===0&&<div style={{fontSize:11,color:T.t4}}>No data — upload a CSV.</div>}
      {top5.map((g,i)=>{
        const cy=g.cyQ?.["1"]||0; const py=g.pyQ?.["1"]||0;
        const up=cy>=py;
        return <div key={g.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:i<top5.length-1?`1px solid ${T.b1}`:"none"}}>
          <span className="m" style={{fontSize:11,color:T.t4,minWidth:16}}>#{i+1}</span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{fixGroupName(g)}</div>
            <div style={{fontSize:9,color:T.t3}}>{g.locs} loc · {getTierLabel(g.tier,g.class2)}</div>
          </div>
          <div style={{textAlign:"right",flexShrink:0}}>
            <div className="m" style={{fontSize:12,fontWeight:700,color:T.blue}}>{$$(cy)}</div>
            <div style={{fontSize:9,color:up?T.green:T.red}}>{up?"+":""}{$$(cy-py)} vs PY</div>
          </div>
        </div>;
      })}
    </div>

    {/* ── GAP LEADERBOARD ── */}
    {(()=>{
      const topGap = scored.filter(a=>(a.pyQ?.["1"]||0)>0&&a.gap>0).slice(0,10);
      if (!topGap.length) return null;
      const maxGap = topGap[0]?.gap||1;
      return <div className="anim" style={{background:T.s1,border:`1px solid rgba(248,113,113,.15)`,borderRadius:14,padding:14,marginBottom:12}}>
        <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.red,marginBottom:4}}>Gap Leaderboard — Top 10 Recovery Targets</div>
        <div style={{fontSize:10,color:T.t4,marginBottom:12}}>Accounts with the largest Q1 CY vs PY shortfall</div>
        {topGap.map((a,i)=>{
          const barPct = (a.gap/maxGap)*100;
          return <button key={a.id} onClick={()=>goAcct&&goAcct(a)} style={{display:"block",width:"100%",textAlign:"left",background:"none",border:"none",padding:0,marginBottom:10,cursor:"pointer"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:3}}>
              <div style={{flex:1,minWidth:0,display:"flex",alignItems:"center",gap:5}}>
                <span className="m" style={{fontSize:9,color:T.t4}}>#{i+1}</span>
                <span style={{fontSize:11,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}><AccountId name={a.name} size="sm"/></span>
                <span style={{fontSize:9,color:T.t3}}>{a.city}, {a.st}</span>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0,marginLeft:8}}>
                <span className="m" style={{fontSize:11,fontWeight:700,color:T.red}}>-{$$(a.gap)}</span>
                <span style={{fontSize:9,color:T.t4}}>{Math.round(a.ret*100)}% ret</span>
                <Chev/>
              </div>
            </div>
            <div style={{height:4,borderRadius:2,background:T.s3,overflow:"hidden"}}>
              <div style={{height:"100%",borderRadius:2,width:`${barPct}%`,background:`linear-gradient(90deg,${T.red},${T.orange})`}}/>
            </div>
          </button>;
        })}
      </div>;
    })()}

    {/* ── QUICK SALE CALCULATOR ── */}
    <div className="anim" style={{background:`linear-gradient(135deg,${T.s1},rgba(251,191,36,.04))`,border:`1px solid ${T.b1}`,borderRadius:16,padding:16,marginBottom:16}}>
      <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.amber,marginBottom:12}}>Quick Sale Calculator</div>
      <div style={{fontSize:11,color:T.t3,marginBottom:16}}>Search any Kerr product, enter doctor spend, see your credited revenue instantly.</div>
      <div style={{marginBottom:14}}>
        <label style={{fontSize:11,color:T.t1,display:"block",marginBottom:6,fontWeight:600}}>Account Tier</label>
        <div className="hide-sb" style={{display:"flex",gap:4,overflowX:"auto"}}>
          {["Standard","Top 100","Silver","Gold","Platinum","Diamond"].map(t=>(
            <button key={t} onClick={()=>setCalcTier(t)} style={{flexShrink:0,padding:"6px 12px",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",border:`1px solid ${calcTier===t?"rgba(251,191,36,.25)":T.b2}`,background:calcTier===t?"rgba(251,191,36,.08)":T.s2,color:calcTier===t?T.amber:T.t3,fontFamily:"inherit"}}>{t}{ACCEL_RATES[t]?` (${ACCEL_RATES[t]*100}%)`:""}</button>
          ))}
        </div>
      </div>
      <div style={{marginBottom:12}}>
        <label style={{fontSize:11,color:T.t1,display:"block",marginBottom:4,fontWeight:600}}>Search Product</label>
        {calcSku?<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",borderRadius:8,background:"rgba(79,142,247,.08)",border:"1px solid rgba(79,142,247,.2)"}}>
          <div><div style={{fontSize:12,fontWeight:600,color:T.t1}}>#{calcSku[0]} — {calcSku[1]}</div><div style={{fontSize:10,color:T.t3}}>{calcSku[2]} · Std MSRP ${calcSku[4]}</div></div>
          <button onClick={()=>{setCalcSku(null);setCalcSpend("");setCalcSearch("")}} style={{background:"none",border:"none",color:T.t4,cursor:"pointer",fontSize:16}}>✕</button>
        </div>:<div>
          <input type="text" value={calcSearch} onChange={e=>setCalcSearch(e.target.value)} placeholder="Type SKU# or product name..." style={{width:"100%",height:40,borderRadius:8,border:`1px solid ${T.b1}`,background:T.s1,color:T.t1,fontSize:13,padding:"0 12px",outline:"none",fontFamily:"inherit"}}/>
          {calcResults.length>0&&<div style={{marginTop:4,borderRadius:8,border:`1px solid ${T.b1}`,background:T.s1,maxHeight:200,overflowY:"auto"}}>
            {calcResults.map(p=><button key={p[0]} onClick={()=>{setCalcSku(p);setCalcSearch("")}} style={{width:"100%",textAlign:"left",padding:"8px 12px",background:"none",border:"none",borderBottom:`1px solid ${T.b1}`,color:T.t1,cursor:"pointer",fontFamily:"inherit",fontSize:11}}>
              <div style={{fontWeight:600}}>#{p[0]} — {p[1]}</div>
              <div style={{fontSize:9,color:T.t4}}>{p[2]} · MSRP ${p[4]}</div>
            </button>)}
          </div>}
        </div>}
      </div>
      {calcSku&&<div style={{marginBottom:12}}>
        <label style={{fontSize:11,color:T.t1,display:"block",marginBottom:4,fontWeight:600}}>Doctor Spend ($)</label>
        <div style={{position:"relative"}}>
          <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:16,color:T.t4,fontFamily:"'JetBrains Mono',monospace"}}>$</span>
          <input type="number" value={calcSpend} onChange={e=>setCalcSpend(e.target.value)} placeholder="e.g. 5000" style={{width:"100%",height:42,borderRadius:8,border:`1px solid ${T.b1}`,background:T.s1,color:T.t1,fontSize:16,padding:"0 12px 0 30px",outline:"none",fontFamily:"'JetBrains Mono',monospace"}}/>
        </div>
      </div>}
      {calc&&<div style={{background:"rgba(79,142,247,.06)",border:"1px solid rgba(79,142,247,.12)",borderRadius:8,padding:12}}>
        <div style={{fontSize:10,fontWeight:700,color:T.blue,marginBottom:8}}>Calculation Breakdown</div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.t3,marginBottom:3}}><span>Doctor spent</span><span className="m" style={{color:T.t1}}>{$f(parseFloat(calcSpend))}</span></div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.t3,marginBottom:3}}><span>÷ ${calc.tierMSRP.toFixed(2)}/unit ({calcIsAccel?calcTier:"std"} MSRP)</span><span className="m" style={{color:T.t1}}>{calc.units.toFixed(1)} units</span></div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.t3,marginBottom:3}}><span>× ${calc.stdWS.toFixed(2)} std wholesale/unit</span><span className="m" style={{color:T.t1}}>{$f(calc.totalWS)}</span></div>
        {calcIsAccel&&calc.totalCB>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.t3,marginBottom:3}}><span>{calcTier} chargeback ({calcRate*100}%)</span><span className="m" style={{color:T.red}}>-{$f(calc.totalCB)}</span></div>}
        <div style={{borderTop:`1px solid ${T.b2}`,marginTop:6,paddingTop:6,display:"flex",justifyContent:"space-between",fontSize:14,fontWeight:700}}>
          <span style={{color:T.t1}}>Your Credit</span>
          <span className="m" style={{color:T.green,fontSize:18}}>{$f(calc.totalCredited)}</span>
        </div>
      </div>}
    </div>
    <div style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:12,padding:12,fontSize:10,color:T.t3}}>
      <strong>How it works:</strong> Doctor spend ÷ tier MSRP = units. Units × std wholesale = raw wholesale. Accelerate tiers subtract chargeback (Silver 20%, Gold 24%, Platinum 30%, Diamond 36%). Standard / Top 100 / Private = 0%.
    </div>
  </div>;
}

