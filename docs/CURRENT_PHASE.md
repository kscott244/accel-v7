# CURRENT PHASE -- accel-v7

## Active: Phase 7 -- Navigation + Today Intelligence Cleanup COMPLETE

### What Was Done

**Goal**: Reduce redundancy, clean up navigation, make Today a true command center.

### 1. Bottom Nav Architecture
Final nav: **Today → Accounts → War Room → Inbox → Ask → More**
No changes needed — already matched spec from prior work.

### 2. More Menu Restructure
Grouped by purpose with section headers:

**Work** — Route, Tasks, Dealers, Forecast, Outreach
**Tools** — Pricing
**System** — Admin

### 3. Today Section Reorder
1. KPI / pace summary — always visible
2. Forecast — inline toggle, always visible
3. Context selector — NEW
4. Daily Success Plan — filtered by context
5. Notices — deduped against plan
6. Search bar
7. Below search: results replace New Adds / Weekly Delta / Mission Buckets

Key change: KPI, context, daily plan, notices now OUTSIDE the search ternary.

### 4. Redundancy Removed
- Notices deduped against Daily Plan (same group won't appear in both)
- No separate urgent banner — notices badge already covers this

### 5. Context Selector
- Territory (default), Near Home (35mi), City/Area (text input)
- Filters Daily Plan, Hit List, Easy Wins, At Risk, Follow Up, Dead Weight
- Tasks and search NOT filtered

### 6. Files Changed
- `src/components/AccelerateApp.tsx` — More menu grouped
- `src/components/tabs/TodayTab.tsx` — Render restructure, context, dedup
- `src/components/tabs/TodayTabV2.tsx` — DELETED
- `docs/CURRENT_PHASE.md` — This file

### Previously Completed
- A16.5 -- Smoke Test Harness (eb0e71a308)
- TodayTab ternary fix (a60dd8dbdf09)

## Last Updated
March 29, 2026
