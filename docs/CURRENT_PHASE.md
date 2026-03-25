# CURRENT PHASE — accel-v7

## Active: Phase A12 — Group-Level Opportunity Signals ✅ Complete

### Goal
Surface product/opportunity signals inside GroupDetail so the view is more actionable — not just historical numbers but specific next-step signals.

### Baseline
A11 complete: Inline month drilldown for products in GroupDetail. Commit `d9563fc`.

### What Was Built

**`src/components/tabs/GroupDetail.tsx`** (commit `61c1310`)

Added `opportunitySignals` useMemo and a new **Opportunities** section rendered between Group Notes and Group Product Health.

**Signal types (computed from existing groupBuying / groupStopped data):**
- **Win-back** — products in `groupStopped` with PY ≥ $500 → "Win-back: [Product] — Was $X PY — now $0"
- **Momentum** — products growing >15% vs PY → "[Product] momentum — +N% vs PY · $X CY"
- **At-risk** — active products below 60% of PY → "[Product] at risk — N% of PY · gap $X"
- **Partial penetration** — product bought at <60% of locations (multi-loc groups only) → "[Product] partial — N of M locs buying"

**UI:**
- Orange "OPPORTUNITIES" section header
- Each signal: icon + bold label + muted detail line + colored right-bar accent
- Max 6 signals shown, section hidden if zero signals
- No new state, no API calls, no changes to data architecture

**No changes to:** merge workflow, search, upload pipeline, product health section, or any other tab.

---

## Previously Completed
- A11 — Group Product Month Drilldown (d9563fc) ✅
- A10 — Merge Group workflow verified (192a468) ✅
- A9 — adjs cross-device via overlays (f2475b9 + 0a4c11d) ✅
- A8 — Cross-device state audit ✅
- A7 — Overlay schema hardening (dealerManualReps) ✅
- A6 — DealersTab durable rep persistence ✅
- Phase 23 — GroupDetail Upgrade ✅
- Phases 1–22 ✅

---

## Last Updated
March 24, 2026
