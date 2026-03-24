# Search Behavior Audit — Phase 2 (Identity & Search Model)

> Baseline: commit `329ce93`
> Date: March 24, 2026
> Status: Audit complete — no code changes made

---

## 1. Entity Types in the App

The app has three entity types that can appear in search results:

| Entity | What it is | ID pattern | Example |
|--------|-----------|------------|---------|
| **Child** | A single office location | `Master-CMxxxxxx` or `HEN-`, `BNK-`, etc. | "ALL ABOUT KIDS PEDIATRIC DENTISTRY" — one office in Stamford CT |
| **Parent/Group** | A practice entity with 1+ children | Same `Master-CMxxxxxx` pattern | "ABRA DENTAL" — parent with multiple child offices |
| **Dealer-Parent** | Same parent, but filtered to one dealer's children only | Same ID | "ABRA DENTAL" but only showing Schein locations |

---

## 2. Data Pipeline — What Each Tab Receives

### `scored` (flat child list)
- Built by `extractLeaves()` → flattens all groups into individual child accounts
- Each child carries: `gName` (parent group name), `gId` (parent group ID), `gTier`
- **This is what TodayTab, DealersTab, OutreachTab, AdminTab, DashTab, EstTab search against**

### `groups` (parent group list)  
- The raw group-level array with `.children[]` arrays
- **This is what GroupsTab searches against**
- Also used by DealersTab for group context lookups

### `groupedPrivates` (synthetic multi-dealer entities)
- Built in AccelerateApp — groups single-location practices that share an address across different dealers
- **Only appears in GroupsTab** under the "Private" filter

---

## 3. Search Paths — Current Behavior

### 3a. TodayTab Search

**Input**: `scored` (flat child list)
**Filter logic** (line 307-317):
```
scored.filter(a =>
  a.name?.toLowerCase().includes(q) ||
  a.city?.toLowerCase().includes(q) ||
  a.st?.toLowerCase().includes(q) ||
  a.addr?.toLowerCase().includes(q) ||
  a.gName?.toLowerCase().includes(q) ||
  (a.city && a.st && `${a.city} ${a.st}`.toLowerCase().includes(q))
)
```

**What it returns**: Individual child accounts. Searching "abra dental" returns all children whose `name` OR `gName` matches.

**Navigation on tap**: `goSmartFn` — if the child belongs to a multi-location group, navigates to **GroupDetail** (parent view). If single-location, navigates to **AcctDetail** (child view).

**Identity display**: `<AccountId name={a.name} gName={a.gName}/>` — shows child name as primary, parent group name as secondary line with `↳` prefix.

**Issues found**:
1. Searching "abra dental" matches on `gName` and returns individual children, but each result looks like a standalone account. There is no visual indication that multiple results belong to the same parent, and no way to see the parent group directly from search results.
2. If a child's `name` field is empty or is the raw Master-CM ID (due to data quality issues), it renders as-is. No fallback to parent name or "Unknown Office".
3. The `gName` match means searching a parent name returns N individual children rather than one parent card — creating confusion about what entity you're looking at.
4. PY/CY numbers shown are the **child's** individual numbers, not the parent group total. This is correct for a child search but misleading when the user searched by parent name and expects parent-level totals.

### 3b. GroupsTab Search

**Input**: `groups` (parent group list) + `groupedPrivates`
**Filter logic** (line 161-167):
```
enriched.filter(g =>
  fixGroupName(g).toLowerCase().includes(q) ||
  g.name.toLowerCase().includes(q) ||
  g.children?.some(c => c.name.toLowerCase().includes(q))
)
```

**What it returns**: Parent group entities. Searching "abra dental" returns the ABRA DENTAL group card.

**Navigation on tap**: `goGroupFn` → always navigates to **GroupDetail**.

**Identity display**: `fixGroupName(g)` as the primary name. Shows `_locs`, `_py1`, `_cy1`, `_gap`, `_ret` — all parent-level aggregated numbers.

**Issues found**:
1. Searching a child name (e.g., "All About Kids Pediatric Dentistry") returns the parent group because of the `g.children?.some(c => c.name.includes(q))` clause. This is actually good behavior — but it's inconsistent with TodayTab which would return the child directly.
2. No loc count is shown on the group card in search results (this was the bug from the reverted Step 4).
3. Dealer-parent filtering: When a dealer filter (Schein/Patterson/Benco/Darby) is active, the search still returns the full parent group but the numbers are recalculated for that dealer's children only via `isDealerFilt` logic. This is correct but not labeled — the user sees "ABRA DENTAL $X gap" without knowing it's the Schein-only view.

### 3c. DealersTab — No Direct Search

**Input**: `scored` (flat child list)
**No search bar** — accounts are organized by dealer, then shown in a co-call planner.

**Navigation on tap**: `goAcctFn` (NOT `goSmartFn`) — always navigates directly to **AcctDetail**, even for multi-location group members.

**Identity display**: `<AccountId name={a.name}/>` (no `gName` prop!) — so the parent line never appears. Multi-location context is shown separately via a hardcoded `↳ {a.gName} · {gLocs} locs` line underneath.

**Issues found**:
1. DealersTab uses `goAcctFn` while TodayTab uses `goSmartFn`. This means tapping the same account in different tabs takes you to different views (AcctDetail vs GroupDetail). This is inconsistent.
2. The `AccountId` component is called without `gName`, so it renders differently than in TodayTab.
3. Multi-location context line is only shown for accounts where `parentGroup.children.length > 1` — correct, but uses a different visual pattern than AccountId's `↳` line.

### 3d. AcctDetail — Move-Group Search (Internal)

**Input**: `groups` (parent group list)
**Filter logic** (line 140-147):
```
groups.filter(g =>
  g.id !== acct.gId &&
  (g.name?.toLowerCase().includes(q) || fixGroupName(g).toLowerCase().includes(q))
)
```

**What it returns**: Parent groups (for the "move account to different group" feature). Does NOT search child names.

**No external user-facing impact** — this is an admin action inside AcctDetail.

### 3e. GroupDetail — No Search

**No search bar** — shows a fixed list of children for the displayed group.

**Navigation on child tap**: `goAcct` → navigates to AcctDetail with `from` set to the group (enables back navigation to GroupDetail).

### 3f. EstTab, DashTab, OutreachTab — No Search

These tabs don't have search functionality. EstTab and DashTab use `goSmartFn` for navigation. OutreachTab uses `scored` for its own AI-powered outreach selection.

---

## 4. Summary of Inconsistencies

### 4a. What Search Returns (Entity Type)

| Search Location | Searches Against | Returns | Tap Navigates To |
|----------------|-----------------|---------|------------------|
| TodayTab | `scored` (children) | Individual children | GroupDetail (if multi-loc) or AcctDetail (if single) |
| GroupsTab | `groups` (parents) | Parent groups | GroupDetail |
| DealersTab | N/A (no search) | Children (in co-call list) | AcctDetail (always) |
| AcctDetail move | `groups` (parents) | Parent groups | N/A (action, not navigation) |

**Core inconsistency**: TodayTab searches children but sometimes navigates to GroupDetail. GroupsTab searches parents and always navigates to GroupDetail. There's no way to search for a parent and get a parent-level result in TodayTab, and no way to search for a child and get a child-level result in GroupsTab.

### 4b. Navigation Function Inconsistency

| Tab | Navigation Function | Behavior |
|-----|-------------------|----------|
| TodayTab | `goSmartFn` | Multi-loc → GroupDetail, single → AcctDetail |
| GroupsTab | `goGroupFn` | Always → GroupDetail |
| DealersTab | `goAcctFn` | Always → AcctDetail |
| DashTab | `goSmartFn` | Same as TodayTab |
| EstTab | `goSmartFn` | Same as TodayTab |

**Core inconsistency**: DealersTab always goes to AcctDetail. The others use goSmartFn (which routes multi-loc to GroupDetail). A user tapping "ALL ABOUT KIDS" in the co-call planner gets AcctDetail; tapping the same name in TodayTab search gets GroupDetail.

### 4c. Identity Display Inconsistency

| Context | Component | Shows gName? | Shows locs? |
|---------|-----------|-------------|-------------|
| TodayTab search results | `AccountId` | Yes (↳ line) | No |
| TodayTab overdrive cards | `AccountId` | Yes (↳ line) | No |
| TodayTab protect section | Inline | Yes (if gName≠name) | No |
| GroupsTab cards | `fixGroupName()` | N/A (IS the parent) | Via subtitle |
| DealersTab co-call | `AccountId` (no gName) + separate line | Separate ↳ line | Yes (hardcoded) |
| GroupDetail children | Inline name | No | N/A |

### 4d. Data Shown

| Context | PY/CY Source | What Numbers Mean |
|---------|-------------|-------------------|
| TodayTab search | Child's individual `pyQ`/`cyQ` | Child-level revenue |
| GroupsTab cards | Parent's aggregated `pyQ`/`cyQ` (or dealer-filtered) | Group-level revenue |
| DealersTab co-call | Child's individual numbers | Child-level revenue |
| DealersTab co-call (group line) | Parent's aggregated numbers | Group-level revenue |

---

## 5. Recommended Shared Search Model

### Principle: Search should return the entity the user is looking for

When Ken searches "Abra Dental", he wants the **group** — the combined picture of all locations. When he searches "All About Kids Pediatric", he wants that **specific office**. The search should be smart enough to tell the difference.

### Proposed Model

**One search, three result types:**

1. **Exact child match** → return the child card  
   - User typed a child name that matches only one child
   - Card shows: child name, parent name (↳ line), child PY/CY, child address
   - Tap → AcctDetail (or goSmartFn for multi-loc → GroupDetail)

2. **Parent/group match** → return one parent card (not N children)  
   - User typed something that matches a group name (`gName` or `fixGroupName`)
   - Card shows: group name, loc count, group PY/CY, group gap/retention
   - Tap → GroupDetail

3. **Child name that also matches siblings** → return parent card with child highlighted  
   - User typed a child name, but that child belongs to a multi-loc group
   - Card shows: parent group card (like #2) with a note "includes {childName}"
   - Tap → GroupDetail (could scroll to that child)

**Dealer-parent**: Not a separate search result type. Dealer filtering is a **view mode** applied on top of GroupDetail, not a separate entity. When in a dealer-filtered context (GroupsTab dealer filter, DealersTab), the same parent card is shown but with dealer-filtered numbers.

### Proposed Navigation Model

| Result Type | Tap Destination |
|------------|-----------------|
| Child of single-loc group | AcctDetail |
| Child of multi-loc group | GroupDetail (with child context) |
| Parent group | GroupDetail |

This matches the existing `goSmartFn` behavior. **DealersTab should also use `goSmartFn`** instead of `goAcctFn`.

---

## 6. Lowest-Risk Implementation Path

### Step 1: Unify navigation (smallest change, biggest consistency win)
- Change DealersTab from `goAcctFn` to `goSmartFn` (1 line in AccelerateApp.tsx)
- Risk: Low. DealersTab co-call accounts that are multi-loc will now route to GroupDetail instead of AcctDetail. This is actually better UX since the user sees the full group picture.

### Step 2: Unify AccountId usage
- DealersTab co-call: pass `gName` to `AccountId` component (already available on the scored account)
- Remove the hardcoded `↳ {a.gName}` line that duplicates AccountId's behavior
- Risk: Low. Visual-only change.

### Step 3: Deduplicate TodayTab search results by parent
- When search matches on `gName`, group results by `gId` and show one parent-level card instead of N children
- Keep child-name matches as individual results
- Risk: Medium. Requires new rendering logic in TodayTab search results. Must handle edge cases like: what if search matches both a group name and unrelated children?

### Step 4: Add loc count to AccountId
- Extend `AccountId` to accept optional `locs` prop
- Show `↳ {gName} · {locs} locs` when locs > 1
- Risk: Low. Additive change to a shared component.

### Step 5: (Optional) Shared search utility
- Extract search filtering into `src/lib/search.ts` 
- Single function that takes `groups` + `scored` + query and returns typed results: `{type: 'child' | 'parent', entity, matchField}`
- Both TodayTab and GroupsTab use this
- Risk: Medium. Requires both tabs to adopt a shared result format.

### What NOT to do yet
- Do not merge TodayTab and GroupsTab search into one universal search bar
- Do not change GroupsTab's existing parent-level search (it already works correctly)
- Do not add a new "search all" tab
- Do not change the data pipeline (scored vs groups)

---

## 7. Files That Would Be Modified

| Step | Files | Lines Changed (est.) |
|------|-------|---------------------|
| 1 | AccelerateApp.tsx | 1 line (goAcctFn → goSmartFn) |
| 2 | DealersTab.tsx | ~5 lines |
| 3 | TodayTab.tsx | ~30-50 lines |
| 4 | primitives.tsx | ~5 lines, + callers |
| 5 | New file + TodayTab + GroupsTab | ~80-100 lines |

---

*End of audit. No code was changed. Next phase should implement Steps 1-2 first (low risk), then Step 3 if stable.*
