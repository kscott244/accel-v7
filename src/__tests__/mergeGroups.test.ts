// @ts-nocheck
// ─── MERGE SELF-TEST HARNESS ─────────────────────────────────────────────────
// Tests for applyGroupCreates() — the pure merge resolver extracted in A16.4.
//
// Covers the exact failure modes seen in A16.2/A16.3 production bugs:
//   1. source account merged into target group — orphan card removal
//   2. source merged into CSV-native multi-loc group — removal + financial preservation
//   3. negative-sales source data preserved in merged totals
//   4. childIds are deduped
//   5. target children not dropped during merge
//   6. rollback: removing overlay group restores original state
//   7. source merged into existing overlay group writes into target.id

import { applyGroupCreates } from "@/lib/mergeGroups";

// ── Test fixtures ─────────────────────────────────────────────────────────────

// Simulates a CSV-native multi-location group (like Edge Dental Management)
const makeTargetGroup = (id = "Master-CM047997", extraChildren: any[] = []) => ({
  id,
  name: "EDGE DENTAL MANAGEMENT",
  tier: "Diamond",
  class2: "DSO",
  locs: 2 + extraChildren.length,
  pyQ: { "1": 5000 },
  cyQ: { "1": 8000 },
  children: [
    {
      id: "Master-CM111",
      name: "EDGE LOC A",
      city: "Middletown",
      st: "NY",
      tier: "Diamond",
      class2: "STANDARD",
      pyQ: { "1": 3000 },
      cyQ: { "1": 5000 },
      products: [{ n: "SIMPLISHADE", py1: 3000 }],
    },
    {
      id: "Master-CM222",
      name: "EDGE LOC B",
      city: "Newburgh",
      st: "NY",
      tier: "Diamond",
      class2: "STANDARD",
      pyQ: { "1": 2000 },
      cyQ: { "1": 3000 },
      products: [{ n: "MAXCEM ELITE", py1: 2000 }],
    },
    ...extraChildren,
  ],
});

// Simulates a single-location account (like Middletown Dental Associates)
// where group.id === child.id (self-referencing)
const makeSourceGroup = (id = "Master-CM1921839") => ({
  id,
  name: "MIDDLETOWN DENTAL ASSOCIATES",
  tier: "Standard",
  class2: "STANDARD",
  locs: 1,
  pyQ: { "1": 6908, "FY": 8918 },
  cyQ: { "1": 0 },
  children: [
    {
      id,
      name: "MIDDLETOWN DENTAL ASSOCIATES",
      city: "Middletown",
      st: "NY",
      tier: "Standard",
      class2: "STANDARD",
      pyQ: { "1": 6908, "FY": 8918 },
      cyQ: { "1": 0 },
      products: [{ n: "MAXCEM ELITE", py1: 4796 }],
    },
  ],
});

// Simulates a source group with negative Q1 sales
const makeNegativeSalesSource = (id = "Master-CM-NEG") => ({
  id,
  name: "NEGATIVE DENTAL",
  tier: "Standard",
  class2: "STANDARD",
  locs: 1,
  pyQ: { "1": -500 },
  cyQ: { "1": 0 },
  children: [
    {
      id,
      name: "NEGATIVE DENTAL",
      city: "Hartford",
      st: "CT",
      tier: "Standard",
      pyQ: { "1": -500 },
      cyQ: { "1": 0 },
      products: [{ n: "CAVICIDE", py1: -500 }],
    },
  ],
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("applyGroupCreates — merge self-test harness", () => {
  // ── Scenario 1: source merged into large CSV-native target ──────────────────
  describe("Scenario 1: single-loc source absorbed into CSV-native multi-loc target", () => {
    const sourceId = "Master-CM1921839";
    const targetId = "Master-CM047997";

    const baseGroups = [makeTargetGroup(targetId), makeSourceGroup(sourceId)];
    const overlayGroups = {
      [targetId]: {
        id: targetId,
        name: "EDGE DENTAL MANAGEMENT",
        tier: "Diamond",
        class2: "DSO",
        // A16.3 fix: source group's own id is in childIds
        childIds: ["Master-CM111", "Master-CM222", sourceId],
        source: "manual-merge",
        createdAt: "2026-03-27T00:00:00Z",
        updatedAt: "2026-03-27T00:00:00Z",
      },
    };

    let result: any[];
    beforeEach(() => {
      result = applyGroupCreates(baseGroups, overlayGroups);
    });

    it("source group is no longer a standalone card", () => {
      const sourceCard = result.find(g => g.id === sourceId);
      expect(sourceCard).toBeUndefined();
    });

    it("target group exists in result", () => {
      const targetCard = result.find(g => g.id === targetId);
      expect(targetCard).toBeDefined();
    });

    it("target location count increases to include source", () => {
      const targetCard = result.find(g => g.id === targetId);
      // 2 original Edge children + 1 Middletown child (self-referencing, same id)
      expect(targetCard.locs).toBe(3);
      expect(targetCard.children.length).toBe(3);
    });

    it("target childIds are deduped — no duplicates", () => {
      const targetCard = result.find(g => g.id === targetId);
      const ids = targetCard.children.map((c: any) => c.id);
      expect(ids.length).toBe(new Set(ids).size);
    });

    it("original target children are preserved", () => {
      const targetCard = result.find(g => g.id === targetId);
      const ids = targetCard.children.map((c: any) => c.id);
      expect(ids).toContain("Master-CM111");
      expect(ids).toContain("Master-CM222");
    });

    it("source child appears in target children", () => {
      const targetCard = result.find(g => g.id === targetId);
      const ids = targetCard.children.map((c: any) => c.id);
      expect(ids).toContain(sourceId);
    });

    it("source PY is included in merged target totals", () => {
      const targetCard = result.find(g => g.id === targetId);
      // Edge PY Q1: 3000 + 2000 = 5000, Middletown adds 6908 → 11908
      expect(targetCard.pyQ["1"]).toBeCloseTo(11908, 0);
    });

    it("total result card count is one less (source absorbed)", () => {
      // Started with 2 groups, now should have 1 (target only)
      expect(result.length).toBe(1);
    });
  });

  // ── Scenario 2: negative-sales source preserved ─────────────────────────────
  describe("Scenario 2: negative-sales source data preserved in merged totals", () => {
    const sourceId = "Master-CM-NEG";
    const targetId = "Master-CM047997";
    const baseGroups = [makeTargetGroup(targetId), makeNegativeSalesSource(sourceId)];
    const overlayGroups = {
      [targetId]: {
        id: targetId,
        name: "EDGE DENTAL MANAGEMENT",
        tier: "Diamond",
        class2: "DSO",
        childIds: ["Master-CM111", "Master-CM222", sourceId],
        source: "manual-merge",
        createdAt: "2026-03-27T00:00:00Z",
        updatedAt: "2026-03-27T00:00:00Z",
      },
    };

    it("negative pyQ value is not zeroed in merged totals", () => {
      const result = applyGroupCreates(baseGroups, overlayGroups);
      const targetCard = result.find(g => g.id === targetId);
      // Edge Q1 PY: 3000+2000=5000, negative source: -500 → total 4500
      expect(targetCard.pyQ["1"]).toBeCloseTo(4500, 0);
    });

    it("source no longer renders as standalone card", () => {
      const result = applyGroupCreates(baseGroups, overlayGroups);
      expect(result.find(g => g.id === sourceId)).toBeUndefined();
    });
  });

  // ── Scenario 3: childIds deduplication ──────────────────────────────────────
  describe("Scenario 3: childIds with duplicate entries are deduped", () => {
    const targetId = "Master-CM047997";
    const baseGroups = [makeTargetGroup(targetId)];
    const overlayGroups = {
      [targetId]: {
        id: targetId,
        name: "EDGE DENTAL MANAGEMENT",
        tier: "Diamond",
        class2: "DSO",
        // Duplicate Master-CM111
        childIds: ["Master-CM111", "Master-CM222", "Master-CM111"],
        source: "manual-merge",
        createdAt: "2026-03-27T00:00:00Z",
        updatedAt: "2026-03-27T00:00:00Z",
      },
    };

    it("duplicate childId does not produce duplicate children", () => {
      const result = applyGroupCreates(baseGroups, overlayGroups);
      const targetCard = result.find(g => g.id === targetId);
      const ids = targetCard.children.map((c: any) => c.id);
      expect(ids.length).toBe(new Set(ids).size);
    });
  });

  // ── Scenario 4: rollback — removing overlay group restores original ──────────
  describe("Scenario 4: rollback — removing overlay entry restores original state", () => {
    const sourceId = "Master-CM1921839";
    const targetId = "Master-CM047997";
    const baseGroups = [makeTargetGroup(targetId), makeSourceGroup(sourceId)];

    it("without overlay group, both groups render independently", () => {
      const result = applyGroupCreates(baseGroups, {});
      expect(result.find(g => g.id === targetId)).toBeDefined();
      expect(result.find(g => g.id === sourceId)).toBeDefined();
      expect(result.length).toBe(2);
    });

    it("with overlay applied, source disappears and target absorbs it", () => {
      const overlayGroups = {
        [targetId]: {
          id: targetId, name: "EDGE DENTAL MANAGEMENT", tier: "Diamond", class2: "DSO",
          childIds: ["Master-CM111", "Master-CM222", sourceId],
          source: "manual-merge", createdAt: "2026-03-27T00:00:00Z", updatedAt: "2026-03-27T00:00:00Z",
        },
      };
      const result = applyGroupCreates(baseGroups, overlayGroups);
      expect(result.find(g => g.id === sourceId)).toBeUndefined();
      expect(result.find(g => g.id === targetId)?.children.length).toBe(3);
    });

    it("rollback: after removing overlay, original 2-group state is restored", () => {
      // Simulate rollback by passing empty overlayGroups
      const result = applyGroupCreates(baseGroups, {});
      expect(result.length).toBe(2);
      expect(result.find(g => g.id === sourceId)).toBeDefined();
      const target = result.find(g => g.id === targetId);
      expect(target?.children.length).toBe(2); // original 2 children
    });
  });

  // ── Scenario 5: merge writes into target (not source) ───────────────────────
  describe("Scenario 5: overlay entry keyed on target id — not source id", () => {
    const sourceId = "Master-CM1921839";
    const targetId = "Master-CM047997";
    const baseGroups = [makeTargetGroup(targetId), makeSourceGroup(sourceId)];
    const overlayGroups = {
      [targetId]: {  // ← key must be targetId
        id: targetId,
        name: "EDGE DENTAL MANAGEMENT",
        tier: "Diamond",
        class2: "DSO",
        childIds: ["Master-CM111", "Master-CM222", sourceId],
        source: "manual-merge",
        createdAt: "2026-03-27T00:00:00Z",
        updatedAt: "2026-03-27T00:00:00Z",
      },
    };

    it("result group id is the target id, not the source id", () => {
      const result = applyGroupCreates(baseGroups, overlayGroups);
      const mergedCard = result.find(g => g.id === targetId);
      expect(mergedCard).toBeDefined();
      expect(mergedCard.id).toBe(targetId);
    });

    it("no bogus wrapper group exists keyed on source id", () => {
      const result = applyGroupCreates(baseGroups, overlayGroups);
      expect(result.find(g => g.id === sourceId)).toBeUndefined();
    });
  });
});
