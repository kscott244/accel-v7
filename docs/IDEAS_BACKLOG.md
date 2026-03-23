# IDEAS BACKLOG — accel-v7

> Captured ideas organized by category. Not prioritized — this is a parking lot.
> Move items to ROADMAP.md phases when they become actionable.

---

## Data & Import

- [ ] Auto-detect Tableau CSV format on upload (column name matching)
- [ ] Diff view on re-import: "15 new accounts, 3 removed, 47 changed"
- [ ] Overlay integrity check: flag overlays referencing deleted accounts
- [ ] CSV export of current filtered view
- [ ] Bulk import contacts from external source (Badger, LinkedIn)
- [ ] Data freshness indicator: "Base data last updated: March 15, 2026"
- [ ] Validate dealer assignments on CSV import (cross-reference dealers.ts)

## Account Intelligence

- [ ] Win-back targets: accounts that bought in Q1 2025 but $0 in Q1 2026
- [ ] Distributor-level trends: "Schein offices declining 12% faster than Patterson"
- [ ] Product category gaps: "This office buys composites but zero bonding agents"
- [ ] Upgrade path modeling: "If these 8 offices move from Platinum to Diamond = $Y more credit"
- [ ] "Fastest path to $759K" scenario generator
- [ ] Account health timeline: show CY trajectory over weeks, not just PY vs CY snapshot
- [ ] Flag accounts whose score moved significantly week-over-week

## Visit Planning

- [ ] Cluster-based route suggestions: "5 NOW-priority offices within 20 min of each other"
- [ ] Calendar integration: block time for top routes
- [ ] Visit frequency recommendations based on account value + status
- [ ] "I'm in [city]" mode: show nearest priority accounts from current location
- [ ] Multi-day trip planner for MA/RI territories (further from Thomaston)

## Outreach & Communication

- [ ] Email templates by scenario: win-back, cross-sell, new product launch, co-call request
- [ ] Follow-up reminder system: "You emailed Dr. Smith 7 days ago, no response"
- [ ] Dealer co-call email templates with pre-filled FSC rep info
- [ ] Track email open/response rates (requires more Gmail integration)
- [ ] SMS outreach option for quick touchpoints

## Scoring & Prioritization

- [ ] Configurable scoring weights: let Ken adjust what matters most
- [ ] Time-aware scoring: accounts score higher as quarter-end approaches
- [ ] "What changed this week" alert dashboard
- [ ] Separate scoring profiles: "Q1 close mode" vs "Q2 build mode"

## UI & Navigation

- [ ] Pull-to-refresh on mobile
- [ ] Keyboard shortcuts for desktop use
- [ ] Offline mode: service worker for cached data when no internet
- [ ] Global search improvements: search by product, city, dealer, not just name
- [ ] Dark mode polish (already dark, but refinement)

## Admin & Maintenance

- [ ] Group merge tool: combine duplicate groups across distributors (analysis started, UI partial)
- [ ] Bulk name cleanup: fix Tableau name formatting issues en masse
- [ ] Audit log: "Who changed what, when" for overlay changes
- [ ] Backup/restore: download full overlay state, restore from file
- [ ] "Undo last change" for overlay edits

## Multi-Quarter / Long-Term

- [ ] Quarter selector with historical data
- [ ] Year-over-year territory analysis
- [ ] Goal setting UI: input new quarter targets
- [ ] Territory change tracker: accounts gained/lost over time
- [ ] Annual review dashboard: full year performance summary
- [ ] Multi-rep support (if app is ever shared with other Kerr reps)

## Technical Debt

- [ ] Decompose AccelerateApp.tsx (5,377 lines → separate tab files)
- [ ] Enable TypeScript (remove @ts-nocheck)
- [ ] Add basic test coverage for scoring engine and CSV processor
- [ ] Consolidate patches.json and overlays.json into single system
- [ ] Remove save-patch API route after patches.json retirement
- [ ] Add error tracking (Sentry or similar)
- [ ] Consider Supabase or similar if GitHub-as-DB hits scaling issues
- [ ] Clean up dead component-based pages (or bring them up to parity)

---

## How to Use This File

When starting a new session, scan this list for anything relevant to the current phase. When an idea comes up in conversation, add it here instead of trying to build it immediately. When something moves into active development, reference it in ROADMAP.md under the appropriate phase.
