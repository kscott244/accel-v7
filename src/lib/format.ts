// ─── FORMATTERS ──────────────────────────────────────────────────
import { T } from "./tokens";

export const $$ = (n: any): string => {
  if (n == null || isNaN(n)) return "$0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1000000) return sign + "$" + (abs / 1000000).toFixed(2) + "M";
  if (abs >= 1000) return sign + "$" + (abs / 1000).toFixed(abs % 1000 === 0 ? 0 : 1) + "K";
  return sign + "$" + Math.round(abs).toLocaleString();
};

export const $f = (n: any): string => "$" + Math.round(n || 0).toLocaleString();
export const pc = (n: any): string => Math.round((n || 0) * 100) + "%";

// ─── SCORING ENGINE ──────────────────────────────────────────────
export function scoreAccount(a: any, q: any) {
  let s = 0;
  const r: Array<{ label: string; pts: number }> = [];
  const py = a.pyQ?.[q] || 0;
  const cy = a.cyQ?.[q] || 0;
  const gap = py - cy;
  const ret = py > 0 ? cy / py : 0;
  const d = a.last || 999;

  if (gap > 8000) { s += 30; r.push({ label: `Large gap: ${$$(gap)}`, pts: 30 }); }
  else if (gap > 4000) { s += 20; r.push({ label: `Gap: ${$$(gap)}`, pts: 20 }); }
  else if (gap > 2000) { s += 10; r.push({ label: `Gap: ${$$(gap)}`, pts: 10 }); }

  if (py > 500 && ret < 0.05) { s += 25; r.push({ label: "Near-zero retention", pts: 25 }); }
  else if (py > 500 && ret < 0.15) { s += 20; r.push({ label: `Critical ${Math.round(ret * 100)}%`, pts: 20 }); }
  else if (py > 200 && ret < 0.30) { s += 12; r.push({ label: `Low retention ${Math.round(ret * 100)}%`, pts: 12 }); }

  if (d > 120) { s += 20; r.push({ label: `Gone dark — ${d}d`, pts: 20 }); }
  else if (d > 60) { s += 15; r.push({ label: `${d}d since order`, pts: 15 }); }
  else if (d > 30) { s += 8; r.push({ label: `${d}d since order`, pts: 8 }); }

  if (gap > 5000 && d < 60) { s += 15; r.push({ label: "Q1 close — act now", pts: 15 }); }
  else if (gap > 3000) { s += 10; r.push({ label: "Q1 closing window", pts: 10 }); }

  const tier = a.gTier || a.tier;
  if (tier === "Diamond" || tier?.includes("Diamond")) { s += 10; r.push({ label: "Diamond tier", pts: 10 }); }
  else if (tier === "Platinum") { s += 8; r.push({ label: "Platinum tier", pts: 8 }); }
  else if (tier === "Top 100") { s += 5; r.push({ label: "Top 100", pts: 5 }); }

  const dead = (a.products || []).filter((p: any) => (p[`py${q}`] || 0) > 200 && (p[`cy${q}`] || 0) === 0);
  if (dead.length) { s += dead.length * 3; r.push({ label: `${dead.length} products at $0`, pts: dead.length * 3 }); }

  return { score: s, reasons: r, gap, ret, d, py, cy };
}

// ─── ACCOUNT HEALTH STATUS ───────────────────────────────────────
export const getHealthStatus = (ret: number, gap: number, cy: number, py: number) => {
  if (py > 0 && cy > py) return { label: "Growing — cross-sell opportunity", color: T.green, bg: "rgba(52,211,153,.08)", border: "rgba(52,211,153,.18)" };
  if (ret >= 0.6)         return { label: "Stable", color: T.cyan,  bg: "rgba(34,211,238,.08)",  border: "rgba(34,211,238,.18)" };
  if (ret >= 0.25 && gap < 2000) return { label: "Recoverable — product-specific decline", color: T.amber, bg: "rgba(251,191,36,.08)", border: "rgba(251,191,36,.18)" };
  if (ret >= 0.25)        return { label: "Recoverable — needs attention", color: T.amber, bg: "rgba(251,191,36,.08)", border: "rgba(251,191,36,.18)" };
  return                         { label: "Critical retention risk", color: T.red,   bg: "rgba(248,113,113,.08)", border: "rgba(248,113,113,.18)" };
};
