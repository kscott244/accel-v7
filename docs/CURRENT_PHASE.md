# CURRENT PHASE -- accel-v7

## Active: Phase A18 -- New Adds Feature COMPLETE

### What Was Done

**Goal**: Implement the New Adds feature using docs/new_adds.json — 67 accounts with new Q1 2026 product purchases presented in a RED/GREEN KPI view.

### Schema (docs/new_adds.json)
Array of 67 objects. Fields: `mdm`, `name`, `products[]`, `addr`, `city`, `state`, `zip`, `email`, `phone`, `color` (RED|GREEN), `first_date`, `last_date`.
- 66 RED, 1 GREEN
- 64 Master-CM MDMs, 2 BNK, 1 HEN
- 10 missing email, 1 missing phone — handled gracefully

### RED/GREEN interpretation
The `color` field is **pre-assigned in the source data** — Ken's own judgment from the export. RED = needs follow-up (first-time buyer who hasn't reordered or stalled). GREEN = on track (confirmed repeat buyer). We display it as-is; we do not recompute it.

### What already existed
`NewAddsSection.tsx` was already built (150 lines) and wired into TodayTab as a collapsible toggle. The component was functional but had two gaps:

1. **No KPI summary** — just a text count, no visual executive summary
2. **Wrong matching logic** — the `childToGroup` lookup used child IDs only. But 64 of 67 accounts have Master-CM MDMs, which are PARENT/group IDs, not child IDs. Nearly all accounts silently had no match → no navigation.
3. **Hardcoded counts** in TodayTab banner subtitle ("67 accounts · 66 need follow-up")

### Changes

**`src/components/tabs/NewAddsSection.tsx`** (commit `4d8e95ea5b`):
- Added `KPISummary` component: 2-column RED/GREEN KPI pills with large counts + conversion progress bar
- Added `parentToGroup` lookup keyed by `g.id` to match Master-CM MDMs correctly
- Navigation: goAcct for child matches (BNK/HEN), goGroup for parent matches (Master-CM) — correct for 64/67 accounts
- Chev only renders when card is navigable; cursor changes accordingly
- All fields handled defensively (missing email/phone/addr skip gracefully)
- 248 lines total (up from 150)

**`src/components/tabs/TodayTab.tsx`** (commit `9ea379f7bb`):
- Imported `new_adds.json` directly and computed `NA_TOTAL`, `NA_RED`, `NA_GREEN` as module-level constants
- Banner subtitle now reads from live data instead of hardcoded strings

### Build
Brace/paren balance delta = 0 on both files. Deploy state: success. HTTP 200.

### Deploy
Commit `9ea379f7bb63f0b85d51e82e191d616396550644` — READY

---

## Previously Completed
- A17 -- Group Affiliation Badge in AcctDetail (dfa5ea46b5)
- A16.5 -- Full Workflow Smoke Test Harness (eb0e71a308 / 6e8cfaf2da)
- A16.4 -- Merge self-test harness, applyGroupCreates extraction (4bcdb28dfe)
- A16.3 -- Merge direction + source card elimination (0b348f4fc7 / 60c95ff27f)
- A16.2 -- Build fix + initial merge direction (083d3f4f77)
- A16.1 -- AI Intel Stabilization (238ed1b / 5a6edad / 6501f78)
- A15.7 -- Overlay Write Guard (ba5e307 / 6a853ca)

## Last Updated
March 27, 2026
