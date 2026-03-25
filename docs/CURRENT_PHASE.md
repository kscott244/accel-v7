# CURRENT PHASE — accel-v7

## Active: Phase A13 — Next Best Moves in GroupDetail ✅ Complete

### Goal
Make GroupDetail action-oriented by surfacing a ranked "Next Best Move" list of 3–4 specific, verb-first actions based on actual group/product/location data.

### Baseline
A12 complete: Opportunity signals (win-back, momentum, at-risk, partial penetration) in GroupDetail. Commit `61c1310`.

### What Was Built

**`src/components/tabs/GroupDetail.tsx`** (commit `8c6a244`)

Added `nextBestMoves` useMemo and a **Next Best Move** section rendered directly below the hero stats card (before Distributor Split).

**Action types (in priority order):**
1. **Prioritize [Location] first** — highest-gap child in the group with gap > $500
2. **Win back [Product]** — top stopped product (PY ≥ $500) with loc count and PY dollar
3. **Expand [Product] to N more locs** — partial-penetration product at <60% of locations
4. **Reinforce [Product] momentum** — fastest-growing active product (>15% vs PY)
5. **Defend [Product] — declining fast** — biggest at-risk active product (<60% of PY)

Max 4 moves shown. Each has a numbered circle badge, bold action verb, specific "why" sub-line, and color-coded accent bar. Section hidden when no moves apply.

**No changes to:** merge workflow, search, upload pipeline, Opportunities section, product health, data architecture.

---

## Previously Completed
- A12 — Group Opportunity Signals (61c1310) ✅
- A11 — Group Product Month Drilldown (d9563fc) ✅
- A10 — Merge Group workflow verified (192a468) ✅
- A9 — adjs cross-device via overlays ✅
- A8 — Cross-device state audit ✅
- A7 — Overlay schema hardening ✅
- A6 — DealersTab durable rep persistence ✅
- Phases 1–23 ✅

---

## Last Updated
March 24, 2026
