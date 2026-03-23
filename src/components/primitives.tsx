"use client";
// @ts-nocheck

import { T } from "@/lib/tokens";

let PARENT_NAMES: Record<string, string> = {};
try { PARENT_NAMES = require("@/data/parent-names.json"); } catch(e) {}

// ─── ICONS ───────────────────────────────────────────────────────
export const Chev = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{opacity:.4,flexShrink:0}}><path d="M9 18l6-6-6-6"/></svg>;
export const IconMap = ({c}:{c:string}) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>;

// ─── DISPLAY NAME FIXER ──────────────────────────────────────────
const BAD_GROUP_NAMES = new Set(["STANDARD","Standard","HOUSE ACCOUNTS","House Accounts","SILVER","GOLD","PLATINUM","DIAMOND","TOP 100","Silver","Gold","Platinum","Diamond","Top 100",""]);
const cleanParentName = (name) => {
  if (!name) return "";
  return name.replace(/\s*:\s*Master-CM\d+$/i, "").trim();
};
export const fixGroupName = (g) => {
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
export const Pill = ({l,v,c}) => <div><span style={{fontSize:9,textTransform:"uppercase",color:T.t3}}>{l} </span><span className="m" style={{fontSize:12,fontWeight:700,color:c}}>{v}</span></div>;
export const Stat = ({l,v,c}) => <div style={{background:T.s2,borderRadius:8,padding:"8px 10px",textAlign:"center"}}><div style={{fontSize:9,textTransform:"uppercase",color:T.t3,marginBottom:2}}>{l}</div><div className="m" style={{fontSize:14,fontWeight:700,color:c}}>{v}</div></div>;
export const Bar = ({pct, color}) => <div style={{width:"100%",height:6,borderRadius:3,background:T.s3,overflow:"hidden"}}><div className="bar-g" style={{height:"100%",borderRadius:3,width:`${Math.min(Math.max(pct,0),100)}%`,background:color||`linear-gradient(90deg,${T.blue},${T.cyan})`}}/></div>;

// ─── SHARED ACCOUNT IDENTITY ─────────────────────────────────────
export const AccountId = ({name, gName, size="md", color}:{name:string, gName?:string, size?:"sm"|"md"|"lg", color?:string}) => {
  const showParent = gName && gName !== name && gName.toLowerCase() !== name.toLowerCase();
  const fs = size==="sm"?11:size==="lg"?15:12;
  const fw = size==="sm"?500:size==="lg"?700:600;
  const pfs = size==="sm"?9:size==="lg"?11:10;
  return <div style={{minWidth:0,overflow:"hidden"}}>
    <div style={{fontSize:fs,fontWeight:fw,color:color||T.t1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</div>
    {showParent&&<div style={{fontSize:pfs,color:T.cyan,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginTop:1}}>↳ {gName}</div>}
  </div>;
};
