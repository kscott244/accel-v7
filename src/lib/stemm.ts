// ─── STEMM INTELLIGENCE MODEL ────────────────────────────────────
// Trunk Strength: structural health of a parent group / DSO
// Branch Spread:  product category penetration at account level
//
// Design principles:
// - Scores are 0–100, deterministic, no external deps
// - Labels are decision-useful, not decorative
// - No side effects — pure functions only

// ══════════════════════════════════════════════════════════════════
// TRUNK STRENGTH
// Measures how structurally sound a group is as a buying unit.
// A 5-location DSO where only 1 location orders = fragile trunk.
// ══════════════════════════════════════════════════════════════════

export type TrunkLabel = "Strong" | "Solid" | "Developing" | "Fragile" | "Critical";

export interface TrunkResult {
  score: number;       // 0–100
  label: TrunkLabel;
  color: string;       // hex for UI
  bg: string;          // rgba bg for badge
  border: string;      // rgba border
}

export function trunkStrength(group: any): TrunkResult {
  const py   = group._py1 ?? group.pyQ?.["1"] ?? 0;
  const cy   = group._cy1 ?? group.cyQ?.["1"] ?? 0;
  const ret  = py > 0 ? cy / py : 0;
  const locs = group._locs ?? group.locs ?? 1;
  const tier = (group.tier ?? "").toLowerCase();
  const children: any[] = group.children ?? [];

  // ── 1. Retention (0–30 pts) ──────────────────────────────────
  let retPts = 0;
  if      (ret >= 0.85) retPts = 30;
  else if (ret >= 0.65) retPts = 22;
  else if (ret >= 0.40) retPts = 14;
  else if (ret >= 0.20) retPts =  7;
  else if (ret >  0)    retPts =  3;

  // ── 2. Location coverage (0–25 pts) ─────────────────────────
  // % of locations that have placed at least one CY order
  let coveragePts = 0;
  if (locs <= 1) {
    coveragePts = cy > 0 ? 20 : 0;
  } else {
    const activeLocs = children.filter(c => (c.cyQ?.["1"] ?? 0) > 0).length;
    const coveragePct = activeLocs / locs;
    if      (coveragePct >= 0.80) coveragePts = 25;
    else if (coveragePct >= 0.60) coveragePts = 18;
    else if (coveragePct >= 0.40) coveragePts = 11;
    else if (coveragePct >= 0.20) coveragePts =  5;
  }

  // ── 3. Tier leverage (0–15 pts) ─────────────────────────────
  let tierPts = 0;
  if      (tier.includes("diamond"))  tierPts = 15;
  else if (tier.includes("plat"))     tierPts = 12;
  else if (tier.includes("gold"))     tierPts =  9;
  else if (tier.includes("silver"))   tierPts =  6;
  else if (tier.includes("top 100"))  tierPts = 10;
  else                                tierPts =  2;

  // ── 4. Concentration penalty (0–15 pts) ─────────────────────
  // If one location drives >80% of group CY, trunk is fragile
  let concentrationPts = 15;
  if (locs >= 2 && cy > 0) {
    const maxLocCY = Math.max(...children.map(c => c.cyQ?.["1"] ?? 0));
    const topShare = maxLocCY / cy;
    if      (topShare > 0.90) concentrationPts =  0;
    else if (topShare > 0.80) concentrationPts =  5;
    else if (topShare > 0.65) concentrationPts = 10;
    else                      concentrationPts = 15;
  }

  // ── 5. Size (0–15 pts) ──────────────────────────────────────
  let sizePts = 0;
  if      (py > 20000) sizePts = 15;
  else if (py > 10000) sizePts = 11;
  else if (py >  5000) sizePts =  7;
  else if (py >  2000) sizePts =  4;
  else if (py >   500) sizePts =  2;

  const score = Math.min(100, retPts + coveragePts + tierPts + concentrationPts + sizePts);

  // ── Label + color ────────────────────────────────────────────
  let label: TrunkLabel;
  let color: string, bg: string, border: string;

  if      (score >= 72) { label = "Strong";     color = "#34d399"; bg = "rgba(52,211,153,.10)";  border = "rgba(52,211,153,.22)"; }
  else if (score >= 52) { label = "Solid";       color = "#fbbf24"; bg = "rgba(251,191,36,.09)";  border = "rgba(251,191,36,.22)"; }
  else if (score >= 34) { label = "Developing";  color = "#9898b8"; bg = "rgba(152,152,184,.08)"; border = "rgba(152,152,184,.18)"; }
  else if (score >= 18) { label = "Fragile";     color = "#f87171"; bg = "rgba(248,113,113,.09)"; border = "rgba(248,113,113,.22)"; }
  else                  { label = "Critical";    color = "#f87171"; bg = "rgba(248,113,113,.14)"; border = "rgba(248,113,113,.30)"; }

  return { score, label, color, bg, border };
}

// ══════════════════════════════════════════════════════════════════
// BRANCH SPREAD
// Measures product category penetration at account level.
// 6 branches = 6 product categories. Active = ordered this CY.
// ══════════════════════════════════════════════════════════════════

export const BRANCH_CATEGORIES = [
  {
    key: "composite",
    label: "Composite",
    keywords: ["harmonize","simplishade","sonicfill","herculite","premise","point 4","simile","flow-it"],
  },
  {
    key: "bond",
    label: "Bond",
    keywords: ["optibond","bond-1","bond 1"],
  },
  {
    key: "cement",
    label: "Cement",
    keywords: ["maxcem","tempbond","nx3"],
  },
  {
    key: "infection",
    label: "Infection Control",
    keywords: ["caviwipes","cavicide"],
  },
  {
    key: "curing",
    label: "Curing",
    keywords: ["demi plus","demi pro"],
  },
  {
    key: "restorative",
    label: "Restorative",
    keywords: ["nexus","build-it","buildit"],
  },
] as const;

export type BranchKey = typeof BRANCH_CATEGORIES[number]["key"];

export interface BranchResult {
  key: BranchKey;
  label: string;
  active: boolean;   // ordered CY
  hadPY: boolean;    // ordered PY (dropped = gap opportunity)
}

export interface SpreadResult {
  branches: BranchResult[];
  activeCount: number;   // 0–6
  label: "Broad" | "Moderate" | "Narrow" | "Single";
  labelColor: string;
}

export function branchSpread(products: any[], q = "1"): SpreadResult {
  const branches: BranchResult[] = BRANCH_CATEGORIES.map(cat => {
    const match = products.filter(p => {
      const name = (p.n ?? "").toLowerCase();
      return cat.keywords.some(kw => name.includes(kw));
    });
    const active = match.some(p => (p[`cy${q}`] ?? 0) > 0);
    const hadPY  = match.some(p => (p[`py${q}`] ?? 0) > 0);
    return { key: cat.key, label: cat.label, active, hadPY };
  });

  const activeCount = branches.filter(b => b.active).length;

  let label: SpreadResult["label"];
  let labelColor: string;
  if      (activeCount >= 4) { label = "Broad";    labelColor = "#34d399"; }
  else if (activeCount >= 3) { label = "Moderate"; labelColor = "#fbbf24"; }
  else if (activeCount >= 2) { label = "Narrow";   labelColor = "#9898b8"; }
  else                       { label = "Single";   labelColor = "#f87171"; }

  return { branches, activeCount, label, labelColor };
}
