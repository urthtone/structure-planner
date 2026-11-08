import { describe, expect, it } from "vitest";
import { DEFAULT_INPUT, DEFAULT_PRICES, generatePlan } from "./planning";

describe("10×12 wood shed takeoff", () => {
  const input = { ...DEFAULT_INPUT, windows: 2 };
  it("calculates floor layout, sheets, foundation and gross wall framing", () => {
    const p = generatePlan(input);
    expect(p.geometry.area).toBe(120);
    expect(p.geometry.joists).toBe(10);
    expect(p.geometry.supportLines).toBe(4);
    expect(p.geometry.studs).toBe(62);
    expect(p.materials.find((m) => m.id === "floorSheets")?.quantity).toBe(5);
    expect(p.cutList.find((m) => m.piece === "Rim joist")?.quantity).toBe(2);
  });
  it("uses roof slope and overhang for actual roofing area", () => {
    const p = generatePlan(input);
    expect(p.geometry.rafterLength).toBeCloseTo(6.7082, 4);
    expect(p.geometry.rafters).toBe(20);
    expect(p.geometry.roofArea).toBeCloseTo(187.8297, 3);
    expect(p.materials.find((m) => m.id === "roofSheets")?.quantity).toBe(7);
    expect(p.materials.find((m) => m.id === "roofing")?.quantity).toBe(2.07);
    expect(p.materials.find((m) => m.id === "wallSheets")?.quantity).toBe(13);
  });
  it("prices the takeoff reproducibly and supports price overrides", () => {
    const p = generatePlan(input);
    expect(p.total).toBeGreaterThan(0);
    expect(p.total).toBe(
      Number(p.materials.reduce((sum, m) => sum + m.cost, 0).toFixed(2)),
    );
    const changed = generatePlan(input, {
      ...DEFAULT_PRICES,
      floorSheets: 100,
    });
    expect(changed.total - p.total).toBeCloseTo(
      5 * (100 - DEFAULT_PRICES.floorSheets),
    );
  });
});

describe("variants and validation", () => {
  it("removes wood floor and skids on a slab and includes concrete", () => {
    const p = generatePlan({ ...DEFAULT_INPUT, foundation: "slab" });
    expect(
      p.materials.some((m) => m.id === "floorSheets" || m.id === "skids"),
    ).toBe(false);
    expect(p.materials.find((m) => m.id === "concrete")?.quantity).toBe(1.63);
    expect(p.steps.join(" ")).toContain("slab");
  });
  it("estimates piers and a pitched single-slope roof", () => {
    const p = generatePlan({
      ...DEFAULT_INPUT,
      foundation: "piers",
      roofStyle: "single-slope",
    });
    expect(p.geometry.piers).toBe(12);
    expect(p.geometry.rafterLength).toBeCloseTo(12 * Math.sqrt(1.25));
    expect(p.materials.some((m) => m.id === "ridge")).toBe(false);
  });
  it("makes a roofless deck and a slab garage shell", () => {
    const deck = generatePlan({
      ...DEFAULT_INPUT,
      type: "deck",
      foundation: "piers",
    });
    expect(deck.geometry.roofArea).toBe(0);
    expect(deck.materials.some((m) => m.id === "decking")).toBe(true);
    expect(deck.materials.some((m) => m.id === "studs")).toBe(false);
    expect(() => generatePlan({ ...DEFAULT_INPUT, type: "deck" })).toThrow(
      /piers/,
    );
    const garage = generatePlan({
      ...DEFAULT_INPUT,
      type: "garage",
      width: 16,
      doorWidth: 8,
      foundation: "slab",
    });
    expect(garage.materials.some((m) => m.id === "concrete")).toBe(true);
    expect(
      generatePlan({ ...DEFAULT_INPUT, type: "cabin" }).warnings.join(" "),
    ).toContain("habitable");
  });
  it("rejects impossible or unbounded inputs and invalid prices", () => {
    for (const width of [0, -1, NaN, Infinity, 101])
      expect(() => generatePlan({ ...DEFAULT_INPUT, width })).toThrow();
    expect(() => generatePlan({ ...DEFAULT_INPUT, doorWidth: 11 })).toThrow();
    expect(() => generatePlan({ ...DEFAULT_INPUT, windows: 2.5 })).toThrow();
    expect(() => generatePlan({ ...DEFAULT_INPUT, windows: 9 })).toThrow();
    expect(() =>
      generatePlan(DEFAULT_INPUT, { ...DEFAULT_PRICES, studs: -1 }),
    ).toThrow();
  });
  it("changes wall and floor spacing without silently omitting openings", () => {
    const p = generatePlan({ ...DEFAULT_INPUT, studSpacing: 24, windows: 2 });
    expect(p.geometry.joists).toBe(10); // Floor stays 16 OC.
    expect(p.geometry.studs).toBeLessThan(62);
    expect(
      p.cutList
        .filter((m) => m.piece.includes("header"))
        .reduce((s, m) => s + m.quantity, 0),
    ).toBe(6);
  });
});

it("does not round exact waste multiples up due to floating-point error", () => {
  const p = generatePlan(DEFAULT_INPUT);
  expect(p.materials.find((item) => item.id === "ties")?.quantity).toBe(110);
  expect(p.total).toBe(4189.1);
});

it("separates single-slope high-wall and rake-wall framing allowances", () => {
  const p = generatePlan({ ...DEFAULT_INPUT, roofStyle: "single-slope" });
  expect(
    p.cutList.find((item) => item.piece === "High-wall stud extension"),
  ).toMatchObject({ quantity: 10, length: 5 });
  expect(
    p.cutList.find(
      (item) => item.piece === "Rake-wall infill (average, field fit)",
    ),
  ).toMatchObject({ quantity: 18, length: 2.5 });
});
