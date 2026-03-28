"use client";
// @ts-nocheck

import { useState, useMemo, useRef, useEffect } from "react";
import { T } from "@/lib/tokens";
import { $$ } from "@/lib/format";
import { IconMap } from "@/components/primitives";

let WEEK_ROUTES: any = { routes: {}, unplaced: [] };
try { WEEK_ROUTES = require("@/data/week-routes.json"); } catch(e) {}

// ── Derive a 1-line mission for each stop ─────────────────────────
function missionLine(a: any): { text: string; color: string } {
  const gap = (a.py || 0) - (a.cy || 0);
  const q1gap = (a.q1_2025 || 0) - (a.q1_2026 || 0);

  // Gone dark — specific win-back
  if (a.flag && String(a.flag).includes("dark")) {
    return { text: `Win-back · was ${$$(a.q1_2025 || a.py || 0)} Q1 last year`, color: T.red };
  }
  // Explicit flag from route data
  if (a.flag && String(a.flag).trim()) {
    const cleaned = String(a.flag).replace(/^[⚠️🔴🟡✅\s]+/, "").trim();
    if (cleaned) return { text: cleaned, color: T.amber };
  }
  // Active but down — recovery
  if (q1gap > 500 && (a.q1_2026 || 0) > 0) {
    return { text: `Recover · ${$$(q1gap)} gap vs Q1 last year`, color: T.amber };
  }
  // Doc relationship — use intel if present
  if (a.doctor) {
    if (a.intel && String(a.intel).trim()) {
      const snippet = String(a.intel).trim().split(".")[0].slice(0, 60);
      return { text: `Meet Dr. ${a.doctor.replace(/^Dr\.\s*/i,"").split(" ")[0]} · ${snippet}`, color: T.cyan };
    }
    return { text: `Relationship visit · ${a.doctor}`, color: T.cyan };
  }
  // Has intel but no doctor
  if (a.intel && String(a.intel).trim()) {
    return { text: String(a.intel).trim().split(".")[0].slice(0, 70), color: T.t3 };
  }
  // visitNote from prior visit
  if (a.visitNote && String(a.visitNote).trim()) {
    return { text: `Follow-up · "${String(a.visitNote).trim().slice(0, 60)}"`, color: T.blue };
  }
  // Generic by vp
  if (a.vp === "NOW") return { text: `Priority stop · ${$$(a.py || 0)} PY spend`, color: T.red };
  if (a.vp === "SOON") return { text: `Pipeline · check in on buying plans`, color: T.amber };
  return { text: `Routine visit · ${a.city}`, color: T.t4 };
}

// ── Purpose icon ─────────────────────────────────────────────────
function purposeIcon(a: any): string {
  if (a.flag && String(a.flag).includes("dark")) return "🎯";
  if (a.flag && String(a.flag).trim()) return "⚠️";
  const q1gap = (a.q1_2025 || 0) - (a.q1_2026 || 0);
  if (q1gap > 500 && (a.q1_2026 || 0) > 0) return "📈";
  if (a.doctor) return "🤝";
  if (a.visitNote) return "📋";
  if (a.vp === "NOW") return "🔴";
  if (a.vp === "SOON") return "🟡";
  return "📍";
}

const HOME_BASE = "Thomaston, CT";

export default function MapTab({ scored = [], goAcct = null }: any) {
  const mapRef         = useRef(null);
  const mapInstanceRef = useRef(null);
  const onPinClickRef  = useRef<(a:any)=>void>(()=>{});
  const [selDay, setSelDay]   = useState<string|null>(null);
  const [selAcct, setSelAcct] = useState<any>(null);
  const [showList, setShowList] = useState(true);

  onPinClickRef.current = (a) => setSelAcct(a);

  const days = Object.keys(WEEK_ROUTES.routes || {});

  const displayed = useMemo(() =>
    selDay
      ? (WEEK_ROUTES.routes[selDay] || []).map((a:any) => ({...a, day: selDay}))
      : days.flatMap(d => (WEEK_ROUTES.routes[d] || []).map((a:any) => ({...a, day: d})))
  , [selDay]);

  // Day-level summary
  const daySummary = useMemo(() => {
    const result: Record<string, {gap:number, nowCount:number, count:number}> = {};
    for (const d of days) {
      const accts = WEEK_ROUTES.routes[d] || [];
      result[d] = {
        count: accts.length,
        nowCount: accts.filter((a:any) => a.vp === "NOW").length,
        gap: accts.reduce((s:number, a:any) => s + Math.max(0, (a.q1_2025 || 0) - (a.q1_2026 || 0)), 0),
      };
    }
    return result;
  }, []);

  const vpColor = (vp: string) => {
    if (vp === "NOW")  return T.red;
    if (vp === "SOON") return T.amber;
    return T.green;
  };

  const openGoogleMaps = (accts: any[]) => {
    const withGps = accts.filter(a => a.lat && a.lng);
    if (!withGps.length) return;
    const addrOf = (a:any) => {
      const addr = (a.address || "").trim();
      if (addr && /^\d/.test(addr)) return addr;
      return `${a.city || ""}, ${a.state || "CT"}`;
    };
    if (withGps.length === 1) {
      window.open(`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(HOME_BASE)}&destination=${encodeURIComponent(addrOf(withGps[0]))}&travelmode=driving`, "_blank");
      return;
    }
    const dest = encodeURIComponent(addrOf(withGps[withGps.length - 1]));
    const wp   = withGps.slice(0, -1).map((a:any) => encodeURIComponent(addrOf(a))).join("|");
    window.open(`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(HOME_BASE)}&destination=${dest}&waypoints=${wp}&travelmode=driving`, "_blank");
  };

  // Map rebuilds only on selDay change
  useEffect(() => {
    if (!mapRef.current) return;
    if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
    const pts = displayed.filter((a:any) => a.lat && a.lng);
    if (!pts.length) return;

    const loadLeaflet = () => new Promise<void>((res) => {
      if ((window as any).L) { res(); return; }
      const css = document.createElement("link");
      css.rel = "stylesheet"; css.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
      document.head.appendChild(css);
      const js = document.createElement("script");
      js.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
      js.onload = () => res();
      document.head.appendChild(js);
    });

    loadLeaflet().then(() => {
      const L = (window as any).L;
      if (!mapRef.current || mapInstanceRef.current) return;
      const avgLat = pts.reduce((s:number, a:any) => s + a.lat, 0) / pts.length;
      const avgLng = pts.reduce((s:number, a:any) => s + a.lng, 0) / pts.length;
      const map = L.map(mapRef.current, { zoomControl: true }).setView([avgLat, avgLng], 10);
      mapInstanceRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap", maxZoom: 18,
      }).addTo(map);
      if (selDay) {
        L.polyline(pts.map((a:any) => [a.lat, a.lng]), { color: "rgba(79,142,247,.5)", weight: 2, dashArray: "6,4" }).addTo(map);
      }
      pts.forEach((a:any, i:number) => {
        const col = vpColor(a.vp || "");
        const icon = L.divIcon({
          className: "",
          html: `<div style="width:28px;height:28px;border-radius:50%;background:${T.s1};border:2.5px solid ${col};display:flex;align-items:center;justify-content:center;font-family:monospace;font-size:10px;font-weight:800;color:${col};box-shadow:0 2px 8px rgba(0,0,0,.5);cursor:pointer">${selDay ? i + 1 : ""}</div>`,
          iconSize: [28, 28], iconAnchor: [14, 14],
        });
        L.marker([a.lat, a.lng], { icon }).addTo(map).on("click", () => onPinClickRef.current(a));
      });
      if (pts.length > 1) map.fitBounds(L.latLngBounds(pts.map((a:any) => [a.lat, a.lng])), { padding: [24, 24] });
    });

    return () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; } };
  }, [selDay]);

  const dayColors = ["#4f8ef7", "#22d3ee", "#34d399", "#fbbf24", "#a78bfa"];

  // Match a route stop to a scored account for deep navigation
  const findScored = (a: any) =>
    scored.find((s: any) => s.name?.toLowerCase() === a.name?.toLowerCase()) ||
    scored.find((s: any) => s.city?.toLowerCase() === a.city?.toLowerCase() && Math.abs((s.pyQ?.["1"] || 0) - (a.py || 0)) < 50);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 112px)", position: "relative" }}>

      {/* ── DAY PILLS ── */}
      <div style={{ padding: "10px 16px 0", flexShrink: 0 }}>
        <div className="hide-sb" style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8 }}>
          <button onClick={() => { setSelDay(null); setSelAcct(null); }}
            style={{ flexShrink: 0, padding: "5px 14px", borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer",
              border: `1px solid ${!selDay ? "rgba(79,142,247,.3)" : T.b2}`,
              background: !selDay ? "rgba(79,142,247,.12)" : T.s2,
              color: !selDay ? T.blue : T.t3, fontFamily: "inherit" }}>
            All Days
          </button>
          {days.map((d, i) => {
            const col = dayColors[i % dayColors.length];
            const sum = daySummary[d];
            return (
              <button key={d} onClick={() => { setSelDay(d === selDay ? null : d); setSelAcct(null); }}
                style={{ flexShrink: 0, padding: "5px 14px", borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer",
                  border: `1px solid ${selDay === d ? col + "55" : T.b2}`,
                  background: selDay === d ? col + "18" : T.s2,
                  color: selDay === d ? col : T.t3, fontFamily: "inherit" }}>
                {d}
                <span style={{ opacity: .7, fontSize: 9 }}> ({sum.count})</span>
                {sum.nowCount > 0 && <span style={{ color: T.red, fontSize: 9, marginLeft: 3 }}>·{sum.nowCount}🔴</span>}
              </button>
            );
          })}
        </div>

        {/* Route button */}
        {selDay && (WEEK_ROUTES.routes[selDay] || []).filter((a:any) => a.lat).length > 0 && (
          <button onClick={() => openGoogleMaps(WEEK_ROUTES.routes[selDay] || [])}
            style={{ width: "100%", marginBottom: 8, padding: "8px 0", borderRadius: 10, border: "none",
              background: `linear-gradient(90deg,${T.blue},${T.cyan})`, color: "#fff",
              fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <IconMap c="#fff" /> Open {selDay} Route in Maps
          </button>
        )}
      </div>

      {/* ── MAP ── */}
      <div ref={mapRef} style={{ height: showList ? "40%" : "calc(100% - 120px)", minHeight: 180, background: T.s2, flexShrink: 0 }} />

      {/* ── STOP LIST WITH INTENT ── */}
      <div style={{ flex: 1, overflowY: "auto", borderTop: `1px solid ${T.b1}` }}>
        {/* List toggle header */}
        <button onClick={() => setShowList(!showList)}
          style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "8px 16px", background: T.s1, border: "none", cursor: "pointer", fontFamily: "inherit",
            borderBottom: showList ? `1px solid ${T.b2}` : "none" }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: T.t3 }}>
            {selDay ? `${selDay} — ${displayed.length} stops` : `All Stops — ${displayed.length}`}
            {selDay && daySummary[selDay]?.gap > 0 && (
              <span style={{ color: T.red, marginLeft: 8 }}>·  {$$(daySummary[selDay].gap)} gap</span>
            )}
          </span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.t4} strokeWidth="2.5"
            style={{ transform: showList ? "rotate(180deg)" : "none", transition: "transform .15s" }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {showList && (
          <div style={{ padding: "8px 12px" }}>
            {displayed.length === 0 && (
              <div style={{ padding: "20px 0", textAlign: "center", color: T.t4, fontSize: 12 }}>No stops for this day.</div>
            )}
            {displayed.map((a: any, i: number) => {
              const mission = missionLine(a);
              const icon    = purposeIcon(a);
              const q1gap   = Math.max(0, (a.q1_2025 || 0) - (a.q1_2026 || 0));
              const scored_acct = findScored(a);
              const isSelected  = selAcct?.name === a.name;
              return (
                <div key={`${a.name}-${i}`} className="anim"
                  style={{ animationDelay: `${i * 15}ms`, marginBottom: 7,
                    background: isSelected ? "rgba(79,142,247,.08)" : T.s1,
                    border: `1px solid ${isSelected ? "rgba(79,142,247,.3)" : T.b1}`,
                    borderLeft: `3px solid ${vpColor(a.vp || "")}`,
                    borderRadius: 11, overflow: "hidden" }}>

                  {/* Main row — tappable */}
                  <button onClick={() => {
                    setSelAcct(isSelected ? null : a);
                    if (scored_acct && goAcct) goAcct(scored_acct);
                  }} style={{ width: "100%", textAlign: "left", background: "none", border: "none",
                    padding: "9px 11px", cursor: "pointer", fontFamily: "inherit" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
                      {/* Stop number */}
                      {selDay && (
                        <span style={{ fontSize: 10, fontWeight: 800, color: T.t4, flexShrink: 0, marginTop: 1, minWidth: 14 }}>
                          {i + 1}
                        </span>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Name + vp badge */}
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: T.t1, overflow: "hidden",
                            textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</span>
                          <span style={{ flexShrink: 0, fontSize: 8, fontWeight: 700, color: vpColor(a.vp || ""),
                            background: vpColor(a.vp || "") + "18", borderRadius: 3, padding: "1px 5px" }}>
                            {a.vp || "—"}
                          </span>
                        </div>
                        {/* Mission line */}
                        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                          <span style={{ fontSize: 11 }}>{icon}</span>
                          <span style={{ fontSize: 10, color: mission.color, lineHeight: 1.4, flex: 1 }}>
                            {mission.text}
                          </span>
                        </div>
                        {/* City + doctor */}
                        <div style={{ fontSize: 9, color: T.t4 }}>
                          {a.city}{a.state ? `, ${a.state}` : ""}
                          {a.doctor && <span style={{ color: T.t4 }}> · {a.doctor}</span>}
                          {!selDay && a.day && <span style={{ color: T.t4 }}> · {a.day}</span>}
                        </div>
                      </div>
                      {/* Gap */}
                      {q1gap > 0 && (
                        <div style={{ flexShrink: 0, textAlign: "right" }}>
                          <div className="m" style={{ fontSize: 12, fontWeight: 700, color: T.red }}>{$$(q1gap)}</div>
                          <div style={{ fontSize: 8, color: T.t4 }}>gap</div>
                        </div>
                      )}
                    </div>
                  </button>

                  {/* Expanded detail — phone + nav + account link */}
                  {isSelected && (
                    <div style={{ padding: "0 11px 9px 11px", display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {a.phone && (
                        <a href={`tel:${a.phone}`}
                          style={{ padding: "5px 12px", borderRadius: 7, background: T.s2, border: `1px solid ${T.b1}`,
                            fontSize: 10, fontWeight: 600, color: T.t1, textDecoration: "none" }}>
                          📞 {a.phone}
                        </a>
                      )}
                      {a.lat && a.lng && (
                        <a href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(HOME_BASE)}&destination=${encodeURIComponent(a.address && /^\d/.test(a.address) ? a.address : `${a.city}, ${a.state || "CT"}`)}&travelmode=driving`}
                          target="_blank" rel="noreferrer"
                          style={{ padding: "5px 12px", borderRadius: 7, border: "none",
                            background: `linear-gradient(90deg,${T.blue},${T.cyan})`,
                            fontSize: 10, fontWeight: 700, color: "#fff", textDecoration: "none" }}>
                          Navigate →
                        </a>
                      )}
                      {scored_acct && goAcct && (
                        <button onClick={() => goAcct(scored_acct)}
                          style={{ padding: "5px 12px", borderRadius: 7, background: "rgba(167,139,250,.1)",
                            border: "1px solid rgba(167,139,250,.25)", fontSize: 10, fontWeight: 700,
                            color: T.purple, cursor: "pointer", fontFamily: "inherit" }}>
                          Account →
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Unplaced accounts */}
            {!selDay && (WEEK_ROUTES.unplaced || []).length > 0 && (
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${T.b2}` }}>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px",
                  color: T.t4, marginBottom: 7 }}>No GPS — call instead ({WEEK_ROUTES.unplaced.length})</div>
                {(WEEK_ROUTES.unplaced || []).map((a: any, i: number) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "7px 10px", background: T.s1, borderRadius: 8, marginBottom: 5,
                    border: `1px solid ${T.b1}` }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: T.t2 }}>{a.name}</div>
                      <div style={{ fontSize: 9, color: T.t4 }}>{a.city}{a.state ? `, ${a.state}` : ""} · {$$(a.py || 0)} PY</div>
                    </div>
                    {a.phone && (
                      <a href={`tel:${a.phone}`}
                        style={{ padding: "4px 10px", borderRadius: 6, background: T.s2, border: `1px solid ${T.b1}`,
                          fontSize: 10, color: T.t1, textDecoration: "none", fontWeight: 600, flexShrink: 0, marginLeft: 8 }}>
                        Call
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── LEGEND ── */}
      <div style={{ padding: "5px 16px", flexShrink: 0, display: "flex", gap: 12, alignItems: "center",
        borderTop: `1px solid ${T.b1}`, background: T.s1 }}>
        {[["NOW", T.red], ["SOON", T.amber], ["ON TRACK", T.green]].map(([l, c]) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: c }} />
            <span style={{ fontSize: 9, color: T.t4 }}>{l}</span>
          </div>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 9, color: T.t4 }}>
          {displayed.filter((a:any) => a.lat).length} mapped · {displayed.filter((a:any) => !a.lat).length} no GPS
        </span>
      </div>
    </div>
  );
}
