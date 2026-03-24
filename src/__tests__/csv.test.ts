// ─── CSV PROCESSOR TESTS ─────────────────────────────────────────
// These tests lock in the import pipeline business rules.
// Tier normalization, group assembly, PY/CY accumulation, encoding
// robustness, and header normalization are the most likely things to
// silently break on a format change.

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

// ── parseCSV — core ──────────────────────────────────────────────
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
    // "Address" is aliased to canonical "Addr" by the header normalizer
    expect(rows[0]["Addr"]).toBe("123 Main St, Hartford");
  });

  it("handles escaped double-quotes inside quoted fields", () => {
    const csv = `Name,Note\n"O""Brien Dental","test"`;
    const rows = parseCSV(csv);
    expect(rows[0]["Name"]).toBe('O"Brien Dental');
  });

  it("skips empty lines", () => {
    const csv = "Name,City\nDr Smith,Hartford\n\nDr Jones,Boston";
    const rows = parseCSV(csv);
    expect(rows).toHaveLength(2);
  });

  it("handles Windows CRLF line endings", () => {
    const csv = "Name,City\r\nDr Smith,Hartford\r\nDr Jones,Boston";
    const rows = parseCSV(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]["City"]).toBe("Hartford");
  });
});

// ── parseCSV — encoding robustness ──────────────────────────────
describe("parseCSV encoding", () => {
  it("strips UTF-8 BOM so header key is not poisoned", () => {
    // BOM is U+FEFF — first char of the file
    const bom = "\uFEFF";
    const csv = `${bom}Name,City\nDr Smith,Hartford`;
    const rows = parseCSV(csv);
    // Without BOM stripping, the key would be "\uFEFFName" and lookup fails
    expect(rows[0]["Name"]).toBe("Dr Smith");
  });
});

// ── parseCSV — delimiter detection ──────────────────────────────
describe("parseCSV delimiter detection", () => {
  it("parses tab-delimited files correctly", () => {
    const tsv = "Name\tCity\nDr Smith\tHartford";
    const rows = parseCSV(tsv);
    expect(rows).toHaveLength(1);
    expect(rows[0]["Name"]).toBe("Dr Smith");
    expect(rows[0]["City"]).toBe("Hartford");
  });

  it("does not split on commas inside tab-delimited rows", () => {
    const tsv = `Name\tAddress\nSmith, John\t123 Main St`;
    const rows = parseCSV(tsv);
    expect(rows[0]["Name"]).toBe("Smith, John");
  });
});

// ── parseCSV — header normalization ─────────────────────────────
describe("parseCSV header normalization", () => {
  it("normalizes 'child mdm id' (lowercase) to canonical 'Child Mdm Id'", () => {
    const csv = "parent mdm id,child mdm id,parent name,child name,invoice date,PY,CY,l3,acct type,sds cust class2,class 4,city,state,addr\n" +
                "Master-CM100001,Master-CM100002,Test Dental,Test Office,1/15/2025,1000,800,Composites,Gold,STANDARD,,Hartford,CT,123 Main\n";
    const rows = parseCSV(csv);
    expect(rows[0]["Child Mdm Id"]).toBe("Master-CM100002");
    expect(rows[0]["Parent MDM ID"]).toBe("Master-CM100001");
  });

  it("normalizes 'invoice date' (lowercase) correctly", () => {
    const csv = "Parent MDM ID,Child Mdm Id,Parent Name,Child Name,invoice date,PY,CY,L3,Acct Type,Sds Cust Class2,Class 4,City,State,Addr\n" +
                "Master-CM100001,Master-CM100002,Test Dental,Test Office,1/15/2025,1000,800,Composites,Gold,STANDARD,,Hartford,CT,123 Main\n";
    const rows = parseCSV(csv);
    const result = processCSVData(rows);
    expect(result.groups.length).toBeGreaterThan(0);
  });
});

// ── processCSVData — base ────────────────────────────────────────
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
    const child = result.groups.flatMap((g: any) => g.children).find((c: any) => c.id === "Master-CM100002");
    expect(child.pyQ["1"]).toBe(1000);
  });

  it("accumulates CY into quarter buckets", () => {
    const result = processCSVData([makeRow({ "Invoice Date": "1/15/2025", "PY": "0", "CY": "800" })]);
    const child = result.groups.flatMap((g: any) => g.children).find((c: any) => c.id === "Master-CM100002");
    expect(child.cyQ["1"]).toBe(800);
  });

  it("sums multiple rows for the same child + quarter", () => {
    const rows = [
      makeRow({ "CY": "300", "PY": "0", "Invoice Date": "1/05/2025" }),
      makeRow({ "CY": "500", "PY": "0", "Invoice Date": "1/20/2025" }),
    ];
    const result = processCSVData(rows);
    const child = result.groups.flatMap((g: any) => g.children).find((c: any) => c.id === "Master-CM100002");
    expect(child.cyQ["1"]).toBe(800);
  });

  it("applies tier normalization — Top 100-Gold becomes Gold", () => {
    const result = processCSVData([makeRow({ "Acct Type": "Top 100-Gold" })]);
    const child = result.groups.flatMap((g: any) => g.children).find((c: any) => c.id === "Master-CM100002");
    expect(child.tier).toBe("Gold");
  });

  it("skips the Total summary row", () => {
    const rows = [makeRow(), makeRow({ "Parent MDM ID": "Total", "Child Mdm Id": "Total" })];
    const result = processCSVData(rows);
    expect(result.groups.every((g: any) => g.id !== "Total")).toBe(true);
  });

  it("skips Grand Total row variants", () => {
    const rows = [
      makeRow(),
      makeRow({ "Parent Name": "Grand Total", "Parent MDM ID": "Grand-Total", "Child Mdm Id": "GT1" }),
      makeRow({ "Parent Name": "Grand Total (All)", "Parent MDM ID": "GT2", "Child Mdm Id": "GT2" }),
    ];
    const result = processCSVData(rows);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].id).toBe("Master-CM100001");
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

  it("includes an ImportReport", () => {
    const result = processCSVData([makeRow()]);
    expect(result.report).toBeDefined();
    expect(result.report.finalGroups).toBe(1);
    expect(result.report.finalOffices).toBe(1);
  });
});

// ── numeric coercion ─────────────────────────────────────────────
describe("processCSVData numeric coercion", () => {
  it("handles comma-formatted numbers like 1,234.56", () => {
    const result = processCSVData([makeRow({ "PY": "1,234", "CY": "0" })]);
    const child = result.groups.flatMap((g: any) => g.children).find((c: any) => c.id === "Master-CM100002");
    expect(child.pyQ["1"]).toBe(1234);
  });

  it("handles dollar-sign prefixed values like $1,234", () => {
    const result = processCSVData([makeRow({ "PY": "$1,234", "CY": "$0" })]);
    const child = result.groups.flatMap((g: any) => g.children).find((c: any) => c.id === "Master-CM100002");
    expect(child.pyQ["1"]).toBe(1234);
  });

  it("handles parenthesis-negative values like (500)", () => {
    const result = processCSVData([makeRow({ "PY": "(500)", "CY": "0" })]);
    const child = result.groups.flatMap((g: any) => g.children).find((c: any) => c.id === "Master-CM100002");
    // Negative PY — should be accumulated as -500
    expect(child.pyQ["1"]).toBe(-500);
  });
});

// ── date coercion ────────────────────────────────────────────────
describe("processCSVData date coercion", () => {
  it("handles M/D/YYYY dates", () => {
    // March = month 3, ceil(3/3) = Q1
    const result = processCSVData([makeRow({ "Invoice Date": "3/15/2025", "PY": "100", "CY": "0" })]);
    const child = result.groups.flatMap((g: any) => g.children).find((c: any) => c.id === "Master-CM100002");
    expect(child.pyQ["1"]).toBe(100);
  });

  it("handles ISO YYYY-MM-DD dates", () => {
    const result = processCSVData([makeRow({ "Invoice Date": "2025-01-15", "PY": "1000", "CY": "0" })]);
    const child = result.groups.flatMap((g: any) => g.children).find((c: any) => c.id === "Master-CM100002");
    expect(child.pyQ["1"]).toBe(1000);
  });

  it("handles MM/DD/YYYY with leading zeros", () => {
    const result = processCSVData([makeRow({ "Invoice Date": "01/05/2025", "PY": "500", "CY": "0" })]);
    const child = result.groups.flatMap((g: any) => g.children).find((c: any) => c.id === "Master-CM100002");
    expect(child.pyQ["1"]).toBe(500);
  });

  it("skips rows with unparseable dates", () => {
    const result = processCSVData([makeRow({ "Invoice Date": "not-a-date" })]);
    expect(result.groups).toHaveLength(0);
    expect(result.report.noDateRowsSkipped).toBe(1);
  });
});

// ── ImportReport accuracy ────────────────────────────────────────
describe("ImportReport counters", () => {
  it("counts blank rows correctly", () => {
    const blankRow: Record<string, string> = {
      "Parent MDM ID": "", "Child Mdm Id": "", "Parent Name": "",
      "Child Name": "", "Invoice Date": "", "PY": "", "CY": "",
      "L3": "", "Acct Type": "", "Sds Cust Class2": "", "Class 4": "",
      "City": "", "State": "", "Addr": "",
    };
    const result = processCSVData([makeRow(), blankRow]);
    expect(result.report.blankRowsSkipped).toBe(1);
    expect(result.report.cleanRowsProcessed).toBe(1);
  });

  it("counts Grand Total rows correctly", () => {
    const rows = [
      makeRow(),
      makeRow({ "Parent Name": "Grand Total", "Parent MDM ID": "GT", "Child Mdm Id": "GT" }),
    ];
    const result = processCSVData(rows);
    expect(result.report.grandTotalRowsSkipped).toBe(1);
  });

  it("reports correct uniqueParents and finalGroups", () => {
    const rows = [
      makeRow({ "Parent MDM ID": "Master-CM111", "Child Mdm Id": "Master-CM111a" }),
      makeRow({ "Parent MDM ID": "Master-CM222", "Child Mdm Id": "Master-CM222a" }),
    ];
    const result = processCSVData(rows);
    expect(result.report.uniqueParents).toBe(2);
    expect(result.report.finalGroups).toBe(2);
  });
});
