# CURRENT PHASE -- accel-v7

## Active: Phase A16 -- RFM Frequency Scoring COMPLETE

### Goal
Add order frequency as a third scoring dimension alongside gap (Monetary) and recency.
A Diamond practice that normally orders every 21 days and is now at day 45 should
score higher than one that orders every 90 days at day 45 — the current engine
couldn't distinguish them.

### Baseline
A15.3 complete: Safe group merge correctness. Commit `95b9ffd`.

### What Was Built

**`src/lib/sales.ts`** (commit `052bf82`)
- Added `FrequencyData` interface: `{ avgIntervalDays, orderCount, freqScore }`
- Added `computeFrequencyMap(store, lastDaysMap)`:
  - Groups distinct CY order-months per childId from the SalesStore
  - Needs >= 2 data points to compute interval; ignores gaps > 13 months (data holes)
  - Computes `avgIntervalDays` as weighted average of month-to-month gaps
  - Computes `freqScore = daysSince / avgIntervalDays` at build time
  - Guards: avgInterval < 10d treated as artifact; orderCount < 2 skipped

**`src/lib/format.ts`** (commit `8ac29a2`)
- `scoreAccount()` now accepts optional third param `freqData`
- Frequency overdue block (0–15 pts, additive with existing recency score):
  - `freqScore > 2.0` → +15 pts "Overdue: Xd cycle"
  - `freqScore > 1.5` → +10 pts "Overdue: Xd cycle"
  - `freqScore > 1.25` → +5 pts  "Late: Xd cycle"
- Guards: requires `avgIntervalDays >= 14` and `orderCount >= 3` for reliable baseline
- Fully backward-compatible — undefined freqData skips the block entirely

**`src/components/AccelerateApp.tsx`** (commit `eea35a0`)
- Added `computeFrequencyMap` to sales import
- New `freqMap` useMemo (depends on `salesStore` + `allChildren`):
  - Builds `lastDaysMap` from allChildren (skips stub accounts with last=999)
  - Returns `Record<string, FrequencyData>` — O(records) computation
- `scored` useMemo: passes `freqMap[a.id]` to `scoreAccount` as third arg
- `scored` dep array: added `freqMap`

**`src/__tests__/scoring.test.ts`** (commit `df97ea1`)
- 8 new tests covering: 15pt / 10pt / 5pt / 0pt thresholds, orderCount guard,
  avgInterval guard, additivity with recency, undefined freqData safety

### Scoring Impact

Before A16: two accounts at day 45, both getting 8pts (">30d since order").

After A16:
- Monthly buyer (21d avg) at day 45: freqScore = 2.14 → +15 pts frequency bonus
- Quarterly buyer (90d avg) at day 45: freqScore = 0.5 → +0 pts (within cadence)

Real priority difference: 15 pts separating two accounts that looked identical before.

### Graceful Degradation
- If salesStore is empty (no history uploaded yet): freqMap = {} → no frequency bonus
  for any account. Existing scoring behavior unchanged.
- If account has < 3 data points: no bonus. Won't penalize new accounts unfairly.
- Works immediately with the 40,600 records already in sales-history.json.

---

## Previously Completed
- A15.3 -- Safe Group Merge Correctness (95b9ffd) complete
- A15.2 -- GitHub Large-File Load Reliability (ed29b63) complete
- A15 -- Group AI Intel (68430c8) complete
- A14-A1, Phases 1-23 complete

---

## Last Updated
March 26, 2026
