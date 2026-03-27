// ─── OVERLAY PATCH OPERATIONS ────────────────────────────────────────────────
// Defines typed patch operations for atomic overlay saves.
// The save-overlay API reads the CURRENT overlay from GitHub, applies these
// operations, validates integrity, and writes back. The client never sends
// a full overlay — only the specific changes.
//
// This eliminates the stale-data-stomping bug where a client with cached
// overlay data overwrites fixes applied directly on GitHub.

// ─── OPERATION TYPES ────────────────────────────────────────────────────────

export type OverlayOp =
  // Set a key within a top-level object section (groups, contacts, nameOverrides, etc.)
  // path: "groups.Master-CM047997" or "contacts.Master-CM123"
  | { op: "set"; path: string; value: any }

  // Delete a key from a top-level object section
  // path: "groups.Master-CM047997" or "nameOverrides.Master-CM123"
  | { op: "delete"; path: string }

  // Replace an entire top-level section (for sections that are plain objects)
  // e.g., { op: "replaceSection", section: "dealerManualReps", value: {...} }
  | { op: "replaceSection"; section: string; value: any }

  // Push to groupDetaches array (replaces existing entry with same childId)
  | { op: "pushDetach"; value: any }

  // Remove from groupDetaches by childId
  | { op: "removeDetach"; childId: string }

  // Add IDs to skippedCpidIds (deduped)
  | { op: "addSkippedCpidIds"; ids: string[] }

// ─── OPERATION APPLICATOR ───────────────────────────────────────────────────
// Applies an array of operations to an overlay object (mutates in place).

export function applyOps(overlay: any, ops: OverlayOp[]): any {
  for (const op of ops) {
    switch (op.op) {
      case "set": {
        const dotIdx = op.path.indexOf(".");
        if (dotIdx === -1) {
          // Top-level set (rare but handle it)
          overlay[op.path] = op.value;
        } else {
          const section = op.path.slice(0, dotIdx);
          const key = op.path.slice(dotIdx + 1);
          if (!overlay[section] || typeof overlay[section] !== "object") {
            overlay[section] = {};
          }
          overlay[section][key] = op.value;
        }
        break;
      }

      case "delete": {
        const dotIdx = op.path.indexOf(".");
        if (dotIdx === -1) {
          delete overlay[op.path];
        } else {
          const section = op.path.slice(0, dotIdx);
          const key = op.path.slice(dotIdx + 1);
          if (overlay[section] && typeof overlay[section] === "object") {
            delete overlay[section][key];
          }
        }
        break;
      }

      case "replaceSection": {
        overlay[op.section] = op.value;
        break;
      }

      case "pushDetach": {
        if (!Array.isArray(overlay.groupDetaches)) overlay.groupDetaches = [];
        // Replace existing entry with same childId, or push new
        const childId = op.value?.childId;
        if (childId) {
          overlay.groupDetaches = overlay.groupDetaches.filter(
            (d: any) => d.childId !== childId
          );
        }
        overlay.groupDetaches.push(op.value);
        break;
      }

      case "removeDetach": {
        if (Array.isArray(overlay.groupDetaches)) {
          overlay.groupDetaches = overlay.groupDetaches.filter(
            (d: any) => d.childId !== op.childId
          );
        }
        break;
      }

      case "addSkippedCpidIds": {
        if (!Array.isArray(overlay.skippedCpidIds)) overlay.skippedCpidIds = [];
        const existing = new Set(overlay.skippedCpidIds);
        for (const id of op.ids) {
          if (!existing.has(id)) {
            overlay.skippedCpidIds.push(id);
            existing.add(id);
          }
        }
        break;
      }
    }
  }
  return overlay;
}

// ─── INTEGRITY VALIDATION ───────────────────────────────────────────────────

export interface IntegrityViolation {
  code: "PARENT_AS_CHILD" | "DUPLICATE_CHILD" | "DETACH_REMERGE" | "CROSS_ORG_ABSORB";
  severity: "block" | "warn";
  groupId: string;
  groupName: string;
  childId: string;
  detail: string;
}

// Fuzzy name matching — strips honorifics, suffixes, normalizes
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
  if (na.includes(nb) || nb.includes(na)) return true;
  return false;
}

// Full overlay integrity check against base groups
export function validateOverlayIntegrity(
  baseGroups: any[],
  overlay: any
): { violations: IntegrityViolation[]; blocked: boolean } {
  const violations: IntegrityViolation[] = [];

  const baseGroupById: Record<string, any> = {};
  for (const g of baseGroups) {
    baseGroupById[g.id] = g;
  }

  const overlayGroups = overlay.groups || {};
  const detachedChildIds = new Set<string>();
  (overlay.groupDetaches || []).forEach((d: any) => {
    detachedChildIds.add(d.childId);
  });

  const childIdToOverlayGroup: Record<string, string> = {};

  for (const [gId, g] of Object.entries(overlayGroups) as [string, any][]) {
    const gName = g.name || gId;
    const childIds: string[] = g.childIds || [];

    for (const cid of childIds) {
      // Check 1: Is this childId a parent of a base group with 3+ children?
      const baseGroup = baseGroupById[cid];
      if (baseGroup && cid !== gId) {
        const baseChildCount = (baseGroup.children || []).length;
        const baseName = baseGroup.name || "";

        if (baseChildCount >= 3) {
          violations.push({
            code: "PARENT_AS_CHILD",
            severity: "block",
            groupId: gId, groupName: gName, childId: cid,
            detail: `"${gName}" claims ${cid} as child, but it's parent of "${baseName}" (${baseChildCount} children). Would absorb entire org.`,
          });
        } else if (baseChildCount >= 1 && !namesMatch(gName, baseName)) {
          violations.push({
            code: "CROSS_ORG_ABSORB",
            severity: "warn",
            groupId: gId, groupName: gName, childId: cid,
            detail: `"${gName}" claims ${cid} which is base group "${baseName}" (${baseChildCount} children). Names don't match.`,
          });
        }
      }

      // Check 2: Duplicate child across overlay groups
      if (childIdToOverlayGroup[cid] && childIdToOverlayGroup[cid] !== gId) {
        violations.push({
          code: "DUPLICATE_CHILD",
          severity: "block",
          groupId: gId, groupName: gName, childId: cid,
          detail: `${cid} claimed by both "${gName}" (${gId}) and "${childIdToOverlayGroup[cid]}".`,
        });
      }
      childIdToOverlayGroup[cid] = gId;

      // Check 3: Detached account re-merged
      if (detachedChildIds.has(cid)) {
        violations.push({
          code: "DETACH_REMERGE",
          severity: "block",
          groupId: gId, groupName: gName, childId: cid,
          detail: `${cid} was explicitly detached but appears in "${gName}".`,
        });
      }
    }
  }

  return {
    violations,
    blocked: violations.some(v => v.severity === "block"),
  };
}
