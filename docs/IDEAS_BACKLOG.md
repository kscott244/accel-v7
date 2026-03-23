# Accelerate v7 — Ideas Backlog

Captured from chat sessions. Organized by category. Not prioritized — see ROADMAP.md for phased plan.

---

## Selling Tools (directly helps close deals)

- [ ] **FSC Co-call Planner** — ✅ BUILT. Ranked co-call targets per distributor with gap, lost products, parent group context, copy-to-clipboard, Google Maps route.
- [ ] **Editable Week Route Planner** — replace static week-routes.json with Mon-Fri day buckets, drag accounts, one Maps link per day. High priority for Q2.
- [ ] **Tier Upgrade Tracker** — "These 8 accounts are $X from Silver." Show accounts near tier thresholds with the products that would push them over.
- [ ] **Pipeline / New Account Tracking** — zero-spend prospects are invisible. Need a way to add, track, and score prospective accounts.
- [ ] **Pre-call distributor brief** — AI-generated talking points for FSC meetings, aggregated by distributor.
- [ ] **Weekly Overdrive win archive / Monday reset** — archive completed Overdrive outcomes weekly so you can see progress over time.

## Data & Intelligence

- [ ] **Auto-regenerate Overdrive on CSV upload** — force refresh of scoring when new data is loaded.
- [ ] **60-day dark account auto-detection** — flag accounts that haven't ordered in 60+ days and surface them.
- [ ] **Overnight account health alerts** — background polling for changes, push notification or email digest.
- [ ] **Product cross-sell recommendations** — AI-driven: "this account buys Harmonize but not OptiBond — suggest pairing."

## Outreach & Communication

- [ ] **Gmail outreach** — ✅ BUILT. AI-generated emails with Kerr product intelligence, dealer-aware, batch send.
- [ ] **Deep Research contact hierarchy** — ✅ BUILT. Web search for contacts, auto-save to overlays.
- [ ] **Account-specific AI talking points** — ✅ BUILT (in Deep Research). Uses purchase data + web search.
- [ ] **Automated down-account email campaigns** — scheduled sends, not just manual queue.

## Admin & Data Quality

- [ ] **Duplicate review tool** — ✅ BUILT. Address-matched accounts across groups with merge/skip.
- [ ] **Group merge/duplicate analysis** — find groups that look like duplicates (similar names, overlapping addresses).
- [ ] **Search-based group creation** — ✅ BUILT. Search by name/city/address, tap to add, combined PY total.
- [ ] **Bulk dealer override** — assign/change dealer for multiple accounts at once.

## Architecture & Platform

- [ ] **Split AccelerateApp.tsx into component files** — Phase 3 in roadmap.
- [ ] **Replace static preloaded-data.ts with database** — Phase 4 in roadmap.
- [ ] **Persist manual adjustments to overlays** — Phase 2 in roadmap.
- [ ] **Remove legacy dead code** — Phase 2 in roadmap.
- [ ] **Multi-user support** — auth, per-user overlays, role-based access.
- [ ] **QBR / report export** — PDF or slide deck generation from territory data.
- [ ] **CRM integration** — Salesforce or HubSpot sync.

## UX & Polish

- [ ] **Consolidated nav** — ✅ DONE. 5 main tabs + More menu.
- [ ] **Shared AccountId component** — ✅ DONE. Child name + parent group in cyan, 14 locations.
- [ ] **Left border accent on group children** — ✅ DONE. Cyan stripe on co-call cards.
- [ ] **Event/CE tracking** — log lunch-and-learns, CE events, tie to accounts.
- [ ] **Offline mode** — service worker for full offline access.
- [ ] **Dark/light theme toggle** — currently dark-only.

---

*Last updated: March 22, 2026*
