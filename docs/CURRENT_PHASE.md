# CURRENT PHASE -- accel-v7

## Active: Phase A15.7 -- Overlay Write Guard COMPLETE

### Baseline
A15.6 complete: CPID queue / suggestion system cleanup. Commit `8765324`.

### Problem
On 2026-03-27 at 00:47 UTC, overlays.json was silently overwritten with an empty
object, destroying all 22 overlay groups, 3 groupMoves, 2 fscReps, and 3 groupContacts.

Root cause (confirmed by commit history analysis):
1. Fresh session/device with empty localStorage
2. `loadedOverlays = EMPTY_OVERLAYS` (0 groups) before GitHub fetch resolved
3. Some action triggered `saveOverlays(next)` during that window
4. The API wrote the empty payload over the populated GitHub file — no check, no guard

### What Was Fixed

**`src/app/api/save-overlay/route.ts`** (commit `ba5e307`)

Added `meaningfulItemCount(ov)` helper — counts groups + groupMoves + nameOverrides
+ contacts + fscReps + groupContacts + groupDetaches + skippedCpidIds.

Write guard inserted between SHA fetch (step 1) and the GitHub PUT (step 3):
- Decodes the current GitHub overlay content (already fetched for SHA)
- Computes `currentCount` and `incomingCount` via `meaningfulItemCount()`
- Blocks if: `incomingGroups === 0 AND incomingCount < 3 AND currentCount >= 3`
- Returns HTTP 409 with `code: "OVERLAY_WIPE_PREVENTED"` and clear human message
- If decode fails, allows the write (guard fail-open — don't block legitimate saves)

**`src/components/AccelerateApp.tsx`** (commit `6a853ca`)

`saveOverlays` client function now handles 409 distinctly:
- Detects `res.status === 409 && data.code === "OVERLAY_WIPE_PREVENTED"`
- Sets save status to "error" with message:
  "Save blocked — app loaded before data was ready. Your data on GitHub is safe. Please reload."
- Returns false (does not report success)
- Existing error banner in the UI surfaces this message immediately

### Guard Thresholds and Rationale

```
incomingGroups === 0   → the most dangerous signal: no groups at all
incomingCount  <  3    → also catches near-empty payloads (only skips, adjs, etc.)
currentCount   >= 3    → only blocks if GitHub already has real data (allows fresh installs)
```

The incoming threshold is 3, not 0, to catch payloads that have a few fields but no
groups — still thin enough to be dangerous. The current threshold of 3 prevents
blocking genuinely new installations where GitHub is also empty.

### Scenario Coverage

| Scenario | Before | After |
|----------|--------|-------|
| Fresh device, empty localStorage, action before GitHub fetch | Wipes GitHub | Blocked (409), safe |
| Normal save with groups | Succeeds | Succeeds (unchanged) |
| Legitimate delete of all groups (edge case) | Succeeds | Blocked if other data present |
| Fresh install, GitHub also empty | N/A | Allowed (currentCount < 3) |
| Save fails, client receives 409 | Generic error shown | Specific "data safe, reload" message |

Note on the legitimate all-groups-delete edge case: if Ken genuinely needs to delete
all groups, they should do it one at a time through the Admin UI — those saves always
have the full overlay context and will pass the guard (incomingCount will be >= 3 from
other fields). The guard only fires when the entire overlay looks like a blank slate.

### Tests
Existing 42-test suite, no regressions. The guard is server-side API logic that
requires live GitHub interaction to test end-to-end; correctness verified by code review
of the threshold logic and the two commit/error paths.

### Build
Passing — brace/paren delta = 0 on AccelerateApp.tsx, verified pre-commit.
save-overlay route is TypeScript with `ignoreBuildErrors: true` — no build issues.

---

## Previously Completed
- A15.6 -- CPID Queue / Suggestion System Cleanup (8765324) complete
- A15.5 -- App Error Boundary / Crash Containment (a02d401) complete
- A15.4 -- Merge Source-of-Truth Cleanup (79d6d2d) complete
- A16 -- RFM Frequency Scoring (236d471) complete
- A15.3 -- Safe Group Merge Correctness (95b9ffd) complete
- A15.2 -- GitHub Large-File Load Reliability (ed29b63) complete
- A15-A1, Phases 1-23 complete

---

## Last Updated
March 27, 2026
