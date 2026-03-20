import type { Office, Group, Product } from "@/types";
import { OFFICES, GROUPS, PRODUCTS, WEEK_ROUTES } from "@/data";
import {
  fmtK, fmtCurrency, fmtPct,
  Q_TARGETS, Q_CY_ACTUAL, ZONE_SCHEDULE,
  currentQuarter, daysLeftInQuarter,
} from "@/lib/utils";

// ═══════════════════════════════════════════════════════════
// INSIGHT TYPES
// ═══════════════════════════════════════════════════════════

export type InsightPriority = "critical" | "warning" | "info" | "positive";
export type InsightCategory = "visit" | "revenue" | "account" | "product" | "quota";

export interface Insight {
  id: string;
  priority: InsightPriority;
  category: InsightCategory;
  title: string;
  body: string;
  action?: string;
  actionLabel?: string;
  office?: Office;
  value?: number;
}

export interface DayBriefing {
  greeting: string;
  dateLabel: string;
  dayOfWeek: string;
  zone: string;
  quotaSnap: {
    pct: number;
    credited: number;
    target: number;
    gap: number;
    daysLeft: number;
    dailyNeeded: number;
  };
  todayStops: number;
  criticalAlerts: Insight[];
  opportunities: Insight[];
  positives: Insight[];
  topCallbacks: Office[];
}

// ═══════════════════════════════════════════════════════════
// INSIGHT GENERATORS
// ═══════════════════════════════════════════════════════════

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function getDayOfWeek(): string {
  return new Date().toLocaleDateString("en-US", { weekday: "long" });
}

function getDateLabel(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function generateVisitAlerts(): Insight[] {
  const alerts: Insight[] = [];

  // Top accounts not visited in 60+ days (only those with daysSince data)
  const neglected = OFFICES
    .filter((o) => (o.daysSince ?? 0) >= 60 && o.py >= 3000)
    .sort((a, b) => b.py - a.py)
    .slice(0, 5);

  neglected.forEach((o, i) => {
    const severity: InsightPriority = (o.daysSince ?? 0) > 120 ? "critical" : "warning";
    alerts.push({
      id: `neglect-${i}`,
      priority: severity,
      category: "visit",
      title: `${o.name} — ${o.daysSince} days since visit`,
      body: `${fmtK(o.py)} PY account in ${o.city}. ${o.mainDoctor ? o.mainDoctor + ". " : ""}Gap: ${fmtK(o.gap)}.`,
      office: o,
      value: o.py,
    });
  });

  return alerts;
}

function generateRevenueInsights(): Insight[] {
  const insights: Insight[] = [];
  const cq = currentQuarter();
  const target = Q_TARGETS[cq] || 0;
  const actual = Q_CY_ACTUAL[cq] || 0;
  const gap = target - actual;
  const daysLeft = daysLeftInQuarter(cq);
  const dailyNeeded = daysLeft > 0 ? gap / daysLeft : 0;
  const dailyRunRate = 8059; // CY run rate

  if (dailyNeeded > dailyRunRate * 1.5) {
    insights.push({
      id: "pace-critical",
      priority: "critical",
      category: "quota",
      title: `Need ${fmtCurrency(Math.round(dailyNeeded))}/day to hit Q${cq}`,
      body: `Current pace is ${fmtCurrency(dailyRunRate)}/day. You need ${((dailyNeeded / dailyRunRate - 1) * 100).toFixed(0)}% acceleration to close the ${fmtK(gap)} gap in ${daysLeft} days.`,
      value: dailyNeeded,
    });
  } else if (dailyNeeded > dailyRunRate) {
    insights.push({
      id: "pace-warning",
      priority: "warning",
      category: "quota",
      title: `Q${cq} gap is ${fmtK(gap)} with ${daysLeft} days left`,
      body: `At current pace you'll land ~${fmtPct((actual + dailyRunRate * daysLeft) / target * 100)} of target. Push the top gap accounts to close the difference.`,
      value: gap,
    });
  }

  // Accounts that went dark (had PY spend but $0 CY)
  const goneDark = OFFICES
    .filter((o) => o.py > 1000 && o.cy === 0 && !o.isExpansion)
    .sort((a, b) => b.py - a.py);

  if (goneDark.length > 0) {
    const totalDarkSpend = goneDark.reduce((s, o) => s + o.py, 0);
    insights.push({
      id: "dark-accounts",
      priority: "warning",
      category: "revenue",
      title: `${goneDark.length} accounts went dark — ${fmtK(totalDarkSpend)} PY at risk`,
      body: `Top: ${goneDark[0].name} (${fmtK(goneDark[0].py)} PY), ${goneDark.length > 1 ? goneDark[1].name : ""}.${goneDark.length > 2 ? ` +${goneDark.length - 2} more.` : ""}`,
      value: totalDarkSpend,
    });
  }

  return insights;
}

function generateAccountInsights(): Insight[] {
  const insights: Insight[] = [];

  // Accelerate upsell opportunities — accounts with enough spend for a tier upgrade
  const accelCandidates = OFFICES
    .filter((o) => !o.accelLevel && o.py >= 8000)
    .sort((a, b) => b.py - a.py)
    .slice(0, 3);

  if (accelCandidates.length > 0) {
    insights.push({
      id: "accel-opps",
      priority: "info",
      category: "account",
      title: `${accelCandidates.length} accounts qualify for Accelerate enrollment`,
      body: `${accelCandidates.map((o) => `${o.name} (${fmtK(o.py)})`).join(", ")}. Locking them into a tier builds stickiness.`,
    });
  }

  // Multi-location groups losing share
  const decliningGroups = GROUPS
    .filter((g) => g.loc_count >= 3 && g.py_total > 10000)
    .filter((g) => g.cy_total / g.py_total < 0.12)
    .sort((a, b) => b.py_total - a.py_total)
    .slice(0, 3);

  decliningGroups.forEach((g, i) => {
    const ret = g.py_total > 0 ? (g.cy_total / g.py_total * 100).toFixed(0) : "0";
    insights.push({
      id: `declining-group-${i}`,
      priority: "warning",
      category: "account",
      title: `${g.name} — ${g.loc_count} locations, only ${ret}% retention`,
      body: `${fmtK(g.py_total)} PY group. Could recover ${fmtK(g.py_total * 0.25)} at 25% retention.`,
      value: g.py_total,
    });
  });

  return insights;
}

function generateProductInsights(): Insight[] {
  const insights: Insight[] = [];

  // Best performing products (momentum)
  const bestRetention = [...PRODUCTS]
    .filter((p) => p.py > 5000 && p.cy > 0)
    .sort((a, b) => (b.cy / b.py) - (a.cy / a.py))
    .slice(0, 3);

  if (bestRetention.length > 0 && bestRetention[0].cy / bestRetention[0].py > 0.2) {
    insights.push({
      id: "product-momentum",
      priority: "positive",
      category: "product",
      title: `${bestRetention[0].name} leading at ${((bestRetention[0].cy / bestRetention[0].py) * 100).toFixed(0)}% retention`,
      body: `Your strongest product. ${bestRetention.slice(1).map((p) => `${p.name} (${((p.cy / p.py) * 100).toFixed(0)}%)`).join(", ")} also doing well. Lead conversations with these.`,
    });
  }

  // Biggest drops
  const biggestDrops = [...PRODUCTS]
    .filter((p) => p.py > 20000)
    .sort((a, b) => a.growthPct - b.growthPct)
    .slice(0, 2);

  if (biggestDrops.length > 0 && biggestDrops[0].growthPct < -85) {
    insights.push({
      id: "product-drop",
      priority: "info",
      category: "product",
      title: `${biggestDrops[0].name} retention at ${((biggestDrops[0].cy / biggestDrops[0].py) * 100).toFixed(1)}%`,
      body: `${fmtK(biggestDrops[0].py)} PY → ${fmtK(biggestDrops[0].cy)} CY. This is expected for partial-year YTD, but worth monitoring product-level declines vs. account-level.`,
    });
  }

  return insights;
}

function getTopCallbacks(): Office[] {
  return OFFICES
    .filter((o) => o.visitPriority === "NOW" && o.gap > 500)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 5);
}

// ═══════════════════════════════════════════════════════════
// MAIN BRIEFING GENERATOR
// ═══════════════════════════════════════════════════════════

export function generateBriefing(): DayBriefing {
  const cq = currentQuarter();
  const target = Q_TARGETS[cq] || 0;
  const actual = Q_CY_ACTUAL[cq] || 0;
  const gap = Math.max(0, target - actual);
  const daysLeft = daysLeftInQuarter(cq);
  const pct = target > 0 ? (actual / target) * 100 : 0;
  const dailyNeeded = daysLeft > 0 ? gap / daysLeft : 0;

  const dayOfWeek = getDayOfWeek();
  const zone = ZONE_SCHEDULE[dayOfWeek] || "";

  // Count today's stops
  const dayStops = WEEK_ROUTES.routes[dayOfWeek] || [];

  // Gather all insights
  const visitAlerts = generateVisitAlerts();
  const revenueInsights = generateRevenueInsights();
  const accountInsights = generateAccountInsights();
  const productInsights = generateProductInsights();

  const allInsights = [...visitAlerts, ...revenueInsights, ...accountInsights, ...productInsights];

  const criticalAlerts = allInsights.filter((i) => i.priority === "critical" || i.priority === "warning");
  const opportunities = allInsights.filter((i) => i.priority === "info");
  const positives = allInsights.filter((i) => i.priority === "positive");

  return {
    greeting: getGreeting(),
    dateLabel: getDateLabel(),
    dayOfWeek,
    zone,
    quotaSnap: {
      pct,
      credited: actual,
      target,
      gap,
      daysLeft,
      dailyNeeded,
    },
    todayStops: dayStops.length,
    criticalAlerts: criticalAlerts.sort((a, b) => (b.value || 0) - (a.value || 0)),
    opportunities,
    positives,
    topCallbacks: getTopCallbacks(),
  };
}
