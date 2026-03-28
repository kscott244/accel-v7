# CURRENT PHASE — accel-v7
> Last updated: March 27, 2026

## Next up: T4 — New Adds feature
67 accounts in docs/new_adds.json. RED/GREEN KPI view. Banner in TodayTab already exists (setShowNewAdds). Need to wire real data from new_adds.json into NewAddsSection component.

---

## Session Quick-Start
- Repo: `kscott244/accel-v7` | Branch: `master` | Live: `accel-v7.vercel.app/accelerate`
- PAT in userMemories. **Always push via Git Data API** (blobs→tree→commit→force-patch ref). Contents API 409s on files >~50KB.
- All writes go through `saveOverlays()` → `/api/save-overlay` → GitHub `data/overlays.json`
- `@ts-nocheck` on all tab files. Inline styles only (`T` tokens). No Tailwind in main app.

---

## Task Status
- [x] T1/T2 — Address display on account cards (GroupsTab + TodayTab) | `28567d32`
- [x] T3 — GroupBadge on Overdrive + Trip Planner cards | `cee3c6d6`
- [ ] T4 — New Adds feature (67 accounts, RED/GREEN KPI)
- [ ] T5 — Lock down auto-group-creation
- [x] T6 — Anchor-orphan suggestions in Admin tab | `d715fb78`
- [x] T7 — Smart child consolidation | `47cd38dd`

---

## T7 — Smart Child Consolidation (COMPLETE)
**Commit:** `47cd38dd`
**File:** `src/components/tabs/TodayTab.tsx`

**What was built:**
- `consolidatedMap` + `suppressedIds` useMemo — groups same-address accounts from different parent groups (dealer splits) at render time. Runtime only, no writes.
- Search results: sibling accounts suppressed from list; primary card shows dealer breakdown sub-row ("Same address · N dealers combined") with per-dealer PY figures
- Only applies to single-loc groups (`groupLocsMap[gId] === 1`) — multi-loc DSOs unaffected
- Address normalization: street/avenue/road/drive/blvd abbreviations, city appended as disambiguation

**Build:** HTTP 200 ✓
**Deploy:** Live ✓
