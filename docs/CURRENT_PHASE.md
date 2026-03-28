# CURRENT PHASE -- accel-v7

## Status: Clean. Ready to build.

### Last Session — March 28, 2026: Repo Cleanup

Full audit + targeted fixes. No features added — strictly correctness and performance.

**Commits:**
- `ab099ee7` — `applyManualParents` wired as static import into preloaded boot sequence. Downtown DDS now groups correctly on first load without a CSV upload. Removed dead `goAcctFn` (was defined but never called — navigation uses `goSmartFn`).
- `683ad71a` — Removed debug `console.log("[find-group-matches] result:", ...)` from AcctDetail production build.
- `765d8929` — GroupDetail: hoisted `topStop` / `topAtRisk` / `topGrowing` into a shared `productSignals` useMemo. These three filter+sort expressions were running identically inside both `nextBestMoves` and `briefLines` on every render. Now computed once, referenced twice.

**Confirmed clean (do not re-audit):**
- `import * as DataModule` + named import from `@/lib/data` are both needed — namespace import is the only way to mutate the live ES module export so all tabs share `OVERLAYS_REF`
- Bare `catch {}` blocks are intentional — network fallback pattern, not sloppiness
- `DealersTab.tsx` `.children.` accesses are safe — groups are always hydrated before reaching that component
- All 16 API routes exist in repo (`load-crm`, `save-sales`, `version`, etc.)
- `A15.x` / `A16.x` phase comments are stale but harmless, not worth a commit

**Current file sizes (post-cleanup):**
- AccelerateApp.tsx: 1,025 lines
- GroupDetail.tsx: 1,664 lines
- AdminTab.tsx: 1,152 lines
- AcctDetail.tsx: 1,207 lines
- TodayTab.tsx: 941 lines
- DealersTab.tsx: 834 lines
- csv.ts: 657 lines

---

## Previously Completed
- A16.5 -- Full Workflow Smoke Test Harness (32/32 unit tests passing)
- A16.4 -- Merge self-test harness, applyGroupCreates extraction (4bcdb28dfe)
- A16.3 -- Merge direction + source card elimination (0b348f4fc7 / 60c95ff27f)
- A16.2 -- Build fix + initial merge direction (083d3f4f77)
- A16.1 -- AI Intel Stabilization (238ed1b / 5a6edad / 6501f78)
- A15.7 -- Overlay Write Guard (ba5e307 / 6a853ca)

## Last Updated
March 28, 2026
