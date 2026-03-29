# CURRENT PHASE -- accel-v7

## Active: Phase 4 — Daily Success Plan — March 29, 2026

### What Was Built

A deterministic daily prioritization engine that ranks the best actions for today
using revenue signals, contact readiness, account memory, and task urgency.
No AI calls. No hallucinated actions. Every recommendation is grounded in real data.

**Build fix included:** Repaired Phase 3 saveResNotes broken string literals (build was failing).

**Commits:**
- `74fd40bf` — fix(build): repair Phase 3 saveResNotes broken string literals
- `c9642263` — feat(plan): add dailyPlan.ts scoring engine
- `756514c4` — feat(plan): inject Daily Success Plan section into TodayTab
- `e8b66ef2` — feat(plan): pass overlays to DashboardTab

### Scoring Engine — src/lib/dailyPlan.ts

**Ranking signals (combined score 0–100):**

| Signal | Max Points | Notes |
|---|---|---|
| Revenue gap vs PY | 35 | >5K=35, >2K=25, >800=15 |
| Retention cliff | 20 | <30%=20, <50%=12, <70%=6 |
| Account size | 15 | PY >10K=15, >5K=10, >2K=5 |
| Contact readiness | 12 | Has contact+not stale=12, stale=4, none=2 |
| Overdue task | 15 | Any overdue task on this group |
| Pinned in War Room | 12 | intel.pinned=true |
| Going cold | 8 | 14–60 days since last action |
| DSO multi-site bonus | 8 | class2 DSO + 3+ locations |
| Never touched | 5 | >60d no action, >30d no view, PY>1K |
| Dealer-led path | -3 | Slight deprioritize vs direct contact |

**Minimum bar:** Group must have PY >= 00 or CY >= 00 to appear.

### Action Types Output

| Action | When |
|---|---|
| 📞 Call | Direct phone on file, contact not stale |
| ✉ Email | Email only, no phone |
| 🚪 Visit | No contact at all |
| 🤝 Via Rep | No direct contact, FSC rep linked |
| ⚠ Verify Contact | All contacts are stale |
| 🔍 Research First | No contact on file at all |
| 📋 Follow Up | Overdue task exists |
| 💰 Review Pricing | (reserved for future tier mismatch detection) |

### Per-Item Output

Each plan item shows:
- Group name
- Action type badge + why it matters today
- Best contact name + phone if available
- Path label (📞 Direct, 🤝 Via Rep, etc.)
- Signal tags (e.g. "-12K vs PY", "Overdue task", "Going cold")
- Go → button to open the group directly

### Where It Appears

Top of TodayTab, above the action lists, below the KPI hero.
Section label: **Today's Plan** · max 5 items · hidden if no groups qualify.

### What Was NOT Changed

- No AccelerateApp.tsx broad changes
- No overlay/CSV persistence changes
- No autonomous actions
- No AI calls in the plan engine

---

## Previously Completed

- Phase 3 — Event Logging + Account Memory (March 29, 2026)
- Phase 2 — Contact Intelligence Layer (March 29, 2026)
- Phase 1 — War Room consistency cleanup (March 29, 2026)

## Last Updated

March 29, 2026
