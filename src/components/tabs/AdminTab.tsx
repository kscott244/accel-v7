"use client";
// @ts-nocheck
import { useState } from "react";
import { T } from "@/lib/tokens";
import { $$ } from "@/lib/format";
import CPID_MERGES from "@/data/cpid-pending-merges.json";
import CPID_REVIEW from "@/data/cpid-review-queue.json";

let BADGER: Record<string, any> = {};
try { BADGER = require("@/data/badger-lookup.json"); } catch(e) {}

let OVERLAYS_REF: any = { nameOverrides:{}, contacts:{}, fscReps:{}, activityLogs:{}, research:{}, dealerOverrides:{}, groups:{}, groupDetaches:[], groupMoves:{} };

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

function AdminTab({groups, scored, overlays, saveOverlays}:{groups:any[], scored:any[], overlays:any, saveOverlays:any}) {
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
  const [groupType, setGroupType] = useState<"multi"|"private"|"merge">("multi");
  const [mergeBase, setMergeBase] = useState<any>(null);
  const [mergeSearch, setMergeSearch] = useState("");
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
  const [skippedMergeIds, setSkippedMergeIds] = useState<Record<string,boolean>>(() => {
    try { return JSON.parse(localStorage.getItem("cpid_skipped")||"{}"); } catch { return {}; }
  });

  // Contact form
  const [contactSearch, setContactSearch] = useState("");
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
      {sectionBtn("data","💾 Data")}
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

      {/* Create / Edit group form */}
      <div style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:12,padding:14}}>
        <div style={{fontSize:12,fontWeight:700,color:T.t2,marginBottom:12}}>{editingGroup?"✏️ Edit Group":"➕ Create New Group"}</div>

        {/* Group Type selector — only shown when not editing */}
        {!editingGroup&&<div style={{marginBottom:12}}>
          <div style={{fontSize:10,color:T.t3,marginBottom:6}}>Group Type</div>
          <div style={{display:"flex",gap:6}}>
            {([["multi","Multi Practice","Multiple physical locations under one owner"],["private","Private Group","Same address, multiple dealers"],["merge","Merge with Existing","Add accounts to an existing group"]] as [string,string,string][]).map(([k,label,tip])=>(
              <button key={k} onClick={()=>{
                setGroupType(k as any);
                setMergeBase(null); setMergeSearch(""); setChildIds([]); setNewGroupName("");
                setNewGroupClass(k==="private"?"Private Practice":"Emerging DSO");
              }} title={tip} style={{flex:1,padding:"7px 4px",borderRadius:8,border:`1px solid ${groupType===k?"rgba(79,142,247,.4)":T.b1}`,background:groupType===k?"rgba(79,142,247,.12)":"transparent",color:groupType===k?T.blue:T.t3,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit",textAlign:"center"}}>
                {label}
              </button>
            ))}
          </div>
        </div>}

        {/* Merge with Existing — base group search */}
        {!editingGroup&&groupType==="merge"&&<div style={{marginBottom:10}}>
          <div style={{fontSize:10,color:T.t3,marginBottom:4}}>Search Existing Group to Merge Into</div>
          {mergeBase
            ? <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",background:T.s2,borderRadius:8,border:`1px solid ${T.b1}`,marginBottom:6}}>
                <div>
                  <div style={{fontSize:12,fontWeight:700,color:T.t1}}>{mergeBase.name}</div>
                  <div style={{fontSize:10,color:T.t4}}>{(mergeBase.children||[]).length} existing locations · {mergeBase.class2}</div>
                </div>
                <button onClick={()=>{setMergeBase(null);setMergeSearch("");setChildIds([]);setNewGroupName("");}} style={{background:"none",border:"none",color:T.t4,cursor:"pointer",fontSize:12}}>✕</button>
              </div>
            : <>
                <input value={mergeSearch} onChange={e=>setMergeSearch(e.target.value)} placeholder="Type group name..."
                  style={{width:"100%",padding:"9px 12px",borderRadius:8,border:`1px solid ${T.b1}`,background:T.bg,color:T.t1,fontSize:12,fontFamily:"inherit",boxSizing:"border-box"}}/>
                {mergeSearch.length>=2&&<div style={{border:`1px solid ${T.b2}`,borderRadius:8,background:T.s1,overflow:"hidden",marginTop:4,maxHeight:200,overflowY:"auto"}}>
                  {searchGroups(mergeSearch).map((g:any,i:number)=>(
                    <button key={g.id} onClick={()=>{
                      setMergeBase(g);
                      setMergeSearch(g.name);
                      setNewGroupName(g.name);
                      setNewGroupClass(g.class2||"Emerging DSO");
                      // Pre-populate with existing children
                      const existingIds=(g.children||[]).map((c:any)=>c.id);
                      setChildIds(existingIds);
                    }} style={{display:"block",width:"100%",textAlign:"left",padding:"8px 12px",background:"transparent",border:"none",borderBottom:i>0?`1px solid ${T.b1}`:"none",cursor:"pointer",fontFamily:"inherit",color:T.t1}}>
                      <div style={{fontSize:12,fontWeight:600}}>{g.name}</div>
                      <div style={{fontSize:10,color:T.t4}}>{(g.children||[]).length} locs · {g.class2}</div>
                    </button>
                  ))}
                </div>}
              </>}
        </div>}

        {/* Group Name */}
        {(groupType!=="merge"||mergeBase)&&<div style={{marginBottom:10}}>
          <div style={{fontSize:10,color:T.t3,marginBottom:4}}>Group Name</div>
          <input value={newGroupName} onChange={e=>setNewGroupName(e.target.value)} placeholder="e.g. Resolute Dental Partners"
            style={{width:"100%",padding:"9px 12px",borderRadius:8,border:`1px solid ${T.b1}`,background:T.bg,color:T.t1,fontSize:12,fontFamily:"inherit",boxSizing:"border-box"}}/>
        </div>}

        {/* Class dropdown — hidden for Private Group (auto-set) */}
        {groupType!=="private"&&(groupType!=="merge"||mergeBase)&&<div style={{marginBottom:10}}>
          <div style={{fontSize:10,color:T.t3,marginBottom:4}}>Classification</div>
          <select value={newGroupClass} onChange={e=>setNewGroupClass(e.target.value)}
            style={{width:"100%",padding:"9px 12px",borderRadius:8,border:`1px solid ${T.b1}`,background:T.bg,color:T.t1,fontSize:12,fontFamily:"inherit"}}>
            <option>Emerging DSO</option>
            <option>DSO</option>
            <option>Academic</option>
          </select>
        </div>}

        {/* Add Locations search */}
        {(groupType!=="merge"||mergeBase)&&<div style={{marginBottom:10}}>
          <div style={{fontSize:10,color:T.t3,marginBottom:4}}>{groupType==="merge"?"Add More Locations":"Add Locations"} — search by name, city, or address</div>
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
                    <div style={{fontSize:10,color:T.t3}}>{a.city}{a.st?`, ${a.st}`:""}</div>
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
          if(groupType==="merge"&&!mergeBase&&!editingGroup){showToast("❌ Select a group to merge into",false);return;}
          // For merge: use base group's ID so the overlay supersedes the original
          const id = editingGroup?.id || (groupType==="merge"&&mergeBase?mergeBase.id:`Master-CUSTOM-${Date.now()}`);
          const cls = groupType==="private"?"Private Practice":newGroupClass;
          if (saveOverlays) {
            const grp = {id,name:newGroupName.trim(),class2:cls,childIds,tier:"Standard",groupType,createdAt:editingGroup?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
            const next = { ...OVERLAYS_REF, groups: { ...(OVERLAYS_REF.groups||{}), [id]: grp } };
            saveOverlays(next).then(ok => {
              if(ok){ showToast("✅ Group saved"); setGroupType("multi"); setMergeBase(null); setMergeSearch(""); }
              else showToast("❌ Save failed",false);
            });
          }
        }} disabled={saving||!newGroupName.trim()||childIds.length===0||(groupType==="merge"&&!mergeBase&&!editingGroup)}
          style={{width:"100%",padding:"11px 0",borderRadius:10,border:"none",background:(!newGroupName.trim()||childIds.length===0)?T.s2:T.blue,color:"#fff",fontSize:13,fontWeight:700,cursor:(!newGroupName.trim()||childIds.length===0)?"not-allowed":"pointer",fontFamily:"inherit"}}>
          {saving?"Saving...":editingGroup?"Update Group":groupType==="merge"?"Merge Groups":"Create Group"}
        </button>
        {editingGroup&&<button onClick={()=>{setEditingGroup(null);setNewGroupName("");setChildIds([]);setGroupType("multi");setMergeBase(null);setMergeSearch("");}} style={{width:"100%",marginTop:6,padding:"9px 0",borderRadius:10,border:`1px solid ${T.b1}`,background:"transparent",color:T.t3,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Cancel Edit</button>}
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
        {([["auto",`Auto (${(CPID_MERGES as any[]).filter(p=>!Object.keys(OVERLAYS_REF.groups||{}).includes(p.id)&&!skippedMergeIds[p.id]).length})`],["review",`Review (${(CPID_REVIEW as any[]).length})`],["live","Live Scan"]] as [string,string][]).map(([k,label])=>(
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
            try{localStorage.setItem("cpid_skipped",JSON.stringify(next));}catch{}
            return next;
          });
        };
        const approvePair = (p:any) => {
          const grp={id:p.id,name:p.name,class2:p.class2||"Private Practice",childIds:p.childIds,tier:"Standard",source:"auto-merge",score:p.score,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
          const next={...OVERLAYS_REF,groups:{...(OVERLAYS_REF.groups||{}),[p.id]:grp}};
          saveOverlays(next).then((ok:boolean)=>{if(ok)showToast(`✅ Merged: ${p.name}`);else showToast("❌ Save failed",false);});
        };
        const applyAll = () => {
          if(pending.length===0){showToast("All already applied");return;}
          const newGroups={...(OVERLAYS_REF.groups||{})};
          pending.forEach((p:any)=>{newGroups[p.id]={id:p.id,name:p.name,class2:p.class2||"Private Practice",childIds:p.childIds,tier:"Standard",source:"auto-merge",score:p.score,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};});
          const next={...OVERLAYS_REF,groups:newGroups};
          setSaving(true);
          saveOverlays(next).then((ok:boolean)=>{setSaving(false);if(ok)showToast(`✅ Applied ${pending.length} auto-merges`);else showToast("❌ Apply failed",false);});
        };
        const doneCount=(CPID_MERGES as any[]).length-pending.length;
        return <div>
          {doneCount>0&&<div style={{fontSize:10,color:T.green,marginBottom:8}}>✓ {doneCount} already applied</div>}
          {pending.length>0&&<button onClick={applyAll} disabled={saving} style={{width:"100%",padding:"10px 0",borderRadius:10,border:"none",background:"rgba(52,211,153,.15)",color:T.green,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginBottom:12,border:"1px solid rgba(52,211,153,.3)"}}>
            {saving?"Applying...":(`Apply All ${pending.length} Recommended Merges`)}
          </button>}
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

    {section==="data"&&<div>
      <div style={{fontSize:14,fontWeight:700,color:T.t1,marginBottom:4}}>Data Cache</div>
      <div style={{fontSize:11,color:T.t3,marginBottom:16}}>The app caches the last uploaded CSV in your browser. If Q1 numbers look wrong, reset to use the built-in preloaded data.</div>
      {(()=>{
        let cacheInfo = "No CSV cached — using preloaded data";
        let hasCsvCache = false;
        try {
          const raw = localStorage.getItem("accel_data_v2");
          if (raw) {
            const d = JSON.parse(raw);
            cacheInfo = `CSV cached from ${d.generated||"unknown date"} · ${(d.groups||[]).length} groups`;
            hasCsvCache = true;
          }
        } catch {}
        return <div style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:12,padding:14}}>
          <div style={{fontSize:11,color:T.t2,marginBottom:12}}>{cacheInfo}</div>
          {hasCsvCache&&<button onClick={()=>{
            try { localStorage.removeItem("accel_data_v2"); } catch {}
            showToast("✅ Cache cleared — reloading…");
            setTimeout(()=>window.location.reload(), 800);
          }} style={{padding:"10px 16px",borderRadius:8,border:"none",background:"rgba(248,113,113,.15)",color:T.red,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",width:"100%"}}>
            Reset to preloaded data
          </button>}
          {!hasCsvCache&&<div style={{fontSize:11,color:T.green}}>✓ Already using preloaded data</div>}
        </div>;
      })()}
    </div>}
  </div>;
}

export default AdminTab;
