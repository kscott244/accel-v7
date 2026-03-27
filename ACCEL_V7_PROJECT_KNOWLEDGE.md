# ACCEL-V7 — Complete Project Knowledge Base

> Generated: March 23, 2026
> Purpose: Single-source knowledge transfer document for project migration / new-session onboarding.
> This captures everything built, decided, and learned across all development sessions.

---

## 1. What This App Is

accel-v7 is a **field sales operating system** built for Ken Scott, a Kerr Dental rep covering CT, MA, RI, and parts of NY. Ken is based in Thomaston, CT and sells through distribution (Schein, Patterson, Benco, Darby, Safco). His Q1 2026 goal is $759K credited wholesale (currently ~$615K, ~$144K gap). He has 984 priority office locations in his territory.

The app replaces spreadsheets with a mobile-first dark-themed UI that Ken uses daily in the field. It ingests weekly Tableau CSV exports and layers on user-authored data (contacts, notes, dealer corrections, custom groups) that persist independently of data refreshes.

**Live URL**: `https://accel-v7.vercel.app/accelerate`
**Repo**: `kscott244/accel-v7` (branch: `master`)
**Vercel project**: `prj_z3qFU5wVT4XCZOypcv448v1pN6Um`

---

## 2. Tech Stack

- **Framework**: Next.js 14 + React 18 + TypeScript
- **Styling**: Inline style objects using design tokens (T object) — NOT Tailwind in the main app. Tailwind exists in config but is only used by the secondary component-based pages.
- **Charts**: Recharts
- **Icons**: Lucide React
- **Animation**: Framer Motion (available, used sparingly)
- **Deployment**: Vercel (auto-deploys from GitHub master, ~55s build)
- **Database**: GitHub as persistence layer — `data/overlays.json` committed via GitHub Contents API
- **AI**: Anthropic API (Claude) for Deep Research, outreach emails, group matching, and AI briefings
- **Email**: Gmail API via OAuth for outreach

---

## 3. Current Architecture

### 3a. The Monolith Shell — `src/components/AccelerateApp.tsx`

After Phase 5 decomposition, this file is now **688 lines** (down from 5,377). It is the orchestration shell:

- Loads base data from `src/data/preloaded-data.ts`
- Fetches overlays from `/api/load-overlay` on mount
- Runs `applyOverlays()` to merge user data on top of base data
- Runs `extractLeaves()` to flatten group → children into scoreable accounts
- Manages tab navigation (5 bottom tabs + More menu)
- Manages a view stack for drill-down (goGroup, goAcct, goBack)
- Passes data + navigation callbacks as props to extracted tab components
- Still has `@ts-nocheck` at the top

### 3b. Extracted Tab Components — `src/components/tabs/`

| File | Lines | Description |
|------|-------|-------------|
| `TodayTab.tsx` | 1,094 | Scoring/priority tab — the "what to do today" view |
| `AcctDetail.tsx` | 1,074 | Account detail + SaleCalculator + Deep Research + group linking |
| `DealersTab.tsx` | 772 | Dealer breakdown, co-call planner, Schein team directory |
| `GroupDetail.tsx` | 521 | Group detail view with contacts, notes, FSC assignments |
| `AdminTab.tsx` | 494 | CSV upload, overlay management, group merge/create |
| `OutreachTab.tsx` | 330 | AI-powered email outreach via Gmail |
| `DashTab.tsx` | 230 | Territory dashboard with charts |
| `MapTab.tsx` | 189 | Map/route view |
| `EstTab.tsx` | 116 | Estimate/close calculator |
| `GroupsTab.tsx` | 108 | Group list with search/filter |

### 3c. Shared Library — `src/lib/`

| File | Purpose |
|------|---------|
| `tokens.ts` | Design token object `T` (all colors), app constants (`Q1_TARGET`, `FY_TARGET`, `DAYS_LEFT`, home lat/lng) |
| `tier.ts` | Tier normalization (`normalizeTier`, `isTop100`, `normalizePracticeType`, `extractGroupName`, chargeback rates) |
| `format.ts` | Currency formatter `$$`, full formatter `$f`, percent `pc`, scoring engine `scoreAccount()`, health status `getHealthStatus()` |
| `csv.ts` | CSV parser + processor (`parseCSV`, `processCSVData`) with all data transformation rules |

### 3d. Secondary Component-Based Pages

These exist at `/`, `/groups`, `/route`, `/dashboard`, `/plan` but are **NOT feature-complete**. They use a different data pipeline (`src/data/index.ts` → `groups.json` + `offices.json`), Tailwind CSS, and an `AppShell` layout. They were an earlier architecture attempt. All real feature work goes into the AccelerateApp monolith. These pages could be removed or brought up to parity later.

---

## 4. Data Layer

### 4a. Static Data Files (committed, bundled at build)

| File | Size | Purpose |
|------|------|---------|
| `src/data/preloaded-data.ts` | 1.7MB | **Primary data source** — all accounts/groups from Tableau. ~984 priority offices. |
| `src/data/dealers.ts` | 253KB | Dealer assignments keyed by Master-CM ID. Exported as `DEALERS` record. |
| `src/data/badger-lookup.json` | 252KB | Contact info, lat/lng, addresses from Badger enrichment |
| `src/data/groups.json` | 1.0MB | Group rollups (used by secondary pages only) |
| `src/data/offices.json` | 1.5MB | Office flat list (used by secondary pages only) |
| `src/data/parent-names.json` | 46KB | Parent name lookup |
| `src/data/patches.json` | 2.7KB | **DEPRECATED** — legacy patch system, still read by `applyOverlays()` but no longer written to |
| `src/data/products.json` | 8KB | Product catalog |
| `src/data/gap-accounts.json` | 2.3KB | Gap account list |
| `src/data/week-routes.json` | 13KB | Pre-planned weekly routes |
| `src/data/territory-summary.json` | 731B | Territory aggregates |

### 4b. Overlay System — `data/overlays.json`

This is the **most important data file** — it contains all user-authored data that survives CSV re-uploads:

```json
{
  "nameOverrides": {},       // Custom display names for accounts
  "contacts": {},            // Contact info + Deep Research results, keyed by Master-CM ID
  "fscReps": {},             // FSC rep assignments per dealer per group
  "activityLogs": {},        // Visit logs, notes, follow-up dates
  "research": {},            // Deep Research AI results
  "dealerOverrides": {},     // Correct dealer assignments
  "groups": {},              // Custom group definitions (e.g., Resolute Dental Partners)
  "groupDetaches": [],       // Groups that should NOT be auto-merged
  "groupMoves": {},          // Accounts moved between groups
  "lastUpdated": "ISO date"
}
```

**Load path**: `GET /api/load-overlay` → fetches from GitHub → returns JSON
**Save path**: `POST /api/save-overlay` → commits to GitHub via Contents API
**Apply path**: `applyOverlays()` in AccelerateApp.tsx merges overlays on top of base data every time data loads

### 4c. Data Flow Pipeline

```
Tableau CSV export (weekly, manual download by Ken)
    ↓
processCSVData() in csv.ts
  - Parses CSV rows
  - Groups by Parent MDM ID → children (Child Mdm Id)
  - Aggregates PY/CY by quarter (Q1-Q4, FY)
  - Normalizes tiers via normalizeTier()
  - Extracts group names via extractGroupName()
  - Assigns dealers from DEALERS map
  - Filters out zero-revenue stubs
  - Sorts by Q1 gap descending
    ↓
hydrateDealer() — merges dealer info
    ↓
applyOverlays() — merges all overlay data
    ↓
applyGroupOverrides() — runtime group corrections
    ↓
groups[] state in AppInner
    ↓
extractLeaves() — flattens to scoreable account list
  - CRITICAL: Must guard for stub children with no pyQ/cyQ
    ↓
scoreAccount() — produces urgency score + reasons for each account
    ↓
Tab components render scored data
```

---

## 5. Business Domain Rules

### 5a. MDM Hierarchy

- **Parent MDM ID** (e.g., `Master-CM413476`): Identifies a group/practice entity
- **Child MDM ID**: Identifies a specific office location within a parent
- One parent can have 1-N children (multi-location practices)
- Some parents have only 1 child (solo practices)
- The `Master-CM` prefix is canonical — some accounts have `HEN-`, `BNK-`, `DRK-`, `PTK-`, `IQD-` prefixes (these are typically "All Other" dealer accounts)

### 5b. Tier / Chargeback System

The Tableau export has an "Acct Type" field that conflates pricing tier with Top 100 ranking. The `normalizeTier()` function untangles this permanently:

| Raw Acct Type | Normalized Tier | Chargeback Rate |
|---------------|----------------|-----------------|
| Standard | Standard | 0% |
| Top 100 | Standard | 0% (Top 100 is a ranking, NOT a tier) |
| HOUSE ACCOUNTS | Standard | 0% |
| Silver | Silver | 20% |
| Gold | Gold | 24% |
| Top 100-Gold | Gold | 24% (strip ranking prefix) |
| Platinum | Platinum | 30% |
| Diamond | Diamond | 36% |
| Top 100-Diamond | Diamond | 36% (strip ranking prefix) |

**CRITICAL RULE**: PY and CY values from the Tableau export are ALREADY credited wholesale (post-chargeback). Do NOT apply chargeback rates to them again. The chargeback rates in `ACCEL_RATES` exist for the SaleCalculator feature (estimating what a new order would credit).

**Practice Type** comes from `Sds Cust Class2` field, NOT Acct Type: DSO, Emerging DSO, Community Health, Government, School, Private Practice.

### 5c. Group Name Extraction

Group names always come from the **Parent Name** field, stripping the ` : Master-CMxxxxxx` suffix. Class 4 is a fallback but is unreliable — it often contains the tier name instead of the group name. The `extractGroupName()` function in `tier.ts` handles this with a BAD set of known-bad values.

### 5d. Dealer Assignments

`src/data/dealers.ts` exports a `Record<string, string>` mapping Child MDM IDs to dealer names. Values include: Schein, Patterson, Benco, Darby, Safco, All Other. Some have `?` suffix (e.g., "Benco?") indicating uncertainty. Dealer overrides in overlays.json take precedence.

### 5e. Scoring Engine

`scoreAccount()` in `format.ts` produces urgency scores from 0-100+ based on:

- **Gap size**: PY - CY (30 pts for >$8K, 20 for >$4K, 10 for >$2K)
- **Retention rate**: CY/PY (25 pts for near-zero on >$500 PY, 20 for <15%, 12 for <30%)
- **Days since last order**: 20 pts for >120d, 15 for >60d, 8 for >30d
- **Q1 closing window**: 15 pts if large gap + recent activity, 10 for >$3K gap
- **Tier bonus**: Diamond +10, Platinum +8, Top 100 +5
- **Dead products**: +3 per product that had PY >$200 but CY = $0

Health statuses: Growing (CY > PY), Stable (ret ≥ 60%), Recoverable (ret ≥ 25%), Critical (below that).

### 5f. Key Numbers

- Q1 2026 target: $778,915 (in tokens.ts as `Q1_TARGET`)
- FY target: $3,158,094 (in tokens.ts as `FY_TARGET`)
- Home base: Thomaston CT (41.6723, -73.0720)
- Territory: CT, MA, RI, parts of NY
- Q1 ends: March 31, 2026

---

## 6. API Routes

| Route | Method | Purpose | Env Vars |
|-------|--------|---------|----------|
| `/api/load-overlay` | GET | Fetch overlays.json from GitHub | `GITHUB_PAT` |
| `/api/save-overlay` | POST | Commit overlays.json to GitHub | `GITHUB_PAT` |
| `/api/deep-research` | POST | AI-powered contact/account research | `ANTHROPIC_API_KEY` |
| `/api/find-group-matches` | POST | Claude Opus semantic group matching | `ANTHROPIC_API_KEY` |
| `/api/ai-briefing` | POST | AI-generated daily briefing | `ANTHROPIC_API_KEY` |
| `/api/send-outreach` | POST | Generate + send outreach emails via Gmail | `ANTHROPIC_API_KEY`, `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET` |
| `/api/gmail-auth` | GET | OAuth flow start | `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET` |
| `/api/gmail-callback` | GET | OAuth callback | `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET` |

**Vercel env vars required**: `GITHUB_PAT`, `ANTHROPIC_API_KEY`, `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` (auto-set by Vercel).

---

## 7. Deployment Pipeline

```
Code changes via GitHub Contents API
  ↓ (fetch current SHA → apply edit → validate brace/paren balance → PUT)
GitHub commit on master branch
  ↓ (Vercel webhook)
Vercel build + deploy (~55 seconds)
  ↓
Live at accel-v7.vercel.app/accelerate
```

**Push pattern**: Every edit goes through the GitHub Contents API. The workflow is: fetch file's current SHA, apply the edit, validate that brace/paren deltas equal 0 (catches syntax errors), then PUT the new content. Wait ~55s, then verify the live site loads with a new JS chunk hash.

**Cache-busting**: `next.config.js` sets `no-cache, no-store, must-revalidate` headers on `/api/*` routes and `/accelerate`. Despite this, browser caching sometimes serves stale builds — Ken may need hard refresh. There's a build hash badge in the More menu showing the commit SHA.

**Config**: `next.config.js` has `typescript: { ignoreBuildErrors: true }` because the monolith uses `@ts-nocheck`.

---

## 8. Phase History

| Phase | Status | What Was Done |
|-------|--------|---------------|
| 1 — Foundation Audit + Docs | ✅ Complete | Full repo audit, created ARCHITECTURE.md, ROADMAP.md, CURRENT_PHASE.md, IDEAS_BACKLOG.md |
| 2 — Stabilize + Consolidate | ✅ Complete | Retired save-patch API, added build hash to UI, cache-busting headers, audited overlay edge cases |
| 3 — Decompose (shared lib) | ✅ Complete | Extracted tokens.ts, tier.ts, format.ts, csv.ts from monolith |
| 4 — Extract Tab Components (batch 1) | ✅ Complete | Extracted GroupsTab, EstTab, MapTab, DashTab, shared primitives |
| 5 — Extract Remaining Tabs | ✅ Complete | Extracted TodayTab, GroupDetail, AcctDetail, DealersTab, OutreachTab, AdminTab. Monolith reduced from 4,406 → 674 lines (−85%) |

### Phase 5 Hotfixes (important context)

These were bugs discovered after the Phase 5 extraction and are critical to remember:

1. **Missing `$$` import** — When tabs were extracted, the `$$` currency formatter wasn't carried over as an import. Caused ReferenceError crashes on load. Fixed in TodayTab, GroupDetail, DealersTab.

2. **118 stub children with no `pyQ`** — `preloaded-data.ts` contains accounts with zero order history that have no `pyQ`/`cyQ` objects. When `extractLeaves()` passes these to `scoreAccount()`, it crashes. Fixed with safe defaults in `extractLeaves()`.

3. **Broken overlay group `Master-RDP-001`** — A custom group created via the group-merge feature had a stub child with no revenue data. Removed from `data/overlays.json`.

4. **localStorage key bump** — Renamed `accel_data` → `accel_data_v2` and `overlay_cache` → `overlay_cache_v2` to bust stale cached data on all devices after the extraction.

---

## 9. What's Next (Phase 6 candidates)

From ROADMAP.md and IDEAS_BACKLOG.md:

- Account workspace: notes, contacts, activity log per account (partially exists via overlays)
- AI briefing / territory intelligence improvements
- Route optimization with clustering
- CSV upload UX improvements (diff view, validation)
- Enable TypeScript (remove @ts-nocheck)
- Quarter transition support (Q1 → Q2)
- Configurable scoring weights

---

## 10. Recent Feature Work (post-decomposition)

These features were built after the tab extraction, on March 23, 2026:

1. **Group Contacts + Group Notes** in GroupDetail — persistent via overlays
2. **Schein CT FSC + ES Roster** — 22 FSC reps + 5 ES reps, quick-pick in GroupDetail
3. **Schein Team directory tab** in DealersTab with Call buttons
4. **Deep Research auto-link** — when AI research finds multi-location practices, suggests group merges with one-tap
5. **Claude Opus semantic group matching** — `/api/find-group-matches` uses Claude Opus to find related accounts by doctor name, address, email domain, practice name
6. **Address + zip + email fields** added to `preloaded-data.ts` (rebuilt from CSV with 5,543 accounts having real addresses)
7. **Doctor name + email domain** as match signals in group matcher

---

## 11. Coding Conventions

### Style
- **Dark theme**: All colors from `T` object in `tokens.ts`. Background `#0a0a0f`, surface `#12121a` to `#2a2a3a`.
- **Inline styles**: The AccelerateApp ecosystem uses JavaScript style objects, NOT Tailwind classes. Example: `style={{ background: T.s1, color: T.t1, borderRadius: 12, padding: 16 }}`.
- **Mobile-first**: Everything designed for mobile viewport. Touch-friendly tap targets. Scrollable lists.
- **No CSS files**: Styles are inline. The `src/styles/` directory has some globals but the app doesn't rely on them.

### Code patterns
- **`@ts-nocheck`** on AccelerateApp.tsx and all extracted tabs. TypeScript is bypassed.
- **`any` types everywhere** in the monolith ecosystem. The typed system exists in `src/types/index.ts` but is used by the secondary pages, not the main app.
- **Props passed as `any`** from AppInner to tab components.
- **`$$()` for currency display** — always use `$$` from `format.ts`, never manual formatting.
- **Overlay save pattern**: Merge changes into overlay object → POST to `/api/save-overlay` → also update localStorage cache.

### GitHub push pattern
- Fetch current file SHA via GitHub Contents API
- Apply edit
- Validate brace/paren balance (delta must = 0)
- PUT new content with commit message
- Wait ~55s for Vercel deploy
- Verify live site

### Naming conventions
- Tab components: `XxxTab.tsx` or `XxxDetail.tsx`
- Shared lib: `lowercase.ts` in `src/lib/`
- Data files: `lowercase.json` or `lowercase.ts` in `src/data/`
- API routes: `kebab-case` directories under `src/app/api/`

---

## 12. Known Technical Debt

1. **`@ts-nocheck` everywhere** — The entire AccelerateApp ecosystem bypasses TypeScript. Enabling it will require adding types to all tab components.
2. **`patches.json` still exists** — The legacy patch system is deprecated but `applyOverlays()` still reads from it. Should be fully removed.
3. **`save-patch` API route deleted** but the read path remains.
4. **No tests** — Zero test coverage. All changes verified manually on the live site.
5. **No staging/preview** — Production only. No preview branches.
6. **1.7MB static data bundled** — `preloaded-data.ts` is huge. Acceptable for single-user but slows builds.
7. **Single-user assumption** — No auth, no multi-tenancy, no concurrency handling on overlay saves.
8. **Secondary pages out of sync** — The component-based pages at `/`, `/groups`, etc. use a different data pipeline and are not feature-complete.
9. **`dealers.ts` is enormous** — 253KB of dealer mappings. Some entries have `?` suffix indicating uncertain assignments.

---

## 13. Gotchas & Decisions

### Things that will bite you if you don't know them

1. **PY/CY are already post-chargeback.** The Tableau export provides credited wholesale numbers. Do NOT apply chargeback rates to display values. The rates exist only for the SaleCalculator.

2. **Group names come from Parent Name, NEVER Class 4.** Class 4 often contains tier names ("DIAMOND", "PLATINUM") instead of the actual practice name. `extractGroupName()` handles this.

3. **"Top 100" is a ranking, not a tier.** "Top 100" in the Acct Type field means the account is in the Top 100 spend ranking but its pricing tier is Standard (0% chargeback). "Top 100-Diamond" means it's both ranked AND on Diamond pricing.

4. **Stub children crash the scoring engine.** There are 118+ accounts in `preloaded-data.ts` with no order history (no `pyQ`/`cyQ`). `extractLeaves()` must provide safe defaults `{ pyQ: {}, cyQ: {}, products: [] }` or `scoreAccount()` will throw.

5. **Overlays survive CSV re-uploads.** This is by design — contacts, notes, dealer corrections are user-authored and must persist when base data refreshes. `applyOverlays()` merges them on top of new data.

6. **Browser cache is aggressive.** Even with no-cache headers, Ken sometimes sees stale data. The build hash badge in More menu helps diagnose this. Hard refresh or `?v=N` parameter forces fresh load.

7. **The `$$` formatter must be imported explicitly** in every tab file. It's not global. Missing it causes a ReferenceError crash.

8. **Custom overlay groups can reference stale accounts.** If a manually-created group (via merge UI) references a child that no longer exists in base data, `applyOverlays()` can crash. Always validate overlay group children against current base data.

9. **GitHub Contents API has a 100MB limit per file** but our largest file (`preloaded-data.ts`) is 1.7MB, well under.

10. **Vercel build uses `ignoreBuildErrors: true`** in next.config.js. TypeScript errors will NOT fail the build. This is intentional because of `@ts-nocheck` usage.

---

## 14. Environment Variables (Vercel)

| Variable | Purpose |
|----------|---------|
| `GITHUB_PAT` | GitHub Personal Access Token for overlay persistence (repo scope) |
| `ANTHROPIC_API_KEY` | Claude API key for Deep Research, outreach, group matching, briefings |
| `GMAIL_CLIENT_ID` | Google OAuth client ID for outreach emails |
| `GMAIL_CLIENT_SECRET` | Google OAuth client secret |
| `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` | Auto-set by Vercel — used for build hash badge |
| `NEXT_PUBLIC_APP_URL` | Optional — defaults to `https://accel-v7.vercel.app` |

---

## 15. File Tree (key files only)

```
accel-v7/
├── data/
│   └── overlays.json              # Runtime user data (persisted to GitHub)
├── docs/
│   ├── ARCHITECTURE.md            # Current + target architecture
│   ├── ROADMAP.md                 # Phased plan
│   ├── CURRENT_PHASE.md           # Active phase tracker
│   └── IDEAS_BACKLOG.md           # Idea parking lot
├── next.config.js                 # ignoreBuildErrors, cache headers
├── package.json                   # Next 14, React 18, Recharts, Lucide, Framer
├── src/
│   ├── app/
│   │   ├── accelerate/page.tsx    # Mounts AccelerateApp
│   │   ├── api/
│   │   │   ├── load-overlay/      # GET overlays from GitHub
│   │   │   ├── save-overlay/      # POST overlays to GitHub
│   │   │   ├── deep-research/     # AI contact research
│   │   │   ├── find-group-matches/# Opus semantic group matching
│   │   │   ├── ai-briefing/       # AI daily briefing
│   │   │   ├── send-outreach/     # Gmail outreach
│   │   │   ├── gmail-auth/        # OAuth start
│   │   │   └── gmail-callback/    # OAuth callback
│   │   ├── layout.tsx
│   │   └── page.tsx               # Secondary "/" page (not main app)
│   ├── components/
│   │   ├── AccelerateApp.tsx      # 688-line shell (was 5,377)
│   │   └── tabs/
│   │       ├── TodayTab.tsx       # Priority/scoring
│   │       ├── AcctDetail.tsx     # Account detail + research
│   │       ├── DealersTab.tsx     # Dealer breakdown + co-call
│   │       ├── GroupDetail.tsx    # Group detail + contacts
│   │       ├── AdminTab.tsx       # CSV upload + overlay admin
│   │       ├── OutreachTab.tsx    # Email outreach
│   │       ├── DashTab.tsx        # Territory dashboard
│   │       ├── MapTab.tsx         # Map/route
│   │       ├── EstTab.tsx         # Estimate calculator
│   │       └── GroupsTab.tsx      # Group list
│   ├── data/
│   │   ├── preloaded-data.ts      # 1.7MB primary data
│   │   ├── dealers.ts             # 253KB dealer map
│   │   ├── badger-lookup.json     # Contact enrichment
│   │   └── ...                    # Other static data
│   ├── lib/
│   │   ├── tokens.ts              # Colors + constants
│   │   ├── tier.ts                # Tier normalization
│   │   ├── format.ts              # Formatters + scoring engine
│   │   └── csv.ts                 # CSV processor
│   ├── styles/                    # Global CSS (minimal use)
│   └── types/index.ts             # TypeScript types (used by secondary pages)
└── tailwind.config.ts
```

---

## 16. Design Tokens Quick Reference

```typescript
const T = {
  bg: "#0a0a0f", s1: "#12121a", s2: "#1a1a25", s3: "#222230", s4: "#2a2a3a",
  b1: "rgba(255,255,255,.06)", b2: "rgba(255,255,255,.08)", b3: "rgba(255,255,255,.04)",
  t1: "#f0f0f5", t2: "#c8c8d0", t3: "#a0a0b8", t4: "#7878a0",
  blue: "#4f8ef7", cyan: "#22d3ee", green: "#34d399", amber: "#fbbf24",
  red: "#f87171", purple: "#a78bfa", orange: "#fb923c",
};
```

Usage: `style={{ background: T.s1, color: T.t1, border: \`1px solid ${T.b2}\` }}`

---

## 17. Overlay Save/Load Pattern

```typescript
// Load (on mount)
const res = await fetch("/api/load-overlay");
const data = await res.json();
// Merge into state: applyOverlays(groups, data)

// Save (on user action)
const updated = { ...overlays, contacts: { ...overlays.contacts, [id]: newContact } };
await fetch("/api/save-overlay", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(updated),
});
// Also update localStorage: localStorage.setItem("overlay_cache_v2", JSON.stringify(updated));
```

The API routes use the GitHub Contents API pattern:
1. GET the current file to obtain its SHA
2. PUT with the new content + SHA to commit

---

## 18. Navigation Model

**5 bottom tabs**: Today, Groups, Dealers, Dash, More
**More menu overflow**: Route, Close, Outreach, Admin

**View stack**: `viewStack` state array enables drill-down navigation:
- `goGroup(id)` → pushes GroupDetail
- `goAcct(id)` → pushes AcctDetail
- `goBack()` → pops stack
- Tab switch → clears stack

---

## 19. What's Working Well (Don't Break)

1. **Overlay persistence** — Contacts, groups, dealer corrections all survive CSV re-uploads and cache clears
2. **Scoring engine** — Multi-factor urgency scoring produces useful daily prioritization
3. **Deep Research** — AI-powered contact lookup with auto-group-linking
4. **Schein team directory** — FSC/ES roster with quick-pick assignments
5. **Gmail outreach** — Real email sending via OAuth
6. **Build hash badge** — Visible in More menu for deploy verification
7. **Data model** — Groups → children → products hierarchy is solid
8. **CSV import** — Handles Ken's actual Tableau format with all normalization rules

---

*End of knowledge base. This document is self-contained — everything needed to continue development is here.*
