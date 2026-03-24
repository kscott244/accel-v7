# CURRENT PHASE — accel-v7

## Active: Phase 9 — Import Cleanup Pipeline ✅ Complete

### What Was Done (Phase 9)
1. **`src/lib/csv.ts` — full parser hardening**
   - `parseCSV` is now delimiter-aware: detects tab vs comma from unquoted char counts in header line
   - BOM (`\uFEFF`) stripped before any parsing so UTF-8 BOM exports don't poison the first header key
   - Windows CRLF (`\r\n`) handled in line splitting
   - Escaped double-quotes inside quoted fields (`""`) handled correctly
   - `buildHeaderMap()` — canonical header alias table: 20+ known Tableau column name variants (lowercase, no-space, alternate spellings) all resolve to the one name the pipeline expects. New exports with different casing or spacing work without code changes.
   - `coerceNumber()` — handles `$1,234`, `1,234.56`, `(500)` negatives, leading/trailing whitespace
   - `coerceDate()` — handles `M/D/YYYY`, `MM/DD/YYYY` (leading zeros), `M/D/YY` (2-digit year), `YYYY-MM-DD` (ISO)
   - `isJunkRow()` — catches all Tableau summary row patterns: blank rows, `Grand Total` / `Grand Total (All)` / any `parentName.startsWith("grand total")`, `Parent MDM ID === "Total"`, `Child Mdm Id === "Total"`
   - Warning accumulation now counts unknown tier occurrences (not just collects examples), so `ImportReport` count is accurate
   - All public API backward-compatible: `parseCSV`, `parseCSVLine`, `processCSVData` signatures unchanged

2. **`src/__tests__/csv.test.ts` — extended test coverage**
   - 37 tests (was 8) covering: encoding/BOM stripping, CRLF line endings, tab delimiter detection, header alias normalization, escaped quotes, `$`/`,`/`()` numeric coercion, ISO date format, `M/D/YYYY`, `MM/DD/YYYY`, junk row variants, ImportReport counters

### Completion Criteria — All Met ✅
- `npm run test` 69 tests passing (37 csv + 16 dataDiff + 16 scoring) ✅
- `npm run build` clean ✅
- No UI changes — zero impact on current app data flow ✅
- All public exports backward-compatible ✅

---

## Previously Completed: Phase 8 — Import Manager ✅ Complete

### What Was Done (Phase 8)
1. **`src/lib/csv.ts`** — Added `ImportReport` type + instrumented `processCSVData()` to return encoding/delimiter/row counts/entity stats/warnings
2. **`src/components/tabs/AdminTab.tsx`** — Replaced "💾 Data" section with Import Manager: File Stats, Cleanup Stats, Entity Output, Warnings sections
3. **`src/components/AccelerateApp.tsx`** — Pass filename + rawText to processCSVData, persist `import_report_v1` to localStorage

---

## Previously Completed: Phase 7 — Data Pipeline Upgrade ✅ Complete

### What Was Done (Phase 7)
1. **`src/lib/dataDiff.ts`** — `diffDatasets()` + `checkOverlayIntegrity()`
2. **CSV upload diff view** — shows added/removed/updated accounts + orphaned overlay refs on upload
3. **16 tests** in `src/__tests__/dataDiff.test.ts`

---

## Previously Completed: Phase 6 — Foundation Hardening ✅ Complete
- Fixed all 18 TypeScript errors, fixed runtime bug in AcctDetail, installed Jest + 34 tests, fixed overlay data-loss vulnerability

## Previously Completed: Phases 1–5 ✅
- Foundation audit, stabilize, decompose monolith, extract tabs

---

## Last Updated
March 24, 2026
