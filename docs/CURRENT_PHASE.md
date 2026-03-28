# CURRENT PHASE -- accel-v7

## Status: Clean. patchOverlay migration complete. Ready to build.

### Last Session — March 28, 2026: patchOverlay Migration

Eliminated the stale-SHA overlay conflict bug. All 4 tabs now use atomic patch ops instead of full overlay writes.

**What changed:**
Every `saveOverlays(fullOverlay)` call in GroupDetail, DealersTab, AdminTab, AcctDetail replaced with `patchOverlay([{ op, path, value }])`. The server reads the current overlay fresh from GitHub, applies the op, validates integrity, and writes back — no stale data stomping.

**Commits (in order):**
- `1a4c2bd0` — GroupDetail: 10 call sites migrated (saveFSC, removeFSC, saveContact, deleteContact, saveNote, saveResContact, saveResWebsite, executeMerge, AI merge button)
- `5a012845` — DealersTab: saveManualReps → replaceSection op
- `7fcfb0fc` — AcctDetail: groupMove, activityLog, group create migrated; DR fallback branch removed (already used patchOverlay)
- `d8e71911` + `1c97b754` — DealersTab TypeScript prop signature cleaned up
- `2fec0c1a` + `6761255e` — AdminTab: all 11 call sites migrated (group CRUD, contact save, skipPair, approvePair, skipReview, approveReview, approveOrphan, mergeByAddr, skipOrphan)
- `b25877e3` + `b32f7483` — AccelerateApp: `saveOverlays` prop removed from all 4 tab render calls

**Result:**
- `saveOverlays` prop: 0 references remaining (it still exists in AccelerateApp as a legacy fallback for any direct callers, but no tab receives it as a prop)
- All overlay saves are now conflict-safe atomic operations
- Live site: HTTP 200 ✅

**What's next (recommended):**
Move `crm-accounts.json` (2.47MB) and `sales-history.json` (2.80MB) off GitHub to Vercel KV or Supabase. These are growing blobs being committed on every save — wrong tool for the job. overlays.json is fine where it is (2.6KB, infrequently written).

---

## Previously Completed
- March 28 Cleanup — applyManualParents wired, dead code removed, productSignals hoisted
- A16.5 -- Full Workflow Smoke Test Harness (32/32 unit tests passing)
- A16.4 -- Merge self-test harness, applyGroupCreates extraction
- A16.3 -- Merge direction + source card elimination
- A16.2 -- Build fix + initial merge direction
- A16.1 -- AI Intel Stabilization
- A15.7 -- Overlay Write Guard

## Last Updated
March 28, 2026
