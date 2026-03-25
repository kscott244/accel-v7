# CURRENT PHASE — accel-v7

## Active: Phase A15 — Group AI Intel (Research + Enrichment) ✅ Complete

### Goal
Add a real AI research/enrichment workflow to GroupDetail so Ken can gather public business intel before a group call — with a review-and-save model, not silent auto-write.

### Baseline
A14 complete: Deterministic Account Brief inside hero card. Commit `f7cfefe`.

### What Was Built

**`src/components/tabs/GroupDetail.tsx`** (commit `7e2ad1d`)

**1. Research button in sticky header**
- `🔍 Research` button appears top-right in the GroupDetail sticky nav bar
- Triggers `runGroupResearch()` — calls existing `/api/deep-research` with group-level context:
  - Group name, top 3 children cities, top dealer, top 5 products, location count, ownership type (DSO/emerging/private)
- Shows "● Searching…" during load; updates to "🔍 Re-research" after first run

**2. Group Intel panel**
- Appears below the hero card when research runs (above Next Best Moves)
- Dismissable with ✕
- Shows: practice status, ownership note, website, contacts, hooks, talking points
- Skeleton pulse animation during load

**3. Contact scope labels**
- Each returned contact tagged with scope: "Owner / Lead Dr" (tier 1), "Office-level" (tier 2), "Group / Regional" (tier 3), "Coordinator" (tier 4)
- Scope badge is color-coded: cyan=tier 1, purple=tier 3, muted=others

**4. Review-and-save model (no silent auto-write)**
- Each contact has an individual `+ Save` button → saves to groupContacts overlay (persists to overlays.json)
- Already-saved contacts show `✓ Saved` (grayed, non-clickable)
- Website has a `Save` button → saves to new `groupWebsite` overlay key
- Hooks section has a `+ Notes` button → appends intel to group notes
- Nothing is auto-written — Ken reviews and chooses what to keep

**No changes to:** API routes, AcctDetail, merge workflow, scoring, upload pipeline.

---

## Previously Completed
- A14 — Deterministic Account Brief (f7cfefe) ✅
- A13 — Next Best Moves (8c6a244) ✅
- A12 — Group Opportunity Signals (61c1310) ✅
- A11 — Group Product Month Drilldown (d9563fc) ✅
- A10–A1, Phases 1–23 ✅

---

## Last Updated
March 24, 2026
