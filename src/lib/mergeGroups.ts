// @ts-nocheck
// ─── PURE GROUP-CREATE / MERGE RESOLVER ──────────────────────────────────────
// Extracted from AccelerateApp.applyOverlays Step 4 so the merge logic can be
// unit-tested independently of React, OVERLAYS_REF, and BADGER.
//
// applyOverlays calls applyGroupCreates() passing its local state; the function
// is side-effect-free and returns a new groups array.

export interface GroupEntry {
  id: string;
  name: string;
  childIds: string[];
  tier?: string;
  class2?: string;
  dsoName?: string;
  source?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Apply overlay group-create/merge entries to a flat groups array.
 *
 * @param groups      Current top-level groups (from base data + prior overlay steps)
 * @param overlayGroups  OV.groups — user-authored merge/create entries keyed by group id
 * @param nameMap     OV.nameOverrides — optional name overrides
 * @returns New groups array with merges applied
 */
export function applyGroupCreates(
  groups: any[],
  overlayGroups: Record<string, any>,
  nameMap: Record<string, string> = {}
): any[] {
  let result = [...groups];

  // Step 4a: Build leafByChildId from ALL groups BEFORE removing anything.
  // Recurse up to 2 levels to find the richest (most products) version of each child.
  const leafByChildId: Record<string, any> = {};
  const updateLeaf = (id: string, candidate: any) => {
    const existing = leafByChildId[id];
    if (
      !existing ||
      (candidate.products || []).length > (existing.products || []).length ||
      (!existing.city && candidate.city)
    ) {
      leafByChildId[id] = candidate;
    }
  };
  result.forEach(g => {
    (g.children || []).forEach((c: any) => {
      if (c.children && c.children.length > 0) {
        c.children.forEach((leaf: any) => updateLeaf(c.id, leaf));
      } else {
        updateLeaf(c.id, c);
      }
    });
  });

  Object.values(overlayGroups || {}).forEach((create: any) => {
    const childIdSet = new Set(create.childIds || []);
    const children: any[] = [];
    let totalPY: Record<string, number> = {};
    let totalCY: Record<string, number> = {};

    // Step 4b: Capture source groups being merged (top-level groups whose id is in childIdSet),
    // then remove both the pre-existing baked group AND those source groups from result.
    const mergedSourceGroups = result.filter(g => childIdSet.has(g.id));
    result = result.filter(g => g.id !== create.id && !childIdSet.has(g.id));

    // Step 4c: Remove these childIds from wherever they currently live in result
    result = result.map(g => {
      const kept: any[] = [];
      (g.children || []).forEach((c: any) => {
        if (childIdSet.has(c.id)) return;
        if (c.children && c.children.some((gc: any) => childIdSet.has(gc.id))) return;
        kept.push(c);
      });
      return { ...g, children: kept, locs: kept.length };
    });

    // Step 4d: Build children array from leaf map.
    // Wrapper node = a child with its own c.children but no products.
    const flattenToLeaves = (node: any): any[] => {
      if (!node) return [];
      if (node.children && node.children.length > 0 && !(node.products?.length)) {
        return node.children.flatMap((gc: any) => flattenToLeaves(gc));
      }
      return [node];
    };

    const addedLeafIds = new Set<string>();
    const pushLeaf = (leaf: any) => {
      if (!leaf?.id || addedLeafIds.has(leaf.id)) return;
      addedLeafIds.add(leaf.id);
      children.push({ ...leaf, gId: create.id, gName: create.name });
    };

    (create.childIds || []).forEach((cid: string) => {
      const leaf = leafByChildId[cid];
      if (leaf) {
        flattenToLeaves({ ...leaf, id: cid }).forEach(pushLeaf);
      } else {
        // childId is a group ID — expand via mergedSourceGroups
        const srcGroup = mergedSourceGroups.find(g => g.id === cid);
        if (srcGroup?.children?.length) {
          srcGroup.children.flatMap((c: any) => flattenToLeaves(c)).forEach(pushLeaf);
        }
        // Truly unfound ids handled as stubs below
      }
    });

    // Roll up financials (preserves negative values)
    children.forEach((c: any) => {
      Object.entries(c.pyQ || {}).forEach(([q, v]: any) => { totalPY[q] = (totalPY[q] || 0) + v; });
      Object.entries(c.cyQ || {}).forEach(([q, v]: any) => { totalCY[q] = (totalCY[q] || 0) + v; });
    });

    // Add truly unfound childIds as stubs
    (create.childIds || []).forEach((cid: string) => {
      if (!children.find(c => c.id === cid) && !mergedSourceGroups.find(g => g.id === cid)) {
        children.push({
          id: cid, name: nameMap[cid] || cid, gId: create.id, gName: create.name,
          pyQ: {}, cyQ: {}, products: [], tier: "Standard", class2: "Private Practice",
        });
      }
    });

    if (children.length > 0) {
      const savedClass2 = create.class2 || "Private Practice";
      const isDsoByLocs = children.length >= 3;
      const isDsoByFlag =
        savedClass2 === "DSO" || savedClass2 === "EMERGING DSO" || savedClass2 === "Emerging DSO";
      const derivedClass2 =
        isDsoByLocs || isDsoByFlag
          ? savedClass2 !== "Private Practice" && savedClass2 !== "STANDARD"
            ? savedClass2
            : "DSO"
          : savedClass2;
      result.unshift({
        id: create.id, name: create.name,
        tier: create.tier || "Standard", class2: derivedClass2,
        dsoName: create.dsoName || create.name, locs: children.length,
        pyQ: totalPY, cyQ: totalCY, children,
      });
    }
  });

  // Remove groups emptied by child moves
  result = result.filter(g => (g.children || []).length > 0);

  return result;
}
