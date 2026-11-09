import type { Plan } from "@/lib/plan";

export type Cut = {
  member: string;
  size: string;
  length: string;
  qty: number;
  buy: string;
};

export type Frame = {
  deck: boolean;
  cuts: Cut[];
  joists: number[];
  skids: number[];
  studs: number[];
  rafters: number[];
  pitchLabel: string;
  rafterFt: number;
  studFt: number;
  opening: { offsetFt: number; widthFt: number; kind: string } | null;
};

const SPACING_IN = 16;

function oc(spanFt: number): number {
  return Math.ceil((spanFt * 12) / SPACING_IN) + 1;
}

function marks(spanFt: number): number[] {
  const count = oc(spanFt);
  const points = Array.from({ length: count }, (_, index) => (index * SPACING_IN) / 12);
  points[points.length - 1] = spanFt;
  return points;
}

function even(count: number, spanFt: number): number[] {
  if (count <= 1) return [0];
  return Array.from({ length: count }, (_, index) => (spanFt * index) / (count - 1));
}

export function formatFeet(feet: number): string {
  const eighths = Math.round(Math.abs(feet) * 12 * 8);
  const inchesTotal = Math.floor(eighths / 8);
  const rem = eighths % 8;
  const ft = Math.floor(inchesTotal / 12);
  const inches = inchesTotal % 12;
  const frac = ["", " 1/8", " 1/4", " 3/8", " 1/2", " 5/8", " 3/4", " 7/8"][rem];
  if (ft === 0) return `${inches}${frac} in`;
  if (inches === 0 && !frac) return `${ft} ft`;
  return `${ft} ft ${inches}${frac} in`;
}

function buy(size: string, cutFt: number): string {
  const stock = [8, 10, 12, 14, 16, 20].find((length) => length + 0.02 >= cutFt);
  return stock ? `${size}×${stock}` : `${size}, cut from ${Math.ceil(cutFt)} ft`;
}

function cut(member: string, size: string, cutFt: number, qty: number): Cut {
  return { member, size, length: formatFeet(cutFt), qty, buy: buy(size, cutFt) };
}

export function frameOf(plan: Plan): Frame {
  const { widthFt: width, lengthFt: length, wallHeightFt: height, roof } = plan.dimensions;
  const deck = plan.structureType === "deck";
  const pitch = /6\s*\/\s*12/.test(roof) ? 6 / 12 : deck ? 0 : 4 / 12;
  const pitchLabel = deck ? "no roof" : pitch > 0.45 ? "6/12" : "4/12";
  const studFt = Math.max(1, height - 4.5 / 12);
  const rafterFt = deck ? 0 : Math.hypot(width / 2, (width / 2) * pitch) + 0.5;
  const joistSize = width > 10 ? "2×8" : "2×6";
  const opening =
    plan.openings.find((item) => item.wall === "s") ??
    plan.openings[0] ??
    null;

  const cuts: Cut[] = deck
    ? deckCuts(width, length, height, joistSize)
    : buildingCuts(width, length, studFt, rafterFt, joistSize, plan);

  return {
    deck,
    cuts,
    joists: marks(length),
    skids: even(Math.max(3, Math.ceil(width / 4) + 1), width),
    studs: marks(width),
    rafters: marks(length),
    pitchLabel,
    rafterFt,
    studFt,
    opening: opening ? { offsetFt: opening.offsetFt, widthFt: opening.widthFt, kind: opening.kind } : null,
  };
}

function buildingCuts(width: number, length: number, studFt: number, rafterFt: number, joistSize: string, plan: Plan): Cut[] {
  const commons = oc(width) * 2 + oc(length) * 2 - 4;
  const openings = plan.openings.length || 1;
  const cuts = [
    cut("Skid", "PT 4×6", length, Math.max(3, Math.ceil(width / 4) + 1)),
    cut("Floor joist", joistSize, width, oc(length)),
    cut("Rim joist", joistSize, length, 2),
    cut("Bottom plate", "2×4", width, 2),
    cut("Bottom plate", "2×4", length, 2),
    cut("Top plate, double", "2×4", width, 4),
    cut("Top plate, double", "2×4", length, 4),
    cut("Stud", "2×4", studFt, commons),
    cut("Jack stud", "2×4", Math.max(2, studFt - 0.75), openings * 2),
    cut("Header, doubled", "2×6", (plan.openings[0]?.widthFt ?? 3) + 0.25, Math.max(2, openings * 2)),
    cut("Rafter", rafterFt > 8 ? "2×6" : "2×4", rafterFt, oc(length) * 2),
    cut("Ridge", "2×6", length, Math.max(1, Math.ceil(length / 12))),
  ];
  return cuts;
}

function deckCuts(width: number, length: number, height: number, joistSize: string): Cut[] {
  const posts = Math.max(4, (Math.ceil(width / 6) + 1) * (Math.ceil(length / 8) + 1));
  const boards = Math.ceil((width * 12) / 5.5);
  return [
    cut("Post", "4×4", height, posts),
    cut("Beam, doubled", "2×10", length, Math.max(2, Math.ceil(length / 8) * 2)),
    cut("Joist", joistSize, width, oc(length)),
    cut("Decking", "5/4×6", Math.min(width, 12), boards * Math.ceil(length / 12)),
    cut("Stair stringer", "2×12", Math.max(4, height * 1.4), 3),
  ];
}
