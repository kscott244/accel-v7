# CURRENT PHASE -- accel-v7

## Status: Clean. Data boundary hardened. Ready to build.

### Phase: Data Boundary Hardening — March 28, 2026

Full audit of all data layers. Three real fixes, one doc overhaul.

**What was audited:**
Every data read/write path across AccelerateApp, AcctDetail, all 4 tab components,
and all 15 files in src/lib/. Violations categorized by severity.

**Violations found:**

| # | Severity | Location | Issue |
|---|----------|----------|-------|
| 1 | MEDIUM | AccelerateApp applyGroupOverrides | LS "group-override:" scan still ran after patchOverlay migration — stale keys could silently override overlay data |
| 2 | LOW | AcctDetail saveGroupMove | Still writing to localStorage after patchOverlay migration — redundant and wrong layer |
| 3 | COSMETIC | src/data/patches.json | Retired file still in repo |
| 4 | LOW/DOC | AccelerateApp applyOverlays | BADGER mutation was undocumented — looked like a violation, is actually intentional |
| 5 | COSMETIC | insights.ts / utils.ts | Secondary-page lib imports @/data — isolated, main app unaffected |

**Commits:**
- `d2a0b317` — AccelerateApp: removed stale localStorage scan from applyGroupOverrides. groupMoves is now fully in overlays layer. Added clarifying comment on BADGER mutation.
- `9a7ce816` — AcctDetail: removed localStorage write from saveGroupMove. LS read-on-mount kept as pre-migration fallback with explicit comment.
- `f5b717c5` — Deleted src/data/patches.json (marked RETIRED since A15.4, nothing imports it)
- `(arch sha)` — docs/ARCHITECTURE.md: full data layer contract written — layer definitions, boot sequence, guardrail table, acceptable deviations, file inventory

**Layer precedence (enforced):**
```
L1 base CSV → L2 structural truth → L3 overlays → L4 derived intelligence
L5 localStorage = cache/device prefs only, never structural source of truth
```

**Confirmed clean (do not re-audit):**
- rollupGroupTotals / hydrateDealer — correct placement
- overlayOps.ts / save-overlay route — correct, just hardened last session
- crm.ts / sales.ts — correct placement
- lib/ organization — clean, no cross-layer imports in main app pipeline
- insights.ts/utils.ts — secondary-page only, main app doesn't import them

**What's next:**
Move crm-accounts.json (2.5MB) and sales-history.json (2.9MB) off GitHub to Vercel KV.
These are functionally L3 but too large for GitHub file commits — growing unboundedly.

---

## Previously Completed
- patchOverlay Migration — all 4 tabs now use atomic ops, SHA conflicts eliminated
- March 28 Cleanup — applyManualParents wired, dead code removed, productSignals hoisted
- A16.5 -- Full Workflow Smoke Test Harness (32/32 unit tests passing)
- A16.4 -- Merge self-test harness, applyGroupCreates extraction
- A16.3 -- Merge direction + source card elimination
- A16.2 -- Build fix + initial merge direction
- A16.1 -- AI Intel Stabilization
- A15.7 -- Overlay Write Guard

## Last Updated
March 28, 2026
