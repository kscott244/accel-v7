# CURRENT PHASE -- accel-v7

## Active: Phase A15 -- Group AI Intel (Research + Enrichment) Complete

### Goal
Add a real AI research/enrichment workflow to GroupDetail so Ken can gather public business intel before a group call -- with a review-and-save model, not silent auto-write.

### Baseline
A14 complete: Deterministic Account Brief inside hero card. Commit `f7cfefe`.

### What Was Built

**`src/components/tabs/GroupDetail.tsx`** (final commit `68430c8`)

**1. Research button in sticky header**
- "Research" button appears top-right in the GroupDetail sticky nav bar
- Triggers `runGroupResearch()` -- calls existing `/api/deep-research` with group-level context:
  - Group name, top 3 children cities, top dealer, top 5 products, location count, ownership type
- Shows "Searching..." during load; updates to "Re-research" after first run

**2. Group Intel panel**
- Appears below the hero card when research runs (above Next Best Moves)
- Dismissable with x button
- Shows: practice status, ownership note, website, contacts, hooks, talking points
- Skeleton loading state during fetch

**3. Contact scope labels**
- Each returned contact tagged with scope: "Owner / Lead Dr" (tier 1), "Office-level" (tier 2), "Group / Regional" (tier 3), "Coordinator" (tier 4)
- Scope badge is color-coded: cyan=tier 1, purple=tier 3, muted=others

**4. Review-and-save model (no silent auto-write)**
- Each contact has an individual "+ Save" button -> saves to groupContacts overlay (persists to overlays.json)
- Already-saved contacts show "Saved" (grayed, non-clickable)
- Website has a "Save" button -> saves to groupContacts as a Website entry
- Hooks section has a "+ Notes" button -> appends intel to group notes
- Nothing is auto-written -- Ken reviews and chooses what to keep

### Fix History
- Initial A15 attempt had SCOPE_LABEL TDZ and saveResNote string issues
- Clean rebuild from A14 baseline committed as `abb99cea`
- Two literal newlines inside double-quoted string literals caused SWC parser failures
- Fixed in commits `0c76feb` (join separator) and `68430c8` (saveResNotes double-newline)

**No changes to:** API routes, AcctDetail, merge workflow, scoring, upload pipeline.

---

## Previously Completed
- A14 -- Deterministic Account Brief (f7cfefe) complete
- A13 -- Next Best Moves (8c6a244) complete
- A12 -- Group Opportunity Signals (61c1310) complete
- A11 -- Group Product Month Drilldown (d9563fc) complete
- A10-A1, Phases 1-23 complete

---

## Last Updated
March 25, 2026
