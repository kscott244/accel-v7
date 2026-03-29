// ─── DSO WAR ROOM — lib ──────────────────────────────────────────────────────
// Benchmark math, opportunity statements, family coverage, sort logic.
// All deterministic — no AI, no hallucination risk.

// ── Benchmarks (from actual territory data analysis) ─────────────
export const BENCH_AVG       = 747;   // avg Q1 spend per solo private practice
export const BENCH_TOP       = 1498;  // top-quartile Q1 spend per office
export type  BenchMode       = "avg" | "top";

// ── Strategic account inclusion thresholds ────────────────────────
// Centralized — do not scatter these in UI components.
// A group appears in War Room if ANY rule matches (unless forceExclude).
export const WR_THRESHOLDS = {
  minLocs:        5,      // 5+ locations = multi-site worth tracking
  minCyQ1:        10000,  // $10K+ CY Q1 = already meaningful revenue
  minBenchGapAnn: 25000,  // $25K+ annual benchmark gap = real opportunity
} as const;

export type IncludeReason = "DSO" | "Multi-site" | "Large gap" | "Strategic" | "Pinned";

// Returns null if excluded, otherwise returns the primary reason for inclusion
export function shouldInclude(
  group: any,
  card: DsoCard,
  intel: any,
): IncludeReason | null {
  // Always exclude the data pipeline catch-all bucket — not a real account
  if (group.id === "Master-Unmatched") return null;
  // Exclude groups with no real name
  const rawName = (group.name || "").toUpperCase();
  if (rawName.startsWith("UNMATCHED")) return null;
  const gIntel = intel?.[group.id] || {};
  if (gIntel.forceExclude) return null;
  if (gIntel.forceInclude || gIntel.pinned) return "Pinned";
  const c2 = (group.class2 || "").toUpperCase();
  if (c2 === "DSO" || c2 === "EMERGING DSO" || c2.includes("DSO")) return "DSO";
  if (card.locs >= WR_THRESHOLDS.minLocs && card.cy1 >= WR_THRESHOLDS.minCyQ1) return "Multi-site";
  if (card.benchGapAnn >= WR_THRESHOLDS.minBenchGapAnn) return "Large gap";
  if (card.locs >= WR_THRESHOLDS.minLocs) return "Multi-site";
  return null;
}

// ── Product families Ken sells ────────────────────────────────────
export const DSO_FAMILIES = ["COMPOSITE","BOND","CEMENT","INFECTION CONTROL","TEMP CEMENT"] as const;
export type  ProductFamily = typeof DSO_FAMILIES[number];

const FAMILY_KEYWORDS: Record<ProductFamily, string[]> = {
  "COMPOSITE":         ["SIMPLISHADE","HARMONIZE","SONICFILL","HERCULITE","POINT 4","PREMISE","FLOW-IT","VERTISE","REVOLUTION"],
  "BOND":              ["OPTIBOND","BOND-1","BOND1"],
  "CEMENT":            ["MAXCEM","NX3","NEXUS","SIMILE","CEMENT IT"],
  "INFECTION CONTROL": ["CAVIWIPES","CAVICIDE"],
  "TEMP CEMENT":       ["TEMPBOND"],
};

export function familyOfProduct(name: string): ProductFamily | null {
  const u = name.toUpperCase();
  for (const [fam, keys] of Object.entries(FAMILY_KEYWORDS) as [ProductFamily, string[]][]) {
    if (keys.some(k => u.includes(k))) return fam;
  }
  return null;
}

export function coverageOf(group: any, qk = "1"): { present: ProductFamily[]; missing: ProductFamily[] } {
  const present = new Set<ProductFamily>();
  for (const child of (group.children || [])) {
    for (const p of (child.products || [])) {
      const cy = p[`cy${qk}`] || 0;
      const py = p[`py${qk}`] || 0;
      if (cy > 0 || py > 0) {
        const fam = familyOfProduct(p.n || "");
        if (fam) present.add(fam);
      }
    }
  }
  const presentArr = DSO_FAMILIES.filter(f => present.has(f));
  const missingArr = DSO_FAMILIES.filter(f => !present.has(f));
  return { present: presentArr, missing: missingArr };
}

// ── Confidence badge ──────────────────────────────────────────────
// Observed = group has 3+ children with real revenue
// Partial  = 1-2 children with revenue, or locs > children with revenue
// Estimated = 0 children with real revenue (all from overlay locs)
export type Confidence = "Observed" | "Partial" | "Estimated";

export function confidenceOf(group: any, qk = "1"): Confidence {
  const withRev = (group.children || []).filter((c: any) =>
    (c.cyQ?.[qk] || 0) > 0 || (c.pyQ?.[qk] || 0) > 0
  ).length;
  if (withRev >= 3) return "Observed";
  if (withRev >= 1) return "Partial";
  return "Estimated";
}

// ── Opportunity statement (deterministic template) ────────────────
export function opportunityStatement(
  group: any,
  cy1: number,
  benchPerOffice: number,
  locs: number,
): string {
  const perOffice   = locs > 0 ? Math.round(cy1 / locs) : 0;
  const benchQ      = benchPerOffice * locs;
  const gapQ        = Math.max(0, benchQ - cy1);
  const gapAnnual   = gapQ * 4;
  const tier        = group.tier || "Standard";
  const tierText    = ["Diamond","Platinum","Gold","Silver"].includes(tier)
    ? `${tier} pricing already in place.`
    : "Standard pricing.";
  const dollarFmt   = (n: number) => n >= 1000 ? `$${Math.round(n/1000)}K` : `$${Math.round(n)}`;

  return `${locs} offices at ${dollarFmt(perOffice)}/office vs ${dollarFmt(benchPerOffice)} benchmark` +
    ` — ${dollarFmt(gapQ)} quarterly gap / ${dollarFmt(gapAnnual)} annualized upside. ${tierText}`;
}

// ── DSO card data shape ───────────────────────────────────────────
export interface DsoCard {
  group:         any;
  locs:          number;
  cy1:           number;
  py1:           number;
  perOffice:     number;
  benchQ:        number;
  benchGapQ:     number;
  benchGapAnn:   number;
  momentum:      number;   // cy1 - py1
  coverage:      { present: ProductFamily[]; missing: ProductFamily[] };
  confidence:    Confidence;
  statement:     string;
  includeReason: IncludeReason;
}

export function buildDsoCard(group: any, benchMode: BenchMode, qk = "1"): DsoCard {
  const locs    = group.locs || 1;
  const cy1     = group.children?.reduce((s: number, c: any) => s + (c.cyQ?.[qk] || 0), 0) || 0;
  const py1     = group.children?.reduce((s: number, c: any) => s + (c.pyQ?.[qk] || 0), 0) || 0;
  const bench   = benchMode === "avg" ? BENCH_AVG : BENCH_TOP;
  const benchQ  = bench * locs;
  const perOff  = locs > 0 ? cy1 / locs : 0;
  const gapQ    = Math.max(0, benchQ - cy1);

  return {
    group,
    locs,
    cy1,
    py1,
    perOffice:   perOff,
    benchQ,
    benchGapQ:   gapQ,
    benchGapAnn: gapQ * 4,
    momentum:    cy1 - py1,
    coverage:    coverageOf(group, qk),
    confidence:  confidenceOf(group, qk),
    statement:   opportunityStatement(group, cy1, bench, locs),
  };
}

// ── Sort modes ────────────────────────────────────────────────────
export type SortMode = "gap" | "perOffice" | "momentum" | "pinned";

export function sortCards(cards: DsoCard[], mode: SortMode, intel: Record<string, any>): DsoCard[] {
  const pinned = (g: any) => intel[g.id]?.pinned ? -1 : 0;
  return [...cards].sort((a, b) => {
    if (mode === "pinned") {
      const pd = pinned(a.group) - pinned(b.group);
      if (pd !== 0) return pd;
      return b.benchGapQ - a.benchGapQ;
    }
    if (mode === "gap")       return b.benchGapQ    - a.benchGapQ;
    if (mode === "perOffice") return a.perOffice     - b.perOffice;
    if (mode === "momentum")  return b.momentum      - a.momentum;
    return b.benchGapQ - a.benchGapQ;
  });
}

// ── Intel overlay defaults ────────────────────────────────────────
export const STATUS_OPTS   = ["No Contact","In Progress","Meeting Set","Active Push"] as const;
export const STRATEGY_OPTS = ["Corporate Procurement","Regional Leadership","Local Doctor Conversion","Distributor Driven","Unknown"] as const;
export type  StatusOpt     = typeof STATUS_OPTS[number];
export type  StrategyOpt   = typeof STRATEGY_OPTS[number];

export interface DsoIntel {
  procurementContact?: string;
  procurementPhone?:   string;
  competitor?:         string;
  owner?:              string;
  lastContact?:        string;
  status?:             StatusOpt;
  strategy?:           StrategyOpt;
  accelTier?:          string;
  pinned?:             boolean;
  forceInclude?:       boolean;  // pull into War Room regardless of class2/size
  forceExclude?:       boolean;  // remove from War Room regardless of rules
  notes?:              string;
  teamOppQ?:           number | null;
}

export function getIntel(overlays: any, groupId: string): DsoIntel {
  return overlays?.dsoIntel?.[groupId] || {};
}
