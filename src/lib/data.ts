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

try { BADGER        = require("@/data/badger-lookup.json");        } catch(e) {}
try { PARENT_NAMES  = require("@/data/parent-names.json");         } catch(e) {}
try { DEALERS       = require("@/data/dealers").DEALERS;           } catch(e) {}
try { PARENT_DEALERS = require("@/data/parentDealers").PARENT_DEALERS; } catch(e) {}
try { WEEK_ROUTES   = require("@/data/week-routes.json");          } catch(e) {}
