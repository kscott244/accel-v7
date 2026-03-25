"use client";
// @ts-nocheck
import { useState, useMemo, useEffect } from "react";
import { T } from "@/lib/tokens";
import { $f } from "@/lib/format";

import { BADGER } from "@/lib/data";
import { Stat } from "@/components/primitives";

function OutreachTab({scored}:{scored:any[]}) {
  const [gmailToken, setGmailToken] = useState<string|null>(null);
  const [previews, setPreviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [minGap, setMinGap] = useState(500);
  const [emailOnly, setEmailOnly] = useState(true);
  const [editIdx, setEditIdx] = useState<number|null>(null);
  const [editBody, setEditBody] = useState("");
  const [researching, setResearching] = useState(false);
  const [researchProgress, setResearchProgress] = useState<{done:number,total:number,current:string,cached:number}|null>(null);
  const [researchDone, setResearchDone] = useState<string[]>([]); // account ids researched this session
  const [refreshCount, setRefreshCount] = useState(0);
  const [driveStatus, setDriveStatus] = useState<string|null>(null); // "saving" | "saved" | "loading" | "loaded" | "error"
  const [driveCacheCount, setDriveCacheCount] = useState(0);
  const [importing, setImporting] = useState(false);

  useEffect(()=>{
    try { const t = localStorage.getItem("gmail_refresh_token"); if(t) setGmailToken(t); } catch {}
  }, []);

  useEffect(()=>{
    const p = new URLSearchParams(window.location.search);
    const status = p.get("gmail");
    const rt = p.get("refresh_token");
    if(status==="connected" && rt) {
      localStorage.setItem("gmail_refresh_token", rt);
      setGmailToken(rt);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // On mount with gmail token — check Drive cache count
  useEffect(()=>{
    if(!gmailToken) return;
    (async()=>{
      try {
        const res = await fetch("/api/load-research", {
          method: "POST",
          headers: {"Content-Type":"application/json"},
          body: JSON.stringify({ refreshToken: gmailToken })
        });
        const data = await res.json();
        if(data.totalCached) setDriveCacheCount(data.totalCached);
      } catch {}
    })();
  }, [gmailToken]);

  // Save a single research result to Google Drive
  async function saveToDrive(accountId: string, researchData: any) {
    if(!gmailToken) return;
    try {
      await fetch("/api/save-research", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ refreshToken: gmailToken, accountId, researchData })
      });
    } catch { /* silent — don't block research */ }
  }

  // Import all research from Google Drive into localStorage
  async function importFromDrive() {
    if(!gmailToken) { alert("Connect Gmail first (includes Drive access)"); return; }
    setImporting(true);
    setDriveStatus("loading");
    try {
      const res = await fetch("/api/load-research", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ refreshToken: gmailToken })
      });
      const data = await res.json();
      if(data.error) { setDriveStatus("error"); alert("Drive error: " + data.error); return; }

      const accounts = data.accounts || {};
      let restored = 0;
      for(const [id, intel] of Object.entries(accounts) as [string, any][]) {
        const contacts = {
          contactName: intel.contactName || null,
          phone: intel.phone || null,
          email: intel.email || null,
          website: intel.website || null,
          savedAt: intel.cachedAt || intel.searchedAt || new Date().toISOString(),
          practiceName: intel.practiceName || null,
          talkingPoints: intel.talkingPoints || [],
          hooks: intel.hooks || [],
          ownershipNote: intel.ownershipNote || null,
        };
        try { localStorage.setItem(`contact:${id}`, JSON.stringify(contacts)); restored++; } catch {}
      }

      setDriveCacheCount(data.totalCached || 0);
      setDriveStatus("loaded");
      setRefreshCount(c => c + 1);
      alert(`Restored ${restored} accounts from Google Drive backup.`);
    } catch(e: any) {
      setDriveStatus("error");
      alert("Import failed: " + e.message);
    } finally {
      setImporting(false);
    }
  }

  // Research top 25 — checks Drive cache first to avoid paying twice
  async function researchTop25() {
    setResearching(true);
    setResearchProgress({done:0, total:25, current:"", cached:0});
    setResearchDone([]);

    const top25 = [...scored]
      .filter(a => (a.combinedGap ?? a.q1_gap ?? 0) < 0)
      .sort((a,b) => (a.combinedGap??a.q1_gap??0) - (b.combinedGap??b.q1_gap??0))
      .slice(0, 25);

    // Step 1: Check Drive cache for these accounts
    let driveCache: Record<string,any> = {};
    if(gmailToken) {
      try {
        const cacheRes = await fetch("/api/load-research", {
          method: "POST",
          headers: {"Content-Type":"application/json"},
          body: JSON.stringify({ refreshToken: gmailToken, accountIds: top25.map(a=>a.id) })
        });
        const cacheData = await cacheRes.json();
        driveCache = cacheData.accounts || {};
      } catch {}
    }

    const found: string[] = [];
    let cachedCount = 0;

    for(let i = 0; i < top25.length; i++) {
      const a = top25[i];
      setResearchProgress({done:i, total:top25.length, current:a.name, cached:cachedCount});

      // Check if we have cached data (less than 14 days old)
      const cached = driveCache[a.id];
      if(cached?.cachedAt) {
        const age = Date.now() - new Date(cached.cachedAt).getTime();
        const maxAge = 14 * 24 * 60 * 60 * 1000; // 14 days
        if(age < maxAge) {
          // Use cached — no API call needed
          const contacts = {
            contactName: cached.contactName || null,
            phone: cached.phone || null,
            email: cached.email || null,
            website: cached.website || null,
            savedAt: cached.cachedAt,
            practiceName: a.name,
            talkingPoints: cached.talkingPoints || [],
            hooks: cached.hooks || [],
            ownershipNote: cached.ownershipNote || null,
          };
          try { localStorage.setItem(`contact:${a.id}`, JSON.stringify(contacts)); } catch {}
          found.push(a.id);
          cachedCount++;
          continue; // Skip API call — saved money!
        }
      }

      // No cache hit — call the API
      try {
        const badger = BADGER[a.id] || BADGER[a.gId] || null;
        const res = await fetch("/api/deep-research", {
          method: "POST",
          headers: {"Content-Type":"application/json"},
          body: JSON.stringify({
            name: a.name,
            city: a.city,
            state: a.st || a.state || "CT",
            address: badger?.address || a.addr || "",
            dealer: a.dealer || "",
            doctor: a.doctor || badger?.doctor || "",
            gName: a.gName || "",
          })
        });
        const data = await res.json();
        if(data?.intel) {
          const intel = data.intel;
          const contacts = {
            contactName: intel.contactName || null,
            phone: intel.phone || null,
            email: intel.email || null,
            website: intel.website || null,
            savedAt: new Date().toISOString(),
            practiceName: a.name,
            talkingPoints: intel.talkingPoints || [],
            hooks: intel.hooks || [],
            ownershipNote: intel.ownershipNote || null,
          };
          const hasContact = contacts.contactName || contacts.phone || contacts.email || contacts.website;
          if(hasContact) {
            try { localStorage.setItem(`contact:${a.id}`, JSON.stringify(contacts)); } catch {}
            found.push(a.id);

            // Auto-save to Google Drive backup
            saveToDrive(a.id, { ...intel, practiceName: a.name });
          }
        }
      } catch(e) { /* skip */ }
      await new Promise(r => setTimeout(r, 800));
    }
    setResearchDone(found);
    setResearchProgress({done:25, total:25, current:"", cached:cachedCount});
    setRefreshCount(c => c + 1);
    setResearching(false);
  }

  const downAccounts = useMemo(()=>{
    const acctQueue: any[] = [];
    const dedupe = new Set();

    const sorted = [...scored]
      .filter(a => {
        const gap = (a.combinedGap ?? a.q1_gap ?? 0);
        return gap < 0 && Math.abs(gap) >= minGap;
      })
      .sort((a,b) => (a.combinedGap??a.q1_gap??0) - (b.combinedGap??b.q1_gap??0));

    for (const a of sorted) {
      const badger = BADGER[a.id] || BADGER[a.gId] || null;
      const email = a.email || badger?.email || null;
      const doctor = a.doctor || badger?.doctor || null;

      if(emailOnly && !email) continue;
      if(email && dedupe.has(email)) continue;
      if(email) dedupe.add(email);

      const primaryDealer = a.dealer || "your distributor";

      acctQueue.push({
        ...a,
        email,
        doctor,
        primaryDealer,
        topSkus: a.products?.filter((p:any) => (p.py1||0) > 0)
          .sort((x:any,y:any) => (y.py1||0)-(x.py1||0))
          .slice(0,3)
          .map((p:any) => ({desc: p.n, py: p.py1||0, cy: p.cy1||0})) || [],
      });

      if(acctQueue.length >= 50) break;
    }
    return acctQueue;
  }, [scored, minGap, emailOnly, refreshCount]);

  const allDownCount = scored.filter(a=>(a.combinedGap??a.q1_gap??0)<0).length;
  const withEmail = useMemo(()=>{
    const seenEmails = new Set();
    return scored.filter(a => {
      const gap = (a.combinedGap ?? a.q1_gap ?? 0);
      if(gap >= 0) return false;
      const badger = BADGER[a.id] || BADGER[a.gId] || null;
      const email = a.email || badger?.email || null;
      if(!email) return false;
      if(seenEmails.has(email)) return false;
      seenEmails.add(email);
      return true;
    }).length;
  }, [scored, refreshCount]);

  const $f = (n:number) => "$"+Math.abs(n).toLocaleString(undefined,{maximumFractionDigits:0});

  async function generatePreviews() {
    setLoading(true); setPreviews([]); setResults([]);
    try {
      const enriched = downAccounts.map(a => {
        const badger = BADGER[a.id] || BADGER[a.gId] || null;
        return {
          ...a,
          contactName: a.contactName || badger?.contactName || a.doctor || null,
          doctor: a.doctor || badger?.doctor || null,
          email: a.email || badger?.email || null,
          phone: a.phone || badger?.phone || null,
          address: a.address || badger?.address || null,
          city: a.city,
          state: a.st || a.state || "CT",
        };
      });
      const res = await fetch("/api/send-outreach", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({accounts: enriched, preview: true, refreshToken: null})
      });
      const data = await res.json();
      setPreviews(data.results || []);
    } catch(e:any) { alert("Error: " + e.message); }
    finally { setLoading(false); }
  }

  async function sendAll() {
    if(!gmailToken) { alert("Connect Gmail first"); return; }
    setSending(true); setResults([]);
    try {
      const accountsToSend = previews.length > 0
        ? previews.filter(p=>p.email).map(p=>({...downAccounts.find(a=>a.id===p.id)||{}, _subject:p.subject, _body:p.body}))
        : downAccounts;
      const res = await fetch("/api/send-outreach", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({accounts: accountsToSend, refreshToken: gmailToken, preview: false})
      });
      const data = await res.json();
      setResults(data.results || []);
      if(data.error) alert("Error: " + data.error);
    } catch(e:any) { alert("Send error: " + e.message); }
    finally { setSending(false); }
  }

  return <div style={{padding:"16px 12px 80px",maxWidth:680,margin:"0 auto"}}>
    <div style={{marginBottom:16}}>
      <div style={{fontSize:18,fontWeight:700,color:T.t1,marginBottom:4}}>AI Outreach</div>
      <div style={{fontSize:12,color:T.t3}}>Personalized emails to down accounts — AI writes each one based on their actual data</div>
    </div>

    {/* Google Drive Backup Card */}
    <div style={{background:T.s1,border:`1px solid ${driveCacheCount>0?"rgba(52,211,153,.25)":T.b1}`,borderRadius:12,padding:12,marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:12,fontWeight:700,color:driveCacheCount>0?T.green:T.t2}}>
            {driveCacheCount>0?`☁️ ${driveCacheCount} accounts backed up to Drive`:"☁️ Google Drive Backup"}
          </div>
          <div style={{fontSize:10,color:T.t4,marginTop:2}}>
            {driveCacheCount>0
              ? "Research auto-saves to Drive · Survives any app rebuild"
              : gmailToken
                ? "Connect includes Drive access · Research will auto-save"
                : "Connect Gmail to enable Drive backup"}
          </div>
        </div>
        <button onClick={importFromDrive} disabled={importing||!gmailToken}
          style={{flexShrink:0,marginLeft:12,padding:"8px 14px",borderRadius:8,border:"none",
            background:(!gmailToken||importing)?T.s2:"rgba(52,211,153,.2)",
            color:(!gmailToken||importing)?T.t4:T.green,fontSize:11,fontWeight:700,
            cursor:(!gmailToken||importing)?"not-allowed":"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
          {importing?"Loading...":"Import from Drive"}
        </button>
      </div>
    </div>

    {/* Research Top 25 */}
    <div style={{background:T.s1,border:`1px solid ${researching?"rgba(167,139,250,.35)":researchDone.length>0?"rgba(52,211,153,.25)":T.b1}`,borderRadius:12,padding:12,marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:researching||researchDone.length>0?8:0}}>
        <div>
          <div style={{fontSize:12,fontWeight:700,color:researchDone.length>0?T.green:T.t2}}>
            {researchDone.length>0?`✅ Researched ${researchDone.length} accounts`:"🔬 Research Top 25 Down Accounts"}
          </div>
          <div style={{fontSize:10,color:T.t4,marginTop:2}}>
            {researchDone.length>0
              ? "Contact cards updated · auto-saved to Google Drive"
              : "AI searches the web — skips accounts already cached in Drive (saves $)"}
          </div>
        </div>
        <button onClick={researchTop25} disabled={researching||scored.length===0}
          style={{flexShrink:0,marginLeft:12,padding:"8px 14px",borderRadius:8,border:"none",
            background:researching?T.s2:"rgba(167,139,250,.2)",
            color:researching?T.t4:T.purple,fontSize:11,fontWeight:700,
            cursor:researching?"not-allowed":"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
          {researching?"Running...":"Run Research"}
        </button>
      </div>
      {researching&&researchProgress&&<div>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
          <span style={{fontSize:10,color:T.t3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>
            {researchProgress.current ? `Researching: ${researchProgress.current}` : "Finishing up..."}
          </span>
          <span style={{fontSize:10,color:T.purple,flexShrink:0,marginLeft:8}}>
            {researchProgress.done}/{researchProgress.total}
            {researchProgress.cached>0&&<span style={{color:T.green,marginLeft:4}}>({researchProgress.cached} cached)</span>}
          </span>
        </div>
        <div style={{height:4,background:T.s2,borderRadius:2,overflow:"hidden"}}>
          <div style={{height:"100%",background:T.purple,borderRadius:2,width:`${(researchProgress.done/researchProgress.total)*100}%`,transition:"width .3s"}}/>
        </div>
      </div>}
    </div>

    <div style={{background:T.s1,border:`1px solid ${gmailToken?T.green:T.b1}`,borderRadius:12,padding:12,marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <div>
        <div style={{fontSize:12,fontWeight:700,color:gmailToken?T.green:T.t2}}>{gmailToken?"✅ Gmail + Drive Connected":"📧 Gmail Not Connected"}</div>
        <div style={{fontSize:10,color:T.t4,marginTop:2}}>{gmailToken?"Emails send from your Gmail · Research backs up to Drive":"Connect once to enable auto-send + Drive backup"}</div>
      </div>
      {gmailToken
        ? <button onClick={()=>{localStorage.removeItem("gmail_refresh_token");setGmailToken(null);}} style={{fontSize:10,color:T.t4,background:"none",border:`1px solid ${T.b1}`,borderRadius:6,padding:"4px 8px",cursor:"pointer",fontFamily:"inherit"}}>Disconnect</button>
        : <button onClick={()=>{ window.location.href="/api/gmail-auth"; }} style={{fontSize:12,fontWeight:700,color:"#fff",background:T.blue,border:"none",borderRadius:8,padding:"8px 14px",cursor:"pointer",fontFamily:"inherit"}}>Connect Gmail + Drive</button>
      }
    </div>

    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
      {[{l:"Down Accounts",v:allDownCount,c:T.red},{l:"Have Email",v:withEmail,c:T.blue},{l:"In Queue",v:downAccounts.length,c:T.amber}].map(s=>(
        <div key={s.l} style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:10,padding:"10px 8px",textAlign:"center"}}>
          <div style={{fontSize:20,fontWeight:800,color:s.c}}>{s.v}</div>
          <div style={{fontSize:9,color:T.t4,marginTop:2,textTransform:"uppercase",letterSpacing:.5}}>{s.l}</div>
        </div>
      ))}
    </div>

    <div style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:10,padding:12,marginBottom:12}}>
      <div style={{fontSize:11,fontWeight:700,color:T.t2,marginBottom:10}}>Filter Queue</div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
        <span style={{fontSize:11,color:T.t3}}>Min gap: {$f(minGap)}</span>
        <input type="range" min={0} max={5000} step={250} value={minGap} onChange={e=>setMinGap(+e.target.value)} style={{width:140,accentColor:T.blue}}/>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <button onClick={()=>setEmailOnly(!emailOnly)} style={{width:18,height:18,borderRadius:4,border:`2px solid ${emailOnly?T.blue:T.b1}`,background:emailOnly?T.blue:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          {emailOnly&&<span style={{color:"#fff",fontSize:10}}>✓</span>}
        </button>
        <span style={{fontSize:11,color:T.t3}}>Email addresses only ({withEmail} accounts)</span>
      </div>
    </div>

    <div style={{display:"flex",gap:8,marginBottom:16}}>
      <button onClick={generatePreviews} disabled={loading||downAccounts.length===0}
        style={{flex:1,padding:"11px 0",borderRadius:10,border:`1px solid ${T.blue}`,background:"transparent",color:T.blue,fontSize:12,fontWeight:700,cursor:downAccounts.length>0?"pointer":"not-allowed",opacity:downAccounts.length>0?1:.4,fontFamily:"inherit"}}>
        {loading?"✍️ Writing...":"✍️ Preview ("+downAccounts.length+")"}
      </button>
      <button onClick={sendAll} disabled={sending||!gmailToken||downAccounts.length===0}
        style={{flex:1,padding:"11px 0",borderRadius:10,border:"none",background:(!gmailToken||downAccounts.length===0)?T.s2:T.blue,color:"#fff",fontSize:12,fontWeight:700,cursor:(!gmailToken||downAccounts.length===0)?"not-allowed":"pointer",fontFamily:"inherit"}}>
        {sending?"📤 Sending...":"🚀 Send All"}
      </button>
    </div>

    {results.length>0&&<div style={{background:T.s1,border:`1px solid ${T.green}`,borderRadius:10,padding:12,marginBottom:12}}>
      <div style={{fontSize:12,fontWeight:700,color:T.green}}>
        ✅ Sent {results.filter(r=>r.status==="sent").length} · Skipped {results.filter(r=>r.status==="skipped").length} · Errors {results.filter(r=>r.status==="error").length}
      </div>
      {results.filter(r=>r.status==="error").map((r,i)=>(
        <div key={i} style={{fontSize:10,color:T.red,marginTop:4}}>⚠ {r.name}: {r.reason}</div>
      ))}
    </div>}

    {previews.length>0&&<div>
      <div style={{fontSize:11,fontWeight:700,color:T.t2,marginBottom:8,textTransform:"uppercase",letterSpacing:.5}}>Preview — Review Before Sending</div>
      {previews.map((p,i)=>(
        <div key={i} style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:10,padding:12,marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
            <div>
              <div style={{fontSize:12,fontWeight:700,color:T.t1}}>{p.name}</div>
              <div style={{fontSize:10,color:T.t4}}>{p.email||"no email"}</div>
            </div>
            <button onClick={()=>{setEditIdx(editIdx===i?null:i);setEditBody(p.body);}} style={{fontSize:10,color:T.blue,background:"none",border:`1px solid ${T.blue}`,borderRadius:6,padding:"3px 8px",cursor:"pointer",fontFamily:"inherit"}}>
              {editIdx===i?"Close":"Edit"}
            </button>
          </div>
          <div style={{fontSize:10,color:T.t3,marginBottom:4}}><span style={{color:T.t4}}>Subject: </span>{p.subject}</div>
          {editIdx===i
            ? <textarea value={editBody} onChange={e=>{setEditBody(e.target.value); previews[i].body=e.target.value;}} style={{width:"100%",minHeight:120,background:T.bg,border:`1px solid ${T.blue}`,borderRadius:6,padding:8,color:T.t1,fontSize:10,fontFamily:"inherit",resize:"vertical",boxSizing:"border-box"}}/>
            : <div style={{fontSize:10,color:T.t2,whiteSpace:"pre-wrap",lineHeight:1.6,maxHeight:80,overflow:"hidden"}}>{p.body}</div>
          }
        </div>
      ))}
    </div>}

    {scored.length===0&&<div style={{textAlign:"center",padding:"40px 0",color:T.t4,fontSize:12}}>Upload a CSV to get started.</div>}
    {scored.length>0&&downAccounts.length===0&&<div style={{textAlign:"center",padding:"40px 0",color:T.t4,fontSize:12}}>No down accounts match filters. Try lowering the minimum gap.</div>}
  </div>;
}

// ─────────────────────────────────────────────────────────────────
// ADMIN TAB — Manage overlays (groups, names, contacts, detaches)
// All changes commit to overlays.json on GitHub automatically. No data lost on CSV reload.
// ─────────────────────────────────────────────────────────────────

export default OutreachTab;
