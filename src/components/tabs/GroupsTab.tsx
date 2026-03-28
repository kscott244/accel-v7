"use client";
// @ts-nocheck

import { useState, useMemo } from "react";
import { T } from "@/lib/tokens";
import { getTierLabel } from "@/lib/tier";
import { $$, pc } from "@/lib/format";
import { fixGroupName, Pill, Bar, Chev } from "@/components/primitives";
import { scorePriority } from "@/lib/priority";

// ── Row 1: Account type ───────────────────────────────────────────
// DSO          = class2 "DSO" (Kerr-designated: Aspen, Dental 365, 42 North, etc.)
// Emerging DSO  = class2 "EMERGING DSO" (Select Dental, ProHealth, etc.)
// Mid-Market    = class2 "STANDARD" with 2+ locs (multi-loc private practices)
// Private       = 1 location
const TYPE_FILTERS = ["All", "DSO", "Emerging DSO", "Mid-Market", "Private"];

// ── Row 2: Sort / view mode ───────────────────────────────────────
const VIEW_MODES = [
  { k: "all",         l: "All" },
  { k: "urgent",      l: "Urgent" },
  { k: "top-spend",   l: "Top Spend" },
  { k: "growing",     l: "Growing" },
  { k: "win-back",    l: "Win Back" },
  { k: "new-product", l: "New Product" },
];

// ── Color system ──────────────────────────────────────────────────
const GROUP_ACCENT  = T.cyan;    // multi-location (DSO + Mid-Market)
const SINGLE_ACCENT = T.purple;  // single office (Private)

// ── Helpers ───────────────────────────────────────────────────────
function getAccent(locs: number) {
  return locs >= 2 ? GROUP_ACCENT : SINGLE_ACCENT;
}

// New Product: has a CY product that had $0 PY (brand new this year)
function hasNewProduct(g: any): boolean {
  const children = g.children || [];
  for (const c of children) {
    const prods = c.products || [];
    for (const p of prods) {
      const cyVal = p.cyQ?.["1"] || p.cy || 0;
      const pyVal = p.pyQ?.["1"] || p.py || 0;
      if (cyVal > 200 && pyVal === 0) return true;
    }
  }
  return false;
}

// Win Back: had meaningful PY spend, CY near zero
function isWinBack(g: any): boolean {
  return (g._py1 || 0) > 500 && (g._cy1 || 0) < 100;
}

// ── ACCOUNT CARD ──────────────────────────────────────────────────
function AccountCard({ g, i, goGroup }) {
  const locs     = g._locs ?? g.locs ?? 1;
  const accent   = getAccent(locs);
  const retPct   = Math.min(100, Math.round((g._ret ?? 1) * 100));
  const retColor = g._ret >= 0.7 ? T.green : g._ret >= 0.4 ? T.amber : T.red;
  const isGroup  = locs >= 2;

  const subtitle = g._priorityReason
    ? g._priorityReason
    : `${locs} loc${locs !== 1 ? "s" : ""} · ${getTierLabel(g.tier, g.class2)}`;

  // Address line: single-loc → "addr, city ST zip"; multi-loc → "City1, City2, …"
  const addrLine = (() => {
    if (!isGroup) {
      const parts = [];
      if (g.addr || g.address) parts.push(g.addr || g.address);
      const cityState = [g.city, g.st].filter(Boolean).join(", ");
      if (cityState) parts.push(cityState);
      if (g.zip) parts.push(g.zip);
      return parts.join(", ");
    }
    const cities = [...new Set(
      (g.children || []).map((c: any) => c.city).filter(Boolean)
    )].slice(0, 3).join(", ");
    return cities || ([g.city, g.st].filter(Boolean).join(", "));
  })();

  return (
    <button className="anim" onClick={() => goGroup(g)}
      style={{
        animationDelay: `${i * 12}ms`,
        width: "100%", textAlign: "left",
        background: T.s1, borderRadius: 14, padding: "12px 14px", marginBottom: 7,
        cursor: "pointer",
        border: `1px solid ${accent}22`,
        borderLeft: `3px solid ${accent}`,
      }}>

      {/* Row 1: name + gap */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 5 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {fixGroupName(g)}
            </div>
            {isGroup && (
              <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 700, color: accent,
                background: `${accent}18`, borderRadius: 4, padding: "1px 5px",
                border: `1px solid ${accent}33` }}>
                {locs} locs
              </span>
            )}
          </div>
          <div style={{ fontSize: 10, color: T.t3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {subtitle}
          </div>
          {addrLine && (
            <div style={{ fontSize: 9, color: T.t4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>
              📍 {addrLine}
            </div>
          )}
        </div>
        <div style={{ flexShrink: 0, marginLeft: 12, textAlign: "right" }}>
          <div className="m" style={{ fontSize: 13, fontWeight: 700, color: g._gap <= 0 ? T.green : T.red }}>
            {g._gap <= 0 ? `+${$$(Math.abs(g._gap))}` : `-${$$(g._gap)}`}
          </div>
          <div style={{ fontSize: 10, color: retColor, fontWeight: 600, marginTop: 1 }}>{retPct}% ret</div>
        </div>
      </div>

      {/* Retention bar */}
      <Bar pct={retPct} color={`linear-gradient(90deg,${retColor},${retColor}99)`} />

      {/* PY / CY */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 7 }}>
        <Pill l="PY" v={$$(g._py1)} c={T.t2} />
        <Pill l="CY" v={$$(g._cy1)} c={T.blue} />
        {/* Win Back tag */}
        {isWinBack(g) && (
          <span style={{ fontSize: 9, fontWeight: 700, color: T.amber,
            background: "rgba(251,191,36,.1)", borderRadius: 4, padding: "1px 6px",
            border: "1px solid rgba(251,191,36,.25)" }}>WIN BACK</span>
        )}
        {/* New Product tag */}
        {hasNewProduct(g) && (
          <span style={{ fontSize: 9, fontWeight: 700, color: T.green,
            background: "rgba(52,211,153,.1)", borderRadius: 4, padding: "1px 6px",
            border: "1px solid rgba(52,211,153,.25)" }}>NEW PROD</span>
        )}
        <Chev />
      </div>
    </button>
  );
}

// ── SECTION LABEL ─────────────────────────────────────────────────
const SectionLabel = ({ label, color, count = null }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10, marginTop: 4 }}>
    <div style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0 }} />
    <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.2px", color }}>{label}</span>
    {count != null && <span style={{ fontSize: 10, color: T.t4, marginLeft: "auto" }}>{count}</span>}
  </div>
);

// ── LEGEND ────────────────────────────────────────────────────────
const Legend = () => (
  <div style={{ display: "flex", gap: 12, padding: "0 16px", marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <div style={{ width: 3, height: 12, borderRadius: 2, background: GROUP_ACCENT }} />
      <span style={{ fontSize: 9, color: T.t4, fontWeight: 600 }}>MULTI-LOC</span>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <div style={{ width: 3, height: 12, borderRadius: 2, background: SINGLE_ACCENT }} />
      <span style={{ fontSize: 9, color: T.t4, fontWeight: 600 }}>SINGLE</span>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
      <span style={{ fontSize: 9, color: T.green, fontWeight: 600 }}>+$ ahead</span>
      <span style={{ fontSize: 9, color: T.red, fontWeight: 600 }}>-$ gap</span>
    </div>
  </div>
);

// ── MAIN COMPONENT ────────────────────────────────────────────────
export default function GroupsTab({ groups, goGroup, filt, setFilt, search, setSearch, groupedPrivates = [] }) {
  // filt is now the TYPE filter (Row 1). View mode is local state.
  const [view, setView] = useState("all");

  // Normalise incoming filt to our new type keys
  // (AccelerateApp passes filt/setFilt from parent state — we reuse for type)
  const typeFilt = ["DSO", "Emerging DSO", "Mid-Market", "Private"].includes(filt) ? filt : "All";
  const setType  = (t: string) => { setFilt(t === "All" ? "All" : t); setView("all"); };

  const enriched = useMemo(() => groups
    .filter(g => {
      // Hide groups with zero PY and zero CY unless user is actively searching
      if (search) return true;
      const py = g.pyQ?.["1"] || 0;
      const cy = g.cyQ?.["1"] || 0;
      // Also sum all quarters in case Q1 is 0 but others aren't
      const pyTotal = Object.values(g.pyQ || {}).reduce((s: any, v: any) => s + v, 0);
      const cyTotal = Object.values(g.cyQ || {}).reduce((s: any, v: any) => s + v, 0);
      return pyTotal > 0 || cyTotal > 0;
    })
    .map(g => {
    const py1 = g.pyQ?.["1"] || 0;
    const cy1 = g.cyQ?.["1"] || 0;
    const gap = py1 - cy1;
    const ret = py1 > 0 ? cy1 / py1 : 1;
    const locs = g.locs ?? 1;
    const base = { ...g, _py1: py1, _cy1: cy1, _gap: gap, _ret: ret, _locs: locs };
    const p = scorePriority(base, "1");
    return {
      ...base,
      _priorityScore: p.priorityScore,
      _priorityBucket: p.priorityBucket,
      _priorityReason: p.priorityReason,
      _isDSO:      g.class2 === "DSO",
      _isEmerging: g.class2 === "EMERGING DSO",
      _isMid:      (g.class2 !== "DSO" && g.class2 !== "EMERGING DSO") && locs > 1,
      _isPrivate: locs <= 1,
    };
  }), [groups, search]);

  // ── Step 1: apply TYPE filter ─────────────────────────────────
  const byType = useMemo(() => {
    let l = [...enriched];
    if (search) {
      const q = search.toLowerCase();
      l = l.filter(g =>
        fixGroupName(g).toLowerCase().includes(q) ||
        g.name.toLowerCase().includes(q) ||
        g.children?.some((c: any) =>
          c.name?.toLowerCase().includes(q) ||
          c.addr?.toLowerCase().includes(q) ||
          c.address?.toLowerCase().includes(q) ||
          c.city?.toLowerCase().includes(q) ||
          c.zip?.toLowerCase().includes(q)
        )
      );
    }
    if (typeFilt === "DSO")               l = l.filter(g => g._isDSO);
    else if (typeFilt === "Emerging DSO") l = l.filter(g => g._isEmerging);
    else if (typeFilt === "Mid-Market")   l = l.filter(g => g._isMid);
    else if (typeFilt === "Private")      l = l.filter(g => g._isPrivate);
    return l;
  }, [enriched, typeFilt, search]);

  // ── Step 2: apply VIEW mode ───────────────────────────────────
  const list = useMemo(() => {
    let l = [...byType];
    if (view === "urgent") {
      l = l.filter(g => g._gap > 1500 && g._ret < 0.4);
      l.sort((a, b) => b._gap - a._gap);
    } else if (view === "top-spend") {
      l.sort((a, b) => b._py1 - a._py1);
    } else if (view === "growing") {
      l = l.filter(g => g._cy1 > g._py1 && g._py1 > 0);
      l.sort((a, b) => (b._cy1 - b._py1) - (a._cy1 - a._py1));
    } else if (view === "win-back") {
      l = l.filter(g => isWinBack(g));
      l.sort((a, b) => b._py1 - a._py1);
    } else if (view === "new-product") {
      l = l.filter(g => hasNewProduct(g));
      l.sort((a, b) => b._cy1 - a._cy1);
    } else {
      // "all" — sort by priority score
      l.sort((a, b) => b._priorityScore - a._priorityScore);
    }
    return l;
  }, [byType, view]);

  // Status line
  const statusLine = useMemo(() => {
    const typeLabel = typeFilt === "All" ? "All accounts" : typeFilt;
    const viewLabel = VIEW_MODES.find(v => v.k === view)?.l || "All";
    const extra =
      view === "urgent"      ? `${list.length} need attention` :
      view === "top-spend"   ? `ranked by PY spend` :
      view === "growing"     ? `${list.length} ahead of last year` :
      view === "win-back"    ? `${list.length} stopped buying` :
      view === "new-product" ? `${list.length} with new products this year` :
      `${list.length} accounts`;
    return `${typeLabel} · ${viewLabel} · ${extra}`;
  }, [list.length, typeFilt, view]);

  return (
    <div style={{ padding: "0 0 80px" }}>

      {/* ── SEARCH ── */}
      <div style={{ position: "relative", margin: "16px 16px 10px" }}>
        <svg style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
          width: 14, height: 14, color: T.t4, pointerEvents: "none" }}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input type="search" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search accounts…"
          style={{
            width: "100%", height: 42, borderRadius: 12,
            border: `1px solid ${search ? T.blue + "44" : T.b1}`,
            background: T.s1, color: T.t1, fontSize: 13,
            paddingLeft: 36, paddingRight: search ? 34 : 12,
            outline: "none", fontFamily: "inherit", boxSizing: "border-box"
          }} />
        {search && (
          <button onClick={() => setSearch("")}
            style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", color: T.t4, cursor: "pointer", fontSize: 16, lineHeight: 1 }}>✕</button>
        )}
      </div>

      {/* ── ROW 1: Account Type ── */}
      <div style={{ padding: "0 16px 2px", marginBottom: 2 }}>
        <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: T.t4, marginBottom: 5 }}>
          Account Type
        </div>
        <div className="hide-sb" style={{ display: "flex", gap: 5, overflowX: "auto" }}>
          {TYPE_FILTERS.map(t => (
            <button key={t} onClick={() => setType(t)}
              style={{
                flexShrink: 0, whiteSpace: "nowrap", padding: "5px 14px", borderRadius: 7,
                fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                border: `1px solid ${typeFilt === t ? "rgba(79,142,247,.35)" : T.b2}`,
                background: typeFilt === t ? "rgba(79,142,247,.15)" : T.s2,
                color: typeFilt === t ? T.blue : T.t3,
              }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ── ROW 2: View Mode ── */}
      <div style={{ padding: "8px 16px 2px", marginBottom: 8 }}>
        <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: T.t4, marginBottom: 5 }}>
          Show Me
        </div>
        <div className="hide-sb" style={{ display: "flex", gap: 5, overflowX: "auto" }}>
          {VIEW_MODES.map(m => {
            // Each view mode gets its own accent color when selected
            const activeColors: Record<string, string> = {
              all:         T.blue,
              urgent:      T.red,
              "top-spend": T.amber,
              growing:     T.green,
              "win-back":  T.orange,
              "new-product": T.cyan,
            };
            const ac = activeColors[m.k] || T.blue;
            const isActive = view === m.k;
            return (
              <button key={m.k} onClick={() => setView(m.k)}
                style={{
                  flexShrink: 0, whiteSpace: "nowrap", padding: "5px 14px", borderRadius: 7,
                  fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                  border: `1px solid ${isActive ? ac + "55" : T.b2}`,
                  background: isActive ? ac + "18" : T.s2,
                  color: isActive ? ac : T.t3,
                }}>
                {m.l}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── LEGEND ── */}
      <Legend />

      {/* ── STATUS LINE ── */}
      <div style={{ padding: "0 16px", marginBottom: 12, fontSize: 10, color: T.t4 }}>
        {statusLine}
      </div>

      {/* ── LIST ── */}
      <div style={{ padding: "0 16px" }}>
        {list.length === 0 ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: T.t4, fontSize: 12 }}>
            No accounts match this filter.
          </div>
        ) : (
          list.map((g, i) => <AccountCard key={g.id} g={g} i={i} goGroup={goGroup} />)
        )}
      </div>
    </div>
  );
}

