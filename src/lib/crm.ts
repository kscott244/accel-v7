// ─── CRM ACCOUNTS ────────────────────────────────────────────────
// Persistent account identity layer, separate from uploaded sales data.
//
// CrmAccount holds the fields that should survive CSV re-uploads:
// identity, address, classification, dealer base assignment, and
// the date the account was first seen.
//
// Sales fields (pyQ, cyQ, products, last) live only in the upload
// pipeline output and are never written here.
//
// Storage: data/crm-accounts.json via GitHub (same pattern as overlays).
// LocalStorage cache key: "crm_accounts_v1"
// API routes: /api/load-crm  /api/save-crm

export interface CrmAccount {
  id: string;           // Child MDM ID — primary key
  parentId: string;     // Parent MDM ID — join key to group
  name: string;
  city: string;
  st: string;
  addr: string;
  zip: string;
  email: string;
  tier: string;         // Standard | Silver | Gold | Platinum | Diamond
  top100: boolean;
  class2: string;       // Private Practice | DSO | Emerging DSO | etc.
  dealer: string;       // Base dealer — overrides still live in overlays
  firstSeenDate: string; // ISO date — set once, never overwritten
  lastSeenDate: string;  // ISO date — updated on every upload that includes this ID
}

export interface CrmStore {
  schemaVersion: number;
  lastUpdated: string;
  accounts: Record<string, CrmAccount>; // keyed by Child MDM ID
}

export const EMPTY_CRM_STORE: CrmStore = {
  schemaVersion: 1,
  lastUpdated: new Date().toISOString(),
  accounts: {},
};

// ─── MERGE LOGIC ─────────────────────────────────────────────────
// Given an existing CrmStore and a map of candidates extracted from
// a fresh CSV upload, produce an updated store.
//
// Rules:
// - New accounts (id not in store) are inserted wholesale
// - Existing accounts: only blank/unknown fields are filled in from
//   the candidate — never overwrite a populated field from CSV
// - firstSeenDate is set once and never changed
// - lastSeenDate is always updated to now
// - dealer: only update if existing value is blank or "All Other" AND
//   candidate has a real value
//
// This means: once Ken or the app sets a field on an account record,
// a future CSV upload can never silently clobber it.

export function mergeCrmCandidates(
  existing: CrmStore,
  candidates: Record<string, Omit<CrmAccount, "firstSeenDate" | "lastSeenDate">>
): CrmStore {
  const now = new Date().toISOString();
  const updated: Record<string, CrmAccount> = { ...existing.accounts };

  for (const [id, candidate] of Object.entries(candidates)) {
    const prev = updated[id];
    if (!prev) {
      // New account — insert with firstSeenDate
      updated[id] = {
        ...candidate,
        firstSeenDate: now,
        lastSeenDate: now,
      };
    } else {
      // Existing account — fill blanks only, never overwrite
      updated[id] = {
        id: prev.id,
        parentId: prev.parentId || candidate.parentId,
        name:     prev.name     || candidate.name,
        city:     prev.city     || candidate.city,
        st:       prev.st       || candidate.st,
        addr:     prev.addr     || candidate.addr,
        zip:      prev.zip      || candidate.zip,
        email:    prev.email    || candidate.email,
        tier:     prev.tier     || candidate.tier,
        top100:   prev.top100,
        class2:   prev.class2   || candidate.class2,
        // dealer: update only if current value is blank or generic
        dealer: (!prev.dealer || prev.dealer === "All Other" || prev.dealer === "Unknown")
          && candidate.dealer && candidate.dealer !== "All Other"
          ? candidate.dealer
          : prev.dealer || candidate.dealer,
        firstSeenDate: prev.firstSeenDate,
        lastSeenDate:  now,
      };
    }
  }

  return {
    schemaVersion: 1,
    lastUpdated: now,
    accounts: updated,
  };
}

// ─── APPLY CRM TO GROUPS ─────────────────────────────────────────
// Given the groups array from a CSV upload (or preloaded data) and
// the current CRM store, overwrite identity fields on each child
// with the CRM-authoritative values where they exist.
//
// Sales fields (pyQ, cyQ, products, last) are untouched.
// Groups with no CRM record pass through unchanged.

export function applyCrmToGroups(
  groups: any[],
  crmStore: CrmStore
): any[] {
  if (!groups || Object.keys(crmStore.accounts).length === 0) return groups;

  return groups.map(g => ({
    ...g,
    children: (g.children || []).map((c: any) => {
      const crm = crmStore.accounts[c.id];
      if (!crm) return c;
      return {
        ...c,
        // Identity fields — CRM wins if it has a value
        name:   crm.name   || c.name,
        city:   crm.city   || c.city,
        st:     crm.st     || c.st,
        addr:   crm.addr   || c.addr,
        zip:    crm.zip    || c.zip,
        email:  crm.email  || c.email,
        tier:   crm.tier   || c.tier,
        top100: crm.top100,
        class2: crm.class2 || c.class2,
        dealer: crm.dealer || c.dealer,
        // Sales fields left alone: pyQ, cyQ, products, last
      };
    }),
  }));
}
