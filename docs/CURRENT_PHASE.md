# CURRENT PHASE -- accel-v7

## Active: Phase A16.1 -- AI Intel Stabilization / Operator Value Upgrade COMPLETE

### Baseline
A15.7 complete: Overlay write guard (ba5e307 / 6a853ca).

### What Was Done

**Problem**: AI Intel output in GroupDetail was hard to use for call prep:
- Hooks and Talking Points were separate sections with no clear priority ordering
- Contact role labels ("Office-level", "Owner / Lead Dr") were vague
- No competitive intel surface even though the API could return it
- No inline call/email actions on research contacts — had to save first
- No visual status indicator (open/closed/changed)
- saveResNotes produced a flat unformatted string

**Files Changed**

**`src/components/tabs/GroupDetail.tsx`** (commit `238ed1b`)
- `STATUS_PILL` constant: Open/Closed/Changed/Unknown colored pill next to "Group Intel" header
- `SCOPE_LABELS` fixed: "Decision Maker" / "Practice Manager" / "Regional / DSO" / "Coordinator"
  (was: "Owner / Lead Dr" / "Office-level" / "Group / Regional" / "Coordinator")
- `SCOPE_COLORS_KEYS` updated: tier-2 now uses `blue` instead of `t3` for better visibility
- **Competitive Signal block**: amber-highlighted panel appears when API returns `competitive` field
- **Decision Maker contact highlight**: tier-1 contacts get cyan border + tinted bg — stands out immediately
- **Inline Call/Email actions**: 📞 phone and ✉ email are tappable links on research contacts — no save required
- **"Call Prep" section**: merged Hooks + Talking Points into one prioritized view
  - Numbered talking points shown first (these are `callPrep` — high-signal, specific)
  - Hooks shown below as "Also worth mentioning" (lighter signals)
- **`saveResNotes`** improved: saves numbered call prep + hooks + competitive intel as a clean formatted block

**`src/app/api/deep-research/route.ts`** (commit `5a6edad4`)
- System prompt: added recency emphasis — "a practice that recently expanded… is a hot opportunity"
- New `callPrep` JSON field: 3-4 highly specific, non-generic call-prep sentences for the first 60 seconds
- `competitive` field instruction strengthened: asks for specific brand names (Dentsply, 3M, Ivoclar, Envista, etc.)
- `callPrep` merged server-side into `talkingPoints` for backward compat with any cached results
- Generic talking points explicitly called out as useless in the prompt — model told to skip them

### What Was Preserved
- Review-and-save model intact: no silent auto-write, no autonomous actions
- Save contact / save website / add notes behavior unchanged
- Ghost locations logic unchanged
- Suggested merges / group matching unchanged
- All overlay persistence behavior unchanged

### Build
Passing — brace/paren delta = 0 on GroupDetail.tsx verified pre-commit.
deep-research/route.ts is TypeScript with `ignoreBuildErrors: true` — no build issues.

### Deploy
Live at https://accel-v7.vercel.app/accelerate — HTTP 200, `Competitive Signal` string
confirmed in deployed bundle.

---

## Previously Completed
- A15.7 -- Overlay Write Guard (ba5e307 / 6a853ca) complete
- A15.6 -- CPID Queue / Suggestion System Cleanup (8765324) complete
- A15.5 -- App Error Boundary / Crash Containment (a02d401) complete
- A15.4 -- Merge Source-of-Truth Cleanup (79d6d2d) complete
- A16 -- RFM Frequency Scoring (236d471) complete
- A15.3 -- Safe Group Merge Correctness (95b9ffd) complete
- A15.2 -- GitHub Large-File Load Reliability (ed29b63) complete
- A15-A1, Phases 1-23 complete

---

## Last Updated
March 26, 2026
