"use client";
// @ts-nocheck
import { useState, useMemo, useEffect } from "react";
import { T } from "@/lib/tokens";
import { normalizeTier, getTierRate, getTierLabel, isAccelTier } from "@/lib/tier";
import { $$, $f, pc, getHealthStatus } from "@/lib/format";
import { SKU } from "@/data/sku-data";
import { BADGER, OVERLAYS_REF } from "@/lib/data";
import { Back, Chev, Pill, Stat, Bar, AccountId, GroupBadge, fixGroupName } from "@/components/primitives";
import { scorePriority } from "@/lib/priority";
import { branchSpread } from "@/lib/stemm";
import ReorderInvoice from "@/components/tabs/ReorderInvoice";

// ─── MULTI-DEALER COMBINED VIEW ──────────────────────────────────
function MultiDealerView({acct}) {
  const [expanded, setExpanded] = useState(false);
  const sibs:any[] = acct.addrSiblings || [];
  if(sibs.length === 0) return null;
  const combPY = acct.combinedPY ?? ((acct.pyQ?.["1"]||0) + sibs.reduce((s:number,x:any)=>s+(x.pyQ1||0),0));
  const combCY = acct.combinedCY ?? ((acct.cyQ?.["1"]||0) + sibs.reduce((s:number,x:any)=>s+(x.cyQ1||0),0));
  const combGap = combPY - combCY;
  const combRet = combPY > 0 ? Math.round(combCY/combPY*100) : 0;
  const allAccts = [
    {name: acct.name, dealer: acct.dealer||'Unknown', pyQ1: acct.pyQ?.["1"]||0, cyQ1: acct.cyQ?.["1"]||0, id: acct.id, isSelf: true},
    ...sibs.map((s:any) => ({...s, isSelf: false}))
  ].filter(a => (a.pyQ1||0) > 0 || (a.cyQ1||0) > 0)
   .sort((a,b) => (b.pyQ1||0) - (a.pyQ1||0));
  const isActuallyUp = combGap <= 0;
  return <div className="anim" style={{animationDelay:"30ms",background:"rgba(34,211,238,.04)",border:`1px solid rgba(34,211,238,.15)`,borderRadius:16,padding:14,marginBottom:12}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
      <div style={{display:"flex",alignItems:"center",gap:6}}>
        <span style={{fontSize:10,fontWeight:700,color:T.cyan,textTransform:"uppercase",letterSpacing:"1px"}}>All Distributors</span>
        <span style={{fontSize:9,color:T.cyan,background:"rgba(34,211,238,.1)",borderRadius:4,padding:"1px 5px",border:"1px solid rgba(34,211,238,.2)"}}>{sibs.length+1} dealers</span>
      </div>
      <button onClick={()=>setExpanded(!expanded)} style={{background:"none",border:"none",color:T.cyan,cursor:"pointer",fontSize:10,fontWeight:600,fontFamily:"inherit"}}>{expanded?"Hide":"Breakdown"}</button>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:expanded?12:0}}>
      <Stat l="PY" v={$$(combPY)} c={T.t2}/>
      <Stat l="CY" v={$$(combCY)} c={T.blue}/>
      <Stat l="True Gap" v={combGap<=0?`+${$$(Math.abs(combGap))}`:$$(combGap)} c={isActuallyUp?T.green:T.red}/>
      <Stat l="Ret" v={combRet+"%"} c={combRet>30?T.green:combRet>15?T.amber:T.red}/>
    </div>
    {isActuallyUp&&<div style={{fontSize:10,color:T.green,marginBottom:expanded?10:0}}>✓ Account is net positive across all distributors</div>}
    {expanded&&<div>
      <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.t4,marginBottom:8}}>Dealer Share</div>
      {allAccts.map((a,i)=>{
        const py = a.pyQ1||0; const cy = a.cyQ1||0;
        const pyPct = combPY > 0 ? Math.round(py/combPY*100) : 0;
        const cyPct = combCY > 0 ? Math.round(cy/combCY*100) : 0;
        const pctShift = cyPct - pyPct;
        return <div key={a.id} style={{marginBottom:10,padding:"8px 10px",borderRadius:8,background:a.isSelf?"rgba(79,142,247,.06)":T.s2,border:`1px solid ${a.isSelf?"rgba(79,142,247,.15)":T.b2}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
            <div style={{flex:1,minWidth:0}}>
              <span style={{fontSize:11,fontWeight:600,color:a.isSelf?T.blue:T.t1}}>{a.name}</span>
              {a.isSelf&&<span style={{fontSize:8,color:T.blue,marginLeft:5}}>← this account</span>}
              <div style={{fontSize:9,color:T.t4}}>{[a.addr||a.address,[a.city,a.st,a.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ")}{a.dealer?" · "+a.dealer:""}</div>
            </div>
            <div style={{textAlign:"right",flexShrink:0,marginLeft:8}}>
              <div style={{fontSize:10,fontWeight:600,fontFamily:"'DM Mono',monospace",color:T.blue}}>{$$(cy)}</div>
              <div style={{fontSize:9,color:T.t4,fontFamily:"'DM Mono',monospace"}}>{$$(py)} PY</div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <div style={{flex:1,height:4,borderRadius:2,background:T.s3,overflow:"hidden"}}>
              <div style={{height:"100%",borderRadius:2,width:`${Math.min(cyPct,100)}%`,background:cyPct>=pyPct?`linear-gradient(90deg,${T.blue},${T.cyan})`:T.amber,transition:"width .4s ease"}}/>
            </div>
            <span style={{fontSize:9,color:T.t3,flexShrink:0,minWidth:50,textAlign:"right"}}>
              <span style={{color:T.t2,fontWeight:600}}>{cyPct}%</span>
              {pctShift !== 0 && <span style={{color:pctShift>0?T.green:T.red,marginLeft:3}}>{pctShift>0?"+":""}{pctShift}%</span>}
              {" PY "+pyPct+"%"}
            </span>
          </div>
        </div>;
      })}
    </div>}
  </div>;
}

function AcctDetail({acct,goBack,adjs,setAdjs,groups,goGroup,overlays,patchOverlay=null,reapplyGroupOverrides=null,goAcct=null,salesStore=null}) {
  const [q,setQ]=useState("1");
  const [showForm,setShowForm]=useState(false);
  const [toast,setToast]=useState(null);
  const [aiState,setAiState]=useState("idle");
  const [aiText,setAiText]=useState("");
  const [drState,setDrState]=useState("idle");
  const [drIntel,setDrIntel]=useState<any>(null);
  const [groupSuggestions,setGroupSuggestions]=useState<any[]>([]);
  const [suggestModal,setSuggestModal]=useState(false);
  const [suggestSelected,setSuggestSelected]=useState<Set<string>>(new Set());
  const [savedContacts,setSavedContacts]=useState<any>(null);
  const [showMoveModal,setShowMoveModal]=useState(false);
  const [showReorder,setShowReorder]=useState(false);
  const [moveSearch,setMoveSearch]=useState("");
  const [moveTarget,setMoveTarget]=useState<any>(null);
  const [groupOverride,setGroupOverride]=useState<any>(null);
  const [actLog,setActLog]=useState<any[]>([]);
  const [actType,setActType]=useState("visit");
  const [expandedProduct,setExpandedProduct]=useState<string|null>(null);
  const [actContact,setActContact]=useState("");
  const [actNotes,setActNotes]=useState("");
  const [actFollowUp,setActFollowUp]=useState("");
  const [showActForm,setShowActForm]=useState(false);
  const storageKey = `contact:${acct.id}`;
  const overrideKey = `group-override:${acct.id}`;
  const actLogKey = `actlog:${acct.id}`;

  // Load saved contacts + group override + activity log from storage on mount
  useEffect(() => {
    // Load contact: overlays is durable source, localStorage is fast cache fallback
    try {
      const fromOverlay = overlays?.contacts?.[acct.id];
      if (fromOverlay) {
        setSavedContacts(fromOverlay);
      } else {
        const v = localStorage.getItem(storageKey);
        if (v) setSavedContacts(JSON.parse(v));
      }
    } catch {}
    // Load group move: overlays.groupMoves is the durable source (L3).
    // LS fallback reads pre-migration keys only — new saves no longer write here.
    try {
      const fromOverlay = overlays?.groupMoves?.[acct.id];
      if (fromOverlay) {
        setGroupOverride(fromOverlay);
      } else {
        const v = localStorage.getItem(overrideKey);
        if (v) setGroupOverride(JSON.parse(v)); // pre-migration fallback only
      }
    } catch {}
    // Load activity log: merge overlays (durable) with localStorage (recent unsynced)
    try {
      const fromOverlay: any[] = overlays?.activityLogs?.[acct.id] || [];
      const fromLocal: any[] = (() => { try { return JSON.parse(localStorage.getItem(actLogKey)||"[]"); } catch { return []; } })();
      const overlayIds = new Set(fromOverlay.map((e:any) => e.id));
      const merged = [...fromOverlay, ...fromLocal.filter((e:any) => !overlayIds.has(e.id))];
      merged.sort((a:any,b:any) => b.id - a.id);
      if (merged.length > 0) setActLog(merged);
    } catch {}
  }, [acct.id]);

  // Group search for move modal
  const moveResults = useMemo(() => {
    if (!moveSearch.trim()) return [];
    const q = moveSearch.trim().toLowerCase();
    return (groups||[]).filter(g =>
      g.id !== acct.gId &&
      (g.name?.toLowerCase().includes(q) ||
       fixGroupName(g).toLowerCase().includes(q))
    ).slice(0, 8);
  }, [moveSearch, groups, acct.gId]);

  const applyGroupOverride = (targetGroup) => {
    const override = {
      childId: acct.id,
      childName: acct.name,
      targetGroupId: targetGroup.id,
      targetGroupName: fixGroupName(targetGroup),
      savedAt: new Date().toISOString(),
    };
    // Note: no longer writing to localStorage — groupMoves persisted via patchOverlay (overlays layer)
    setGroupOverride(override);
    setShowMoveModal(false);
    setMoveSearch("");
    setToast({msg:`Moved to ${fixGroupName(targetGroup)}`, color:T.green});
    setTimeout(()=>setToast(null), 3000);
    // Re-render parent group cards immediately
    reapplyGroupOverrides?.();
    // Persist to overlays durably
    if (patchOverlay) {
      patchOverlay([{ op: "set", path: `groupMoves.${acct.id}`, value: override }]);
    }
  };

  const myAdj=adjs.filter(m=>m.acctId===acct.id);
  const adjTotal=myAdj.reduce((s,m)=>s+m.credited,0);
  const acctTier=acct.tier||acct.gTier||"Standard";
  const tierRate=getTierRate(acctTier);
  const isAccel=isAccelTier(acctTier);
  const acctType=getTierLabel(acctTier);
  const qk=q;

  // Parent group + siblings
  // Parent group — uses override group if set, otherwise natural group from data
  const parentGroup=useMemo(()=>{
    const overrideGroupId = groupOverride?.targetGroupId;
    if (overrideGroupId) return (groups||[]).find(g=>g.id===overrideGroupId) || null;
    return acct.gId ? (groups||[]).find(g=>g.id===acct.gId) : null;
  },[groups,acct.gId,groupOverride]);
  const siblings=useMemo(()=>parentGroup?( parentGroup.children?.filter(c=>c.id!==acct.id)||[]).sort((a,b)=>((b.pyQ?.["1"]||0)-(b.cyQ?.["1"]||0))-((a.pyQ?.["1"]||0)-(a.cyQ?.["1"]||0))):[]  ,[parentGroup,acct.id]);

  // Badger Maps intel — keyed by Master-CM id
  const badger = useMemo(()=> BADGER[acct.id] || BADGER[acct.gId] || null, [acct.id, acct.gId]);

  const { rootStrength } = useMemo(() => scorePriority(acct, "1"), [acct.id]);
  const spread = useMemo(() => branchSpread(acct.products ?? [], qk), [acct.id, qk]);

  const pyVal=acct.pyQ?.[qk]||0;
  const cyBase=acct.cyQ?.[qk]||0;
  const cyVal=qk==="1"?cyBase+adjTotal:cyBase;
  const gap=pyVal-cyVal;
  const ret=pyVal>0?cyVal/pyVal:0;

  const products=acct.products||[];
  const buying=products.filter(p=>(p[`cy${qk}`]||0)>0).sort((a,b)=>(b[`cy${qk}`]||0)-(a[`cy${qk}`]||0));
  const stopped=products.filter(p=>(p[`py${qk}`]||0)>100&&(p[`cy${qk}`]||0)===0);
  const allProdNames=products.map(p=>p.n);
  // Smart cross-sell: category-aware suggestions based on what they're NOT buying
  // Each entry: [matchKeyword, suggestLabel, pitch]
  const XSELL_OPPS = [
    // Composite — newest options by practice profile
    { kw:"HARMONIZE",    label:"Harmonize",            pitch:"Premium aesthetic composite — ideal for high-cosmetic practices. Nano-optimized filler, exceptional polish." },
    { kw:"SIMPLISHADE",  label:"SimpliShade",          pitch:"Simplified shade system for larger practices — fewer shades, faster workflow, less chair time." },
    { kw:"SONICFILL",    label:"SonicFill 3",          pitch:"Sonic-activated bulk-fill composite — one shade, posterior-focused, huge time saver." },
    // Cement
    { kw:"MAXCEM",       label:"MaxCem Elite Chroma",  pitch:"Self-adhesive resin cement with color-change indicator — no more guessing cleanup. Upgrade from plain MaxCem." },
    // Bond — newest
    { kw:"OPTIBOND 360", label:"OptiBond Universal 360", pitch:"Newest universal bond — 360° etching pattern, works self-etch or total-etch, broadest clinical coverage." },
    // Pedo
    { kw:"NEXUS",        label:"Nexus RMGI",           pitch:"RMGI for pediatric — strong fluoride release, moisture tolerant, ideal for pedo practices." },
    // Curing light — newest
    { kw:"DEMI",         label:"Demi Pro",             pitch:"Newest curing light — just launched, upgraded from Demi Plus. Broader spectrum, faster cure times." },
  ];
  const xsell = XSELL_OPPS.filter(o => !allProdNames.some(n => n.toUpperCase().includes(o.kw)));

  const runAI = async () => {
    setAiState("loading"); setAiText("");
    const payload = {
      name: acct.name, city: acct.city, state: acct.st,
      tier: acctType, dealer: acct.dealer||"All Other",
      group: acct.gName||"None", lastOrderDays: acct.last,
      Q1_PY: pyVal, Q1_CY: cyVal, gap, retentionPct: Math.round(ret*100),
      buying: buying.slice(0,6).map(p=>({name:p.n, py:p[`py1`]||0, cy:p[`cy1`]||0})),
      stopped: stopped.slice(0,5).map(p=>({name:p.n, py:p[`py1`]||0})),
      crossSellOpportunities: xsell.map(o=>o.label),
      groupLocations: (parentGroup?.locs||1),
      fieldIntel: badger ? {
        doctor: badger.doctor||null,
        orders: badger.orders||null,
        dealerRep: badger.dealerRep||null,
        feel: badger.feel||null,
        notes: badger.notes||null,
        lastVisit: badger.lastVisit||null,
        visitNotes: badger.visitNotes||null,
      } : null,
    };
    const prompt = `You are an AI assistant for Ken Scott, a dental territory sales manager for Kerr dental products covering CT/MA/RI/NY.

Here is the account data for one of Ken's accounts:
${JSON.stringify(payload, null, 2)}

Write a concise, plain-English sales rep briefing in 3-4 short paragraphs. Cover:
1. Account health snapshot — what the retention and gap numbers mean in plain English
2. What stopped or declined and why it might matter
3. The single best action Ken should take on his next visit, specific and direct
4. Any upsell or cross-sell angle worth mentioning

Be direct, specific, and helpful. Write like a smart sales coach, not a chatbot. No bullet lists — prose only. Keep it under 180 words.`;

    try {
      const res = await fetch("/api/ai-briefing", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({prompt})
      });
      const data = await res.json();
      if (data?.text) {
        setAiText(data.text);
        setAiState("done");
      } else {
        setAiState("error");
        setAiText(data?.error || "No response received. Try again.");
      }
    } catch(e) {
      setAiState("error");
      setAiText("Connection error. Check network and try again.");
    }
  };

  const runDeepResearch = async () => {
    setDrState("loading"); setDrIntel(null); setGroupSuggestions([]);
    try {
      const res = await fetch("/api/deep-research", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          name: acct.name,
          city: acct.city,
          state: acct.st,
          address: acct.addr || badger?.address || "",
          dealer: acct.dealer||"All Other",
          products: buying.slice(0,5).map(p=>p.n),
          doctor: badger?.doctor || "",
          gName: acct.gName || "",
          acctId: acct.id,
          ownership: badger?.ownership || null,
          gap: Math.round(gap),
          retentionPct: Math.round(ret*100),
          Q1_PY: Math.round(pyVal),
          Q1_CY: Math.round(cyVal),
          buying: buying.slice(0,6).map(p=>({name:p.n,cy:Math.round(p["cy1"]||0),py:Math.round(p["py1"]||0)})),
          stopped: stopped.slice(0,5).map(p=>({name:p.n,py:Math.round(p["py1"]||0)})),
          xsell: xsell.slice(0,3).map(o=>({label:o.label,pitch:o.pitch})),
          tier: acctType,
        })
      });
      const data = await res.json();
      if (data?.intel) {
        setDrIntel(data.intel);
        setDrState("done");
        // Auto-suggest group members using claude-opus-4-6 semantic matching
        try {
          const intel = data.intel;
          const intelText = [...(intel.hooks||[]), intel.ownershipNote||"", ...(intel.talkingPoints||[])].join(" ").toLowerCase();
          const isMulti = intelText.includes("location") || intelText.includes("site") || intelText.includes("office") || intelText.includes("dso") || intelText.includes("group practice") || intelText.includes("multiple");
          if (isMulti) {
            // Build condensed account list for Opus — include Badger doctor/email as key signals
            const allAccts = (groups||[]).flatMap((g:any) =>
              (g.children||[]).map((c:any) => {
                const b = BADGER[c.id] || {};
                return {
                  id: c.id,
                  name: c.name,
                  city: c.city,
                  st: c.st,
                  address: c.addr || c.address || b.address || "",
                  doctor: b.doctor || "",
                  email: b.email || c.email || "",
                };
              })
            ).filter((c:any) => c.id !== acct.id);

            setGroupSuggestions([{id:"__searching__", name:"Searching for related accounts…", city:"", st:"", matchReason:""}]);
            fetch("/api/find-group-matches", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                intel,
                acct: { name: acct.name, city: acct.city, st: acct.st, address: acct.addr||acct.address||"", doctor: BADGER[acct.id]?.doctor||"", email: BADGER[acct.id]?.email||acct.email||"" },
                accounts: allAccts
              })
            })
            .then(r => r.json())
            .then(result => {
              if (result.matches?.length > 0) {
                const matchedIds = new Set(result.matches.map((m:any) => m.id));
                const reasonMap: Record<string,string> = {};
                result.matches.forEach((m:any) => { reasonMap[m.id] = m.reason; });
                const matched = (groups||[]).flatMap((g:any) =>
                  (g.children||[]).map((c:any) => ({...c, gId:g.id}))
                ).filter((c:any) => matchedIds.has(c.id))
                  .map((c:any) => ({...c, matchReason: reasonMap[c.id]||""}));
                setGroupSuggestions(matched.length > 0 ? matched : []);
              } else {
                // No matches found — clear the searching indicator
                setGroupSuggestions([]);
              }
            })
            .catch(() => { setGroupSuggestions([]); }); // clear on error
          }
        } catch(e) {}
        // Save contact info to persistent overlay storage (committed to overlays.json via API)
        const contacts = {
          contactName: data.intel.contacts?.[0]?.name || data.intel.contactName || null,
          phone: data.intel.contacts?.[0]?.phone || data.intel.phone || null,
          email: data.intel.contacts?.[0]?.email || data.intel.email || null,
          website: data.intel.website || null,
          contacts: data.intel.contacts || [],
          savedAt: new Date().toISOString(),
          practiceName: acct.name,
        };
        const hasContact = contacts.contactName || contacts.phone || contacts.email || contacts.website || contacts.contacts.length > 0;
        if (hasContact) {
          try { localStorage.setItem(storageKey, JSON.stringify(contacts)); } catch {}
          setSavedContacts(contacts);
          // Persist to overlays durably — use atomic patch to avoid SHA conflicts
          if (patchOverlay) {
            patchOverlay([{ op: "set", path: `contacts.${acct.id}`, value: contacts }]);
          }
        }
      } else {
        setDrState("error");
        setDrIntel({error: data?.error || "Research failed. Try again."});
      }
    } catch(e) {
      setDrState("error");
      setDrIntel({error:"Connection error. Check network and try again."});
    }
  };

  return <div style={{paddingBottom:80}}>

    {/* ── STICKY HEADER ── */}
    <div style={{position:"sticky",top:52,zIndex:40,background:"rgba(10,10,15,.9)",backdropFilter:"blur(20px)",borderBottom:`1px solid ${T.b3}`,padding:"10px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <button onClick={goBack} style={{background:"none",border:"none",color:T.blue,cursor:"pointer",display:"flex",alignItems:"center",gap:4,fontSize:13,fontWeight:600,fontFamily:"inherit"}}><Back/> Back</button>
      <div style={{display:"flex",gap:5}}>
        <button onClick={()=>drState==="idle"||drState==="error"?runDeepResearch():setDrState("idle")} style={{background:drState==="done"?"rgba(34,211,238,.12)":"rgba(34,211,238,.06)",border:`1px solid ${drState==="done"?"rgba(34,211,238,.35)":"rgba(34,211,238,.18)"}`,borderRadius:8,padding:"5px 10px",fontSize:11,fontWeight:700,color:T.cyan,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:4}}>
          {drState==="loading"?<><span style={{animation:"pulse 1s infinite"}}>●</span> Searching...</>:"🔍 Research"}
        </button>
        <button onClick={()=>aiState==="idle"||aiState==="error"?runAI():setAiState("idle")} style={{background:aiState==="done"?"rgba(167,139,250,.12)":"rgba(167,139,250,.08)",border:`1px solid ${aiState==="done"?"rgba(167,139,250,.3)":"rgba(167,139,250,.18)"}`,borderRadius:8,padding:"5px 10px",fontSize:11,fontWeight:700,color:T.purple,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:5}}>
          {aiState==="loading"?<><span style={{animation:"pulse 1s infinite"}}>●</span> Thinking...</>:"✦ Briefing"}
        </button>
      </div>
    </div>

    <div style={{padding:"12px 16px 0"}}>
      {toast&&<div className="anim" style={{background:"rgba(52,211,153,.12)",border:"1px solid rgba(52,211,153,.25)",borderRadius:12,padding:"10px 14px",marginBottom:10,display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:14,color:T.green,fontWeight:700}}>+</span>
        <div><div style={{fontSize:12,fontWeight:700,color:T.green}}>Sale recorded!</div><div style={{fontSize:10,color:T.t3}}>+{$f(toast)} credited → Q1 updated</div></div>
      </div>}

      {/* ── HERO ── */}
      <div className="anim" style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:14,padding:"12px 14px",marginBottom:10}}>
        {/* Name + health + move/reorder */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
          <div style={{flex:1,minWidth:0,paddingRight:8}}><AccountId name={acct.name} gName={acct.gName} size="lg" locs={parentGroup?.locs}/></div>
          <div style={{display:"flex",gap:4,flexShrink:0}}>
            <button onClick={()=>setShowMoveModal(true)} style={{background:"rgba(79,142,247,.08)",border:"1px solid rgba(79,142,247,.18)",borderRadius:7,padding:"4px 8px",fontSize:10,fontWeight:600,color:T.blue,cursor:"pointer",fontFamily:"inherit"}}>Move</button>
            <button onClick={()=>setShowReorder(true)} style={{background:"rgba(52,211,153,.08)",border:"1px solid rgba(52,211,153,.2)",borderRadius:7,padding:"4px 8px",fontSize:10,fontWeight:600,color:T.green,cursor:"pointer",fontFamily:"inherit"}}>🧾</button>
          </div>
        </div>
        {/* Subtitle: city + tier + last seen */}
        <div style={{fontSize:10,color:T.t3,marginBottom:4}}>
          {acct.city}, {acct.st}
          {acct.last!=null&&<span> · Last {acct.last}d ago</span>}
          <span style={{color:isAccel?T.amber:T.t3}}> · {acctType}</span>
          {acct.dealer&&acct.dealer!=="All Other"&&<span style={{color:T.cyan}}> · {acct.dealer}{acct.dealerFlag&&<span style={{color:T.amber,marginLeft:3}}>⚠</span>}</span>}
        </div>
        {/* Health badge + group badge */}
        <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",marginBottom:8}}>
          {(()=>{const h=getHealthStatus(ret,gap,cyVal,pyVal);return <div style={{display:"inline-flex",alignItems:"center",fontSize:9,fontWeight:700,color:h.color,background:h.bg,border:`1px solid ${h.border}`,borderRadius:999,padding:"2px 8px"}}>{h.label}</div>;})()}
          {groupOverride&&<span style={{fontSize:9,color:T.amber}}>⚠ → {groupOverride.targetGroupName} <button onClick={()=>setGroupOverride(null)} style={{background:"none",border:"none",color:T.t4,cursor:"pointer",fontSize:10,padding:"0 2px"}}>✕</button></span>}
          {parentGroup&&(parentGroup.locs||(parentGroup.children?.length)||0)>=3&&<GroupBadge gName={fixGroupName(parentGroup)} gId={parentGroup.id} locs={parentGroup.locs||(parentGroup.children?.length)||0} goGroup={(id)=>goGroup&&goGroup((groups||[]).find((g:any)=>g.id===id))}/>}
        </div>
        {/* Q selector */}
        <div style={{display:"flex",gap:3,marginBottom:8}}>
          {["1","2","3","4","FY"].map(qr=>(
            <button key={qr} onClick={()=>setQ(qr)} style={{flex:1,padding:"5px 0",borderRadius:7,fontSize:10,fontWeight:600,cursor:"pointer",border:`1px solid ${q===qr?"rgba(79,142,247,.25)":T.b2}`,background:q===qr?"rgba(79,142,247,.12)":T.s2,color:q===qr?T.blue:T.t3,fontFamily:"inherit"}}>{qr==="FY"?"FY":`Q${qr}`}</button>
          ))}
        </div>
        {/* Stats */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6}}>
          <Stat l="PY" v={$$(pyVal)} c={T.t2}/>
          <Stat l="CY" v={$$(cyVal)} c={T.blue}/>
          <Stat l="Gap" v={gap<=0?`+${$$(Math.abs(gap))}`:$$(gap)} c={gap<=0?T.green:T.red}/>
          <Stat l="Ret" v={pc(ret)} c={ret>.3?T.green:ret>.15?T.amber:T.red}/>
        </div>
        {qk!=="1"&&<div style={{marginTop:5,fontSize:9,color:T.t4,textAlign:"center"}}>Showing {qk==="FY"?"Full Year":`Q${qk}`}. Adjustments apply to Q1.</div>}
        {myAdj.length>0&&qk==="1"&&<div style={{marginTop:7,borderRadius:7,background:"rgba(52,211,153,.06)",border:"1px solid rgba(52,211,153,.12)",padding:"6px 9px"}}>
          <div style={{fontSize:9,fontWeight:600,color:T.green,marginBottom:3}}>Adjustments ({myAdj.length})</div>
          {myAdj.map((a:any)=><div key={a.id} style={{fontSize:9,color:T.t3,display:"flex",justifyContent:"space-between",marginBottom:1}}><span>{a.desc||"Manual"}</span><span className="m" style={{color:T.green,fontWeight:600}}>+{$f(a.credited)}</span></div>)}
        </div>}
      </div>

      {/* ── NEXT BEST MOVE ── */}
      {(()=>{
        const moves:any[]=[];
        const topStopped=[...stopped].sort((a,b)=>(b[`py${qk}`]||0)-(a[`py${qk}`]||0));
        if(topStopped.length===1) moves.push({icon:"🎯",color:T.red,text:`Re-engage on ${topStopped[0].n} — was ${$$(topStopped[0][`py${qk}`]||0)} last year, nothing this quarter.`});
        else if(topStopped.length>1) moves.push({icon:"🎯",color:T.red,text:`${topStopped.length} products stopped. Lead with ${topStopped[0].n} (was ${$$(topStopped[0][`py${qk}`]||0)}) — ask what changed.`});
        const nt=normalizeTier(acctTier);
        if(nt==="Silver") moves.push({icon:"⬆️",color:T.amber,text:`Gold upgrade saves doctor ~6% vs Silver MSRP. At ${$$(cyVal)} spend, that's meaningful — worth the conversation.`});
        else if(nt==="Standard"&&pyVal>1000) moves.push({icon:"⬆️",color:T.amber,text:`Not on Accelerate. At ${$$(pyVal)} PY spend, Silver tier would lower their cost. Pitch the program.`});
        if(xsell.length>0) moves.push({icon:"💡",color:T.purple,text:`Not buying ${xsell.slice(0,2).map((o:any)=>o.label).join(" or ")}. ${xsell[0].pitch}`});
        if(moves.length<2&&ret<0.5&&gap>500) moves.push({icon:"📞",color:T.blue,text:`Retention at ${Math.round(ret*100)}% — ${$$(gap)} gap. Check in on supply chain, competitor activity, or budget cycle.`});
        if(cyVal>pyVal) moves.push({icon:"✅",color:T.green,text:`Up ${$$(cyVal-pyVal)} vs last year. Reinforce — ask about upcoming procedures to lock in Q2.`});
        if(moves.length===0) return null;
        return <div className="anim" style={{animationDelay:"8ms",background:T.s1,border:`1px solid rgba(79,142,247,.2)`,borderLeft:`3px solid ${T.blue}`,borderRadius:14,padding:"12px 14px",marginBottom:10}}>
          <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.blue,marginBottom:10}}>Next Best Move</div>
          {moves.slice(0,3).map((m:any,i:number)=>(
            <div key={i} style={{display:"flex",gap:10,marginBottom:i<Math.min(moves.length,3)-1?8:0}}>
              <span style={{fontSize:13,flexShrink:0,lineHeight:1.4}}>{m.icon}</span>
              <div style={{fontSize:12,color:T.t2,lineHeight:1.5,borderLeft:`2px solid ${m.color}`,paddingLeft:9}}>{m.text}</div>
            </div>
          ))}
        </div>;
      })()}

      {/* ── WHO MATTERS ── */}
      {(badger||(savedContacts&&(savedContacts.contactName||savedContacts.contacts?.length>0)))&&(()=>{
        const allContacts:any[] = savedContacts?.contacts?.length>0
          ? savedContacts.contacts
          : savedContacts?.contactName
            ? [{name:savedContacts.contactName,email:savedContacts.email,phone:savedContacts.phone,role:"",tier:1}]
            : [];
        const hasDoctor = badger?.doctor;
        const hasFeel = badger?.feel;
        const hasRep = badger?.dealerRep;
        const hasPhone = badger?.phone;
        const hasNotes = badger?.notes||badger?.visitNotes;
        return <div className="anim" style={{animationDelay:"12ms",background:T.s1,border:`1px solid rgba(34,211,238,.18)`,borderRadius:14,padding:"12px 14px",marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.cyan}}>Who Matters</div>
            {hasFeel&&<div style={{display:"flex",gap:2}}>{[1,2,3,4,5].map(i=><div key={i} style={{width:7,height:7,borderRadius:"50%",background:i<=parseFloat(badger.feel)?T.amber:"rgba(255,255,255,.1)"}}/>)}</div>}
          </div>
          {/* Doctor + dealer rep */}
          {(hasDoctor||hasRep)&&<div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:hasPhone||allContacts.length>0||hasNotes?10:0}}>
            {hasDoctor&&<div>
              <div style={{fontSize:9,textTransform:"uppercase",color:T.t3,marginBottom:1}}>Doctor</div>
              <div style={{fontSize:12,fontWeight:700,color:T.t1}}>{badger.doctor}</div>
            </div>}
            {badger?.orders&&<div>
              <div style={{fontSize:9,textTransform:"uppercase",color:T.t3,marginBottom:1}}>Orders</div>
              <div style={{fontSize:11,fontWeight:600,color:T.t1}}>{badger.orders}</div>
            </div>}
            {hasRep&&<div>
              <div style={{fontSize:9,textTransform:"uppercase",color:T.t3,marginBottom:1}}>Dealer Rep</div>
              <div style={{fontSize:11,fontWeight:600,color:T.cyan}}>{badger.dealerRep}</div>
            </div>}
            {badger?.accelLevel&&<div>
              <div style={{fontSize:9,textTransform:"uppercase",color:T.t3,marginBottom:1}}>Accel Level</div>
              <div style={{fontSize:11,fontWeight:600,color:T.amber}}>{badger.accelLevel}</div>
            </div>}
          </div>}
          {/* Direct phone from badger */}
          {hasPhone&&<div style={{marginBottom:allContacts.length>0||hasNotes?8:0}}>
            <a href={`tel:${badger.phone}`} style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:11,color:T.cyan,textDecoration:"none",background:"rgba(34,211,238,.06)",border:"1px solid rgba(34,211,238,.12)",borderRadius:7,padding:"4px 10px"}}>
              📞 {badger.phone}
            </a>
          </div>}
          {/* Research-saved contacts */}
          {allContacts.length>0&&<div style={{borderTop:hasDoctor||hasPhone?`1px solid ${T.b2}`:"none",paddingTop:hasDoctor||hasPhone?8:0,marginBottom:hasNotes?8:0}}>
            {allContacts.slice(0,3).map((c:any,i:number)=>(
              <div key={i} style={{marginBottom:i<allContacts.length-1&&i<2?7:0}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
                  <div style={{fontSize:12,fontWeight:i===0?700:600,color:i===0?T.t1:T.t2}}>{c.name}</div>
                  {c.role&&<div style={{fontSize:9,color:T.t4,background:T.s2,borderRadius:3,padding:"1px 5px"}}>{c.role}</div>}
                </div>
                <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:2}}>
                  {c.email&&<a href={`mailto:${c.email}`} style={{fontSize:10,color:T.cyan,textDecoration:"none"}}>{c.email}</a>}
                  {c.phone&&<a href={`tel:${c.phone}`} style={{fontSize:10,color:T.green,textDecoration:"none"}}>{c.phone}</a>}
                </div>
              </div>
            ))}
            {savedContacts?.website&&<div style={{marginTop:5}}><a href={savedContacts.website} target="_blank" rel="noreferrer" style={{fontSize:9,color:T.blue,textDecoration:"none"}}>🌐 {savedContacts.website.replace(/^https?:\/\//,"")}</a></div>}
          </div>}
          {/* Notes from Badger */}
          {hasNotes&&<div style={{borderTop:`1px solid ${T.b2}`,paddingTop:8}}>
            {badger.notes&&<div style={{fontSize:11,color:T.t2,lineHeight:1.5,background:T.s2,borderRadius:7,padding:"7px 9px",marginBottom:badger.visitNotes?6:0,whiteSpace:"pre-wrap"}}>{badger.notes.replace(/\\n/g,'\n')}</div>}
            {badger.visitNotes&&<div>
              <div style={{fontSize:9,textTransform:"uppercase",color:T.t3,marginBottom:2}}>Last Visit{badger.lastVisit?` · ${badger.lastVisit}`:""}</div>
              <div style={{fontSize:11,color:T.t3,lineHeight:1.5,fontStyle:"italic"}}>"{badger.visitNotes}"</div>
            </div>}
          </div>}
        </div>;
      })()}

      {/* ── ACTIVITY LOG (Last Activity + Log form) ── */}
      {(()=>{
        const ACT_ICONS:Record<string,string>={visit:"🚗",call:"📞",email:"📧",event:"🎓"};
        const saveEntry=()=>{
          if(!actNotes.trim()&&!actContact.trim())return;
          const entry={id:Date.now(),type:actType,contact:actContact.trim(),notes:actNotes.trim(),followUp:actFollowUp.trim(),ts:new Date().toISOString()};
          const updated=[entry,...actLog];
          setActLog(updated);
          try{localStorage.setItem(actLogKey,JSON.stringify(updated.slice(0,50)));}catch{}
          if(patchOverlay){patchOverlay([{op:"set",path:`activityLogs.${acct.id}`,value:updated.slice(0,50)}]);}
          setActContact("");setActNotes("");setActFollowUp("");setShowActForm(false);
        };
        // Surface next follow-up due
        const nextFollowUp=actLog.find((e:any)=>e.followUp);
        return <div className="anim" style={{animationDelay:"16ms",background:T.s1,border:`1px solid ${T.b1}`,borderRadius:14,padding:"12px 14px",marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:showActForm||actLog.length>0?8:0}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.cyan}}>Activity</span>
              {actLog.length>0&&<span style={{fontSize:9,color:T.t4,background:T.s2,borderRadius:10,padding:"1px 6px"}}>{actLog.length}</span>}
            </div>
            <button onClick={()=>setShowActForm(!showActForm)} style={{background:"rgba(34,211,238,.08)",border:"1px solid rgba(34,211,238,.18)",borderRadius:7,color:T.cyan,cursor:"pointer",fontSize:11,fontWeight:600,padding:"4px 10px",fontFamily:"inherit"}}>{showActForm?"Cancel":"+ Log"}</button>
          </div>
          {/* Next follow-up callout */}
          {!showActForm&&nextFollowUp&&<div style={{marginBottom:8,padding:"7px 10px",borderRadius:8,background:"rgba(251,191,36,.06)",border:"1px solid rgba(251,191,36,.2)",display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:11,color:T.amber,flexShrink:0}}>→</span>
            <span style={{fontSize:11,color:T.t2}}>{nextFollowUp.followUp}</span>
            <span style={{fontSize:9,color:T.t4,flexShrink:0,marginLeft:"auto"}}>{new Date(nextFollowUp.ts).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span>
          </div>}
          {/* Log form */}
          {showActForm&&<div style={{marginBottom:10}}>
            <div style={{display:"flex",gap:4,marginBottom:8}}>
              {([["visit","🚗 Visit"],["call","📞 Call"],["email","📧 Email"],["event","🎓 Event"]] as [string,string][]).map(([v,l])=>(
                <button key={v} onClick={()=>setActType(v)} style={{flex:1,padding:"5px 0",borderRadius:7,fontSize:9,cursor:"pointer",border:`1px solid ${actType===v?"rgba(34,211,238,.4)":T.b2}`,background:actType===v?"rgba(34,211,238,.12)":T.s2,color:actType===v?T.cyan:T.t3,fontFamily:"inherit",fontWeight:600}}>{l}</button>
              ))}
            </div>
            <input type="text" value={actContact} onChange={e=>setActContact(e.target.value)} placeholder="Contact name (optional)"
              style={{width:"100%",height:34,borderRadius:7,border:`1px solid ${T.b1}`,background:T.s2,color:T.t1,fontSize:12,padding:"0 9px",outline:"none",fontFamily:"inherit",marginBottom:6,boxSizing:"border-box"}}/>
            <textarea value={actNotes} onChange={e=>setActNotes(e.target.value)} placeholder="Notes from this visit / call…" rows={3}
              style={{width:"100%",borderRadius:7,border:`1px solid ${T.b1}`,background:T.s2,color:T.t1,fontSize:12,padding:"7px 9px",outline:"none",fontFamily:"inherit",marginBottom:6,resize:"none",boxSizing:"border-box",lineHeight:1.5}}/>
            <input type="text" value={actFollowUp} onChange={e=>setActFollowUp(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveEntry()} placeholder="Follow-up action (optional)"
              style={{width:"100%",height:34,borderRadius:7,border:`1px solid ${T.b1}`,background:T.s2,color:T.t1,fontSize:12,padding:"0 9px",outline:"none",fontFamily:"inherit",marginBottom:8,boxSizing:"border-box"}}/>
            <button onClick={saveEntry} style={{width:"100%",background:`linear-gradient(90deg,${T.cyan},${T.blue})`,border:"none",borderRadius:8,padding:"9px 0",fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer",fontFamily:"inherit"}}>Save Activity</button>
          </div>}
          {/* Recent entries */}
          {actLog.length===0&&!showActForm&&<div style={{fontSize:11,color:T.t4,textAlign:"center",padding:"4px 0"}}>No activity logged. Tap + Log after visits, calls, or emails.</div>}
          {actLog.slice(0,5).map((entry:any,i:number)=>{
            const d=new Date(entry.ts);
            return <div key={entry.id} style={{borderTop:`1px solid ${T.b1}`,paddingTop:8,marginTop:i===0?0:0,paddingBottom:i<Math.min(actLog.length,5)-1?8:0}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:2}}>
                <div style={{display:"flex",alignItems:"center",gap:5}}>
                  <span style={{fontSize:11}}>{ACT_ICONS[entry.type]||"📋"}</span>
                  <span style={{fontSize:10,fontWeight:700,color:T.t1,textTransform:"capitalize"}}>{entry.type}</span>
                  {entry.contact&&<span style={{fontSize:9,color:T.cyan}}>· {entry.contact}</span>}
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:9,color:T.t4}}>{d.toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span>
                  <button onClick={()=>{const upd=actLog.filter((e:any)=>e.id!==entry.id);setActLog(upd);try{localStorage.setItem(actLogKey,JSON.stringify(upd));}catch{}}} style={{background:"none",border:"none",color:T.t4,cursor:"pointer",fontSize:10,padding:0,lineHeight:1}}>✕</button>
                </div>
              </div>
              {entry.notes&&<div style={{fontSize:11,color:T.t2,lineHeight:1.5,paddingLeft:20,marginBottom:entry.followUp?2:0}}>{entry.notes}</div>}
              {entry.followUp&&<div style={{fontSize:10,color:T.amber,paddingLeft:20,display:"flex",alignItems:"center",gap:3}}><span>→</span>{entry.followUp}</div>}
            </div>;
          })}
          {actLog.length>5&&<div style={{fontSize:9,color:T.t4,textAlign:"center",paddingTop:6}}>+{actLog.length-5} older entries</div>}
        </div>;
      })()}

      {/* ── PRODUCT STORY ── */}
      {(buying.length>0||stopped.length>0||xsell.length>0)&&<div className="anim" style={{animationDelay:"20ms",background:T.s1,border:`1px solid ${T.b1}`,borderRadius:14,padding:"12px 14px",marginBottom:10}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.t3}}>Product Story</div>
          {/* Branch spread pills */}
          <div style={{display:"flex",gap:3,flexWrap:"wrap",justifyContent:"flex-end"}}>
            {spread.branches.map((b:any)=>(
              <span key={b.key} style={{fontSize:8,fontWeight:600,borderRadius:3,padding:"2px 5px",
                color:b.active?"#f0f0fa":b.hadPY?"rgba(248,113,113,.7)":"rgba(92,92,122,.5)",
                background:b.active?"rgba(79,142,247,.10)":b.hadPY?"rgba(248,113,113,.06)":"rgba(255,255,255,.03)",
                border:`1px solid ${b.active?"rgba(79,142,247,.22)":b.hadPY?"rgba(248,113,113,.15)":"rgba(255,255,255,.06)"}`}}>
                {b.label}{b.hadPY&&!b.active?" ↓":""}
              </span>
            ))}
          </div>
        </div>
        {/* Stopped — win-backs first */}
        {stopped.length>0&&<div style={{marginBottom:buying.length>0||xsell.length>0?12:0}}>
          <div style={{fontSize:10,fontWeight:600,color:T.red,marginBottom:6}}>Stopped ({stopped.length})</div>
          {stopped.slice(0,5).map((p:any,i:number)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 8px",borderRadius:6,background:"rgba(248,113,113,.04)",border:"1px solid rgba(248,113,113,.08)",marginBottom:4}}>
              <span style={{fontSize:11,color:T.t1}}>{p.n}</span>
              <span className="m" style={{fontSize:10,color:T.red}}>Was {$$(p[`py${qk}`]||0)} → $0</span>
            </div>
          ))}
          {stopped.length>0&&<div style={{marginTop:5,fontSize:10,color:T.t3,fontStyle:"italic",paddingLeft:2}}>"I noticed {stopped[0]?.n} dropped off. Supply issue or switch? We have new promos..."</div>}
        </div>}
        {/* Currently buying */}
        {buying.length>0&&<div style={{marginBottom:xsell.length>0?12:0}}>
          <div style={{fontSize:10,fontWeight:600,color:T.green,marginBottom:6}}>Buying ({buying.length})</div>
          {buying.slice(0,7).map((p:any,i:number)=>{
            const pPy=p[`py${qk}`]||0;const pCy=p[`cy${qk}`]||0;
            return <div key={i} style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
              <span style={{fontSize:11,color:T.t2,flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.n}</span>
              <span className="m" style={{fontSize:9,color:T.t4,width:46,textAlign:"right",flexShrink:0}}>{$$(pPy)}</span>
              <span style={{fontSize:8,color:T.t4}}>→</span>
              <span className="m" style={{fontSize:10,color:T.blue,width:46,textAlign:"right",flexShrink:0}}>{$$(pCy)}</span>
              <div style={{width:44,height:3,borderRadius:2,background:T.s3,overflow:"hidden",flexShrink:0}}><div className="bar-g" style={{height:"100%",borderRadius:2,width:`${Math.min(pPy>0?pCy/pPy*100:0,100)}%`,background:pPy>0&&pCy/pPy>.3?T.green:T.amber}}/></div>
            </div>;
          })}
        </div>}
        {/* Cross-sell white space */}
        {xsell.length>0&&<>
          <div style={{fontSize:10,fontWeight:600,color:T.purple,marginBottom:6}}>White Space ({xsell.length})</div>
          <div style={{display:"flex",flexDirection:"column",gap:5}}>
            {xsell.slice(0,3).map((o:any,i:number)=>(
              <div key={i} style={{borderRadius:7,background:"rgba(167,139,250,.05)",border:"1px solid rgba(167,139,250,.12)",padding:"6px 9px"}}>
                <div style={{fontSize:10,fontWeight:700,color:T.purple,marginBottom:1}}>{o.label}</div>
                <div style={{fontSize:10,color:T.t3,lineHeight:1.4}}>{o.pitch}</div>
              </div>
            ))}
          </div>
        </>}
      </div>}

      {/* ── PARENT GROUP ── */}
      {parentGroup&&(parentGroup.locs||1)>1&&<div className="anim" style={{animationDelay:"24ms",background:T.s1,border:`1px solid rgba(79,142,247,.18)`,borderRadius:14,padding:"12px 14px",marginBottom:10}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.blue}}>Group</div>
          <button onClick={()=>goGroup(parentGroup)} style={{background:"rgba(79,142,247,.08)",border:"1px solid rgba(79,142,247,.15)",borderRadius:7,padding:"3px 9px",fontSize:10,fontWeight:600,color:T.blue,cursor:"pointer",fontFamily:"inherit"}}>View →</button>
        </div>
        <div style={{fontSize:13,fontWeight:700,marginBottom:1}}>{fixGroupName(parentGroup)}</div>
        <div style={{fontSize:10,color:T.t3,marginBottom:8}}>{parentGroup.locs} locations · {getTierLabel(parentGroup.tier,parentGroup.class2)}</div>
        {(()=>{
          const gPy=parentGroup.pyQ?.["1"]||0;const gCy=parentGroup.cyQ?.["1"]||0;const gGap=gPy-gCy;const gRet=gPy>0?gCy/gPy:0;
          const thisLocPct=gCy>0?(acct.cyQ?.["1"]||0)/gCy:0;
          return <>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:5,marginBottom:7}}>
              <Stat l="PY" v={$$(gPy)} c={T.t2}/><Stat l="CY" v={$$(gCy)} c={T.blue}/><Stat l="Gap" v={gGap<=0?`+${$$(Math.abs(gGap))}`:$$(gGap)} c={gGap<=0?T.green:T.red}/><Stat l="Ret" v={Math.round(gRet*100)+"%"} c={gRet>.5?T.green:gRet>.25?T.amber:T.red}/>
            </div>
            <div style={{fontSize:9,color:T.t4}}>This location = <span style={{color:T.cyan,fontWeight:700}}>{Math.round(thisLocPct*100)}%</span> of group Q1 CY</div>
          </>;
        })()}
        {siblings.length>0&&<>
          <div style={{borderTop:`1px solid ${T.b1}`,marginTop:10,paddingTop:10,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.t3,marginBottom:7}}>Other Locations ({siblings.length})</div>
          {siblings.slice(0,5).map((s:any,i:number)=>{
            const sPy=s.pyQ?.["1"]||0;const sCy=s.cyQ?.["1"]||0;const sGap=sPy-sCy;const sRet=sPy>0?Math.round(sCy/sPy*100):0;const isDown=sGap>0&&sRet<50;
            return <button key={s.id} className="anim" onClick={()=>goAcct?.(s)} style={{animationDelay:`${i*20}ms`,display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",textAlign:"left",padding:"7px 9px",borderRadius:9,background:isDown?"rgba(248,113,113,.04)":T.s2,border:`1px solid ${isDown?"rgba(248,113,113,.15)":T.b2}`,marginBottom:5,cursor:"pointer"}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:11,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.name}</div>
                <div style={{fontSize:9,color:T.t4,marginTop:1}}>{s.city}, {s.st}{s.dealer&&s.dealer!=="All Other"?<span style={{color:T.cyan}}> · {s.dealer}</span>:""}</div>
              </div>
              <div style={{display:"flex",gap:5,alignItems:"center",flexShrink:0,marginLeft:8}}>
                <Pill l="CY" v={$$(sCy)} c={T.blue}/>
                <Pill l="Gap" v={sGap<=0?`+${$$(Math.abs(sGap))}`:$$(sGap)} c={sGap<=0?T.green:T.red}/>
                <Chev/>
              </div>
            </button>;
          })}
          {siblings.length>5&&<div style={{fontSize:9,color:T.t4,textAlign:"center",padding:"3px 0"}}>+{siblings.length-5} more — tap View Group</div>}
        </>}
      </div>}

      {/* ── MULTI-DEALER ── */}
      <MultiDealerView acct={acct}/>

      {/* ── PRODUCT BREAKDOWN (detail) ── */}
      <div className="anim" style={{animationDelay:"28ms",background:T.s1,border:`1px solid ${T.b1}`,borderRadius:14,padding:"12px 14px",marginBottom:10}}>
        <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.t3,marginBottom:9}}>Product Breakdown — {qk==="FY"?"Full Year":`Q${qk}`}</div>
        {products.sort((a:any,b:any)=>Math.abs(b[`py${qk}`]||0)-Math.abs(a[`py${qk}`]||0)).slice(0,10).map((p:any,i:number)=>{
          const pPy=Math.abs(p[`py${qk}`]||0);const pCy=Math.abs(p[`cy${qk}`]||0);
          const mx=Math.max(...products.map((x:any)=>Math.abs(x[`py${qk}`]||0)),1);
          const isExpanded=expandedProduct===p.n;
          const prodRecords=salesStore?.records?Object.values(salesStore.records).filter((r:any)=>r.childId===acct.id&&r.l3===p.n):[];
          prodRecords.sort((a:any,b:any)=>b.year!==a.year?b.year-a.year:b.month-a.month);
          const MONTHS_P=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
          return <div key={i} style={{marginBottom:9}}>
            <div onClick={()=>setExpandedProduct(isExpanded?null:p.n)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3,cursor:"pointer",borderRadius:5,padding:"2px 0",userSelect:"none"}}>
              <div style={{display:"flex",alignItems:"center",gap:4,flex:1,minWidth:0}}>
                <span style={{fontSize:9,color:T.t4,transition:"transform .15s",display:"inline-block",transform:isExpanded?"rotate(90deg)":"rotate(0deg)"}}>▶</span>
                <span style={{fontSize:11,color:T.t2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.n}</span>
              </div>
              <span className="m" style={{fontSize:10,color:pCy===0&&pPy>100?T.red:T.t3,flexShrink:0,marginLeft:8}}>{$$(pPy)} / {$$(pCy)}</span>
            </div>
            <div style={{position:"relative",height:11,borderRadius:3,background:T.s3,overflow:"hidden"}}>
              <div style={{position:"absolute",top:0,left:0,height:"50%",width:`${pPy/mx*100}%`,background:"rgba(255,255,255,.08)"}}/>
              <div className="bar-g" style={{animationDelay:`${i*60}ms`,position:"absolute",bottom:0,left:0,height:"50%",width:`${pCy/mx*100}%`,background:pCy===0?T.red:`linear-gradient(90deg,${T.blue},${T.cyan})`}}/>
            </div>
            {isExpanded&&<div style={{marginTop:7,background:T.s2,borderRadius:9,padding:"9px 10px",border:`1px solid ${T.b1}`}}>
              {prodRecords.length===0
                ?<div style={{fontSize:10,color:T.t4,textAlign:"center",padding:"2px 0"}}>No monthly history — upload a CSV to populate</div>
                :(()=>{
                    const maxProdVal=Math.max(...(prodRecords as any[]).map((r:any)=>Math.max(r.py||0,r.cy||0)),1);
                    return <>
                      <div style={{display:"grid",gridTemplateColumns:"76px 40px 1fr 1fr",gap:4,marginBottom:5,paddingBottom:4,borderBottom:`1px solid ${T.b1}`}}>
                        {["Month","Q","PY","CY"].map(h=><span key={h} style={{fontSize:8,fontWeight:700,color:T.t4,textTransform:"uppercase",letterSpacing:.5,textAlign:h==="PY"||h==="CY"?"right":"left"}}>{h}</span>)}
                      </div>
                      {(prodRecords as any[]).map((r:any,ri:number)=>(
                        <div key={r.txKey} style={{marginBottom:ri<prodRecords.length-1?4:0}}>
                          <div style={{display:"grid",gridTemplateColumns:"76px 40px 1fr 1fr",gap:4,padding:"2px 0",alignItems:"center"}}>
                            <span style={{fontSize:10,color:T.t2}}>{MONTHS_P[(r.month||1)-1]} {r.year}</span>
                            <span style={{fontSize:10,color:T.t3}}>Q{r.quarter}</span>
                            <span style={{fontSize:10,fontFamily:"monospace",color:r.py>0?T.t2:T.t4,textAlign:"right"}}>{r.py>0?`$${r.py.toLocaleString()}`:"—"}</span>
                            <span style={{fontSize:10,fontFamily:"monospace",color:r.cy>0?T.cyan:T.t4,textAlign:"right"}}>{r.cy>0?`$${r.cy.toLocaleString()}`:"—"}</span>
                          </div>
                          <div style={{position:"relative",height:3,borderRadius:2,background:T.s3,overflow:"hidden",marginTop:2}}>
                            <div style={{position:"absolute",top:0,left:0,height:"100%",borderRadius:2,width:`${(r.py||0)/maxProdVal*100}%`,background:"rgba(120,120,160,.3)"}}/>
                            <div style={{position:"absolute",top:0,left:0,height:"100%",borderRadius:2,width:`${(r.cy||0)/maxProdVal*100}%`,background:r.cy>0?`linear-gradient(90deg,${T.blue},${T.cyan})`:"rgba(248,113,113,.5)"}}/>
                          </div>
                        </div>
                      ))}
                    </>;
                  })()
              }
            </div>}
          </div>;
        })}
        <div style={{display:"flex",gap:12,marginTop:6,fontSize:9,color:T.t4}}><span>▬ PY</span><span style={{color:T.blue}}>▬ CY</span></div>
      </div>

      {/* ── MANUAL SALE ── */}
      <div className="anim" style={{animationDelay:"32ms",background:T.s1,border:`1px solid ${T.b1}`,borderRadius:14,padding:"12px 14px",marginBottom:10}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:showForm?10:0}}>
          <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.amber}}>Log a Sale</div>
          <button onClick={()=>setShowForm(!showForm)} style={{background:"rgba(251,191,36,.08)",border:"1px solid rgba(251,191,36,.15)",borderRadius:7,color:T.amber,cursor:"pointer",fontSize:11,fontWeight:600,padding:"4px 9px",fontFamily:"inherit"}}>{showForm?"Cancel":"+ Add"}</button>
        </div>
        {showForm&&<SaleCalculator acctTier={acctTier} tierRate={tierRate} isAccel={isAccel} acctType={acctType} onAdd={(credited:number,detail:any)=>{
          setAdjs((prev:any)=>[...prev,{id:Date.now(),acctId:acct.id,acctName:acct.name,...detail,credited}]);
          setToast(credited);setShowForm(false);
          setTimeout(()=>setToast(null),4000);
        }}/>}
        {!showForm&&myAdj.length===0&&<div style={{fontSize:11,color:T.t4,textAlign:"center",padding:"6px 0"}}>Search product by name or SKU#, enter doctor spend → auto-calculates credited revenue.</div>}
      </div>

      {/* ── RESEARCH RESULTS (below fold — on-demand) ── */}
      {(drState==="loading"||drState==="done"||drState==="error")&&<div className="anim" style={{background:`linear-gradient(135deg,${T.s1},rgba(34,211,238,.05))`,border:`1px solid rgba(34,211,238,.25)`,borderRadius:14,padding:"12px 14px",marginBottom:10}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:12}}>🔍</span>
            <span style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.cyan}}>Live Practice Intel</span>
          </div>
          <button onClick={()=>{setDrState("idle");setDrIntel(null);}} style={{background:"none",border:"none",color:T.t4,cursor:"pointer",fontSize:15,lineHeight:1}}>✕</button>
        </div>
        {drState==="loading"&&<div style={{display:"flex",flexDirection:"column",gap:7}}>{[90,70,80,50,85].map((w,i)=><div key={i} style={{height:10,borderRadius:5,background:T.s3,width:`${w}%`,animation:"pulse 1.5s infinite",animationDelay:`${i*200}ms`}}/>)}<div style={{fontSize:11,color:T.t4,marginTop:3}}>Searching the web for practice intel...</div></div>}
        {drState==="error"&&<div style={{fontSize:12,color:T.red}}>{drIntel?.error||"Research failed."}</div>}
        {drState==="done"&&drIntel&&!drIntel.parseError&&<div>
          {drIntel.statusNote&&<div style={{marginBottom:9,padding:"7px 9px",borderRadius:7,background:drIntel.status==="open"?"rgba(52,211,153,.06)":"rgba(248,113,113,.08)",border:`1px solid ${drIntel.status==="open"?"rgba(52,211,153,.15)":"rgba(248,113,113,.15)"}`}}>
            <div style={{fontSize:9,textTransform:"uppercase",color:T.t4,marginBottom:2}}>Practice Status</div>
            <div style={{fontSize:11,fontWeight:600,color:drIntel.status==="open"?T.green:drIntel.status==="closed"?T.red:T.amber}}>{drIntel.statusNote}</div>
          </div>}
          {(drIntel.phone||drIntel.email||drIntel.contactName||drIntel.website)&&<div style={{marginBottom:9,display:"flex",flexWrap:"wrap",gap:8}}>
            {drIntel.contactName&&<div><div style={{fontSize:9,color:T.t3,textTransform:"uppercase",marginBottom:1}}>Contact</div><div style={{fontSize:11,fontWeight:600}}>{drIntel.contactName}</div></div>}
            {drIntel.phone&&<div><div style={{fontSize:9,color:T.t3,textTransform:"uppercase",marginBottom:1}}>Phone</div><a href={`tel:${drIntel.phone}`} style={{fontSize:11,fontWeight:600,color:T.cyan,textDecoration:"none"}}>{drIntel.phone}</a></div>}
            {drIntel.email&&<div><div style={{fontSize:9,color:T.t3,textTransform:"uppercase",marginBottom:1}}>Email</div><div style={{fontSize:11,fontWeight:600,color:T.cyan}}>{drIntel.email}</div></div>}
            {drIntel.website&&<div><div style={{fontSize:9,color:T.t3,textTransform:"uppercase",marginBottom:1}}>Website</div><a href={drIntel.website} target="_blank" rel="noreferrer" style={{fontSize:11,fontWeight:600,color:T.blue,textDecoration:"none"}}>Visit →</a></div>}
          </div>}
          {drIntel.ownershipNote&&<div style={{marginBottom:9}}><div style={{fontSize:9,color:T.t3,textTransform:"uppercase",marginBottom:2}}>Ownership</div><div style={{fontSize:11,color:T.t2}}>{drIntel.ownershipNote}</div></div>}
          {drIntel.hooks?.length>0&&<div style={{marginBottom:9}}><div style={{fontSize:9,color:T.t3,textTransform:"uppercase",marginBottom:5}}>Relationship Hooks</div>
            {drIntel.hooks.map((h:any,i:number)=><div key={i} style={{display:"flex",gap:5,alignItems:"flex-start",marginBottom:4}}><span style={{color:T.amber,marginTop:1,fontSize:9}}>◆</span><span style={{fontSize:11,color:T.t2,lineHeight:1.5}}>{h}</span></div>)}</div>}
          {drIntel.competitive&&<div style={{marginBottom:9,padding:"7px 9px",borderRadius:7,background:"rgba(248,113,113,.05)",border:"1px solid rgba(248,113,113,.1)"}}><div style={{fontSize:9,color:T.t3,textTransform:"uppercase",marginBottom:2}}>Competitive Signal</div><div style={{fontSize:11,color:T.t2}}>{drIntel.competitive}</div></div>}
          {drIntel.talkingPoints?.length>0&&<div><div style={{fontSize:9,color:T.t3,textTransform:"uppercase",marginBottom:5}}>Talking Points</div>
            {drIntel.talkingPoints.map((p:any,i:number)=><div key={i} style={{display:"flex",gap:5,alignItems:"flex-start",marginBottom:5,padding:"5px 7px",borderRadius:6,background:"rgba(79,142,247,.05)",border:"1px solid rgba(79,142,247,.1)"}}><span style={{color:T.blue,fontWeight:700,fontSize:9,marginTop:1,flexShrink:0}}>{i+1}.</span><span style={{fontSize:11,color:T.t1,lineHeight:1.5}}>{p}</span></div>)}</div>}
          {groupSuggestions.length>0&&groupSuggestions[0]?.id==="__searching__"&&<div style={{marginTop:10,padding:"9px 11px",borderRadius:9,background:"rgba(79,142,247,.05)",border:"1px solid rgba(79,142,247,.15)",display:"flex",alignItems:"center",gap:7}}><div style={{width:11,height:11,borderRadius:"50%",border:"2px solid rgba(79,142,247,.3)",borderTopColor:T.blue,animation:"spin 0.8s linear infinite",flexShrink:0}}/><div style={{fontSize:11,color:T.t3}}>Searching for related accounts…</div></div>}
          {groupSuggestions.length>0&&groupSuggestions[0]?.id!=="__searching__"&&<div style={{marginTop:10,padding:"9px 11px",borderRadius:9,background:"rgba(79,142,247,.08)",border:"1px solid rgba(79,142,247,.2)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
              <div><div style={{fontSize:10,fontWeight:700,color:T.blue}}>🔗 Related Accounts Found</div><div style={{fontSize:9,color:T.t4,marginTop:1}}>May be a multi-location group</div></div>
              <button onClick={()=>{setSuggestSelected(new Set(groupSuggestions.map((s:any)=>s.id)));setSuggestModal(true);}} style={{background:"rgba(79,142,247,.15)",border:"1px solid rgba(79,142,247,.3)",borderRadius:7,padding:"3px 9px",fontSize:10,fontWeight:700,color:T.blue,cursor:"pointer",fontFamily:"inherit"}}>Link</button>
            </div>
            {groupSuggestions.slice(0,3).map((s:any)=>(<div key={s.id} style={{marginTop:3,paddingLeft:3}}><div style={{fontSize:11,color:T.t1,fontWeight:600}}>· {s.name} — {s.city}, {s.st}</div>{s.matchReason&&<div style={{fontSize:9,color:T.t4,paddingLeft:8,marginTop:1,fontStyle:"italic"}}>{s.matchReason}</div>}</div>))}
            {groupSuggestions.length>3&&<div style={{fontSize:9,color:T.t4,marginTop:2,paddingLeft:3}}>+{groupSuggestions.length-3} more</div>}
          </div>}
          {drIntel.searchedAt&&<div style={{fontSize:9,color:T.t4,marginTop:7,textAlign:"right"}}>Researched {new Date(drIntel.searchedAt).toLocaleTimeString()}</div>}
        </div>}
        {drState==="done"&&drIntel?.parseError&&<div style={{fontSize:11,color:T.t2,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{drIntel.rawText}</div>}
      </div>}

      {/* ── AI BRIEFING ── */}
      {(aiState==="loading"||aiState==="done"||aiState==="error")&&<div className="anim" style={{background:`linear-gradient(135deg,${T.s1},rgba(167,139,250,.06))`,border:`1px solid rgba(167,139,250,.2)`,borderRadius:14,padding:"12px 14px",marginBottom:10}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:13,color:T.purple}}>✦</span><span style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.purple}}>AI Briefing</span></div>
          <button onClick={()=>{setAiState("idle");setAiText("");}} style={{background:"none",border:"none",color:T.t4,cursor:"pointer",fontSize:15,lineHeight:1}}>✕</button>
        </div>
        {aiState==="loading"&&<div style={{display:"flex",flexDirection:"column",gap:7}}>{[100,80,90,60].map((w,i)=><div key={i} style={{height:10,borderRadius:5,background:T.s3,width:`${w}%`,animation:"pulse 1.5s infinite",animationDelay:`${i*150}ms`}}/>)}<div style={{fontSize:11,color:T.t4,marginTop:3}}>Analyzing account data...</div></div>}
        {aiState==="done"&&<div style={{fontSize:12,color:T.t2,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{aiText}</div>}
        {aiState==="error"&&<div style={{fontSize:12,color:T.red}}>{aiText}</div>}
      </div>}

      {/* ── SALES HISTORY ── */}
      {(()=>{
        const records=salesStore?.records?Object.values(salesStore.records).filter((r:any)=>r.childId===acct.id):[];
        records.sort((a:any,b:any)=>b.year!==a.year?b.year-a.year:b.month-a.month);
        const MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        return <div className="anim" style={{animationDelay:"36ms",background:T.s1,border:`1px solid ${T.b1}`,borderRadius:14,padding:"12px 14px",marginBottom:10}}>
          <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:T.t3,marginBottom:9}}>Sales History</div>
          {records.length===0
            ?<div style={{fontSize:11,color:T.t4,textAlign:"center",padding:"5px 0"}}>No history on record — upload a CSV to populate.</div>
            :<>
                <div style={{display:"grid",gridTemplateColumns:"80px 48px 1fr 1fr",gap:4,marginBottom:5,paddingBottom:5,borderBottom:`1px solid ${T.b1}`}}>
                  {["Month","Q","PY","CY"].map(h=><span key={h} style={{fontSize:9,fontWeight:700,color:T.t4,textTransform:"uppercase",letterSpacing:.5,textAlign:h==="PY"||h==="CY"?"right":"left"}}>{h}</span>)}
                </div>
                {(records as any[]).map((r:any,i:number)=>(
                  <div key={r.txKey} style={{display:"grid",gridTemplateColumns:"80px 48px 1fr 1fr",gap:4,padding:"4px 0",borderBottom:i<records.length-1?`1px solid ${T.b1}`:"none",alignItems:"center"}}>
                    <span style={{fontSize:11,color:T.t2}}>{MONTHS[(r.month||1)-1]} {r.year}</span>
                    <span style={{fontSize:11,color:T.t3}}>Q{r.quarter}</span>
                    <span style={{fontSize:11,fontFamily:"monospace",color:r.py>0?T.t2:T.t4,textAlign:"right"}}>{r.py>0?`$${r.py.toLocaleString()}`:"—"}</span>
                    <span style={{fontSize:11,fontFamily:"monospace",color:r.cy>0?T.cyan:T.t4,textAlign:"right"}}>{r.cy>0?`$${r.cy.toLocaleString()}`:"—"}</span>
                  </div>
                ))}
                <div style={{fontSize:9,color:T.t4,marginTop:6,textAlign:"right"}}>{records.length} record{records.length!==1?"s":""}</div>
              </>
          }
        </div>;
      })()}

    </div>

    {/* ── MOVE TO GROUP MODAL ── */}
    {showMoveModal&&<div style={{position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,.7)",backdropFilter:"blur(8px)",display:"flex",flexDirection:"column",justifyContent:"flex-end"}} onClick={()=>{setShowMoveModal(false);setMoveSearch("");setMoveTarget(null);}}>
      <div style={{background:T.s1,borderRadius:"20px 20px 0 0",padding:20,maxHeight:"70vh",display:"flex",flexDirection:"column"}} onClick={(e:any)=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{fontSize:13,fontWeight:700}}>{moveTarget?"Confirm Move":"Move to Group"}</div>
          <button onClick={()=>{setShowMoveModal(false);setMoveSearch("");setMoveTarget(null);}} style={{background:"none",border:"none",color:T.t4,cursor:"pointer",fontSize:18}}>✕</button>
        </div>
        {moveTarget?(
          <div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:9,fontWeight:700,color:T.t4,textTransform:"uppercase",letterSpacing:"1px",marginBottom:6}}>From</div>
              <div style={{background:T.s2,border:`1px solid ${T.b1}`,borderRadius:10,padding:"10px 14px"}}><div style={{fontSize:13,fontWeight:600,color:T.t2}}>{acct.gName||"Standalone"}</div><div style={{fontSize:10,color:T.t4,marginTop:2}}>{acct.name}</div></div>
            </div>
            <div style={{textAlign:"center",fontSize:18,color:T.t4,margin:"4px 0 10px"}}>↓</div>
            <div style={{marginBottom:20}}>
              <div style={{fontSize:9,fontWeight:700,color:T.blue,textTransform:"uppercase",letterSpacing:"1px",marginBottom:6}}>To</div>
              <div style={{background:"rgba(79,142,247,.08)",border:"1px solid rgba(79,142,247,.25)",borderRadius:10,padding:"10px 14px"}}><div style={{fontSize:13,fontWeight:700,color:T.blue}}>{fixGroupName(moveTarget)}</div><div style={{fontSize:10,color:T.t4,marginTop:2}}>{moveTarget.locs} location{moveTarget.locs!==1?"s":""} · {getTierLabel(moveTarget.tier,moveTarget.class2)}</div></div>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setMoveTarget(null)} style={{flex:1,padding:"11px 0",borderRadius:10,border:`1px solid ${T.b1}`,background:"transparent",color:T.t3,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Back</button>
              <button onClick={()=>{applyGroupOverride(moveTarget);setMoveTarget(null);}} style={{flex:2,padding:"11px 0",borderRadius:10,border:"none",background:T.blue,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Confirm Move</button>
            </div>
          </div>
        ):(
          <>
            <div style={{fontSize:11,color:T.t3,marginBottom:10}}>Account: <strong style={{color:T.t1}}>{acct.name}</strong>{acct.gName&&<span style={{color:T.t4}}> · currently in <strong style={{color:T.t3}}>{acct.gName}</strong></span>}</div>
            <input autoFocus type="search" value={moveSearch} onChange={(e:any)=>setMoveSearch(e.target.value)} placeholder="Search groups…"
              style={{width:"100%",height:40,borderRadius:10,border:`1px solid ${T.b1}`,background:T.s2,color:T.t1,fontSize:13,padding:"0 12px",outline:"none",fontFamily:"inherit",marginBottom:12}}/>
            <div style={{overflowY:"auto",flex:1}}>
              {moveSearch.trim()&&moveResults.length===0&&<div style={{padding:"20px 0",textAlign:"center",color:T.t4,fontSize:12}}>No groups found</div>}
              {moveResults.map((g:any)=>(
                <button key={g.id} onClick={()=>setMoveTarget(g)}
                  style={{width:"100%",textAlign:"left",background:T.s2,border:`1px solid ${T.b1}`,borderRadius:12,padding:"10px 14px",marginBottom:8,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div><div style={{fontSize:13,fontWeight:600}}>{fixGroupName(g)}</div><div style={{fontSize:10,color:T.t3,marginTop:2}}>{g.locs} location{g.locs!==1?"s":""} · {getTierLabel(g.tier,g.class2)}</div></div>
                  <Chev/>
                </button>
              ))}
              {!moveSearch.trim()&&<div style={{padding:"20px 0",textAlign:"center",color:T.t4,fontSize:12}}>Type a group name to search</div>}
            </div>
          </>
        )}
      </div>
    </div>}

    {/* ── GROUP LINK MODAL ── */}
    {suggestModal&&<div style={{position:"fixed",inset:0,zIndex:210,background:"rgba(0,0,0,.75)",backdropFilter:"blur(8px)",display:"flex",alignItems:"flex-end"}} onClick={()=>setSuggestModal(false)}>
      <div style={{width:"100%",background:T.s1,borderRadius:"20px 20px 0 0",padding:20,maxHeight:"80vh",display:"flex",flexDirection:"column"}} onClick={(e:any)=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
          <div><div style={{fontSize:14,fontWeight:700}}>Link into a Group</div><div style={{fontSize:10,color:T.t4,marginTop:2}}>Select accounts to merge with <strong style={{color:T.t1}}>{acct.name}</strong></div></div>
          <button onClick={()=>setSuggestModal(false)} style={{background:"none",border:"none",color:T.t4,cursor:"pointer",fontSize:18}}>✕</button>
        </div>
        <div style={{overflowY:"auto",flex:1,margin:"12px 0"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,background:"rgba(79,142,247,.08)",border:"1px solid rgba(79,142,247,.2)",marginBottom:6}}>
            <div style={{width:18,height:18,borderRadius:4,background:T.blue,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:11,color:"#fff",fontWeight:700}}>✓</span></div>
            <div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:700,color:T.blue}}>{acct.name}</div><div style={{fontSize:10,color:T.t4}}>{acct.city}, {acct.st} · this account</div></div>
          </div>
          {groupSuggestions.map((s:any)=>{
            const sel=suggestSelected.has(s.id);
            return <div key={s.id} onClick={()=>{const next=new Set(suggestSelected);sel?next.delete(s.id):next.add(s.id);setSuggestSelected(next);}} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,background:sel?"rgba(52,211,153,.06)":T.s2,border:"1px solid "+(sel?"rgba(52,211,153,.25)":T.b2),marginBottom:6,cursor:"pointer"}}>
              <div style={{width:18,height:18,borderRadius:4,background:sel?T.green:T.s3,border:"1px solid "+(sel?"rgba(52,211,153,.4)":T.b1),display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{sel&&<span style={{fontSize:11,color:"#fff",fontWeight:700}}>✓</span>}</div>
              <div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:600,color:T.t1}}>{s.name}</div><div style={{fontSize:10,color:T.t4}}>{s.city}, {s.st}{s.dealer&&s.dealer!=="All Other"?" · "+s.dealer:""}</div></div>
              <div style={{fontSize:11,fontFamily:"monospace",color:T.t3,flexShrink:0}}>{$$(s.pyQ?.["1"]||0)}</div>
            </div>;
          })}
        </div>
        <div style={{fontSize:10,color:T.t4,marginBottom:10}}>{suggestSelected.size} of {groupSuggestions.length} selected · will be grouped with this account</div>
        <button disabled={suggestSelected.size===0} onClick={()=>{
          if(suggestSelected.size===0)return;
          const newGroupId="Master-MERGE-"+acct.id;
          const baseName=acct.name.replace(/\s+(dental|dentistry|associates|dds|dmd|llc|pc|pllc)\b.*/i,"").trim();
          const childIds=[acct.id,...Array.from(suggestSelected)];
          if(patchOverlay){const groupEntry={id:newGroupId,name:baseName,tier:acct.gTier||acct.tier||"Standard",class2:"Private Practice",childIds,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};patchOverlay([{op:"set",path:`groups.${newGroupId}`,value:groupEntry}]);}
          setSuggestModal(false);setGroupSuggestions([]);setToast(99);setTimeout(()=>setToast(null),4000);
        }} style={{width:"100%",background:suggestSelected.size>0?"linear-gradient(90deg,"+T.blue+","+T.cyan+")":"rgba(79,142,247,.3)",border:"none",borderRadius:10,padding:"12px 0",fontSize:13,fontWeight:700,color:"#fff",cursor:suggestSelected.size>0?"pointer":"not-allowed",fontFamily:"inherit"}}>
          Create Group ({suggestSelected.size+1} accounts)
        </button>
      </div>
    </div>}
    {showReorder&&<ReorderInvoice acct={acct} activeQ={q||"1"} salesStore={salesStore} onClose={()=>setShowReorder(false)}/>}
  </div>;
}


// ─── SALE CALCULATOR ─────────────────────────────────────────────
function SaleCalculator({acctTier,tierRate,isAccel,acctType,onAdd}) {
  const [search,setSearch]=useState("");
  const [selSku,setSelSku]=useState(null);
  const [docSpend,setDocSpend]=useState("");

  const results=search.length>=2?SKU.filter(p=>{
    const q=search.toLowerCase();
    return String(p[0]).toLowerCase().includes(q)||String(p[1]).toLowerCase().includes(q)||String(p[2]).toLowerCase().includes(q);
  }).slice(0,8):[];

  const calc=useMemo(()=>{
    if(!selSku||!docSpend||parseFloat(docSpend)<=0)return null;
    const spend=parseFloat(docSpend);
    const [sku,desc,cat,stdWS,stdMSRP,diaWS,diaMSRP,platWS,platMSRP,goldWS,goldMSRP,silvWS,silvMSRP]=selSku;
    let tierMSRP,tierWS;
    if(isAccel){
      const t=acctTier.includes("-")?acctTier.split("-")[1]:acctTier;
      if(t==="Diamond"){tierMSRP=diaMSRP;tierWS=diaWS;}
      else if(t==="Platinum"){tierMSRP=platMSRP;tierWS=platWS;}
      else if(t==="Gold"){tierMSRP=goldMSRP;tierWS=goldWS;}
      else if(t==="Silver"){tierMSRP=silvMSRP;tierWS=silvWS;}
      else{tierMSRP=stdMSRP;tierWS=stdWS;}
    }else{tierMSRP=stdMSRP;tierWS=stdWS;}
    const units=spend/tierMSRP;
    const totalWS=stdWS*units;
    const totalCredited=tierWS*units;
    const totalCB=totalWS-totalCredited;
    return{units,totalWS,totalCredited,totalCB,tierMSRP,tierWS,stdMSRP,stdWS,desc,sku};
  },[selSku,docSpend,acctTier,isAccel]);

  return <div style={{background:T.s2,borderRadius:12,padding:14,border:`1px solid ${T.b2}`}}>
    <div style={{fontSize:10,color:T.t3,marginBottom:10}}>
      {isAccel?<>Account: <strong style={{color:T.amber}}>Accelerate {acctTier}</strong></>:<>Account: <strong style={{color:T.green}}>{acctType}</strong> — full wholesale credit</>}
    </div>
    <div style={{marginBottom:10}}>
      <label style={{fontSize:11,color:T.t1,display:"block",marginBottom:4,fontWeight:600}}>1. Search Product</label>
      {selSku?<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",borderRadius:8,background:"rgba(79,142,247,.08)",border:"1px solid rgba(79,142,247,.2)"}}>
        <div><div style={{fontSize:12,fontWeight:600,color:T.t1}}>#{selSku[0]} — {selSku[1]}</div><div style={{fontSize:10,color:T.t3}}>{selSku[2]} · Std MSRP ${selSku[4]}</div></div>
        <button onClick={()=>{setSelSku(null);setDocSpend("");setSearch("")}} style={{background:"none",border:"none",color:T.t4,cursor:"pointer",fontSize:16,fontFamily:"inherit"}}>✕</button>
      </div>:<div>
        <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Type SKU# or product name..." style={{width:"100%",height:40,borderRadius:8,border:`1px solid ${T.b1}`,background:T.s1,color:T.t1,fontSize:13,padding:"0 12px",outline:"none",fontFamily:"inherit"}}/>
        {results.length>0&&<div style={{marginTop:4,borderRadius:8,border:`1px solid ${T.b1}`,background:T.s1,maxHeight:200,overflowY:"auto"}}>
          {results.map(p=><button key={p[0]} onClick={()=>{setSelSku(p);setSearch("")}} style={{width:"100%",textAlign:"left",padding:"8px 12px",background:"none",border:"none",borderBottom:`1px solid ${T.b1}`,color:T.t1,cursor:"pointer",fontFamily:"inherit",fontSize:11}}>
            <div style={{fontWeight:600}}>#{p[0]} — {p[1]}</div>
            <div style={{fontSize:9,color:T.t4}}>{p[2]} · MSRP ${p[4]}</div>
          </button>)}
        </div>}
      </div>}
    </div>
    {selSku&&<div style={{marginBottom:10}}>
      <label style={{fontSize:11,color:T.t1,display:"block",marginBottom:4,fontWeight:600}}>2. Doctor Spend ($)</label>
      <div style={{position:"relative"}}>
        <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:16,color:T.t4,fontFamily:"'JetBrains Mono',monospace"}}>$</span>
        <input type="number" value={docSpend} onChange={e=>setDocSpend(e.target.value)} placeholder="e.g. 5000" style={{width:"100%",height:42,borderRadius:8,border:`1px solid ${T.b1}`,background:T.s1,color:T.t1,fontSize:16,padding:"0 12px 0 30px",outline:"none",fontFamily:"'JetBrains Mono',monospace"}}/>
      </div>
    </div>}
    {calc&&<div style={{background:"rgba(79,142,247,.06)",border:"1px solid rgba(79,142,247,.12)",borderRadius:8,padding:12,marginBottom:10}}>
      <div style={{fontSize:10,fontWeight:700,color:T.blue,marginBottom:8}}>Calculation Breakdown</div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.t3,marginBottom:3}}><span>Doctor spent</span><span className="m" style={{color:T.t1}}>{$f(parseFloat(docSpend))}</span></div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.t3,marginBottom:3}}><span>÷ ${calc.tierMSRP.toFixed(2)}/unit MSRP</span><span className="m" style={{color:T.t1}}>{calc.units.toFixed(1)} units</span></div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.t3,marginBottom:3}}><span>× ${calc.stdWS.toFixed(2)} std wholesale/unit</span><span className="m" style={{color:T.t1}}>{$f(calc.totalWS)}</span></div>
      {isAccel&&calc.totalCB>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.t3,marginBottom:3}}><span>{acctTier} chargeback</span><span className="m" style={{color:T.red}}>-{$f(calc.totalCB)}</span></div>}
      <div style={{borderTop:`1px solid ${T.b2}`,marginTop:6,paddingTop:6,display:"flex",justifyContent:"space-between",fontSize:14,fontWeight:700}}>
        <span style={{color:T.t1}}>→ Your Q1 Credit</span>
        <span className="m" style={{color:T.green,fontSize:16}}>{$f(calc.totalCredited)}</span>
      </div>
    </div>}
    {calc?<button onClick={()=>onAdd(calc.totalCredited,{desc:`${calc.desc} (${calc.units.toFixed(1)} units)`,ws:calc.totalWS,tierRate,sku:calc.sku})} style={{width:"100%",height:42,borderRadius:10,border:"none",background:`linear-gradient(90deg,${T.blue},${T.cyan})`,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
      Apply +{$f(calc.totalCredited)} → Updates Q1
    </button>:<div style={{padding:8,textAlign:"center",fontSize:11,color:T.t4}}>Search a product, enter doctor spend → see credited amount</div>}
  </div>;
}

export default AcctDetail;


