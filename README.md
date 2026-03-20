# Accelerate v2 — Next.js Sales Intelligence Platform

A premium mobile-first sales intelligence app for territory management, rebuilt from a monolithic HTML file into a modern Next.js/React/TypeScript/Tailwind stack.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS with custom design tokens
- **Charts:** Custom SVG/CSS chart components
- **Animation:** CSS animations + transitions
- **Fonts:** DM Sans (UI) + JetBrains Mono (numbers) + Instrument Sans (display)

## Project Structure

```
accelerate/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── layout.tsx          # Root layout (TopBar + TabBar)
│   │   ├── page.tsx            # Territory (home page)
│   │   ├── groups/page.tsx     # Groups view
│   │   ├── route/page.tsx      # This Week / Route planner
│   │   ├── dashboard/page.tsx  # Rep Model / Territory Intelligence
│   │   └── plan/page.tsx       # Targets / Q Planner
│   ├── components/
│   │   ├── layout/             # TopBar, TabBar
│   │   ├── ui/                 # Reusable primitives (badges, bars, inputs)
│   │   ├── cards/              # Domain-specific cards (Office, Group, etc.)
│   │   └── charts/             # Chart components (bar charts, scenarios)
│   ├── data/                   # All business data as typed JSON
│   │   ├── index.ts            # Typed exports + computed stats
│   │   ├── groups.json         # 672 groups, 1,670 child offices
│   │   ├── offices.json        # 984 territory offices (flat list)
│   │   ├── products.json       # 48 products with PY/CY
│   │   ├── week-routes.json    # 3-day route plan + unplaced
│   │   └── gap-accounts.json   # Top 15 gap accounts
│   ├── lib/utils.ts            # Formatters, constants, helpers
│   ├── types/index.ts          # Full TypeScript type system
│   └── styles/globals.css      # Tailwind + custom design system
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.js
```

## Pages / Tabs

| Tab | Route | Description |
|-----|-------|-------------|
| Territory | `/` | Home view — quota hero, full year tracker, office list with filters/search, product list |
| Groups | `/groups` | Parent group view — 672 groups with drill-down to child offices |
| This Week | `/route` | Route planner — day-by-day visit queue sorted by $ opportunity |
| Rep Model | `/dashboard` | Territory intelligence — quota pulse, signals, buckets, product charts |
| Targets | `/plan` | Q planner — gap analysis sliders, completion estimator, FY scenarios |

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
npm start
```

## Data Architecture

All business data is baked into JSON files (no backend). To refresh data:

1. Export from Power BI / data warehouse
2. Run the Python data processing script (or manually update JSON files)
3. Rebuild and deploy

### Key Data Constants

| Constant | Value |
|----------|-------|
| Q1 Target | $778,915 |
| Q1 CY Credited | $628,609 |
| Full Year Target | $3,158,094 |
| PY 2025 Total | $2,799,593 |
| Required Growth | +12.8% |
| Total Offices | 1,670 |
| Total Groups | 672 |

## Design System

Dark theme (Linear/Vercel inspired) with custom CSS variables:

- **Surfaces:** bg → s1 → s2 → s3 → s4 (darkest to lightest)
- **Accents:** blue, cyan, green, amber, red, purple, gold
- **Text:** t1 (bright) → t2 → t3 → t4 (dimmest)
- **Cards:** `.card` (standard) / `.card-hero` (gradient with glow)
- **Badges:** `.badge-blue`, `.badge-green`, `.badge-amber`, `.badge-red`

## Component Library

### UI Primitives
- `StatCard` — KPI display with label/value/sub
- `ProgressBar` — Animated bar with glow dot and variants
- `SignalBadge` — Color-coded signal indicator
- `QuarterCard` — Quarter KPI mini card
- `FilterBar` — Horizontal scrolling pill filters
- `SearchInput` — Styled search with icon

### Charts
- `HorizontalBarChart` — Multi-item bar chart (signals, products, buckets)
- `MiniBarChart` — Inline PY vs CY comparison
- `ScenarioBarChart` — FY projection bars with target line

### Domain Cards
- `QuotaHero` — Main quota progress card
- `FullYearTracker` — 4-quarter overview
- `OfficeCard` — Office list item with signal/metrics
- `OfficeDetail` — Full-screen office CRM record
- `GroupCard` — Parent group list item
- `GroupDetail` — Full-screen group drill-down
- `ProductCard` — Product with PY/CY bar chart
- `RouteStopCard` — Route visit with actions
