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

### Phase 5 Hotfixes (March 23, 2026 — applied after initial extraction)
These were discovered post-deploy and fixed in the same phase:

- **Missing `$$` import** in , ,  —  formatter was not carried over when tabs were extracted from the monolith. Caused  on load.
  - Commits: , , 

- **118 stub children with no `pyQ`** in `preloaded-data.ts` — accounts in MDM with zero order history were passed to `scoreAccount()` with undefined revenue data, crashing the render. Fixed in `extractLeaves()` in `AccelerateApp.tsx` with safe defaults.
  - Commit: 

- **Broken `Master-RDP-001` overlay group** — custom group created via the group-merge feature had a stub child (FLANDERS DENTAL STUDIO) with no revenue data. Removed from `data/overlays.json`.
  - Commit: 

- **ErrorBoundary now shows actual error text** — added error message display to the crash screen so future issues can be diagnosed without needing browser DevTools.
  - Commit:  *(can be reverted once stable)*

- **localStorage key bump** — renamed `accel_data` → `accel_data_v2` and `overlay_cache` → `overlay_cache_v2` to bust stale cached data on all devices.
  - Commit: 

### Completion Criteria — All Met ✅
- All major tabs extracted into separate files ✅
- AccelerateApp.tsx reduced to shell + routing + state ✅
- App loads and renders correctly on mobile ✅
- All commits deployed and verified green on Vercel ✅

### Final Commits
-  — Phase 5: extract tabs (initial)
-  — fix: $$ import TodayTab
-  — fix: $$ import GroupDetail
-  — fix: $$ import DealersTab
-  — fix: guard 118 stub children in extractLeaves
-  — fix: remove broken Master-RDP-001 from overlay groups

---

## Previously Completed

### Hotfix — Data Boundary Normalization ✅ Complete
- **`src/data/index.ts`**: Replaced raw cast with `normalizeOffice()` mapper
- Commit: `f4f3b4b`

### Phase 4 — Extract Tab Components ✅ Complete
- Created GroupsTab, EstTab, MapTab, DashTab
- Commit: `e659910`

### Phase 3 — Decompose the Monolith ✅ Complete
- Extracted tokens.ts, tier.ts, format.ts, csv.ts

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
