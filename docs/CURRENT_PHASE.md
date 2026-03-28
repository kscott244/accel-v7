# CURRENT PHASE -- accel-v7

## Status: AI Query Copilot live. Ready to build.

### Phase 11: In-App AI Query Copilot — March 28, 2026

**Commits:**
- `acf3ec8a` — API route: /api/ask-copilot (intent parsing via Haiku)
- `d14a5697` — CopilotPanel component
- `fd802cf0` — App: Ask button in nav, CopilotPanel wired

**Deploy:** HTTP 200 ✅

**Architecture — grounded, not generative:**

The system is intentionally split into two layers to prevent hallucination:

1. **Intent layer (LLM)** — Haiku receives only the user's question and a structured prompt. It returns a JSON command (e.g. `{type:"rank", metric:"cy1", product:"SIMPLISHADE", limit:5}`). It never sees actual account data and never produces numbers.

2. **Execution layer (client-side)** — The JSON command is executed against the real in-memory `scored` accounts array. All filtering, sorting, and aggregation uses actual loaded data. The LLM cannot fabricate results.

**Supported query types:**

- **RANK** — "Who's my top SimpliShade account?" → sorts accounts by CY spend on that product
- **FILTER** — "Which accounts buy bond but not composite?" → filters by product presence/absence
- **FOLLOW_UP** — "Who's gone dark?" → filters by last-order days, gap, retention
- **OPPORTUNITY** — "Best MaxCem win-back?" → finds accounts with PY spend but zero CY
- **UNKNOWN** — returns a clear "couldn't understand" message, never guesses

**Product synonym handling (in the LLM prompt):**
- "bond" / "bonding agent" → OPTIBOND
- "composite" / "comp" → [HARMONIZE, SIMPLISHADE, SONICFILL]
- "cement" → MAXCEM
- "curing light" → DEMI
- Partials: "simplishade", "sonicfill", "maxcem" → uppercased and matched

**Entry point:**
- ✦ Ask button added to the bottom nav (between Dealers and More)
- Opens a slide-up panel — no new tab, no navigation disruption
- Results are tappable — tap any account to navigate to AcctDetail

**What it cannot do (by design):**
- Cannot answer questions about data not in the app (external prices, competitor data)
- Cannot produce numbers it didn't derive from the actual account records
- Cannot answer questions about specific dates or calendar events
- Returns "No accounts match" rather than inventing results

---

## Previously Completed
- Phase 10 — Action-Hub Polish (call in header, locations collapse, feel fix)
- Phase 9 — Feel Factor (office-level, Cold/Warm/Hot)
- Phase 8 — Tasks operating layer
- Phase 7 — Route with Intent
- Phase 6 — DealersTab Channel Console
- Phase 5 — GroupsTab Territory Navigator

## Last Updated
March 28, 2026
