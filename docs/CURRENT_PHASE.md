# CURRENT PHASE -- accel-v7

## Status: Action-Hub Polish live. Ready to build.

### Phase 10: Account / Group Detail Action-Hub Polish — March 28, 2026

**Commits:**
- `41324c8a` — AcctDetail: call in header, demote Move, icon Research/Briefing, tighter NBM
- `ca074896` — GroupDetail: collapse locations >3, auto-save hint, tighten Next Move

**Deploy:** HTTP 200 ✅

**AcctDetail changes:**

*Sticky header*
- 📞 Call button appears in header when a phone number is known (from Badger or officeFeel). Most-used action, now always reachable without scrolling.
- Research and Briefing buttons reduced to icon-only (🔍 ✦) to save horizontal space. Title attributes preserve discoverability.

*Hero card*
- Move button demoted from a styled pill to a small muted text link ("Move ›"). It's an infrequent admin action and was visually competing with Reorder.
- 🧾 Reorder stays as a small icon button.

*Next Best Move*
- Prose trimmed on three items:
  - "Not on Accelerate. At $X PY spend, Silver tier would lower their cost. Pitch the program." → "$X PY — not on Accelerate. Silver tier lowers their cost."
  - "Retention at N% — $X gap. Check in on supply chain, competitor activity, or budget cycle." → "N% retention, $X gap — check in on supply chain or budget."
  - "Up $X vs last year. Reinforce — ask about upcoming procedures to lock in Q2." → "Up $X vs last year — reinforce and lock in Q2."

*Who Matters — contacts*
- Phone numbers shown with a small 📞 pill badge instead of a plain text link. More tappable, more obviously actionable.

*Log a Sale empty state*
- Verbose explanation removed. Replaced with shorter one-liner.

**GroupDetail changes:**

*Locations — collapse when large*
- Groups with ≤3 locations: all shown as before.
- Groups with >3 locations: first 3 shown by default, with a "Show all" link in the section header and a "↓ Show all N locations" button at the bottom of the visible list.
- State: `showAllLocs` (local, resets on navigation). No data change.
- Threshold of 3 chosen because: the most important locations (sorted by gap descending) are the ones that drive action. Seeing the top 3 is enough to start. The full list is one tap away.

*Notes*
- Explicit "Save" button removed. Notes already auto-save on blur (onBlur handler was already there). Replaced with a subtle "Auto-saves when you leave" hint.
- ✓ Saved flash indicator kept — it fires on the blur save.

*Next Move label*
- "What to do next" → "Next Move" (shorter, same meaning, better mobile fit).

**What was NOT changed:**
- All data logic, useMemos, overlay saves — identical
- Move modal, reorder modal — identical
- GroupDetail: merge, contacts, tasks, AI intel — identical
- AcctDetail: product story, activity log, parent group, research card — identical

---

## Previously Completed
- Phase 9 — Feel Factor (office-level, Cold/Warm/Hot)
- Phase 8 — Tasks operating layer
- Phase 7 — Route with Intent
- Phase 6 — DealersTab Channel Console
- Phase 5 — GroupsTab Territory Navigator
- Phase 4 — AcctDetail Second Brain
- Phase 3 — GroupDetail War Room

## Last Updated
March 28, 2026
