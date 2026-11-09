import assert from "node:assert/strict";
import test from "node:test";
import { framingTakeoff } from "./takeoff.ts";

test("a 10×12×8 wood shed is a counted framing list", () => {
  const plan = framingTakeoff(
    { structureType: "shed", widthFt: 10, lengthFt: 12, heightFt: 8, estimateSize: false, material: "wood", notes: "" },
    1,
  );
  assert.equal(plan.materials.length >= 12, true);
  assert.equal(plan.steps.length >= 5, true);
  const studs = plan.materials.find((row) => row.item === "Wall studs");
  assert.equal(studs?.qty, "42 pcs");
  const joists = plan.materials.find((row) => row.item === "Floor joists");
  assert.equal(joists?.qty, "10 pcs");
  assert.match(plan.costRange, /^\$\d{1,3}(,\d{3})* materials$/);
  assert.equal(plan.costRange.includes("–"), false);
  const total = Number(plan.costRange.replace(/[^0-9]/g, ""));
  assert.equal(total > 1500 && total < 4000, true);
});
