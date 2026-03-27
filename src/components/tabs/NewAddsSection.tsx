"use client";
// @ts-nocheck
// ─── NEW ADDS SECTION ───────────────────────────────────────────────────────
// Shows accounts with new product purchases in Q1 2026.
// RED = needs follow-up, GREEN = on track. Sorted RED first, then by date.

import { T } from "@/lib/tokens";
import { AccountId, GroupBadge, Chev } from "@/components/primitives";
import NEW_ADDS from "@/../../docs/new_adds.json";

// Parse date like "12-Feb-26" → Date
function parseDate(s) {
  if (!s) return null;
  const months = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  const m = s.match(/^(\d+)-(\w+)-(\d+)$/);
  if (!m) return null;
  const day = parseInt(m[1]);
  const mon = months[m[2]];
  let yr = parseInt(m[3]);
  if (yr < 100) yr += 2000;
  return mon != null ? new Date(yr, mon, day) : null;
}

function formatDate(s) {
  const d = parseDate(s);
  if (!d) return s || "";
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatPhone(p) {
  if (!p) return "";
  const digits = p.replace(/\D/g, "");
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  return p;
}

export default function NewAddsSection({ groups, goAcct, goGroup }) {
  // Build lookup for group affiliation
  const childToGroup = {};
  (groups || []).forEach(g => {
    (g.children || []).forEach(c => {
      childToGroup[c.id] = { gId: g.id, gName: g.name, gLocs: (g.children || []).length, child: c };
    });
  });

  // Enrich new adds with group info
  const enriched = (NEW_ADDS || []).map(a => {
    const gi = childToGroup[a.mdm];
    return {
      ...a,
      gId: gi?.gId,
      gName: gi?.gName,
      gLocs: gi?.gLocs || 0,
      child: gi?.child,
      lastDate: parseDate(a.last_date),
    };
  });

  // Sort: RED first, then by last_date descending (most recent first)
  enriched.sort((a, b) => {
    if (a.color !== b.color) return a.color === "RED" ? -1 : 1;
    const da = a.lastDate?.getTime() || 0;
    const db = b.lastDate?.getTime() || 0;
    return db - da;
  });

  const redCount = enriched.filter(a => a.color === "RED").length;
  const greenCount = enriched.filter(a => a.color === "GREEN").length;

  return <div>
    {/* Header */}
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: T.t1, marginBottom: 4 }}>New Adds — Q1 2026</div>
      <div style={{ fontSize: 11, color: T.t3, marginBottom: 8 }}>
        {enriched.length} accounts with first-time product purchases.{" "}
        <span style={{ color: T.red, fontWeight: 600 }}>{redCount} need follow-up</span>
        {greenCount > 0 && <span style={{ color: T.green, fontWeight: 600 }}> · {greenCount} on track</span>}
      </div>
    </div>

    {/* Cards */}
    {enriched.map((a, i) => {
      const isRed = a.color === "RED";
      const addr = [a.addr, [a.city, a.state, a.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");

      return <button key={a.mdm} className="anim" onClick={() => {
        if (a.child) goAcct(a.child);
      }} style={{
        animationDelay: `${i * 15}ms`,
        width: "100%", textAlign: "left",
        background: T.s1,
        border: `1px solid ${isRed ? "rgba(248,113,113,.2)" : "rgba(52,211,153,.15)"}`,
        borderLeft: `3px solid ${isRed ? T.red : T.green}`,
        borderRadius: 12, padding: "12px 14px", marginBottom: 8, cursor: "pointer",
        fontFamily: "inherit",
      }}>
        {/* Row 1: Name + KPI badge */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, marginLeft: 8 }}>
            <span style={{
              fontSize: 9, fontWeight: 700,
              color: isRed ? T.red : T.green,
              background: isRed ? "rgba(248,113,113,.1)" : "rgba(52,211,153,.1)",
              border: `1px solid ${isRed ? "rgba(248,113,113,.25)" : "rgba(52,211,153,.25)"}`,
              borderRadius: 4, padding: "2px 6px",
            }}>{isRed ? "FOLLOW UP" : "ON TRACK"}</span>
            <Chev />
          </div>
        </div>

        {/* Row 2: Address */}
        {addr && <div style={{ fontSize: 10, color: T.t3, marginBottom: 4 }}>{addr}</div>}

        {/* Row 3: Products */}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
          {(a.products || []).map((p, j) => (
            <span key={j} style={{
              fontSize: 9, fontWeight: 600,
              color: T.blue, background: "rgba(79,142,247,.08)",
              border: "1px solid rgba(79,142,247,.15)",
              borderRadius: 4, padding: "2px 6px",
            }}>{p}</span>
          ))}
        </div>

        {/* Row 4: Dates + Contact */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 10, color: T.t4 }}>
            {formatDate(a.first_date)} → {formatDate(a.last_date)}
          </div>
          <div style={{ display: "flex", gap: 8, fontSize: 10 }}>
            {a.email && <span style={{ color: T.cyan, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 }}>{a.email}</span>}
            {a.phone && <span style={{ color: T.t4 }}>{formatPhone(a.phone)}</span>}
          </div>
        </div>

        {/* Row 5: Group badge */}
        {a.gLocs >= 3 && <div style={{ marginTop: 6 }}>
          <GroupBadge gName={a.gName} gId={a.gId} locs={a.gLocs} goGroup={(id) => {
            const g = (groups || []).find(g => g.id === id);
            if (g && goGroup) goGroup(g);
          }} />
        </div>}
      </button>;
    })}
  </div>;
}
