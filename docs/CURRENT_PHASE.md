# CURRENT PHASE — accel-v7
> Last updated: March 28, 2026

## Architecture: Settled ✓
**Pipeline precedence (locked):**
1. Base CSV data
2. `src/data/manual-parents.json` — durable structural overrides (multi-practice groups, locs counts)
3. `data/overlays.json` — user day-to-day edits (contacts, notes, moves, ad-hoc groups)

**Rules:**
- Structural group definitions (multi-location practices) → `manual-parents.json`
- User edits (contacts, activity logs, name overrides, dealer corrections) → `overlays.json`
- CSV uploads cannot mutate either file
- `Master-MP-` prefixed IDs are reserved for manual-parents; `applyGroupCreates` skips them

---

## Next Session Quick-Start
- Repo: `kscott244/accel-v7` | Branch: `master` | Live: `accel-v7.vercel.app/accelerate`
- PAT in userMemories. **Push via Git Data API** (blobs→tree→commit→force-patch ref)
- All user writes → `saveOverlays()` → `/api/save-overlay` → `data/overlays.json`
- New multi-practice group → `manual-parents.json` via `/api/save-manual-parents`

---

## Recently Completed
- Downtown DDS group: 3 locations, 7 accounts, `locs:3` override in manual-parents
- GroupsTab filters: DSO (class2=DSO + locs≥6) / Emerging DSO / Mid-Market / Private
- Cleanup: removed Downtown DDS structural duplicate from overlays.json
- Guard added in mergeGroups.ts: overlays cannot override Master-MP- entries
- Parent Group card hidden on single-location accounts
- ReorderInvoice: product gap invoice with MSRP pricing, promos, upsell suggestion
- Manual-parents.json pipeline: baked into CSV processor, survives every upload
- Q2 target input in Admin → Settings (localStorage, no overlay write)
- Today Focus: clears on win/loss, backfills from queue

---

## Open Items
- Admin → 🏥 Practices save button needs `/api/save-manual-parents` route (built, deployed)
- ReorderInvoice: send via Gmail not yet wired
- Back-pocket dealer promo workflow (KKE26) not yet built
- T5 (lock down auto-group) — confirmed already done by prior A19 work
