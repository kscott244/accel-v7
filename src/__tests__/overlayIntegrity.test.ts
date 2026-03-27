// @ts-nocheck
// ─── OVERLAY INTEGRITY TESTS ────────────────────────────────────────────────
// Permanent guard: runs on every test pass to catch overlay corruption before
// it ships. Also validates the integrity check logic itself with unit tests.

import { validateOverlayIntegrity, validateGroupChildIds, namesMatch } from "@/lib/overlayIntegrity";

// ── Load real data for live audit ───────────────────────────────────────────
import { PRELOADED } from "@/data/preloaded-data";
import overlays from "../../data/overlays.json";

// ═══════════════════════════════════════════════════════════════════════════
// PART 1: Live audit of the current overlay against base data
// ═══════════════════════════════════════════════════════════════════════════

describe("live overlay integrity audit", () => {
  const baseGroups = PRELOADED?.groups || [];

  it("base data loaded successfully", () => {
    expect(baseGroups.length).toBeGreaterThan(100);
  });

  it("current overlay has no blocking violations", () => {
    const report = validateOverlayIntegrity(baseGroups, overlays);
    if (report.violations.length > 0) {
      console.log("\n=== OVERLAY INTEGRITY REPORT ===");
      report.violations.forEach(v => {
        console.log(`[${v.severity}] ${v.code}: ${v.detail}`);
      });
    }
    expect(report.blocked).toBe(false);
  });

  it("no childId in any overlay group is a parent of a 3+ child base group", () => {
    const baseGroupById: Record<string, any> = {};
    baseGroups.forEach(g => { baseGroupById[g.id] = g; });

    for (const [gId, g] of Object.entries((overlays as any).groups || {})) {
      for (const cid of ((g as any).childIds || [])) {
        const base = baseGroupById[cid];
        if (base && cid !== gId && (base.children || []).length >= 3) {
          fail(
            `CRITICAL: Overlay group "${(g as any).name}" (${gId}) claims ${cid} as a child, ` +
            `but ${cid} is the parent of "${base.name}" with ${(base.children || []).length} children. ` +
            `This would absorb an entire organization.`
          );
        }
      }
    }
  });

  it("no childId appears in multiple overlay groups", () => {
    const seen: Record<string, string> = {};
    for (const [gId, g] of Object.entries((overlays as any).groups || {})) {
      for (const cid of ((g as any).childIds || [])) {
        if (seen[cid]) {
          fail(
            `${cid} claimed by both "${gId}" and "${seen[cid]}". ` +
            `Same child in multiple overlay groups = conflict.`
          );
        }
        seen[cid] = gId;
      }
    }
  });

  it("no detached account is re-merged into any overlay group", () => {
    const detached = new Set(((overlays as any).groupDetaches || []).map((d: any) => d.childId));
    if (detached.size === 0) return; // no detaches to check

    for (const [gId, g] of Object.entries((overlays as any).groups || {})) {
      for (const cid of ((g as any).childIds || [])) {
        if (detached.has(cid)) {
          fail(
            `${cid} was explicitly detached but appears in overlay group "${(g as any).name}" (${gId}).`
          );
        }
      }
    }
  });

  it("suspicious cross-org merges are flagged (audit report)", () => {
    const report = validateOverlayIntegrity(baseGroups, overlays);
    const suspicious = report.violations.filter(v => v.code === "CROSS_ORG_ABSORB");
    if (suspicious.length > 0) {
      console.log("\n=== SUSPICIOUS CROSS-ORG MERGES (warnings, not failures) ===");
      suspicious.forEach(v => console.log(`  [warn] ${v.detail}`));
    }
    // Warnings don't fail the test, they're informational
    expect(true).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PART 2: Unit tests for validation logic
// ═══════════════════════════════════════════════════════════════════════════

describe("namesMatch", () => {
  it("matches identical names", () => {
    expect(namesMatch("BARNUM DENTAL", "BARNUM DENTAL")).toBe(true);
  });

  it("matches with different casing", () => {
    expect(namesMatch("Barnum Dental", "BARNUM DENTAL")).toBe(true);
  });

  it("matches with honorific differences", () => {
    expect(namesMatch("DR. HELENE STRAZZA", "HELENE STRAZZA")).toBe(true);
  });

  it("matches when one contains the other", () => {
    expect(namesMatch("EDGE DENTAL", "EDGE DENTAL MANAGEMENT")).toBe(true);
  });

  it("rejects completely different names", () => {
    expect(namesMatch("ALPHA DENTAL CENTER PC", "EDGE DENTAL MANAGEMENT")).toBe(false);
  });

  it("rejects partial word overlap", () => {
    expect(namesMatch("ABRA DENTAL", "ALL ABOUT KIDS PEDIATRIC DENTISTRY")).toBe(false);
  });
});

describe("validateOverlayIntegrity — synthetic cases", () => {
  const baseGroups = [
    { id: "G-LARGE", name: "LARGE ORG", children: [
      { id: "C1" }, { id: "C2" }, { id: "C3" }, { id: "C4" },
    ]},
    { id: "G-SMALL", name: "SMALL PRACTICE", children: [{ id: "C5" }] },
    { id: "G-MATCH", name: "EDGE DENTAL", children: [{ id: "C6" }] },
  ];

  it("blocks when a 3+ child base group parent is listed as a childId", () => {
    const ov = { groups: {
      "TARGET": { name: "OTHER ORG", childIds: ["G-LARGE", "C6"] },
    }, groupDetaches: [] };
    const report = validateOverlayIntegrity(baseGroups, ov);
    expect(report.blocked).toBe(true);
    expect(report.violations[0].code).toBe("PARENT_AS_CHILD");
  });

  it("warns but does not block for small group with different name", () => {
    const ov = { groups: {
      "TARGET": { name: "DIFFERENT ORG", childIds: ["G-SMALL"] },
    }, groupDetaches: [] };
    const report = validateOverlayIntegrity(baseGroups, ov);
    expect(report.blocked).toBe(false);
    expect(report.violations.some(v => v.code === "CROSS_ORG_ABSORB")).toBe(true);
  });

  it("allows legit dealer-split merge (same name, different CM)", () => {
    const ov = { groups: {
      "TARGET": { name: "EDGE DENTAL MANAGEMENT", childIds: ["G-MATCH"] },
    }, groupDetaches: [] };
    const report = validateOverlayIntegrity(baseGroups, ov);
    expect(report.blocked).toBe(false);
    expect(report.violations).toHaveLength(0);
  });

  it("blocks duplicate childId across two overlay groups", () => {
    const ov = { groups: {
      "G1": { name: "Org A", childIds: ["C1", "C2"] },
      "G2": { name: "Org B", childIds: ["C2", "C3"] },
    }, groupDetaches: [] };
    const report = validateOverlayIntegrity(baseGroups, ov);
    expect(report.blocked).toBe(true);
    expect(report.violations.some(v => v.code === "DUPLICATE_CHILD")).toBe(true);
  });

  it("blocks detached account re-merged", () => {
    const ov = { groups: {
      "G1": { name: "Org", childIds: ["C1"] },
    }, groupDetaches: [{ childId: "C1", fromGroupId: "OLD", newGroupId: "C1-standalone" }] };
    const report = validateOverlayIntegrity(baseGroups, ov);
    expect(report.blocked).toBe(true);
    expect(report.violations.some(v => v.code === "DETACH_REMERGE")).toBe(true);
  });

  it("passes clean overlay with no violations", () => {
    const ov = { groups: {
      "G1": { name: "New Org", childIds: ["C1", "C2"] },
    }, groupDetaches: [] };
    const report = validateOverlayIntegrity(baseGroups, ov);
    expect(report.blocked).toBe(false);
    expect(report.violations).toHaveLength(0);
  });
});

describe("validateGroupChildIds — single group pre-save check", () => {
  const baseGroups = [
    { id: "G-BIG", name: "BIG ORG", children: [
      { id: "C1" }, { id: "C2" }, { id: "C3" }, { id: "C4" }, { id: "C5" },
    ]},
  ];

  it("blocks adding a large base group as a child", () => {
    const violations = validateGroupChildIds(
      ["G-BIG", "C6"], "NEW-GROUP", "My Group", baseGroups,
      { groups: {}, groupDetaches: [] }
    );
    expect(violations.some(v => v.severity === "block")).toBe(true);
  });

  it("blocks if childId is already in another overlay group", () => {
    const violations = validateGroupChildIds(
      ["C1"], "G2", "Other Group", baseGroups,
      { groups: { "G1": { childIds: ["C1"] } }, groupDetaches: [] }
    );
    expect(violations.some(v => v.code === "DUPLICATE_CHILD")).toBe(true);
  });

  it("blocks if childId was detached", () => {
    const violations = validateGroupChildIds(
      ["C1"], "G2", "Group", baseGroups,
      { groups: {}, groupDetaches: [{ childId: "C1" }] }
    );
    expect(violations.some(v => v.code === "DETACH_REMERGE")).toBe(true);
  });

  it("passes valid childIds", () => {
    const violations = validateGroupChildIds(
      ["C1", "C2"], "G2", "Group", baseGroups,
      { groups: {}, groupDetaches: [] }
    );
    expect(violations).toHaveLength(0);
  });
});
