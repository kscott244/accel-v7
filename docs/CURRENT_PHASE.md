# CURRENT PHASE -- accel-v7

## Status: Feel Factor live. Ready to build.

### Phase 9: Office-Level Feel Factor — March 28, 2026

**Commits:**
- `1b7c83ad` — data.ts: OFFICE_FEEL map + resolveOfficeFeel
- `096ee918` — AcctDetail: Cold/Warm/Hot label + inline update
- `ba58a845` — MapTab: feel label on route stop cards

**Deploy:** HTTP 200 ✅

**What was built:**

**Office-level feel map (`data.ts`)**
`buildOfficeFeelMap()` runs once at module load over all 1,904 Badger entries. It builds `OFFICE_FEEL: Record<string, OfficeFeel>` keyed by normalized street address (zip stripped, abbreviations standardized, punctuation removed). Result: 60 unique feel-mapped addresses covering 96 child IDs — up from 63 raw feel entries.

Conflict resolution when two IDs share an address with different feel values: take `max`. Rationale: Ken's best interaction at that office is the signal that matters for planning the next visit.

`normOfficeAddr()` is exported so MapTab and future consumers use the same normalization.

**`resolveOfficeFeel(acct, overlaysFeel)`**
Resolution order (most authoritative first):
1. User override from `overlays.feelFactor[officeAddr]` — explicit update wins
2. Direct BADGER[acct.id] lookup — same as before
3. Address-based OFFICE_FEEL lookup — catches dealer-split sibling cases
4. Returns null — no feel data, nothing shown

**Labels: Cold / Warm / Hot**
- 1–2 → Cold (gray)
- 3 → Warm (amber)
- 4–5 → Hot (green)

Replaces the 5 amber dot strip that was hard to read at a glance.

**AcctDetail: Who Matters section**
- Feel label chip (Hot/Warm/Cold with color) replaces dot strip
- Shows `N/5` alongside the label
- Doctor, dealer rep, phone, notes all fall back to `officeFeel` when direct Badger ID has nothing — catches the sibling-attachment case
- Inline **Cold / Warm / Hot** buttons below notes let Ken update the feel in one tap. Saves to `overlays.feelFactor[officeAddr]` via `patchOverlay` — durable, cross-device.

**MapTab: stop cards**
Each route stop now shows a colored feel chip (Hot/Warm/Cold) when OFFICE_FEEL has data for that address. Uses the route account's `address` field normalized through `normOfficeAddr`.

**What was NOT changed:**
- Badger data file — untouched
- Existing BADGER[] lookups in DealersTab, GroupDetail, priority.ts — untouched
- All overlay persistence logic — untouched
- No new API routes

**Scope of feel data:**
63 raw feel entries → 60 unique addresses → 96 child IDs covered.
About 10% of the 984 priority accounts have feel data. That's the actual Badger data Ken entered.

---

## Previously Completed
- Phase 8 — Tasks operating layer
- Phase 8.1 — Bottom nav reorder (Route into nav)
- Phase 7 — Route with Intent
- Phase 6 — DealersTab Channel Console
- Phase 5 — GroupsTab Territory Navigator
- Phase 4 — AcctDetail Second Brain
- Phase 3 — GroupDetail War Room
- Phase 2 — Today Mission Control
- Phase 1 — Data Boundary Hardening

## Last Updated
March 28, 2026
