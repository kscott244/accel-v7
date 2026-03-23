# CURRENT PHASE — accel-v7

## Active: Phase 5 — Extract Remaining Large Tabs ✅ Complete

### What Was Done (Phase 5)
1. **Created `src/components/tabs/TodayTab.tsx`** — Today scoring/priority tab (1,068 lines extracted)
2. **Created `src/components/tabs/GroupDetail.tsx`** — Group detail view (308 lines extracted)
3. **Created `src/components/tabs/AcctDetail.tsx`** — Account detail + SaleCalculator (870 lines extracted)
4. **Created `src/components/tabs/DealersTab.tsx`** — Dealer rep breakdown tab (695 lines extracted)
5. **Created `src/components/tabs/OutreachTab.tsx`** — Outreach/email tab (317 lines extracted)
6. **Created `src/components/tabs/AdminTab.tsx`** — Admin overlays/groups tab (471 lines extracted)
7. **Patched `src/components/AccelerateApp.tsx`** — All 6 tab bodies replaced with imports
8. **AccelerateApp.tsx reduced from 4,406 → 674 lines** (−3,732 lines, −85%)

### Each extracted tab file includes
- "use client" + @ts-nocheck header
- Self-contained imports from @/lib/tokens, @/lib/tier, @/lib/format, @/data/sku-data
- Inline primitives (Pill, Stat, Bar, AccountId, Chev, Back, fixGroupName) as needed
- Module-level data bootstrap (BADGER, DEALERS, OVERLAYS_REF) via local try/require
- Named export default matching the component name

### Commits
- ecf7bf0 — Phase 5: extract TodayTab, GroupDetail, AcctDetail, DealersTab, OutreachTab, AdminTab — AccelerateApp 4406→674 lines

---

## Previously Completed

### Phase 4 — Extract Tab Components ✅ Complete
- Created GroupsTab, EstTab, MapTab, DashTab
- AccelerateApp.tsx reduced from 5,052 → 4,400 lines
- Commit: e65991019c31

### Phase 3 — Decompose the Monolith ✅ Complete
- Extracted tokens.ts, tier.ts, format.ts, csv.ts
- AccelerateApp.tsx reduced from 5,388 → 5,053 lines

### Phase 2 — Stabilize + Consolidate ✅ Complete
### Phase 1 — Foundation Audit + Docs ✅ Complete

---

## Next Up: Phase 6

Candidates (from ROADMAP.md):
- Account workspace: notes, contacts, activity log per account
- AI briefing / territory intelligence
- Route optimization improvements
- Data freshness / CSV upload UX improvements

---

## Last Updated
March 23, 2026
