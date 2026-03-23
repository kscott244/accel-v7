// ─── DATA DIFF ────────────────────────────────────────────────────
// Compares two groups datasets and returns a structured summary of what changed.
// Used by the CSV upload flow to show the user what a new upload contains
// relative to the previously loaded dataset.

export interface UploadDiff {
  addedAccounts: number;
  removedAccounts: number;
  changedRevenue: number;   // accounts present in both with different CY totals
  addedGroups: number;
  removedGroups: number;
}

/** Sum only the quarter keys (1–4) in a cyQ/pyQ map — excludes the "FY" rollup key. */
function sumQuarters(qMap: Record<string, number> | undefined): number {
  if (!qMap) return 0;
  return Object.entries(qMap)
    .filter(([k]) => k !== "FY")
    .reduce((acc, [, v]) => acc + (v || 0), 0);
}

export function diffDatasets(prev: any[], next: any[]): UploadDiff {
  // Flatten children from each dataset into id → child maps
  const prevChildren = new Map<string, any>();
  const nextChildren = new Map<string, any>();

  prev.forEach(g => (g.children || []).forEach((c: any) => prevChildren.set(c.id, c)));
  next.forEach(g => (g.children || []).forEach((c: any) => nextChildren.set(c.id, c)));

  const prevGroupIds = new Set(prev.map(g => g.id));
  const nextGroupIds = new Set(next.map(g => g.id));

  // Added / removed accounts
  let addedAccounts = 0;
  let removedAccounts = 0;
  for (const id of nextChildren.keys()) if (!prevChildren.has(id)) addedAccounts++;
  for (const id of prevChildren.keys()) if (!nextChildren.has(id)) removedAccounts++;

  // Accounts present in both whose CY revenue changed
  let changedRevenue = 0;
  for (const [id, nextChild] of nextChildren) {
    const prevChild = prevChildren.get(id);
    if (!prevChild) continue; // new account — already counted above
    const prevCY = sumQuarters(prevChild.cyQ);
    const nextCY = sumQuarters(nextChild.cyQ);
    if (Math.abs(prevCY - nextCY) > 0.5) changedRevenue++;
  }

  // Added / removed groups
  let addedGroups = 0;
  let removedGroups = 0;
  for (const id of nextGroupIds) if (!prevGroupIds.has(id)) addedGroups++;
  for (const id of prevGroupIds) if (!nextGroupIds.has(id)) removedGroups++;

  return { addedAccounts, removedAccounts, changedRevenue, addedGroups, removedGroups };
}

/** Check all overlay sections for references to account IDs not present in the new data. */
export interface OverlayIntegrityResult {
  missingIds: string[];
  affectedSections: string[];
}

export function checkOverlayIntegrity(overlays: any, newGroups: any[]): OverlayIntegrityResult {
  const newChildIds = new Set(
    newGroups.flatMap(g => (g.children || []).map((c: any) => c.id))
  );

  const missing = new Set<string>();
  const affectedSections: string[] = [];

  // Custom group creates — childIds list
  const groupsMissing: string[] = [];
  Object.values(overlays.groups || {}).forEach((grp: any) => {
    (grp.childIds || []).forEach((cid: string) => {
      if (!newChildIds.has(cid)) { missing.add(cid); groupsMissing.push(cid); }
    });
  });
  if (groupsMissing.length) affectedSections.push("custom groups");

  // Contacts, activityLogs, nameOverrides, fscReps — keyed by account ID
  const keyedSections: Array<[string, string]> = [
    ["contacts",      "contacts"],
    ["activityLogs",  "activity logs"],
    ["nameOverrides", "name overrides"],
    ["fscReps",       "FSC assignments"],
  ];
  for (const [key, label] of keyedSections) {
    const sectionMissing = Object.keys(overlays[key] || {}).filter(id => !newChildIds.has(id));
    if (sectionMissing.length) {
      sectionMissing.forEach(id => missing.add(id));
      affectedSections.push(label);
    }
  }

  return { missingIds: Array.from(missing), affectedSections };
}
