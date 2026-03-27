// ─── ADDRESS NORMALIZATION + ORG CLUSTERING ─────────────────────────────────
// Phase 1: Produces location fingerprints from raw address fields and clusters
// child accounts into organizations based on shared physical locations and
// parent CM relationships.
//
// normalizeAddress() → { fingerprint, suite, raw }
// buildOrgClusters() → { clusters, suggestions, flagsForReview, stats }

// ─── TYPES ──────────────────────────────────────────────────────────────────

export interface AddressFingerprint {
  fingerprint: string | null; // e.g. "54 north street|bristol|ct|06010"
  suite: string;              // extracted suite/unit number
  raw: string;                // original address string
}

export interface OrgCluster {
  clusterId: string;
  parentCMs: string[];
  fingerprints: string[];
  children: { childId: string; fingerprint: string | null; parentCM: string; suite: string }[];
}

export interface SuggestedMerge {
  id: string;
  reason: string;
  childIds: string[];
  parentCMs: string[];
  fingerprints: string[];
  confidence: "high" | "medium";
}

export interface ReviewFlag {
  id: string;
  reason: string;
  parentCMs: string[];
  childIds: string[];
}

export interface ClusterResult {
  clusters: OrgCluster[];
  suggestions: SuggestedMerge[];
  flagsForReview: ReviewFlag[];
  stats: {
    totalChildren: number;
    totalClusters: number;
    totalSuggestions: number;
    totalFlags: number;
  };
}

// ─── ABBREVIATION MAPS ─────────────────────────────────────────────────────

const STREET_ABBREVS: Record<string, string> = {
  st: "street", ave: "avenue", dr: "drive", rd: "road",
  blvd: "boulevard", ln: "lane", ct: "court", pl: "place",
  cir: "circle", pkwy: "parkway", hwy: "highway", tpke: "turnpike",
  ter: "terrace", terr: "terrace", xing: "crossing", sq: "square",
  way: "way", ext: "extension", trce: "trace", trl: "trail",
};

const DIRECTION_ABBREVS: Record<string, string> = {
  n: "north", s: "south", e: "east", w: "west",
  ne: "northeast", nw: "northwest", se: "southeast", sw: "southwest",
};

// CT/MA/RI city name variations — common in New England dental territory
const CITY_ALIASES: Record<string, string> = {
  "w hartford": "west hartford",
  "e hartford": "east hartford",
  "n haven": "new haven",
  "n branford": "north branford",
  "s windsor": "south windsor",
  "e windsor": "east windsor",
  "w haven": "west haven",
  "e haven": "east haven",
  "n stonington": "north stonington",
  "s glastonbury": "south glastonbury",
  "e granby": "east granby",
  "e hampton": "east hampton",
  "e haddam": "east haddam",
  "e lyme": "east lyme",
  "n franklin": "north franklin",
  "n windham": "north windham",
  "s hadley": "south hadley",
  "n andover": "north andover",
  "e longmeadow": "east longmeadow",
  "w springfield": "west springfield",
  "n kingstown": "north kingstown",
  "s kingstown": "south kingstown",
  "e greenwich": "east greenwich",
  "e providence": "east providence",
  "n providence": "north providence",
  "w warwick": "west warwick",
  "n smithfield": "north smithfield",
  "s attleboro": "south attleboro",
  "n attleboro": "north attleboro",
  "w roxbury": "west roxbury",
  "e boston": "east boston",
  "s boston": "south boston",
  "s norwalk": "south norwalk",
  "e norwalk": "east norwalk",
  "w hartland": "west hartland",
  "s glastenbury": "south glastonbury",
  "s. windsor": "south windsor",
  "e. hartford": "east hartford",
  "w. hartford": "west hartford",
  "n. haven": "new haven",
  "so windsor": "south windsor",
  "so. windsor": "south windsor",
  "no. haven": "north haven",
};

// ─── SUITE EXTRACTION ───────────────────────────────────────────────────────
// Splits "123 Main St Ste 201" → { street: "123 main street", suite: "201" }

const SUITE_PATTERN = /\b(?:ste|suite|unit|apt|#|room|rm|fl|floor|bldg|building)\s*[#.]?\s*(\S+)\s*$/i;

function extractSuite(addr: string): { street: string; suite: string } {
  const match = addr.match(SUITE_PATTERN);
  if (match) {
    return {
      street: addr.slice(0, match.index!).trim(),
      suite: match[1].replace(/^[#.]/, ""),
    };
  }
  return { street: addr, suite: "" };
}

// ─── NORMALIZE ADDRESS ──────────────────────────────────────────────────────

export function normalizeAddress(
  addr: string,
  city: string,
  state: string,
  zip?: string
): AddressFingerprint {
  const raw = [addr, city, state, zip].filter(Boolean).join(", ");

  // Missing/garbage detection
  if (!addr && !city) return { fingerprint: null, suite: "", raw };
  const addrTrimmed = (addr || "").trim();
  const cityTrimmed = (city || "").trim();
  if (!addrTrimmed && !cityTrimmed) return { fingerprint: null, suite: "", raw };

  // Garbage patterns: PO boxes, "unknown", all digits with no street name, etc.
  const lAddr = addrTrimmed.toLowerCase();
  if (/^p\.?o\.?\s*box/i.test(lAddr)) return { fingerprint: null, suite: "", raw };
  if (/^(unknown|n\/?a|none|tbd|test|\.+)$/i.test(lAddr)) return { fingerprint: null, suite: "", raw };

  // Step 1: Lowercase + strip punctuation (keep #, letters, digits, spaces)
  let normalized = lAddr.replace(/[.,;:'"!?()]/g, "").replace(/\s+/g, " ").trim();

  // Step 2: Extract suite before normalizing street types
  const { street, suite } = extractSuite(normalized);
  normalized = street;

  // Step 3: Expand direction abbreviations (must come before street type expansion)
  // Only expand standalone direction words, not parts of other words
  normalized = normalized.replace(/\b([nsew]|ne|nw|se|sw)\b/g, (_, d) => {
    return DIRECTION_ABBREVS[d] || d;
  });

  // Step 4: Expand street type abbreviations (end of string or before a space)
  normalized = normalized.replace(/\b(\w+)\s*$/g, (_, word) => {
    return STREET_ABBREVS[word] || word;
  });
  // Also handle mid-string street types (e.g., "Main St Unit 5" after suite extraction)
  normalized = normalized.replace(/\b(\w+)\b/g, (_, word) => {
    // Only replace known street type abbreviations, not regular words
    return STREET_ABBREVS[word] || word;
  });

  // Step 5: Normalize city
  let normCity = (cityTrimmed || "").toLowerCase().replace(/[.,;:'"!?()]/g, "").replace(/\s+/g, " ").trim();
  normCity = CITY_ALIASES[normCity] || normCity;

  // Step 6: Normalize state (already 2-letter typically, just lowercase)
  const normState = (state || "").toLowerCase().trim();

  // Step 7: Zip to 5-digit only
  let normZip = "";
  if (zip) {
    const zipMatch = zip.trim().match(/^(\d{5})/);
    if (zipMatch) normZip = zipMatch[1];
  }

  // Step 8: Final cleanup
  normalized = normalized.replace(/\s+/g, " ").trim();

  // Build fingerprint: addr|city|state|zip (omit empty trailing parts)
  const parts = [normalized, normCity, normState];
  if (normZip) parts.push(normZip);
  const fingerprint = parts.join("|");

  // Reject fingerprints that are too short to be meaningful
  if (normalized.length < 3 && normCity.length < 2) {
    return { fingerprint: null, suite: "", raw };
  }

  return { fingerprint, suite, raw };
}

// ─── BUILD ORG CLUSTERS ─────────────────────────────────────────────────────
// Takes processed groups (after processCSVData) and overlays, then builds
// organization clusters using address fingerprints and parent CM relationships.
//
// Tier 1: Children sharing same address fingerprint = same physical location
// Tier 2: Same parent CM = same org
// Tier 3: Parent CMs sharing at least one address fingerprint → cluster
//         (transitive closure, capped at 2 hops, flag if >10 parent CMs)

export function buildOrgClusters(
  groups: any[],
  overlays: any = {}
): ClusterResult {
  const detachedChildIds = new Set<string>();
  const existingGroupChildIds = new Set<string>();
  const existingGroupMap: Record<string, string[]> = {};

  // Collect detached children — never re-cluster these
  (overlays.groupDetaches || []).forEach((d: any) => {
    detachedChildIds.add(d.childId);
  });

  // Collect existing overlay groups
  for (const [gId, g] of Object.entries(overlays.groups || {})) {
    const childIds = (g as any).childIds || [];
    existingGroupMap[gId] = childIds;
    childIds.forEach((cid: string) => existingGroupChildIds.add(cid));
  }

  // ── Step 1: Fingerprint every child ───────────────────────────────────────
  interface ChildRecord {
    childId: string;
    parentCM: string;       // group.id (Parent MDM ID)
    fingerprint: string | null;
    suite: string;
    name: string;
    groupName: string;
  }

  const allChildren: ChildRecord[] = [];
  const fingerprintToChildren: Record<string, ChildRecord[]> = {};
  const parentCMToFingerprints: Record<string, Set<string>> = {};
  const parentCMToChildren: Record<string, ChildRecord[]> = {};

  for (const group of groups) {
    const parentCM = group.id;
    if (!parentCMToFingerprints[parentCM]) parentCMToFingerprints[parentCM] = new Set();
    if (!parentCMToChildren[parentCM]) parentCMToChildren[parentCM] = [];

    for (const child of (group.children || [])) {
      // Skip detached children
      if (detachedChildIds.has(child.id)) continue;

      const fp = normalizeAddress(child.addr || "", child.city || "", child.st || "", child.zip || "");
      const rec: ChildRecord = {
        childId: child.id,
        parentCM,
        fingerprint: fp.fingerprint,
        suite: fp.suite,
        name: child.name || "",
        groupName: group.name || "",
      };

      allChildren.push(rec);
      parentCMToChildren[parentCM].push(rec);

      if (fp.fingerprint) {
        if (!fingerprintToChildren[fp.fingerprint]) fingerprintToChildren[fp.fingerprint] = [];
        fingerprintToChildren[fp.fingerprint].push(rec);
        parentCMToFingerprints[parentCM].add(fp.fingerprint);
      }
    }
  }

  // ── Step 2: Build parent CM adjacency via shared fingerprints (Tier 3) ────
  // Two parent CMs are adjacent if they share at least one address fingerprint.
  const parentCMAdjacency: Record<string, Set<string>> = {};
  for (const [, children] of Object.entries(fingerprintToChildren)) {
    const parentCMs = [...new Set(children.map(c => c.parentCM))];
    if (parentCMs.length < 2) continue;
    for (const a of parentCMs) {
      if (!parentCMAdjacency[a]) parentCMAdjacency[a] = new Set();
      for (const b of parentCMs) {
        if (a !== b) parentCMAdjacency[a].add(b);
      }
    }
  }

  // ── Step 3: Transitive closure with 2-hop cap ────────────────────────────
  // BFS from each parent CM, but stop at depth 2.
  const visited = new Set<string>();
  const clusterGroups: string[][] = []; // each entry = array of parent CM ids in one cluster
  const flagsForReview: ReviewFlag[] = [];

  const allParentCMs = Object.keys(parentCMToChildren);
  for (const startCM of allParentCMs) {
    if (visited.has(startCM)) continue;

    // BFS with hop limit
    const cluster = new Set<string>();
    const queue: { cm: string; depth: number }[] = [{ cm: startCM, depth: 0 }];
    cluster.add(startCM);

    while (queue.length > 0) {
      const { cm, depth } = queue.shift()!;
      if (depth >= 2) continue; // 2-hop cap

      for (const neighbor of (parentCMAdjacency[cm] || [])) {
        if (!cluster.has(neighbor)) {
          cluster.add(neighbor);
          queue.push({ cm: neighbor, depth: depth + 1 });
        }
      }
    }

    // Flag if cluster would merge >10 parent CMs
    if (cluster.size > 10) {
      const cmArray = [...cluster];
      flagsForReview.push({
        id: `review-large-cluster-${startCM}`,
        reason: `Transitive closure would merge ${cluster.size} parent CMs (>10 limit). Requires manual review.`,
        parentCMs: cmArray,
        childIds: cmArray.flatMap(cm => (parentCMToChildren[cm] || []).map(c => c.childId)),
      });
      // Still mark as visited but don't auto-cluster
      cmArray.forEach(cm => visited.add(cm));
      continue;
    }

    cluster.forEach(cm => visited.add(cm));
    clusterGroups.push([...cluster]);
  }

  // ── Step 4: Build cluster objects + detect suite conflicts ────────────────
  const clusters: OrgCluster[] = [];
  const suggestions: SuggestedMerge[] = [];
  let sugId = 0;

  for (const cmGroup of clusterGroups) {
    // Collect all fingerprints and children in this cluster
    const clusterFingerprints = new Set<string>();
    const clusterChildren: OrgCluster["children"] = [];

    for (const cm of cmGroup) {
      for (const rec of (parentCMToChildren[cm] || [])) {
        clusterChildren.push({
          childId: rec.childId,
          fingerprint: rec.fingerprint,
          parentCM: rec.parentCM,
          suite: rec.suite,
        });
        if (rec.fingerprint) clusterFingerprints.add(rec.fingerprint);
      }
    }

    // Single parent CM with no shared fingerprints = Tier 2 only, no new cluster needed
    if (cmGroup.length === 1) {
      // Still check for Tier 1 dedup within the same parent CM
      const fpGroups = groupByFingerprint(clusterChildren);
      const hasDupes = Object.values(fpGroups).some(arr => arr.length > 1);

      if (hasDupes) {
        clusters.push({
          clusterId: `cluster-${cmGroup[0]}`,
          parentCMs: cmGroup,
          fingerprints: [...clusterFingerprints],
          children: clusterChildren,
        });
      }
      continue;
    }

    // Multi-CM cluster: check suite conflicts before auto-clustering
    const suiteConflicts = findSuiteConflicts(clusterChildren);
    if (suiteConflicts.length > 0) {
      // Suite conflicts → suggest instead of auto-cluster
      for (const conflict of suiteConflicts) {
        suggestions.push({
          id: `sug-suite-${++sugId}`,
          reason: `Same building address but different suites and different parent names — may be separate practices: ${conflict.fingerprint}`,
          childIds: conflict.childIds,
          parentCMs: conflict.parentCMs,
          fingerprints: [conflict.fingerprint],
          confidence: "medium",
        });
      }

      // Still cluster the non-conflicting children
      const conflictChildIds = new Set(suiteConflicts.flatMap(c => c.childIds));
      const safeChildren = clusterChildren.filter(c => !conflictChildIds.has(c.childId));

      if (safeChildren.length > 0) {
        clusters.push({
          clusterId: `cluster-${cmGroup[0]}`,
          parentCMs: cmGroup,
          fingerprints: [...clusterFingerprints],
          children: safeChildren,
        });
      }
    } else {
      clusters.push({
        clusterId: `cluster-${cmGroup[0]}`,
        parentCMs: cmGroup,
        fingerprints: [...clusterFingerprints],
        children: clusterChildren,
      });
    }

    // Check for conflicts with existing overlay groups
    const clusterChildIds = new Set(clusterChildren.map(c => c.childId));
    for (const [gId, gChildIds] of Object.entries(existingGroupMap)) {
      const overlap = gChildIds.filter(cid => clusterChildIds.has(cid));
      const nonOverlap = gChildIds.filter(cid => !clusterChildIds.has(cid));
      if (overlap.length > 0 && nonOverlap.length > 0) {
        flagsForReview.push({
          id: `review-overlay-conflict-${gId}`,
          reason: `Existing overlay group "${gId}" partially overlaps with address cluster. ${overlap.length} children shared, ${nonOverlap.length} in group only.`,
          parentCMs: cmGroup,
          childIds: [...overlap, ...nonOverlap],
        });
      }
    }
  }

  // ── Step 5: Generate Tier 1 suggestions for same-fingerprint children ─────
  // across different parent CMs (that didn't get auto-clustered)
  for (const [fp, children] of Object.entries(fingerprintToChildren)) {
    if (children.length < 2) continue;
    const parentCMs = [...new Set(children.map(c => c.parentCM))];
    if (parentCMs.length < 2) continue;

    // Check if these are already in a cluster
    const alreadyClustered = clusters.some(cl =>
      children.every(c => cl.children.some(cc => cc.childId === c.childId))
    );
    if (alreadyClustered) continue;

    suggestions.push({
      id: `sug-addr-${++sugId}`,
      reason: `${children.length} accounts share address fingerprint "${fp}" across ${parentCMs.length} parent CMs`,
      childIds: children.map(c => c.childId),
      parentCMs,
      fingerprints: [fp],
      confidence: "high",
    });
  }

  return {
    clusters,
    suggestions,
    flagsForReview,
    stats: {
      totalChildren: allChildren.length,
      totalClusters: clusters.length,
      totalSuggestions: suggestions.length,
      totalFlags: flagsForReview.length,
    },
  };
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

function groupByFingerprint(
  children: OrgCluster["children"]
): Record<string, OrgCluster["children"]> {
  const map: Record<string, OrgCluster["children"]> = {};
  for (const c of children) {
    if (!c.fingerprint) continue;
    if (!map[c.fingerprint]) map[c.fingerprint] = [];
    map[c.fingerprint].push(c);
  }
  return map;
}

interface SuiteConflict {
  fingerprint: string;
  childIds: string[];
  parentCMs: string[];
}

function findSuiteConflicts(
  children: OrgCluster["children"]
): SuiteConflict[] {
  const conflicts: SuiteConflict[] = [];
  const byFp = groupByFingerprint(children);

  for (const [fp, group] of Object.entries(byFp)) {
    if (group.length < 2) continue;

    // Check if there are different suites AND different parent CMs
    const suites = new Set(group.filter(c => c.suite).map(c => c.suite));
    const parentCMs = new Set(group.map(c => c.parentCM));

    if (suites.size > 1 && parentCMs.size > 1) {
      conflicts.push({
        fingerprint: fp,
        childIds: group.map(c => c.childId),
        parentCMs: [...parentCMs],
      });
    }
  }

  return conflicts;
}
