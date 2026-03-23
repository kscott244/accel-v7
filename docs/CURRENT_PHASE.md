# Current Phase: Phase 1 — Foundation Audit + Documentation

## Status: COMPLETE ✅

## What was done
- Full repo audit: structure, data flow, persistence, API routes, component inventory
- Identified active code (AccelerateApp.tsx + API routes + overlays) vs legacy dead code (cards/, charts/, layout/, ui/, lib/, old page.tsx)
- Documented architecture, data flow, and persistence model
- Created phased roadmap from current state to platform
- Created ideas backlog to capture future features

## What Phase 2 should be
**Stability + Dead Code Cleanup**

### Scope
1. Delete unused legacy files:
   - `src/components/cards/` (all files)
   - `src/components/charts/` (all files)
   - `src/components/layout/` (all files)
   - `src/components/ui/` (all files)
   - `src/lib/insights.ts`
   - `src/lib/utils.ts`
   - `src/data/index.ts` (legacy data exports)
   - `src/data/groups.json` (legacy, superseded by preloaded-data.ts)
   - `src/data/offices.json` (legacy, superseded by preloaded-data.ts)
   - `src/data/patches.json` (legacy, superseded by overlays.json)
   - `src/app/page.tsx` (legacy v6 page — replace with redirect to /accelerate)
   - `src/app/dashboard/`, `src/app/groups/`, `src/app/plan/`, `src/app/route/`, `src/app/territory/` (old route dirs if empty)

2. Persist manual adjustments:
   - Sale calculator additions (`adjs` state) currently lost on refresh
   - Save to overlays.json under a new `manualAdjustments` key
   - Load on mount alongside other overlays

3. Light type safety:
   - Remove `@ts-nocheck`
   - Add minimal type annotations to the top 5 crash-risk functions
   - Do NOT attempt full strict TypeScript — just eliminate the silent crash vectors

4. Verify all 8 functional tabs still work after cleanup

### Completion criteria
- `git ls-files` shows no unused legacy code
- Manual sale adjustments survive page refresh
- All tabs render without crashes
- No visual changes to the app

### Risks
- Deleting the old `page.tsx` might break the root `/` URL — redirect to `/accelerate`
- Some legacy data files might be imported by API routes — check before deleting
- `@ts-nocheck` removal may surface many errors — fix only the ones that crash at runtime

## Ready-to-paste prompt for Phase 2
See bottom of this file.

---

## Phase 2 Handoff Prompt

```
Continue this project using the Project Description instructions as the operating rules.

Your task in this chat is:

PHASE 2 ONLY — STABILITY + DEAD CODE CLEANUP

Context:
- Phase 1 (Foundation Audit + Documentation) is complete
- Read docs/ARCHITECTURE.md, docs/ROADMAP.md, docs/CURRENT_PHASE.md first
- Repo: kscott244/accel-v7 | GitHub PAT: [USE_PROJECT_PAT]
- Live: https://accel-v7.vercel.app/accelerate
- Main file: src/components/AccelerateApp.tsx
- Push pattern: fetch SHA → edit → brace/paren balance check → PUT via Python urllib → wait 55s → verify on production

What to do in Phase 2:
1. Read docs/ARCHITECTURE.md and docs/CURRENT_PHASE.md to understand the repo
2. Delete all legacy/unused files identified in CURRENT_PHASE.md
3. Replace root page.tsx with a redirect to /accelerate
4. Persist manual sale adjustments (adjs state) to overlays.json so they survive refresh
5. Remove @ts-nocheck and fix only crash-risk type errors (do not attempt full strict TS)
6. Verify all tabs still render
7. Update docs/CURRENT_PHASE.md to mark Phase 2 complete and define Phase 3 scope

Important:
- Do not restructure AccelerateApp.tsx (that is Phase 3)
- Do not change any UI behavior
- Do not add new features
- Delete files one batch at a time, verifying the build after each
- If a file deletion causes a build error, restore it and note why

At the end of Phase 2, output:
1. What files were deleted
2. What was changed
3. What was preserved and why
4. What to test
5. Risks/notes
6. A ready-to-paste prompt for Phase 3

Do not continue into Phase 3 in this chat.
Start now.
```
