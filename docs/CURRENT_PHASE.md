# CURRENT PHASE — accel-v7

## Active: Phase A10 — Merge Group Workflow from GroupDetail ✅ Complete

### Goal
Add a safe, simple Merge Group workflow directly from GroupDetail so the same organization appearing across multiple parent groups can be consolidated without leaving the context of the group screen.

### Baseline
A9 complete: `adjs` cross-device via overlays/GitHub (commits `f2475b9` + `0a4c11d`)

### What Was Built
The full Merge Group workflow was already implemented in `GroupDetail.tsx` as part of Phase 23. A10 confirmed the implementation meets all requirements:

**Workflow:**
1. Open any parent/group → GroupDetail
2. Tap **⊕ Merge** button (top-right of group header card)
3. Search step: type a group or office name → results show group name, loc count, PY, CY, dealer context, and top 2 child office names for identification
4. Confirm step: clear preview showing destination group, source group being absorbed, combined loc count + PY/CY/gap, and a ⚠ warning for large merges (>30 locations)
5. Tap **Absorb Group** → saves to `overlays.groups[group.id].childIds` → page reloads to show merged result

**Safety guards:**
- Self-merge excluded (`g.id === group.id`)
- Already-absorbed groups excluded (`alreadyMergedIds` set built from all `overlays.groups[*].childIds`)
- Large group warning fires at >30 combined locations
- Only writes to the manual overlay layer — raw child/dealer-parent records untouched
- `applyOverlays()` Step 4 expands `childIds` to actual children at runtime (non-destructive)

### Phase A9 Summary (completed prior session)
`adjs` (pending order adjustments) migrated from localStorage-only to overlays-backed with 800ms debounced GitHub save. Cross-device sync: seeded from `overlay_cache_v2 → ov.adjs` on init, restored from fresh GitHub overlays on background load. Added `adjs: []` to `EMPTY_OVERLAYS` schema.

Files: `src/components/AccelerateApp.tsx` (f2475b9), `src/lib/data.ts` (0a4c11d)

### Phase A8 Summary (completed prior session)
Full cross-device audit of all 14 state categories. Found `adjs` as the only violation — localStorage-only. All other state (overlays, CRM, salesStore, etc.) already cross-device.

---

## Previously Completed
- A7 — Overlay Schema Hardening (dealerManualReps) ✅
- A6 — DealersTab durable rep persistence ✅
- Phase 23 — GroupDetail Upgrade (merge workflow, group contacts, group notes, FSC roster) ✅
- Phase 22 — Search Model Step 4 ✅
- Phase 21 — Search Model Step 3 ✅
- Phase 20 — Search Model Steps 1-2 ✅
- Phase 19 — Search Behavior Audit ✅
- Phases 1–18 ✅

---

## Last Updated
March 25, 2026
