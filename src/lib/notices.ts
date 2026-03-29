// ─── ASSISTANT NOTICES ────────────────────────────────────────────────────────
// Deterministic notice generation layer.
// Notices are computed fresh on each render from live data — nothing is stored.
// Only dismissals are persisted (in overlays.noticeDismissals via patchOverlay).
//
// Rules:
// - Every notice must be grounded in real data signals. No hallucinations.
// - Notices must be actionable. If there is nothing to do, don't show it.
// - Keep notice counts small. Surface the most useful 3–6 at a time.

import { bestContact, contactGaps } from "@/lib/contacts";
import { readMemory } from "@/lib/accountMemory";

// ── Notice types ──────────────────────────────────────────────────
export type NoticeType =
  | "missing-contact"       // high-revenue group has no contacts
  | "stale-high-value"      // large account, long dormant, no recent action
  | "weak-path"             // contact exists but no phone/email — can only visit
  | "viewed-no-action"      // repeatedly opened, never had a task created
  | "contact-stale-only";   // contacts exist but all are stale

export type NoticeSeverity = "high" | "medium" | "low";

// ── Notice record ─────────────────────────────────────────────────
export interface Notice {
  id: string;               // deterministic: type + groupId
  type: NoticeType;
  severity: NoticeSeverity;
  area: "contacts" | "activity" | "strategy";
  title: string;
  summary: string;
  whyItMatters: string;
  suggestedAction: string;
  confidence: "certain" | "likely" | "possible";
  source: string;           // which signals produced this
  createdAt: string;        // ISO — when generated (runtime, not persisted)
  groupId: string;
  groupName: string;
  status: "active" | "dismissed" | "reviewed";
}

// ── Severity config ───────────────────────────────────────────────
export const NOTICE_SEVERITY_COLOR: Record<NoticeSeverity, string> = {
  high:   "#f87171",   // red
  medium: "#fbbf24",   // amber
  low:    "#7878a0",   // muted
};

export const NOTICE_SEVERITY_BG: Record<NoticeSeverity, string> = {
  high:   "rgba(248,113,113,.08)",
  medium: "rgba(251,191,36,.07)",
  low:    "rgba(120,120,160,.06)",
};

export const NOTICE_TYPE_ICON: Record<NoticeType, string> = {
  "missing-contact":    "👤",
  "stale-high-value":   "📉",
  "weak-path":          "🚪",
  "viewed-no-action":   "👁",
  "contact-stale-only": "⚠",
};

// ── Revenue helpers ───────────────────────────────────────────────
function groupRevenue(group: any, qk: string) {
  const py = group.children?.reduce((s: number, c: any) => s + (c.pyQ?.[qk] || 0), 0) || 0;
  const cy = group.children?.reduce((s: number, c: any) => s + (c.cyQ?.[qk] || 0), 0) || 0;
  return { py, cy, gap: Math.max(0, py - cy) };
}

function groupFYRevenue(group: any) {
  let py = 0, cy = 0;
  for (const qk of ["1","2","3","4"]) {
    py += group.children?.reduce((s: number, c: any) => s + (c.pyQ?.[qk] || 0), 0) || 0;
    cy += group.children?.reduce((s: number, c: any) => s + (c.cyQ?.[qk] || 0), 0) || 0;
  }
  return { py, cy };
}

function cleanName(group: any): string {
  return (group._displayName || group.name || "")
    .replace(/^(UNMATCHED|Master-Unmatched)/i, "").trim();
}

// ── Notice generators ─────────────────────────────────────────────

// 1. High-revenue group with NO contacts at all
function noticesMissingContact(group: any, overlays: any, qk: string): Notice | null {
  const name = cleanName(group);
  if (!name || name.length < 2) return null;
  const { py } = groupRevenue(group, qk);
  if (py < 1500) return null; // Only flag meaningful accounts

  const contacts = overlays?.groupContacts?.[group.id] || [];
  const gaps = contactGaps(contacts);
  if (gaps.hasAnyContact) return null; // Already have someone

  const id = `missing-contact:${group.id}`;
  return {
    id, type: "missing-contact", severity: py > 5000 ? "high" : "medium",
    area: "contacts",
    title: "No contact on file",
    summary: `${name} has no contacts recorded.`,
    whyItMatters: `This account had $${Math.round(py/1000)}K PY revenue. Without a contact you're relying on walk-ins.`,
    suggestedAction: "Open account → run Deep Research or add a contact manually.",
    confidence: "certain",
    source: `py=${py}, contacts=0`,
    createdAt: new Date().toISOString(),
    groupId: group.id, groupName: name, status: "active",
  };
}

// 2. High-value account, no action in 60+ days
function noticesStaleHighValue(group: any, overlays: any, qk: string): Notice | null {
  const name = cleanName(group);
  if (!name || name.length < 2) return null;
  const { py, cy } = groupRevenue(group, qk);
  const { py: fyPY } = groupFYRevenue(group);
  if (fyPY < 3000) return null;

  const mem = readMemory(overlays, group.id);
  const lastActDays = mem.lastActionAt
    ? (Date.now() - new Date(mem.lastActionAt).getTime()) / 86400000 : 999;
  if (lastActDays < 45) return null; // Not stale yet

  // Must have something to protect or recover
  const gap = Math.max(0, py - cy);
  if (gap < 500 && fyPY < 5000) return null;

  const id = `stale-high-value:${group.id}`;
  const daysLabel = lastActDays > 300 ? "never recorded" : `${Math.round(lastActDays)}d ago`;
  return {
    id, type: "stale-high-value", severity: fyPY > 8000 ? "high" : "medium",
    area: "activity",
    title: "High-value account gone quiet",
    summary: `${name} — last action: ${daysLabel}.`,
    whyItMatters: `$${Math.round(fyPY/1000)}K annual account with no recent engagement.${gap > 500 ? ` Down $${Math.round(gap)} vs PY.` : ""}`,
    suggestedAction: "Schedule a check-in call or visit before this account drifts further.",
    confidence: lastActDays > 200 ? "certain" : "likely",
    source: `fyPY=${fyPY}, lastAct=${Math.round(lastActDays)}d`,
    createdAt: new Date().toISOString(),
    groupId: group.id, groupName: name, status: "active",
  };
}

// 3. Has a contact but no phone or email — office visit only
function noticesWeakPath(group: any, overlays: any, qk: string): Notice | null {
  const name = cleanName(group);
  if (!name || name.length < 2) return null;
  const { py } = groupRevenue(group, qk);
  if (py < 2000) return null;

  const contacts = overlays?.groupContacts?.[group.id] || [];
  const gaps = contactGaps(contacts);
  if (!gaps.hasAnyContact) return null; // Already flagged by missing-contact
  if (!gaps.missingPhone || !gaps.missingEmail) return null; // Have at least one channel
  if (gaps.staleOnly) return null; // stale-only has its own notice

  const id = `weak-path:${group.id}`;
  return {
    id, type: "weak-path", severity: "medium",
    area: "contacts",
    title: "Contact has no phone or email",
    summary: `${name} — contact on file but no reachable channel.`,
    whyItMatters: `$${Math.round(py/1000)}K account can only be reached by walking in. You're losing scheduling flexibility.`,
    suggestedAction: "Ask for a direct number or email on next visit. Update the contact.",
    confidence: "certain",
    source: `py=${py}, missingPhone=true, missingEmail=true`,
    createdAt: new Date().toISOString(),
    groupId: group.id, groupName: name, status: "active",
  };
}

// 4. Account viewed multiple times recently with no task ever created
function noticesViewedNoAction(group: any, overlays: any): Notice | null {
  if (typeof window === "undefined") return null;
  const name = cleanName(group);
  if (!name || name.length < 2) return null;

  // Check event log for repeated views
  let viewCount = 0;
  try {
    const events = JSON.parse(localStorage.getItem("accel_events_v1") || "[]");
    const cutoff = Date.now() - 14 * 86400000; // 14 days
    viewCount = events.filter((e: any) =>
      e.groupId === group.id && e.type === "group:viewed" &&
      new Date(e.ts).getTime() > cutoff
    ).length;
  } catch { return null; }

  if (viewCount < 3) return null; // Only flag if opened 3+ times in 14 days

  // Must not already have a task
  const hasTasks = (overlays?.tasks || []).some((t: any) =>
    t.groupId === group.id && !t.completed
  );
  if (hasTasks) return null;

  const id = `viewed-no-action:${group.id}`;
  return {
    id, type: "viewed-no-action", severity: "low",
    area: "activity",
    title: "Reviewed repeatedly, no next step set",
    summary: `${name} opened ${viewCount}x in last 14 days — no open task.`,
    whyItMatters: "Frequent attention without a committed next step means this account is stuck in review mode.",
    suggestedAction: "Open account → create a task with a due date to force a concrete commitment.",
    confidence: "certain",
    source: `views=${viewCount} in 14d, tasks=0`,
    createdAt: new Date().toISOString(),
    groupId: group.id, groupName: name, status: "active",
  };
}

// 5. Contacts exist but ALL are stale — on a high-value account
function noticesStaleContacts(group: any, overlays: any, qk: string): Notice | null {
  const name = cleanName(group);
  if (!name || name.length < 2) return null;
  const { py } = groupRevenue(group, qk);
  if (py < 1500) return null;

  const contacts = overlays?.groupContacts?.[group.id] || [];
  const gaps = contactGaps(contacts);
  if (!gaps.hasAnyContact) return null; // handled by missing-contact
  if (!gaps.staleOnly) return null;

  const id = `contact-stale-only:${group.id}`;
  return {
    id, type: "contact-stale-only", severity: "medium",
    area: "contacts",
    title: "All contacts are stale",
    summary: `${name} — contacts on file but all marked stale.`,
    whyItMatters: `$${Math.round(py/1000)}K account. Calling on a stale contact wastes the visit.`,
    suggestedAction: "Verify contact is still there before next outreach. Update confidence after confirmation.",
    confidence: "certain",
    source: `py=${py}, staleOnly=true`,
    createdAt: new Date().toISOString(),
    groupId: group.id, groupName: name, status: "active",
  };
}

// ── Main generator ────────────────────────────────────────────────
// Runs all generators, applies dismissals, returns top N notices.
export function buildNotices(
  groups: any[],
  overlays: any,
  opts: { qk?: string; maxItems?: number } = {}
): Notice[] {
  const { qk = "1", maxItems = 6 } = opts;
  const dismissed: Set<string> = new Set(overlays?.noticeDismissals || []);

  const all: Notice[] = [];

  for (const g of (groups || [])) {
    if (!g || !g.id) continue;

    const n1 = noticesMissingContact(g, overlays, qk);
    if (n1 && !dismissed.has(n1.id)) all.push(n1);

    const n2 = noticesStaleHighValue(g, overlays, qk);
    if (n2 && !dismissed.has(n2.id)) all.push(n2);

    const n3 = noticesWeakPath(g, overlays, qk);
    if (n3 && !dismissed.has(n3.id)) all.push(n3);

    const n4 = noticesViewedNoAction(g, overlays);
    if (n4 && !dismissed.has(n4.id)) all.push(n4);

    const n5 = noticesStaleContacts(g, overlays, qk);
    if (n5 && !dismissed.has(n5.id)) all.push(n5);
  }

  // Sort: high severity first, then by most actionable type
  const SEVERITY_ORDER: Record<NoticeSeverity, number> = { high: 0, medium: 1, low: 2 };
  const TYPE_ORDER: Record<NoticeType, number> = {
    "missing-contact":    0,
    "stale-high-value":   1,
    "contact-stale-only": 2,
    "weak-path":          3,
    "viewed-no-action":   4,
  };
  all.sort((a, b) => {
    const sevDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return TYPE_ORDER[a.type] - TYPE_ORDER[b.type];
  });

  return all.slice(0, maxItems);
}
