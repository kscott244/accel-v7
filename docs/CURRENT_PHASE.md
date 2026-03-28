# CURRENT PHASE — accel-v7
> Last updated: March 27, 2026

## Active: Task 7 — Smart Child Consolidation
Same-address dealer-split accounts show as ONE card with combined revenue.

---

## Session Quick-Start
- Repo: `kscott244/accel-v7` | Branch: `master` | Live: `accel-v7.vercel.app/accelerate`
- PAT in userMemories. Push via Git Data API (blobs→tree→commit→force-patch ref). Contents API 409s on large files.
- All writes go through `saveOverlays()` → `/api/save-overlay` → GitHub `data/overlays.json`
- `@ts-nocheck` on all tab files. Inline styles only (`T` tokens). No Tailwind in main app.

---

## Task Status
- [x] T1 — Address display on account cards (GroupsTab) | `28567d32`
- [x] T2 — Address display (was same session as T1)
- [x] T3 — GroupBadge on Overdrive + Trip Planner cards | `cee3c6d6`
- [ ] T4 — New Adds feature (67 accounts in docs/new_adds.json, RED/GREEN KPI view)
- [ ] T5 — Lock down auto-group-creation (no silent overlay writes without approval)
- [x] T6 — Anchor-orphan suggestions in Admin tab | `d715fb78`
- [ ] T7 — Smart child consolidation (same-address dealer-split → one card)

---

## T6 — Anchor-Orphan Suggestions (COMPLETE)
**Commits:** `da8ea07c` (copy data_discoveries.json) + `d715fb78` (Admin section)
**Files changed:**
- `src/data/data_discoveries.json` — copied from docs/ for import
- `src/components/tabs/AdminTab.tsx` — added 🏥 Orphans section

**What was built:**
- New "🏥 Orphans" tab in Admin section nav
- Loads `anchor_orphans` (137 items) from static JSON — never auto-written
- "🦷 Dental only" toggle filter (default ON) — hides non-dental anchors + unmatched
- Per-card **Approve** → adds orphan_child_id to anchor's overlay group via `saveOverlays()`
- Per-card **Skip** → persists to `overlays.skippedOrphanIds` (GitHub-backed, cross-device)
- Resolved count shown in filter bar
- `Master-Unmatched` anchors always excluded

**Overlay fields used:**
- `overlays.skippedOrphanIds: string[]` — persisted skip list (new field, safe to add)
- `overlays.groups[anchor_id].childIds` — extended on approve

**Build:** HTTP 200 ✓
**Deploy:** Live at accel-v7.vercel.app/accelerate ✓

---

## T7 — Next Up
Same-address dealer-split accounts (e.g. same office under Schein + Patterson) currently show as two separate cards. Should show as ONE card with combined PY/CY and a dealer breakdown sub-row. Scoped to TodayTab scored list and GroupsTab. Do NOT touch preloaded-data.ts — runtime merge only.
