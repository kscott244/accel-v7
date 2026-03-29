# CURRENT PHASE -- accel-v7

## Active: Phase 8 -- Targeted Research Queue + Contact Enrichment COMPLETE

### What Was Done

**Goal**: Selective, high-value research loop that uses sales signals to pick accounts worth researching, enriches them with outside intelligence, and feeds findings back into the app.

### 1. Research Queue Model (`src/lib/researchQueue.ts`)
- `ResearchCandidate` — id, groupId, groupName, reasonForResearch, opportunityType, priority, status, createdAt, completedAt, confidence, findingsSummary, suggestedNextMove, contactsFound, suggestedLinkages
- `EnrichedContact` — name, role, email, phone, website, source, confidence, linkedGroupId, notes, savedAt
- `SuggestedLinkage` — suggestedGroupName, suggestedAddress, reason, confidence, reviewed

### 2. Queue Selection Signals
Queue is small (max 6 candidates). Selection rules:
- **High gap + no contact** (>$2K gap, no contacts, not researched in 14d) → critical/high
- **Cross-sell opportunity** (buying 1-2 families, missing 2+ key families, >$1.5K PY) → high/medium
- **Gone dark** (>$1.5K PY, $0 CY, need status check) → high/medium
- **Strategic DSO** (DSO with 3+ locs, >$3K FY, no contacts) → critical/high
- **Multi-loc no intel** (3+ locs, >$2K FY, no group intel) → medium
- **Stale high-value** (>$5K FY, stale/unverified contacts, no action 60+d) → high/medium

All rules check `lastResearchedDays` to avoid re-researching recently covered accounts. Completed/dismissed candidates are excluded from future queues.

### 3. Research Execution
- Triggers existing `/api/deep-research` API (Claude + web search)
- `mergeResearchFindings()` transforms raw API results into structured candidate findings
- Contacts auto-saved to `overlays.groupContacts` (existing contact system)
- Queue state saved to `overlays.researchQueue`

### 4. Confidence Handling
Three explicit levels: **high** / **medium** / **low**
- High: phone AND email found for a contact
- Medium: phone OR email found
- Low: name only, no actionable channel
- Color-coded badges on every finding and contact

### 5. Suggested Linkages
When deep-research finds multiple locations for a practice:
- Surfaced as "Possible Linked Locations" with amber styling
- Each shows name, address, reason, confidence badge
- Marked as `reviewed: false` — no auto-merge
- Ken reviews and decides whether to link

### 6. Research Output Feeds Into
- **Contact Intelligence** — contacts auto-saved to groupContacts overlay
- **Accounts / GroupDetail** — contacts visible on group detail view
- **War Room** — DSO contacts now available for strategy
- **Assistant Inbox** — inbox reads groupContacts, enriched data improves recommendations
- **Daily Plan** — contact path quality improves plan action types

### 7. UI Surface (`src/components/tabs/ResearchTab.tsx`)
Accessible via More → Work → Research
- **Queue view**: pending candidates with priority badges, opportunity type, revenue data
- **Completed view**: findings with confidence badges, enriched contacts with tap-to-call/email, suggested linkages, suggested next move
- Expandable cards with data grid (gap, contact status, last research)
- "Research Now" button triggers deep-research API
- "Skip" button dismisses candidates
- "Open →" navigates to group detail

### 8. Scope Limits Enforced
- Max 6 candidates per queue cycle
- No auto-merge of accounts
- No auto-send of emails
- No invented contacts — all from web search via deep-research API
- Confidence explicitly labeled on every finding
- Findings are suggestions, not actions

### Files Changed
- `src/lib/researchQueue.ts` — NEW: queue model, builder, merge logic
- `src/components/tabs/ResearchTab.tsx` — NEW: UI component
- `src/components/AccelerateApp.tsx` — Import + tab rendering + More menu entry
- `docs/CURRENT_PHASE.md` — This file

### Previously Completed
- Phase 7 -- Navigation + Today Intelligence Cleanup (2b08d86)
- TodayTab ternary fix (a60dd8dbdf09)

## Last Updated
March 29, 2026
