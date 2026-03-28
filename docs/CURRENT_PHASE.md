# CURRENT PHASE -- accel-v7

## Status: Pricing tab rebuilt. Territory content moved. Ready to build.

### Phase — Pricing Tab Rebuild — March 28, 2026

**Commits:**
- `055ed233` — PricingTab (DashTab.tsx): Quick Credit + SKU Lookup + Quote placeholder
- `ad0adadf` — TerritoryTab: attainment, tier revenue, top groups, gap leaderboard
- `98305890` — App: wire both tabs, Territory in More menu

**Deploy:** HTTP 200 ✅

---

**What changed:**

**Pricing tab — now three focused tools only:**

1. **Quick Credit** — enter any order amount, see your credited revenue at every tier simultaneously (Silver/Gold/Platinum/Diamond/Std). No product needed. Uses ~55% blended wholesale rate. Designed for use right after a call — "I just got a $5K order, what did I credit?"

2. **SKU Pricing Lookup** — search by SKU# or product name, get a clean pricing table showing MSRP and wholesale at every tier. Designed for in-front-of-doctor or distributor-rep use. Turn the phone around and show them the price.

3. **Quote Builder** — placeholder, clearly labeled "Coming Soon" with a description of what it will do (pull stopped products, apply tier pricing, generate a suggested reorder). Space is claimed, nothing is broken.

**Territory tab — in More menu:**
All the dashboard content that was on the Pricing tab moved here intact:
- CY revenue + attainment bar
- Revenue by tier breakdown
- Top 5 groups by CY
- Gap leaderboard (top 10 recovery targets, tappable → AcctDetail)

Nothing was deleted — just reorganized. Territory is now one tap from the More menu.

---

## Previously Completed
- Phase 12 — Territory Copilot Knowledge Layer
- Phase 11 — AI Query Copilot
- Phase 10 — Action-Hub Polish
- Phase 9 — Feel Factor
- Phase 8 — Tasks operating layer

## Last Updated
March 28, 2026
