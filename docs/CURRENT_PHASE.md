# CURRENT PHASE -- accel-v7

## Active: Phase 6 -- Assistant Inbox COMPLETE

### What Was Done

**Goal**: Add an Assistant Inbox that queues high-value proposed actions so the app behaves like an actual assistant, but keeps Ken in control (approval-first).

### Files Changed
- `src/lib/assistantInbox.ts` — action model + deterministic generator (6 rules, 7 action types)
- `src/components/tabs/InboxTab.tsx` — full inbox UI with card expand/collapse + approval flow
- `src/lib/data.ts` — added `inboxItems: []` and `noticeDismissals: []` to EMPTY_OVERLAYS
- `src/components/AccelerateApp.tsx` — InboxTab wired in; Dealers moved to More; Inbox added to bottom nav

### Assistant Action Model
Each InboxItem has: id, type, priority, status, groupId, groupName, title, summary, rationale, suggestedPayload, confidence, requiresApproval, createdAt, source.

### Action Types Implemented
- `draft_email` — account going cold, email contact on file
- `create_task` — high-value account, no open next step
- `schedule_followup_block` — large gap + 45d+ dormant
- `research_contact` — high-gap account, no contact at all
- `dealer_followup` — multi-loc group, no FSC assigned
- `account_review` — high-PY account, viewed but no action taken

### Deterministic Rules (6 active)
1. Gap > K + zero contacts → research_contact
2. PY > .5K + email on file + 30d stale + gap > 00 → draft_email
3. PY > K + no open tasks + 21d stale → create_task
4. Gap > K + 45d dormant + no tasks → schedule_followup_block
5. 3+ locs + no FSC + PY > K → dealer_followup
6. PY > K + <30% retention + viewed <14d + no action 30d → account_review

### Inbox UI
- Appears as Inbox in bottom nav (replaced Dealers; Dealers moved to More)
- Pending count badge on nav button
- Filter: Pending / All / Done
- Each card: title, summary, priority badge, action type, confidence
- Expanded: rationale, pre-filled payload, source signals, action buttons
- Actions: Approve / Create Task / Open Account / Mark Reviewed / Dismiss / Restore

### Approval Flow
- Nothing happens automatically
- Approve → marks item approved in overlays, user takes action manually
- Create Task → calls onAddTask with pre-filled data, marks approved
- Dismiss → hides item (restorable)
- Mark Reviewed → notes it was seen, no further action

### Persistence
- Item status (approved/dismissed/reviewed) stored in `overlays.inboxItems` array via patchOverlay
- Action generation is stateless/deterministic — recomputed fresh each render from live data
- Only status overrides are persisted (same pattern as noticeDismissals)

### Commits
- `98e3632` — assistantInbox.ts model + generator
- `71cfa51` — InboxTab.tsx UI
- `0989c65` — EMPTY_OVERLAYS updated
- `f12ca12` — AccelerateApp wired (production commit — triggers deploy)

### Build
Deploying to Vercel from f12ca12. No broad rewrites. All existing tabs preserved.

---

## Previously Completed
- A16.5 -- Full Workflow Smoke Test Harness (eb0e71a / 6e8cfaf)
- A16.4 -- Merge self-test harness, applyGroupCreates extraction (4bcdb28dfe)
- A16.3 -- Merge direction + source card elimination
- A16.2 -- Build fix + initial merge direction
- A16.1 -- AI Intel Stabilization
- A15.7 -- Overlay Write Guard

## Last Updated
March 29, 2026
