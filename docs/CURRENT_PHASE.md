# CURRENT PHASE — accel-v7

## Active: Phase 23 — GroupDetail Upgrade ✅ Complete

### Goal
Make the parent/group detail screen the clear account command center —
unmistakably parent-level, with health status visible at a glance.

### Baseline
Commit `65156c4` — Phase 22

### What Was Changed

**src/components/tabs/GroupDetail.tsx**

1. **Health status badge** — top-right corner of header shows "Critical", "Recoverable", "Stable", "Growing", or "New" with color-coded pill matching retention %
2. **Retention bar** — full-width bar under group name, colored red/amber/green by health status
3. **Children sorted by gap** — locations now sorted biggest gap first (most at-risk at top), growing accounts at bottom. Uses `sortedChildren` memo that re-sorts when quarter changes.
4. **Child retention bars** — each location card has a mini retention bar colored by its individual retention %
5. **Child border colors** — big-gap children (>$2K) get red-tinted border, growing children get green-tinted
6. **Product gap column** — "Currently Buying" rows now show explicit red `-$X` gap alongside PY/CY
7. **Products expanded** — shows up to 10 products (was 8)
8. **Ret stat color** — now matches health color consistently (was using different thresholds)
9. **Bar import** — added `Bar` to primitives import

### Deploy
- Code commit: `cc0b131`
- Trigger commit: `792da65` (empty commit to re-trigger Vercel webhook — original push missed)
- Verified live: version API returns `792da65`

### Files Modified

| File | Change |
|------|--------|
| src/components/tabs/GroupDetail.tsx | Health badge, retention bars, sorted children, product gaps |
| docs/CURRENT_PHASE.md | Updated to Phase 23 |

---

## Previously Completed: Phase 22 — Search Model Step 4 (AccountId locs) ✅
## Previously Completed: Phase 21 — Search Model Step 3 (Parent collapse) ✅
## Previously Completed: Phase 20 — Search Model Steps 1-2 ✅
## Previously Completed: Phase 19 — Search Behavior Audit ✅
## Previously Completed: Phases 1–18 ✅

---

## Last Updated
March 24, 2026
