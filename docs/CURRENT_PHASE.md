# CURRENT PHASE -- accel-v7

## Active: Phase 5 -- Assistant Notices

### What Was Done

**Goal**: Make the app proactive — surface important findings without waiting for Ken to dig.

**Approach**: Deterministic notice generation. Every notice is grounded in real data signals.
No AI. No hallucinations. If the signal isn't there, the notice doesn't fire.

### Files Changed

**`src/lib/notices.ts`** (new)
- `Notice` interface: id, type, severity, area, title, summary, whyItMatters, suggestedAction, confidence, source, createdAt, groupId, groupName, status
- `NoticeType`: missing-contact | stale-high-value | weak-path | viewed-no-action | contact-stale-only
- `NoticeSeverity`: high | medium | low
- `buildNotices(groups, overlays, opts)` — runs all 5 generators, applies dismissals, returns top N sorted by severity then type

**5 Notice generators:**
1. `missing-contact` — py ≥ $1500, zero contacts on file → severity high (>$5K) or medium
2. `stale-high-value` — FY revenue ≥ $3K, no action in 45+ days → severity high (>$8K) or medium
3. `weak-path` — contact exists but no phone AND no email (walk-in only) → medium
4. `viewed-no-action` — opened 3+ times in 14 days (from localStorage event log), zero open tasks → low
5. `contact-stale-only` — contacts exist but ALL marked stale on a $1500+ account → medium

**`src/components/tabs/NoticesPanel.tsx`** (new)
- Collapsible panel with count badge (red if any high-severity, amber otherwise)
- Each notice is a tap-to-expand card: title + group name visible always
- Expanded: whyItMatters + suggestedAction + "Open Account →" + "Dismiss" buttons
- Zero modals, zero extra navigation layers

**`src/components/tabs/TodayTab.tsx`** (edited)
- Added imports: `buildNotices`, `NoticesPanel`
- Added `patchOverlay` to DashboardTab props
- Added `notices` useMemo + `dismissNotice` handler
- NoticesPanel renders above Daily Success Plan section

**`src/components/AccelerateApp.tsx`** (edited)
- Added `patchOverlay={patchOverlay}` to DashboardTab call

### Persistence

- Notice generation: **stateless** — computed fresh each render from live data
- Dismissals: **durable** — stored in `overlays.noticeDismissals[]` via `patchOverlay`
- No new GitHub data file. Dismissals ride in existing overlays.json.
- localStorage untouched (event log for viewed-no-action notice read-only)

### Build
All 4 files pass brace/paren balance validation.

### Deploy
See commit hash below.

---

## Previously Completed
- Phase 4 — Daily Success Plan (fb4db979)
- A16.5 — Full Workflow Smoke Test Harness (eb0e71a308)
- A16.4 -- Merge self-test harness, applyGroupCreates extraction (4bcdb28dfe)
- A16.3 -- Merge direction + source card elimination (0b348f4fc7 / 60c95ff27f)

## Last Updated
March 29, 2026
