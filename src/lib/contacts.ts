// ─── CONTACT INTELLIGENCE ───────────────────────────────────────────────────
// Deterministic contact intelligence layer.
// No AI. No hallucinated data. If unknown, say unknown.
//
// Overlay path: overlays.groupContacts[groupId] = Contact[]

import type { Contact, ContactSource, ContactConfidence } from "@/types";

// ── Confidence rank (higher = more trustworthy) ──────────────────
const CONF_RANK: Record<ContactConfidence, number> = {
  verified:   4,
  likely:     3,
  unverified: 2,
  stale:      1,
};

// ── Source rank (higher = more actionable) ───────────────────────
const SOURCE_RANK: Record<ContactSource, number> = {
  manual:    4,
  badger:    3,
  research:  2,
  csv:       1,
  unknown:   0,
};

// ── Score a contact for "best path" ranking ──────────────────────
function contactScore(c: Contact): number {
  const confScore   = CONF_RANK[c.confidence] ?? 1;
  const srcScore    = SOURCE_RANK[c.source]    ?? 0;
  const hasPrimary  = c.isPrimary ? 10 : 0;
  const hasPhone    = c.phone     ? 2  : 0;
  const hasEmail    = c.email     ? 1  : 0;
  return hasPrimary + confScore * 3 + srcScore * 2 + hasPhone + hasEmail;
}

// ── Best known contact for an account ───────────────────────────
// Returns null if no contacts exist.
export function bestContact(contacts: Contact[]): Contact | null {
  if (!contacts || contacts.length === 0) return null;
  // Explicit primary always wins
  const primary = contacts.find(c => c.isPrimary);
  if (primary) return primary;
  // Otherwise score and pick highest
  return [...contacts].sort((a, b) => contactScore(b) - contactScore(a))[0];
}

// ── Contact gap analysis ──────────────────────────────────────────
export interface ContactGaps {
  hasAnyContact: boolean;
  hasPrimaryContact: boolean;
  missingPhone: boolean;
  missingEmail: boolean;
  hasMultiple: boolean;
  staleOnly: boolean;     // all contacts are stale
  unverifiedOnly: boolean; // no verified contacts
}

export function contactGaps(contacts: Contact[]): ContactGaps {
  if (!contacts || contacts.length === 0) {
    return {
      hasAnyContact:    false,
      hasPrimaryContact: false,
      missingPhone:     true,
      missingEmail:     true,
      hasMultiple:      false,
      staleOnly:        false,
      unverifiedOnly:   false,
    };
  }
  const best = bestContact(contacts);
  return {
    hasAnyContact:     true,
    hasPrimaryContact: contacts.some(c => c.isPrimary),
    missingPhone:      !contacts.some(c => !!c.phone),
    missingEmail:      !contacts.some(c => !!c.email),
    hasMultiple:       contacts.length > 1,
    staleOnly:         contacts.every(c => c.confidence === "stale"),
    unverifiedOnly:    !contacts.some(c => c.confidence === "verified" || c.confidence === "likely"),
  };
}

// ── Best path into account (deterministic label) ─────────────────
// Returns a short actionable string. Never hallucinated.
export type PathIn =
  | "direct-phone"    // we have a phone number for a primary/verified contact
  | "direct-email"    // we have an email, no phone
  | "dealer-led"      // no direct contact — go through distributor rep
  | "office-visit"    // no contact at all — need to walk in
  | "stale-verify";   // contact exists but is stale — needs verification

export function bestPathIn(contacts: Contact[], hasFscRep: boolean): PathIn {
  const best = bestContact(contacts);
  if (!best) {
    return hasFscRep ? "dealer-led" : "office-visit";
  }
  if (best.confidence === "stale") return "stale-verify";
  if (best.phone) return "direct-phone";
  if (best.email) return "direct-email";
  return hasFscRep ? "dealer-led" : "office-visit";
}

// ── Path label + color for UI ─────────────────────────────────────
export const PATH_IN_LABEL: Record<PathIn, string> = {
  "direct-phone":  "📞 Direct",
  "direct-email":  "✉ Email",
  "dealer-led":    "🤝 Via Rep",
  "office-visit":  "🚪 Walk In",
  "stale-verify":  "⚠ Verify",
};

export const PATH_IN_COLOR: Record<PathIn, string> = {
  "direct-phone": "#22d3ee",   // cyan
  "direct-email": "#4f8ef7",   // blue
  "dealer-led":   "#a78bfa",   // purple
  "office-visit": "#7878a0",   // muted
  "stale-verify": "#fbbf24",   // amber
};

// ── Migrate legacy contact (no source/confidence) to Contact ──────
// Used when loading older overlay data that predates this type.
export function migrateLegacyContact(raw: any, groupId: string): Contact {
  return {
    id:            raw.id ?? Date.now(),
    linkedGroupId: raw.linkedGroupId ?? groupId,
    name:          raw.name ?? "",
    role:          raw.role ?? "",
    phone:         raw.phone ?? "",
    email:         raw.email ?? "",
    notes:         raw.notes ?? "",
    source:        raw.source ?? (raw.notes?.includes("AI research") ? "research" : "manual"),
    confidence:    raw.confidence ?? "unverified",
    isPrimary:     raw.isPrimary ?? false,
    savedAt:       raw.savedAt ?? new Date().toISOString(),
    verifiedAt:    raw.verifiedAt,
  };
}

// ── Build a new contact entry from form data ─────────────────────
export function buildContact(
  fields: { name: string; role: string; phone: string; email: string; notes: string; isPrimary: boolean; source?: ContactSource; confidence?: ContactConfidence },
  groupId: string,
  existingId?: number
): Contact {
  return {
    id:            existingId ?? Date.now(),
    linkedGroupId: groupId,
    name:          fields.name.trim(),
    role:          fields.role.trim(),
    phone:         fields.phone.trim(),
    email:         fields.email.trim(),
    notes:         fields.notes.trim(),
    source:        fields.source ?? "manual",
    confidence:    fields.confidence ?? "unverified",
    isPrimary:     fields.isPrimary ?? false,
    savedAt:       new Date().toISOString(),
  };
}

