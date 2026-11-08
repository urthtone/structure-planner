import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { FloorPlan } from "./FloorPlan";
import { DEFAULT_INPUT } from "../lib/planning";

it("labels dimensions and shows actual openings with an optional framing layer", () => {
  const svg = renderToStaticMarkup(
    <FloorPlan input={DEFAULT_INPUT} showFraming={true} />,
  );
  expect(svg).toContain("10 ft");
  expect(svg).toContain("12 ft");
  expect(svg).toContain("3-ft door");
  expect(svg).toContain("Joists 16");
  expect(svg.match(/data-window=/g)).toHaveLength(2);
  const deck = renderToStaticMarkup(
    <FloorPlan
      input={{ ...DEFAULT_INPUT, type: "deck", foundation: "piers" }}
      showFraming={false}
    />,
  );
  expect(deck).not.toContain("data-window=");
  expect(deck).not.toContain("3-ft door");
});

it("does not draw wood floor joists in a slab foundation", () => {
  const svg = renderToStaticMarkup(
    <FloorPlan
      input={{ ...DEFAULT_INPUT, foundation: "slab" }}
      showFraming={true}
    />,
  );
  expect(svg).not.toContain('stroke-dasharray="4 3"');
  expect(svg).toContain("Slab");
});
