// ─── SCORING ENGINE TESTS ────────────────────────────────────────
// These tests lock in the business logic for scoreAccount().
// If a change accidentally alters scoring behavior, these will catch it.

import { scoreAccount, $$ } from "@/lib/format";

// ── $$ formatter ────────────────────────────────────────────────
describe("$$", () => {
  it("formats thousands with K", () => {
    expect($$( 5000)).toBe("$5K");
    expect($$( 1500)).toBe("$1.5K");
    expect($$( 1000)).toBe("$1K");
  });
  it("formats millions with M", () => {
    expect($$(1_500_000)).toBe("$1.50M");
  });
  it("handles zero and null", () => {
    expect($$(0)).toBe("$0");
    expect($$(null)).toBe("$0");
    expect($$(undefined)).toBe("$0");
  });
  it("handles negative values", () => {
    expect($$(-3000)).toBe("-$3K");
  });
  it("formats sub-thousand", () => {
    expect($$(500)).toBe("$500");
  });
});

// ── scoreAccount ─────────────────────────────────────────────────
describe("scoreAccount", () => {
  const base = { pyQ: { "1": 10000 }, cyQ: { "1": 0 }, last: 999, tier: "Standard", products: [] };

  it("returns expected shape", () => {
    const r = scoreAccount(base, "1");
    expect(r).toHaveProperty("score");
    expect(r).toHaveProperty("reasons");
    expect(r).toHaveProperty("gap");
    expect(r).toHaveProperty("ret");
    expect(r).toHaveProperty("py");
    expect(r).toHaveProperty("cy");
  });

  it("assigns large gap points (>$8K gap → 30pts)", () => {
    const r = scoreAccount({ ...base, pyQ: { "1": 10000 }, cyQ: { "1": 0 } }, "1");
    expect(r.gap).toBe(10000);
    expect(r.reasons.some(x => x.pts === 30)).toBe(true);
  });

  it("assigns medium gap points ($4K–$8K → 20pts)", () => {
    const r = scoreAccount({ ...base, pyQ: { "1": 6000 }, cyQ: { "1": 0 } }, "1");
    expect(r.gap).toBe(6000);
    expect(r.reasons.some(x => x.pts === 20)).toBe(true);
  });

  it("assigns near-zero retention points (py>500, ret<5% → 25pts)", () => {
    const r = scoreAccount({ ...base, pyQ: { "1": 5000 }, cyQ: { "1": 50 } }, "1");
    expect(r.ret).toBeLessThan(0.05);
    expect(r.reasons.some(x => x.pts === 25)).toBe(true);
  });

  it("assigns gone-dark points (last>120 → 20pts)", () => {
    const r = scoreAccount({ ...base, pyQ: { "1": 5000 }, cyQ: { "1": 5000 }, last: 150 }, "1");
    expect(r.reasons.some(x => x.label.includes("Gone dark"))).toBe(true);
  });

  it("assigns Diamond tier bonus (10pts)", () => {
    const r = scoreAccount({ ...base, tier: "Diamond" }, "1");
    expect(r.reasons.some(x => x.pts === 10 && x.label === "Diamond tier")).toBe(true);
  });

  it("assigns Platinum tier bonus (8pts)", () => {
    const r = scoreAccount({ ...base, tier: "Platinum" }, "1");
    expect(r.reasons.some(x => x.pts === 8 && x.label === "Platinum tier")).toBe(true);
  });

  it("assigns dead product points (py>200, cy=0 → 3pts each)", () => {
    const acct = {
      ...base,
      pyQ: { "1": 5000 }, cyQ: { "1": 4000 },
      products: [
        { py1: 500, cy1: 0 },
        { py1: 300, cy1: 0 },
      ],
    };
    const r = scoreAccount(acct, "1");
    expect(r.reasons.some(x => x.label.includes("products at $0"))).toBe(true);
  });

  it("scores zero for a healthy account with no gap", () => {
    const r = scoreAccount({ pyQ: { "1": 5000 }, cyQ: { "1": 5000 }, last: 5, tier: "Standard", products: [] }, "1");
    expect(r.gap).toBe(0);
    expect(r.score).toBe(0);
    expect(r.reasons).toHaveLength(0);
  });

  it("handles missing pyQ/cyQ gracefully (no crash)", () => {
    expect(() => scoreAccount({}, "1")).not.toThrow();
    const r = scoreAccount({}, "1");
    expect(r.py).toBe(0);
    expect(r.cy).toBe(0);
  });

  it("uses gTier over tier for tier scoring", () => {
    const r = scoreAccount({ ...base, tier: "Standard", gTier: "Diamond" }, "1");
    expect(r.reasons.some(x => x.label === "Diamond tier")).toBe(true);
  });
});
// ── frequency scoring (A16) ──────────────────────────────────────
describe("scoreAccount — frequency dimension", () => {
  const base = { pyQ: { "1": 8000 }, cyQ: { "1": 0 }, last: 45, tier: "Diamond", products: [] };

  it("adds 15pts when freqScore > 2.0 (more than 2x overdue by pattern)", () => {
    // Account normally orders every 21 days (monthly buyer), now at day 45 → freqScore = 45/21 ≈ 2.14
    const r = scoreAccount(base, "1", { avgIntervalDays: 21, freqScore: 2.14, orderCount: 6 });
    expect(r.reasons.some(x => x.pts === 15 && x.label.includes("Overdue"))).toBe(true);
  });

  it("adds 10pts when freqScore > 1.5 (1.5x overdue by pattern)", () => {
    // Account normally orders every 30 days, now at day 48 → freqScore = 48/30 = 1.6
    const r = scoreAccount(base, "1", { avgIntervalDays: 30, freqScore: 1.6, orderCount: 5 });
    expect(r.reasons.some(x => x.pts === 10 && x.label.includes("Overdue"))).toBe(true);
  });

  it("adds 5pts when freqScore > 1.25 (slightly overdue by pattern)", () => {
    // Account normally orders every 60 days, now at day 78 → freqScore = 78/60 = 1.3
    const r = scoreAccount(base, "1", { avgIntervalDays: 60, freqScore: 1.3, orderCount: 4 });
    expect(r.reasons.some(x => x.pts === 5 && x.label.includes("Late"))).toBe(true);
  });

  it("adds no frequency pts when freqScore <= 1.25 (within normal cadence)", () => {
    // Account normally orders every 90 days, now at day 45 → freqScore = 0.5 (early)
    const before = scoreAccount(base, "1");
    const after  = scoreAccount(base, "1", { avgIntervalDays: 90, freqScore: 0.5, orderCount: 4 });
    expect(after.score).toBe(before.score);
  });

  it("ignores freqData with < 3 orderCount (insufficient baseline)", () => {
    const before = scoreAccount(base, "1");
    const after  = scoreAccount(base, "1", { avgIntervalDays: 21, freqScore: 3.0, orderCount: 2 });
    expect(after.score).toBe(before.score);
  });

  it("ignores freqData with avgIntervalDays < 14 (implausible pattern)", () => {
    const before = scoreAccount(base, "1");
    const after  = scoreAccount(base, "1", { avgIntervalDays: 5, freqScore: 9.0, orderCount: 10 });
    expect(after.score).toBe(before.score);
  });

  it("is additive with recency score — both fire independently", () => {
    // Account at day 130 (gone dark) + 2.5x overdue by pattern — both should contribute
    const acct = { ...base, last: 130 };
    const r = scoreAccount(acct, "1", { avgIntervalDays: 50, freqScore: 2.5, orderCount: 5 });
    const hasGoneDark = r.reasons.some(x => x.label.includes("Gone dark"));
    const hasOverdue  = r.reasons.some(x => x.label.includes("Overdue"));
    expect(hasGoneDark).toBe(true);
    expect(hasOverdue).toBe(true);
  });

  it("does not crash when freqData is undefined", () => {
    expect(() => scoreAccount(base, "1", undefined)).not.toThrow();
  });
});

