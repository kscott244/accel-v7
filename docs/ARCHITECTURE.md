# ARCHITECTURE — accel-v7

> Last updated: March 23, 2026
> Source of truth for how the app is built, what lives where, and the constraints we operate under.

---

## 1. High-Level Overview

accel-v7 is a **Next.js 14 sales intelligence app** for Ken Scott, Kerr Dental field rep covering CT/MA/RI/NY. It is deployed on Vercel and backed by GitHub as both the code repo and the data persistence layer.

**Stack**: Next.js 14 + React 18 + TypeScript + Tailwind CSS + Recharts
**Repo**: `kscott244/accel-v7` (branch: `master`)
**Live**: `https://accel-v7.vercel.app/accelerate`
**Vercel project**: `prj_z3qFU5wVT4XCZOypcv448v1pN6Um`

---

## 2. Two App Architectures (Coexisting)

The repo contains **two parallel UI systems**:

### 2a. The "Accelerate" App — `src/components/AccelerateApp.tsx`
- **~680 lines** — shell + routing + state only (Phase 5 decomposition complete)
- Tab components extracted to `src/components/tabs/`: TodayTab, GroupsTab, DealersTab, DashTab, MapTab, EstTab, OutreachTab, AdminTab, GroupDetail, AcctDetail
- Shared logic in `src/lib/`: tokens, tier, format (scoring), csv
- `@ts-nocheck` still present in tab files — TypeScript errors cleared (Phase 6), full strict typing is future work
- Navigation: 5 bottom tabs (Today, Groups, Dealers, Dash, More) + overflow menu (Route, Close, Outreach, Admin)
- Owns data loading, tab navigation, state management, view stack
- Has its own inline CSS via style objects (not Tailwind)
- Mounted at `/accelerate` via `src/app/accelerate/page.tsx`
- **This is the primary working app that Ken uses daily**

### 2b. The Component-Based Pages — `src/app/*/page.tsx`
- Separate route-based pages: `/` (Territory), `/groups`, `/route`, `/dashboard`, `/plan`
- Use `AppShell` layout with `TopBar`, `TabBar`, `GlobalSearch`
- Import typed data from `src/data/index.ts` and types from `src/types/index.ts`
- Use Tailwind CSS and smaller component files under `src/components/cards/`, `src/components/charts/`
- **These pages exist but are secondary — not feature-complete compared to AccelerateApp.tsx**

### Why Both Exist
AccelerateApp.tsx grew organically through rapid iteration. The component pages were an earlier attempt at a cleaner architecture but have not kept pace with feature work. All recent development (Admin, Outreach, Deep Research, Dealers, Co-Call Planner, Duplicate Review) landed in the monolith.

---

## 3. Data Layer

### 3a. Static Data Files (committed to repo, bundled at build time)

| File | Size | Purpose |
|------|------|---------|
| `src/data/preloaded-data.ts` | 1.7MB | All account/group data from Tableau export. Primary data source for AccelerateApp.tsx. |
| `src/data/groups.json` | 1.0MB | Group-level rollups (used by component-based pages) |
| `src/data/offices.json` | 1.5MB | Office-level flat list (used by component-based pages) |
| `src/data/dealers.ts` | 253KB | Dealer assignments keyed by Master-CM ID |
| `src/data/badger-lookup.json` | 252KB | Contact info, lat/lng, addresses (Badger enrichment) |
| `src/data/parent-names.json` | 46KB | Parent name lookup |
| `src/data/patches.json` | 2.7KB | **Legacy** patch system — still read by applyOverlays() but new writes go to overlays.json |
| `src/data/products.json` | 8KB | Product catalog |
| `src/data/gap-accounts.json` | 2.3KB | Gap account list |
| `src/data/week-routes.json` | 13KB | Pre-planned weekly routes |
| `src/data/territory-summary.json` | 731B | Territory-level aggregates |

**Key fact**: `preloaded-data.ts` is the canonical data source. It contains ~984 priority office locations with PY/CY credited wholesale, products, tiers, signals, etc. Updated via CSV upload processed by `processCSVData()` inside AccelerateApp.tsx.

### 3b. Overlays — `data/overlays.json` (runtime, persisted to GitHub via API)

Runtime user corrections that survive CSV re-uploads:
- **Custom groups**: Resolute Dental Partners, merged duplicates (Dental Care Stamford, Dental Associates Farmington)
- **Group detaches**: Aspen Dental from Columbia Dental
- **Name overrides**: Wells Street Dentistry, Flanders Dental Studio
- **Contacts**: contact name, email, phone, address, Deep Research results
- **FSC rep assignments**: per-dealer-per-group FSC contact info
- **Activity logs**: visit logs, notes, follow-up dates
- **Dealer overrides**: correct dealer assignments (e.g., Abra Dental → Schein)

**Loaded**: On app mount via `GET /api/load-overlay`
**Saved**: On user action via `POST /api/save-overlay` (commits JSON to GitHub)
**Applied**: `applyOverlays()` runs on every data load, merging overlays on top of base static data

### 3c. Single Overlay System ✅

`data/overlays.json` is the sole persistence layer. `patches.json` has been retired (Phase 2). `save-patch` API route removed. `applyOverlays()` reads only from `overlays.json`.

### 3d. Data Flow

```
Tableau CSV export
    ↓ (manual upload in Admin tab or preloaded on build)
processCSVData() → builds groups array with children, PY/CY, products, tiers
    ↓
hydrateDealer() → merges dealer info from dealers.ts
    ↓
applyOverlays() → merges overlays (name overrides, contacts, custom groups, detaches, dealer overrides)
    ↓
applyGroupOverrides() → applies local/runtime group corrections
    ↓
groups[] state in AppInner component
    ↓ (passed as props to every tab)
scoreAccount() → scored[] array (adds urgency score, reasons, health status)
    ↓
Tab components render the data
```

---

## 4. API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/load-overlay` | GET | Fetch `data/overlays.json` from GitHub |
| `/api/save-overlay` | POST | Commit updated overlays to GitHub |
| `/api/save-patch` | POST | Legacy: commit to `src/data/patches.json` (should be retired) |
| `/api/deep-research` | POST | AI-powered contact/account research |
| `/api/send-outreach` | POST | Generate + send AI outreach emails via Gmail |
| `/api/gmail-auth` | GET | OAuth flow for Gmail |
| `/api/gmail-callback` | GET | OAuth callback |
| `/api/ai-briefing` | POST | AI-generated daily briefing |

All GitHub-writing routes use `GITHUB_PAT` from Vercel env vars.

---

## 5. State Management

AccelerateApp.tsx uses **React hooks in a single component tree**:
- 101 `useState` hooks across all components in the file
- `useMemo` for computed data (scored accounts, filtered lists, aggregates)
- `useCallback` for navigation functions (goAcct, goGroup, goBack)
- `useRef` for scroll position, file inputs
- `useEffect` for overlay loading on mount, localStorage sync

**No global state management** (no Redux, Zustand, Context). All state lives in `AppInner()` and is passed as props to tab components defined in the same file. Some tabs define their own local state (DealersTab has co-call state, AcctDetail has research/move/activity state).

---

## 6. Deployment Pipeline

```
Developer (Claude) edits file via GitHub Contents API
    ↓ (fetch SHA → edit → brace/paren balance check → PUT)
GitHub commit on master branch
    ↓ (Vercel webhook triggers)
Vercel build + deploy (~55 seconds)
    ↓
Live at accel-v7.vercel.app/accelerate
```

**Push pattern**: Every code change goes through the GitHub Contents API. Fetch current SHA, apply edit, validate brace/paren balance (delta must = 0), PUT new content. Wait ~55s, verify live site has new JS chunk hash.

---

## 7. Architectural Constraints

1. **`@ts-nocheck` in tab files.** TypeScript errors are cleared (Phase 6) but strict type checking is not yet enabled per-file. Full strictness is future work.
2. **Test coverage is narrow.** `scoreAccount()` and `processCSVData()` are covered (34 tests added Phase 6). Tab components have no tests.
3. **AccelerateApp.tsx decomposed but tab files still use inline styles.** No Tailwind in tab components — inline style objects throughout.
4. **GitHub as database.** Overlays persist by committing JSON. Works for single-user, no concurrency/transactions/indexing.
5. **1.7MB static data bundled at build time.** Acceptable for single-user app but makes builds slower.
6. **Browser caching causes stale deploys.** Users sometimes need hard refresh or `?v=N` parameter.
7. **No environment separation.** Production only — no staging, no preview branches.
8. **Single-user assumption.** No auth, no multi-tenancy. This is Ken's personal tool.
9. **Dual overlay systems.** patches.json + overlays.json both active. Consolidation needed.

---

## 8. What's Strong

- **Data model works.** Groups → children → products hierarchy is solid. Overlay system (base data + runtime corrections) is elegant and proven.
- **Scoring engine is smart.** Multi-factor urgency scoring produces genuinely useful daily prioritization.
- **Real integrations work.** Gmail outreach, AI Deep Research, GitHub persistence — production features, not stubs.
- **The app ships value.** Ken uses this daily. 8 tabs of real functionality, FSC co-call planner, duplicate review, activity logging.
- **Overlay persistence is reliable.** Contacts, groups, dealer corrections all survive CSV re-uploads and browser cache clears.
- **Nav was recently consolidated.** 5 main tabs + More menu — mobile-friendly.

---

## 9. Target Architecture (Future State)

Long-term direction: **decompose AccelerateApp.tsx** into the component-based architecture that already exists in skeleton form.

1. Extract each tab into its own file under `src/components/tabs/`
2. Extract shared logic: scoring engine, overlay processing, CSV parser, design tokens
3. Move shared state to a lightweight context or store
4. Enable TypeScript checking (remove @ts-nocheck)
5. Keep the overlay system — it's the right pattern
6. Keep GitHub-backed persistence — it works for single-user
7. Keep the CSV import flow — it matches Ken's actual Tableau workflow
8. Retire patches.json, consolidate to overlays.json only

Decomposition should happen incrementally, one tab at a time, with zero downtime and zero feature regression.
