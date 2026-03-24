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
  contacts: {}, fscReps: {}, activityLogs: {}, research: {}, dealerOverrides: {},
};
export let OVERLAYS_REF: any = EMPTY_OVERLAYS;

try { BADGER        = require("@/data/badger-lookup.json");        } catch(e) {}
try { PARENT_NAMES  = require("@/data/parent-names.json");         } catch(e) {}
try { DEALERS       = require("@/data/dealers").DEALERS;           } catch(e) {}
try { PARENT_DEALERS = require("@/data/parentDealers").PARENT_DEALERS; } catch(e) {}
try { WEEK_ROUTES   = require("@/data/week-routes.json");          } catch(e) {}
try { DEALER_REPS   = require("@/data/dealer-reps.json");          } catch(e) {}
