# CURRENT PHASE -- accel-v7

## Status: Mission Control live. Ready to build.

### Phase: Today Tab → Mission Control — March 28, 2026

Redesigned the Today tab from a passive dashboard into an action-oriented mission board.

**Commits:**
- `a1f684d6` — New TodayTab: Mission Control with 5 action buckets
- `c9064b6a` — Fix: hoist token imports, remove require() in kpiData

**What changed:**

The Today tab now opens directly into 5 collapsible action buckets, each answering a specific question:

| Bucket | Color | Answers |
|--------|-------|---------|
| 🎯 Hit List | Red | Who to call or visit today (top 6, visits first) |
| ⚡ Easy Wins | Green | High-prob reorders under $1,500 — quick closes |
| 🚨 At Risk | Amber | Active accounts declining fast (ret < 55%, py > $800) |
| 📋 Follow Up | Blue | Due tasks + healthy accounts not visited in 60+ days |
| ⏭ Skip for Now | Gray | Low-value accounts (collapsed by default) |

**What was preserved:**
- Full scoring engine (`overdrive` useMemo) — identical logic, untouched
- Win/½/Loss outcome buttons with note prompt
- Trip planner modal (anchor + nearby stops → Google Maps)
- Outcome note modal
- Weekly delta (what changed) section
- New Adds banner
- Search with parent group collapse
- KPI strip (Q/FY toggle, attainment, gap, $/day, pipeline, projected landing)

**What was removed:**
- `recover` section (folded into Hit List + At Risk)
- `protect` section (folded into Follow Up)
- `dealerActions` section (low value display — scoring data still computed)
- Redundant section headers and passive stat labels

**Design decisions:**
- Buckets default open except "Skip for Now" (collapsed) — reduces noise on open
- ActionCard component extracts the repeated card pattern — DRY
- BucketHeader is a collapsible chevron row — one tap to hide/show each bucket
- Cards are more compact: 3-row layout (badge+ask / name / address+signals)
- At Risk uses a list view (no outcome buttons) — it's awareness, not action yet
- Follow Up mixes tasks and accounts in one panel

**File sizes post-change:**
- TodayTab.tsx: 720 lines (was 941, −23%)

---

## Previously Completed
- Data Boundary Hardening — layer contract documented, LS group-override scan removed
- patchOverlay Migration — all 4 tabs use atomic ops, SHA conflicts eliminated
- March 28 Cleanup — applyManualParents wired, dead code removed, productSignals hoisted
- A16.5 -- Full Workflow Smoke Test Harness (32/32 unit tests passing)

## Last Updated
March 28, 2026
