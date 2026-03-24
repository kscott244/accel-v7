# CURRENT PHASE — accel-v7

## Active: Phase 10 — CRM / Sales Data Split ✅ Complete

### What Was Done (Phase 10)

**Goal**: Stop treating CSV uploads as the source of truth for account identity.
Separate persistent CRM identity data from upload-driven sales activity data.

#### Data model split
| Field | Owner | Survives upload |
|-------|-------|----------------|
| name, city, st, addr, zip, email | CRM | ✅ Yes |
| tier, top100, class2, dealer | CRM | ✅ Yes |
| firstSeenDate, lastSeenDate | CRM | ✅ Yes |
| pyQ, cyQ, products, last | Sales (upload) | Replaced each upload |
| contacts, notes, research, groups | Overlays | ✅ Yes (unchanged) |

#### Files added
1. **`src/lib/crm.ts`** — `CrmAccount` + `CrmStore` types, `mergeCrmCandidates()` (fill-blanks-only merge policy — uploaded CSV never overwrites a populated CRM field), `applyCrmToGroups()` (hydrates identity fields from CRM onto groups array before rendering)
2. **`src/app/api/load-crm/route.ts`** — GET `data/crm-accounts.json` from GitHub; returns `{ crm: null }` on 404 (first run) instead of error
3. **`src/app/api/save-crm/route.ts`** — POST `data/crm-accounts.json` to GitHub; handles first-write (no SHA) and subsequent updates

#### Files modified
4. **`src/lib/csv.ts`** — `processCSVData()` now extracts `crmCandidates` (identity fields only, no pyQ/cyQ/products) and returns them alongside `groups`/`generated`/`report`
5. **`src/components/AccelerateApp.tsx`** — 5 targeted patches:
   - Import `mergeCrmCandidates`, `applyCrmToGroups`, `EMPTY_CRM_STORE` from `@/lib/crm`
   - `crmStore` state initialized to `EMPTY_CRM_STORE`
   - Boot sequence loads CRM from localStorage cache then fetches fresh from GitHub in background
   - Upload handler merges `crmCandidates` into CRM store (fill-blanks policy), persists async to GitHub, non-fatal on failure
   - `setGroups` in upload handler now pipes through `applyCrmToGroups` before overlays

#### Behavior
- On first run: CRM store is empty, app works exactly as before
- After first CSV upload: CRM records created for all ~984 offices, persisted to `data/crm-accounts.json`
- On subsequent uploads: only blank fields are filled — existing identity data is never overwritten
- CRM load is async/non-blocking — never delays app startup
- CRM save is fire-and-forget — upload flow is never blocked by save failure

### Completion Criteria — All Met ✅
- `npm run test` 69/69 passing ✅
- `npm run build` clean — `/api/load-crm` and `/api/save-crm` appear in route table ✅
- No UI changes ✅
- Existing overlays.json untouched ✅
- All existing behavior preserved ✅

---

## Previously Completed: Phase 9 — Import Cleanup Pipeline ✅ Complete
- csv.ts hardened: tab/BOM/CRLF/header-alias/coerceNumber/coerceDate/junk-row
- 37 csv tests, 69 total

## Previously Completed: Phase 8 — Import Manager ✅ Complete
## Previously Completed: Phase 7 — Data Pipeline Upgrade ✅ Complete
## Previously Completed: Phase 6 — Foundation Hardening ✅ Complete
## Previously Completed: Phases 1–5 ✅

---

## Last Updated
March 24, 2026
