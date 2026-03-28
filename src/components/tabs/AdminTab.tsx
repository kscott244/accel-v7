"use client";
// @ts-nocheck
import { useState } from "react";
import { T } from "@/lib/tokens";
import { $$ } from "@/lib/format";
// A15.6: CPID files are SUGGESTION INPUTS only — static snapshots of candidate merge pairs.
// They are never written to and never constitute source of truth.
// Source of truth: overlays.groups (applied) + overlays.skippedCpidIds (dismissed)
import CPID_MERGES from "@/data/cpid-pending-merges.json";
import CPID_REVIEW from "@/data/cpid-review-queue.json";
// Anchor-orphan suggestions — static snapshot, never written to
import DATA_DISCOVERIES from "@/data/data_discoveries.json";
const ANCHOR_ORPHANS: any[] = (DATA_DISCOVERIES as any).anchor_orphans || [];

import { BADGER, OVERLAYS_REF } from "@/lib/data";
import { AccountId } from "@/components/primitives";

function AdminTab({groups, scored, overlays, saveOverlays, salesStore}:{groups:any[], scored:any[], overlays:any, saveOverlays:any, salesStore?:any}) {
  const [section, setSection] = useState<string>("groups"); // groups | detach | names | contacts
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{msg:string,ok:boolean}|null>(null);
  // Admin reads/writes from overlays prop (passed from AppInner)
  // No local patches state needed — overlays is the single source of truth

  // Search
  const [search, setSearch] = useState("");

  // Create Group form
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupClass, setNewGroupClass] = useState("Emerging DSO");
  const [groupType, setGroupType] = useState<"multi"|"private">("multi");
  const [childIdInput, setChildIdInput] = useState("");
  const [childIds, setChildIds] = useState<string[]>([]);
  const [editingGroup, setEditingGroup] = useState<any>(null);

  // Detach form
  const [detachSearch, setDetachSearch] = useState("");
  const [detachAccount, setDetachAccount] = useState<any>(null);
  const [detachNewName, setDetachNewName] = useState("");

  // Name override form
  const [nameSearch, setNameSearch] = useState("");
  const [nameAccount, setNameAccount] = useState<any>(null);
  const [nameNewValue, setNameNewValue] = useState("");

  // Dupes view
  const [dupesView, setDupesView] = useState<"auto"|"review"|"live">("auto");
  const [reviewPage, setReviewPage] = useState(0);
  // A15.6: skippedMergeIds is now sourced from overlays.skippedCpidIds (GitHub-persisted)
  // merged with localStorage (migration fallback for any device-local skips).
  // Skips now survive device changes and localStorage clears — same durability as approvals.
  const [skippedMergeIds, setSkippedMergeIds] = useState<Record<string,boolean>>(() => {
    // Start from overlay-persisted skips (cross-device, authoritative)
    const fromOverlay: Record<string,boolean> = {};
    try {
      const ov = OVERLAYS_REF;
      (ov?.skippedCpidIds || []).forEach((id:string) => { fromOverlay[id] = true; });
    } catch {}
    // Merge in any localStorage skips (migration: picks up skips made before A15.6)
    try {
      const local = JSON.parse(localStorage.getItem("cpid_skipped")||"{}");
      return { ...local, ...fromOverlay };
    } catch {}
    return fromOverlay;
  });

  // Contact form
  // Orphan suggestions state
  const [orphanDentalOnly, setOrphanDentalOnly] = useState(true);
  const [skippedOrphanKeys, setSkippedOrphanKeys] = useState<Record<string,boolean>>(() => {
    try {
      const fromOv: Record<string,boolean> = {};
      (overlays?.skippedOrphanIds || []).forEach((k:string) => { fromOv[k] = true; });
      return fromOv;
    } catch { return {}; }
  });
  const [contactSearch, setContactSearch] = useState("");

  // Quarter target overrides — localStorage only, no GitHub write needed
  const [targetInputs, setTargetInputs] = useState<Record<string,string>>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("quarter_targets") || "{}");
      const result: Record<string,string> = {};
      ["1","2","3","4"].forEach(q => { result[q] = stored[q] ? String(stored[q]) : ""; });
      return result;
    } catch { return {"1":"","2":"","3":"","4":""}; }
  });
  const [targetSaved, setTargetSaved] = useState(false);
  const [contactAccount, setContactAccount] = useState<any>(null);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactNote, setContactNote] = useState("");

  const showToast = (msg:string, ok=true) => {
    setToast({msg,ok});
    setTimeout(()=>setToast(null), 3500);
  };

  // Search helper — find accounts by name, address, city, state, or ID
  const searchAccounts = (q:string) => {
    if(!q || q.length < 2) return [];
    const ql = q.toLowerCase();
    return scored.filter(a =>
      a.name?.toLowerCase().includes(ql) ||
      a.id?.toLowerCase().includes(ql) ||
      a.city?.toLowerCase().includes(ql) ||
      a.st?.toLowerCase().includes(ql) ||
      a.addr?.toLowerCase().includes(ql)
    ).slice(0,25);
  };

  // Search groups
  const searchGroups = (q:string) => {
    if(!q || q.length < 2) return [];
    const ql = q.toLowerCase();
    return groups.filter(g =>
      (g.name||'').toLowerCase().includes(ql) ||
      g.id?.toLowerCase().includes(ql)
    ).slice(0,6);
  };

  // All admin saves go through saveOverlays (central persistence service)
  // This updates in-memory state, writes to localStorage cache, and commits to GitHub
  async function adminSave(nextOverlays: any, successMsg: string) {
    setSaving(true);
    const ok = await saveOverlays(nextOverlays);
    if (ok) {
      showToast(`✅ ${successMsg}`);
      setNewGroupName(""); setChildIds([]); setChildIdInput(""); setEditingGroup(null);
      setDetachAccount(null); setDetachSearch(""); setDetachNewName("");
      setNameAccount(null); setNameSearch(""); setNameNewValue("");
      setContactAccount(null); setContactSearch(""); setContactName(""); setContactEmail(""); setContactPhone(""); setContactNote("");
    } else {
      showToast("❌ Save failed — check connection", false);
    }
    setSaving(false);
  }

  const sectionBtn = (k:string, label:string) => (
    <button onClick={()=>setSection(k)} style={{
      padding:"7px 14px", borderRadius:8, border:"none", fontFamily:"inherit",
      background:section===k?"rgba(79,142,247,.2)":"transparent",
      color:section===k?T.blue:T.t3, fontSize:11, fontWeight:700, cursor:"pointer"
    }}>{label}</button>
  );

  return <div style={{padding:"16px 12px 80px",maxWidth:680,margin:"0 auto"}}>
    {/* Header */}
    <div style={{marginBottom:16}}>
      <div style={{fontSize:18,fontWeight:700,color:T.t1,marginBottom:4}}>Data Admin</div>
      <div style={{fontSize:12,color:T.t3}}>Fix groupings, names, and contacts — changes save to GitHub automatically and survive any CSV upload</div>
    </div>

    {/* Toast */}
    {toast&&<div style={{background:toast.ok?"rgba(52,211,153,.12)":"rgba(248,113,113,.12)",border:`1px solid ${toast.ok?"rgba(52,211,153,.3)":"rgba(248,113,113,.3)"}`,borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:12,color:toast.ok?T.green:T.red}}>
      {toast.msg}
    </div>}

    {/* Section tabs */}
    <div style={{display:"flex",gap:4,marginBottom:16,background:T.s1,borderRadius:10,padding:4}}>
      {sectionBtn("groups","📁 Groups")}
      {sectionBtn("detach","✂️ Detach")}
      {sectionBtn("names","✏️ Names")}
      {sectionBtn("contacts","📇 Contacts")}
      {sectionBtn("dupes","🔗 Dupes")}
      {sectionBtn("orphans","🏥 Orphans")}
      {sectionBtn("data","💾 Data")}
      {sectionBtn("history","📜 History")}
      {sectionBtn("settings","⚙️ Settings")}
    </div>

    {/* ── GROUPS SECTION ── */}
    {section==="groups"&&<div>
      {/* Existing custom groups */}
      {(Object.values(overlays?.groups||{})).length>0&&<div style={{marginBottom:16}}>
        <div style={{fontSize:11,fontWeight:700,color:T.t3,textTransform:"uppercase",letterSpacing:.5,marginBottom:8}}>Existing Custom Groups</div>
        {(Object.values(overlays?.groups||{})).map((g:any)=>(
          <div key={g.id} style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:10,padding:12,marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
              <div style={{fontSize:13,fontWeight:700,color:T.t1}}>{g.name}</div>
              <div style={{display:"flex",gap:6}}>
                <button onClick={()=>{setEditingGroup(g);setNewGroupName(g.name);setNewGroupClass(g.class2||"Emerging DSO");setChildIds(g.childIds||[]);}} style={{fontSize:10,color:T.blue,background:"none",border:`1px solid ${T.blue}`,borderRadius:6,padding:"3px 8px",cursor:"pointer",fontFamily:"inherit"}}>Edit</button>
                <button onClick={()=>{
                  if(saveOverlays){
                    const next={...OVERLAYS_REF,groups:{...(OVERLAYS_REF.groups||{})}};
                    delete next.groups[g.id];
                    saveOverlays(next).then(ok=>{ if(ok) showToast("✅ Deleted"); else showToast("❌ Delete failed",false); });
                  }
                }} disabled={saving} style={{fontSize:10,color:T.red,background:"none",border:`1px solid ${T.red}`,borderRadius:6,padding:"3px 8px",cursor:"pointer",fontFamily:"inherit"}}>Delete</button>
              </div>
            </div>
            <div style={{fontSize:10,color:T.t4}}>{g.class2} · {(g.childIds||[]).length} locations</div>
            {g.note&&<div style={{fontSize:10,color:T.t3,marginTop:4,fontStyle:"italic"}}>{g.note}</div>}
          </div>
        ))}
      </div>}

      {/* Merge hint */}
      {!editingGroup&&<div style={{background:"rgba(79,142,247,.06)",border:"1px solid rgba(79,142,247,.15)",borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:11,color:T.t3}}>
        <span style={{fontWeight:700,color:T.blue}}>Moving an account into a group?</span> Open the account card and tap <strong>Move →</strong> — you'll see FROM and TO before confirming.
      </div>}

      {/* Create / Edit group form */}
      <div style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:12,padding:14}}>
        <div style={{fontSize:12,fontWeight:700,color:T.t2,marginBottom:12}}>{editingGroup?"✏️ Edit Group":"➕ Create New Group"}</div>

        {/* Group Type selector — only shown when not editing */}
        {!editingGroup&&<div style={{marginBottom:12}}>
          <div style={{fontSize:10,color:T.t3,marginBottom:6}}>Group Type</div>
          <div style={{display:"flex",gap:6}}>
            {([["multi","Multi Practice","Multiple physical locations under one owner"],["private","Private Group","Same address, multiple dealers"]] as [string,string,string][]).map(([k,label,tip])=>(
              <button key={k} onClick={()=>{
                setGroupType(k as any);
                setChildIds([]); setNewGroupName("");
                setNewGroupClass(k==="private"?"Private Practice":"Emerging DSO");
              }} title={tip} style={{flex:1,padding:"7px 4px",borderRadius:8,border:`1px solid ${groupType===k?"rgba(79,142,247,.4)":T.b1}`,background:groupType===k?"rgba(79,142,247,.12)":"transparent",color:groupType===k?T.blue:T.t3,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit",textAlign:"center"}}>
                {label}
              </button>
            ))}
          </div>
        </div>}

        {/* Group Name */}
        {<div style={{marginBottom:10}}>
          <div style={{fontSize:10,color:T.t3,marginBottom:4}}>Group Name</div>
          <input value={newGroupName} onChange={e=>setNewGroupName(e.target.value)} placeholder="e.g. Resolute Dental Partners"
            style={{width:"100%",padding:"9px 12px",borderRadius:8,border:`1px solid ${T.b1}`,background:T.bg,color:T.t1,fontSize:12,fontFamily:"inherit",boxSizing:"border-box"}}/>
        </div>}

        {/* Class dropdown — hidden for Private Group (auto-set) */}
        {groupType!=="private"&&<div style={{marginBottom:10}}>
          <div style={{fontSize:10,color:T.t3,marginBottom:4}}>Classification</div>
          <select value={newGroupClass} onChange={e=>setNewGroupClass(e.target.value)}
            style={{width:"100%",padding:"9px 12px",borderRadius:8,border:`1px solid ${T.b1}`,background:T.bg,color:T.t1,fontSize:12,fontFamily:"inherit"}}>
            <option>Emerging DSO</option>
            <option>DSO</option>
            <option>Academic</option>
          </select>
        </div>}

        {/* Add Locations search */}
        {<div style={{marginBottom:10}}>
          <div style={{fontSize:10,color:T.t3,marginBottom:4}}>Add Locations — search by name, city, or address</div>
          <div style={{position:"relative",marginBottom:6}}>
            <input value={childIdInput} onChange={e=>setChildIdInput(e.target.value)}
              placeholder="Search: office name, city, doctor..."
              style={{width:"100%",padding:"10px 32px 10px 12px",borderRadius:10,border:`1px solid ${childIdInput.length>=2?T.blue:T.b1}`,background:T.bg,color:T.t1,fontSize:13,fontFamily:"inherit",boxSizing:"border-box",outline:"none"}}/>
            {childIdInput.length>=1&&<button onClick={()=>setChildIdInput("")} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:T.t4,cursor:"pointer",fontSize:14,padding:0}}>✕</button>}
          </div>
          {childIdInput.length>=2&&(()=>{
            const results = searchAccounts(childIdInput).filter(a=>!childIds.includes(a.id));
            if(results.length===0) return <div style={{fontSize:11,color:T.t4,padding:"8px 0",textAlign:"center"}}>No matches for "{childIdInput}"</div>;
            return <div style={{border:`1px solid ${T.b2}`,borderRadius:10,background:T.s1,overflow:"hidden",marginBottom:8,maxHeight:280,overflowY:"auto"}}>
              {results.map((a,i)=>{
                const py=a.pyQ?.["1"]||0, cy=a.cyQ?.["1"]||0;
                return <button key={a.id} onClick={()=>{setChildIds([...childIds,a.id]);setChildIdInput("");}}
                  style={{display:"flex",width:"100%",textAlign:"left",padding:"10px 12px",background:i%2===0?"transparent":"rgba(255,255,255,.02)",border:"none",borderBottom:i<results.length-1?`1px solid ${T.b1}`:"none",cursor:"pointer",fontFamily:"inherit",alignItems:"center",gap:10}}>
                  <div style={{flex:1,minWidth:0}}>
                    <AccountId name={a.name} gName={a.gName} size="md"/>
                    <div style={{fontSize:10,color:T.t3}}>{[a.addr,[a.city,a.st,a.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</div>
                    <div style={{fontSize:9,color:T.t4,marginTop:1}}>{a.dealer||"All Other"} · PY {$$(py)} / CY {$$(cy)}</div>
                  </div>
                  <div style={{flexShrink:0,background:"rgba(79,142,247,.1)",border:"1px solid rgba(79,142,247,.2)",borderRadius:8,padding:"4px 10px",fontSize:10,fontWeight:700,color:T.blue}}>+ Add</div>
                </button>;
              })}
            </div>;
          })()}
          {childIds.length>0&&<div style={{marginTop:4}}>
            <div style={{fontSize:9,textTransform:"uppercase",color:T.t4,letterSpacing:"1px",marginBottom:6,fontWeight:700}}>Selected ({childIds.length}){(()=>{const t=childIds.reduce((s,id)=>{const a=scored.find(x=>x.id===id);return s+(a?.pyQ?.["1"]||0);},0);return t>0?<span style={{color:T.amber,textTransform:"none",letterSpacing:0}}> · Combined PY {$$(t)}</span>:"";})()}</div>
            {childIds.map(id=>{
              const acct = scored.find(a=>a.id===id);
              const py=acct?.pyQ?.["1"]||0, cy=acct?.cyQ?.["1"]||0;
              return <div key={id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",background:T.s2,borderRadius:8,marginBottom:4,border:`1px solid ${T.b1}`}}>
                <div style={{flex:1,minWidth:0}}>
                  <AccountId name={acct?acct.name:id} gName={acct?.gName} size="sm"/>
                  <div style={{fontSize:9,color:T.t3}}>{acct?`${acct.city||""} · ${acct.dealer||"All Other"} · PY ${$$(py)}`:id}</div>
                </div>
                <button onClick={()=>setChildIds(childIds.filter(x=>x!==id))} style={{background:"rgba(248,113,113,.1)",border:"1px solid rgba(248,113,113,.2)",borderRadius:6,color:T.red,cursor:"pointer",fontSize:10,fontWeight:600,padding:"3px 8px",fontFamily:"inherit",flexShrink:0}}>Remove</button>
              </div>;
            })}
          </div>}
        </div>}

        <button onClick={()=>{
          if(!newGroupName.trim()||childIds.length===0){showToast("❌ Need a name and at least one account",false);return;}
          const id = editingGroup?.id || `Master-CUSTOM-${Date.now()}`;
          const cls = groupType==="private"?"Private Practice":newGroupClass;
          if (saveOverlays) {
            const grp = {id,name:newGroupName.trim(),class2:cls,childIds,tier:"Standard",groupType,createdAt:editingGroup?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
            const next = { ...OVERLAYS_REF, groups: { ...(OVERLAYS_REF.groups||{}), [id]: grp } };
            saveOverlays(next).then(ok => {
              if(ok){ showToast("✅ Group saved"); setGroupType("multi"); }
              else showToast("❌ Save failed",false);
            });
          }
        }} disabled={saving||!newGroupName.trim()||childIds.length===0}
          style={{width:"100%",padding:"11px 0",borderRadius:10,border:"none",background:(!newGroupName.trim()||childIds.length===0)?T.s2:T.blue,color:"#fff",fontSize:13,fontWeight:700,cursor:(!newGroupName.trim()||childIds.length===0)?"not-allowed":"pointer",fontFamily:"inherit"}}>
          {saving?"Saving...":editingGroup?"Update Group":"Create Group"}
        </button>
        {editingGroup&&<button onClick={()=>{setEditingGroup(null);setNewGroupName("");setChildIds([]);setGroupType("multi");}} style={{width:"100%",marginTop:6,padding:"9px 0",borderRadius:10,border:`1px solid ${T.b1}`,background:"transparent",color:T.t3,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Cancel Edit</button>}
      </div>
    </div>}

    {/* ── DETACH SECTION ── */}
    {section==="detach"&&<div>
      {(overlays?.groupDetaches||[]).length>0&&<div style={{marginBottom:16}}>
        <div style={{fontSize:11,fontWeight:700,color:T.t3,textTransform:"uppercase",letterSpacing:.5,marginBottom:8}}>Current Detachments</div>
        {(overlays?.groupDetaches||[]).map((d:any)=>(
          <div key={d.childId} style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:10,padding:12,marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:12,fontWeight:700,color:T.t1}}>{d.newGroupName}</div>
              <div style={{fontSize:10,color:T.t4}}>Detached from {d.fromGroupId} · {d.reason}</div>
            </div>
            <button onClick={()=>adminSave({...OVERLAYS_REF,groupDetaches:(OVERLAYS_REF.groupDetaches||[]).filter((x:any)=>x.childId!==d.childId)},"Detach removed")} disabled={saving} style={{fontSize:10,color:T.red,background:"none",border:`1px solid ${T.red}`,borderRadius:6,padding:"3px 8px",cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>Remove</button>
          </div>
        ))}
      </div>}

      <div style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:12,padding:14}}>
        <div style={{fontSize:12,fontWeight:700,color:T.t2,marginBottom:4}}>✂️ Detach Account from Wrong Group</div>
        <div style={{fontSize:11,color:T.t4,marginBottom:12}}>Use when Kerr's MDM incorrectly parents an account under the wrong group</div>

        <div style={{marginBottom:10}}>
          <div style={{fontSize:10,color:T.t3,marginBottom:4}}>Search Account to Detach</div>
          <input value={detachSearch} onChange={e=>{setDetachSearch(e.target.value);setDetachAccount(null);}}
            placeholder="Type account name..."
            style={{width:"100%",padding:"9px 12px",borderRadius:8,border:`1px solid ${T.b1}`,background:T.bg,color:T.t1,fontSize:12,fontFamily:"inherit",boxSizing:"border-box"}}/>
          {detachSearch.length>=2&&!detachAccount&&searchAccounts(detachSearch).map(a=>(
            <button key={a.id} onClick={()=>{setDetachAccount(a);setDetachSearch(a.name);setDetachNewName(a.name);}}
              style={{display:"block",width:"100%",textAlign:"left",padding:"7px 10px",borderRadius:6,border:`1px solid ${T.b1}`,background:T.s2,color:T.t2,fontSize:11,cursor:"pointer",fontFamily:"inherit",marginTop:3}}>
              {a.name} · {a.city} · <span style={{color:T.t4}}>{a.gName||"no group"}</span>
            </button>
          ))}
        </div>

        {detachAccount&&<div>
          <div style={{background:T.s2,borderRadius:8,padding:10,marginBottom:10}}>
            <div style={{fontSize:11,fontWeight:700,color:T.amber}}>Detaching: {detachAccount.name}</div>
            <div style={{fontSize:10,color:T.t4}}>From group: {detachAccount.gName||"unknown"} ({detachAccount.gId})</div>
          </div>
          <div style={{marginBottom:10}}>
            <div style={{fontSize:10,color:T.t3,marginBottom:4}}>Standalone Group Name</div>
            <input value={detachNewName} onChange={e=>setDetachNewName(e.target.value)}
              style={{width:"100%",padding:"9px 12px",borderRadius:8,border:`1px solid ${T.b1}`,background:T.bg,color:T.t1,fontSize:12,fontFamily:"inherit",boxSizing:"border-box"}}/>
          </div>
          <button onClick={()=>{
            const det={childId:detachAccount.id,fromGroupId:detachAccount.gId,newGroupId:`${detachAccount.id}-standalone`,newGroupName:detachNewName.trim()||detachAccount.name,reason:"Manual correction via Admin tab"};
            adminSave({...OVERLAYS_REF,groupDetaches:[...(OVERLAYS_REF.groupDetaches||[]).filter((x:any)=>x.childId!==det.childId),det]},"Account detached");
          }} disabled={saving||!detachNewName.trim()}
            style={{width:"100%",padding:"11px 0",borderRadius:10,border:"none",background:T.amber,color:"#000",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
            {saving?"Saving...":"Detach Account"}
          </button>
        </div>}
      </div>
    </div>}

    {/* ── NAME OVERRIDES SECTION ── */}
    {section==="names"&&<div>
      {(Object.entries(overlays?.nameOverrides||{}).map(([id,name]:any)=>({id,name}))).length>0&&<div style={{marginBottom:16}}>
        <div style={{fontSize:11,fontWeight:700,color:T.t3,textTransform:"uppercase",letterSpacing:.5,marginBottom:8}}>Current Name Overrides</div>
        {(Object.entries(overlays?.nameOverrides||{}).map(([id,name]:any)=>({id,name}))).map((n:any)=>(
          <div key={n.id} style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:10,padding:12,marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:12,fontWeight:700,color:T.t1}}>{n.name}</div>
              <div style={{fontSize:10,color:T.t4}}>{n.id} · {n.reason}</div>
            </div>
            <button onClick={()=>{const nm={...((OVERLAYS_REF.nameOverrides)||{})};delete nm[n.id];adminSave({...OVERLAYS_REF,nameOverrides:nm},"Name override removed");}} disabled={saving} style={{fontSize:10,color:T.red,background:"none",border:`1px solid ${T.red}`,borderRadius:6,padding:"3px 8px",cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>Remove</button>
          </div>
        ))}
      </div>}

      <div style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:12,padding:14}}>
        <div style={{fontSize:12,fontWeight:700,color:T.t2,marginBottom:4}}>✏️ Fix Account Name</div>
        <div style={{fontSize:11,color:T.t4,marginBottom:12}}>Override a bad MDM name with the correct practice name</div>

        <div style={{marginBottom:10}}>
          <input value={nameSearch} onChange={e=>{setNameSearch(e.target.value);setNameAccount(null);}}
            placeholder="Search account to rename..."
            style={{width:"100%",padding:"9px 12px",borderRadius:8,border:`1px solid ${T.b1}`,background:T.bg,color:T.t1,fontSize:12,fontFamily:"inherit",boxSizing:"border-box"}}/>
          {nameSearch.length>=2&&!nameAccount&&searchAccounts(nameSearch).map(a=>(
            <button key={a.id} onClick={()=>{setNameAccount(a);setNameSearch(a.name);setNameNewValue(a.name);}}
              style={{display:"block",width:"100%",textAlign:"left",padding:"7px 10px",borderRadius:6,border:`1px solid ${T.b1}`,background:T.s2,color:T.t2,fontSize:11,cursor:"pointer",fontFamily:"inherit",marginTop:3}}>
              {a.name} · {a.city} · {a.id}
            </button>
          ))}
        </div>

        {nameAccount&&<div>
          <div style={{marginBottom:10}}>
            <div style={{fontSize:10,color:T.t3,marginBottom:4}}>New Name</div>
            <input value={nameNewValue} onChange={e=>setNameNewValue(e.target.value)}
              style={{width:"100%",padding:"9px 12px",borderRadius:8,border:`1px solid ${T.b1}`,background:T.bg,color:T.t1,fontSize:12,fontFamily:"inherit",boxSizing:"border-box"}}/>
          </div>
          <button onClick={()=>adminSave({...OVERLAYS_REF,nameOverrides:{...(OVERLAYS_REF.nameOverrides||{}),[nameAccount.id]:nameNewValue.trim()}},"Name saved")} disabled={saving||!nameNewValue.trim()}
            style={{width:"100%",padding:"11px 0",borderRadius:10,border:"none",background:T.blue,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
            {saving?"Saving...":"Save Name Override"}
          </button>
        </div>}
      </div>
    </div>}

    {/* ── CONTACTS SECTION ── */}
    {section==="contacts"&&<div>
      {(Object.entries(overlays?.contacts||{}).map(([id,c]:any)=>({id,...c}))).length>0&&<div style={{marginBottom:16}}>
        <div style={{fontSize:11,fontWeight:700,color:T.t3,textTransform:"uppercase",letterSpacing:.5,marginBottom:8}}>Saved Contacts</div>
        {(Object.entries(overlays?.contacts||{}).map(([id,c]:any)=>({id,...c}))).map((c:any)=>(
          <div key={c.id} style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:10,padding:12,marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <div style={{fontSize:12,fontWeight:700,color:T.t1}}>{c.contactName}</div>
              <div style={{fontSize:10,color:T.cyan}}>{c.email}</div>
              <div style={{fontSize:10,color:T.t4}}>{c.id}</div>
            </div>
            <button onClick={()=>{const ct={...(OVERLAYS_REF.contacts||{})};delete ct[c.id];adminSave({...OVERLAYS_REF,contacts:ct},"Contact removed");}} disabled={saving} style={{fontSize:10,color:T.red,background:"none",border:`1px solid ${T.red}`,borderRadius:6,padding:"3px 8px",cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>Remove</button>
          </div>
        ))}
      </div>}

      <div style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:12,padding:14}}>
        <div style={{fontSize:12,fontWeight:700,color:T.t2,marginBottom:4}}>📇 Add Contact Info</div>
        <div style={{fontSize:11,color:T.t4,marginBottom:12}}>Save a PM, office manager, or doctor email to an account</div>

        <div style={{marginBottom:10}}>
          <input value={contactSearch} onChange={e=>{setContactSearch(e.target.value);setContactAccount(null);}}
            placeholder="Search account..."
            style={{width:"100%",padding:"9px 12px",borderRadius:8,border:`1px solid ${T.b1}`,background:T.bg,color:T.t1,fontSize:12,fontFamily:"inherit",boxSizing:"border-box"}}/>
          {contactSearch.length>=2&&!contactAccount&&searchAccounts(contactSearch).map(a=>(
            <button key={a.id} onClick={()=>{setContactAccount(a);setContactSearch(a.name);}}
              style={{display:"block",width:"100%",textAlign:"left",padding:"7px 10px",borderRadius:6,border:`1px solid ${T.b1}`,background:T.s2,color:T.t2,fontSize:11,cursor:"pointer",fontFamily:"inherit",marginTop:3}}>
              {a.name} · {a.city} · {a.id}
            </button>
          ))}
        </div>

        {contactAccount&&<div>
          <div style={{background:T.s2,borderRadius:8,padding:8,marginBottom:10}}>
            <div style={{fontSize:11,fontWeight:700,color:T.blue}}>{contactAccount.name} · {contactAccount.city}</div>
          </div>
          {[
            {label:"Contact Name", val:contactName, set:setContactName, placeholder:"Dr. Smith or Brittany Burroughs"},
            {label:"Email", val:contactEmail, set:setContactEmail, placeholder:"email@practice.com"},
            {label:"Phone", val:contactPhone, set:setContactPhone, placeholder:"860-555-1234"},
            {label:"Note", val:contactNote, set:setContactNote, placeholder:"PM, office manager, etc."},
          ].map(f=>(
            <div key={f.label} style={{marginBottom:8}}>
              <div style={{fontSize:10,color:T.t3,marginBottom:3}}>{f.label}</div>
              <input value={f.val} onChange={e=>f.set(e.target.value)} placeholder={f.placeholder}
                style={{width:"100%",padding:"8px 10px",borderRadius:8,border:`1px solid ${T.b1}`,background:T.bg,color:T.t1,fontSize:11,fontFamily:"inherit",boxSizing:"border-box"}}/>
            </div>
          ))}
          <button onClick={()=>saveOverlays&&saveOverlays({...OVERLAYS_REF,contacts:{...(OVERLAYS_REF.contacts||{}),[contactAccount.id]:{contactName:contactName.trim()||undefined,email:contactEmail.trim()||undefined,phone:contactPhone.trim()||undefined,note:contactNote.trim()||undefined,savedAt:new Date().toISOString()}}}).then(ok=>{if(ok)showToast("✅ Contact saved");else showToast("❌ Save failed",false);})} disabled={saving||(!contactName.trim()&&!contactEmail.trim())}
            style={{width:"100%",padding:"11px 0",borderRadius:10,border:"none",background:T.blue,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
            {saving?"Saving...":"Save Contact"}
          </button>
        </div>}
      </div>
    </div>}

    {/* ── DUPLICATES REVIEW SECTION ── */}
    {section==="dupes"&&<div>
      <div style={{fontSize:14,fontWeight:700,color:T.t1,marginBottom:4}}>Merge Queue</div>
      <div style={{fontSize:11,color:T.t3,marginBottom:12}}>AI-scored duplicate accounts at the same address. Approve to merge, skip to dismiss.</div>

      {/* Sub-nav */}
      <div style={{display:"flex",gap:3,marginBottom:14,background:T.s1,borderRadius:10,padding:3}}>
        {([["auto",`Auto (${(CPID_MERGES as any[]).filter(p=>!Object.keys(OVERLAYS_REF.groups||{}).includes(p.id)&&!skippedMergeIds[p.id]).length})`],["review",`Review (${(CPID_REVIEW as any[]).filter((p:any)=>!Object.keys(OVERLAYS_REF.groups||{}).includes(p.groupA.id)&&!skippedMergeIds[p.groupA.id]).length})`],["live","Live Scan"]] as [string,string][]).map(([k,label])=>(
          <button key={k} onClick={()=>{setDupesView(k as any);setReviewPage(0);}} style={{flex:1,padding:"6px 4px",borderRadius:8,border:"none",background:dupesView===k?"rgba(79,142,247,.2)":"transparent",color:dupesView===k?T.blue:T.t3,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{label}</button>
        ))}
      </div>

      {/* ── AUTO-MERGE QUEUE ── */}
      {dupesView==="auto"&&(()=>{
        const applied = Object.keys(OVERLAYS_REF.groups||{});
        const pending = (CPID_MERGES as any[]).filter(p=>!applied.includes(p.id)&&!skippedMergeIds[p.id]);
        const skipPair = (id:string) => {
          setSkippedMergeIds(prev=>{
            const next={...prev,[id]:true};
            // A15.6: persist skips to overlays (GitHub) so they survive device changes
            const newSkipIds = Object.keys(next).filter(k=>next[k]);
            saveOverlays({...OVERLAYS_REF, skippedCpidIds: newSkipIds});
            try{localStorage.setItem("cpid_skipped",JSON.stringify(next));}catch{}
            return next;
          });
        };
        const approvePair = (p:any) => {
          const grp={id:p.id,name:p.name,class2:p.class2||"Private Practice",childIds:p.childIds,tier:"Standard",source:"auto-merge",score:p.score,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
          const next={...OVERLAYS_REF,groups:{...(OVERLAYS_REF.groups||{}),[p.id]:grp}};
          saveOverlays(next).then((ok:boolean)=>{if(ok)showToast(`✅ Merged: ${p.name}`);else showToast("❌ Save failed",false);});
        };
        // A19: "Apply All" bulk-write removed — group creation requires per-item approval.
        // Each merge must be individually approved using the Approve button on each card.
        const doneCount=(CPID_MERGES as any[]).length-pending.length;
        return <div>
          {doneCount>0&&<div style={{fontSize:10,color:T.green,marginBottom:8}}>✓ {doneCount} already applied</div>}
          {/* Apply All removed (A19) — use per-card Approve button below */}
          {pending.length===0&&<div style={{fontSize:12,color:T.t4,textAlign:"center",padding:"20px 0"}}>All auto-merges have been applied or skipped.</div>}
          {pending.map((p:any,i:number)=>(
            <div key={p.id} className="anim" style={{animationDelay:`${i*20}ms`,background:T.s1,border:`1px solid ${T.b1}`,borderRadius:12,padding:12,marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:700,color:T.t1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>
                  <div style={{fontSize:10,color:T.cyan}}>{p.addr}</div>
                </div>
                <span style={{flexShrink:0,marginLeft:8,fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:6,background:p.score>=95?"rgba(52,211,153,.12)":"rgba(251,191,36,.1)",color:p.score>=95?T.green:T.amber,border:`1px solid ${p.score>=95?"rgba(52,211,153,.3)":"rgba(251,191,36,.25)"}`}}>
                  {p.score}%
                </span>
              </div>
              <div style={{display:"flex",gap:4,marginBottom:8}}>
                <div style={{flex:1,padding:"6px 8px",background:T.s2,borderRadius:7}}>
                  <div style={{fontSize:9,color:T.t4,marginBottom:2}}>Group A</div>
                  <div style={{fontSize:10,fontWeight:600,color:T.t2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.groupAName}</div>
                </div>
                <div style={{flex:1,padding:"6px 8px",background:T.s2,borderRadius:7}}>
                  <div style={{fontSize:9,color:T.t4,marginBottom:2}}>Group B</div>
                  <div style={{fontSize:10,fontWeight:600,color:T.t2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.groupBName}</div>
                </div>
              </div>
              <div style={{display:"flex",gap:6}}>
                <button onClick={()=>approvePair(p)} disabled={saving} style={{flex:1,padding:"7px 0",borderRadius:8,border:"none",background:T.blue,color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Approve</button>
                <button onClick={()=>skipPair(p.id)} style={{padding:"7px 14px",borderRadius:8,border:`1px solid ${T.b1}`,background:"transparent",color:T.t3,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>Skip</button>
              </div>
            </div>
          ))}
        </div>;
      })()}

      {/* ── REVIEW QUEUE ── */}
      {dupesView==="review"&&(()=>{
        const applied = Object.keys(OVERLAYS_REF.groups||{});
        const pending = (CPID_REVIEW as any[]).filter((p:any)=>!applied.includes(p.groupA.id)&&!skippedMergeIds[p.groupA.id]);
        const pageSize=20;
        const page = pending.slice(reviewPage*pageSize,(reviewPage+1)*pageSize);
        const approveReview = (p:any) => {
          const betterName=(p.groupA.pyQ1>=p.groupB.pyQ1?p.groupA.name:p.groupB.name).replace(/:\s*Master-CM\d+$/i,'').trim();
          const grp={id:p.groupA.id,name:betterName,class2:"Private Practice",childIds:[p.groupA.childId,p.groupB.childId],tier:"Standard",source:"review-merge",score:p.score,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
          const next={...OVERLAYS_REF,groups:{...(OVERLAYS_REF.groups||{}),[p.groupA.id]:grp}};
          saveOverlays(next).then((ok:boolean)=>{if(ok)showToast(`✅ Merged: ${betterName}`);else showToast("❌ Save failed",false);});
        };
        const skipReview = (id:string) => {
          setSkippedMergeIds(prev=>{
            const next={...prev,[id]:true};
            // A15.6: persist skips to overlays (GitHub) so they survive device changes
            const newSkipIds = Object.keys(next).filter(k=>next[k]);
            saveOverlays({...OVERLAYS_REF, skippedCpidIds: newSkipIds});
            try{localStorage.setItem("cpid_skipped",JSON.stringify(next));}catch{}
            return next;
          });
        };
        return <div>
          <button disabled style={{width:"100%",padding:"9px 0",borderRadius:10,border:"1px solid rgba(120,120,160,.2)",background:"transparent",color:T.t4,fontSize:11,fontWeight:600,fontFamily:"inherit",marginBottom:12,cursor:"not-allowed"}}>
            🤖 Research All Unknowns — Phase 2
          </button>
          <div style={{fontSize:10,color:T.t4,marginBottom:10}}>{pending.length} pairs pending · score 60–80 · review each individually</div>
          {page.map((p:any,i:number)=>{
            const cleanA=p.groupA.name.replace(/:\s*Master-CM\d+$/i,'').trim();
            const cleanB=p.groupB.name.replace(/:\s*Master-CM\d+$/i,'').trim();
            return <div key={p.groupA.id+p.groupB.id} className="anim" style={{animationDelay:`${i*15}ms`,background:T.s1,border:`1px solid ${T.b1}`,borderRadius:12,padding:12,marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                <div style={{fontSize:10,color:T.cyan,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.groupA.addr}, {p.groupA.city} {p.groupA.st}</div>
                <span style={{flexShrink:0,marginLeft:8,fontSize:9,fontWeight:700,padding:"2px 6px",borderRadius:5,background:"rgba(251,191,36,.1)",color:T.amber}}>{p.score}</span>
              </div>
              <div style={{display:"flex",gap:4,marginBottom:8}}>
                <div style={{flex:1,padding:"5px 8px",background:T.s2,borderRadius:6}}>
                  <div style={{fontSize:10,fontWeight:600,color:T.t1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cleanA}</div>
                  <div style={{fontSize:9,color:T.t4}}>PY {$$(p.groupA.pyQ1)}</div>
                </div>
                <div style={{flex:1,padding:"5px 8px",background:T.s2,borderRadius:6}}>
                  <div style={{fontSize:10,fontWeight:600,color:T.t1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cleanB}</div>
                  <div style={{fontSize:9,color:T.t4}}>PY {$$(p.groupB.pyQ1)}</div>
                </div>
              </div>
              <div style={{display:"flex",gap:6}}>
                <button onClick={()=>approveReview(p)} disabled={saving} style={{flex:1,padding:"7px 0",borderRadius:8,border:"none",background:T.blue,color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Approve</button>
                <button onClick={()=>skipReview(p.groupA.id)} style={{padding:"7px 14px",borderRadius:8,border:`1px solid ${T.b1}`,background:"transparent",color:T.t3,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>Skip</button>
              </div>
            </div>;
          })}
          {(reviewPage+1)*pageSize<pending.length&&<button onClick={()=>setReviewPage(p=>p+1)} style={{width:"100%",padding:"9px 0",borderRadius:10,border:`1px solid ${T.b1}`,background:"transparent",color:T.t3,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",marginTop:4}}>
            Load More ({pending.length-(reviewPage+1)*pageSize} remaining)
          </button>}
        </div>;
      })()}

      {/* ── LIVE SCAN ── */}
      {dupesView==="live"&&(()=>{
        const normAddr = (a:string) => {
          if(!a) return '';
          let n = a.toLowerCase().trim();
          n = n.replace(/\b\d{5}(-\d{4})?\b/g,'');
          n = n.replace(/,?\s*(ct|ma|ri|ny|nj|pa)\s*$/,'');
          n = n.replace(/street/g,'st').replace(/avenue/g,'ave').replace(/road/g,'rd');
          n = n.replace(/drive/g,'dr').replace(/boulevard/g,'blvd').replace(/turnpike/g,'tpke');
          return n.replace(/[,\s]+$/,'').replace(/\s+/g,' ').trim();
        };
        const B = typeof BADGER!=='undefined'?BADGER:{};
        const addrMap: Record<string,any[]> = {};
        scored.forEach((a:any)=>{
          const addr = B[a.id]?.address || '';
          const na = normAddr(addr);
          if(na && na.length > 5) {
            if(!addrMap[na]) addrMap[na] = [];
            addrMap[na].push({...a, addr});
          }
        });
        const dismissed: Record<string,boolean> = (() => { try { return JSON.parse(localStorage.getItem("dupe_dismissed")||"{}"); } catch { return {}; } })();
        const merged: Record<string,boolean> = {};
        Object.values(overlays?.groups||{}).forEach((g:any) => { (g.childIds||[]).forEach((cid:string) => { merged[cid] = true; }); });
        const candidates = Object.entries(addrMap)
          .filter(([addr, accts]) => {
            if(accts.length < 2) return false;
            const gids = new Set(accts.map((a:any) => a.gId));
            if(gids.size <= 1) return false;
            if(accts.every((a:any) => merged[a.id])) return false;
            if(dismissed[addr]) return false;
            return true;
          })
          .map(([addr, accts]) => ({addr, accts: accts.sort((a:any,b:any)=>(b.pyQ?.["1"]||0)-(a.pyQ?.["1"]||0)), totalPY: accts.reduce((s:number,a:any)=>s+(a.pyQ?.["1"]||0),0), totalCY: accts.reduce((s:number,a:any)=>s+(a.cyQ?.["1"]||0),0)}))
          .filter(c => Math.abs(c.totalPY)+Math.abs(c.totalCY)>50)
          .sort((a,b)=>(b.totalPY+b.totalCY)-(a.totalPY+a.totalCY));
        if(candidates.length===0) return <div style={{fontSize:12,color:T.t4,textAlign:"center",padding:"30px 0"}}>No live duplicates found.</div>;
        return <div>
          <div style={{fontSize:10,color:T.t4,marginBottom:10}}>{candidates.length} address matches</div>
          {candidates.map((c:any,ci:number)=>(
            <div key={c.addr} className="anim" style={{animationDelay:`${ci*30}ms`,background:T.s1,border:`1px solid ${T.b1}`,borderRadius:14,padding:14,marginBottom:10}}>
              <div style={{fontSize:10,color:T.cyan,marginBottom:8,fontWeight:600}}>📍 {c.addr}</div>
              {c.accts.map((a:any)=>{
                const py=a.pyQ?.["1"]||0,cy=a.cyQ?.["1"]||0;
                return <div key={a.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",background:T.s2,borderRadius:8,marginBottom:4}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:11,fontWeight:600,color:T.t1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.name}</div>
                    <div style={{fontSize:9,color:T.t3}}>{a.dealer||"All Other"} · PY {$$(py)} / CY {$$(cy)}</div>
                  </div>
                </div>;
              })}
              <div style={{display:"flex",gap:6,marginTop:8}}>
                <button onClick={()=>{
                  const primary=c.accts.reduce((best:any,a:any)=>((a.pyQ?.["1"]||0)+(a.cyQ?.["1"]||0))>((best.pyQ?.["1"]||0)+(best.cyQ?.["1"]||0))?a:best,c.accts[0]);
                  const id=`Master-MERGE-${primary.id.split("-").pop()}`;
                  if(saveOverlays){
                    const grp={id,name:primary.name,class2:"Private Practice",tier:"Standard",childIds:c.accts.map((a:any)=>a.id),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
                    const next={...OVERLAYS_REF,groups:{...(OVERLAYS_REF.groups||{}),[id]:grp}};
                    saveOverlays(next).then((ok:boolean)=>{if(ok)showToast(`✅ Merged ${c.accts.length} as "${primary.name}"`);else showToast("❌ Merge failed",false);});
                  }
                }} style={{flex:1,padding:"8px 0",borderRadius:8,border:"none",background:T.blue,color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Merge ({c.accts.length})</button>
                <button onClick={()=>{const u={...dismissed,[c.addr]:true};try{localStorage.setItem("dupe_dismissed",JSON.stringify(u));}catch{} showToast("Skipped");}} style={{padding:"8px 14px",borderRadius:8,border:`1px solid ${T.b1}`,background:"transparent",color:T.t3,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>Skip</button>
              </div>
            </div>
          ))}
        </div>;
      })()}
    </div>}

    {/* ── ORPHAN SUGGESTIONS SECTION ── */}
    {section==="orphans"&&(()=>{
      const DENTAL_KW = ["dental","dds","dmd","orthodont","endodont","oral","periodon","prostho","smile","teeth","tooth","implant"];
      const isDental = (name:string) => { const nl=(name||"").toLowerCase(); return DENTAL_KW.some(k=>nl.includes(k)); };
      const orphanKey = (s:any) => `${s.anchor_id}__${s.orphan_child_id}`;
      const applied = Object.keys(overlays?.groups||{});

      const filtered = ANCHOR_ORPHANS.filter(s => {
        if (s.anchor_id === "Master-Unmatched") return false;
        if (skippedOrphanKeys[orphanKey(s)]) return false;
        if (applied.includes(s.anchor_id) && (overlays?.groups?.[s.anchor_id]?.childIds||[]).includes(s.orphan_child_id)) return false;
        if (orphanDentalOnly && !isDental(s.anchor_name) && !isDental(s.orphan_child_name)) return false;
        return true;
      });

      const skipOrphan = (s:any) => {
        const key = orphanKey(s);
        setSkippedOrphanKeys(prev => {
          const next = {...prev,[key]:true};
          const newIds = Object.keys(next).filter(k=>next[k]);
          saveOverlays({...OVERLAYS_REF, skippedOrphanIds: newIds});
          return next;
        });
      };

      const approveOrphan = (s:any) => {
        // Add orphan_child_id into anchor's overlay group (create if not exists)
        const existing = (overlays?.groups||{})[s.anchor_id];
        const baseChildIds: string[] = existing?.childIds || [];
        if (baseChildIds.includes(s.orphan_child_id)) { showToast("Already in group"); return; }
        const grp = {
          id: s.anchor_id,
          name: s.anchor_name.replace(/:\s*Master-CM\d+$/i,"").trim(),
          class2: s.anchor_locs >= 3 ? "DSO" : "Emerging DSO",
          tier: "Standard",
          childIds: [...baseChildIds, s.orphan_child_id],
          source: "orphan-approve",
          createdAt: existing?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        const next = {...OVERLAYS_REF, groups:{...(OVERLAYS_REF.groups||{}),[s.anchor_id]:grp}};
        saveOverlays(next).then((ok:boolean) => {
          if (ok) showToast(`✅ Added to ${grp.name}`);
          else showToast("❌ Save failed", false);
        });
      };

      const doneCount = ANCHOR_ORPHANS.filter(s => s.anchor_id!=="Master-Unmatched" && (skippedOrphanKeys[orphanKey(s)] || (applied.includes(s.anchor_id) && (overlays?.groups?.[s.anchor_id]?.childIds||[]).includes(s.orphan_child_id)))).length;

      return <div>
        <div style={{fontSize:14,fontWeight:700,color:T.t1,marginBottom:4}}>Orphan Suggestions</div>
        <div style={{fontSize:11,color:T.t3,marginBottom:10}}>Accounts at anchor-group addresses that aren't linked yet. Approve to add to the group, skip to dismiss.</div>

        {/* Filter + stats bar */}
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
          <button onClick={()=>setOrphanDentalOnly(v=>!v)} style={{
            padding:"5px 12px",borderRadius:8,border:`1px solid ${orphanDentalOnly?"rgba(79,142,247,.4)":T.b1}`,
            background:orphanDentalOnly?"rgba(79,142,247,.12)":"transparent",
            color:orphanDentalOnly?T.blue:T.t3,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit"
          }}>🦷 Dental only</button>
          <span style={{fontSize:10,color:T.t4,marginLeft:"auto"}}>{filtered.length} pending · {doneCount} resolved</span>
        </div>

        {filtered.length===0&&<div style={{fontSize:12,color:T.t4,textAlign:"center",padding:"30px 0"}}>
          {doneCount>0?"All suggestions reviewed ✓":"No suggestions match current filter."}
        </div>}

        {filtered.map((s:any,i:number)=>{
          const anchorClean = s.anchor_name.replace(/:\s*Master-CM\d+$/i,"").trim();
          const inGroup = applied.includes(s.anchor_id);
          return <div key={orphanKey(s)} className="anim" style={{animationDelay:`${i*15}ms`,background:T.s1,border:`1px solid ${T.b1}`,borderRadius:12,padding:12,marginBottom:8}}>
            {/* Orphan → Anchor */}
            <div style={{marginBottom:6}}>
              <div style={{fontSize:11,fontWeight:700,color:T.t1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.orphan_child_name}</div>
              <div style={{fontSize:9,color:T.t4,marginTop:1}}>📍 {s.addr}{s.city?", "+s.city:""}</div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
              <span style={{fontSize:9,color:T.t4}}>→ add to</span>
              <span style={{fontSize:10,fontWeight:600,color:T.purple,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{anchorClean}</span>
              <span style={{flexShrink:0,fontSize:9,fontWeight:700,padding:"2px 6px",borderRadius:5,background:"rgba(167,139,250,.1)",color:T.purple,border:"1px solid rgba(167,139,250,.2)"}}>{s.anchor_locs} locs</span>
              {inGroup&&<span style={{flexShrink:0,fontSize:9,color:T.green}}>✓ active</span>}
            </div>
            <div style={{display:"flex",gap:6}}>
              <button onClick={()=>approveOrphan(s)} disabled={saving} style={{flex:1,padding:"7px 0",borderRadius:8,border:"none",background:T.blue,color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Approve</button>
              <button onClick={()=>skipOrphan(s)} style={{padding:"7px 14px",borderRadius:8,border:`1px solid ${T.b1}`,background:"transparent",color:T.t3,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>Skip</button>
            </div>
          </div>;
        })}
      </div>;
    })()}

    {section==="data"&&<div>
      <div style={{fontSize:14,fontWeight:700,color:T.t1,marginBottom:4}}>Import Manager</div>
      <div style={{fontSize:11,color:T.t3,marginBottom:16}}>Stats from your most recent CSV upload. Persists across refreshes.</div>
      {(()=>{
        // Load report from localStorage
        let report: any = null;
        try {
          const raw = localStorage.getItem("import_report_v1");
          if (raw) report = JSON.parse(raw);
        } catch {}

        if (!report) return (
          <div style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:12,padding:20,textAlign:"center"}}>
            <div style={{fontSize:24,marginBottom:8}}>📂</div>
            <div style={{fontSize:13,fontWeight:600,color:T.t2,marginBottom:4}}>No import on record</div>
            <div style={{fontSize:11,color:T.t4}}>Upload a CSV from the Data Import tab to see stats here.</div>
          </div>
        );

        const StatRow = ({label, value, dim=false, warn=false}: {label:string,value:string|number,dim?:boolean,warn?:boolean}) => (
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:`1px solid ${T.b1}`}}>
            <span style={{fontSize:11,color:dim?T.t4:T.t3}}>{label}</span>
            <span style={{fontSize:11,fontWeight:600,color:warn?T.amber:dim?T.t4:T.t2,fontFamily:"'JetBrains Mono',monospace"}}>{value}</span>
          </div>
        );

        const Section = ({title, icon, children}: {title:string,icon:string,children:any}) => (
          <div style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:12,padding:14,marginBottom:10}}>
            <div style={{fontSize:11,fontWeight:700,color:T.t3,textTransform:"uppercase",letterSpacing:.6,marginBottom:8}}>{icon} {title}</div>
            {children}
          </div>
        );

        const ts = new Date(report.timestamp);
        const dateStr = ts.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
        const timeStr = ts.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"});

        return <div>
          {/* ── FILE STATS ── */}
          <Section title="File Stats" icon="📄">
            {report.filename && <StatRow label="Filename"   value={report.filename} />}
            <StatRow label="Uploaded"       value={`${dateStr} at ${timeStr}`} />
            <StatRow label="Delimiter"      value={report.delimiterDetected} />
            <StatRow label="Encoding"       value={report.encodingDetected}
              warn={report.encodingDetected==="Windows-1252 (likely)"} />
          </Section>

          {/* ── CLEANUP STATS ── */}
          <Section title="Cleanup Stats" icon="🧹">
            <StatRow label="Total rows in file (excl. header)" value={report.totalRawRows.toLocaleString()} />
            <StatRow label="  → Blank rows skipped"            value={report.blankRowsSkipped.toLocaleString()} dim />
            <StatRow label="  → Grand Total rows skipped"      value={report.grandTotalRowsSkipped.toLocaleString()} dim />
            <StatRow label="  → Summary rows skipped"          value={report.summaryRowsSkipped.toLocaleString()} dim />
            <StatRow label="  → No Invoice Date — skipped"     value={report.noDateRowsSkipped.toLocaleString()}
              warn={report.noDateRowsSkipped > 0} />
            <StatRow label="Clean rows aggregated"             value={report.cleanRowsProcessed.toLocaleString()} />
          </Section>

          {/* ── ENTITY OUTPUT ── */}
          <Section title="Entity Output" icon="🏢">
            <StatRow label="Unique parent groups seen"         value={report.uniqueParents.toLocaleString()} />
            <StatRow label="Unique office locations seen"      value={report.uniqueOffices.toLocaleString()} />
            <StatRow label="  → Zero-revenue offices dropped"  value={report.zeroRevenueOfficesDropped.toLocaleString()} dim />
            <StatRow label="Offices in output"                 value={report.finalOffices.toLocaleString()} />
            <StatRow label="Groups in output"                  value={report.finalGroups.toLocaleString()} />
          </Section>

          {/* ── WARNINGS ── */}
          {report.warnings?.length > 0 && (
            <Section title="Warnings" icon="⚠️">
              {report.warnings.map((w: any) => (
                <div key={w.code} style={{marginBottom:8,paddingBottom:8,borderBottom:`1px solid ${T.b1}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                    <div style={{fontSize:11,color:T.amber,fontWeight:600,flex:1}}>{w.label}</div>
                    {w.count > 0 && <span style={{flexShrink:0,fontSize:10,fontWeight:700,color:T.amber,background:"rgba(251,191,36,.1)",border:"1px solid rgba(251,191,36,.25)",borderRadius:5,padding:"2px 6px"}}>{w.count}</span>}
                  </div>
                  {w.examples?.length > 0 && (
                    <div style={{marginTop:4,fontSize:10,color:T.t4,fontFamily:"'JetBrains Mono',monospace"}}>
                      e.g. {w.examples.join(", ")}
                    </div>
                  )}
                </div>
              ))}
            </Section>
          )}
          {(!report.warnings || report.warnings.length === 0) && (
            <div style={{textAlign:"center",padding:"8px 0",fontSize:11,color:T.green}}>✓ No warnings</div>
          )}

          {/* ── CACHE RESET ── */}
          <div style={{marginTop:12}}>
            {(()=>{
              let hasCsvCache = false;
              try { hasCsvCache = !!localStorage.getItem("accel_data_v2"); } catch {}
              return hasCsvCache
                ? <button onClick={()=>{
                    try { localStorage.removeItem("accel_data_v2"); localStorage.removeItem("import_report_v1"); } catch {}
                    showToast("✅ Cache cleared — reloading…");
                    setTimeout(()=>window.location.reload(), 800);
                  }} style={{padding:"10px 16px",borderRadius:8,border:"none",background:"rgba(248,113,113,.15)",color:T.red,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",width:"100%"}}>
                    Reset to preloaded data
                  </button>
                : <div style={{fontSize:11,color:T.green,textAlign:"center"}}>✓ Using preloaded data — upload a CSV to override</div>;
            })()}
          </div>
        </div>;
      })()}
    </div>}
    {/* ── SETTINGS SECTION ── */}
    {section==="settings"&&<div>
      <div style={{fontSize:14,fontWeight:700,color:T.t1,marginBottom:4}}>Quarter Targets</div>
      <div style={{fontSize:11,color:T.t3,marginBottom:16}}>Enter your credited wholesale target for each quarter when you receive it from Kerr. Saves locally on this device.</div>
      {(["1","2","3","4"] as string[]).map(q => {
        const label = ["Q1 (Jan–Mar)","Q2 (Apr–Jun)","Q3 (Jul–Sep)","Q4 (Oct–Dec)"][parseInt(q)-1];
        return <div key={q} style={{marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:600,color:T.t2,marginBottom:5}}>{label}</div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <span style={{fontSize:12,color:T.t3,flexShrink:0}}>$</span>
            <input
              type="number"
              placeholder="e.g. 789602"
              value={targetInputs[q]||""}
              onChange={e=>setTargetInputs(prev=>({...prev,[q]:e.target.value}))}
              style={{flex:1,background:T.s2,border:`1px solid ${T.b1}`,borderRadius:8,
                padding:"8px 10px",color:T.t1,fontSize:13,fontFamily:"inherit",outline:"none"}}
            />
            {targetInputs[q]&&Number(targetInputs[q])>0&&(
              <span style={{fontSize:10,color:T.t4,flexShrink:0}}>
                ${Math.round(Number(targetInputs[q])/1000)}K
              </span>
            )}
          </div>
        </div>;
      })}
      <button
        onClick={()=>{
          const parsed: Record<string,number> = {};
          ["1","2","3","4"].forEach(q => {
            const v = Number(targetInputs[q]);
            if (v > 0) parsed[q] = v;
          });
          try { localStorage.setItem("quarter_targets", JSON.stringify(parsed)); } catch {}
          setTargetSaved(true);
          setTimeout(()=>setTargetSaved(false), 2500);
        }}
        style={{width:"100%",padding:"10px 0",borderRadius:10,border:"none",
          background:targetSaved?"rgba(52,211,153,.2)":T.blue,
          color:targetSaved?T.green:"#fff",fontSize:12,fontWeight:700,
          cursor:"pointer",fontFamily:"inherit",transition:"all .2s"}}
      >{targetSaved?"✓ Saved — reload app to apply":"Save Targets"}</button>
      <div style={{fontSize:10,color:T.t4,marginTop:10,textAlign:"center"}}>
        Changes take effect on next app load. Active quarter auto-flips when the quarter ends.
      </div>
    </div>}

    {section==="history"&&<div>
      <div style={{fontSize:14,fontWeight:700,color:T.t1,marginBottom:4}}>Sales History</div>
      <div style={{fontSize:11,color:T.t3,marginBottom:16}}>Accumulated upload batches. Each weekly CSV is de-duped — uploading the same file twice adds no extra records.</div>
      {(()=>{
        const batches: any[] = salesStore?.batches || [];
        const recordCount: number = salesStore?.records ? Object.keys(salesStore.records).length : 0;
        const lastUpdated: string | null = salesStore?.lastUpdated || null;

        const StatRow = ({label, value, dim=false}: {label:string,value:string|number,dim?:boolean}) => (
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:`1px solid ${T.b1}`}}>
            <span style={{fontSize:11,color:dim?T.t4:T.t3}}>{label}</span>
            <span style={{fontSize:11,fontWeight:600,color:dim?T.t4:T.t2,fontFamily:"'JetBrains Mono',monospace"}}>{value}</span>
          </div>
        );

        const Section = ({title, icon, children}: {title:string,icon:string,children:any}) => (
          <div style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:12,padding:14,marginBottom:10}}>
            <div style={{fontSize:11,fontWeight:700,color:T.t3,textTransform:"uppercase",letterSpacing:.6,marginBottom:8}}>{icon} {title}</div>
            {children}
          </div>
        );

        if (batches.length === 0) return (
          <div style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:12,padding:20,textAlign:"center"}}>
            <div style={{fontSize:24,marginBottom:8}}>📂</div>
            <div style={{fontSize:13,fontWeight:600,color:T.t2,marginBottom:4}}>No upload history yet</div>
            <div style={{fontSize:11,color:T.t4}}>Upload a CSV — each batch will be recorded here.</div>
          </div>
        );

        return <div>
          {/* ── TOTALS ── */}
          <Section title="Store Totals" icon="🗄️">
            <StatRow label="Total upload batches" value={batches.length.toLocaleString()} />
            <StatRow label="Total de-duped records" value={recordCount.toLocaleString()} />
            {lastUpdated && <StatRow label="Last updated" value={new Date(lastUpdated).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})} dim />}
          </Section>

          {/* ── BATCH LIST ── */}
          <Section title="Upload Batches" icon="📦">
            {[...batches].reverse().map((b: any, i: number) => {
              const ts = new Date(b.uploadedAt);
              const dateStr = ts.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
              const timeStr = ts.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"});
              return (
                <div key={b.id} style={{paddingBottom:10,marginBottom:10,borderBottom:i<batches.length-1?`1px solid ${T.b1}`:"none"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:3}}>
                    <div style={{fontSize:11,fontWeight:600,color:T.t2,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{b.filename||"—"}</div>
                    <div style={{flexShrink:0,fontSize:10,color:T.t4}}>{dateStr} {timeStr}</div>
                  </div>
                  <div style={{display:"flex",gap:10}}>
                    <span style={{fontSize:10,color:T.t3}}>Rows: <span style={{color:T.t2,fontWeight:600,fontFamily:"'JetBrains Mono',monospace"}}>{(b.rowCount||0).toLocaleString()}</span></span>
                    <span style={{fontSize:10,color:T.t3}}>New records: <span style={{color:b.newRecords>0?T.green:T.t4,fontWeight:600,fontFamily:"'JetBrains Mono',monospace"}}>{(b.newRecords||0).toLocaleString()}</span></span>
                  </div>
                </div>
              );
            })}
          </Section>
        </div>;
      })()}
    </div>}
  </div>;
}

export default AdminTab;

