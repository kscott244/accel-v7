# CURRENT PHASE -- accel-v7

## Active: Phase A15.4 -- Merge Source-of-Truth Cleanup COMPLETE

### Baseline
A15.3 complete: Safe group merge correctness. Commit `95b9ffd`.

### Critical Issue Found and Fixed
overlays.json was silently wiped to an empty object at 2026-03-27 00:47 UTC.
All 21 overlay groups, 3 groupMoves, 2 fscReps, and 3 groupContacts were lost.
Root cause: app loaded with empty localStorage on a fresh session or device, then
the auto-save path committed that empty state back to GitHub, overwriting all data.

**Recovered** from git history commit `36c81e0c` (last good state: 2026-03-26 15:02 UTC).

### What Was Done

**`data/overlays.json`** (commit `cb021a1`)
- Restored 21 overlay groups lost in the wipe (Dental 365, Abra Dental, Middletown
  Dental, Blue Back Dental, and all 17 auto-merge groups)
- Restored 3 groupMoves (Aspen CT/MA/Waterbury)
- Restored 2 fscReps (Schein assignments)
- Restored 3 groupContacts (Kozlowski Orthodontics, Dental365, Attleboro)
- Migrated data from patches.json that was never actually in overlays:
  - **Resolute Dental Partners** group → `overlays.groups["Master-RDP-001"]`
    (6 locations: Flanders, Wells Street, Graniteville, Coastal CT, + 2 more)
  - **Name overrides** → `overlays.nameOverrides`:
    CM116929 = "WELLS STREET DENTISTRY", CM17699391 = "FLANDERS DENTAL STUDIO"
  - **Contacts** → `overlays.contacts`:
    CM231113 (Brittany Burroughs — Coastal CT Dentistry)
    CM116929 (Christine Lague — Wells Street Dentistry)
    CM413476 (Dr. Sheikh M. Ilyas + Dr. Hamed Vaziri — New England Dental)
  - Aspen detach skipped — already covered by groupMoves entries

**`src/components/tabs/AdminTab.tsx`** (commit `6e3dc2c`)
- Fixed Review tab counter: was showing full unfiltered CPID_REVIEW count (407)
- Now filters by `!applied.includes(p.groupA.id) && !skippedMergeIds[p.groupA.id]`
- Tab badge now shows only genuinely pending review items, not already-applied ones

**`src/data/patches.json`** (commit `6586324`)
- Replaced live content with retirement tombstone
- Documents what was migrated, where it went, and that the file is no longer read
- Not deleted (git history reference), but clearly marked as inert

### Merge Source of Truth — After A15.4
Single source: `data/overlays.json` (GitHub) / `overlay_cache_v2` (localStorage)
- Applied group merges: `overlays.groups`
- Account moves between groups: `overlays.groupMoves`
- Name corrections: `overlays.nameOverrides`
- Contact data: `overlays.contacts`
- FSC assignments: `overlays.fscReps`
- patches.json: retired tombstone, no longer read or written

### Admin Suggestions
- Auto tab: correctly shows only unapplied items (was already working)
- Review tab: now shows filtered count matching what's actually displayed (was showing 407 raw)
- Both tabs filter by `Object.keys(OVERLAYS_REF.groups)` at render time

### Tests
Existing suite — no regressions. Overlay data is runtime JSON, not tested by unit tests.
Build is unaffected by overlay data changes.

### Build
Passing — AdminTab patch has brace/paren delta = 0, verified pre-commit.

---

## Previously Completed
- A16 -- RFM Frequency Scoring (236d471) complete
- A15.3 -- Safe Group Merge Correctness (95b9ffd) complete
- A15.2 -- GitHub Large-File Load Reliability (ed29b63) complete
- A15 -- Group AI Intel (68430c8) complete
- A14-A1, Phases 1-23 complete

---

## Last Updated
March 27, 2026
