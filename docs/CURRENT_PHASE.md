# CURRENT PHASE -- accel-v7

## Active: Phase 2 — Contact Intelligence Layer — March 29, 2026

### What Was Built

Contacts are now a first-class intelligence layer. Deterministic only — no fake data.

**Commits:**
- `a4dece1a` — types/index.ts: Contact type with source, confidence, isPrimary, linkedGroupId
- `8f592bbf` — lib/contacts.ts: intelligence lib — bestContact(), contactGaps(), bestPathIn(), migrateLegacyContact(), buildContact()
- `38571696` — GroupDetail.tsx: wire contacts lib — typed Contact[], migrate legacy data on load, buildContact() for saves
- `a00c7eae` — GroupDetail.tsx: UI — PRIMARY badge, confidence badges (Verified/Stale/AI), confidence picker in modal, Primary toggle in modal

### Contact Model

Overlay path: overlays.groupContacts[groupId] = Contact[]

| Field | Type | Notes |
|---|---|---|
| id | number | timestamp-based |
| linkedGroupId | string | Master-CM# |
| name | string | |
| role | string | |
| phone | string | |
| email | string | |
| notes | string | |
| source | ContactSource | manual / research / badger / csv / unknown |
| confidence | ContactConfidence | verified / likely / unverified / stale |
| isPrimary | boolean | best known path into account |
| savedAt | string | ISO date |
| verifiedAt | string? | ISO date — when Ken last confirmed current |

### Intelligence Functions (src/lib/contacts.ts)

- **bestContact(contacts)** — returns the highest-scored contact (primary first, then conf × source × phone/email)
- **contactGaps(contacts)** — returns: hasAnyContact, hasPrimaryContact, missingPhone, missingEmail, hasMultiple, staleOnly, unverifiedOnly
- **bestPathIn(contacts, hasFscRep)** → PathIn enum: direct-phone / direct-email / dealer-led / office-visit / stale-verify
- **migrateLegacyContact(raw, groupId)** — upgrades old {name,role,phone,email} to full Contact on load
- **buildContact(fields, groupId, id?)** — constructs a Contact from form data

### UI Changes (GroupDetail.tsx)

- Contacts section header now shows best path badge (📞 Direct / ✉ Email / 🤝 Via Rep / 🚪 Walk In / ⚠ Verify)
- Contact cards: ★ PRIMARY badge, ✓ Verified badge, Stale warning, AI source label
- Empty state: clear message + icon when no contacts
- Add/Edit modal: Confidence pill picker (Unverified / Likely / Verified / Stale) + Primary toggle
- saveContact enforces single primary (demotes all others when isPrimary is set)
- saveResContact now tags source=research, confidence=likely

### Persistence

- Overlay path unchanged: overlays.groupContacts[groupId]
- Legacy contact data migrated on load via migrateLegacyContact() — backward compatible
- No new overlay sections required

### What Was NOT Changed

- No AccelerateApp.tsx changes
- No overlay/CSV separation work
- No event logging
- No assistant inbox

---

## Previously Completed

- Phase 1 — War Room consistency cleanup (March 29, 2026)
- War Room inclusion expansion (March 28, 2026)
- DSO War Room baseline (A16)

## Last Updated

March 29, 2026
