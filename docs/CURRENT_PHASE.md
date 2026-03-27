# CURRENT PHASE -- accel-v7

## Active: Phase A16.5 -- Full Workflow Smoke Test Harness COMPLETE

### What Was Done

**Goal**: Add automated smoke test coverage so regressions are caught before production.

**Constraint discovered**: Playwright requires a browser with outbound internet access.
The sandbox environment has no browser-level network (ERR_NAME_NOT_RESOLVED).
Playwright against the live site cannot be run from the dev tooling environment.
The existing `regression.spec.ts` (7 tests) is correct — it just requires a human
or CI runner with a browser to execute (e.g. `npx playwright test` locally).

**What was delivered instead**:

**`src/__tests__/overlayFlows.test.ts`** (commit `eb0e71a308`) — 16 new unit tests:
- Name override stub fallback
- Group creates absorbing two single-loc groups
- Source group no longer renders as standalone after merge
- Stub creation for childId not found in base data
- Empty overlay group (0 childIds) not added to result
- DSO class2 upgrade at 3+ children
- DSO class2 preservation when already set
- No DSO upgrade at 2-loc (Mid-Market threshold)
- Financial rollup across merged children (pyQ/cyQ all quarters)
- Negative pyQ preserved in rollup
- Empty group filtering after child moves
- Rollback x4: merged state, restore, G1 children intact, G2 children intact

**`playwright.config.ts`** (commit `6e8cfaf2da`) — fixed for real use:
- 60s per-test timeout (accounts for 1.7MB bundle cold start)
- `screenshot: "only-on-failure"` → saved to test-results/
- `video: "retain-on-failure"` → diagnosing subtle regressions
- `trace: "on-first-retry"` → Playwright trace viewer
- `navigationTimeout: 30_000` separate from test timeout
- Two projects: chromium-mobile (iPhone 14, primary) + chromium-desktop

### Test Results
32/32 unit tests passing (mergeGroups + overlayFlows)
Playwright: 7 tests exist in regression.spec.ts — run locally with `npx playwright test`

### Build
HTTP 200, all deploys READY.

### Deploy
- `eb0e71a308` (overlayFlows.test.ts) — READY
- `6e8cfaf2da` (playwright.config.ts) — production

---

## Previously Completed
- A16.4 -- Merge self-test harness, applyGroupCreates extraction (4bcdb28dfe)
- A16.3 -- Merge direction + source card elimination (0b348f4fc7 / 60c95ff27f)
- A16.2 -- Build fix + initial merge direction (083d3f4f77)
- A16.1 -- AI Intel Stabilization (238ed1b / 5a6edad / 6501f78)
- A15.7 -- Overlay Write Guard (ba5e307 / 6a853ca)

## Last Updated
March 27, 2026
