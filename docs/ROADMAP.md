# Accelerate v7 — Roadmap

## Overview

Evolve accel-v7 from a single-file static-data field tool into a scalable rep operating system — without breaking what already works.

---

## Phase 1 — Foundation Audit + Documentation ✅
**Status: COMPLETE**

- Audit repo structure, data flow, persistence model
- Create `docs/ARCHITECTURE.md`, `ROADMAP.md`, `CURRENT_PHASE.md`, `IDEAS_BACKLOG.md`
- Identify legacy dead code vs active code
- Document current limitations
- No code changes to app behavior

---

## Phase 2 — Stability + Dead Code Cleanup
**Status: NEXT**

Scope:
- Remove legacy v6 code that is not imported by AccelerateApp (cards/, charts/, layout/, ui/, lib/, old page.tsx data paths)
- Remove `@ts-nocheck` and fix the worst type errors (not full strict mode — just eliminate crash vectors)
- Promote session-only data to durable storage where it matters (manual adjustments → overlays)
- Verify all tabs render correctly after cleanup
- Keep the single-file AccelerateApp.tsx structure for now

Completion criteria:
- No unused files in repo
- Manual sale adjustments persist across refresh
- Zero runtime crashes on any tab
- All existing features still work

---

## Phase 3 — Component Extraction
**Status: PLANNED**

Scope:
- Split AccelerateApp.tsx into separate files per tab/component
- Extract shared primitives (AccountId, Stat, Pill, Bar, theme) into `components/shared/`
- Create a proper data context or store so components don't rely on module-level variables
- Maintain identical UI behavior

Completion criteria:
- AccelerateApp.tsx is an orchestrator under 500 lines
- Each tab is its own file
- Shared components are reusable
- No visual changes

---

## Phase 4 — Dynamic Data Layer
**Status: PLANNED**

Scope:
- Replace static `preloaded-data.ts` with a real data pipeline (Supabase, or server-side CSV processing)
- CSV upload writes to database instead of generating a static TS file
- App loads data via API at runtime instead of bundling 1.7MB in JS
- Week routes become editable and persist to database
- Activity logs move from localStorage to durable storage

Completion criteria:
- App loads in < 2 seconds (vs current ~4-5s with 1.7MB bundle)
- CSV upload refreshes data without code push
- All user data is durable, not localStorage

---

## Phase 5 — Platform Features
**Status: FUTURE**

Potential scope (see IDEAS_BACKLOG.md for full list):
- Tier upgrade tracker ("$X from Silver")
- Editable week route planner with day buckets
- Push notifications / overnight alerts
- Multi-rep support (if Kerr wants to roll out)
- Dashboard export / PDF reports for QBRs
- CRM integration (Salesforce, HubSpot)

---

## Principles

1. **Ship weekly, not monthly** — small pushes, always deployable
2. **Don't rewrite what works** — the selling tools (Today, Overdrive, Groups, Dealers) are proven
3. **Mobile-first always** — Ken uses this on his phone in the field
4. **Data durability over features** — losing data is worse than missing a feature
5. **One-user first, multi-user later** — don't over-engineer auth/permissions yet
