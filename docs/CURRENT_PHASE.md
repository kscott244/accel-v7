# CURRENT PHASE -- accel-v7

## Active: Strategic Accounts War Room — Consistency Cleanup — March 29, 2026

### What Was Built

**Phase: War Room consistency cleanup (narrow)**

Tightened the War Room to be internally consistent.
No behavior changes — logic centralization and naming only.

**Commits:**
- `ee2a28a3` — dsoWarRoom.ts: absorb noise suppression into shouldInclude(); single source of truth
- `c72f53ef` — DsoWarRoomTab.tsx: rename title to "Strategic Accounts War Room"; fix Intel drawer display name; remove duplicate noise suppression from tab

### Exact Inclusion Rules (OR logic, forceExclude overrides all)

All logic lives in `src/lib/dsoWarRoom.ts → shouldInclude()`.
DsoWarRoomTab calls it and does no additional business-rule filtering.

1. `group.id === "Master-Unmatched"` → always excluded
2. `group.name` starts with "UNMATCHED" → always excluded
3. `intel.forceExclude = true` → always excluded (overrides everything)
4. `intel.forceInclude = true` OR `intel.pinned = true` → **Pinned**
5. `class2` is DSO, EMERGING DSO, or contains "DSO" → **DSO**
6. `locs >= 5` AND (`cy1 >= $2,000` OR `benchGapAnn >= $10,000`) → **Multi-site**
7. `benchGapAnn >= $25,000` → **Large gap**
8. Otherwise → excluded

### Thresholds (centralized in WR_THRESHOLDS)

| Threshold | Value |
|---|---|
| minLocs | 5 |
| minCyQ1 | $10,000 |
| minBenchGapAnn | $25,000 |
| Multi-site noise floor | cy1 >= $2K OR gap >= $10K |

### UI Naming

- Title: **Strategic Accounts War Room** (was: "DSO War Room")
- Intel drawer: shows real group display name (was: raw Master-CM# string)
- Reason badges: DSO / Multi-site / Large gap / Pinned (unchanged)

### What Was NOT Changed

- No AccelerateApp.tsx changes
- No overlay/persistence changes
- No benchmark math changes
- No card layout changes

---

## Previously Completed

- War Room inclusion expansion (March 28, 2026)
- DSO War Room baseline (A16)
- Pricing Tab rebuild (Quick Credit, SKU Lookup, Tier Switch)
- Phase 12 — Territory Copilot
- Phase 11 — AI Copilot

## Last Updated

March 29, 2026

