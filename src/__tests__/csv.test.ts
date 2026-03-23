// ─── CSV PROCESSOR TESTS ─────────────────────────────────────────
// These tests lock in the import pipeline business rules.
// Tier normalization, group assembly, and PY/CY accumulation are
// the most likely things to silently break on a format change.

import { processCSVData, parseCSV, setDealers } from "@/lib/csv";
import { normalizeTier } from "@/lib/tier";

// ── normalizeTier ────────────────────────────────────────────────
describe("normalizeTier", () => {
  it("passes standard tiers through unchanged", () => {
    expect(normalizeTier("Silver")).toBe("Silver");
    expect(normalizeTier("Gold")).toBe("Gold");
    expect(normalizeTier("Platinum")).toBe("Platinum");
    expect(normalizeTier("Diamond")).toBe("Diamond");
    expect(normalizeTier("Standard")).toBe("Standard");
  });

  it("strips Top 100 prefix and returns the real tier", () => {
    expect(normalizeTier("Top 100-Gold")).toBe("Gold");
    expect(normalizeTier("Top 100-Diamond")).toBe("Diamond");
    expect(normalizeTier("Top 100-Platinum")).toBe("Platinum");
  });

  it("treats bare Top 100 as Standard (ranking, not a tier)", () => {
    expect(normalizeTier("Top 100")).toBe("Standard");
    expect(normalizeTier("TOP 100")).toBe("Standard");
  });

  it("treats HOUSE ACCOUNTS as Standard", () => {
    expect(normalizeTier("HOUSE ACCOUNTS")).toBe("Standard");
  });

  it("handles null/undefined/empty", () => {
    expect(normalizeTier(null)).toBe("Standard");
    expect(normalizeTier(undefined)).toBe("Standard");
    expect(normalizeTier("")).toBe("Standard");
  });
});

// ── parseCSV ────────────────────────────────────────────────────
describe("parseCSV", () => {
  it("parses header + one data row", () => {
    const csv = "Name,City\nDr Smith,Hartford";
    const rows = parseCSV(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]["Name"]).toBe("Dr Smith");
    expect(rows[0]["City"]).toBe("Hartford");
  });

  it("handles quoted fields containing commas", () => {
    const csv = `Name,Address\n"Smith, John","123 Main St, Hartford"`;
    const rows = parseCSV(csv);
    expect(rows[0]["Name"]).toBe("Smith, John");
    expect(rows[0]["Address"]).toBe("123 Main St, Hartford");
  });

  it("skips empty lines", () => {
    const csv = "Name,City\nDr Smith,Hartford\n\nDr Jones,Boston";
    const rows = parseCSV(csv);
    expect(rows).toHaveLength(2);
  });
});

// ── processCSVData ───────────────────────────────────────────────
// Build minimal rows that match the fields the processor reads.
function makeRow(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    "Parent MDM ID":    "Master-CM100001",
    "Child Mdm Id":     "Master-CM100002",
    "Parent Name":      "Test Dental Group",
    "Child Name":       "Test Office",
    "Invoice Date":     "1/15/2025",
    "PY":               "1000",
    "CY":               "800",
    "L3":               "Composites",
    "Acct Type":        "Gold",
    "Sds Cust Class2":  "STANDARD",
    "Class 4":          "",
    "City":             "Hartford",
    "State":            "CT",
    "Addr":             "123 Main St",
    ...overrides,
  };
}

describe("processCSVData", () => {
  it("produces a non-empty groups array from valid rows", () => {
    const result = processCSVData([makeRow()]);
    expect(result.groups.length).toBeGreaterThan(0);
  });

  it("groups children under their parent", () => {
    const result = processCSVData([makeRow()]);
    const grp = result.groups.find(g => g.id === "Master-CM100001");
    expect(grp).toBeDefined();
    expect(grp.children.some((c: any) => c.id === "Master-CM100002")).toBe(true);
  });

  it("accumulates PY into quarter buckets", () => {
    const result = processCSVData([makeRow({ "Invoice Date": "1/15/2025", "PY": "1000", "CY": "0" })]);
    const child = result.groups
      .flatMap((g: any) => g.children)
      .find((c: any) => c.id === "Master-CM100002");
    expect(child.pyQ["1"]).toBe(1000);
  });

  it("accumulates CY into quarter buckets", () => {
    const result = processCSVData([makeRow({ "Invoice Date": "1/15/2025", "PY": "0", "CY": "800" })]);
    const child = result.groups
      .flatMap((g: any) => g.children)
      .find((c: any) => c.id === "Master-CM100002");
    expect(child.cyQ["1"]).toBe(800);
  });

  it("sums multiple rows for the same child + quarter", () => {
    const rows = [
      makeRow({ "CY": "300", "PY": "0", "Invoice Date": "1/05/2025" }),
      makeRow({ "CY": "500", "PY": "0", "Invoice Date": "1/20/2025" }),
    ];
    const result = processCSVData(rows);
    const child = result.groups
      .flatMap((g: any) => g.children)
      .find((c: any) => c.id === "Master-CM100002");
    expect(child.cyQ["1"]).toBe(800);
  });

  it("applies tier normalization — Top 100-Gold becomes Gold", () => {
    const result = processCSVData([makeRow({ "Acct Type": "Top 100-Gold" })]);
    const child = result.groups
      .flatMap((g: any) => g.children)
      .find((c: any) => c.id === "Master-CM100002");
    expect(child.tier).toBe("Gold");
  });

  it("skips the Total summary row", () => {
    const rows = [
      makeRow(),
      makeRow({ "Parent MDM ID": "Total", "Child Mdm Id": "Total" }),
    ];
    const result = processCSVData(rows);
    expect(result.groups.every((g: any) => g.id !== "Total")).toBe(true);
  });

  it("skips rows with no invoice date", () => {
    const result = processCSVData([makeRow({ "Invoice Date": "" })]);
    expect(result.groups).toHaveLength(0);
  });

  it("skips rows with no child or parent ID", () => {
    const r1 = processCSVData([makeRow({ "Child Mdm Id": "" })]);
    const r2 = processCSVData([makeRow({ "Parent MDM ID": "" })]);
    expect(r1.groups).toHaveLength(0);
    expect(r2.groups).toHaveLength(0);
  });

  it("includes a generated timestamp", () => {
    const result = processCSVData([makeRow()]);
    expect(typeof result.generated).toBe("string");
    expect(result.generated.length).toBeGreaterThan(0);
  });
});
