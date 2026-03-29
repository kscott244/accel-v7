// ─── ACCOUNT MEMORY ──────────────────────────────────────────────────────────
// Durable per-group memory layer.
// Persisted in overlays.accountMemory[groupId] via GitHub (patchOverlay).
// Written only on meaningful actions — not on every view.
//
// This layer lets the app remember what has changed, what has been focused on,
// and what still needs action — surviving CSV re-uploads and device switches.

// ── Relationship state ────────────────────────────────────────────
export type RelationshipState =
  | "cold"         // no meaningful contact or action yet
  | "warming"      // some activity, not yet consistent
  | "active"       // regular contact, ongoing engagement
  | "stalled"      // was active, gone quiet
  | "blocked"      // known blocker preventing progress
  | "won"          // converted / active Accelerate account
  | "lost";        // churned or unwinnable

// ── Account memory record ─────────────────────────────────────────
export interface AccountMemory {
  groupId: string;
  lastViewedAt?: string;         // ISO — last time Ken opened this group
  lastActionAt?: string;         // ISO — last meaningful action taken
  lastMeaningfulChangeAt?: string; // ISO — last time something important changed
  lastRecommendedAction?: string;  // free text — last AI or manual recommendation
  knownBlockers?: string;          // free text — what is preventing progress
  relationshipState?: RelationshipState;
  attentionNote?: string;          // short manual note about current focus
  updatedAt: string;               // ISO — last write time
}

// ── Empty default ─────────────────────────────────────────────────
export function emptyMemory(groupId: string): AccountMemory {
  return { groupId, updatedAt: new Date().toISOString() };
}

// ── Read memory for a group from overlays ─────────────────────────
export function readMemory(overlays: any, groupId: string): AccountMemory {
  return overlays?.accountMemory?.[groupId] ?? emptyMemory(groupId);
}

// ── Build a memory patch op ───────────────────────────────────────
// Returns an overlay op ready to pass to patchOverlay().
export function memoryPatchOp(groupId: string, fields: Partial<AccountMemory>) {
  const now = new Date().toISOString();
  return {
    op: "set" as const,
    path: `accountMemory.${groupId}`,
    value: { groupId, ...fields, updatedAt: now },
  };
}

// ── Merge memory fields (non-destructive) ─────────────────────────
// Merges new fields into existing memory without clobbering unrelated fields.
export function mergeMemory(existing: AccountMemory, fields: Partial<AccountMemory>): AccountMemory {
  return { ...existing, ...fields, updatedAt: new Date().toISOString() };
}

// ── Human-readable "last touched" label ──────────────────────────
export function lastTouchedLabel(memory: AccountMemory): string | null {
  const ts = memory.lastActionAt || memory.lastViewedAt;
  if (!ts) return null;
  const ageDays = (Date.now() - new Date(ts).getTime()) / 86400000;
  if (ageDays < 1)   return "Today";
  if (ageDays < 2)   return "Yesterday";
  if (ageDays < 7)   return `${Math.floor(ageDays)}d ago`;
  if (ageDays < 30)  return `${Math.floor(ageDays / 7)}w ago`;
  return `${Math.floor(ageDays / 30)}mo ago`;
}

// ── Attention signal label ────────────────────────────────────────
export function attentionLabel(memory: AccountMemory): string | null {
  if (!memory.lastActionAt && !memory.lastViewedAt) return null;
  const ageDays = memory.lastActionAt
    ? (Date.now() - new Date(memory.lastActionAt).getTime()) / 86400000
    : 999;
  if (ageDays < 3)  return "Active";
  if (ageDays < 14) return "Recent";
  if (ageDays < 45) return "Cooling";
  return "Cold";
}

// ── Relationship state label + color ──────────────────────────────
export const REL_STATE_COLOR: Record<RelationshipState, string> = {
  cold:    "#7878a0",
  warming: "#fbbf24",
  active:  "#34d399",
  stalled: "#f87171",
  blocked: "#f97316",
  won:     "#22d3ee",
  lost:    "#6b7280",
};
