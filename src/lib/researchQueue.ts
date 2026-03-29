// @ts-nocheck
// ─── TARGETED RESEARCH QUEUE ────────────────────────────────────────────────
// Deterministic queue builder.
// Selects a small number of high-value accounts worth researching based on
// grounded sales signals — opportunity size, contact gaps, strategic importance.
//
// Rules:
// - Queue is small: max 6 candidates per cycle.
// - Every candidate must justify itself with real data signals.
// - No hallucinated reasoning. If the signal isn't there, the account isn't queued.
// - Confidence is explicit: high / medium / low on every finding.
// - Findings are suggestions, not auto-merges.

import { bestContact, contactGaps, bestPathIn } from "@/lib/contacts";
import { readMemory } from "@/lib/accountMemory";
import { BADGER } from "@/lib/data";

// ── Types ────────────────────────────────────────────────────────────────────

export type ResearchPriority = "critical" | "high" | "medium" | "low";
export type ResearchStatus = "pending" | "in-progress" | "completed" | "dismissed";
export type FindingConfidence = "high" | "medium" | "low";

export type OpportunityType =
  | "high-gap-no-contact"    // large gap, no way to reach them
  | "cross-sell"             // buying some products, missing key families
  | "gone-dark"              // had PY revenue, CY is zero
  | "strategic-dso"          // DSO/Accelerate tier, weak intel
  | "multi-loc-no-intel"     // multi-location group, no research done
  | "stale-high-value"       // high revenue, no recent action or contact update
  | "new-opportunity";       // recently appeared or reactivated

export interface ResearchCandidate {
  id: string;                // deterministic: opp type + group id
  groupId: string;
  groupName: string;
  reasonForResearch: string; // one-line human-readable reason
  opportunityType: OpportunityType;
  priority: ResearchPriority;
  status: ResearchStatus;
  createdAt: string;
  completedAt?: string;
  // Scoring inputs (for transparency)
  gapAmount: number;
  pyRevenue: number;
  cyRevenue: number;
  locs: number;
  hasContact: boolean;
  hasPhone: boolean;
  lastResearchedDays: number;
  // After research completes
  findingsSummary?: string;
  suggestedNextMove?: string;
  confidence?: FindingConfidence;
  contactsFound?: EnrichedContact[];
  suggestedLinkages?: SuggestedLinkage[];
}

export interface EnrichedContact {
  name: string;
  role: string;
  email?: string;
  phone?: string;
  website?: string;
  source: string;           // "web-research" | "deep-research" | "manual"
  confidence: FindingConfidence;
  linkedGroupId: string;
  notes?: string;
  savedAt: string;
}

export interface SuggestedLinkage {
  suggestedGroupName: string;
  suggestedAddress?: string;
  reason: string;            // why we think they're linked
  confidence: FindingConfidence;
  reviewed: boolean;         // false until Ken reviews
}

// ── Priority config ──────────────────────────────────────────────────────────

export const RESEARCH_PRIORITY_COLOR = {
  critical: "#f87171",
  high:     "#fbbf24",
  medium:   "#4f8ef7",
  low:      "#7878a0",
};

export const RESEARCH_PRIORITY_BG = {
  critical: "rgba(248,113,113,.08)",
  high:     "rgba(251,191,36,.07)",
  medium:   "rgba(79,142,247,.07)",
  low:      "rgba(120,120,160,.05)",
};

export const CONFIDENCE_COLOR = {
  high:   "#34d399",
  medium: "#fbbf24",
  low:    "#f87171",
};

export const CONFIDENCE_BG = {
  high:   "rgba(52,211,153,.08)",
  medium: "rgba(251,191,36,.07)",
  low:    "rgba(248,113,113,.07)",
};

export const OPP_TYPE_LABEL = {
  "high-gap-no-contact":  "Gap + No Contact",
  "cross-sell":           "Cross-Sell",
  "gone-dark":            "Gone Dark",
  "strategic-dso":        "Strategic DSO",
  "multi-loc-no-intel":   "Multi-Loc Intel",
  "stale-high-value":     "Stale High Value",
  "new-opportunity":      "New Opportunity",
};

export const OPP_TYPE_ICON = {
  "high-gap-no-contact":  "📞",
  "cross-sell":           "🔄",
  "gone-dark":            "🌑",
  "strategic-dso":        "🏢",
  "multi-loc-no-intel":   "📍",
  "stale-high-value":     "⏰",
  "new-opportunity":      "✨",
};

// ── Revenue helpers ──────────────────────────────────────────────────────────

function groupRevQ(group, qk) {
  const py = (group.children || []).reduce((s, c) => s + ((c.pyQ && c.pyQ[qk]) || 0), 0);
  const cy = (group.children || []).reduce((s, c) => s + ((c.cyQ && c.cyQ[qk]) || 0), 0);
  return { py, cy, gap: Math.max(0, py - cy) };
}

function groupFYRev(group) {
  let py = 0, cy = 0;
  for (const qk of ["1","2","3","4"]) {
    py += (group.children || []).reduce((s, c) => s + ((c.pyQ && c.pyQ[qk]) || 0), 0);
    cy += (group.children || []).reduce((s, c) => s + ((c.cyQ && c.cyQ[qk]) || 0), 0);
  }
  return { py, cy };
}

function cleanName(group) {
  return (group._displayName || group.name || "")
    .replace(/^(UNMATCHED|Master-Unmatched)/i, "").trim();
}

function daysSince(isoDate) {
  if (!isoDate) return 999;
  return (Date.now() - new Date(isoDate).getTime()) / 86400000;
}

// ── Cross-sell detection ─────────────────────────────────────────────────────

function detectCrossSell(group) {
  const buying = new Set();
  for (const child of (group.children || [])) {
    for (const p of (child.products || [])) {
      if ((p.cy1 || 0) > 0) {
        const n = (p.n || "").toLowerCase();
        if (n.includes("composite") || n.includes("herculite") || n.includes("harmonize") || n.includes("simplishade")) buying.add("composite");
        if (n.includes("optibond") || n.includes("bond")) buying.add("bond");
        if (n.includes("maxcem") || n.includes("cement")) buying.add("cement");
        if (n.includes("sonicfill")) buying.add("sonicfill");
        if (n.includes("caviwipes") || n.includes("infection")) buying.add("infection");
        if (n.includes("tempbond") || n.includes("temp")) buying.add("temp");
      }
    }
  }
  const missing = [];
  if (buying.has("composite") && !buying.has("bond")) missing.push("Bond (OptiBond)");
  if (buying.has("composite") && !buying.has("sonicfill")) missing.push("SonicFill");
  if ((buying.has("composite") || buying.has("bond")) && !buying.has("cement")) missing.push("Cement (MaxCem)");
  if (buying.size > 0 && !buying.has("infection")) missing.push("Infection Control (CaviWipes)");
  return missing;
}

// ── Main queue builder ───────────────────────────────────────────────────────

export function buildResearchQueue(
  groups,
  overlays,
  tasks,
  opts
) {
  const qk       = (opts && opts.qk) || "1";
  const maxItems  = (opts && opts.maxItems) || 6;

  // Load existing queue state from overlays
  const existingQueue = (overlays && overlays.researchQueue) || [];
  const completedIds = new Set(
    existingQueue
      .filter(r => r.status === "completed" || r.status === "dismissed")
      .map(r => r.id)
  );
  const inProgressIds = new Set(
    existingQueue.filter(r => r.status === "in-progress").map(r => r.id)
  );

  const candidates = [];

  for (const group of (groups || [])) {
    if (!group || !group.id) continue;
    const gName = cleanName(group);
    if (!gName || gName.length < 2) continue;

    const { py, cy, gap } = groupRevQ(group, qk);
    const { py: fyPY } = groupFYRev(group);
    const locs = group.locs || (group.children && group.children.length) || 1;

    if (py < 500 && cy < 500 && fyPY < 1000) continue; // skip tiny accounts

    const contacts = (overlays && overlays.groupContacts && overlays.groupContacts[group.id]) || [];
    const gaps = contactGaps(contacts);
    const mem = readMemory(overlays, group.id);
    const lastResearchedDays = daysSince(mem.lastResearchAt || (overlays && overlays.contacts && overlays.contacts[group.id] && overlays.contacts[group.id].researchedAt));
    const lastActDays = daysSince(mem.lastActionAt);

    const class2 = (group.class2 || "").toLowerCase();
    const isDSO = class2.includes("dso") || class2.includes("emerging");
    const tier = (group.tier || "").toLowerCase();
    const isAccelTier = tier.includes("diamond") || tier.includes("platinum") || tier.includes("gold") || tier.includes("silver");

    const common = {
      groupId: group.id,
      groupName: gName,
      status: "pending",
      createdAt: new Date().toISOString(),
      gapAmount: gap,
      pyRevenue: py,
      cyRevenue: cy,
      locs,
      hasContact: gaps.hasAnyContact,
      hasPhone: !gaps.missingPhone,
      lastResearchedDays: Math.round(lastResearchedDays),
    };

    // ── RULE 1: High gap + no contact path ──────────────────────────
    if (gap > 2000 && !gaps.hasAnyContact && lastResearchedDays > 14) {
      const id = `high-gap-no-contact:${group.id}`;
      if (!completedIds.has(id) && !inProgressIds.has(id)) {
        candidates.push({
          ...common, id,
          opportunityType: "high-gap-no-contact",
          priority: gap > 5000 ? "critical" : "high",
          reasonForResearch: `$${Math.round(gap)} gap with no contact on file. Need a way in.`,
        });
      }
    }

    // ── RULE 2: Cross-sell opportunity ───────────────────────────────
    const crossSellMissing = detectCrossSell(group);
    if (crossSellMissing.length >= 2 && py > 1500 && lastResearchedDays > 21) {
      const id = `cross-sell:${group.id}`;
      if (!completedIds.has(id) && !inProgressIds.has(id)) {
        candidates.push({
          ...common, id,
          opportunityType: "cross-sell",
          priority: crossSellMissing.length >= 3 ? "high" : "medium",
          reasonForResearch: `Buying ${4 - crossSellMissing.length} families, missing: ${crossSellMissing.join(", ")}. Research decision-maker for intro.`,
        });
      }
    }

    // ── RULE 3: Gone dark — had PY, CY is zero ─────────────────────
    if (py > 1500 && cy === 0 && lastResearchedDays > 21) {
      const id = `gone-dark:${group.id}`;
      if (!completedIds.has(id) && !inProgressIds.has(id)) {
        candidates.push({
          ...common, id,
          opportunityType: "gone-dark",
          priority: py > 4000 ? "high" : "medium",
          reasonForResearch: `$${Math.round(py)} PY, now $0 CY. Still open? Switched vendor? Need status check.`,
        });
      }
    }

    // ── RULE 4: Strategic DSO with weak intel ───────────────────────
    if (isDSO && locs >= 3 && fyPY > 3000 && lastResearchedDays > 30 && !gaps.hasAnyContact) {
      const id = `strategic-dso:${group.id}`;
      if (!completedIds.has(id) && !inProgressIds.has(id)) {
        candidates.push({
          ...common, id,
          opportunityType: "strategic-dso",
          priority: fyPY > 8000 ? "critical" : "high",
          reasonForResearch: `DSO with ${locs} locations, $${Math.round(fyPY/1000)}K annual. No contacts — need procurement path.`,
        });
      }
    }

    // ── RULE 5: Multi-location, no group intel ──────────────────────
    if (locs >= 3 && !isDSO && fyPY > 2000 && lastResearchedDays > 30) {
      const intel = overlays && overlays.groupIntel && overlays.groupIntel[group.id];
      if (!intel) {
        const id = `multi-loc-no-intel:${group.id}`;
        if (!completedIds.has(id) && !inProgressIds.has(id)) {
          candidates.push({
            ...common, id,
            opportunityType: "multi-loc-no-intel",
            priority: "medium",
            reasonForResearch: `${locs} locations, $${Math.round(fyPY/1000)}K annual — no group intel. May have hidden locations or central buyer.`,
          });
        }
      }
    }

    // ── RULE 6: Stale high-value — big account, no recent touch ─────
    if (fyPY > 5000 && lastActDays > 60 && lastResearchedDays > 30 && gaps.hasAnyContact && (gaps.staleOnly || gaps.unverifiedOnly)) {
      const id = `stale-high-value:${group.id}`;
      if (!completedIds.has(id) && !inProgressIds.has(id)) {
        candidates.push({
          ...common, id,
          opportunityType: "stale-high-value",
          priority: fyPY > 10000 ? "high" : "medium",
          reasonForResearch: `$${Math.round(fyPY/1000)}K annual account, contacts are ${gaps.staleOnly ? "stale" : "unverified"}. Refresh before next outreach.`,
        });
      }
    }
  }

  // ── Score and rank ─────────────────────────────────────────────────────
  const PRIORITY_SCORE = { critical: 40, high: 30, medium: 20, low: 10 };
  candidates.sort((a, b) => {
    const pDiff = (PRIORITY_SCORE[b.priority] || 0) - (PRIORITY_SCORE[a.priority] || 0);
    if (pDiff !== 0) return pDiff;
    return b.gapAmount - a.gapAmount;
  });

  return candidates.slice(0, maxItems);
}

// ── Merge research findings into a candidate ─────────────────────────────────
// Called after deep-research API returns. Produces an updated candidate.

export function mergeResearchFindings(candidate, deepResearchResult) {
  const intel = deepResearchResult || {};
  const contactsFound = (intel.contacts || []).map(c => ({
    name: c.name || "",
    role: c.role || "",
    email: c.email || null,
    phone: c.phone || null,
    website: intel.website || null,
    source: "deep-research",
    confidence: c.email || c.phone ? "medium" : "low",
    linkedGroupId: candidate.groupId,
    notes: c.tier ? `Tier ${c.tier}` : "",
    savedAt: new Date().toISOString(),
  }));

  // Infer confidence from what was found
  let confidence = "low";
  if (contactsFound.some(c => c.phone || c.email)) confidence = "medium";
  if (contactsFound.some(c => c.phone && c.email)) confidence = "high";
  if (intel.status === "closed") confidence = "high"; // definitive answer

  // Suggested linkages from locations array
  const suggestedLinkages = (intel.locations || [])
    .filter(loc => loc.name && loc.address)
    .map(loc => ({
      suggestedGroupName: loc.name,
      suggestedAddress: [loc.address, loc.city, loc.state, loc.zip].filter(Boolean).join(", "),
      reason: `Found via web research on ${candidate.groupName}`,
      confidence: "medium",
      reviewed: false,
    }));

  // Build next-move suggestion
  let suggestedNextMove = "Review findings and update contact.";
  if (intel.status === "closed") {
    suggestedNextMove = "Practice appears closed. Mark inactive.";
  } else if (contactsFound.length > 0 && contactsFound[0].phone) {
    suggestedNextMove = `Call ${contactsFound[0].name} at ${contactsFound[0].phone}.`;
  } else if (contactsFound.length > 0 && contactsFound[0].email) {
    suggestedNextMove = `Email ${contactsFound[0].name} at ${contactsFound[0].email}.`;
  } else if (suggestedLinkages.length > 1) {
    suggestedNextMove = `Found ${suggestedLinkages.length} locations — review for possible group linkage.`;
  } else if (intel.competitive) {
    suggestedNextMove = `Competitive intel found — prepare targeted pitch.`;
  }

  return {
    ...candidate,
    status: "completed",
    completedAt: new Date().toISOString(),
    confidence,
    findingsSummary: [
      intel.statusNote,
      intel.ownershipNote,
      intel.competitive,
    ].filter(Boolean).join(" · ") || "Research completed — review contacts.",
    suggestedNextMove,
    contactsFound,
    suggestedLinkages: suggestedLinkages.length > 0 ? suggestedLinkages : undefined,
  };
}
