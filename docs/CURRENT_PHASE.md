# CURRENT PHASE -- accel-v7

## Status: Route with Intent live. Ready to build.

### Phase 7: MapTab → Route with Intent — March 28, 2026

Made the route tab useful for daily execution, not just geography.

**Commits:**
- `cbacb4d2` — AccelerateApp: pass `scored` + `goAcct` to MapTab
- `1b4d26ef` — MapTab: mission lines, stop list, intent icons, Account → nav

**Deploy:** HTTP 200 ✅
**Lines:** 189 → 381 (+192)

**What changed:**

**Mission line per stop**
Every stop now shows a one-line purpose derived from existing route data:
- Gone dark → "Win-back · was $1,752 Q1 last year"
- Active but down → "Recover · $890 gap vs Q1 last year"
- Has doctor + intel → "Meet Dr. Wu · Two locations: Avon and West Hartford..."
- Prior visit note → "Follow-up · [visitNote snippet]"
- Flagged → flag text stripped of emoji/whitespace
- Generic fallback by vp → "Priority stop · $11K PY spend"

**Purpose icons**
🎯 win-back · ⚠️ flag · 📈 recovery · 🤝 relationship · 📋 follow-up · 🔴/🟡 priority

**Stop list below the map**
Collapsible panel showing all stops with: stop number (when day selected), name + vp badge, mission line + icon, city/doctor, gap on the right. Tapping expands phone + Navigate + Account → buttons.

**Account → navigation**
Each stop now links to the full AcctDetail via fuzzy match against `scored` accounts (name exact match, then city + PY proximity). Requires `goAcct` prop passed from App — added in cbacb4d2.

**Day pills show gap and NOW count**
Pills now show: `Tuesday (5) ·3🔴` and the stop list header shows total gap for that day. Ken knows what he's walking into before selecting a day.

**Unplaced accounts surfaced**
Accounts in `week-routes.unplaced` (no GPS, can't be mapped) now appear at the bottom of the stop list with a Call button. Previously invisible.

**What was NOT changed:**
- Map rendering (Leaflet, tile layer, polyline, pin colors) — identical
- `openGoogleMaps()` multi-stop URL builder — identical
- `onPinClickRef` pattern (prevents stale closure on pin click) — identical
- `useEffect` dependency on `selDay` only (prevents map rebuild on popover open) — identical
- Account popover on pin tap — kept, still works
- Day filter pills (All Days + named days) — same, now with extra signals

---

## Previously Completed
- Phase 6 — DealersTab Channel Console (surfaced co-call, gap%, sticky toggle)
- Phase 5 — GroupsTab Territory Navigator (snapshot bar, compact cards, Strategic+Cleanup views)
- Phase 4 — AcctDetail Second Brain (Next Best Move up top, Who Matters, Activity first)
- Phase 3 — GroupDetail War Room (section reorder, distributor+FSC merged)
- Phase 2 — Today Tab Mission Control (5 action buckets)
- Phase 1 — Data Boundary Hardening
- patchOverlay Migration — SHA conflict bug eliminated

## Last Updated
March 28, 2026
