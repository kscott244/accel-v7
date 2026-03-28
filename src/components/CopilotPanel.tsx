"use client";
// @ts-nocheck
import { useState, useRef, useEffect } from "react";
import { T } from "@/lib/tokens";
import { $$ } from "@/lib/format";
import { fixGroupName } from "@/components/primitives";

// ── Product fuzzy match ───────────────────────────────────────────
// Client-side product matching against actual product names on accounts
function matchProduct(prodNames: string[], pattern: string | string[]): boolean {
  const patterns = Array.isArray(pattern) ? pattern : [pattern];
  const upper = prodNames.map(n => n.toUpperCase());
  return patterns.some(p => upper.some(n => n.includes(p.toUpperCase())));
}

// ── Execute command against scored accounts ───────────────────────
function executeCommand(cmd: any, scored: any[]): any[] {
  if (!cmd || !scored?.length) return [];

  const q = "1"; // always Q1 for now
  const getVal = (a: any, metric: string) => {
    if (metric === "cy1")  return a.cyQ?.[q] || 0;
    if (metric === "py1")  return a.pyQ?.[q] || 0;
    if (metric === "gap")  return Math.max(0, (a.pyQ?.[q] || 0) - (a.cyQ?.[q] || 0));
    if (metric === "ret")  return a.pyQ?.[q] > 0 ? (a.cyQ?.[q] || 0) / a.pyQ[q] : 0;
    if (metric === "last") return a.last || 999;
    return 0;
  };

  const prodCY = (a: any, pattern: string | string[]) => {
    const prods = (a.products || []).filter((p: any) => matchProduct([p.n], pattern));
    return prods.reduce((s: number, p: any) => s + (p[`cy${q}`] || 0), 0);
  };
  const prodPY = (a: any, pattern: string | string[]) => {
    const prods = (a.products || []).filter((p: any) => matchProduct([p.n], pattern));
    return prods.reduce((s: number, p: any) => s + (p[`py${q}`] || 0), 0);
  };
  const hasProd = (a: any, pattern: string | string[]) =>
    (a.products || []).some((p: any) => matchProduct([p.n], pattern));

  let results: any[] = [];

  if (cmd.type === "rank") {
    let pool = [...scored].filter(a => (a.pyQ?.[q] || 0) > 0 || (a.cyQ?.[q] || 0) > 0);

    // Product filter
    if (cmd.product) {
      if (cmd.qualifier === "buying") {
        pool = pool.filter(a => prodCY(a, cmd.product) > 0);
        pool.sort((a, b) => prodCY(b, cmd.product) - prodCY(a, cmd.product));
      } else if (cmd.qualifier === "stopped") {
        pool = pool.filter(a => prodPY(a, cmd.product) > 100 && prodCY(a, cmd.product) === 0);
        pool.sort((a, b) => prodPY(b, cmd.product) - prodPY(a, cmd.product));
      } else {
        pool.sort((a, b) => prodCY(b, cmd.product) - prodCY(a, cmd.product));
      }
      results = pool.slice(0, cmd.limit || 5).map(a => ({
        ...a,
        _displayVal: prodCY(a, cmd.product) || prodPY(a, cmd.product),
        _label: prodCY(a, cmd.product) > 0 ? "CY" : "PY (stopped)",
        _prodCY: prodCY(a, cmd.product),
        _prodPY: prodPY(a, cmd.product),
      }));
    } else {
      // Sort by metric
      const dir = cmd.dir === "asc" ? 1 : -1;
      pool.sort((a, b) => dir * (getVal(a, cmd.metric) - getVal(b, cmd.metric)));
      results = pool.slice(0, cmd.limit || 5).map(a => ({
        ...a,
        _displayVal: getVal(a, cmd.metric),
        _label: cmd.metric,
      }));
    }

  } else if (cmd.type === "filter") {
    let pool = [...scored].filter(a => (a.pyQ?.[q] || 0) > (cmd.minPY || 0));
    if (cmd.buying?.length)    pool = pool.filter(a => cmd.buying.every((p: string) => hasProd(a, p)));
    if (cmd.notBuying?.length) pool = pool.filter(a => cmd.notBuying.every((p: string) => !hasProd(a, p)));
    pool.sort((a, b) => (b.pyQ?.[q] || 0) - (a.pyQ?.[q] || 0));
    results = pool.slice(0, cmd.limit || 10).map(a => ({
      ...a,
      _displayVal: a.cyQ?.[q] || 0,
      _label: "CY",
    }));

  } else if (cmd.type === "follow_up") {
    let pool = [...scored].filter(a => (a.pyQ?.[q] || 0) > 500);
    if (cmd.reason === "dark") {
      pool = pool.filter(a => (a.last || 999) > 90);
      pool.sort((a, b) => (b.last || 0) - (a.last || 0));
    } else if (cmd.reason === "low_ret") {
      pool = pool.filter(a => {
        const r = a.pyQ?.[q] > 0 ? (a.cyQ?.[q] || 0) / a.pyQ[q] : 1;
        return r < 0.4;
      });
      pool.sort((a, b) => ((a.cyQ?.[q] || 0) / (a.pyQ?.[q] || 1)) - ((b.cyQ?.[q] || 0) / (b.pyQ?.[q] || 1)));
    } else if (cmd.reason === "stopped") {
      pool = pool.filter(a => (a.cyQ?.[q] || 0) === 0);
      pool.sort((a, b) => (b.pyQ?.[q] || 0) - (a.pyQ?.[q] || 0));
    } else {
      // General follow-up — high gap + recent activity
      pool = pool.filter(a => ((a.pyQ?.[q] || 0) - (a.cyQ?.[q] || 0)) > 1000);
      pool.sort((a, b) => {
        const gA = (a.pyQ?.[q] || 0) - (a.cyQ?.[q] || 0);
        const gB = (b.pyQ?.[q] || 0) - (b.cyQ?.[q] || 0);
        return gB - gA;
      });
    }
    results = pool.slice(0, cmd.limit || 10).map(a => ({
      ...a,
      _displayVal: cmd.reason === "dark" ? (a.last || 999) : ((a.pyQ?.[q] || 0) - (a.cyQ?.[q] || 0)),
      _label: cmd.reason === "dark" ? "days" : "gap",
    }));

  } else if (cmd.type === "opportunity") {
    let pool = [...scored].filter(a => (a.pyQ?.[q] || 0) > 100);

    if (cmd.category === "winback" && cmd.product) {
      // Had PY spend on product, zero CY
      pool = pool.filter(a => prodPY(a, cmd.product) > 100 && prodCY(a, cmd.product) === 0);
      pool.sort((a, b) => prodPY(b, cmd.product) - prodPY(a, cmd.product));
      results = pool.slice(0, cmd.limit || 10).map(a => ({
        ...a,
        _displayVal: prodPY(a, cmd.product),
        _label: "PY (stopped)",
        _note: `Was ${$$(prodPY(a, cmd.product))} last year`,
      }));
    } else if (cmd.category === "xsell" && cmd.product) {
      // Not buying product at all, but active buyer
      pool = pool.filter(a => (a.cyQ?.[q] || 0) > 100 && !hasProd(a, cmd.product));
      pool.sort((a, b) => (b.cyQ?.[q] || 0) - (a.cyQ?.[q] || 0));
      results = pool.slice(0, cmd.limit || 10).map(a => ({
        ...a,
        _displayVal: a.cyQ?.[q] || 0,
        _label: "CY spend",
        _note: `Active buyer — no ${cmd.product}`,
      }));
    } else if (cmd.category === "tier_upgrade") {
      pool = pool.filter(a => {
        const t = a.tier || a.gTier || "";
        return (t === "Silver" || t === "Standard") && (a.pyQ?.[q] || 0) > 2000;
      });
      pool.sort((a, b) => (b.pyQ?.[q] || 0) - (a.pyQ?.[q] || 0));
      results = pool.slice(0, cmd.limit || 10).map(a => ({
        ...a,
        _displayVal: a.pyQ?.[q] || 0,
        _label: "PY spend",
        _note: `${a.tier || "Standard"} — upgrade opportunity`,
      }));
    } else {
      // General opportunity — big gap, still active
      pool = pool.filter(a => {
        const gap = (a.pyQ?.[q] || 0) - (a.cyQ?.[q] || 0);
        return gap > 2000 && (a.cyQ?.[q] || 0) > 0;
      });
      pool.sort((a, b) => {
        const gA = (a.pyQ?.[q] || 0) - (a.cyQ?.[q] || 0);
        const gB = (b.pyQ?.[q] || 0) - (b.cyQ?.[q] || 0);
        return gB - gA;
      });
      results = pool.slice(0, cmd.limit || 10).map(a => ({
        ...a,
        _displayVal: (a.pyQ?.[q] || 0) - (a.cyQ?.[q] || 0),
        _label: "gap",
      }));
    }
  }

  return results;
}

// ── Format display value ──────────────────────────────────────────
function fmtVal(val: number, label: string): string {
  if (label === "days") return `${val}d dark`;
  if (label === "ret")  return Math.round(val * 100) + "%";
  return $$(val);
}

// ── Example questions ─────────────────────────────────────────────
const EXAMPLES = [
  "Who's my top SimpliShade account?",
  "Which accounts buy bond but not composite?",
  "What's my best MaxCem win-back?",
  "Who's gone dark over 90 days?",
  "Which DSO accounts have the biggest gap?",
];

// ── Main panel ────────────────────────────────────────────────────
export default function CopilotPanel({ scored, goAcct, onClose }: any) {
  const [q, setQ]           = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [cmd, setCmd]       = useState<any>(null);
  const [error, setError]   = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100); }, []);

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
        setError(parsedCmd.reason || "Couldn't understand the question. Try rephrasing.");
        setLoading(false); return;
      }

      const rows = executeCommand(parsedCmd, scored);
      setResults(rows);
      if (rows.length === 0) setAnswer("No accounts match that filter in the current data.");
    } catch (e: any) {
      setError("Connection error. Check network.");
    }
    setLoading(false);
  };

  const cmdSummary = (c: any): string => {
    if (!c) return "";
    if (c.type === "rank")        return c.product ? `Top ${c.limit || 5} by ${c.product}` : `Ranked by ${c.metric}`;
    if (c.type === "filter")      return `Accounts buying ${(c.buying||[]).join("+")}${c.notBuying?.length ? ` not ${c.notBuying.join("+")}` : ""}`;
    if (c.type === "follow_up")   return `Follow-up: ${c.reason}`;
    if (c.type === "opportunity") return `Opportunity: ${c.category}${c.product ? " · "+c.product : ""}`;
    return "";
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 500, display: "flex", flexDirection: "column",
      justifyContent: "flex-end", background: "rgba(0,0,0,.6)", backdropFilter: "blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>

      <div style={{ background: T.s1, borderRadius: "20px 20px 0 0", maxHeight: "85vh",
        display: "flex", flexDirection: "column", borderTop: `1px solid ${T.b1}` }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: "16px 16px 10px", borderBottom: `1px solid ${T.b2}`,
          display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.t1 }}>✦ Ask</div>
            <div style={{ fontSize: 10, color: T.t4, marginTop: 1 }}>Answers from your real territory data</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none",
            color: T.t4, cursor: "pointer", fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>

        {/* Input */}
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.b2}` }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input ref={inputRef}
              value={q} onChange={e => setQ(e.target.value)}
              onKeyDown={e => e.key === "Enter" && ask(q)}
              placeholder="e.g. Who's my top SimpliShade user?"
              style={{ flex: 1, background: T.s2, border: `1px solid ${T.b1}`, borderRadius: 10,
                padding: "10px 14px", fontSize: 13, color: T.t1, fontFamily: "inherit", outline: "none" }} />
            <button onClick={() => ask(q)} disabled={loading || !q.trim()}
              style={{ background: loading ? "rgba(167,139,250,.3)" : T.purple, border: "none",
                borderRadius: 10, padding: "10px 16px", fontSize: 12, fontWeight: 700,
                color: "#fff", cursor: loading || !q.trim() ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
              {loading ? "…" : "Ask"}
            </button>
          </div>
        </div>

        {/* Results */}
        <div style={{ flex: 1, overflowY: "auto", padding: "10px 16px 20px" }}>

          {/* Loading */}
          {loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
              {[80, 60, 70].map((w, i) => (
                <div key={i} style={{ height: 44, borderRadius: 10, background: T.s2,
                  width: w + "%", animation: "pulse 1.5s infinite", animationDelay: `${i * 200}ms` }} />
              ))}
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div style={{ padding: "12px 14px", background: "rgba(248,113,113,.07)",
              border: "1px solid rgba(248,113,113,.2)", borderRadius: 10, marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: T.red }}>{error}</div>
            </div>
          )}

          {/* Answer (no results) */}
          {answer && !loading && !error && (
            <div style={{ padding: "12px 14px", background: T.s2, borderRadius: 10, marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: T.t3 }}>{answer}</div>
            </div>
          )}

          {/* Command summary */}
          {cmd && results.length > 0 && !loading && (
            <div style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 9, color: T.t4, textTransform: "uppercase", letterSpacing: "1px" }}>
                {cmdSummary(cmd)} · {results.length} result{results.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}

          {/* Result rows */}
          {results.map((a: any, i: number) => {
            const gap   = (a.pyQ?.["1"] || 0) - (a.cyQ?.["1"] || 0);
            const isDown = gap > 0;
            return (
              <button key={a.id + i} className="anim"
                onClick={() => { goAcct(a); onClose(); }}
                style={{ width: "100%", textAlign: "left", background: T.s2,
                  border: `1px solid ${T.b1}`, borderLeft: `3px solid ${T.purple}`,
                  borderRadius: 11, padding: "9px 12px", marginBottom: 6, cursor: "pointer",
                  display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Rank + name */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 9, fontWeight: 800, color: T.purple, flexShrink: 0,
                      minWidth: 16 }}>#{i + 1}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: T.t1,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {a.name}
                    </span>
                  </div>
                  {/* City + note */}
                  <div style={{ fontSize: 9, color: T.t4, paddingLeft: 22 }}>
                    {a.city}{a.st ? `, ${a.st}` : ""}
                    {a.dealer && a.dealer !== "All Other" && <span style={{ color: T.cyan }}> · {a.dealer}</span>}
                    {a._note && <span style={{ color: T.amber }}> · {a._note}</span>}
                  </div>
                </div>
                {/* Value */}
                <div style={{ flexShrink: 0, textAlign: "right" }}>
                  <div className="m" style={{ fontSize: 13, fontWeight: 700,
                    color: a._label === "days" ? T.red : a._label === "PY (stopped)" ? T.amber : T.blue }}>
                    {fmtVal(a._displayVal, a._label)}
                  </div>
                  {a._label !== "days" && isDown && gap > 0 && (
                    <div className="m" style={{ fontSize: 9, color: T.red }}>-{$$(gap)} gap</div>
                  )}
                </div>
              </button>
            );
          })}

          {/* Examples — shown when idle */}
          {!loading && !cmd && !error && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase",
                letterSpacing: "1px", color: T.t4, marginBottom: 10 }}>Try asking</div>
              {EXAMPLES.map((ex, i) => (
                <button key={i} onClick={() => { setQ(ex); ask(ex); }}
                  style={{ width: "100%", textAlign: "left", padding: "9px 12px",
                    background: T.s2, border: `1px solid ${T.b2}`, borderRadius: 9,
                    marginBottom: 6, cursor: "pointer", fontSize: 12, color: T.t3,
                    fontFamily: "inherit" }}>
                  {ex}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
