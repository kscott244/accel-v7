# CURRENT PHASE -- accel-v7

## Status: Territory Copilot Knowledge Layer live.

### Phase 12: Territory Copilot Knowledge Layer — March 28, 2026

**Commits:**
- `d5d45286` — src/lib/territory.ts: knowledge layer foundation
- `b9785627` — CopilotPanel: full execution engine
- `4927860f` — App: pass overlays to CopilotPanel

**Deploy:** HTTP 200 ✅

---

**What was built:**

### `src/lib/territory.ts` — Knowledge Layer Foundation

**`buildTerritoryContext(scored, badger, overlays)`**
Runs once when the panel opens. Produces a `TerritoryContext` with:
- `accounts: EnrichedAccount[]` — all accounts enriched with Badger (doctor, phone, dealerRep, feel, notes, visitNotes, lat/lng) and overlay signals (contacts, open task count, last activity days)
- Pre-computed indexes: `byCity`, `bySt`, `byDealer`, `byTier`, `byClass2` — O(1) geographic and attribute lookups
- `topProducts` — territory-wide product rankings by CY spend with family classification
- Territory aggregates: `totalPY1`, `totalCY1`, `totalGap`

**`PRODUCT_FAMILIES`** — canonical family-to-keyword mapping for all Kerr product lines: COMPOSITE, BOND, CEMENT, INFECTION_CONTROL, TEMP_CEMENT, RMGI, DESENSITIZER, CURING_LIGHT

**`matchProdCmd(prodName, cmdProduct, cmdFamily)`** — fuzzy product matching that handles both exact product names and family-level queries

**`haversineKm(lat1, lng1, lat2, lng2)`** — distance calculation for proximity queries

**`EnrichedAccount` interface** — typed schema for the enriched account object with all knowledge signals surfaced at the top level

---

### CopilotPanel — Execution Engine (previously: 5 command types with many gaps)

**New branches added to `executeCommand()`:**

| Feature | Before | After |
|---------|--------|-------|
| Geography filter (city/state) | Parsed but ignored | Applied to all command types |
| Dealer filter | Parsed but ignored | Applied |
| Tier filter | Parsed but ignored | Applied |
| Account type (DSO/etc) | Parsed but ignored | Applied with class2 mapping |
| Family-level product matching | Partial strings only | Full PRODUCT_FAMILIES mapping |
| `prodWidth` metric | Not implemented | # active products on account |
| `summary` type | Not implemented | Returns plain-English answer with totals |
| `growing` category | Not implemented | cy1 > py1, sorted by delta |
| `minDays` threshold | Hardcoded 90 | From command |
| `overdue` reason | Not implemented | Accounts with open tasks |
| `nearby` type | Not possible | Haversine from user location, with warm+underperforming qualifier |
| Feel label on results | Not shown | Hot/Warm/Cold chip on each row |
| Doctor on results | Not shown | Shown in subtitle |
| Dealer on results | Not shown | Shown in subtitle |

**Territory context in panel header**
The panel now shows live territory aggregates: "984 accounts · $615K CY · $144K gap" — grounded anchoring before any question is asked.

**Examples updated** to reflect the expanded capability (Hartford DSOs, infection control totals, fastest growing, etc.)

---

### What this enables (questions that now work)

- "Who's buying the most composite?" — family-level rank
- "Hartford accounts stopped buying bond" — city + family + qualifier
- "DSOs in CT with the biggest gap" — state + accountType + metric
- "Accounts buying OptiBond but not any composite" — family filter
- "Schein accounts in RI that are down" — dealer + state + metric
- "How much infection control am I doing?" — summary type
- "Fastest growing accounts" — growing category
- "Who hasn't ordered in 90 days in CT?" — follow_up + state + minDays
- "Platinum accounts with a gap" — tier filter
- "Best MaxCem win-back" — winback + exact product
- "Accounts that only buy one product" — prodWidth metric

### What still requires proximity (works if location enabled)
- "Who's nearby?"
- "Warm account close to me with a gap?"
- "Best opportunity within 5 miles?"

### What is still out of scope
- Questions about specific doctor names (not indexed)
- Questions about dates / calendar / scheduling
- Competitor data (not in the app)
- Questions about sales history trends by month (salesStore not wired to copilot)

---

## Previously Completed
- Phase 11 — AI Query Copilot (initial 5-type system)
- Phase 10 — Action-Hub Polish
- Phase 9 — Feel Factor
- Phase 8 — Tasks operating layer
- Phase 7 — Route with Intent
- Phase 6 — DealersTab Channel Console

## Last Updated
March 28, 2026
