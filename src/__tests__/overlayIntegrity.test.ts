// @ts-nocheck
// ─── OVERLAY INTEGRITY TESTS ──────────────���─────────────────────────────────
// Permanent guard: runs on every test pass to catch overlay corruption before
// it ships. Tests the integrity check logic + audits the live overlay file.

import { applyOps, validateOverlayIntegrity, namesMatch } from "@/lib/overlayOps";
import { PRELOADED } from "@/data/preloaded-data";
import overlays from "../../data/overlays.json";

// ═══════════════════════════════════════════════════════════════════════════
// PART 1: Live audit of the current overlay against base data
// ════════════════════════════════════════════════════════���══════════════════

describe("live overlay integrity audit", () => {
  const baseGroups = PRELOADED?.groups || [];

  it("base data loaded", () => {
    expect(baseGroups.length).toBeGreaterThan(100);
  });

  it("no blocking violations in current overlay", () => {
    const report = validateOverlayIntegrity(baseGroups, overlays);
    if (report.violations.length > 0) {
      console.log("\n=== OVERLAY INTEGRITY VIOLATIONS ===");
      report.violations.forEach(v => console.log(`[${v.severity}] ${v.code}: ${v.detail}`));
    }
    expect(report.blocked).toBe(false);
  });

  it("no childId is parent of 3+ child base group", () => {
    const baseGroupById: Record<string, any> = {};
    baseGroups.forEach(g => { baseGroupById[g.id] = g; });

    for (const [gId, g] of Object.entries((overlays as any).groups || {})) {
      for (const cid of ((g as any).childIds || [])) {
        const base = baseGroupById[cid];
        if (base && cid !== gId && (base.children || []).length >= 3) {
          fail(`CRITICAL: "${(g as any).name}" (${gId}) claims ${cid} → parent of "${base.name}" (${(base.children||[]).length} children)`);
        }
      }
    }
  });

  it("no childId in multiple overlay groups", () => {
    const seen: Record<string, string> = {};
    for (const [gId, g] of Object.entries((overlays as any).groups || {})) {
      for (const cid of ((g as any).childIds || [])) {
        if (seen[cid]) fail(`${cid} in both "${gId}" and "${seen[cid]}"`);
        seen[cid] = gId;
      }
    }
  });

  it("no overlay group has 0 children", () => {
    for (const [gId, g] of Object.entries((overlays as any).groups || {})) {
      expect(((g as any).childIds || []).length).toBeGreaterThan(0);
    }
  });

  it("all overlay childIds exist in base data", () => {
    const allIds = new Set<string>();
    baseGroups.forEach(g => {
      allIds.add(g.id);
      (g.children || []).forEach(c => allIds.add(c.id));
    });

    for (const [gId, g] of Object.entries((overlays as any).groups || {})) {
      for (const cid of ((g as any).childIds || [])) {
        if (!allIds.has(cid)) {
          fail(`"${(g as any).name}" (${gId}) references ${cid} which doesn't exist in base data`);
        }
      }
    }
  });

  it("no detached account is re-merged", () => {
    const detached = new Set(((overlays as any).groupDetaches || []).map((d: any) => d.childId));
    for (const [gId, g] of Object.entries((overlays as any).groups || {})) {
      for (const cid of ((g as any).childIds || [])) {
        if (detached.has(cid)) fail(`${cid} detached but in "${(g as any).name}" (${gId})`);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PART 2: Unit tests for overlayOps
// ════════════���═══════════════════════════════���══════════════════════════════

describe("namesMatch", () => {
  it("exact match", () => expect(namesMatch("BARNUM DENTAL", "BARNUM DENTAL")).toBe(true));
  it("case insensitive", () => expect(namesMatch("Barnum Dental", "BARNUM DENTAL")).toBe(true));
  it("strips honorifics", () => expect(namesMatch("DR. HELENE STRAZZA", "HELENE STRAZZA")).toBe(true));
  it("containment match", () => expect(namesMatch("EDGE DENTAL", "EDGE DENTAL MANAGEMENT")).toBe(true));
  it("rejects different names", () => expect(namesMatch("ALPHA DENTAL CENTER PC", "EDGE DENTAL MANAGEMENT")).toBe(false));
  it("rejects partial overlap", () => expect(namesMatch("ABRA DENTAL", "ALL ABOUT KIDS PEDIATRIC DENTISTRY")).toBe(false));
});

describe("applyOps", () => {
  it("set operation creates nested key", () => {
    const ov = { groups: {} };
    applyOps(ov, [{ op: "set", path: "groups.G1", value: { name: "Test" } }]);
    expect(ov.groups.G1.name).toBe("Test");
  });

  it("delete operation removes key", () => {
    const ov = { groups: { G1: { name: "X" } } };
    applyOps(ov, [{ op: "delete", path: "groups.G1" }]);
    expect(ov.groups.G1).toBeUndefined();
  });

  it("replaceSection replaces entire section", () => {
    const ov = { dealerManualReps: { old: "data" } };
    applyOps(ov, [{ op: "replaceSection", section: "dealerManualReps", value: { new: "data" } }]);
    expect(ov.dealerManualReps).toEqual({ new: "data" });
  });

  it("pushDetach adds and dedupes by childId", () => {
    const ov = { groupDetaches: [{ childId: "C1", reason: "old" }] };
    applyOps(ov, [{ op: "pushDetach", value: { childId: "C1", reason: "new" } }]);
    expect(ov.groupDetaches).toHaveLength(1);
    expect(ov.groupDetaches[0].reason).toBe("new");
  });

  it("removeDetach filters by childId", () => {
    const ov = { groupDetaches: [{ childId: "C1" }, { childId: "C2" }] };
    applyOps(ov, [{ op: "removeDetach", childId: "C1" }]);
    expect(ov.groupDetaches).toHaveLength(1);
    expect(ov.groupDetaches[0].childId).toBe("C2");
  });

  it("addSkippedCpidIds deduplicates", () => {
    const ov = { skippedCpidIds: ["A"] };
    applyOps(ov, [{ op: "addSkippedCpidIds", ids: ["A", "B", "C"] }]);
    expect(ov.skippedCpidIds).toEqual(["A", "B", "C"]);
  });
});

describe("validateOverlayIntegrity — synthetic", () => {
  const baseGroups = [
    { id: "G-LARGE", name: "LARGE ORG", children: [{ id: "C1" }, { id: "C2" }, { id: "C3" }, { id: "C4" }] },
    { id: "G-SMALL", name: "SMALL PRACTICE", children: [{ id: "C5" }] },
    { id: "G-MATCH", name: "EDGE DENTAL", children: [{ id: "C6" }] },
  ];

  it("blocks 3+ child base parent as child", () => {
    const ov = { groups: { T: { name: "OTHER", childIds: ["G-LARGE", "C6"] } }, groupDetaches: [] };
    expect(validateOverlayIntegrity(baseGroups, ov).blocked).toBe(true);
  });

  it("warns on small group with different name", () => {
    const ov = { groups: { T: { name: "DIFFERENT", childIds: ["G-SMALL"] } }, groupDetaches: [] };
    const r = validateOverlayIntegrity(baseGroups, ov);
    expect(r.blocked).toBe(false);
    expect(r.violations.some(v => v.code === "CROSS_ORG_ABSORB")).toBe(true);
  });

  it("allows legit dealer-split (name match)", () => {
    const ov = { groups: { T: { name: "EDGE DENTAL MANAGEMENT", childIds: ["G-MATCH"] } }, groupDetaches: [] };
    const r = validateOverlayIntegrity(baseGroups, ov);
    expect(r.blocked).toBe(false);
    expect(r.violations).toHaveLength(0);
  });

  it("blocks duplicate childId", () => {
    const ov = { groups: { G1: { name: "A", childIds: ["C1"] }, G2: { name: "B", childIds: ["C1"] } }, groupDetaches: [] };
    expect(validateOverlayIntegrity(baseGroups, ov).blocked).toBe(true);
  });

  it("blocks detach re-merge", () => {
    const ov = { groups: { G1: { name: "A", childIds: ["C1"] } }, groupDetaches: [{ childId: "C1" }] };
    expect(validateOverlayIntegrity(baseGroups, ov).blocked).toBe(true);
  });

  it("passes clean overlay", () => {
    const ov = { groups: { G1: { name: "A", childIds: ["C1", "C2"] } }, groupDetaches: [] };
    const r = validateOverlayIntegrity(baseGroups, ov);
    expect(r.blocked).toBe(false);
    expect(r.violations).toHaveLength(0);
  });
});
