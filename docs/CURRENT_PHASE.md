# CURRENT PHASE -- accel-v7

## Active: Phase A15.6 -- CPID Queue / Suggestion System Cleanup COMPLETE

### Baseline
A15.5 complete: App error boundary / crash containment. Commit `a02d401`.

### Problem
The Admin merge suggestion system had a clean/broken asymmetry:

- **Approvals** → written to `overlays.groups` → persisted to GitHub → survive any device or session
- **Skips** → written to `localStorage("cpid_skipped")` only → lost on device change, fresh install, or localStorage clear

This meant a skip on Ken's phone would reappear on desktop, after a cache clear, or after
any session where localStorage was empty. Every skipped suggestion was effectively
ephemeral, not durable.

Additionally, the CPID static files had no explicit documentation of their role —
they could be mistaken for source of truth rather than readonly suggestion inputs.

### What Was Fixed

**`src/lib/data.ts`** (commit `523005f`)
- Added `skippedCpidIds: []` to `EMPTY_OVERLAYS` schema
- Documents the field role inline: suggestion inputs (CPID files) are never source
  of truth — only `overlays.groups` (applied) and `overlays.skippedCpidIds` (dismissed)

**`src/components/tabs/AdminTab.tsx`** (commit `4ee66ce`)
- Added import comment explicitly marking CPID_MERGES and CPID_REVIEW as
  "SUGGESTION INPUTS only — static snapshots, never written to, never source of truth"
- `skippedMergeIds` initializer now reads from `OVERLAYS_REF.skippedCpidIds` first
  (authoritative, GitHub-persisted), then merges localStorage (migration fallback
  for any skips made before A15.6)
- `skipPair` now calls `saveOverlays({...OVERLAYS_REF, skippedCpidIds: newSkipIds})`
  after updating local state — skip persists to GitHub via the same overlay pipeline
  as approvals
- `skipReview` same treatment
- localStorage write preserved as a fast-path cache (still written on skip for
  immediate snappy UI, but overlays is now authoritative)

**`data/overlays.json`** (commit `6a23314`)
- Added `skippedCpidIds: []` field to the live overlay document so the schema
  is consistent from first use

### Suggestion System — Before vs After

| Action | Before A15.6 | After A15.6 |
|--------|--------------|-------------|
| Approve merge | Persisted to overlays (GitHub) ✓ | Unchanged ✓ |
| Skip suggestion | localStorage only — lost on device change | overlays (GitHub) + localStorage cache |
| Fresh device/session | All skips reappear | Skips from overlays.skippedCpidIds restored |
| Filtered counts | Match displayed rows ✓ (fixed A15.4) | Unchanged ✓ |
| CPID file role | Implicit | Explicitly documented as suggestion input |

### Source of Truth — After A15.6
- **Applied merges**: `overlays.groups` (keyed by group ID)
- **Dismissed suggestions**: `overlays.skippedCpidIds` (array of IDs)
- **Suggestion candidates**: `cpid-pending-merges.json` + `cpid-review-queue.json` (readonly, static, never written)
- **Runtime view**: filtered at render time: `candidates - applied - skipped`

### Tests
Existing 42-test suite, no regressions. Skip persistence is runtime behavior
involving overlay saves — not covered by unit tests, correctness verified by code review.

### Build
Passing — brace/paren delta = 0 on all edited files, verified pre-commit.

---

## Previously Completed
- A15.5 -- App Error Boundary / Crash Containment (a02d401) complete
- A15.4 -- Merge Source-of-Truth Cleanup (79d6d2d) complete
- A16 -- RFM Frequency Scoring (236d471) complete
- A15.3 -- Safe Group Merge Correctness (95b9ffd) complete
- A15.2 -- GitHub Large-File Load Reliability (ed29b63) complete
- A15-A1, Phases 1-23 complete

---

## Last Updated
March 27, 2026
