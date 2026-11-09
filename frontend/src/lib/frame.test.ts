import assert from "node:assert/strict";
import test from "node:test";
import { frameOf, formatFeet } from "./frame.ts";
import type { Plan } from "./plan.ts";

const shed: Plan = {
  title: "10×12 ft shed",
  structureType: "shed",
  photoReadings: [],
  siteNotes: "",
  dimensions: { widthFt: 10, lengthFt: 12, wallHeightFt: 8, roof: "gable 4/12" },
  rooms: [{ name: "Main", x: 0, y: 0, w: 10, h: 12 }],
  openings: [{ kind: "door", wall: "s", offsetFt: 3.5, widthFt: 3 }],
  materials: [],
  steps: [{ title: "Pad", detail: "Level it." }],
  warnings: [],
  costRange: "$2,150 materials",
};

test("a 10×12 shed has a cut list and frame marks", () => {
  const frame = frameOf(shed);
  const joist = frame.cuts.find((row) => row.member === "Floor joist");
  const stud = frame.cuts.find((row) => row.member === "Stud");
  assert.equal(joist?.qty, 10);
  assert.equal(joist?.length, "10 ft");
  assert.equal(stud?.qty, 34);
  assert.equal(formatFeet(frame.studFt), "7 ft 7 1/2 in");
  assert.equal(frame.rafters.length, 10);
  assert.equal(frame.deck, false);
  assert.equal(frame.cuts.length >= 10, true);
});
