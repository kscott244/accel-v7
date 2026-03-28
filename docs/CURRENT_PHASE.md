# CURRENT PHASE -- accel-v7

## Active: Phase A17 -- Group Affiliation Badge (AcctDetail) COMPLETE

### What Was Done

**Goal**: Surface a group affiliation badge on account cards so Ken can see at a glance which organization an account belongs to, with one-tap navigation to the parent group.

**Scope decision**: The badge is only meaningful as a navigational aid — telling you WHERE an account belongs and letting you jump there. It's redundant inside GroupDetail (you're already in the group) and inside product drill-down cards (same context). The highest-value placement is AcctDetail, where Ken lands after tapping an account card and benefits most from the "this is part of X org" signal.

### Changes

**`src/components/tabs/AcctDetail.tsx`** (commit `dfa5ea46b5`):
- Added `GroupBadge` to import from `@/components/primitives`
- Rendered `GroupBadge` in the account header, below the health status pill
- Only renders when `parentGroup.locs >= 3` (real multi-location org, not solo practice)
- Badge taps call `goGroup()` to navigate to parent group detail view
- Uses `fixGroupName(parentGroup)` for clean name display (strips tier/CM suffix noise)
- Count source: `parentGroup.locs` (the rollup already on the group object, set during `applyOverlays`) with fallback to `parentGroup.children?.length`
- Zero changes to grouping logic, merge behavior, or data persistence

### Count source assumption
`parentGroup.locs` is the canonical location count set during data processing — it reflects the actual number of children after overlays are applied. No new grouping or counting logic introduced.

### Build
Brace/paren balance delta = 0. HTTP 200 on live site.

### Deploy
Commit `dfa5ea46b54717a0389f7732e334f5b0bbcdd4db` — READY

---

## Previously Completed
- A16.5 -- Full Workflow Smoke Test Harness (eb0e71a308 / 6e8cfaf2da)
- A16.4 -- Merge self-test harness, applyGroupCreates extraction (4bcdb28dfe)
- A16.3 -- Merge direction + source card elimination (0b348f4fc7 / 60c95ff27f)
- A16.2 -- Build fix + initial merge direction (083d3f4f77)
- A16.1 -- AI Intel Stabilization (238ed1b / 5a6edad / 6501f78)
- A15.7 -- Overlay Write Guard (ba5e307 / 6a853ca)

## Last Updated
March 27, 2026
