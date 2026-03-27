// ─── OVERLAY INTEGRITY VALIDATION ────────────────────────────────────────────
// Shared validation logic used by:
//   - /api/save-overlay (server-side guard)
//   - AdminTab / client-side merge UI (pre-save check)
//   - overlayIntegrity.test.ts (automated audit)
//
// Prevents the class of bugs where a parent CM of a large org gets absorbed
// as a childId of another overlay group, silently dragging in the whole org.

export interface IntegrityViolation {
  code: "PARENT_AS_CHILD" | "DUPLICATE_CHILD" | "DETACH_REMERGE" | "CROSS_ORG_ABSORB";
  severity: "block" | "warn";
  groupId: string;
  groupName: string;
  childId: string;
  detail: string;
}

export interface IntegrityReport {
  violations: IntegrityViolation[];
  blocked: boolean;
}

// ─── Fuzzy name matching ────────────────────────────────────────────────────
// Strips punctuation, honorifics, suffixes, and normalizes for comparison.
// "DR. HELENE STRAZZA" ≈ "HELENE STRAZZA" ≈ "helene strazza"

function normName(raw: string): string {
  return (raw || "")
    .toUpperCase()
    .replace(/[.,;:'"!?()#\-]/g, "")
    .replace(/\b(DR|DDS|DMD|MD|PC|LLC|INC|PLLC|PA|OFC OF|OFFICE OF)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function namesMatch(a: string, b: string): boolean {
  const na = normName(a);
  const nb = normName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // One contains the other (handles "BARNUM DENTAL" vs "BARNUM DENTAL GROUP")
  if (na.includes(nb) || nb.includes(na)) return true;
  return false;
}

// ─── MAIN VALIDATION ────────────────────────────────────────────────────────
// baseGroups: the groups array from preloaded-data (or processCSVData output)
// overlays: the full overlays object being validated
//
// Returns a report with all violations found. Callers decide whether to block.

export function validateOverlayIntegrity(
  baseGroups: any[],
  overlays: any
): IntegrityReport {
  const violations: IntegrityViolation[] = [];

  // Build lookup maps from base data
  const baseGroupById: Record<string, any> = {};
  const childToBaseGroup: Record<string, string> = {};

  for (const g of baseGroups) {
    baseGroupById[g.id] = g;
    for (const c of (g.children || [])) {
      childToBaseGroup[c.id] = g.id;
    }
  }

  const overlayGroups = overlays.groups || {};
  const detachedChildIds = new Set<string>();
  (overlays.groupDetaches || []).forEach((d: any) => {
    detachedChildIds.add(d.childId);
  });

  // Track all childIds across all overlay groups for duplicate detection
  const childIdToOverlayGroup: Record<string, string> = {};

  for (const [gId, g] of Object.entries(overlayGroups) as [string, any][]) {
    const gName = g.name || gId;
    const childIds: string[] = g.childIds || [];

    for (const cid of childIds) {
      // ── Check 1: Is this childId the PARENT ID of a base group with 3+ children?
      const baseGroup = baseGroupById[cid];
      if (baseGroup && cid !== gId) {
        const baseChildCount = (baseGroup.children || []).length;
        const baseName = baseGroup.name || "";

        if (baseChildCount >= 3) {
          // Large org absorbed — always block
          violations.push({
            code: "PARENT_AS_CHILD",
            severity: "block",
            groupId: gId,
            groupName: gName,
            childId: cid,
            detail: `"${gName}" claims ${cid} as a child, but ${cid} is the parent of base group "${baseName}" with ${baseChildCount} children. This would absorb an entire organization.`,
          });
        } else if (baseChildCount >= 1 && !namesMatch(gName, baseName)) {
          // Small group with different name — suspicious but smaller risk
          violations.push({
            code: "CROSS_ORG_ABSORB",
            severity: "warn",
            groupId: gId,
            groupName: gName,
            childId: cid,
            detail: `"${gName}" claims ${cid} which is base group "${baseName}" (${baseChildCount} children). Names don't match — possibly a cross-org merge.`,
          });
        }
        // If names match (same practice, different CM), it's a legit dealer-split merge — no violation
      }

      // ── Check 2: Does this childId appear in multiple overlay groups?
      if (childIdToOverlayGroup[cid] && childIdToOverlayGroup[cid] !== gId) {
        violations.push({
          code: "DUPLICATE_CHILD",
          severity: "block",
          groupId: gId,
          groupName: gName,
          childId: cid,
          detail: `${cid} claimed by both "${gName}" (${gId}) and overlay group "${childIdToOverlayGroup[cid]}". Same child in multiple overlay groups = conflict.`,
        });
      }
      childIdToOverlayGroup[cid] = gId;

      // ── Check 3: Is this childId in groupDetaches? Never re-merge detached accounts.
      if (detachedChildIds.has(cid)) {
        violations.push({
          code: "DETACH_REMERGE",
          severity: "block",
          groupId: gId,
          groupName: gName,
          childId: cid,
          detail: `${cid} was explicitly detached (in groupDetaches) but is now in overlay group "${gName}". Detached accounts must not be re-merged.`,
        });
      }
    }
  }

  return {
    violations,
    blocked: violations.some(v => v.severity === "block"),
  };
}

// ─── SINGLE-GROUP PRE-SAVE CHECK ─────────────────────────────────────────────
// Lightweight check for a single group being created/edited.
// Used by AdminTab before calling saveOverlays.

export function validateGroupChildIds(
  childIds: string[],
  groupId: string,
  groupName: string,
  baseGroups: any[],
  overlays: any
): IntegrityViolation[] {
  const violations: IntegrityViolation[] = [];

  const baseGroupById: Record<string, any> = {};
  for (const g of baseGroups) {
    baseGroupById[g.id] = g;
  }

  const detachedChildIds = new Set<string>();
  (overlays.groupDetaches || []).forEach((d: any) => {
    detachedChildIds.add(d.childId);
  });

  // Check childIds in OTHER overlay groups (not the one being edited)
  const otherGroupChildIds: Record<string, string> = {};
  for (const [gId, g] of Object.entries(overlays.groups || {}) as [string, any][]) {
    if (gId === groupId) continue;
    for (const cid of (g.childIds || [])) {
      otherGroupChildIds[cid] = gId;
    }
  }

  for (const cid of childIds) {
    // Parent-as-child check
    const baseGroup = baseGroupById[cid];
    if (baseGroup && cid !== groupId) {
      const count = (baseGroup.children || []).length;
      const baseName = baseGroup.name || "";
      if (count >= 3) {
        violations.push({
          code: "PARENT_AS_CHILD",
          severity: "block",
          groupId, groupName, childId: cid,
          detail: `Cannot add ${cid} — it's the parent of "${baseName}" with ${count} locations. This would absorb an entire org.`,
        });
      } else if (!namesMatch(groupName, baseName)) {
        violations.push({
          code: "CROSS_ORG_ABSORB",
          severity: "warn",
          groupId, groupName, childId: cid,
          detail: `${cid} is base group "${baseName}" (${count} loc). Names don't match — verify this is intentional.`,
        });
      }
    }

    // Duplicate across overlay groups
    if (otherGroupChildIds[cid]) {
      violations.push({
        code: "DUPLICATE_CHILD",
        severity: "block",
        groupId, groupName, childId: cid,
        detail: `${cid} is already in overlay group "${otherGroupChildIds[cid]}".`,
      });
    }

    // Detach re-merge
    if (detachedChildIds.has(cid)) {
      violations.push({
        code: "DETACH_REMERGE",
        severity: "block",
        groupId, groupName, childId: cid,
        detail: `${cid} was explicitly detached. Cannot re-merge.`,
      });
    }
  }

  return violations;
}
