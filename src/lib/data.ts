// ─── STATIC DATA LOADER ─────────────────────────────────────────────────────
// Single source of truth for all static JSON / require() data loads.
// Every module that previously did its own `let X = {}; try { X = require() }`
// should import from here instead.
//
// IMPORTANT: BADGER is intentionally mutable.
// AccelerateApp.applyOverlays() writes contact overrides into it at runtime so
// that all tabs reading BADGER see the same enriched data. Do not freeze it.

export let BADGER: Record<string, any> = {};
export let PARENT_NAMES: Record<string, string> = {};
export let DEALERS: Record<string, string> = {};
export let PARENT_DEALERS: Record<string, string> = {};
export let WEEK_ROUTES: any = { routes: {}, unplaced: [] };
export let DEALER_REPS: Record<string, any> = {};

// Mutable overlay ref — shared across all tabs.
// AccelerateApp.applyOverlays() writes into this at runtime.
// All tabs that read or mutate overlays must import from here.
export const EMPTY_OVERLAYS: any = {
  schemaVersion: 2, lastUpdated: new Date().toISOString(),
  groups: {}, groupDetaches: [], groupMoves: {}, nameOverrides: {},
  contacts: {}, fscReps: {}, activityLogs: {}, research: {}, dealerOverrides: {}, dealerManualReps: {}, adjs: [],
  skippedCpidIds: [],
};
export let OVERLAYS_REF: any = EMPTY_OVERLAYS;

try { BADGER        = require("@/data/badger-lookup.json");        } catch(e) {}
try { PARENT_NAMES  = require("@/data/parent-names.json");         } catch(e) {}
try { DEALERS       = require("@/data/dealers").DEALERS;           } catch(e) {}
try { PARENT_DEALERS = require("@/data/parentDealers").PARENT_DEALERS; } catch(e) {}
try { WEEK_ROUTES   = require("@/data/week-routes.json");          } catch(e) {}
try { DEALER_REPS   = require("@/data/dealer-reps.json");          } catch(e) {}

// ─── OFFICE-LEVEL FEEL MAP ───────────────────────────────────────────────────
// Badger data is keyed by child-account ID, but Ken often saves relationship
// data on one child even when multiple dealer-split children share the same
// physical office. This map resolves feel at the OFFICE level using cleaned
// street address as primary key, so any child at that address gets the feel.
//
// Conflict resolution: when two entries at the same address have different feel
// values, we take the maximum (most positive relationship signal wins — matches
// how salespeople think about their best interaction at that office).
//
// "Total" suffix keys in Badger (e.g. "Master-CM123 Total") are Badger's own
// rollup rows for the same office — included here, not treated as separate.

export interface OfficeFeel {
  feel: number;          // 1–5 from Badger
  label: "Cold" | "Warm" | "Hot";
  doctor?: string;
  dealerRep?: string;
  orders?: string;       // who orders at the office
  notes?: string;
  visitNotes?: string;
  lastVisit?: string;
  phone?: string;
  // address that matched — for debugging
  matchedAddr?: string;
}

function normAddr(addr: string): string {
  if (!addr) return "";
  let a = addr.toLowerCase()
    .replace(/,?\s*\d{5}(-\d{4})?(\s|$)/g, " ")  // strip zip
    .replace(/\bstreet\b/g, "st").replace(/\bavenue\b/g, "ave")
    .replace(/\broad\b/g, "rd").replace(/\bboulevard\b/g, "blvd")
    .replace(/\bdrive\b/g, "dr").replace(/\bcourt\b/g, "ct")
    .replace(/\blane\b/g, "ln").replace(/\bplace\b/g, "pl")
    .replace(/\bsuite\b|\bste\b/g, "ste")
    .replace(/[,#\.]/g, " ")
    .replace(/\s+/g, " ").trim();
  return a;
}

function feelLabel(f: number): "Cold" | "Warm" | "Hot" {
  if (f >= 4) return "Hot";
  if (f >= 3) return "Warm";
  return "Cold";
}

// Build once at module load — O(n) over ~1900 Badger entries
function buildOfficeFeelMap(): Record<string, OfficeFeel> {
  const map: Record<string, {
    feel: number | null; doctor?: string; dealerRep?: string;
    orders?: string; notes?: string; visitNotes?: string;
    lastVisit?: string; phone?: string; matchedAddr: string;
  }> = {};

  for (const [id, v] of Object.entries(BADGER) as [string, any][]) {
    const addr = normAddr(v.address || "");
    if (!addr) continue;
    if (!map[addr]) {
      map[addr] = { feel: null, matchedAddr: addr };
    }
    const e = map[addr];
    // Feel: take max across all entries at this address
    if (v.feel != null) {
      const f = parseFloat(v.feel);
      if (!isNaN(f)) e.feel = e.feel == null ? f : Math.max(e.feel, f);
    }
    // Other fields: take first non-empty value found
    for (const field of ["doctor","dealerRep","orders","notes","visitNotes","lastVisit","phone"] as const) {
      if (v[field] && !e[field as keyof typeof e]) (e as any)[field] = v[field];
    }
  }

  // Convert to OfficeFeel, dropping entries with no feel
  const result: Record<string, OfficeFeel> = {};
  for (const [addr, e] of Object.entries(map)) {
    if (e.feel == null) continue;
    result[addr] = {
      feel: e.feel,
      label: feelLabel(e.feel),
      ...(e.doctor    && { doctor:    e.doctor }),
      ...(e.dealerRep && { dealerRep: e.dealerRep }),
      ...(e.orders    && { orders:    e.orders }),
      ...(e.notes     && { notes:     e.notes }),
      ...(e.visitNotes && { visitNotes: e.visitNotes }),
      ...(e.lastVisit  && { lastVisit: e.lastVisit }),
      ...(e.phone      && { phone:     e.phone }),
      matchedAddr: addr,
    };
  }
  return result;
}

// Exported map — keyed by normalized address string
export const OFFICE_FEEL: Record<string, OfficeFeel> = buildOfficeFeelMap();

// Resolve feel for an account: try direct Badger ID first, then address-based lookup
// acct should have .addr or .address, and .id
export function resolveOfficeFeel(acct: any, overlaysFeel?: Record<string, any>): OfficeFeel | null {
  // 1. Overlay override takes precedence (user-set via AcctDetail)
  const officeKey = normAddr(acct.addr || acct.address || "");
  if (overlaysFeel && officeKey && overlaysFeel[officeKey]) {
    const ov = overlaysFeel[officeKey];
    const feel = ov.feel ?? null;
    if (feel != null) return { ...ov, feel, label: feelLabel(feel) };
  }
  // 2. Direct Badger ID lookup
  const direct = BADGER[acct.id];
  if (direct?.feel != null) {
    const f = parseFloat(direct.feel);
    return {
      feel: f, label: feelLabel(f),
      doctor: direct.doctor, dealerRep: direct.dealerRep,
      orders: direct.orders, notes: direct.notes,
      visitNotes: direct.visitNotes, lastVisit: direct.lastVisit,
      phone: direct.phone, matchedAddr: normAddr(direct.address || ""),
    };
  }
  // 3. Address-based office lookup (catches dealer-split sibling cases)
  if (officeKey && OFFICE_FEEL[officeKey]) return OFFICE_FEEL[officeKey];
  // 4. Fallback: no feel data, but still return Badger context if available
  return null;
}

export { normAddr as normOfficeAddr };
