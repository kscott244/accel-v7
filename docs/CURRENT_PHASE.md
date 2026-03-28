# CURRENT PHASE -- accel-v7

## Status: Territory Navigator live. Ready to build.

### Phase 5: GroupsTab → Territory Navigator — March 28, 2026

Rebuilt Groups tab as a territory planning surface, not just a sorted list.

**Commit:** `1bad807d`
**Deploy:** HTTP 200 ✅
**Lines:** 384 → 331 (−53 lines, −14%)

**What changed:**

**Territory Snapshot (new)**
Four tappable stat tiles above the filters: total gap, # at risk, # growing, # win-back. Each tile taps directly into that view. Answers "where do I stand" in one glance without drilling anywhere.

**Account cards compressed**
Old card: name + locs badge + subtitle + address line + ret bar + PY/CY pills + WIN BACK/NEW PROD tags. Three rows plus a bar.
New card: name + locs badge + bucket tag in row 1. PY · CY · ret% · reason phrase in row 2. Gap on the right. ~35% shorter per card — more accounts visible per screen.

**Bucket tag on every card**
RECOVER / PROTECT / GROW / WATCH tag replaces the retention bar. Same information, uses color from BUCKET_STYLE, much less space.

**Two new view modes**
- **Strategic**: high-PY accounts (≥$5K) tracking ≥70% retention. These are the accounts worth proactive scheduling — healthy but high-value.
- **Cleanup**: accounts with <$100 in both PY and CY. Stubs, orphans, zero-activity groups that need a data review.

**Renamed/simplified**
- "All" → "Priority" (clearer intent — it's priority-sorted)
- "Urgent" → "At Risk" (less alarm, more actionable)
- "Emerging DSO" → "Emerging" (pill fits better on mobile)
- Legend component removed — color meaning is now self-evident from the bucket tags

**What was NOT changed:**
- `enriched` useMemo — identical scoring logic
- `byType` / `list` useMemos — same structure, added Strategic+Cleanup branches
- All existing sort orders — identical
- `scorePriority()` call on each group — identical
- Search — identical
- Props interface (`groups`, `goGroup`, `filt`, `setFilt`, `search`, `setSearch`, `groupedPrivates`) — identical
- `goGroup()` navigation — identical

---

## Previously Completed
- Phase 4 — AcctDetail Second Brain (Next Best Move up top, Who Matters, Activity first)
- Phase 3 — GroupDetail War Room (section reorder, distributor+FSC merged)
- Phase 2 — Today Tab Mission Control (5 action buckets)
- Phase 1 — Data Boundary Hardening
- patchOverlay Migration — SHA conflict bug eliminated

## Last Updated
March 28, 2026
