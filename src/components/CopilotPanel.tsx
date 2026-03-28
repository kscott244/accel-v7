"use client";
// @ts-nocheck
import { useState, useRef, useEffect, useMemo } from "react";
import { T } from "@/lib/tokens";
import { $$ } from "@/lib/format";
import { BADGER } from "@/lib/data";
import {
  buildTerritoryContext,
  matchProdCmd,
  haversineKm,
  PRODUCT_FAMILIES,
  type TerritoryContext,
  type EnrichedAccount,
} from "@/lib/territory";

// ── Apply geography + attribute filters to a pool ─────────────────
function applyFilters(pool: EnrichedAccount[], cmd: any): EnrichedAccount[] {
  let out = pool;
  if (cmd.city)        out = out.filter(a => a.city.toLowerCase().includes(cmd.city.toLowerCase()));
  if (cmd.state)       out = out.filter(a => a.st.toUpperCase() === cmd.state.toUpperCase());
  if (cmd.dealer)      out = out.filter(a => a.dealer.toLowerCase().includes(cmd.dealer.toLowerCase()));
  if (cmd.tier)        out = out.filter(a => a.tier.toLowerCase().includes(cmd.tier.toLowerCase()));
  if (cmd.accountType) {
    const at = cmd.accountType.toUpperCase();
    out = out.filter(a => {
      if (at === "DSO")                return a.class2.toUpperCase().includes("DSO") && !a.class2.toUpperCase().includes("EMERGING");
      if (at === "EMERGING DSO")       return a.class2.toUpperCase().includes("EMERGING");
      if (at === "COMMUNITY HEALTHCARE") return a.class2.toUpperCase().includes("COMMUNITY") || a.class2.toUpperCase().includes("HEALTH");
      if (at === "GOVERNMENT")         return a.class2.toUpperCase().includes("GOV");
      if (at === "SCHOOLS")            return a.class2.toUpperCase().includes("SCHOOL");
      return true;
    });
  }
  return out;
}

// ── Metric getter ─────────────────────────────────────────────────
function getMetric(a: EnrichedAccount, metric: string): number {
  if (metric === "cy1")      return a.cy1;
  if (metric === "py1")      return a.py1;
  if (metric === "gap")      return a.gap;
  if (metric === "ret")      return a.ret;
  if (metric === "last")     return a.last;
  if (metric === "prodWidth") return a.prodWidth;
  return 0;
}

// ── Product totals on an account ──────────────────────────────────
function prodCY(a: EnrichedAccount, cmd: any): number {
  return a.products
    .filter(p => matchProdCmd(p.n, cmd.product, cmd.family))
    .reduce((s: number, p: any) => s + (p.cy1 || 0), 0);
}
function prodPY(a: EnrichedAccount, cmd: any): number {
  return a.products
    .filter(p => matchProdCmd(p.n, cmd.product, cmd.family))
    .reduce((s: number, p: any) => s + (p.py1 || 0), 0);
}
function hasProd(a: EnrichedAccount, nameOrFamily: string): boolean {
  return a.products.some(p => matchProdCmd(p.n, nameOrFamily, nameOrFamily));
}

// ── Execute command against territory context ─────────────────────
function executeCommand(cmd: any, ctx: TerritoryContext, userLat?: number, userLng?: number): {
  rows: EnrichedAccount[];
  answer?: string;
} {
  if (!cmd || !ctx) return { rows: [] };

  let pool = ctx.accounts;

  if (cmd.type === "rank") {
    pool = applyFilters(pool, cmd);
    const hasProductFilter = cmd.product || cmd.family;

    if (hasProductFilter) {
      if (cmd.qualifier === "buying") {
        pool = pool.filter(a => prodCY(a, cmd) > 0);
        pool = [...pool].sort((a, b) => prodCY(b, cmd) - prodCY(a, cmd));
      } else if (cmd.qualifier === "stopped") {
        pool = pool.filter(a => prodPY(a, cmd) > 100 && prodCY(a, cmd) === 0);
        pool = [...pool].sort((a, b) => prodPY(b, cmd) - prodPY(a, cmd));
      } else {
        pool = [...pool].sort((a, b) => prodCY(b, cmd) - prodCY(a, cmd));
      }
      const rows = pool.slice(0, cmd.limit || 5).map(a => ({
        ...a,
        _displayVal: prodCY(a, cmd) || prodPY(a, cmd),
        _label: prodCY(a, cmd) > 0 ? "CY" : "PY (stopped)",
      }));
      return { rows };
    }

    if (cmd.metric === "prodWidth") {
      pool = pool.filter(a => a.py1 > 500);
    }

    const dir = cmd.dir === "asc" ? 1 : -1;
    pool = [...pool].sort((a, b) => dir * (getMetric(a, cmd.metric) - getMetric(b, cmd.metric)));
    const rows = pool.slice(0, cmd.limit || 5).map(a => ({
      ...a,
      _displayVal: getMetric(a, cmd.metric),
      _label: cmd.metric,
    }));
    return { rows };

  } else if (cmd.type === "filter") {
    pool = applyFilters(pool, cmd);
    if (cmd.minPY)        pool = pool.filter(a => a.py1 >= cmd.minPY);
    if (cmd.buying?.length)    pool = pool.filter(a => cmd.buying.every((p: string) => hasProd(a, p)));
    if (cmd.notBuying?.length) pool = pool.filter(a => cmd.notBuying.every((p: string) => !hasProd(a, p)));
    pool = [...pool].sort((a, b) => b.py1 - a.py1);
    const rows = pool.slice(0, cmd.limit || 10).map(a => ({
      ...a, _displayVal: a.cy1, _label: "CY",
    }));
    return { rows };

  } else if (cmd.type === "follow_up") {
    pool = pool.filter(a => a.py1 > 500);
    pool = applyFilters(pool, cmd);
    const minDays = cmd.minDays || 90;

    if (cmd.reason === "dark") {
      pool = pool.filter(a => a.last > minDays);
      pool = [...pool].sort((a, b) => b.last - a.last);
    } else if (cmd.reason === "low_ret") {
      pool = pool.filter(a => a.ret < 0.4);
      pool = [...pool].sort((a, b) => a.ret - b.ret);
    } else if (cmd.reason === "stopped") {
      pool = pool.filter(a => a.cy1 === 0);
      pool = [...pool].sort((a, b) => b.py1 - a.py1);
    } else if (cmd.reason === "overdue") {
      // Has open tasks or follow-up notes
      pool = pool.filter(a => a.openTaskCount > 0);
      pool = [...pool].sort((a, b) => b.gap - a.gap);
    } else {
      pool = pool.filter(a => a.gap > 1000);
      pool = [...pool].sort((a, b) => b.gap - a.gap);
    }
    const rows = pool.slice(0, cmd.limit || 10).map(a => ({
      ...a,
      _displayVal: cmd.reason === "dark" ? a.last : a.gap,
      _label: cmd.reason === "dark" ? "days" : "gap",
    }));
    return { rows };

  } else if (cmd.type === "opportunity") {
    pool = applyFilters(pool, cmd);

    if (cmd.category === "winback") {
      if (cmd.product || cmd.family) {
        pool = pool.filter(a => prodPY(a, cmd) > 100 && prodCY(a, cmd) === 0);
        pool = [...pool].sort((a, b) => prodPY(b, cmd) - prodPY(a, cmd));
        const rows = pool.slice(0, cmd.limit || 10).map(a => ({
          ...a, _displayVal: prodPY(a, cmd), _label: "PY (stopped)",
          _note: `Was ${$$(prodPY(a, cmd))} — now $0`,
        }));
        return { rows };
      } else {
        // General win-back — stopped buying entirely
        pool = pool.filter(a => a.py1 > 500 && a.cy1 === 0);
        pool = [...pool].sort((a, b) => b.py1 - a.py1);
        const rows = pool.slice(0, cmd.limit || 10).map(a => ({
          ...a, _displayVal: a.py1, _label: "PY (stopped)", _note: "No CY spend",
        }));
        return { rows };
      }
    } else if (cmd.category === "xsell") {
      if (cmd.product || cmd.family) {
        pool = pool.filter(a => a.cy1 > 100 && prodCY(a, cmd) === 0);
        pool = [...pool].sort((a, b) => b.cy1 - a.cy1);
        const rows = pool.slice(0, cmd.limit || 10).map(a => ({
          ...a, _displayVal: a.cy1, _label: "CY spend",
          _note: `Active buyer — no ${cmd.product || cmd.family}`,
        }));
        return { rows };
      }
    } else if (cmd.category === "tier_upgrade") {
      pool = pool.filter(a => (a.tier === "Silver" || a.tier === "Standard") && a.py1 > 2000);
      pool = [...pool].sort((a, b) => b.py1 - a.py1);
      const rows = pool.slice(0, cmd.limit || 10).map(a => ({
        ...a, _displayVal: a.py1, _label: "PY spend",
        _note: `${a.tier} — upgrade opportunity`,
      }));
      return { rows };
    } else if (cmd.category === "growing") {
      pool = pool.filter(a => a.cy1 > a.py1 && a.py1 > 500);
      pool = [...pool].sort((a, b) => (b.cy1 - b.py1) - (a.cy1 - a.py1));
      const rows = pool.slice(0, cmd.limit || 10).map(a => ({
        ...a, _displayVal: a.cy1 - a.py1, _label: "growth",
        _note: `+${$$( a.cy1 - a.py1)} vs last year`,
      }));
      return { rows };
    } else {
      // General opportunity
      pool = pool.filter(a => a.gap > 2000 && a.cy1 > 0);
      pool = [...pool].sort((a, b) => b.gap - a.gap);
      const rows = pool.slice(0, cmd.limit || 10).map(a => ({
        ...a, _displayVal: a.gap, _label: "gap",
      }));
      return { rows };
    }

  } else if (cmd.type === "summary") {
    pool = applyFilters(pool, cmd);
    const hasProductFilter = cmd.product || cmd.family;

    if (hasProductFilter) {
      const totalCY = pool.reduce((s, a) => s + prodCY(a, cmd), 0);
      const totalPY = pool.reduce((s, a) => s + prodPY(a, cmd), 0);
      const buyerCount = pool.filter(a => prodCY(a, cmd) > 0).length;
      const label = cmd.product || cmd.family;
      return {
        rows: [],
        answer: `${label}: ${$$(totalCY)} CY vs ${$$(totalPY)} PY across ${buyerCount} active accounts.`,
      };
    } else {
      // General territory summary
      const filteredPY = pool.reduce((s, a) => s + a.py1, 0);
      const filteredCY = pool.reduce((s, a) => s + a.cy1, 0);
      const filteredGap = pool.reduce((s, a) => s + a.gap, 0);
      const qualifier = cmd.city || cmd.state || cmd.dealer || "territory";
      return {
        rows: [],
        answer: `${qualifier}: ${$$(filteredCY)} CY vs ${$$(filteredPY)} PY · ${$$(filteredGap)} gap · ${pool.length} accounts.`,
      };
    }

  } else if (cmd.type === "nearby") {
    // Proximity query — requires user location
    if (!userLat || !userLng) {
      return { rows: [], answer: "Location not available. Enable location access and try again." };
    }
    pool = pool.filter(a => a.lat && a.lng);
    pool = [...pool]
      .map(a => ({ ...a, _distKm: haversineKm(userLat, userLng, a.lat!, a.lng!) }))
      .sort((a: any, b: any) => a._distKm - b._distKm);

    if (cmd.qualifier === "warm_underperforming") {
      pool = pool.filter((a: any) => (a.feelLabel === "Warm" || a.feelLabel === "Hot") && a.gap > 1000);
    } else if (cmd.qualifier === "opportunity") {
      pool = pool.filter((a: any) => a.gap > 2000 && a.cy1 > 0);
    }

    const rows = pool.slice(0, cmd.limit || 5).map((a: any) => ({
      ...a, _displayVal: a._distKm, _label: "km away",
      _note: a._distKm < 2 ? "Very close" : a._distKm < 10 ? `${Math.round(a._distKm)} km` : `${Math.round(a._distKm)} km`,
    }));
    return { rows };
  }

  return { rows: [] };
}

// ── Format display value ──────────────────────────────────────────
function fmtVal(val: number, label: string): string {
  if (label === "days")      return `${val}d dark`;
  if (label === "ret")       return Math.round(val * 100) + "%";
  if (label === "prodWidth") return `${val} products`;
  if (label === "km away")   return `${Math.round(val)} km`;
  if (label === "growth")    return `+${$$(val)}`;
  return $$(val);
}

// ── Feel color ────────────────────────────────────────────────────
function feelColor(label?: string): string {
  if (label === "Hot")  return T.green;
  if (label === "Warm") return T.amber;
  return T.t4;
}

// ── Example questions ─────────────────────────────────────────────
const EXAMPLES = [
  "Who's buying the most composite?",
  "Hartford accounts stopped buying bond?",
  "DSOs in CT with the biggest gap",
  "Accounts buying OptiBond but not any composite",
  "My Schein accounts in RI that are down",
  "How much infection control am I doing?",
  "Fastest growing accounts",
  "Who hasn't ordered in 90 days in CT?",
  "Best MaxCem win-back opportunity",
  "Platinum accounts with a gap",
];

// ── Main panel ────────────────────────────────────────────────────
export default function CopilotPanel({ scored, overlays, goAcct, onClose }: any) {
  const [q, setQ]             = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [cmd, setCmd]         = useState<any>(null);
  const [error, setError]     = useState<string | null>(null);
  const [answer, setAnswer]   = useState<string | null>(null);
  const [userLoc, setUserLoc] = useState<{lat: number; lng: number} | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build territory context once (memo on scored)
  const ctx = useMemo(() =>
    buildTerritoryContext(scored || [], BADGER, overlays || {}),
    [scored?.length, overlays]
  );

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
    // Try to get user location for proximity queries
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {} // silent fail
      );
    }
  }, []);

  const ask = async (question: string) => {
    if (!question.trim()) return;
    setLoading(true); setResults([]); setCmd(null); setError(null); setAnswer(null);

    try {
      const res = await fetch("/api/ask-copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); setLoading(false); return; }

      const parsedCmd = data.command;
      setCmd(parsedCmd);

      if (parsedCmd.type === "unknown") {
        setError(parsedCmd.reason || "Couldn't understand. Try rephrasing.");
        setLoading(false); return;
      }

      const { rows, answer: ans } = executeCommand(parsedCmd, ctx, userLoc?.lat, userLoc?.lng);
      setResults(rows);
      if (ans) setAnswer(ans);
      else if (rows.length === 0) setAnswer("No accounts match that in the current data.");
    } catch {
      setError("Connection error. Check network.");
    }
    setLoading(false);
  };

  const cmdLabel = (c: any): string => {
    if (!c) return "";
    const geo = [c.city, c.state].filter(Boolean).join(", ");
    const attr = [c.dealer, c.tier, c.accountType].filter(Boolean).join(" · ");
    const prod = c.product || c.family || "";
    const parts = [geo, attr, prod].filter(Boolean).join(" · ");
    if (c.type === "rank")        return `Ranked by ${c.metric}${parts ? " · " + parts : ""}`;
    if (c.type === "filter")      return `Filter${parts ? " · " + parts : ""}`;
    if (c.type === "follow_up")   return `Follow-up: ${c.reason}${parts ? " · " + parts : ""}`;
    if (c.type === "opportunity") return `Opportunity: ${c.category}${parts ? " · " + parts : ""}`;
    if (c.type === "summary")     return `Summary${parts ? " · " + parts : ""}`;
    if (c.type === "nearby")      return `Nearby${parts ? " · " + parts : ""}`;
    return c.type;
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 500, display: "flex", flexDirection: "column",
      justifyContent: "flex-end", background: "rgba(0,0,0,.65)", backdropFilter: "blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>

      <div style={{ background: T.s1, borderRadius: "20px 20px 0 0", maxHeight: "88vh",
        display: "flex", flexDirection: "column", borderTop: `1px solid ${T.b1}` }}
        onClick={(e: any) => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: "14px 16px 10px", borderBottom: `1px solid ${T.b2}`,
          display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.t1 }}>✦ Ask your territory</div>
            <div style={{ fontSize: 10, color: T.t4, marginTop: 1 }}>
              {ctx.accounts.length} accounts · {$$(ctx.totalCY1)} CY · {$$(ctx.totalGap)} gap
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none",
            color: T.t4, cursor: "pointer", fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>

        {/* Input */}
        <div style={{ padding: "10px 16px", borderBottom: `1px solid ${T.b2}`, flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 7 }}>
            <input ref={inputRef}
              value={q} onChange={(e: any) => setQ(e.target.value)}
              onKeyDown={(e: any) => e.key === "Enter" && ask(q)}
              placeholder="e.g. Hartford DSOs with biggest gap"
              style={{ flex: 1, background: T.s2, border: `1px solid ${T.b1}`, borderRadius: 10,
                padding: "9px 12px", fontSize: 13, color: T.t1, fontFamily: "inherit", outline: "none" }} />
            <button onClick={() => ask(q)} disabled={loading || !q.trim()}
              style={{ background: loading ? "rgba(167,139,250,.3)" : T.purple, border: "none",
                borderRadius: 10, padding: "9px 16px", fontSize: 12, fontWeight: 700,
                color: "#fff", cursor: loading || !q.trim() ? "not-allowed" : "pointer",
                fontFamily: "inherit", flexShrink: 0 }}>
              {loading ? "…" : "Ask"}
            </button>
          </div>
        </div>

        {/* Results area */}
        <div style={{ flex: 1, overflowY: "auto", padding: "10px 16px 24px" }}>

          {/* Loading skeletons */}
          {loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {[85, 65, 75].map((w, i) => (
                <div key={i} style={{ height: 52, borderRadius: 10, background: T.s2,
                  width: w + "%", animation: "pulse 1.5s infinite", animationDelay: `${i * 200}ms` }} />
              ))}
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div style={{ padding: "10px 12px", background: "rgba(248,113,113,.07)",
              border: "1px solid rgba(248,113,113,.2)", borderRadius: 10, marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: T.red }}>{error}</div>
            </div>
          )}

          {/* Summary answer */}
          {answer && !loading && !error && (
            <div style={{ padding: "10px 12px", background: T.s2, borderRadius: 10,
              border: `1px solid ${T.b1}`, marginBottom: 10 }}>
              <div style={{ fontSize: 13, color: T.t1, fontWeight: 600 }}>{answer}</div>
            </div>
          )}

          {/* Command label */}
          {cmd && results.length > 0 && !loading && (
            <div style={{ marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 9, color: T.t4, textTransform: "uppercase", letterSpacing: "1px" }}>
                {cmdLabel(cmd)}
              </span>
              <span style={{ fontSize: 9, color: T.t4 }}>{results.length} result{results.length !== 1 ? "s" : ""}</span>
            </div>
          )}

          {/* Result rows */}
          {results.map((a: any, i: number) => (
            <button key={a.id + i} className="anim"
              onClick={() => { goAcct(a); onClose(); }}
              style={{ width: "100%", textAlign: "left", background: T.s2,
                border: `1px solid ${T.b1}`, borderLeft: `3px solid ${T.purple}`,
                borderRadius: 11, padding: "9px 12px", marginBottom: 6, cursor: "pointer",
                display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                  <span style={{ fontSize: 9, fontWeight: 800, color: T.purple, flexShrink: 0, minWidth: 16 }}>
                    #{i + 1}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.t1,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {a.name}
                  </span>
                  {a.feelLabel && (
                    <span style={{ fontSize: 8, fontWeight: 700, color: feelColor(a.feelLabel),
                      background: feelColor(a.feelLabel) + "18", borderRadius: 3, padding: "1px 5px",
                      flexShrink: 0 }}>{a.feelLabel}</span>
                  )}
                </div>
                <div style={{ fontSize: 9, color: T.t4, paddingLeft: 20, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span>{a.city}{a.st ? `, ${a.st}` : ""}</span>
                  {a.dealer && a.dealer !== "All Other" && <span style={{ color: T.cyan }}>· {a.dealer}</span>}
                  {a.doctor && <span style={{ color: T.t3 }}>· Dr. {a.doctor.replace(/^Dr\.\s*/i,"").split(" ")[0]}</span>}
                  {a._note && <span style={{ color: T.amber }}>· {a._note}</span>}
                </div>
              </div>
              <div style={{ flexShrink: 0, textAlign: "right" }}>
                <div className="m" style={{ fontSize: 13, fontWeight: 700,
                  color: a._label === "days" ? T.red : a._label === "PY (stopped)" ? T.amber :
                         a._label === "growth" ? T.green : T.blue }}>
                  {fmtVal(a._displayVal, a._label)}
                </div>
                {a._label !== "days" && a._label !== "prodWidth" && a._label !== "km away" && a.gap > 0 && (
                  <div className="m" style={{ fontSize: 9, color: T.t4 }}>-{$$(a.gap)}</div>
                )}
              </div>
            </button>
          ))}

          {/* Examples — shown when idle */}
          {!loading && !cmd && !error && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase",
                letterSpacing: "1px", color: T.t4, marginBottom: 8 }}>Try asking</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {EXAMPLES.map((ex, i) => (
                  <button key={i} onClick={() => { setQ(ex); ask(ex); }}
                    style={{ padding: "6px 10px", background: T.s2,
                      border: `1px solid ${T.b2}`, borderRadius: 8, cursor: "pointer",
                      fontSize: 11, color: T.t3, fontFamily: "inherit", textAlign: "left" }}>
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
