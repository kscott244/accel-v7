# CURRENT PHASE -- accel-v7

## Status: War Room live. Ready to build.

### Phase 3: GroupDetail → War Room — March 28, 2026

Redesigned GroupDetail section order and layout density. No logic changed, no data changed — purely presentation and information hierarchy.

**Commit:** `b4c7bc4a`
**Deploy:** HTTP 200 ✅
**Lines:** 1,656 → 1,566 (−90 lines, −5%)

**New section order (vs old):**

| # | New | Was |
|---|-----|-----|
| 1 | Sticky header | same |
| 2 | Hero: name + health + Q selector + stats + Intel Brief | Hero (with ret bar — removed) |
| 3 | **What to do next** (Next Best Moves) | AI Group Intel |
| 4 | **Opportunities** | Suggested Merges |
| 5 | **Locations** (with ghost locs inline) | Next Best Moves |
| 6 | **Products** (stopped first, then buying) | Distributor Split |
| 7 | **Distributor Leverage** (split bars + FSC inline per row) | FSC Contacts (separate) |
| 8 | **Contacts** (saved + research-found unified) | Group Contacts |
| 9 | Notes | Group Notes |
| 10 | AI Group Intel | Contact modal |
| 11 | Suggested Merges | Opportunities |
| 12 | Modals: contact, merge, FSC edit | Product Health |
| — | — | Locations (was after products) |

**What changed:**
- "Next Best Moves" and "Opportunities" promoted above the fold — now the first things visible after the hero
- Locations moved up (position 5 vs end), before products and distributor
- Distributor Split and FSC Contacts merged into one "Distributor Leverage" section — FSC rep row appears inline under each distributor bar
- Group Contacts and research-found contacts unified into one "Contacts" panel — research contacts show with save button, saved contacts show with call/edit
- Ret bar removed from hero (redundant with health badge + Ret stat)
- "Account Brief" renamed "Intel Brief" — still collapsible, same content
- MONTHS_SHORT/QMAP constants extracted from duplicated product loop → single shared constant
- Ghost locations moved inline with the Locations section
- Products section: "Stopped" always shown first (win-back opportunities surface immediately)
- AI Group Intel moved below the fold (it's secondary to the action items)

**What was NOT changed:**
- All useMemo computations (scoring, productSignals, nextBestMoves, briefLines, etc.)
- All state variables
- All save/patch functions (FSC, contacts, notes, merge)
- Product drill-down full-screen view (selProduct)
- executeMerge() and the merge modal
- All patchOverlay calls

---

## Previously Completed
- Phase 2 — Mission Control (Today tab → 5 action buckets)
- Phase 1 — Data Boundary Hardening
- patchOverlay Migration — SHA conflict bug eliminated
- March 28 Cleanup — applyManualParents, productSignals, dead code

## Last Updated
March 28, 2026
