# CURRENT PHASE — accel-v7

## Active: Phase 1 — Foundation Audit + Docs ✅ Complete

### What Was Done
1. Full repo audit — file tree, data flow, API routes, component structure, deployment pipeline
2. Created `docs/ARCHITECTURE.md` — current architecture, data layer, constraints, target state
3. Created `docs/ROADMAP.md` — 6-phase plan from current state to long-term platform
4. Created `docs/CURRENT_PHASE.md` — this file
5. Created `docs/IDEAS_BACKLOG.md` — organized capture of future ideas

### What Exists in the App (Accurate as of March 22, 2026)

**AccelerateApp.tsx** (5,377 lines, the primary working app):
- 8 tabs: Today, Groups, Dealers, Dash, Route/Map, Close/Estimator, Outreach, Admin
- Scoring engine with multi-factor urgency ranking
- CSV import/processor for Tableau exports
- Overlay system (runtime corrections persisted to GitHub via API)
- Group detail + Account detail views
- Activity logging (localStorage + overlay persistence)
- Deep Research (AI-powered contact hierarchy)
- Gmail outreach (73 emails, Kerr product intelligence, dealer-aware)
- FSC Co-Call Planner in Dealers tab
- Admin: create groups, detach accounts, fix names, add contacts, duplicate review
- Sale calculator with tier/chargeback awareness
- Overdrive outcome tracking (win/½/✗ with notes)

**Component-based pages** (secondary, partially built):
- `/` Territory, `/groups`, `/route`, `/dashboard`, `/plan`
- Use AppShell with TopBar, TabBar, GlobalSearch
- Have proper TypeScript types
- Not feature-complete compared to AccelerateApp.tsx

**API routes**: load-overlay, save-overlay, save-patch, deep-research, send-outreach, gmail-auth, gmail-callback, ai-briefing

**Data**: ~984 priority offices, 1.7MB preloaded data, overlays.json for runtime corrections

---

## Next Up: Phase 2 — Stabilize & Harden

### Scope
1. Remove error boundary debug code
2. Consolidate patches.json + overlays.json into one system
3. Fix Dealers tab single-location gap
4. Address nav bar crowding (8 tabs)
5. Add deploy verification (build hash in UI)
6. Audit applyOverlays() edge cases

### Entry Criteria
- Phase 1 docs complete ✅

### Completion Criteria
- Zero known bugs in the live app
- Single overlay system (patches.json retired or merged)
- Deploy verification visible in UI
- Nav bar usable on mobile

### What Phase 2 Does NOT Include
- New features
- Tab decomposition (that's Phase 3)
- AI enhancements (that's Phase 5)
- Multi-quarter support (that's Phase 6)

---

## Known Issues (To Address in Phase 2)

1. **Error boundary debug code still visible** — leftover from development
2. **Nav bar has 8 tabs** — too crowded on mobile, needs consolidation or "More" menu
3. **Single-location accounts missing in Dealers tab** — under some reps, standalone accounts don't surface
4. **Two overlay systems** — `patches.json` (legacy) and `overlays.json` (current) both exist; should consolidate
5. **Browser caching causes stale deploys** — users need hard refresh after deploys
6. **Group merge/duplicate tool incomplete** — analysis was started, no UI shipped

---

## Last Updated
March 22, 2026
