# ACCEL-V7 — Comprehensive Build Prompt (March 27, 2026 Evening Session)

## Context — What Was Discovered Tonight

We spent several hours analyzing Ken's data across multiple source files and discovered critical patterns in how Kerr's Tableau data represents dental organizations. All findings are saved in `docs/DATA_INTELLIGENCE_REPORT.md`, `docs/data_discoveries.json`, and `docs/new_adds.json` in the repo. Read those files first — they contain the full analysis.

### The 7 Matching Signals (for linking accounts to their real-world org)

1. **Parent CM** — Kerr's baseline assignment. Works well for large DSOs, poorly for mid-size/small.
2. **Normalized Address** — same physical address = same office or dealer split.
3. **Anchor-Orphan** — a multi-location group (3+ locs) at the same address as a standalone (1-2 locs) means the standalone is likely a dealer-split or acquisition of the larger group. We found **137 orphan accounts linked to 32 anchor groups** — all in-territory.
4. **Doctor Name in Address Field** — Kerr embeds managing doctor names after the street address (e.g., "141 Hebron Ave Ste 3 Dr. Michael Capalbo"). Cross-referencing these names against group/child names elsewhere reveals hidden org connections.
5. **Email Domain** — org-specific email domains shared across different CMs = confirmed same org. (e.g., @allaboutkidsteeth.com links two All About Kids accounts to Abra Dental).
6. **External Truth Files** — `docs/data_discoveries.json` contains authoritative group membership from Group_Account.csv (74 DSO groups), Plum Dental xlsx (44 offices across 16 Kerr parents), and Gold/Silver Accelerate data.
7. **class2 = DSO on single-location accounts** — 29 accounts labeled DSO with only 1 child are acquired practices whose parent org is unknown from Kerr data alone.

### Key Pattern: How Kerr Represents DSO Acquisitions

- **Large DSOs** (Aspen 53 locs, Smile Doctors 21 locs, etc.): All acquisitions correctly parented under DSO's CM. Children keep original practice names. Class2=DSO, shared tier. These are CORRECT in preloaded data.
- **Mid-size DSOs** (Plum 44 locs across 3 CMs, Edge Dental 7 locs): Some locations under DSO parent, others still standalone. Need overlay merges.
- **Small/Emerging DSOs**: Practice keeps original CM, gets class2=DSO as only signal. Need external data to discover parent.

### Territory
Ken's zip prefixes: 025-029 (MA/RI), 060-069 (CT), 105-109 (NY Westchester/Hudson Valley).
All 5,543 preloaded accounts and all 137 anchor-orphan discoveries are in-territory.

---

## TASK 1 — Fix Overlay System (CRITICAL — Do This First)

### Problem
Every save-overlay call writes the ENTIRE overlay file. If the app loaded stale data from localStorage before a fix deployed, the next save (even just adding a note) stomps the fix. This has corrupted data multiple times tonight.

### Current overlay state
Clean as of commit `a87cc7dbe3`. Only 1 custom group: Edge Dental Management (Master-CM047997, 8 children). 26 auto-created groups were removed because they were causing corruption.

### What to build

**1a. Atomic overlay saves:**
Change save-overlay from "replace entire file" to "patch specific section." The API should accept operations like:
- `{ op: "setContact", id: "Master-CM123", data: {...} }`
- `{ op: "addGroupChild", groupId: "...", childId: "..." }`
- `{ op: "removeGroupChild", groupId: "...", childId: "..." }`
- `{ op: "createGroup", groupId: "...", name: "...", childIds: [...] }`
- `{ op: "deleteGroup", groupId: "..." }`
- `{ op: "setNameOverride", id: "...", name: "..." }`
- `{ op: "setFscRep", ...}`, `{ op: "addActivityLog", ...}`, etc.

The API reads the CURRENT overlay from GitHub, applies the patch, and writes back. The client never sends a full overlay. Update all client-side save calls to use the new patch format.

**1b. Write guards on save-overlay:**
Before applying any group patch, validate:
- A childId cannot be the parent ID of another base group with 3+ children (prevents absorbing entire orgs — this is what happened with Alpha Dental getting absorbed into Edge Dental)
- A childId cannot appear in multiple overlay groups
- If groupDetaches contains a pair, reject any merge attempt for that pair
- Return 400 with clear error message on violations

**1c. Kill localStorage overlay cache:**
Remove `overlay_cache_v2` from localStorage entirely. Always load fresh from API on mount. The cache is the root cause of stale data stomping fixes.

**1d. Overlay audit test:**
Add a test that loads preloaded-data.ts and overlays.json and verifies:
- No overlay group childId is the parent of a 3+ location base group
- No childId appears in multiple overlay groups
- No overlay group has 0 children
- All overlay group childIds exist in base data

---

## TASK 2 — Add Address Display to Account Cards

Every account card should show the physical address underneath the account name.

**Where:** GroupDetail.tsx children list, TodayTab.tsx account cards, AcctDetail.tsx header, anywhere a child account renders.

**Format:** `{addr}, {city} {state} {zip}` in `T.t3` color, smaller font (12-13px). Skip empty fields gracefully.

**Why:** Ken needs to visually verify if two "locations" are the same physical address (duplicate dealer CMs) vs genuinely different offices.

The data is already on each child in preloaded-data.ts (`addr`, `city`, `state`, `zip` fields). Just render it.

---

## TASK 3 — Add Group Affiliation Badge

If a child account's parent group has 3+ children, show a small badge in the bottom-right of the account card.

**Visual:** Lucide `Building2` icon at 14px in `T.purple`, with parent group name in `T.t4` at 11-12px, like "Dental 365 · 12 locs".

**Behavior:** Tapping the badge navigates to parent group via `goGroup(parentId)`.

**Where:** TodayTab account cards, GroupDetail children list, search results.

**Rule:** Single-location groups (1 child) = no badge. Absence of badge = independent practice.

---

## TASK 4 — New Adds Feature

Build a "New Adds" section accessible from the Today tab or as its own view.

**Data source:** `docs/new_adds.json` in the repo (already committed). 67 accounts with new product purchases in Q1 2026.

**Each card shows:**
- Account name
- Products purchased (badge chips)
- First purchase date → Last purchase date
- Color KPI badge (RED = needs follow-up, GREEN = on track)
- Which parent group they belong to (with group badge from Task 3)
- Contact email + phone (57 of 67 have these)
- Address

**Sort by:** RED accounts first, then by date (most recent first).

**Why this matters:** These are accounts with fresh momentum — they just started buying new products. The 63 RED accounts need follow-up NOW to convert into regulars. This is Ken's "strike while it's hot" list.

---

## TASK 5 — Lock Down Auto-Group-Creation

The buildOrgClusters / AI group matcher / merge UI should NEVER auto-create overlay groups without explicit user approval. Any suggested merge must go through a review UI where Ken taps Approve or Skip. No silent writes to overlays.groups. Period.

The approve/skip UI already exists in AdminTab (the cards with "Approve" and "Skip" buttons shown in the screenshots). Just make sure nothing bypasses it.

---

## TASK 6 — Anchor-Orphan Suggestions (Lower Priority)

The `docs/data_discoveries.json` file contains 137 anchor-orphan matches. These are accounts at the same address as a known multi-location group that are probably dealer-split accounts belonging to that group.

**Don't auto-merge these.** Instead, surface them as suggestions in the Admin tab or a new "Suggestions" view:
- "RICHARD L SCHECHTMAN DDS is at the same address as DENTAL WHALE (47 locs). Link?"
- Approve → creates overlay group merge
- Skip → adds to groupDetaches so it never suggests again

**Filter out non-dental accounts** — some "orphans" are eye doctors or medical practices in the same building. Only suggest if the orphan's practice looks dental (name contains dental/dentist/dds/dmd/orthodont/perio/endo/oral).

---

## Important Reminders

- All styling uses inline style objects with the `T` token object from `src/lib/tokens.ts`. NOT Tailwind.
- All files have `@ts-nocheck`. Don't try to add types.
- Use `$$()` from `src/lib/format.ts` for currency display — it must be imported explicitly.
- Test on mobile viewport — everything must be touch-friendly.
- The overlay is CLEAN right now (commit a87cc7dbe3). Don't break it.
- Build hash badge in More menu should still work for deploy verification.

---

## TASK 7 — Smart Child Consolidation for Small Practices

### The Problem
A single private practice at one address might have 4 different CM numbers because they buy through 4 different dealers. On the Today tab, this shows as 4 separate account cards cluttering the view. Ken wants to see ONE card with combined revenue.

### The Rule
- **Groups with 1-2 unique addresses**: Consolidate children at the same normalized address into ONE child. Combined PY/CY across all dealer CMs. Store the individual CM numbers + dealer names as metadata inside the consolidated child so the Dealers tab can still break it down.
- **Groups with 3+ unique addresses (DSOs/multi-location)**: Keep children separate even at the same address. Each CM is a tracked revenue stream within the org. The address display (Task 2) makes it clear which ones share an office.

### Implementation
In `processCSVData()` or `extractLeaves()`, after building the group:
1. Count unique normalized addresses in the group
2. If 1-2 unique addresses: merge children sharing the same address
   - Combined child gets the name of the child with highest PY revenue
   - PY/CY = sum of all children at that address
   - `dealerBreakdown: [{ cm: "Master-CM123", dealer: "Schein", py: X, cy: Y }, ...]` stored as metadata
   - Products = union of all children's products
3. If 3+ unique addresses: leave children as-is

### Where the dealer breakdown shows
- Account detail view (AcctDetail.tsx): show "Purchased through: Schein ($3K), Patterson ($2K), Benco ($1K)"
- Dealers tab: show the per-dealer split as always
- Today tab / Groups tab: show ONLY the consolidated number

### Example
Dr. Smith at 123 Main St buys through Schein ($3K PY), Patterson ($2K PY), Benco ($1K PY), Darby ($500 PY):
- Today tab shows: "DR SMITH — $6,500 PY" (one card)
- Account detail shows: "$6,500 PY total — via Schein $3K, Patterson $2K, Benco $1K, Darby $500"
- Dealers tab shows: "Schein: Dr Smith $3K" / "Patterson: Dr Smith $2K" etc.

