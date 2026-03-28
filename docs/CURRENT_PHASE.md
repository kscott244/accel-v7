# CURRENT PHASE -- accel-v7

## Active: Strategic Accounts War Room — March 28, 2026

### What Was Built

**Phase: War Room inclusion expansion**

Upgraded DSO War Room into a Strategic Accounts War Room.
Additive only — existing DSO behavior fully preserved.

**Commits:**
- `617c328a` — dsoWarRoom.ts: thresholds, shouldInclude(), IncludeReason, forceInclude/Exclude
- `442280cd` — DsoWarRoomTab.tsx: expanded filter, reason badges, noise suppression

**Inclusion rules (OR logic, forceExclude overrides all):**
1. class2 is DSO or EMERGING DSO → badge: none (existing behavior)
2. locs >= 5 AND cy1 >= $2K or gap >= $10K → badge: Multi-site
3. benchGapAnn >= $25,000 → badge: Large gap
4. intel.forceInclude = true OR intel.pinned = true → badge: Pinned

**Thresholds (centralized in WR_THRESHOLDS):**
- minLocs: 5
- minCyQ1: $10,000
- minBenchGapAnn: $25,000
- Noise suppression: Multi-site must have cy1 >= $2K OR gap >= $10K

**Overlay fields added:**
- forceInclude: boolean — pull any group into War Room
- forceExclude: boolean — remove any group from War Room
- accelTier: string — manual Accelerate pricing tier

**UX:**
- DSO accounts: no reason badge (same as before)
- Non-DSO accounts: small badge (Multi-site / Large gap / Pinned)
- War Room name unchanged

**Deploy:** HTTP 200 ✅

---

## Previously Completed
- DSO War Room baseline (A16)
- Pricing Tab rebuild (Quick Credit, SKU Lookup, Tier Switch)
- Phase 12 — Territory Copilot
- Phase 11 — AI Copilot

## Last Updated
March 28, 2026
