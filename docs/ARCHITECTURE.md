# accel-v7 — Data Architecture

## Data Layer Precedence

```
L1: Base CSV Data
    → src/data/preloaded-data.ts (built from Tableau CSV, read-only at runtime)
    → localStorage "accel_data_v2" (Ken's last uploaded CSV, device-only)
    → BADGER, DEALERS, PARENT_DEALERS, PARENT_NAMES (static enrichment, bundled)

L2: Structural Truth
    → src/data/manual-parents.json (hand-authored group definitions, committed)
    → Applied via applyManualParents() at boot before any overlays
    → Lives in repo, changes require a commit and redeploy

L3: Overlays (Operational Layer)
    → data/overlays.json (persisted to GitHub via API)
    → Runtime access via OVERLAYS_REF (exported mutable from src/lib/data.ts)
    → Sections: groups, groupMoves, groupDetaches, contacts, groupContacts,
                groupNotes, fscReps, nameOverrides, activityLogs,
                dealerManualReps, skippedCpidIds, skippedOrphanIds, adjs
    → Survives CSV re-uploads by design — user-authored data is never overwritten
    → Written exclusively via patchOverlay() → /api/save-overlay (atomic ops)
    → NEVER written via full-overlay replacement (saveOverlays is deprecated)

L4: Derived Intelligence
    → scoreAccount() / scorePriority() — urgency scores computed at render time
    → productSignals, nextBestMoves, briefLines — memoized per group render
    → weeklyDelta — diff between consecutive CSV uploads
    → Never persisted, always re-derived from L1–L3

L5: localStorage (Device Cache / Prefs Only)
    → "accel_data_v2" — last CSV upload (device-only, replaced on next upload)
    → "accel_tasks_v1" — task list (device-only by design)
    → "accel_adjs_v1" — adjustment entries (also mirrored in overlays.adjs)
    → "crm_accounts_v1" / "sales_history_v1" — cache of GitHub data, refreshed on boot
    → "active_quarter" — UI preference
    → "weekly_snapshot_v1" — delta baseline for weekly comparison
    → contact:{id} — pre-migration read-only fallback (overlays.contacts is durable)
    → group-override:{id} — pre-migration read-only fallback (overlays.groupMoves is durable)
    → RULE: localStorage is never the source of truth for structural data.
            It is always a cache or a device-only preference.
```

## Boot Sequence

```
1. Load overlays fresh from GitHub (no LS cache)
2. Load CRM from LS cache → refresh from GitHub in background
3. Load Sales from LS cache → refresh from GitHub in background
4. Load base groups:
   a. If "accel_data_v2" exists in LS → use it (Ken's CSV)
   b. Otherwise → use PRELOADED (bundled static data)
5. Apply pipeline: applyManualParents → hydrateDealer → rollupGroupTotals → applyOverlays → applyGroupOverrides
6. Extract leaves → score accounts → render
```

## Layer Rules (Guardrails)

| Rule | Detail |
|------|--------|
| L1 data is read-only at runtime | Never write into preloaded-data.ts from app code |
| L2 changes require a commit | manual-parents.json edits trigger a redeploy |
| L3 writes go through patchOverlay only | `/api/save-overlay` with ops array, never full replacement |
| L4 is never persisted | Scores and signals are always recomputed — never stored |
| L5 is never structural | If it lives in LS only, it is not durable user data |
| BADGER is the one intentional L1+L3 hybrid | applyOverlays enriches BADGER with overlay contacts — documented exception |

## Known Acceptable Deviations

- **BADGER mutation in applyOverlays**: Overlay contacts are merged into BADGER so AcctDetail
  can read them without knowing the source. BADGER is `export let` and documented as mutable.
  Guards (`if !BADGER[id].x`) prevent re-application on repeat calls.

- **contact:{id} LS read in AcctDetail**: Pre-migration fallback. Read-only on mount.
  overlays.contacts is the durable store for all new writes.

- **group-override:{id} LS read in AcctDetail**: Pre-migration fallback. Read-only on mount.
  overlays.groupMoves is the durable store. applyGroupOverrides no longer reads these keys.

- **insights.ts / utils.ts import from @/data**: These serve the secondary pages
  (/, /groups, /route) which use a different data pipeline. The main app (/accelerate)
  does not use them.

## Files That Should Never Cross Layers

| File | Layer | Must not... |
|------|-------|-------------|
| src/lib/csv.ts | L1 processing | Import from overlayOps, touch OVERLAYS_REF |
| src/lib/mergeGroups.ts | L3 apply | Touch BADGER directly |
| src/lib/format.ts | L4 derive | Read from localStorage |
| src/lib/overlayOps.ts | L3 ops | Import from csv.ts or preloaded-data |
| data/overlays.json | L3 store | Contain computed/derived fields |

## Data Files at a Glance

```
src/data/
  preloaded-data.ts     L1  2.7MB  Last Tableau export, bundled at build
  dealers.ts            L1  127KB  Child MDM → dealer name map
  parentDealers.ts      L1  109KB  Parent MDM → dealer name map
  badger-lookup.json    L1  247KB  Contact enrichment, lat/lng, addresses
  manual-parents.json   L2  0.5KB  Hand-authored multi-location groupings
  parent-names.json     L1  45KB   Parent display name lookup
  schein-ct-reps.json   L1  3.3KB  Schein CT FSC/ES roster (static)
  week-routes.json      L1  13KB   Pre-planned weekly routes
  cpid-pending-merges   L4  12KB   AI-generated merge candidates (suggestion input only)
  cpid-review-queue     L4  265KB  AI-generated review candidates (suggestion input only)
  data_discoveries.json L4  117KB  AI-generated territory intelligence
  reorder_data.json     L4  14KB   Reorder signal data

data/
  overlays.json         L3  ~3KB   Live user-authored data (contacts, groups, moves)
  crm-accounts.json     L3* 2.5MB  CRM identity layer (TODO: move off GitHub to KV)
  sales-history.json    L3* 2.9MB  Sales history records (TODO: move off GitHub to KV)
```
*crm and sales are functionally L3 but too large for GitHub file commits — planned migration to Vercel KV.
