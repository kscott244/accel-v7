# CURRENT PHASE — accel-v7

## Active: Phase A14 — Deterministic Account Brief in GroupDetail ✅ Complete

### Goal
Add a compact, smart-feeling "Account Brief" inside GroupDetail that summarizes account health, risk, opportunity, momentum, and best immediate move — deterministically, with no API calls.

### Baseline
A13 complete: Next Best Moves ranked action list in GroupDetail. Commit `8c6a244`.

### What Was Built

**`src/components/tabs/GroupDetail.tsx`** (commit `f7cfefe`)

Added `briefLines` useMemo and a collapsible **Account Brief** section inside the hero stats card.

**Placement:**
- Collapsed by default — "Account Brief ›" toggle appears below the PY/CY/Gap/Ret stats grid
- Tap to expand inline; tap again to collapse
- Stays inside the existing hero card — no extra screen real estate when closed

**Brief line types (3–5 bullets, generated deterministically):**
1. **Health summary** — growing/stable/at-risk/critical sentence with % and $ specifics
2. **Biggest drag** — names the top-gap child location OR top at-risk product with gap amount
3. **Biggest opportunity** — win-back product with loc count + PY, or partial-penetration product
4. **Momentum signal** — fastest-growing product if >15% vs PY
5. **Best immediate move** — mirrors the #1 ranked move from nextBestMoves

Each bullet: colored dot + prose sentence grounded in real group data. No fluffy generic text.

**No changes to:** merge workflow, search, upload pipeline, Next Best Moves section, Opportunities section, product health, data architecture.

---

## Previously Completed
- A13 — Next Best Moves (8c6a244) ✅
- A12 — Group Opportunity Signals (61c1310) ✅
- A11 — Group Product Month Drilldown (d9563fc) ✅
- A10 — Merge Group workflow verified (192a468) ✅
- A9–A1, Phases 1–23 ✅

---

## Last Updated
March 24, 2026
