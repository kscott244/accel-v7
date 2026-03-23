// ─── DATA DIFF TESTS ─────────────────────────────────────────────
import { diffDatasets, checkOverlayIntegrity } from "@/lib/dataDiff";

// ── helpers ──────────────────────────────────────────────────────
function makeGroup(id: string, children: any[]) {
  return { id, children };
}
function makeChild(id: string, cy1 = 0, py1 = 0) {
  return { id, cyQ: { "1": cy1 }, pyQ: { "1": py1 } };
}

// ── diffDatasets ──────────────────────────────────────────────────
describe("diffDatasets", () => {
  it("returns all zeros when datasets are identical", () => {
    const groups = [makeGroup("G1", [makeChild("C1", 1000)])];
    const diff = diffDatasets(groups, groups);
    expect(diff.addedAccounts).toBe(0);
    expect(diff.removedAccounts).toBe(0);
    expect(diff.changedRevenue).toBe(0);
    expect(diff.addedGroups).toBe(0);
    expect(diff.removedGroups).toBe(0);
  });

  it("detects added accounts", () => {
    const prev = [makeGroup("G1", [makeChild("C1")])];
    const next = [makeGroup("G1", [makeChild("C1"), makeChild("C2")])];
    const diff = diffDatasets(prev, next);
    expect(diff.addedAccounts).toBe(1);
    expect(diff.removedAccounts).toBe(0);
  });

  it("detects removed accounts", () => {
    const prev = [makeGroup("G1", [makeChild("C1"), makeChild("C2")])];
    const next = [makeGroup("G1", [makeChild("C1")])];
    const diff = diffDatasets(prev, next);
    expect(diff.removedAccounts).toBe(1);
    expect(diff.addedAccounts).toBe(0);
  });

  it("detects changed CY revenue", () => {
    const prev = [makeGroup("G1", [makeChild("C1", 1000)])];
    const next = [makeGroup("G1", [makeChild("C1", 1500)])];
    const diff = diffDatasets(prev, next);
    expect(diff.changedRevenue).toBe(1);
  });

  it("does not flag unchanged CY revenue as changed", () => {
    const prev = [makeGroup("G1", [makeChild("C1", 1000)])];
    const next = [makeGroup("G1", [makeChild("C1", 1000)])];
    const diff = diffDatasets(prev, next);
    expect(diff.changedRevenue).toBe(0);
  });

  it("does not count new accounts as changedRevenue", () => {
    const prev: any[] = [];
    const next = [makeGroup("G1", [makeChild("C1", 1000)])];
    const diff = diffDatasets(prev, next);
    expect(diff.addedAccounts).toBe(1);
    expect(diff.changedRevenue).toBe(0);
  });

  it("detects added groups", () => {
    const prev = [makeGroup("G1", [makeChild("C1")])];
    const next = [makeGroup("G1", [makeChild("C1")]), makeGroup("G2", [makeChild("C2")])];
    const diff = diffDatasets(prev, next);
    expect(diff.addedGroups).toBe(1);
    expect(diff.removedGroups).toBe(0);
  });

  it("detects removed groups", () => {
    const prev = [makeGroup("G1", [makeChild("C1")]), makeGroup("G2", [makeChild("C2")])];
    const next = [makeGroup("G1", [makeChild("C1")])];
    const diff = diffDatasets(prev, next);
    expect(diff.removedGroups).toBe(1);
    expect(diff.addedGroups).toBe(0);
  });

  it("handles empty prev (first upload)", () => {
    const next = [makeGroup("G1", [makeChild("C1"), makeChild("C2")])];
    const diff = diffDatasets([], next);
    expect(diff.addedAccounts).toBe(2);
    expect(diff.removedAccounts).toBe(0);
    expect(diff.changedRevenue).toBe(0);
  });

  it("excludes FY rollup key from CY comparison", () => {
    const prev = [makeGroup("G1", [{ id: "C1", cyQ: { "1": 500, "2": 500, FY: 1000 } }])];
    const next = [makeGroup("G1", [{ id: "C1", cyQ: { "1": 500, "2": 500, FY: 1000 } }])];
    const diff = diffDatasets(prev, next);
    expect(diff.changedRevenue).toBe(0);
  });
});

// ── checkOverlayIntegrity ──────────────────────────────────────────
describe("checkOverlayIntegrity", () => {
  const groups = [makeGroup("G1", [makeChild("C1"), makeChild("C2")])];

  it("returns empty result when all overlays match live accounts", () => {
    const overlays = { contacts: { C1: {} }, activityLogs: { C2: {} }, groups: {}, nameOverrides: {}, fscReps: {} };
    const result = checkOverlayIntegrity(overlays, groups);
    expect(result.missingIds).toHaveLength(0);
    expect(result.affectedSections).toHaveLength(0);
  });

  it("detects orphaned contacts", () => {
    const overlays = { contacts: { "GONE-001": {} }, activityLogs: {}, groups: {}, nameOverrides: {}, fscReps: {} };
    const result = checkOverlayIntegrity(overlays, groups);
    expect(result.missingIds).toContain("GONE-001");
    expect(result.affectedSections).toContain("contacts");
  });

  it("detects orphaned custom group childIds", () => {
    const overlays = { contacts: {}, activityLogs: {}, groups: { "CUSTOM-001": { childIds: ["C1", "GONE-002"] } }, nameOverrides: {}, fscReps: {} };
    const result = checkOverlayIntegrity(overlays, groups);
    expect(result.missingIds).toContain("GONE-002");
    expect(result.missingIds).not.toContain("C1");
    expect(result.affectedSections).toContain("custom groups");
  });

  it("detects orphaned name overrides", () => {
    const overlays = { contacts: {}, activityLogs: {}, groups: {}, nameOverrides: { "GONE-003": "New Name" }, fscReps: {} };
    const result = checkOverlayIntegrity(overlays, groups);
    expect(result.missingIds).toContain("GONE-003");
    expect(result.affectedSections).toContain("name overrides");
  });

  it("deduplicates missing IDs across sections", () => {
    const overlays = {
      contacts: { "GONE-001": {} },
      activityLogs: { "GONE-001": [] },
      groups: {}, nameOverrides: {}, fscReps: {},
    };
    const result = checkOverlayIntegrity(overlays, groups);
    expect(result.missingIds.filter(id => id === "GONE-001")).toHaveLength(1);
  });

  it("handles empty overlays without crashing", () => {
    expect(() => checkOverlayIntegrity({}, groups)).not.toThrow();
    const result = checkOverlayIntegrity({}, groups);
    expect(result.missingIds).toHaveLength(0);
  });
});
