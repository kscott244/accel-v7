"use client";
// @ts-nocheck

import { useState, useMemo } from "react";
import { T } from "@/lib/tokens";
import { getTierLabel } from "@/lib/tier";
import { $$, pc } from "@/lib/format";
import { fixGroupName, Chev } from "@/components/primitives";
import { scorePriority, BUCKET_STYLE } from "@/lib/priority";

// ── Account type classification ───────────────────────────────────
const TYPE_FILTERS = ["All", "DSO", "Mid-Market", "Private"];

// ── View / sort modes ─────────────────────────────────────────────
const VIEW_MODES = [
  { k: "priority",   l: "Priority",  color: T.blue  },
  { k: "growing",    l: "Growing",   color: T.green },
  { k: "win-back",   l: "Win-Back",  color: T.orange},
  { k: "strategic",  l: "Strategic", color: T.purple},
  { k: "cleanup",    l: "Cleanup",   color: T.t4    },
];

// ── Accent: cyan = multi-loc, purple = single ─────────────────────
const accent = (locs: number) => locs >= 2 ? T.cyan : T.purple;

// ── Helpers ───────────────────────────────────────────────────────
function hasNewProduct(g: any): boolean {
  for (const c of (g.children || [])) {
    for (const p of (c.products || [])) {
      if ((p.cyQ?.["1"] || p.cy || 0) > 200 && (p.pyQ?.["1"] || p.py || 0) === 0) return true;
    }
  }
  return false;
}
function isWinBack(g: any): boolean {
  return (g._py1 || 0) > 500 && (g._cy1 || 0) < 100;
}
function isStrategic(g: any): boolean {
  // High-value accounts tracking well — proactive focus pays off
  return (g._py1 || 0) >= 5000 && (g._ret || 0) >= 0.7;
}
function isCleanup(g: any): boolean {
  // Stubs / orphans / zero-activity groups that need a data review
  return (g._py1 || 0) < 100 && (g._cy1 || 0) < 100;
}

// ── Compact account card ──────────────────────────────────────────
function AccountCard({ g, i, goGroup }: any) {
  const locs    = g._locs ?? g.locs ?? 1;
  const ac      = accent(locs);
  const bStyle  = BUCKET_STYLE[g._priorityBucket ?? "Watch"];
  const gapPos  = (g._gap || 0) > 0;           // true = behind PY
  const retPct  = Math.min(100, Math.round((g._ret ?? 1) * 100));
  const retColor = g._ret >= 0.7 ? T.green : g._ret >= 0.4 ? T.amber : T.red;

  return (
    <button className="anim" onClick={() => goGroup(g)}
      style={{
        animationDelay: `${Math.min(i, 30) * 10}ms`,
        width: "100%", textAlign: "left",
        background: T.s1, borderRadius: 12, padding: "10px 12px", marginBottom: 6,
        cursor: "pointer",
        border: `1px solid ${ac}22`,
        borderLeft: `3px solid ${ac}`,
        display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
      }}>

      {/* Left: name + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Row 1: name + locs badge + bucket tag */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: T.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "60vw" }}>
            {fixGroupName(g)}
          </span>
          {locs >= 2 && (
            <span style={{ flexShrink: 0, fontSize: 8, fontWeight: 700, color: ac,
              background: `${ac}18`, borderRadius: 3, padding: "1px 5px",
              border: `1px solid ${ac}30` }}>
              {locs}
            </span>
          )}
          <span style={{ flexShrink: 0, fontSize: 8, fontWeight: 700, color: bStyle.color,
            background: bStyle.bg, borderRadius: 3, padding: "1px 5px",
            border: `1px solid ${bStyle.border}` }}>
            {g._priorityBucket ?? "Watch"}
          </span>
        </div>
        {/* Row 2: PY · CY · ret · reason */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 9, color: T.t4 }}>PY <span className="m" style={{ color: T.t3, fontWeight: 600 }}>{$$(g._py1)}</span></span>
          <span style={{ fontSize: 9, color: T.t4 }}>CY <span className="m" style={{ color: T.blue, fontWeight: 600 }}>{$$(g._cy1)}</span></span>
          <span style={{ fontSize: 9, fontWeight: 600, color: retColor }}>{retPct}%</span>
          {g._priorityReason && (
            <span style={{ fontSize: 9, color: T.t4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "40vw" }}>
              {g._priorityReason}
            </span>
          )}
        </div>
      </div>

      {/* Right: gap + chevron */}
      <div style={{ flexShrink: 0, textAlign: "right", display: "flex", alignItems: "center", gap: 6 }}>
        <div>
          <div className="m" style={{ fontSize: 12, fontWeight: 700, color: gapPos ? T.red : T.green }}>
            {gapPos ? `-${$$(g._gap)}` : `+${$$(Math.abs(g._gap))}`}
          </div>
        </div>
        <Chev />
      </div>
    </button>
  );
}

// ── Territory snapshot ────────────────────────────────────────────
function Snapshot({ enriched, setView }: any) {
  const atRisk   = enriched.filter((g: any) => g._gap > 1500 && g._ret < 0.5).length;
  const growing  = enriched.filter((g: any) => g._cy1 > g._py1 && g._py1 > 0).length;
  const winBack  = enriched.filter((g: any) => isWinBack(g)).length;
  const totalGap = enriched.reduce((s: number, g: any) => s + Math.max(0, g._gap), 0);

  const tiles = [
    { label: "Gap",      val: `-${$$(totalGap)}`, view: "priority", color: T.red    },
    { label: "At Risk",  val: `${atRisk}`,         view: "priority", color: T.amber  },
    { label: "Growing",  val: `${growing}`,         view: "growing",  color: T.green  },
    { label: "Win-Back", val: `${winBack}`,          view: "win-back", color: T.orange },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, padding: "0 16px", marginBottom: 10 }}>
      {tiles.map(t => (
        <button key={t.label} onClick={() => setView(t.view)}
          style={{ background: T.s1, border: `1px solid ${T.b1}`, borderRadius: 10,
            padding: "8px 6px", cursor: "pointer", textAlign: "center", fontFamily: "inherit" }}>
          <div className="m" style={{ fontSize: 13, fontWeight: 700, color: t.color }}>{t.val}</div>
          <div style={{ fontSize: 8, color: T.t4, marginTop: 2, textTransform: "uppercase", letterSpacing: ".5px" }}>{t.label}</div>
        </button>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────
export default function GroupsTab({ groups, goGroup, filt, setFilt, search, setSearch, groupedPrivates = [] }: any) {
  const [view, setView] = useState("priority");

  const typeFilt = ["DSO", "Emerging", "Mid-Market", "Private"].includes(filt) ? filt : "All";
  const setType  = (t: string) => { setFilt(t === "All" ? "All" : t); setView("priority"); };

  // ── Enrich all groups with scoring ───────────────────────────
  const enriched = useMemo(() => groups
    .filter((g: any) => {
      if (search) return true;
      const pyTotal = Object.values(g.pyQ || {}).reduce((s: any, v: any) => s + v, 0);
      const cyTotal = Object.values(g.cyQ || {}).reduce((s: any, v: any) => s + v, 0);
      return pyTotal > 0 || cyTotal > 0;
    })
    .map((g: any) => {
      const py1 = g.pyQ?.["1"] || 0;
      const cy1 = g.cyQ?.["1"] || 0;
      const gap = py1 - cy1;
      const ret = py1 > 0 ? cy1 / py1 : 1;
      const locs = g.locs ?? 1;
      const base = { ...g, _py1: py1, _cy1: cy1, _gap: gap, _ret: ret, _locs: locs };
      const p = scorePriority(base, "1");
      return {
        ...base,
        _priorityScore:  p.priorityScore,
        _priorityBucket: p.priorityBucket,
        _priorityReason: p.priorityReason,
        _isDSO:      g.class2 === "DSO" && locs >= 6,
        _isEmerging: g.class2 === "EMERGING DSO" || (g.class2 === "DSO" && locs < 6),
        _isMid:      (g.class2 !== "DSO" && g.class2 !== "EMERGING DSO") && locs > 1,
        _isPrivate:  locs <= 1,
      };
    }), [groups, search]);

  // ── Type filter ───────────────────────────────────────────────
  const byType = useMemo(() => {
    let l = [...enriched];
    if (search) {
      const q = search.toLowerCase();
      l = l.filter((g: any) =>
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
    if (typeFilt === "DSO")          l = l.filter((g: any) => g._isDSO);
    else if (typeFilt === "Mid-Market") l = l.filter((g: any) => g._isMid || g._isEmerging);
    else if (typeFilt === "Private")    l = l.filter((g: any) => g._isPrivate);
    return l;
  }, [enriched, typeFilt, search]);

  // ── View / sort ───────────────────────────────────────────────
  const list = useMemo(() => {
    let l = [...byType];
    if (view === "growing") {
      l = l.filter((g: any) => g._cy1 > g._py1 && g._py1 > 0);
      l.sort((a: any, b: any) => (b._cy1 - b._py1) - (a._cy1 - a._py1));
    } else if (view === "win-back") {
      l = l.filter((g: any) => isWinBack(g));
      l.sort((a: any, b: any) => b._py1 - a._py1);
    } else if (view === "strategic") {
      l = l.filter((g: any) => isStrategic(g));
      l.sort((a: any, b: any) => b._py1 - a._py1);
    } else if (view === "cleanup") {
      l = l.filter((g: any) => isCleanup(g));
      l.sort((a: any, b: any) => a._py1 - b._py1);
    } else {
      // priority — default: sort by score descending
      l.sort((a: any, b: any) => b._priorityScore - a._priorityScore);
    }
    return l;
  }, [byType, view]);

  const vm = VIEW_MODES.find(m => m.k === view) || VIEW_MODES[0];

  return (
    <div style={{ padding: "0 0 80px" }}>

      {/* ── SEARCH ── */}
      <div style={{ position: "relative", margin: "12px 16px 10px" }}>
        <svg style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)",
          width: 14, height: 14, color: T.t4, pointerEvents: "none" }}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input type="search" value={search} onChange={(e: any) => setSearch(e.target.value)}
          placeholder="Search accounts, cities, addresses…"
          style={{
            width: "100%", height: 40, borderRadius: 10,
            border: `1px solid ${search ? T.blue + "44" : T.b1}`,
            background: T.s1, color: T.t1, fontSize: 13,
            paddingLeft: 34, paddingRight: search ? 32 : 12,
            outline: "none", fontFamily: "inherit", boxSizing: "border-box",
          }} />
        {search && (
          <button onClick={() => setSearch("")}
            style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", color: T.t4, cursor: "pointer", fontSize: 15, lineHeight: 1 }}>✕</button>
        )}
      </div>

      {/* ── TERRITORY SNAPSHOT ── */}
      {!search && <Snapshot enriched={enriched} setView={setView} />}

      {/* ── TYPE PILLS ── */}
      <div className="hide-sb" style={{ display: "flex", gap: 5, overflowX: "auto", padding: "0 16px", marginBottom: 8 }}>
        {TYPE_FILTERS.map(t => (
          <button key={t} onClick={() => setType(t)}
            style={{
              flexShrink: 0, whiteSpace: "nowrap", padding: "5px 12px", borderRadius: 7,
              fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              border: `1px solid ${typeFilt === t ? "rgba(79,142,247,.35)" : T.b2}`,
              background: typeFilt === t ? "rgba(79,142,247,.15)" : T.s2,
              color: typeFilt === t ? T.blue : T.t3,
            }}>
            {t}
          </button>
        ))}
      </div>

      {/* ── VIEW MODE PILLS ── */}
      <div className="hide-sb" style={{ display: "flex", gap: 5, overflowX: "auto", padding: "0 16px", marginBottom: 10 }}>
        {VIEW_MODES.map(m => {
          const isActive = view === m.k;
          return (
            <button key={m.k} onClick={() => setView(m.k)}
              style={{
                flexShrink: 0, whiteSpace: "nowrap", padding: "5px 12px", borderRadius: 7,
                fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                border: `1px solid ${isActive ? m.color + "55" : T.b2}`,
                background: isActive ? m.color + "18" : T.s2,
                color: isActive ? m.color : T.t3,
              }}>
              {m.l}
            </button>
          );
        })}
      </div>

      {/* ── STATUS LINE ── */}
      <div style={{ padding: "0 16px", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 10, color: T.t4 }}>
          <span style={{ color: vm.color, fontWeight: 700 }}>{vm.l}</span>
          {typeFilt !== "All" && <span> · {typeFilt}</span>}
          {search && <span> · "{search}"</span>}
        </span>
        <span style={{ fontSize: 10, color: T.t4 }}>{list.length} group{list.length !== 1 ? "s" : ""}</span>
      </div>

      {/* ── GROUP LIST ── */}
      <div style={{ padding: "0 16px" }}>
        {view === "cleanup" && list.length > 0 && (
          <div style={{ marginBottom: 10, padding: "8px 12px", borderRadius: 9,
            background: "rgba(120,120,160,.06)", border: "1px solid rgba(120,120,160,.15)",
            fontSize: 10, color: T.t3, lineHeight: 1.5 }}>
            These groups have minimal or no sales data. Review to merge, delete, or keep as placeholders.
          </div>
        )}
        {view === "strategic" && list.length > 0 && (
          <div style={{ marginBottom: 10, padding: "8px 12px", borderRadius: 9,
            background: "rgba(167,139,250,.06)", border: "1px solid rgba(167,139,250,.15)",
            fontSize: 10, color: T.t3, lineHeight: 1.5 }}>
            High-value accounts tracking ≥70% of last year. Proactive visits here protect the most revenue.
          </div>
        )}
        {list.length === 0 ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: T.t4, fontSize: 12 }}>
            {view === "cleanup" ? "No stub groups found — territory data looks clean." :
             view === "strategic" ? "No high-value accounts at ≥70% retention right now." :
             "No accounts match this filter."}
          </div>
        ) : (
          list.map((g: any, i: number) => <AccountCard key={g.id} g={g} i={i} goGroup={goGroup} />)
        )}
      </div>
    </div>
  );
}
