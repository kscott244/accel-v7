"use client";
// @ts-nocheck

import { T } from "@/lib/tokens";
import { PARENT_NAMES } from "@/lib/data";

// ─── ICONS ───────────────────────────────────────────────────────
export const Back  = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>;
export const Chev  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{opacity:.4,flexShrink:0}}><path d="M9 18l6-6-6-6"/></svg>;
export const IconMap = ({c}:{c:string}) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>;

// ─── DISPLAY NAME FIXER ──────────────────────────────────────────
export const BAD_GROUP_NAMES = new Set(["STANDARD","Standard","HOUSE ACCOUNTS","House Accounts","SILVER","GOLD","PLATINUM","DIAMOND","TOP 100","Silver","Gold","Platinum","Diamond","Top 100",""]);
export const cleanParentName = (name: string): string => {
  if (!name) return "";
  return name.replace(/\s*:\s*Master-CM\d+$/i, "").trim();
};
export const fixGroupName = (g: any): string => {
  if (!g) return "Unknown";
  const authName = PARENT_NAMES[g.id];
  if (authName && !BAD_GROUP_NAMES.has(authName)) return authName;
  const cleaned = cleanParentName(g.name);
  if (cleaned && !BAD_GROUP_NAMES.has(cleaned)) return cleaned;
  if (g.children?.length === 1) return g.children[0].name;
  if (g.children?.length > 1) return `${g.children[0].name} (+${g.children.length-1})`;
  return cleaned || g.id || "Unknown";
};

// ─── SMALL COMPONENTS ────────────────────────────────────────────
export const Pill = ({l,v,c}:{l:string,v:any,c:string}) => <div><span style={{fontSize:9,textTransform:"uppercase",color:T.t3}}>{l} </span><span className="m" style={{fontSize:12,fontWeight:700,color:c}}>{v}</span></div>;
export const Stat = ({l,v,c}:{l:string,v:any,c:string}) => <div style={{background:T.s2,borderRadius:8,padding:"8px 10px",textAlign:"center"}}><div style={{fontSize:9,textTransform:"uppercase",color:T.t3,marginBottom:2}}>{l}</div><div className="m" style={{fontSize:14,fontWeight:700,color:c}}>{v}</div></div>;
export const Bar  = ({pct,color}:{pct:number,color?:string}) => <div style={{width:"100%",height:6,borderRadius:3,background:T.s3,overflow:"hidden"}}><div className="bar-g" style={{height:"100%",borderRadius:3,width:`${Math.min(Math.max(pct,0),100)}%`,background:color||`linear-gradient(90deg,${T.blue},${T.cyan})`}}/></div>;

// ─── SHARED ACCOUNT IDENTITY ─────────────────────────────────────
// Building icon SVG (14px, for group badges)
const BuildingIcon = ({c}:{c:string}) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" style={{flexShrink:0}}><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>;

// Group affiliation badge — shows when parent group has 3+ children.
// Tapping navigates to the parent group via goGroup(parentId).
export const GroupBadge = ({gName,gId,locs,goGroup}:{gName?:string,gId?:string,locs?:number,goGroup?:(id:string)=>void}) => {
  if (!gName || !locs || locs < 3) return null;
  const label = cleanParentName(gName);
  if (!label || BAD_GROUP_NAMES.has(label)) return null;
  return <button onClick={e=>{e.stopPropagation();if(goGroup&&gId)goGroup(gId);}} style={{display:"inline-flex",alignItems:"center",gap:4,background:"rgba(167,139,250,.08)",border:"1px solid rgba(167,139,250,.18)",borderRadius:6,padding:"2px 7px",cursor:goGroup?"pointer":"default",fontFamily:"inherit"}}>
    <BuildingIcon c={T.purple}/>
    <span style={{fontSize:10,color:T.t4,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:140}}>{label} · {locs} locs</span>
  </button>;
};

export const AccountId = ({name,gName,size="md",color,locs}:{name:string,gName?:string,size?:"sm"|"md"|"lg",color?:string,locs?:number}) => {
  const showParent = gName && gName !== name && gName.toLowerCase() !== name.toLowerCase();
  const fs = size==="sm"?11:size==="lg"?15:12;
  const fw = size==="sm"?500:size==="lg"?700:600;
  const pfs = size==="sm"?9:size==="lg"?11:10;
  return <div style={{minWidth:0,overflow:"hidden"}}>
    <div style={{fontSize:fs,fontWeight:fw,color:color||T.t1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</div>
    {showParent&&<div style={{fontSize:pfs,color:T.cyan,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginTop:1}}>↳ {gName}{locs&&locs>1?` · ${locs} locs`:""}</div>}
  </div>;
};
