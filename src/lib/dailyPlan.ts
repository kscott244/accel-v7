// ─── DAILY SUCCESS PLAN ENGINE ───────────────────────────────────────────────
// Deterministic daily prioritization layer.
// Ranks groups by combined signals: revenue risk, opportunity size,
// contact readiness, account memory, and task urgency.
// No AI. No hallucinated data. Every recommendation is grounded in real signals.

import { bestContact, bestPathIn, contactGaps } from "@/lib/contacts";
import { readMemory, lastTouchedLabel } from "@/lib/accountMemory";
import { PATH_IN_LABEL, PATH_IN_COLOR } from "@/lib/contacts";

// ── Action types ──────────────────────────────────────────────────
export type PlanActionType =
  | "call"          // direct phone call — contact on file
  | "email"         // email — no phone, have email
  | "visit"         // walk-in — no contact info
  | "via-rep"       // dealer-led — route through FSC
  | "verify"        // contact is stale — verify before calling
  | "research"      // no contact at all — research first
  | "follow-up"     // task or prior action needs follow-up
  | "review-pricing"; // account at wrong tier, pricing conversation needed

// ── Recommendation card ───────────────────────────────────────────
export interface PlanItem {
  groupId: string;
  groupName: string;
  actionType: PlanActionType;
  why: string;             // one-line reason this account is here today
  contactName?: string;    // best contact name if known
  contactPhone?: string;
  contactEmail?: string;
  pathLabel: string;       // e.g. "📞 Direct" "🤝 Via Rep"
  pathColor: string;
  urgencyScore: number;    // 0–100, higher = more urgent today
  signals: string[];       // short signal tags shown in UI
}

// ── Score one group and return a PlanItem or null ─────────────────
function scoreGroup(
  group: any,
  overlays: any,
  tasks: any[],
  qk: string = "1"
): PlanItem | null {
  const gId = group.id;
  const gName = (group._displayName || group.name || "").replace(/^(UNMATCHED|Master-Unmatched)/i, "").trim();
  if (!gName || gName.length < 2) return null;

  // Revenue signals
  const cy1  = group.children?.reduce((s: number, c: any) => s + (c.cyQ?.[qk] || 0), 0) || 0;
  const py1  = group.children?.reduce((s: number, c: any) => s + (c.pyQ?.[qk] || 0), 0) || 0;
  const gap  = Math.max(0, py1 - cy1);
  const ret  = py1 > 0 ? cy1 / py1 : 1;
  const locs = group.locs || group.children?.length || 1;

  // Skip trivial accounts — must have meaningful revenue stake or opportunity
  if (py1 < 300 && cy1 < 300) return null;

  // Contact signals
  const contacts = (overlays?.groupContacts?.[gId] || []);
  const gaps = contactGaps(contacts);
  const fscMap = overlays?.fscReps?.[gId] || {};
  const hasFsc = Object.values(fscMap).some((f: any) => f?.name);
  const best = bestContact(contacts);
  const pathIn = bestPathIn(contacts, hasFsc);

  // Memory signals
  const mem = readMemory(overlays, gId);
  const lastActDays = mem.lastActionAt
    ? (Date.now() - new Date(mem.lastActionAt).getTime()) / 86400000
    : 999;
  const lastViewDays = mem.lastViewedAt
    ? (Date.now() - new Date(mem.lastViewedAt).getTime()) / 86400000
    : 999;
  const neverTouched = lastActDays > 60 && lastViewDays > 30;
  const goingCold    = lastActDays > 14 && lastActDays < 60;

  // Task signals
  const groupTasks = (tasks || []).filter((t: any) =>
    t.groupId === gId && !t.completed
  );
  const overdueTasks = groupTasks.filter((t: any) => {
    if (!t.dueDate) return false;
    return new Date(t.dueDate) < new Date();
  });
  const hasDueTask = overdueTasks.length > 0;

  // DSO/War Room signals
  const isDso = (group.class2 || "").toUpperCase().includes("DSO");
  const isPinned = overlays?.dsoIntel?.[gId]?.pinned === true;

  // ── Score components ──────────────────────────────────────────────
  let score = 0;
  const signals: string[] = [];

  // Revenue risk (0–35)
  if (gap > 5000)       { score += 35; signals.push(`-${Math.round(gap/1000)}K vs PY`); }
  else if (gap > 2000)  { score += 25; signals.push(`-${Math.round(gap/1000)}K vs PY`); }
  else if (gap > 800)   { score += 15; signals.push(`-${Math.round(gap)}  vs PY`); }
  else if (gap > 0)     { score += 8; }

  // Retention cliff (0–20)
  if (ret < 0.3 && py1 > 500)  { score += 20; signals.push("<30% retention"); }
  else if (ret < 0.5)           { score += 12; signals.push("<50% retention"); }
  else if (ret < 0.7)           { score += 6; }

  // Account size / opportunity weight (0–15)
  if (py1 > 10000)     { score += 15; }
  else if (py1 > 5000) { score += 10; }
  else if (py1 > 2000) { score += 5; }

  // Contact readiness (0–12)
  // Contacts make the account more actionable TODAY
  if (gaps.hasAnyContact && !gaps.staleOnly) { score += 12; }
  else if (gaps.staleOnly)                    { score += 4; signals.push("Stale contact"); }
  else if (!gaps.hasAnyContact)               {
    score += 2; // No contact — still show but deprioritize
    signals.push("No contact on file");
  }

  // Memory signals (0–15)
  if (hasDueTask)           { score += 15; signals.push("Overdue task"); }
  if (isPinned)             { score += 12; signals.push("Pinned"); }
  if (goingCold)            { score += 8;  signals.push("Going cold"); }
  if (neverTouched && py1 > 1000) { score += 5; signals.push("Not yet worked"); }

  // DSO bonus (0–8)
  if (isDso && locs >= 3)  { score += 8; }

  // Dealer-led: slight deprioritize vs direct path
  if (pathIn === "dealer-led") { score -= 3; }

  // ── Build why line ────────────────────────────────────────────────
  let why = "";
  if (hasDueTask)             why = overdueTasks[0]?.action || "Overdue task needs follow-up";
  else if (gap > 2000)        why = `Down ${Math.round(gap/1000)}K vs PY — needs attention`;
  else if (ret < 0.4 && py1 > 500) why = `Only ${Math.round(ret*100)}% of PY — at risk of losing`;
  else if (isPinned)          why = "Pinned strategic account";
  else if (goingCold)         why = "${Math.round(lastActDays)}d since last action — going cold";
  else if (!gaps.hasAnyContact) why = "No contact on file — research before next move";
  else if (gaps.staleOnly)    why = "Contact may be stale — verify before calling";
  else                        why = py1 > 2000 ? `${Math.round(ret*100)}% retention — worth a check-in` : "Active account";

  // ── Determine action type ─────────────────────────────────────────
  let actionType: PlanActionType;
  if (hasDueTask)                                { actionType = "follow-up"; }
  else if (!gaps.hasAnyContact)                  { actionType = "research"; }
  else if (gaps.staleOnly)                       { actionType = "verify"; }
  else if (pathIn === "direct-phone")            { actionType = "call"; }
  else if (pathIn === "direct-email")            { actionType = "email"; }
  else if (pathIn === "dealer-led")              { actionType = "via-rep"; }
  else                                           { actionType = "visit"; }

  return {
    groupId:      gId,
    groupName:    gName,
    actionType,
    why,
    contactName:  best?.name,
    contactPhone: best?.phone,
    contactEmail: best?.email,
    pathLabel:    PATH_IN_LABEL[pathIn],
    pathColor:    PATH_IN_COLOR[pathIn],
    urgencyScore: Math.min(100, score),
    signals:      signals.slice(0, 3),
  };
}

// ── Build the full daily plan ─────────────────────────────────────
// Returns top N ranked items. Dedupes by groupId.
export function buildDailyPlan(
  groups: any[],
  overlays: any,
  tasks: any[],
  opts: { qk?: string; maxItems?: number } = {}
): PlanItem[] {
  const { qk = "1", maxItems = 5 } = opts;

  const scored: PlanItem[] = [];
  for (const g of (groups || [])) {
    const item = scoreGroup(g, overlays, tasks, qk);
    if (item) scored.push(item);
  }

  // Sort descending by urgency
  scored.sort((a, b) => b.urgencyScore - a.urgencyScore);

  // Take top N, dedupe by groupId
  const seen = new Set<string>();
  const result: PlanItem[] = [];
  for (const item of scored) {
    if (seen.has(item.groupId)) continue;
    seen.add(item.groupId);
    result.push(item);
    if (result.length >= maxItems) break;
  }
  return result;
}

// ── Action labels ────────────────────────────────────────────────
export const ACTION_LABEL: Record<PlanActionType, string> = {
  "call":           "📞 Call",
  "email":          "✉ Email",
  "visit":          "🚪 Visit",
  "via-rep":        "🤝 Via Rep",
  "verify":         "⚠ Verify Contact",
  "research":       "🔍 Research First",
  "follow-up":      "📋 Follow Up",
  "review-pricing": "💰 Review Pricing",
};

export const ACTION_COLOR: Record<PlanActionType, string> = {
  "call":           "#22d3ee",
  "email":          "#4f8ef7",
  "visit":          "#7878a0",
  "via-rep":        "#a78bfa",
  "verify":         "#fbbf24",
  "research":       "#34d399",
  "follow-up":      "#f97316",
  "review-pricing": "#fbbf24",
};
