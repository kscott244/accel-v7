// ─── ASSISTANT INBOX ─────────────────────────────────────────────────────────
// Deterministic proposed-action layer.
// Actions are computed fresh from live signals — nothing is stored except
// per-item status (approved / dismissed / reviewed) in overlays.inboxItems.
//
// Rules:
// - Every action must be grounded in real data signals. No hallucinated data.
// - Actions must propose something concrete and completable.
// - Keep item counts manageable: max 10 at a time.
// - Approval-first: nothing happens automatically.

import { bestContact, bestPathIn, contactGaps } from "@/lib/contacts";
import { readMemory } from "@/lib/accountMemory";

// ── Action types ──────────────────────────────────────────────────
export type InboxActionType =
  | "draft_email"                   // strong account, have email, no recent action
  | "create_task"                   // high-priority account needs a next step
  | "schedule_followup_block"       // stale opportunity needs time blocked
  | "research_contact"              // high-value account, no contact on file
  | "pricing_review_recommendation" // account likely at wrong tier
  | "dealer_followup"               // dealer-linked account going cold
  | "account_review";               // high-PY account needs strategic review

export type InboxPriority = "critical" | "high" | "medium" | "low";
export type InboxStatus   = "pending" | "approved" | "dismissed" | "reviewed";

// ── Action record ─────────────────────────────────────────────────
export interface InboxItem {
  id: string;              // deterministic: type + groupId
  type: InboxActionType;
  priority: InboxPriority;
  status: InboxStatus;
  groupId: string;
  groupName: string;
  title: string;
  summary: string;
  rationale: string;
  suggestedPayload?: {     // pre-filled data for the action
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
    taskTitle?: string;
    dueDate?: string;
    notes?: string;
  };
  confidence: "certain" | "likely" | "possible";
  requiresApproval: boolean;
  createdAt: string;
  source: string;          // signal description
}

// ── Priority config ───────────────────────────────────────────────
export const INBOX_PRIORITY_COLOR: Record<InboxPriority, string> = {
  critical: "#f87171",
  high:     "#fbbf24",
  medium:   "#4f8ef7",
  low:      "#7878a0",
};

export const INBOX_PRIORITY_BG: Record<InboxPriority, string> = {
  critical: "rgba(248,113,113,.08)",
  high:     "rgba(251,191,36,.07)",
  medium:   "rgba(79,142,247,.07)",
  low:      "rgba(120,120,160,.05)",
};

export const INBOX_ACTION_ICON: Record<InboxActionType, string> = {
  "draft_email":                   "✉️",
  "create_task":                   "✅",
  "schedule_followup_block":       "📅",
  "research_contact":              "🔍",
  "pricing_review_recommendation": "💰",
  "dealer_followup":               "🤝",
  "account_review":                "📋",
};

export const INBOX_ACTION_LABEL: Record<InboxActionType, string> = {
  "draft_email":                   "Draft Email",
  "create_task":                   "Create Task",
  "schedule_followup_block":       "Schedule Follow-up",
  "research_contact":              "Research Contact",
  "pricing_review_recommendation": "Review Pricing",
  "dealer_followup":               "Dealer Follow-up",
  "account_review":                "Account Review",
};

// ── Generator ────────────────────────────────────────────────────
export function buildInboxItems(
  groups: any[],
  overlays: any,
  tasks: any[],
  opts: { qk?: string; maxItems?: number } = {}
): InboxItem[] {
  const qk       = opts.qk || "1";
  const maxItems = opts.maxItems || 10;
  const today    = new Date().toISOString().slice(0, 10);
  const dismissed: string[] = (overlays?.inboxItems || [])
    .filter((i: any) => i.status === "dismissed")
    .map((i: any) => i.id);
  const statusMap: Record<string, InboxStatus> = {};
  for (const item of (overlays?.inboxItems || [])) {
    statusMap[item.id] = item.status;
  }

  const items: InboxItem[] = [];

  for (const group of groups) {
    if (items.length >= maxItems * 3) break; // collect more, sort + trim later

    const gId   = group.id;
    const gName = (group._displayName || group.name || "").replace(/^(UNMATCHED|Master-Unmatched)/i, "").trim();
    if (!gName || gName.length < 2) continue;

    const cy   = group.children?.reduce((s: number, c: any) => s + (c.cyQ?.[qk] || 0), 0) || 0;
    const py   = group.children?.reduce((s: number, c: any) => s + (c.pyQ?.[qk] || 0), 0) || 0;
    const gap  = Math.max(0, py - cy);
    const locs = group.locs || group.children?.length || 1;

    if (py < 500 && cy < 500) continue; // skip tiny accounts

    const contacts  = overlays?.groupContacts?.[gId] || [];
    const gaps      = contactGaps(contacts);
    const best      = bestContact(contacts);
    const fscMap    = overlays?.fscReps?.[gId] || {};
    const hasFsc    = Object.values(fscMap).some((f: any) => f?.name);
    const pathIn    = bestPathIn(contacts, hasFsc);
    const mem       = readMemory(overlays, gId);

    const lastActDays = mem.lastActionAt
      ? (Date.now() - new Date(mem.lastActionAt).getTime()) / 86400000
      : 999;
    const lastViewDays = mem.lastViewedAt
      ? (Date.now() - new Date(mem.lastViewedAt).getTime()) / 86400000
      : 999;

    const groupTasks = (tasks || []).filter((t: any) => t.groupId === gId && !t.completed);
    const hasNextStep = groupTasks.length > 0;
    const intel = overlays?.groupIntel?.[gId];

    // ── RULE 1: High-gap account, no contact on file → research_contact ──────
    if (gap > 2000 && contacts.length === 0) {
      const id = `research_contact:${gId}`;
      if (!dismissed.includes(id)) {
        items.push({
          id,
          type: "research_contact",
          priority: gap > 5000 ? "critical" : "high",
          status: statusMap[id] || "pending",
          groupId: gId,
          groupName: gName,
          title: `Find contact at ${gName}`,
          summary: `$${Math.round(gap / 1000)}K gap but no contact on file.`,
          rationale: `${gName} had $${Math.round(py / 1000)}K last year but is missing ${Math.round(gap / py * 100)}% of that this Q. Without a contact path, there's no way to address this.`,
          confidence: "certain",
          requiresApproval: true,
          createdAt: today,
          source: `py=${py}, gap=${gap}, contacts=0`,
        });
      }
    }

    // ── RULE 2: Have email, account going cold → draft_email ─────────────────
    if (
      py > 1500 &&
      best?.email &&
      lastActDays > 30 &&
      gap > 500
    ) {
      const id = `draft_email:${gId}`;
      if (!dismissed.includes(id)) {
        items.push({
          id,
          type: "draft_email",
          priority: gap > 3000 ? "high" : "medium",
          status: statusMap[id] || "pending",
          groupId: gId,
          groupName: gName,
          title: `Email ${best.name || gName}`,
          summary: `${Math.round(lastActDays)}d since last action — email re-engagement.`,
          rationale: `${gName} is ${Math.round(lastActDays)}d without contact and has a $${Math.round(gap / 1000)}K gap this quarter.`,
          suggestedPayload: {
            contactName:  best.name,
            contactEmail: best.email,
          },
          confidence: "likely",
          requiresApproval: true,
          createdAt: today,
          source: `lastActDays=${Math.round(lastActDays)}, gap=${gap}, email=${best.email}`,
        });
      }
    }

    // ── RULE 3: High-priority account, no next step → create_task ────────────
    if (py > 2000 && !hasNextStep && lastActDays > 21) {
      const id = `create_task:${gId}`;
      if (!dismissed.includes(id)) {
        const dueDate = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
        items.push({
          id,
          type: "create_task",
          priority: gap > 3000 ? "high" : "medium",
          status: statusMap[id] || "pending",
          groupId: gId,
          groupName: gName,
          title: `Set next step for ${gName}`,
          summary: `No open tasks — ${Math.round(lastActDays)}d without any action.`,
          rationale: `High-value account ($${Math.round(py / 1000)}K PY) with no follow-up queued and ${Math.round(lastActDays)}d of inactivity.`,
          suggestedPayload: {
            taskTitle: `Follow up with ${gName}`,
            dueDate,
          },
          confidence: "certain",
          requiresApproval: true,
          createdAt: today,
          source: `py=${py}, tasks=0, lastActDays=${Math.round(lastActDays)}`,
        });
      }
    }

    // ── RULE 4: Large gap + stale → schedule_followup_block ──────────────────
    if (gap > 4000 && lastActDays > 45 && !hasNextStep) {
      const id = `schedule_followup_block:${gId}`;
      if (!dismissed.includes(id)) {
        items.push({
          id,
          type: "schedule_followup_block",
          priority: "high",
          status: statusMap[id] || "pending",
          groupId: gId,
          groupName: gName,
          title: `Block time for ${gName}`,
          summary: `$${Math.round(gap / 1000)}K gap and ${Math.round(lastActDays)}d dormant.`,
          rationale: `${gName} represents a $${Math.round(gap / 1000)}K recovery opportunity and hasn't been touched in ${Math.round(lastActDays)} days. Schedule a dedicated block before Q ends.`,
          confidence: "likely",
          requiresApproval: true,
          createdAt: today,
          source: `gap=${gap}, lastActDays=${Math.round(lastActDays)}`,
        });
      }
    }

    // ── RULE 5: Multi-loc DSO, no dealer FSC assigned → dealer_followup ───────
    if (locs >= 3 && !hasFsc && py > 3000) {
      const id = `dealer_followup:${gId}`;
      if (!dismissed.includes(id)) {
        items.push({
          id,
          type: "dealer_followup",
          priority: "medium",
          status: statusMap[id] || "pending",
          groupId: gId,
          groupName: gName,
          title: `Assign dealer rep for ${gName}`,
          summary: `${locs}-location group with no FSC assigned.`,
          rationale: `${gName} has ${locs} locations and $${Math.round(py / 1000)}K PY but no dealer FSC on file. A co-call path would accelerate recovery.`,
          confidence: "likely",
          requiresApproval: true,
          createdAt: today,
          source: `locs=${locs}, py=${py}, fsc=none`,
        });
      }
    }

    // ── RULE 6: High-PY account, low/no CY, last viewed repeatedly → account_review ─
    if (py > 5000 && cy < py * 0.3 && lastViewDays < 14 && lastActDays > 30) {
      const id = `account_review:${gId}`;
      if (!dismissed.includes(id)) {
        items.push({
          id,
          type: "account_review",
          priority: gap > 8000 ? "critical" : "high",
          status: statusMap[id] || "pending",
          groupId: gId,
          groupName: gName,
          title: `Strategic review: ${gName}`,
          summary: `Viewed recently but no action — $${Math.round(gap / 1000)}K gap unaddressed.`,
          rationale: `${gName} is a $${Math.round(py / 1000)}K account retaining only ${Math.round(cy / py * 100)}%. It's been viewed ${Math.round(lastViewDays)}d ago but no action taken in ${Math.round(lastActDays)}d — needs a deliberate strategy.`,
          confidence: "likely",
          requiresApproval: true,
          createdAt: today,
          source: `py=${py}, ret=${Math.round(cy/py*100)}%, lastView=${Math.round(lastViewDays)}d, lastAct=${Math.round(lastActDays)}d`,
        });
      }
    }
  }

  // Sort by priority weight, then gap size
  const PW: Record<InboxPriority, number> = { critical: 4, high: 3, medium: 2, low: 1 };
  items.sort((a, b) => {
    const pd = PW[b.priority] - PW[a.priority];
    if (pd !== 0) return pd;
    return 0;
  });

  // De-duplicate: max one item per group
  const seen = new Set<string>();
  const deduped: InboxItem[] = [];
  for (const item of items) {
    if (!seen.has(item.groupId)) {
      seen.add(item.groupId);
      deduped.push(item);
    }
    if (deduped.length >= maxItems) break;
  }

  return deduped;
}
