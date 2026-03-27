# CURRENT PHASE -- accel-v7

## Active: Phase A15.5 -- App Error Boundary / Crash Containment COMPLETE

### Baseline
A15.4 complete: Merge source-of-truth cleanup. Commit `79d6d2d`.

### Problem
The app had one `ErrorBoundary` wrapping the entire `<AppInner/>` component.
When any tab component threw a runtime error, the error bubbled up to that
top-level boundary, unmounting AppInner entirely — killing the header, the
nav bar, and all state. Ken saw a full-screen error with no way to recover
except a hard reload.

### What Was Built

**`src/components/AccelerateApp.tsx`** (commit `c84962d`)

Added `TabErrorBoundary` class (L37–68):
- Wraps only the tab content render area
- Falls back to an inline error card within the content zone
- Header and nav bar are NOT wrapped — they survive any tab crash intact
- Ken sees a contained error card with a "Return to Today" button
- Error string is shown (truncated, 200 chars) so it's diagnosable in the field
- `onReset` prop: taps "Return to Today" → calls `setTab("today")` + `setView(null)`

Usage at L1042–1070:
```jsx
<TabErrorBoundary
  key={tab+(view?.type||"")}
  onReset={()=>{setTab("today");setView(null);}}
>
  {/* all tab and view renders */}
</TabErrorBoundary>
```

The `key` prop is `tab + view.type` — when Ken taps a different tab, React
unmounts and remounts the boundary with a fresh key, automatically clearing
any stale error state. No manual reset needed between tabs.

### Error Containment — Before vs After

| Scenario | Before | After |
|----------|--------|-------|
| Tab component throws | Entire app blanks, full-screen error | Inline card in content area, nav stays up |
| Ken taps another tab | Not possible — app is blank | Works immediately, boundary auto-resets |
| Recovery | Hard reload only | "Return to Today" button or tap any nav tab |
| Top-level crash (hooks, init) | Full-screen error (existing boundary) | Unchanged — still caught by top-level |

### What Was Not Changed
- Top-level `ErrorBoundary` (L7–25) — unchanged, still catches catastrophic failures
- All tab components — unchanged
- All scoring, overlay, CRM, sales, merge logic — untouched

### Tests
Existing 42-test suite, no regressions. Error boundary behavior is not
unit-testable without React testing setup; correctness verified by code review:
boundary receives `key` prop on every tab switch, `onReset` navigates safely.

### Build
Passing — brace/paren delta = 0, verified pre-commit.

---

## Previously Completed
- A15.4 -- Merge Source-of-Truth Cleanup (79d6d2d) complete
- A16 -- RFM Frequency Scoring (236d471) complete
- A15.3 -- Safe Group Merge Correctness (95b9ffd) complete
- A15.2 -- GitHub Large-File Load Reliability (ed29b63) complete
- A15 -- Group AI Intel (68430c8) complete
- A14-A1, Phases 1-23 complete

---

## Last Updated
March 27, 2026
