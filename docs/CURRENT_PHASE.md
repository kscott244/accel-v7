# CURRENT PHASE -- accel-v7

## Active: Phase A15.3 -- Safe Group Merge Correctness COMPLETE

### Baseline
A15.2 complete: GitHub large-file load reliability. Commit `ed29b63`.

### Root Causes Fixed

**Bug 1 -- Step 4d expanded wrapper nodes instead of leaves**
In `applyOverlays`, when expanding a merged source group's children, raw child nodes were
pushed without recursing through wrapper layers. Preloaded data nests 2-3 levels deep;
wrappers (nodes with `c.children` and no `products`) landed in merged groups as fake
locations, breaking scoring, totals, and location counts.

**Bug 2 -- executeMerge stored group IDs in childIds**
`executeMerge` stored `target.id` (a group-level ID) in overlay `childIds`. Step 4d tried
to expand it via `mergedSourceGroups` -- but if the target had its own overlay entry, it
was consumed by that iteration first, leaving nothing to expand. Result: silent empty
children or incorrect fallback leaves.

**Bug 3 -- class2 never updated after merge grew the group**
A group saved as "Private Practice" kept that classification even after absorbing 2+ more
locations. Hero card, research context, and type filters all showed the wrong ownership.

**Data Issue -- Middletown Dental duplicate overlay entries**
Two overlay entries both named "MIDDLETOWN DENTAL ASSOCIATES":
- `Master-CM1921839` (manual-merge): childIds=[CM1921839, CM047997]
  CM047997 is EDGE DENTAL MANAGEMENT -- a 7-location DSO. Wrongly absorbed entirely.
- `Master-CM047997` (auto-merge): childIds=[CM1451924, CM1921839]
  Correctly pairs the two Middletown Dental locations.

### What Was Fixed

**`src/components/AccelerateApp.tsx`** (commit `96836c3`)
- Step 4d: `flattenToLeaves()` helper recursively unwraps wrapper nodes to true leaf offices
- Step 4d: per-merge `addedLeafIds` dedup set prevents same leaf from appearing twice
- Group create: `derivedClass2` upgrades "Private Practice" to "DSO" when locs >= 3

**`src/components/tabs/GroupDetail.tsx`** (commit `b26fc1f`)
- `executeMerge`: resolves target to leaf IDs before saving to overlay childIds
  1. Checks `OVERLAYS_REF.groups[target.id].childIds` (already leaf-level)
  2. Falls back to `target.children.map(c => c.id)`
  3. Only falls back to `[target.id]` when target has no children at all

**`data/overlays.json`** (commit `f7c990e`)
- Deleted `Master-CM1921839` bad manual-merge (absorbed EDGE DENTAL wrongly)
- Kept `Master-CM047997` correct 2-location Middletown pairing

### Tests
Existing 34-test suite passes. No regressions.

### Build
Passing -- brace/paren delta = 0 on all edited files, verified pre-commit.

---

## Previously Completed
- A15.2 -- GitHub Large-File Load Reliability (ed29b63) complete
- A15 -- Group AI Intel (68430c8) complete
- A14 -- Deterministic Account Brief (f7cfefe) complete
- A13 -- Next Best Moves (8c6a244) complete
- A10-A12, Phases 1-23 complete

---

## Last Updated
March 26, 2026
