# AccelerateV7

Next.js + TypeScript dental territory sales dashboard. Deployed on Vercel.

## Key Files — Do Not Touch Without Asking
- `dealers.ts` — 8,236-entry mapping. Do not modify unless Ken says so.
- Tier logic — Std/Top100/House=0%, Silver=20%, Gold=24%, Plat=30%, Diamond=36%.
- Top100 is a spend rank, not a tier. Top100-Gold → strip prefix, use Gold.

## Business Logic
- Parent groups use Master-CM#. Children link via gId field.
- Same office can appear under multiple Master-CMs (different distributors).
- Acct Type reflects parent-distributor relationship, not the child.
- normalizeTier(), fixGroupName(), cleanParentName() handle edge cases.

## Rules
- One concern per change. No combined refactors.
- Match existing patterns. Check neighboring files first.
- All changes must pass `npm run build` before done.
- Commit messages: short, prefixed with phase (e.g., "P3: fix tier normalization").

## Current Phase
See PROJECT_SUMMARY.md or ask Ken what phase we're on.
