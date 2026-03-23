"use client";
// @ts-nocheck

import { useState, useMemo, useRef, useEffect } from "react";
import { T } from "@/lib/tokens";
import { $$ } from "@/lib/format";
import { IconMap } from "@/components/primitives";

let WEEK_ROUTES: any = { routes: {}, unplaced: [] };
try { WEEK_ROUTES = require("@/data/week-routes.json"); } catch(e) {}

export default function MapTab() {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const onPinClickRef = useRef<(a:any)=>void>(()=>{});
  const [selDay, setSelDay] = useState<string|null>(null);
  const [selAcct, setSelAcct] = useState<any>(null);

  // Always-fresh callback ref — update only when selAcct setter identity changes (never)
  onPinClickRef.current = (a) => setSelAcct(a);

  const days = Object.keys(WEEK_ROUTES.routes||{});

  // Memoized — only recomputes when selDay changes, NOT on every render
  const displayed = useMemo(()=>
    selDay
      ? (WEEK_ROUTES.routes[selDay]||[]).map(a=>({...a,day:selDay}))
      : days.flatMap(d=>(WEEK_ROUTES.routes[d]||[]).map(a=>({...a,day:d})))
  , [selDay]);

  const vpColor = (vp) => {
    if (vp==="NOW") return T.red;
    if (vp==="SOON") return T.amber;
    return T.green;
  };

  // Ken's home base — used as route origin
  const HOME_BASE = "Thomaston, CT";

  const openGoogleMaps = (accts) => {
    const withGps = accts.filter(a=>a.lat&&a.lng);
    if (!withGps.length) return;

    // Build address string: prefer full address, fall back to "City, State"
    const addrOf = (a) => {
      const addr = (a.address||"").trim();
      // Use full address if it has a street number, otherwise city+state
      if (addr && /^\d/.test(addr)) return addr;
      return `${a.city||""}, ${a.state||"CT"}`;
    };

    if (withGps.length === 1) {
      const dest = encodeURIComponent(addrOf(withGps[0]));
      window.open(`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(HOME_BASE)}&destination=${dest}&travelmode=driving`,"_blank");
      return;
    }

    // Multi-stop: origin=home, destination=last stop, waypoints=everything in between
    const origin = encodeURIComponent(HOME_BASE);
    const destination = encodeURIComponent(addrOf(withGps[withGps.length-1]));
    const waypointList = withGps.slice(0,-1).map(a=>encodeURIComponent(addrOf(a))).join("|");
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypointList}&travelmode=driving`;
    window.open(url,"_blank");
  };

  // Map only rebuilds when selDay changes — NOT when selAcct changes
  useEffect(()=>{
    if (!mapRef.current) return;
    if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current=null; }

    const pts = displayed.filter(a=>a.lat&&a.lng);
    if (!pts.length) return;

    const loadLeaflet = () => new Promise<void>((res) => {
      if ((window as any).L) { res(); return; }
      const css = document.createElement("link");
      css.rel="stylesheet"; css.href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
      document.head.appendChild(css);
      const js = document.createElement("script");
      js.src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
      js.onload=()=>res();
      document.head.appendChild(js);
    });

    loadLeaflet().then(()=>{
      const L = (window as any).L;
      if (!mapRef.current || mapInstanceRef.current) return;
      const avgLat = pts.reduce((s,a)=>s+a.lat,0)/pts.length;
      const avgLng = pts.reduce((s,a)=>s+a.lng,0)/pts.length;
      const map = L.map(mapRef.current, {zoomControl:true}).setView([avgLat,avgLng],10);
      mapInstanceRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
        attribution:'© OpenStreetMap',maxZoom:18
      }).addTo(map);

      if (selDay) {
        const coords = pts.map(a=>[a.lat,a.lng]);
        L.polyline(coords,{color:"rgba(79,142,247,.5)",weight:2,dashArray:"6,4"}).addTo(map);
      }

      pts.forEach((a,i)=>{
        const col = vpColor(a.vp||"");
        const svgIcon = L.divIcon({
          className:"",
          html:`<div style="width:28px;height:28px;border-radius:50%;background:${T.s1};border:2.5px solid ${col};display:flex;align-items:center;justify-content:center;font-family:monospace;font-size:10px;font-weight:800;color:${col};box-shadow:0 2px 8px rgba(0,0,0,.5);cursor:pointer">${selDay?i+1:""}</div>`,
          iconSize:[28,28], iconAnchor:[14,14]
        });
        const marker = L.marker([a.lat,a.lng],{icon:svgIcon}).addTo(map);
        // Always route through ref — never captures stale state
        marker.on("click", () => onPinClickRef.current(a));
      });

      if (pts.length>1) map.fitBounds(L.latLngBounds(pts.map(a=>[a.lat,a.lng])),{padding:[24,24]});
    });

    return ()=>{ if(mapInstanceRef.current){mapInstanceRef.current.remove();mapInstanceRef.current=null;} };
  },[selDay]); // ← only selDay, NOT displayed or selAcct — prevents popover from triggering rebuild

  const dayColors = ["#4f8ef7","#22d3ee","#34d399","#fbbf24","#a78bfa"];

  return <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 112px)",position:"relative"}}>

    {/* Day filter pills */}
    <div style={{padding:"10px 16px 0",flexShrink:0}}>
      <div className="hide-sb" style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:8}}>
        <button onClick={()=>{setSelDay(null);setSelAcct(null)}} style={{flexShrink:0,padding:"5px 14px",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",border:`1px solid ${!selDay?"rgba(79,142,247,.3)":T.b2}`,background:!selDay?"rgba(79,142,247,.12)":T.s2,color:!selDay?T.blue:T.t3,fontFamily:"inherit"}}>All Days</button>
        {days.map((d,i)=>{
          const col=dayColors[i%dayColors.length];
          const cnt=(WEEK_ROUTES.routes[d]||[]).length;
          return <button key={d} onClick={()=>{setSelDay(d===selDay?null:d);setSelAcct(null)}} style={{flexShrink:0,padding:"5px 14px",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",border:`1px solid ${selDay===d?col+"55":T.b2}`,background:selDay===d?col+"18":T.s2,color:selDay===d?col:T.t3,fontFamily:"inherit"}}>{d} <span style={{opacity:.7,fontSize:9}}>({cnt})</span></button>;
        })}
      </div>

      {/* Route button */}
      {selDay&&(WEEK_ROUTES.routes[selDay]||[]).filter(a=>a.lat).length>0&&(
        <button onClick={()=>openGoogleMaps((WEEK_ROUTES.routes[selDay]||[]))} style={{width:"100%",marginBottom:8,padding:"8px 0",borderRadius:10,border:"none",background:`linear-gradient(90deg,${T.blue},${T.cyan})`,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
          <IconMap c="#fff"/> Open {selDay} Route in Google Maps
        </button>
      )}
    </div>

    {/* Map */}
    <div ref={mapRef} style={{flex:1,minHeight:0,background:T.s2}}/>

    {/* Account popover — fixed so it's always visible above nav bar */}
    {selAcct&&<div className="anim" style={{position:"fixed",bottom:64,left:0,right:0,margin:"0 12px",zIndex:200,background:T.s1,border:`1px solid rgba(79,142,247,.3)`,borderRadius:16,padding:14,boxShadow:"0 8px 40px rgba(0,0,0,.7)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{selAcct.name}</div>
          <div style={{fontSize:10,color:T.t3,marginTop:1}}>{selAcct.city}, {selAcct.state} · <span style={{color:vpColor(selAcct.vp),fontWeight:700}}>{selAcct.vp||"—"}</span>{selAcct.zone?` · ${selAcct.zone}`:""}</div>
        </div>
        <button onClick={()=>setSelAcct(null)} style={{background:"none",border:"none",color:T.t4,cursor:"pointer",fontSize:18,lineHeight:1,paddingLeft:8,flexShrink:0}}>✕</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:10}}>
        <div style={{background:T.s2,borderRadius:8,padding:"6px 8px",textAlign:"center"}}>
          <div style={{fontSize:8,color:T.t4}}>Q1 2025</div>
          <div className="m" style={{fontSize:12,fontWeight:700,color:T.t2}}>{$$(selAcct.q1_2025||selAcct.py||0)}</div>
        </div>
        <div style={{background:T.s2,borderRadius:8,padding:"6px 8px",textAlign:"center"}}>
          <div style={{fontSize:8,color:T.t4}}>Q1 2026</div>
          <div className="m" style={{fontSize:12,fontWeight:700,color:T.blue}}>{$$(selAcct.q1_2026||selAcct.cy||0)}</div>
        </div>
        <div style={{background:T.s2,borderRadius:8,padding:"6px 8px",textAlign:"center"}}>
          <div style={{fontSize:8,color:T.t4}}>Gap</div>
          {(()=>{const g=(selAcct.q1_2025||selAcct.py||0)-(selAcct.q1_2026||selAcct.cy||0);return <div className="m" style={{fontSize:12,fontWeight:700,color:g>0?T.red:T.green}}>{g>0?$$(g):"+"+$$(Math.abs(g))}</div>;})()} 
        </div>
      </div>
      {selAcct.flag&&<div style={{fontSize:10,color:T.amber,background:"rgba(251,191,36,.06)",border:"1px solid rgba(251,191,36,.15)",borderRadius:8,padding:"5px 8px",marginBottom:8}}>{selAcct.flag}</div>}
      {selAcct.intel&&<div style={{fontSize:10,color:T.t3,lineHeight:1.5,marginBottom:8,maxHeight:56,overflow:"hidden"}}>{selAcct.intel}</div>}
      <div style={{display:"flex",gap:6}}>
        {selAcct.phone&&<a href={`tel:${selAcct.phone}`} style={{flex:1,padding:"7px 0",borderRadius:8,border:`1px solid ${T.b2}`,background:T.s2,color:T.t1,fontSize:11,fontWeight:600,textAlign:"center",textDecoration:"none",display:"block"}}>{selAcct.phone}</a>}
        {selAcct.lat&&selAcct.lng&&<a href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(HOME_BASE)}&destination=${encodeURIComponent(((selAcct.address||"").trim()&&/^\d/.test((selAcct.address||"").trim()))?selAcct.address:`${selAcct.city}, ${selAcct.state||"CT"}`)}&travelmode=driving`} target="_blank" rel="noreferrer" style={{flex:1,padding:"7px 0",borderRadius:8,border:"none",background:`linear-gradient(90deg,${T.blue},${T.cyan})`,color:"#fff",fontSize:11,fontWeight:600,textAlign:"center",textDecoration:"none",display:"block"}}>Navigate →</a>}
      </div>
    </div>}

    {/* Legend */}
    <div style={{padding:"6px 16px",flexShrink:0,display:"flex",gap:12,alignItems:"center",borderTop:`1px solid ${T.b1}`}}>
      {[["NOW",T.red],["SOON",T.amber],["ON TRACK",T.green]].map(([l,c])=>(
        <div key={l} style={{display:"flex",alignItems:"center",gap:4}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:c}}/>
          <span style={{fontSize:9,color:T.t4}}>{l}</span>
        </div>
      ))}
      <span style={{marginLeft:"auto",fontSize:9,color:T.t4}}>{displayed.filter(a=>a.lat).length} mapped · {displayed.filter(a=>!a.lat).length} no GPS</span>
    </div>
  </div>;
}

