"use client";
// @ts-nocheck
import { useState, useRef, useEffect } from "react";
import { T } from "@/lib/tokens";
import { $$ } from "@/lib/format";

// ── Product family → actual product name patterns ─────────────────
const FAMILIES: Record<string, string[]> = {
  COMPOSITE:         ["SIMPLISHADE","HARMONIZE","SONICFILL","HERCULITE","POINT 4","PREMISE","FLOW-IT"],
  BOND:              ["OPTIBOND","BOND-1"],
  CEMENT:            ["MAXCEM","NX3","NEXUS RMGI","SIMILE","CEMENT IT"],
  INFECTION_CONTROL: ["CAVIWIPES","CAVICIDE"],
  TEMP_CEMENT:       ["TEMPBOND"],
  RMGI:              ["BREEZE","NEXUS RMGI"],
  DESENSITIZER:      ["EMPOWER"],
  CURING_LIGHT:      ["DEMI"],
};

// Does a product name match a family pattern list or exact name?
function matchPat(name: string, pat: string): boolean {
  const u = name.toUpperCase();
  // Check if pat is a family key
  if (FAMILIES[pat]) return FAMILIES[pat].some(p => u.includes(p));
  // Otherwise exact substring match
  return u.includes(pat.toUpperCase());
}

function prodCY(a: any, pat: string, q = "1"): number {
  return (a.products || [])
    .filter((p: any) => matchPat(p.n, pat))
    .reduce((s: number, p: any) => s + (p[`cy${q}`] || 0), 0);
}
function prodPY(a: any, pat: string, q = "1"): number {
  return (a.products || [])
    .filter((p: any) => matchPat(p.n, pat))
    .reduce((s: number, p: any) => s + (p[`py${q}`] || 0), 0);
}
function hasProd(a: any, pat: string, q = "1"): boolean {
  return (a.products || []).some((p: any) => matchPat(p.n, pat) && ((p[`cy${q}`] || 0) > 0 || (p[`py${q}`] || 0) > 0));
}
function buyingProd(a: any, pat: string, q = "1"): boolean {
  return (a.products || []).some((p: any) => matchPat(p.n, pat) && (p[`cy${q}`] || 0) > 0);
}

// ── Apply geographic / account-type filters ───────────────────────
function applyFilters(pool: any[], cmd: any): any[] {
  let l = [...pool];
  if (cmd.state)       l = l.filter(a => a.st?.toUpperCase() === cmd.state.toUpperCase());
  if (cmd.city)        l = l.filter(a => a.city?.toLowerCase().includes(cmd.city.toLowerCase()));
  if (cmd.dealer)      l = l.filter(a => a.dealer?.toLowerCase().includes(cmd.dealer.toLowerCase()));
  if (cmd.tier)        l = l.filter(a => (a.tier || a.gTier || "Standard").toLowerCase().includes(cmd.tier.toLowerCase()));
  if (cmd.accountType) l = l.filter(a => (a.class2 || "STANDARD").toUpperCase().includes(cmd.accountType.toUpperCase()));
  return l;
}

// ── Main execution engine ─────────────────────────────────────────
function executeCommand(cmd: any, scored: any[]): { rows: any[]; summary: string | null } {
  if (!cmd || !scored?.length) return { rows: [], summary: null };
  const q = "1";

  // Base pool — require some revenue history
  let base = scored.filter(a => (a.pyQ?.[q] || 0) > 0 || (a.cyQ?.[q] || 0) > 0);

  if (cmd.type === "summary") {
    const pool = applyFilters(base, cmd);
    const pat = cmd.family || cmd.product;
    if (pat) {
      const totalCY = pool.reduce((s, a) => s + prodCY(a, pat, q), 0);
      const totalPY = pool.reduce((s, a) => s + prodPY(a, pat, q), 0);
      const buyers  = pool.filter(a => buyingProd(a, pat, q)).length;
      const hadPY   = pool.filter(a => prodPY(a, pat, q) > 0).length;
      const label   = cmd.family ? cmd.family.replace(/_/g," ").toLowerCase() : cmd.product;
      let txt = `${buyers} account${buyers !== 1 ? "s" : ""} buying ${label} this year — ${$$(totalCY)} CY`;
      if (totalPY > 0) txt += ` vs ${$$(totalPY)} PY`;
      if (totalPY > 0 && totalCY < totalPY) txt += ` (${$$(totalPY - totalCY)} gap)`;
      if (hadPY > buyers) txt += `\n${hadPY - buyers} account${hadPY - buyers !== 1 ? "s" : ""} bought it last year but stopped.`;
      return { rows: [], summary: txt };
    }
    // Count-based questions
    const count = pool.length;
    return { rows: [], summary: `${count} account${count !== 1 ? "s" : ""} match that filter.` };
  }

  if (cmd.type === "rank") {
    let pool = applyFilters(base, cmd);
    const pat = cmd.family || cmd.product;

    if (pat) {
      if (cmd.qualifier === "buying" || (!cmd.qualifier && cmd.metric !== "py1")) {
        pool = pool.filter(a => prodCY(a, pat, q) > 0);
        pool.sort((a, b) => prodCY(b, pat, q) - prodCY(a, pat, q));
      } else if (cmd.qualifier === "stopped") {
        pool = pool.filter(a => prodPY(a, pat, q) > 50 && prodCY(a, pat, q) === 0);
        pool.sort((a, b) => prodPY(b, pat, q) - prodPY(a, pat, q));
      } else {
        pool.sort((a, b) => (prodCY(b, pat, q) + prodPY(b, pat, q)) - (prodCY(a, pat, q) + prodPY(a, pat, q)));
      }
      return {
        rows: pool.slice(0, cmd.limit || 8).map(a => ({
          ...a,
          _val: prodCY(a, pat, q) || prodPY(a, pat, q),
          _valLabel: prodCY(a, pat, q) > 0 ? "CY" : "PY↓",
          _subVal: prodCY(a, pat, q) > 0 && prodPY(a, pat, q) > prodCY(a, pat, q)
            ? $$(prodPY(a, pat, q) - prodCY(a, pat, q)) + " gap"
            : null,
        })),
        summary: null,
      };
    }

    // Non-product rankings
    if (cmd.metric === "prodWidth") {
      const getWidth = (a: any) => new Set(
        (a.products || []).filter((p: any) => (p[`cy${q}`] || 0) > 0).map((p: any) => p.n)
      ).size;
      pool.sort((a, b) => cmd.dir === "asc"
        ? getWidth(a) - getWidth(b)
        : getWidth(b) - getWidth(a));
      return {
        rows: pool.filter(a => getWidth(a) > 0).slice(0, cmd.limit || 8).map(a => ({
          ...a,
          _val: getWidth(a),
          _valLabel: "products",
          _subVal: null,
        })),
        summary: null,
      };
    }

    const getMetric = (a: any) => {
      if (cmd.metric === "cy1")  return a.cyQ?.[q] || 0;
      if (cmd.metric === "py1")  return a.pyQ?.[q] || 0;
      if (cmd.metric === "gap")  return Math.max(0, (a.pyQ?.[q] || 0) - (a.cyQ?.[q] || 0));
      if (cmd.metric === "ret")  return a.pyQ?.[q] > 0 ? (a.cyQ?.[q] || 0) / a.pyQ[q] : 0;
      if (cmd.metric === "last") return a.last || 999;
      return 0;
    };
    const dir = cmd.dir === "asc" ? 1 : -1;
    pool.sort((a, b) => dir * (getMetric(a) - getMetric(b)));
    return {
      rows: pool.filter(a => getMetric(a) > 0).slice(0, cmd.limit || 8).map(a => ({
        ...a,
        _val: getMetric(a),
        _valLabel: cmd.metric === "last" ? "days" : cmd.metric === "ret" ? "ret" : "",
        _subVal: cmd.metric === "gap"
          ? `CY ${$$(a.cyQ?.[q] || 0)}`
          : cmd.metric === "cy1" && (a.pyQ?.[q] || 0) > (a.cyQ?.[q] || 0)
            ? `-${$$(((a.pyQ?.[q] || 0) - (a.cyQ?.[q] || 0)))} gap`
            : null,
      })),
      summary: null,
    };
  }

  if (cmd.type === "filter") {
    let pool = applyFilters(base, cmd);
    if (cmd.minPY) pool = pool.filter(a => (a.pyQ?.[q] || 0) >= cmd.minPY);
    if (cmd.buying?.length)    pool = pool.filter(a => cmd.buying.every((p: string) => buyingProd(a, p, q)));
    if (cmd.notBuying?.length) pool = pool.filter(a => cmd.notBuying.every((p: string) => !buyingProd(a, p, q)));
    pool.sort((a, b) => (b.pyQ?.[q] || 0) - (a.pyQ?.[q] || 0));
    return {
      rows: pool.slice(0, cmd.limit || 10).map(a => ({
        ...a, _val: a.pyQ?.[q] || 0, _valLabel: "PY", _subVal: null,
      })),
      summary: null,
    };
  }

  if (cmd.type === "follow_up") {
    let pool = applyFilters(base, cmd).filter(a => (a.pyQ?.[q] || 0) > 200);
    const minDays = cmd.minDays || 90;
    if (cmd.reason === "dark")    pool = pool.filter(a => (a.last || 999) >= minDays);
    else if (cmd.reason === "low_ret") pool = pool.filter(a => a.pyQ?.[q] > 0 && (a.cyQ?.[q] || 0) / a.pyQ[q] < 0.4);
    else if (cmd.reason === "stopped") pool = pool.filter(a => (a.cyQ?.[q] || 0) === 0 && (a.pyQ?.[q] || 0) > 500);
    else pool = pool.filter(a => Math.max(0, (a.pyQ?.[q] || 0) - (a.cyQ?.[q] || 0)) > 1000);

    if (cmd.reason === "dark") pool.sort((a, b) => (b.last || 0) - (a.last || 0));
    else pool.sort((a, b) => (b.pyQ?.[q] || 0) - (a.pyQ?.[q] || 0));

    return {
      rows: pool.slice(0, cmd.limit || 10).map(a => ({
        ...a,
        _val: cmd.reason === "dark" ? (a.last || 999) : Math.max(0, (a.pyQ?.[q] || 0) - (a.cyQ?.[q] || 0)),
        _valLabel: cmd.reason === "dark" ? "days" : "gap",
        _subVal: cmd.reason === "dark" ? `PY ${$$(a.pyQ?.[q] || 0)}` : `CY ${$$(a.cyQ?.[q] || 0)}`,
      })),
      summary: null,
    };
  }

  if (cmd.type === "opportunity") {
    let pool = applyFilters(base, cmd).filter(a => (a.pyQ?.[q] || 0) > 100);
    const pat = cmd.family || cmd.product;

    if (cmd.category === "winback" && pat) {
      pool = pool.filter(a => prodPY(a, pat, q) > 50 && prodCY(a, pat, q) === 0);
      pool.sort((a, b) => prodPY(b, pat, q) - prodPY(a, pat, q));
      return {
        rows: pool.slice(0, cmd.limit || 10).map(a => ({
          ...a, _val: prodPY(a, pat, q), _valLabel: "PY↓", _subVal: "stopped buying",
        })),
        summary: null,
      };
    }
    if (cmd.category === "xsell" && pat) {
      pool = pool.filter(a => (a.cyQ?.[q] || 0) > 100 && !buyingProd(a, pat, q));
      pool.sort((a, b) => (b.cyQ?.[q] || 0) - (a.cyQ?.[q] || 0));
      return {
        rows: pool.slice(0, cmd.limit || 10).map(a => ({
          ...a, _val: a.cyQ?.[q] || 0, _valLabel: "CY", _subVal: `no ${(cmd.product || cmd.family || "").toLowerCase()}`,
        })),
        summary: null,
      };
    }
    if (cmd.category === "tier_upgrade") {
      pool = pool.filter(a => ["Standard","Silver"].includes(a.tier || a.gTier || "Standard") && (a.pyQ?.[q] || 0) > 2000);
      pool.sort((a, b) => (b.pyQ?.[q] || 0) - (a.pyQ?.[q] || 0));
      return {
        rows: pool.slice(0, cmd.limit || 10).map(a => ({
          ...a, _val: a.pyQ?.[q] || 0, _valLabel: "PY", _subVal: a.tier || "Standard",
        })),
        summary: null,
      };
    }
    if (cmd.category === "growing") {
      pool = pool.filter(a => (a.cyQ?.[q] || 0) > (a.pyQ?.[q] || 0) && (a.pyQ?.[q] || 0) > 0);
      pool.sort((a, b) => ((b.cyQ?.[q] || 0) - (b.pyQ?.[q] || 0)) - ((a.cyQ?.[q] || 0) - (a.pyQ?.[q] || 0)));
      return {
        rows: pool.slice(0, cmd.limit || 10).map(a => ({
          ...a,
          _val: (a.cyQ?.[q] || 0) - (a.pyQ?.[q] || 0),
          _valLabel: "↑",
          _subVal: `${$$(a.cyQ?.[q] || 0)} CY`,
        })),
        summary: null,
      };
    }
    // Generic opportunity — big gap, still active
    pool = pool.filter(a => {
      const gap = (a.pyQ?.[q] || 0) - (a.cyQ?.[q] || 0);
      return gap > 1000 && (a.cyQ?.[q] || 0) > 0;
    });
    pool.sort((a, b) => ((b.pyQ?.[q] || 0) - (b.cyQ?.[q] || 0)) - ((a.pyQ?.[q] || 0) - (a.cyQ?.[q] || 0)));
    return {
      rows: pool.slice(0, cmd.limit || 10).map(a => ({
        ...a, _val: (a.pyQ?.[q] || 0) - (a.cyQ?.[q] || 0), _valLabel: "gap", _subVal: null,
      })),
      summary: null,
    };
  }

  return { rows: [], summary: null };
}

function fmtVal(val: number, label: string): string {
  if (label === "days")  return `${val}d`;
  if (label === "ret")   return Math.round(val * 100) + "%";
  if (label === "products") return `${val} product${val !== 1 ? "s" : ""}`;
  if (label === "↑")    return `+${$$(val)}`;
  return $$(val);
}

function valColor(label: string): string {
  if (label === "days")   return T.red;
  if (label === "PY↓")   return T.amber;
  if (label === "gap")    return T.red;
  if (label === "↑")      return T.green;
  if (label === "ret")    return T.blue;
  return T.blue;
}

const EXAMPLES = [
  "Who's buying the most composite?",
  "DSOs in CT with the biggest gap",
  "Which Hartford accounts stopped buying bond?",
  "How much infection control am I doing?",
  "Who buys OptiBond but not composite?",
  "My Schein accounts in RI that are down",
  "Which accounts are growing fastest?",
  "Who in CT hasn't ordered in 90 days?",
  "Best SonicFill win-back opportunity?",
  "Platinum accounts with a Q1 gap",
];

export default function CopilotPanel({ scored, goAcct, onClose }: any) {
  const [q, setQ]               = useState("");
  const [loading, setLoading]   = useState(false);
  const [rows, setRows]         = useState<any[]>([]);
  const [summary, setSummary]   = useState<string | null>(null);
  const [cmd, setCmd]           = useState<any>(null);
  const [error, setError]       = useState<string | null>(null);
  const inputRef                = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 120); }, []);

  const ask = async (question: string) => {
    if (!question.trim()) return;
    setLoading(true); setRows([]); setCmd(null); setError(null); setSummary(null);
    try {
      const res  = await fetch("/api/ask-copilot", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); setLoading(false); return; }

      const parsedCmd = data.command;
      setCmd(parsedCmd);

      if (parsedCmd.type === "unknown") {
        setError(parsedCmd.reason || "Couldn't understand that. Try rephrasing.");
        setLoading(false); return;
      }

      const { rows: r, summary: s } = executeCommand(parsedCmd, scored);
      setRows(r);
      setSummary(s || (r.length === 0 ? "No accounts match that filter in the current data." : null));
    } catch { setError("Connection error."); }
    setLoading(false);
  };

  const cmdLabel = (c: any): string => {
    if (!c) return "";
    const parts: string[] = [];
    if (c.accountType && c.accountType !== "STANDARD") parts.push(c.accountType);
    if (c.tier)    parts.push(c.tier);
    if (c.dealer)  parts.push(c.dealer);
    if (c.state)   parts.push(c.state);
    if (c.city)    parts.push(c.city);
    if (c.family)  parts.push(c.family.replace(/_/g," ").toLowerCase());
    if (c.product) parts.push(c.product);
    return parts.join(" · ");
  };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:500,
      display:"flex", flexDirection:"column", justifyContent:"flex-end",
      background:"rgba(0,0,0,.6)", backdropFilter:"blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>

      <div style={{ background:T.s1, borderRadius:"20px 20px 0 0", maxHeight:"88vh",
        display:"flex", flexDirection:"column", borderTop:`1px solid ${T.b1}` }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding:"14px 16px 10px", borderBottom:`1px solid ${T.b2}`,
          display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:T.t1 }}>✦ Ask</div>
            <div style={{ fontSize:9, color:T.t4, marginTop:1 }}>
              Answers grounded in your actual territory data
            </div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none",
            color:T.t4, cursor:"pointer", fontSize:20, lineHeight:1 }}>✕</button>
        </div>

        {/* Input */}
        <div style={{ padding:"10px 16px", borderBottom:`1px solid ${T.b2}` }}>
          <div style={{ display:"flex", gap:7 }}>
            <input ref={inputRef} value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => e.key === "Enter" && ask(q)}
              placeholder="e.g. Which DSOs in CT stopped buying bond?"
              style={{ flex:1, background:T.s2, border:`1px solid ${T.b1}`, borderRadius:10,
                padding:"9px 13px", fontSize:13, color:T.t1, fontFamily:"inherit", outline:"none" }} />
            <button onClick={() => ask(q)} disabled={loading || !q.trim()}
              style={{ background: loading ? "rgba(167,139,250,.3)" : T.purple, border:"none",
                borderRadius:10, padding:"9px 16px", fontSize:12, fontWeight:700,
                color:"#fff", cursor: loading||!q.trim() ? "not-allowed":"pointer", fontFamily:"inherit" }}>
              {loading ? "…" : "Ask"}
            </button>
          </div>
        </div>

        {/* Results area */}
        <div style={{ flex:1, overflowY:"auto", padding:"10px 16px 24px" }}>

          {/* Loading skeleton */}
          {loading && (
            <div style={{ display:"flex", flexDirection:"column", gap:7, marginBottom:12 }}>
              {[85,65,75].map((w,i) => (
                <div key={i} style={{ height:48, borderRadius:10, background:T.s2,
                  width:w+"%", animation:"pulse 1.5s infinite", animationDelay:`${i*200}ms` }} />
              ))}
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div style={{ padding:"10px 13px", background:"rgba(248,113,113,.07)",
              border:"1px solid rgba(248,113,113,.2)", borderRadius:10, marginBottom:10 }}>
              <div style={{ fontSize:12, color:T.red }}>{error}</div>
            </div>
          )}

          {/* Summary answer */}
          {summary && !loading && !error && (
            <div style={{ padding:"12px 14px", background:"rgba(79,142,247,.08)",
              border:`1px solid rgba(79,142,247,.2)`, borderRadius:10, marginBottom:10 }}>
              <div style={{ fontSize:13, color:T.t1, lineHeight:1.6, whiteSpace:"pre-line" }}>{summary}</div>
            </div>
          )}

          {/* Result count + filter summary */}
          {cmd && rows.length > 0 && !loading && (
            <div style={{ marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:9, color:T.t4, textTransform:"uppercase", letterSpacing:"1px" }}>
                {cmdLabel(cmd) || "All accounts"}
              </span>
              <span style={{ fontSize:9, color:T.t4 }}>
                {rows.length} result{rows.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}

          {/* Result rows */}
          {rows.map((a: any, i: number) => (
            <button key={a.id+i} className="anim"
              onClick={() => { goAcct(a); onClose(); }}
              style={{ width:"100%", textAlign:"left", background:T.s2,
                border:`1px solid ${T.b1}`, borderLeft:`3px solid ${T.purple}`,
                borderRadius:11, padding:"9px 12px", marginBottom:6, cursor:"pointer",
                display:"flex", justifyContent:"space-between", alignItems:"center", gap:8 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
                  <span style={{ fontSize:9, fontWeight:800, color:T.t4, flexShrink:0, minWidth:16 }}>
                    #{i+1}
                  </span>
                  <span style={{ fontSize:12, fontWeight:700, color:T.t1,
                    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {a.name}
                  </span>
                </div>
                <div style={{ fontSize:9, color:T.t4, paddingLeft:22 }}>
                  {a.city}{a.st ? `, ${a.st}` : ""}
                  {a.dealer && a.dealer !== "All Other" && <span style={{ color:T.cyan }}> · {a.dealer}</span>}
                  {a._subVal && <span style={{ color:T.t3 }}> · {a._subVal}</span>}
                </div>
              </div>
              <div style={{ flexShrink:0, textAlign:"right" }}>
                <div className="m" style={{ fontSize:13, fontWeight:700, color:valColor(a._valLabel) }}>
                  {fmtVal(a._val, a._valLabel)}
                </div>
                {a._valLabel && !["days","ret","products","↑"].includes(a._valLabel) && (
                  <div style={{ fontSize:8, color:T.t4 }}>{a._valLabel}</div>
                )}
              </div>
            </button>
          ))}

          {/* Examples — shown when idle */}
          {!loading && !cmd && !error && (
            <div>
              <div style={{ fontSize:9, fontWeight:700, textTransform:"uppercase",
                letterSpacing:"1px", color:T.t4, marginBottom:10 }}>Try asking</div>
              {EXAMPLES.map((ex, i) => (
                <button key={i} onClick={() => { setQ(ex); ask(ex); }}
                  style={{ width:"100%", textAlign:"left", padding:"9px 12px",
                    background:T.s2, border:`1px solid ${T.b2}`, borderRadius:9,
                    marginBottom:6, cursor:"pointer", fontSize:12, color:T.t3,
                    fontFamily:"inherit" }}>
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
