# CURRENT PHASE -- accel-v7

## Status: Tasks operating layer live. Ready to build.

### Phase 8: Tasks as Follow-Up Operating Layer — March 28, 2026

**Commits:**
- `1ec39c90` — App: wire addTask to AcctDetail+GroupDetail, overlay persistence, goAcct to TasksTab
- `8bc8066b` — TasksTab: sections, TaskWidget, suggestion engine, InlineAddForm
- `2fb80c58` — AcctDetail: TaskWidget with auto-suggestions
- `8be91615` — GroupDetail: TaskWidget with auto-suggestions

**Deploy:** HTTP 200 ✅

**What was built:**

**Suggested tasks in AcctDetail**
A Tasks section appears near the bottom of every account. It generates up to 3 suggested tasks from existing data:
- Stopped products: "🎯 Re-engage on [product] — was $X last year"
- Gone dark 90+ days: "📞 Follow up — gone dark Nd"
- Q1 gap with active spend: "📈 Close Q1 gap — $X behind"
- Tier upsell opportunity: "⬆️ Pitch Gold/Accelerate program"

Each suggestion has a single **+ Add** button — one tap creates the task with a 7-day due date, no modal. A **+ Custom** button opens an inline form for anything not covered by suggestions.

**Suggested tasks in GroupDetail**
Same TaskWidget, using group-level data. Group tasks are linked to the group ID.

**Tasks tab sections**
Replaced the flat sorted list with explicit sections: Overdue (red) · Today (amber) · Upcoming (blue) · Completed (dimmed). Each section only renders if it has items. Empty states per section.

**Task cards: tappable account link**
The account/group name on each task card is tappable and navigates directly to that account via `goAcct`.

**Persistence upgraded**
Tasks now write to `overlays.json` via `patchOverlay` (same atomic-patch pattern as contacts, activity logs, group moves) in addition to localStorage. localStorage remains as the fast-path cache. This makes tasks cross-device and durable across CSV re-uploads.

**TaskWidget reads from `overlays.tasks`**
The widget filters `overlays.tasks` for tasks already linked to the current account or group, so existing tasks show inline before the suggestions — no duplicate suggestions for things already logged.

### Phase 8.1: Bottom Nav Reorder — March 28, 2026

**Commit:** `c1aff678`
**Deploy:** HTTP 200 ✅

Bottom nav: Today · Accounts · Route · Dealers · More
Tasks moved to More menu alongside Pricing, Forecast, Outreach, Admin.

---

## Previously Completed
- Phase 7 — MapTab Route with Intent (mission lines, stop list, Account → nav)
- Phase 6 — DealersTab Channel Console
- Phase 5 — GroupsTab Territory Navigator
- Phase 4 — AcctDetail Second Brain
- Phase 3 — GroupDetail War Room
- Phase 2 — Today Tab Mission Control
- Phase 1 — Data Boundary Hardening
- patchOverlay Migration

## Last Updated
March 28, 2026
