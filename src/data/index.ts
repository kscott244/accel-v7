import type {
  Group,
  Office,
  Product,
  WeekRoutes,
  GapAccount,
  TerritoryStats,
  TerritorySummary,
  Q1Signal,
  Bucket,
} from "@/types";

import groupsData from "./groups.json";
import officesData from "./offices.json";
import productsData from "./products.json";
import weekRoutesData from "./week-routes.json";
import gapAccountsData from "./gap-accounts.json";
import territorySummaryData from "./territory-summary.json";

// ═══════════════════════════════════════════════════════════
// RAW OFFICE NORMALIZER
// offices.json uses legacy field names from the Tableau export.
// This mapper translates them to the Office type at the data boundary
// so all downstream components receive a consistent shape.
// Fields not present in the raw data get safe empty/zero defaults —
// no fake values are invented here.
// ═══════════════════════════════════════════════════════════
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeOffice(raw: any): Office {
  // Top product: use first entry from prods[] if available
  const topProduct: string = raw.prods?.[0]?.l ?? "";

  return {
    // ── Identity ──────────────────────────────────────────
    name:        raw.name        ?? "",
    parent:      raw.parent      ?? "",
    parent_id:   raw.parent_id   ?? "",
    childMdmId:  raw.childMdmId  ?? raw.parent_id ?? "",
    isPrivate:   raw.isPrivate   ?? false,
    isExpansion: raw.isExpansion ?? false,

    // ── Address ───────────────────────────────────────────
    addr:  raw.addr  ?? "",
    city:  raw.city  ?? "",
    state: raw.state ?? "",
    zip:   raw.zip   ?? "",

    // ── Account metadata ──────────────────────────────────
    acctType: raw.acctType ?? "",
    opco:     raw.opco     ?? "",
    class2:   raw.class2   ?? "",
    email:    raw.email    ?? "",

    // ── Revenue ───────────────────────────────────────────
    py:    raw.py    ?? 0,
    cy:    raw.cy    ?? 0,
    gap:   raw.gap   ?? 0,
    score: raw.score ?? 0,

    // ── Q1 figures: raw uses q1py/q1cy, type expects q1_2025/q1_2026 ──
    q1_2025: raw.q1py ?? 0,
    q1_2026: raw.q1cy ?? 0,
    q1_gap:  raw.q1gap ?? 0,

    // ── Signals ───────────────────────────────────────────
    q1_signal:     raw.q1_signal     ?? "INACTIVE",
    visitPriority: raw.visitPriority ?? "MONITOR",
    bucket:        (raw.bucket as Bucket) ?? "PROTECT",

    // ── Accelerate tier: raw uses "tier", type uses "accelLevel" ──
    accelLevel: raw.tier ?? "",

    // ── Derived / enriched fields (not in raw export) ─────
    // These are genuinely absent — safe defaults, not guesses.
    topProduct,
    mainDoctor:    "",
    phone:         "",
    cell:          "",
    daysSince:     undefined,
    avgInterval:   undefined,
    lastVisit:     "",
    lastVisitNote: "",
    zone:          "",
    creditEff:     undefined,
    pm:            "",
    dealerRep:     "",
    dealer:        "",
    badgerNotes:   "",
    accelOpp:      "",
    route:         "",
    followup:      "",
    lat:           undefined,
    lng:           undefined,
    activity:      "",
  };
}

export const GROUPS: Group[] = groupsData as unknown as Group[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const OFFICES: Office[] = (officesData as any[]).map(normalizeOffice);
export const PRODUCTS: Product[] = productsData as unknown as Product[];
export const WEEK_ROUTES: WeekRoutes = weekRoutesData as unknown as WeekRoutes;
export const GAP_ACCOUNTS: GapAccount[] = gapAccountsData as unknown as GapAccount[];
export const TERRITORY_SUMMARY: TerritorySummary = territorySummaryData as unknown as TerritorySummary;

// ═══════════════════════════════════════════════════════════
// COMPUTED STATISTICS (uses grand totals from ALL accounts)
// ═══════════════════════════════════════════════════════════

export function computeTerritoryStats(): TerritoryStats {
  const totalOffices = OFFICES.length;

  const signalCounts: Record<string, number> = {};
  const bucketCounts: Record<string, number> = {};
  let diamondCount = 0;
  let platinumCount = 0;

  for (const o of OFFICES) {
    const sig = o.q1_signal;
    if (sig) signalCounts[sig] = (signalCounts[sig] || 0) + 1;

    const bk = o.bucket;
    if (bk) bucketCounts[bk] = (bucketCounts[bk] || 0) + 1;

    if (o.accelLevel === "Diamond") diamondCount++;
    if (o.accelLevel === "Platinum") platinumCount++;
  }

  // Use GRAND TOTALS (all 5,691 accounts) for revenue figures
  const totalCY = TERRITORY_SUMMARY.grandTotalCY;
  const totalPY = TERRITORY_SUMMARY.grandTotalPY;
  const retentionRate = totalPY > 0 ? (totalCY / totalPY) * 100 : 0;

  return {
    totalOffices: TERRITORY_SUMMARY.totalAccounts, // show full count
    totalGroups: GROUPS.length,
    accelEnrolled: diamondCount + platinumCount,
    diamondCount,
    platinumCount,
    totalCY,
    totalPY,
    retentionRate,
    signalCounts: signalCounts as Record<Q1Signal, number>,
    bucketCounts: bucketCounts as Record<Bucket, number>,
  };
}

// Get offices sorted by gap (highest opportunity)
export function getTopGapOffices(limit = 20): Office[] {
  return [...OFFICES]
    .filter((o) => o.gap > 0)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, limit);
}

// Get expansion opportunities (zero-spend in groups)
export function getExpansionOpps(): Office[] {
  return OFFICES.filter((o) => o.isExpansion).sort((a, b) => {
    // Sort by parent PY (bigger parent = bigger opportunity)
    const pA = GROUPS.find((g) => g.parent_id === a.parent_id);
    const pB = GROUPS.find((g) => g.parent_id === b.parent_id);
    return (pB?.py_total || 0) - (pA?.py_total || 0);
  });
}

// Get products sorted by CY spend
export function getTopProducts(limit = 15): Product[] {
  return [...PRODUCTS].sort((a, b) => b.cy - a.cy).slice(0, limit);
}

// Get products sorted by best retention
export function getBestRetentionProducts(limit = 15): Product[] {
  return [...PRODUCTS]
    .filter((p) => p.py > 0)
    .sort((a, b) => {
      const retA = a.cy / a.py;
      const retB = b.cy / b.py;
      return retB - retA;
    })
    .slice(0, limit);
}
