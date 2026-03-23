# Accelerate v7 — Architecture

## Current Architecture (as of March 2026)

### Runtime Stack
- **Framework:** Next.js 14+ (App Router)
- **Hosting:** Vercel (`accel-v7.vercel.app/accelerate`)
- **UI:** Single-file React component (`AccelerateApp.tsx`, ~5,400 lines)
- **Styling:** Inline styles with a shared theme object `T` (dark mode only)
- **State:** React useState/useMemo, no external state library
- **Persistence:** GitHub API (overlays.json) + localStorage (cache/session)

### File Map

```
src/
  app/
    accelerate/page.tsx      ← Active app entry point (imports AccelerateApp)
    page.tsx                 ← Legacy v6 page (uses old component tree — unused)
    api/
      ai-briefing/route.ts   ← Claude API: account briefing
      deep-research/route.ts ← Claude API + web search: contact/intel lookup
      gmail-auth/route.ts    ← OAuth start for Gmail
      gmail-callback/route.ts← OAuth callback for Gmail
      load-overlay/route.ts  ← GET overlays.json from GitHub
      save-overlay/route.ts  ← PUT overlays.json to GitHub
      save-patch/route.ts    ← Legacy: save patches.json (superseded by overlays)
      send-outreach/route.ts ← Send AI-generated emails via Gmail API
  components/
    AccelerateApp.tsx        ← THE APP: all tabs, all logic (~5,400 lines)
    cards/                   ← Legacy v6 components (NOT imported by AccelerateApp)
    charts/                  ← Legacy v6 charts (NOT imported)
    layout/                  ← Legacy v6 layout (NOT imported)
    ui/                      ← Legacy v6 primitives (NOT imported)
  data/
    preloaded-data.ts        ← Primary data source (1.7MB, exported as PRELOADED)
    dealers.ts               ← Dealer assignments per Master-CM ID (253KB)
    badger-lookup.json       ← Contact info, lat/lng, addresses (252KB)
    groups.json              ← Legacy group data (1MB, used by old page.tsx)
    offices.json             ← Legacy office data (1.5MB, used by old page.tsx)
    patches.json             ← Legacy patches (superseded by overlays.json)
    week-routes.json         ← Static weekly route data (13KB, 15 accounts)
    products.json            ← Product catalog (8KB)
    index.ts                 ← Legacy data exports (used by old page.tsx)
  lib/
    insights.ts              ← Legacy insights engine (not used by AccelerateApp)
    utils.ts                 ← Legacy utils (not used by AccelerateApp)
  types/
    index.ts                 ← TypeScript types (partially used)
data/
  overlays.json              ← Durable user overrides (groups, contacts, FSC, etc.)
```

### Data Flow

```
preloaded-data.ts (static, 1.7MB)
  ↓ require() at module load
  ↓
applyOverlays() ← overlays.json (fetched from GitHub API at mount)
  ↓
hydrateDealer() ← dealers.ts (static dealer assignments)
  ↓
applyGroupOverrides() ← overlays.groupMoves
  ↓
groups[] state (React useState)
  ↓
scored[] = allChildren.map(scoreAccount) ← scoring engine
  ↓
All tabs consume scored[] and groups[]
```

### Persistence Model

| Data | Storage | Durability |
|------|---------|------------|
| Account/group base data | `preloaded-data.ts` (static in repo) | Permanent until CSV re-upload |
| User overlays (groups, contacts, FSC, detaches, moves, names) | `data/overlays.json` via GitHub API | Durable — survives cache clear |
| Overlay cache | `localStorage:overlay_cache` | Session — fast load fallback |
| Activity logs | `localStorage:actlog:{id}` + overlays | Hybrid — localStorage first, syncs to overlays |
| Overdrive outcomes | `localStorage:overdrive_done` | Session only |
| Manual adjustments | React state (`adjs`) | Session only — lost on refresh |
| Gmail token | `localStorage:gmail_refresh_token` | Session only |
| Dismissed dupes | `localStorage:dupe_dismissed` | Session only |

### Component Structure (inside AccelerateApp.tsx)

All components are defined in a single file. No imports between them — they share module-level variables.

| Component | Lines | Role |
|-----------|-------|------|
| `applyOverlays()` | ~100 | Apply user overrides to base data |
| `scoreAccount()` | ~30 | Priority scoring engine |
| `parseCSV()` / `processCSVData()` | ~200 | CSV upload and processing |
| `AppInner()` | ~400 | Main app shell: data loading, state, routing, nav |
| `TodayTab` | ~1,000 | Overdrive engine, group action cards, search |
| `GroupsTab` | ~100 | Group list with search/filter |
| `GroupDetail` | ~300 | Group detail: FSC contacts, product health, locations |
| `AcctDetail` | ~800 | Account detail: contacts, AI briefing, deep research, activity log, sale calculator |
| `SaleCalculator` | ~80 | SKU search + tier-aware credit calculation |
| `DashTab` | ~200 | Territory stats, tier revenue, standalone calculator |
| `MapTab` | ~200 | Leaflet map, static week routes, Google Maps links |
| `DealersTab` | ~700 | Distributor drill: dist → rep → group → account + FSC co-call planner |
| `EstTab` | ~100 | Q1 completion estimator with PY repeat slider |
| `OutreachTab` | ~300 | Gmail AI email queue with research + batch send |
| `AdminTab` | ~300 | Group create/edit, detach, rename, contacts, duplicate review |
| `AccountId` | ~15 | Shared name display (child + parent group) |

### Shared Primitives

| Name | Role |
|------|------|
| `AccountId` | Account name + parent group name display |
| `Stat` | Labeled stat box (PY, CY, Gap, Ret) |
| `Pill` | Inline label + value |
| `Bar` | Animated progress bar |
| `Back` / `Chev` | Navigation icons |
| `$$` / `$f` | Currency formatters |
| `T` | Theme color constants |

### External Integrations

| Service | Purpose | Auth |
|---------|---------|------|
| GitHub API | Read/write overlays.json | `GITHUB_PAT` env var |
| Anthropic Claude API | AI briefing + deep research + outreach emails | `ANTHROPIC_API_KEY` env var |
| Gmail API | Send outreach emails | OAuth2 (user-initiated) |
| Leaflet/OSM | Map rendering in Route tab | None (public tiles) |
| Google Maps | Route links (opens externally) | None (URL scheme) |

## Design Principles

1. **Mobile-first** — designed for phone use in the field
2. **Offline-tolerant** — localStorage cache means app loads even if API is slow
3. **Single-file simplicity** — one file means one push, one deploy, no build coordination
4. **Data survives** — overlays.json is separate from base data, survives CSV re-uploads
5. **No auth required** — the app is open (acceptable for single-user field tool)

## Known Architectural Limitations

1. **5,400-line monolith** — all components in one file. Any edit risks breaking unrelated tabs.
2. **Static data baked in** — preloaded-data.ts is 1.7MB compiled into the JS bundle. No database.
3. **No TypeScript strictness** — `@ts-nocheck` at top, `any` types throughout.
4. **Manual adjustments are session-only** — sale calculator additions lost on refresh.
5. **Legacy dead code** — old page.tsx, cards/, charts/, layout/, ui/, lib/ are unused but still in repo.
6. **Week routes are static** — week-routes.json has 15 hardcoded accounts, not editable from app.
7. **No multi-user support** — single overlays.json, no user auth, no conflict resolution.
8. **localStorage for critical data** — activity logs, overdrive outcomes, Gmail tokens are browser-only.
