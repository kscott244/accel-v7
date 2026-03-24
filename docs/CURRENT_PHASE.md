# CURRENT PHASE — accel-v7

## Active: Phase 15 — Product Drill-Down in AcctDetail ✅ Complete

### Goal
Make each product row in the Product Breakdown card tappable. Tapping expands
an inline month-by-month history table for that specific product from salesStore.

### What Was Built
Two targeted patches to `AcctDetail.tsx` only — no other files changed.

**State added:**
- `expandedProduct: string | null` — which product name (l3) is currently expanded

**Product row changes (Product Breakdown card):**
- Header row now has `cursor:pointer` and `onClick` toggling `expandedProduct`
- Animated `▶` chevron rotates 90° when expanded (CSS transition)
- Below the bar: when `isExpanded`, renders a `T.s2` inline panel with a
  Month | Q | PY | CY table — same column widths, same font/color tokens
  as the Phase 14 Sales History card
- Records filtered to `childId === acct.id && l3 === p.n`, sorted newest-first
- Empty state: "No history on record for this product." when store has no matching records
- Only one product expanded at a time (tapping another collapses the previous)

### Files Modified

| File | Change |
|------|--------|
| `src/components/tabs/AcctDetail.tsx` | Added `expandedProduct` state; replaced product row render with tappable header + inline expansion |

### Commit
- `1cfb49254b` — AcctDetail: product drill-down (Phase 15)

---

## Previously Completed: Phase 14 — Account-Level Sales History in AcctDetail ✅
## Previously Completed: Phase 13 — Sales History UI in Admin Tab ✅
## Previously Completed: Phase 12 — Incremental Rollup Derivation ✅
## Previously Completed: Phase 11 — Sales History Layer ✅
## Previously Completed: Phase 10 — CRM / Sales Data Split ✅
## Previously Completed: Phases 1–9 ✅

---

## Last Updated
March 24, 2026
