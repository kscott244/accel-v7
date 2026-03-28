"use client";
// @ts-nocheck
// ─── NEW ADDS SECTION ───────────────────────────────────────────────────────
// Shows accounts with new product purchases in Q1 2026.
// RED = needs follow-up (pre-assigned in source data — Ken's judgment).
// GREEN = on track (repeat buyer confirming adoption).
// Sorted: RED first, then by last_date descending (most recent activity first).

import { T } from "@/lib/tokens";
import { GroupBadge, Chev, fixGroupName } from "@/components/primitives";
import NEW_ADDS from "@/../../docs/new_adds.json";

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const MONTHS = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };

function parseDate(s) {
  if (!s) return null;
  const m = s.match(/^(\d+)-(\w+)-(\d+)$/);
  if (!m) return null;
  const mon = MONTHS[m[2]];
  if (mon == null) return null;
  let yr = parseInt(m[3]);
  if (yr < 100) yr += 2000;
  return new Date(yr, mon, parseInt(m[1]));
}

function formatDate(s) {
  const d = parseDate(s);
  if (!d) return s || "";
  return `${d.getMonth()+1}/${d.getDate()}`;
}

function formatPhone(p) {
  if (!p) return "";
  const digits = (p || "").replace(/\D/g, "");
  if (digits.length === 10) return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
  return p;
}

// ─── KPI SUMMARY ─────────────────────────────────────────────────────────────

function KPISummary({ total, redCount, greenCount }) {
  const redPct = total > 0 ? Math.round(redCount / total * 100) : 0;
  const greenPct = total > 0 ? Math.round(greenCount / total * 100) : 0;
  return (
    <div style={{
      background: "rgba(10,10,15,.6)",
      border: `1px solid ${T.b2}`,
      borderRadius: 12,
      padding: "12px 14px",
      marginBottom: 14,
    }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
        <div style={{ fontSize:11, fontWeight:700, color:T.t1, textTransform:"uppercase", letterSpacing:"1px" }}>
          New Adds · Q1 2026
        </div>
        <div style={{ fontSize:10, color:T.t4 }}>{total} accounts</div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
        <div style={{
          background:"rgba(248,113,113,.08)", border:"1px solid rgba(248,113,113,.2)",
          borderRadius:8, padding:"8px 10px", textAlign:"center"
        }}>
          <div style={{ fontSize:22, fontWeight:800, color:T.red, lineHeight:1 }}>{redCount}</div>
          <div style={{ fontSize:9, fontWeight:700, color:"rgba(248,113,113,.7)", marginTop:2, textTransform:"uppercase", letterSpacing:".5px" }}>Need Follow-Up</div>
        </div>
        <div style={{
          background:"rgba(52,211,153,.06)", border:"1px solid rgba(52,211,153,.15)",
          borderRadius:8, padding:"8px 10px", textAlign:"center"
        }}>
          <div style={{ fontSize:22, fontWeight:800, color:T.green, lineHeight:1 }}>{greenCount}</div>
          <div style={{ fontSize:9, fontWeight:700, color:"rgba(52,211,153,.6)", marginTop:2, textTransform:"uppercase", letterSpacing:".5px" }}>On Track</div>
        </div>
      </div>
      <div>
        <div style={{ width:"100%", height:5, borderRadius:3, background:"rgba(248,113,113,.15)", overflow:"hidden" }}>
          <div style={{
            height:"100%", borderRadius:3,
            width:`${greenPct}%`,
            background:`linear-gradient(90deg,${T.green},${T.cyan})`,
          }}/>
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", marginTop:3 }}>
          <span style={{ fontSize:9, color:"rgba(248,113,113,.6)" }}>{redPct}% need follow-up</span>
          <span style={{ fontSize:9, color:"rgba(52,211,153,.6)" }}>{greenPct}% converted</span>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function NewAddsSection({ groups, goAcct, goGroup }) {
  const childToGroup = {};
  const parentToGroup = {};
  (groups || []).forEach(g => {
    parentToGroup[g.id] = g;
    (g.children || []).forEach(c => {
      childToGroup[c.id] = { group: g, child: c };
    });
  });

  const enriched = (NEW_ADDS || []).map(a => {
    const childMatch = childToGroup[a.mdm];
    const parentMatch = !childMatch ? parentToGroup[a.mdm] : null;
    const group = childMatch?.group || parentMatch || null;
    const child = childMatch?.child || null;
    return {
      ...a,
      _group: group,
      _child: child,
      _gId: group?.id,
      _gName: group ? fixGroupName(group) : null,
      _gLocs: group ? (group.locs || (group.children?.length) || 0) : 0,
      _lastDate: parseDate(a.last_date),
    };
  });

  enriched.sort((a, b) => {
    if (a.color !== b.color) return a.color === "RED" ? -1 : 1;
    const da = a._lastDate?.getTime() || 0;
    const db = b._lastDate?.getTime() || 0;
    return db - da;
  });

  const redCount = enriched.filter(a => a.color === "RED").length;
  const greenCount = enriched.filter(a => a.color === "GREEN").length;

  const handleTap = (a) => {
    if (a._child && goAcct) { goAcct(a._child); return; }
    if (a._group && goGroup) { goGroup(a._group); return; }
  };

  return (
    <div>
      <KPISummary total={enriched.length} redCount={redCount} greenCount={greenCount} />
      {enriched.map((a, i) => {
        const isRed = a.color === "RED";
        const addr = [a.addr, [a.city, a.state, a.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
        const isNavigable = !!(a._child || a._group);
        return (
          <button
            key={a.mdm}
            className="anim"
            onClick={() => handleTap(a)}
            style={{
              animationDelay:`${i * 12}ms`,
              width:"100%", textAlign:"left",
              background:T.s1,
              border:`1px solid ${isRed ? "rgba(248,113,113,.2)" : "rgba(52,211,153,.15)"}`,
              borderLeft:`3px solid ${isRed ? T.red : T.green}`,
              borderRadius:12, padding:"12px 14px", marginBottom:8,
              cursor: isNavigable ? "pointer" : "default",
              fontFamily:"inherit",
            }}
          >
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:4 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:600, color:T.t1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {a.name}
                </div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0, marginLeft:8 }}>
                <span style={{
                  fontSize:9, fontWeight:700,
                  color: isRed ? T.red : T.green,
                  background: isRed ? "rgba(248,113,113,.1)" : "rgba(52,211,153,.1)",
                  border:`1px solid ${isRed ? "rgba(248,113,113,.25)" : "rgba(52,211,153,.25)"}`,
                  borderRadius:4, padding:"2px 6px",
                }}>{isRed ? "FOLLOW UP" : "ON TRACK"}</span>
                {isNavigable && <Chev />}
              </div>
            </div>
            {addr && (
              <div style={{ fontSize:10, color:T.t3, marginBottom:4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {addr}
              </div>
            )}
            <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:6 }}>
              {(a.products || []).map((p, j) => (
                <span key={j} style={{
                  fontSize:9, fontWeight:600,
                  color:T.blue, background:"rgba(79,142,247,.08)",
                  border:"1px solid rgba(79,142,247,.15)",
                  borderRadius:4, padding:"2px 6px", whiteSpace:"nowrap",
                }}>{p}</span>
              ))}
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8 }}>
              <div style={{ fontSize:10, color:T.t4, flexShrink:0 }}>
                {formatDate(a.first_date)} → {formatDate(a.last_date)}
              </div>
              <div style={{ display:"flex", gap:8, fontSize:10, minWidth:0, overflow:"hidden" }}>
                {a.email && (
                  <span style={{ color:T.cyan, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:130 }}>
                    {a.email}
                  </span>
                )}
                {a.phone && !a.email && (
                  <span style={{ color:T.t4, whiteSpace:"nowrap" }}>{formatPhone(a.phone)}</span>
                )}
              </div>
            </div>
            {a._gLocs >= 3 && a._gName && (
              <div style={{ marginTop:6 }}>
                <GroupBadge
                  gName={a._gName}
                  gId={a._gId}
                  locs={a._gLocs}
                  goGroup={(id) => {
                    const g = (groups || []).find(g => g.id === id);
                    if (g && goGroup) goGroup(g);
                  }}
                />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
