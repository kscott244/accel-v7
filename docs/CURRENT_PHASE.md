# CURRENT PHASE -- accel-v7

## Active: Phase A16.3 -- Merge Direction and Source Card Elimination COMPLETE

### Baseline
A16.2 complete: build fix (save-overlay regex) + initial direction logic (7e36d046).

### What Was Done

**Bug**: Merging a single-location account (e.g. Middletown Dental) INTO an existing
multi-location group (e.g. Edge Dental) left the source as a standalone orphan card
showing $0/$0. The source was never absorbed. Two root causes found:

**Root cause 1 — wrong mechanism used (groupMoves)**:
Earlier in-session fix wrote a `groupMoves` entry to move Middletown into Edge Dental.
But `applyGroupOverrides` only searches `g.children` — it never looks at top-level groups.
Middletown (Master-CM1921839) is a top-level group, not a child of any group. Silent no-op.

**Root cause 2 — executeMerge wrote leaf IDs only, not the source group's own ID**:
When absorbing into target, `executeMerge` was writing the source's leaf child IDs
into the target's `childIds`. For a self-referencing single-loc group (where group.id
=== child.id), this meant the source group's own top-level ID was never in childIdSet.
Step 4b in `applyOverlays` only removes top-level groups whose `id` is in `childIdSet`
— so the source survived as an orphan. Its financials were lost because the leaf object
that was added had no pyQ data (wrong copy of the node).

**Fixes**:

**`src/components/tabs/GroupDetail.tsx`** (commit `0b348f4fc7`):
- `executeMerge`: when absorbing source INTO target, always include `sourceGroupId`
  (the source group's own top-level ID) in childIds, in addition to leaf IDs.
- This ensures Step 4b removes the source from the top-level result array.
- Step 4d then re-expands it via `mergedSourceGroups`, recovering full financial data.
- Added `targetHasOverlay` as a third absorption trigger condition.

**`data/overlays.json`** (commit `60c95ff27f`):
- Wrote correct `groups[Master-CM047997]` (Edge Dental) with 12 childIds including
  `Master-CM1921839` (Middletown) — the format that actually works through applyOverlays.
- Cleared the broken `groupMoves` entry.

### Merge Direction Rule (now canonical)
Absorb current INTO target when ANY of:
- target has more children (targetIsLarger)
- target is a CSV-native multi-loc group with no overlay entry (targetIsCsvNative)
- target already has an overlay entry (targetHasOverlay)

### Child Integrity
- Source group's own ID is always in childIds (Step 4b removal key)
- Leaf IDs also included (handles overlay-keyed source groups)
- Dedup preserved via `if (!merged.includes(id))` checks
- Financial data recovered via Step 4d mergedSourceGroups expansion path

### Build
Passing — brace/paren delta = 0 on GroupDetail.tsx. Both commits READY on Vercel.

### Deploy
- `0b348f4fc7` (GroupDetail fix) — READY
- `60c95ff27f` (overlay data fix) — READY (latest production)
- HTTP 200 confirmed

---

## Previously Completed
- A16.2 -- Build Fix: save-overlay broken regex + initial merge direction (083d3f4f77)
- A16.1 -- AI Intel Stabilization (238ed1b / 5a6edad / 6501f78)
- A15.7 -- Overlay Write Guard (ba5e307 / 6a853ca)

## Last Updated
March 27, 2026
