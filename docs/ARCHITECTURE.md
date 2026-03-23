# ARCHITECTURE — accel-v7

> Last updated: March 22, 2026
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

The repo contains **two parallel UI systems** that coexist:

### 2a. The "Accelerate" Monolith — `src/components/AccelerateApp.tsx`
- **5,377 lines**, single file, `@ts-nocheck`
- Contains 8 tabs: Today, Groups, Dealers, Dash, Route/Map, Close/Estimator, Outreach, Admin
- Owns its own data loading (imports from `src/data/`, loads overlays via API on mount)
- Owns its own tab navigation, state management, view stack (group detail, account detail)
- Has its own inline CSS via style objects (not Tailwind)
- Mounted at `/accelerate` via `src/app/accelerate/page.tsx`
- **This is the primary working app that Ken uses daily**

### 2b. The Component-Based Pages — `src/app/*/page.tsx`
- Separate route-based pages: `/` (Territory), `/groups`, `/route`, `/dashboard`, `/plan`
- Use `AppShell` layout with `TopBar`, `TabBar`, `GlobalSearch`
- Import typed data from `src/data/index.ts` and types from `src/types/index.ts`
- Use Tailwind CSS for styling
- Use smaller component files under `src/components/cards/`, `src/components/charts/`, etc.
- **These pages exist but are secondary to AccelerateApp.tsx**

### Why Both Exist
AccelerateApp.tsx grew organically through rapid iteration. The component-based pages were an earlier or parallel attempt at a cleaner architecture. The Accelerate monolith is where all the recent feature work has landed (Admin, Outreach, Deep Research, Dealers, Overdrive scoring). The component pages have not kept pace.

---

## 3. Data Layer

### 3a. Static Data Files (committed to repo, bundled at build time)

| File | Size | Purpose |
|------|------|---------|
| `src/data/preloaded-data.ts` | 1.7MB | All account/group data from Tableau export. The primary data source. |
| `src/data/groups.json` | 1.0MB | Group-level rollups |
| `src/data/offices.json` | 1.5MB | Office-level flat list |
| `src/data/dealers.ts` | 253KB | Dealer assignments keyed by Master-CM ID |
| `src/data/badger-lookup.json` | 252KB | Contact info, lat/lng, addresses (from Badger enrichment) |
| `src/data/parent-names.json` | 46KB | Parent name lookup |
| `src/data/patches.json` | 2.7KB | Legacy patch system (group creates, detaches, name overrides, contacts) |
| `src/data/products.json` | 8KB | Product catalog |
| `src/data/gap-accounts.json` | 2.3KB | Gap account list |
| `src/data/week-routes.json` | 13KB | Pre-planned weekly routes |
| `src/data/territory-summary.json` | 731B | Territory-level aggregates |

**Key fact**: `preloaded-data.ts` is the canonical data source for AccelerateApp.tsx. It contains ~984 priority office locations with PY/CY credited wholesale, products, tiers, signals, etc. This file is updated via CSV upload processed by `processCSVData()` inside AccelerateApp.tsx.

### 3b. Overlays (runtime, persisted to GitHub via API)

| File | Location | Purpose |
|------|----------|---------|
| `data/overlays.json` | repo root | Runtime user corrections: custom groups, detaches, name overrides, contacts, FSC reps, activity logs, dealer overrides, research results |

**Loaded**: On app mount via `GET /api/load-overlay`
**Saved**: On user action via `POST /api/save-overlay` (commits to GitHub)
**Applied**: `applyOverlays()` runs on every data load, applying overlays on top of base static data. Survives CSV re-uploads.

### 3c. Patches (legacy, being replaced by overlays)

`src/data/patches.json` — the older system for group_creates, group_detaches, name_overrides, contacts. Still read by `applyOverlays()` but new writes go through the overlay API. `POST /api/save-patch` still exists for backward compatibility.

### 3d. Data Flow

```
Tableau CSV export
    ↓ (manual upload in Admin tab)
processCSVData() in AccelerateApp.tsx
    ↓ (builds groups array with children, PY/CY, products, tiers)
applyOverlays() 
    ↓ (merges name overrides, contacts, custom groups, detaches, dealer overrides)
groups[] state in AppInner component
    ↓ (passed to every tab as props)
scoreAccount() → scored[] array
    ↓ (adds urgency score, reasons, health status)
Tab components render the data
```

---

## 4. API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/load-overlay` | GET | Fetch `data/overlays.json` from GitHub |
| `/api/save-overlay` | POST | Commit updated overlays to GitHub |
| `/api/save-patch` | POST | Legacy: commit to `src/data/patches.json` |
| `/api/deep-research` | POST | AI-powered contact/account research (calls external AI) |
| `/api/send-outreach` | POST | Generate + send AI outreach emails via Gmail |
| `/api/gmail-auth` | GET | OAuth flow for Gmail |
| `/api/gmail-callback` | GET | OAuth callback |
| `/api/ai-briefing` | POST | AI-generated daily briefing |

All API routes that write to GitHub use `GITHUB_PAT` from Vercel env vars.

---

## 5. State Management

AccelerateApp.tsx uses **React hooks in a single component tree**:

- `useState` for tab, view, overlays, filters, search, CSV data
- `useMemo` for computed data (scored accounts, filtered lists, aggregates)
- `useCallback` for navigation functions (goAcct, goGroup, goBack)
- `useRef` for scroll position, file inputs
- `useEffect` for overlay loading on mount, localStorage sync

**There is no global state management** (no Redux, Zustand, Context). All state lives in `AppInner()` and is passed down as props to tab components defined in the same file.

---

## 6. Deployment Pipeline

```
Developer (Claude) edits file via GitHub API
    ↓ (fetch SHA → edit → brace/paren balance check → PUT)
GitHub commit on master branch
    ↓ (Vercel webhook)
Vercel build + deploy (~55 seconds)
    ↓
Live at accel-v7.vercel.app
```

**Push pattern**: Every code change goes through the GitHub Contents API. The push script fetches the current file SHA, applies the edit, validates brace/paren balance (delta must = 0), then PUTs the new content. After push, wait ~55 seconds and verify the live site has the new JS chunk hash.

---

## 7. Architectural Constraints

1. **AccelerateApp.tsx is 5,377 lines and growing.** It contains all 8 tabs, all detail views, all data processing, and all inline styles. This is the #1 technical debt item.

2. **`@ts-nocheck` disables all TypeScript checking.** The monolith bypasses the type system entirely. The component-based pages use proper types.

3. **No test coverage.** Zero tests. Changes are verified manually on the live site.

4. **GitHub as database.** Overlays persist by committing JSON to GitHub. This works for single-user but has no concurrency handling, no transactions, no indexing. Fine for Ken's solo use.

5. **Static data is bundled at build time.** The 1.7MB preloaded-data.ts is compiled into the JS bundle. Large but acceptable since it's a single-user app.

6. **Browser caching causes stale deploys.** Next.js aggressively caches JS chunks. Users sometimes need hard refresh or cache-bust parameter after deploys.

7. **No environment separation.** Production is the only environment. No staging, no preview branches.

8. **Single-user assumption throughout.** No auth, no multi-tenancy, no user concept. This is Ken's personal tool.

---

## 8. What's Strong

- **Data model is solid.** Groups → children → products hierarchy works. Overlay system is elegant — base data + corrections applied at runtime.
- **Scoring engine is smart.** Multi-factor urgency scoring (gap size, retention %, days since order, tier, product gaps) produces genuinely useful prioritization.
- **Real integrations work.** Gmail outreach, AI research, GitHub persistence — these are real production features, not stubs.
- **The app ships value.** Ken uses this daily. 8 tabs of real functionality built in rapid iteration.

---

## 9. Target Architecture (Future State)

The long-term direction is to **decompose AccelerateApp.tsx** into the component-based architecture that already exists in skeleton form:

1. Extract each tab into its own file under `src/components/tabs/`
2. Move shared state to a lightweight context or store
3. Enable TypeScript checking
4. Keep the overlay system — it's the right pattern
5. Keep the single-user, GitHub-backed persistence — it works
6. Keep the CSV import flow — it matches Ken's actual workflow

This decomposition should happen incrementally, one tab at a time, with zero downtime and zero feature regression.
