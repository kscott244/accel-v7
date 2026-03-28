"use client";
// @ts-nocheck
import { useState, useMemo } from "react";
import { T } from "@/lib/tokens";
import { isAccelTier, getTierRate } from "@/lib/tier";
import { $f } from "@/lib/format";
import { SKU } from "@/data/sku-data";

const TIERS = ["Silver","Gold","Platinum","Diamond","Standard"];
const TIER_RATES: Record<string,number> = {Silver:.20,Gold:.24,Platinum:.30,Diamond:.36,Standard:0};
const TIER_LABELS: Record<string,string> = {Silver:"Silver 20%",Gold:"Gold 24%",Platinum:"Platinum 30%",Diamond:"Diamond 36%",Standard:"Std 0%"};
const TIER_COLS: Record<string,string> = {Silver:"#22d3ee",Gold:"#fbbf24",Platinum:"#a78bfa",Diamond:"#4f8ef7",Standard:"#a0a0b8"};

// ── Tool 1: Quick Credit ──────────────────────────────────────────
// Enter any order amount → see your credited revenue at every tier at once
function QuickCredit() {
  const [amount, setAmount] = useState("");

  // WS/MSRP ratios derived from 2026 Kerr Accelerate formulary (Ken's bag avg)
  // At Accelerate tiers, doctor pays lower MSRP but Ken earns a higher WS%
  // so credited wholesale is HIGHER at Diamond than Standard — not lower.
  const WS_RATES: Record<string,number> = {
    Standard: 0.601,
    Silver:   0.740,
    Gold:     0.760,
    Platinum: 0.780,
    Diamond:  0.800,
  };
  const spend = parseFloat(amount) || 0;

  const results = spend > 0 ? TIERS.map(t => {
    const wsRate = WS_RATES[t] || 0.601;
    const credited = spend * wsRate;
    return { tier: t, credited, cb: 0 };
  }) : [];

  return (
    <div style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:14,padding:16,marginBottom:12}}>
      <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.green,marginBottom:4}}>Quick Credit</div>
      <div style={{fontSize:11,color:T.t4,marginBottom:12}}>Enter an order amount — see your credit at every tier.</div>

      <div style={{position:"relative",marginBottom:12}}>
        <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",fontSize:18,color:T.t4,fontFamily:"'JetBrains Mono',monospace",pointerEvents:"none"}}>$</span>
        <input
          type="number" value={amount} onChange={e=>setAmount(e.target.value)}
          placeholder="0"
          style={{width:"100%",height:52,borderRadius:10,border:`1px solid ${spend>0?"rgba(52,211,153,.4)":T.b1}`,
            background:T.s2,color:T.t1,fontSize:20,padding:"0 14px 0 32px",
            outline:"none",fontFamily:"'JetBrains Mono',monospace",boxSizing:"border-box"}}/>
      </div>

      {results.length > 0 && (
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {results.map(r => (
            <div key={r.tier} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
              padding:"9px 12px",borderRadius:10,
              background:r.tier==="Standard"?T.s2:`rgba(${r.tier==="Silver"?"34,211,238":r.tier==="Gold"?"251,191,36":r.tier==="Platinum"?"167,139,250":"79,142,247"},.07)`,
              border:`1px solid ${TIER_COLS[r.tier]}22`}}>
              <div>
                <span style={{fontSize:12,fontWeight:700,color:TIER_COLS[r.tier]}}>{r.tier==="Standard"?"Std":r.tier}</span>
                {r.tier !== "Standard" && <span style={{fontSize:9,color:T.t4,marginLeft:6}}>{(WS_RATES[r.tier]*100).toFixed(0)}% WS</span>}
              </div>
              <span className="m" style={{fontSize:16,fontWeight:800,color:r.tier==="Standard"?T.t2:T.green}}>{$f(r.credited)}</span>
            </div>
          ))}
          <div style={{fontSize:9,color:T.t4,textAlign:"center",marginTop:2}}>Based on ~55% blended wholesale rate</div>
        </div>
      )}
    </div>
  );
}

// ── Tool 2: SKU Pricing Lookup ────────────────────────────────────
// Search a product → see what it costs at every tier
function SkuLookup() {
  const [search, setSearch] = useState("");
  const [sku, setSku] = useState<any>(null);

  const results = search.length >= 2
    ? SKU.filter(p => {
        const q = search.toLowerCase();
        return String(p[0]).toLowerCase().includes(q) ||
               String(p[1]).toLowerCase().includes(q) ||
               String(p[2]).toLowerCase().includes(q);
      }).slice(0, 8)
    : [];

  // SKU tuple: [sku, desc, cat, stdWS, stdMSRP, diaWS, diaMSRP, platWS, platMSRP, goldWS, goldMSRP, silvWS, silvMSRP]
  const pricingRows = sku ? [
    { tier:"Diamond",  msrp:sku[6],  ws:sku[5],  col:TIER_COLS.Diamond  },
    { tier:"Platinum", msrp:sku[8],  ws:sku[7],  col:TIER_COLS.Platinum },
    { tier:"Gold",     msrp:sku[10], ws:sku[9],  col:TIER_COLS.Gold     },
    { tier:"Silver",   msrp:sku[12], ws:sku[11], col:TIER_COLS.Silver   },
    { tier:"Standard", msrp:sku[4],  ws:sku[3],  col:TIER_COLS.Standard },
  ] : [];

  return (
    <div style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:14,padding:16,marginBottom:12}}>
      <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.blue,marginBottom:4}}>SKU Pricing</div>
      <div style={{fontSize:11,color:T.t4,marginBottom:12}}>Search a product — see pricing at every tier.</div>

      {sku
        ? <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12,
              padding:"8px 12px",borderRadius:8,background:"rgba(79,142,247,.08)",border:"1px solid rgba(79,142,247,.2)"}}>
              <div>
                <div style={{fontSize:12,fontWeight:700,color:T.t1}}>#{sku[0]} — {sku[1]}</div>
                <div style={{fontSize:10,color:T.t3,marginTop:1}}>{sku[2]}</div>
              </div>
              <button onClick={()=>{setSku(null);setSearch("");}}
                style={{background:"none",border:"none",color:T.t4,cursor:"pointer",fontSize:18,lineHeight:1,flexShrink:0}}>✕</button>
            </div>

            {/* Pricing table */}
            <div style={{borderRadius:10,overflow:"hidden",border:`1px solid ${T.b1}`}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",padding:"6px 12px",
                background:T.s2,borderBottom:`1px solid ${T.b1}`}}>
                <span style={{fontSize:9,fontWeight:700,color:T.t4,textTransform:"uppercase"}}>Tier</span>
                <span style={{fontSize:9,fontWeight:700,color:T.t4,textTransform:"uppercase",textAlign:"right"}}>MSRP</span>
                <span style={{fontSize:9,fontWeight:700,color:T.t4,textTransform:"uppercase",textAlign:"right"}}>Wholesale</span>
              </div>
              {pricingRows.map((r,i) => (
                <div key={r.tier} style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",
                  padding:"9px 12px",borderBottom:i<pricingRows.length-1?`1px solid ${T.b1}`:"none",
                  background:i%2===0?T.s1:T.s2}}>
                  <span style={{fontSize:12,fontWeight:700,color:r.col}}>{r.tier==="Standard"?"Std":r.tier}</span>
                  <span className="m" style={{fontSize:12,color:T.t2,textAlign:"right"}}>${r.msrp?.toFixed(2)??"-"}</span>
                  <span className="m" style={{fontSize:12,color:T.t1,fontWeight:700,textAlign:"right"}}>${r.ws?.toFixed(2)??"-"}</span>
                </div>
              ))}
            </div>
          </div>
        : <div>
            <input type="text" value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="SKU# or product name..."
              style={{width:"100%",height:42,borderRadius:8,border:`1px solid ${T.b1}`,
                background:T.s2,color:T.t1,fontSize:13,padding:"0 12px",
                outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
            {results.length > 0 && (
              <div style={{marginTop:4,borderRadius:8,border:`1px solid ${T.b1}`,background:T.s2,maxHeight:200,overflowY:"auto"}}>
                {results.map(p => (
                  <button key={p[0]} onClick={()=>{setSku(p);setSearch("");}}
                    style={{width:"100%",textAlign:"left",padding:"8px 12px",background:"none",border:"none",
                      borderBottom:`1px solid ${T.b1}`,color:T.t1,cursor:"pointer",fontFamily:"inherit",fontSize:11}}>
                    <div style={{fontWeight:600}}>#{p[0]} — {p[1]}</div>
                    <div style={{fontSize:9,color:T.t4}}>{p[2]} · Std MSRP ${p[4]}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
      }
    </div>
  );
}

// ── Tool 3: Tier Switch Calculator ───────────────────────────────
// Answers: "If I switch this doctor from Standard to Gold,
//  what does their $20K annual spend credit me now vs before?"
//
// Math: Standard WS = 60.1% of doctor spend (blended from 2026 formulary)
// Chargeback reduces that: Silver 20%, Gold 24%, Platinum 30%, Diamond 36%
// The hole = what you credited before minus what you credit after

const CB_RATES: Record<string,number> = {
  Standard:0, Silver:0.20, Gold:0.24, Platinum:0.30, Diamond:0.36
};
const STD_WS = 0.601; // blended Standard wholesale rate from 2026 formulary
const TIER_OPTS = ["Standard","Silver","Gold","Platinum","Diamond"];

function tierCredit(spend: number, tier: string): number {
  const cb = CB_RATES[tier] ?? 0;
  return spend * STD_WS * (1 - cb);
}

function TierSwitch() {
  const [spend,   setSpend]   = useState("");
  const [fromT,   setFromT]   = useState("Standard");
  const [toT,     setToT]     = useState("Gold");

  const annual  = parseFloat(spend) || 0;
  const before  = annual > 0 ? tierCredit(annual, fromT)  : null;
  const after   = annual > 0 ? tierCredit(annual, toT)    : null;
  const hole    = before != null && after != null ? after - before : null;

  const pillStyle = (t: string, active: string, col: string) => ({
    padding:"5px 11px", borderRadius:8, cursor:"pointer", fontFamily:"inherit",
    border:`1px solid ${active===t ? col+"55" : T.b2}`,
    background: active===t ? col+"18" : T.s2,
    fontSize:10, fontWeight:700,
    color: active===t ? col : T.t3,
  });

  const tierCol: Record<string,string> = {
    Standard:T.t3, Silver:T.cyan, Gold:T.amber, Platinum:T.purple, Diamond:T.blue
  };

  return (
    <div style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:14,padding:16,marginBottom:12}}>
      <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.purple,marginBottom:4}}>Tier Switch</div>
      <div style={{fontSize:11,color:T.t4,marginBottom:14}}>See what switching a doctor's tier does to your annual credit.</div>

      {/* Annual spend input */}
      <div style={{marginBottom:14}}>
        <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.t4,marginBottom:6}}>Doctor's Annual Spend</div>
        <div style={{position:"relative"}}>
          <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",fontSize:17,color:T.t4,fontFamily:"'JetBrains Mono',monospace",pointerEvents:"none"}}>$</span>
          <input type="number" value={spend} onChange={(e:any)=>setSpend(e.target.value)}
            placeholder="0"
            style={{width:"100%",height:48,borderRadius:10,border:`1px solid ${annual>0?"rgba(167,139,250,.4)":T.b1}`,
              background:T.s2,color:T.t1,fontSize:18,padding:"0 14px 0 32px",
              outline:"none",fontFamily:"'JetBrains Mono',monospace",boxSizing:"border-box"}}/>
        </div>
      </div>

      {/* From tier */}
      <div style={{marginBottom:12}}>
        <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.t4,marginBottom:6}}>Current Tier</div>
        <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
          {TIER_OPTS.map(t => (
            <button key={t} onClick={()=>setFromT(t)} style={pillStyle(t,fromT,tierCol[t])}>{t==="Standard"?"Private":t}</button>
          ))}
        </div>
      </div>

      {/* To tier */}
      <div style={{marginBottom:14}}>
        <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.t4,marginBottom:6}}>Switch To</div>
        <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
          {TIER_OPTS.filter(t=>t!==fromT).map(t => (
            <button key={t} onClick={()=>setToT(t)} style={pillStyle(t,toT,tierCol[t])}>{t==="Standard"?"Private":t}</button>
          ))}
        </div>
      </div>

      {/* Results */}
      {hole !== null && before !== null && after !== null && (
        <div style={{borderRadius:10,overflow:"hidden",border:`1px solid ${T.b1}`}}>
          {/* Before */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
            padding:"10px 14px",background:T.s2,borderBottom:`1px solid ${T.b1}`}}>
            <div>
              <div style={{fontSize:9,color:T.t4,textTransform:"uppercase",letterSpacing:"1px",marginBottom:2}}>Credit at {fromT==="Standard"?"Private":fromT}</div>
              <div style={{fontSize:11,color:T.t3}}>{fromT==="Standard"?"No chargeback":`${(CB_RATES[fromT]*100).toFixed(0)}% chargeback`}</div>
            </div>
            <span className="m" style={{fontSize:16,fontWeight:700,color:T.t2}}>{$f(before)}</span>
          </div>
          {/* After */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
            padding:"10px 14px",background:T.s2,borderBottom:`1px solid ${T.b1}`}}>
            <div>
              <div style={{fontSize:9,color:T.t4,textTransform:"uppercase",letterSpacing:"1px",marginBottom:2}}>Credit at {toT==="Standard"?"Private":toT}</div>
              <div style={{fontSize:11,color:T.t3}}>{toT==="Standard"?"No chargeback":`${(CB_RATES[toT]*100).toFixed(0)}% chargeback`}</div>
            </div>
            <span className="m" style={{fontSize:16,fontWeight:700,color:hole>=0?T.green:T.amber}}>{$f(after)}</span>
          </div>
          {/* Delta */}
          <div style={{padding:"12px 14px",background:hole>=0?"rgba(52,211,153,.06)":"rgba(251,191,36,.06)",
            borderTop:`2px solid ${hole>=0?T.green:T.amber}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <span style={{fontSize:12,fontWeight:700,color:T.t1}}>Annual Impact</span>
              <span className="m" style={{fontSize:18,fontWeight:800,color:hole>=0?T.green:T.amber}}>
                {hole>=0?"+":""}{$f(hole)}
              </span>
            </div>
            <div style={{fontSize:11,color:T.t3,lineHeight:1.5}}>
              {hole < 0
                ? `Switching to ${toT} costs you ${$f(Math.abs(hole))}/yr against your goal. Only worthwhile if the volume increase offsets the margin loss.`
                : `Switching to ${toT==="Standard"?"Private":toT} recovers ${$f(hole)}/yr. Favorable move.`
              }
            </div>
          </div>
        </div>
      )}

      {!annual && (
        <div style={{fontSize:11,color:T.t4,textAlign:"center",paddingTop:4}}>Enter the doctor's annual spend to see the impact.</div>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────
export default function PricingTab() {
  return (
    <div style={{padding:"16px 16px 80px"}}>
      <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.t4,marginBottom:16}}>Pricing Tools</div>
      <QuickCredit/>
      <SkuLookup/>
      <TierSwitch/>
    </div>
  );
}
