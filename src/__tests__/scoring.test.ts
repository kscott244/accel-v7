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
