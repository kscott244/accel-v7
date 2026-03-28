# CURRENT PHASE -- accel-v7

## Status: Second Brain live. Ready to build.

### Phase 4: AcctDetail → Field Rep Second Brain — March 28, 2026

Redesigned AcctDetail section order around real field use. Logic unchanged, layout restructured.

**Commit:** `0454e8d9`
**Deploy:** HTTP 200 ✅
**Lines:** 1,202 → 1,019 (−183 lines, −15%)

**New section order (vs old):**

| # | New | Was | Why |
|---|-----|-----|-----|
| 1 | Sticky header (Research + Briefing buttons) | same | — |
| 2 | **Hero** — tighter: name + health + Q + stats | Account Header | Removed address line, tightened dealer/group into subtitle |
| 3 | **Next Best Move** | Position 12 | First content after hero — most actionable |
| 4 | **Who Matters** — doctor + feel + contacts + notes unified | Badger card (pos 8) + standalone contacts (pos 9) | Single "who to call" card, no split |
| 5 | **Activity** — follow-up callout + log form + entries | Position 15 | Immediate field capture |
| 6 | **Product Story** — stopped first, buying, white space + branch spread header | Account Intel (pos 11) | Win-backs surface first |
| 7 | Parent Group | same | Contextual, not primary |
| 8 | Multi-Dealer View | same | — |
| 9 | Product Breakdown Bars (detail, tappable monthly) | same | Detail layer |
| 10 | Log a Sale (was "Manual Sale") | same | — |
| 11 | Research Results (Deep Research + AI Briefing) | Positions 3-4 (above hero) | On-demand, below fold |
| 12 | Sales History | same | — |
| 13 | Modals: Move, Group Link, ReorderInvoice | same | — |

**What was removed:**
- "Root Depth" STEMM bar from Badger card — too abstract for field use, not actionable
- Address line from hero (Badger card has it; redundant)
- Separate "Standalone Contacts" card — merged into "Who Matters"
- "Branch Spread" as a buried subsection — promoted to header pills on Product Story

**What was NOT changed:**
- All state, useEffect, useMemo — identical
- runAI(), runDeepResearch(), applyGroupOverride() — identical
- SaleCalculator component — identical
- MultiDealerView component — identical
- Product breakdown bars with monthly expansion — identical
- All patchOverlay calls — identical
- Move modal, Group Link modal, ReorderInvoice — identical

---

## Previously Completed
- Phase 3 — GroupDetail War Room (section reorder, distributor+FSC merged, contacts unified)
- Phase 2 — Today Tab Mission Control (5 action buckets)
- Phase 1 — Data Boundary Hardening
- patchOverlay Migration — SHA conflict bug eliminated

## Last Updated
March 28, 2026
