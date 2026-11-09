import type { Brief, Material, Plan, StructureType } from "@/lib/plan";

type Line = { item: string; qty: string; notes: string; cost: number };

const PRICE = {
  pt4x6x12: 34,
  joist2x6: 12,
  joist2x8: 16,
  stud2x4x8: 5.25,
  stud2x4x10: 8.4,
  sheetT111: 42,
  sheetOsb: 18,
  sheetFloor: 40,
  shingleSquare: 48,
  ridgeCap: 28,
  door36: 229,
  window: 159,
  overhead: 890,
  hardware: 95,
  insulationBag: 68,
  deckBoard: 18,
  compositeBoard: 42,
  post4x4: 16,
  beam2x10: 22,
  railLf: 8,
  cmu: 2.45,
  mortarBag: 9,
  rebar: 8,
  metalPanel: 36,
};

function oc(spanFt: number, spacingIn = 16): number {
  return Math.ceil((spanFt * 12) / spacingIn) + 1;
}

function sheets(sqft: number): number {
  return Math.ceil((sqft * 1.1) / 32);
}

function dollars(amount: number): string {
  return `$${Math.round(amount).toLocaleString("en-US")} materials`;
}

function line(item: string, count: number, unit: string, each: number, notes: string): Line {
  const noun = unit === "ft" ? "ft" : count === 1 ? unit : unit.endsWith("s") ? unit : `${unit}s`;
  return {
    item,
    qty: `${count} ${noun}`,
    notes: `${notes} About $${each} each.`.slice(0, 160),
    cost: Math.round(count * each),
  };
}

export function framingTakeoff(brief: Brief, photoCount: number): Plan {
  const type = brief.structureType;
  const width = brief.widthFt && brief.widthFt > 0 ? brief.widthFt : type === "deck" ? 12 : type === "garage" ? 12 : 10;
  const length = brief.lengthFt && brief.lengthFt > 0 ? brief.lengthFt : type === "garage" ? 20 : 12;
  const height = brief.heightFt && brief.heightFt > 0 ? brief.heightFt : type === "deck" ? 3 : 8;
  const lines = type === "deck" ? deckLines(width, length, height, brief.material) : buildingLines(type, width, length, height, brief.material);
  const total = lines.reduce((sum, item) => sum + item.cost, 0);
  const roof = type === "deck" ? "open, no roof" : type === "cabin" ? "gable 6/12" : "gable 4/12";
  const openings: Plan["openings"] =
    type === "deck"
      ? [{ kind: "stairs", wall: "s", offsetFt: Math.max(1, width / 2 - 1.5), widthFt: 3 }]
      : [
          { kind: "door", wall: "s", offsetFt: Math.max(0.5, width / 2 - 1.5), widthFt: type === "garage" ? Math.min(16, width - 1) : 3 },
          ...(type === "garage" ? [] : [{ kind: "window" as const, wall: "e" as const, offsetFt: 2, widthFt: 3 }]),
        ];
  const studWalls = type !== "deck";
  const joistCount = oc(length);

  return {
    title: `${trim(width)}×${trim(length)} ft ${type}`,
    structureType: type,
    photoReadings: Array.from({ length: photoCount }, (_, index) => ({
      index: index + 1,
      reading: "Photo is on the sheet. This list is the framing takeoff from the sizes, not a read of the picture.",
    })),
    siteNotes:
      brief.notes.trim() ||
      "No extra site notes. The counts below use the width, length, and height on this sheet. Confirm the pad drains away from the structure.",
    dimensions: { widthFt: width, lengthFt: length, wallHeightFt: height, roof },
    rooms:
      type === "cabin" && length >= 16
        ? [
            { name: "Room", x: 0, y: 0, w: width, h: Math.round(length * 0.6) },
            { name: "Bunk", x: 0, y: Math.round(length * 0.6), w: width, h: length - Math.round(length * 0.6) },
          ]
        : [{ name: type === "deck" ? "Deck" : "Main", x: 0, y: 0, w: width, h: length }],
    openings,
    materials: lines.map(({ item, qty, notes }) => ({ item, qty, notes })),
    steps: studWalls
      ? [
          { title: "Stake and square the pad", detail: `Mark ${trim(width)} by ${trim(length)} ft. Diagonals match before any lumber is cut. Slope the grade away.` },
          { title: "Set the skids and floor", detail: `${lineCount(lines, "Skids")} skids run the ${trim(length)} ft length. Then ${joistCount} joists at 16 in. on center spanning ${trim(width)} ft, and the floor sheets.` },
          { title: "Stand the walls", detail: `Plates and studs for ${trim(height)} ft walls. Frame the door and window openings before you sheathe.` },
          { title: "Set the roof", detail: `${roof}. Ridge along the ${trim(length)} ft side, rafters 16 in. on center, then sheathing and roofing.` },
          { title: "Hang the door and window", detail: type === "garage" ? "Set the overhead door after the opening is square and the roof is dry." : "Set the prehung door and the window, then the hardware." },
          { title: "Close it in", detail: "Housewrap or siding, flashing at the openings, and a final check that the floor is still level." },
        ]
      : [
          { title: "Lay out the posts", detail: `Posts on a ${trim(width)} by ${trim(length)} ft grid. Keep them plumb and the tops in one plane, about ${trim(height)} ft above grade.` },
          { title: "Set beams and joists", detail: `${joistCount} joists at 16 in. on center. Beams run the long way under them.` },
          { title: "Deck the floor", detail: brief.material === "composite" ? "Composite boards, gapped for drainage, picture-frame border optional." : "5/4 boards, crown up, nailed or screwed at every joist." },
          { title: "Rails", detail: height > 2 ? "Guard both open sides. Stair rail follows the stringer." : "A single rail is enough if the deck is close to grade. Add one if the drop feels tall." },
          { title: "Stairs", detail: "3 ft stair on the low side. Rise and run stay even for the whole flight." },
        ],
    warnings: [
      "This is a planning sketch, not a permit set or an engineered drawing.",
      "The total is a big-box materials takeoff from the frame counts. Tax, delivery, and labor are extra.",
      "Confirm setbacks, snow load, and frost depth before you buy lumber.",
    ],
    costRange: dollars(total),
  };
}

function lineCount(lines: Line[], item: string): number {
  const found = lines.find((row) => row.item === item);
  const match = found?.qty.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function trim(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10);
}

function buildingLines(type: StructureType, width: number, length: number, height: number, material: Material): Line[] {
  const perimeter = 2 * (width + length);
  const joists = oc(length);
  const studEach = height > 8 ? PRICE.stud2x4x10 : PRICE.stud2x4x8;
  const studStock = height > 8 ? "2×4×10" : "2×4×92-5/8";
  const studs = oc(width) * 2 + oc(length) * 2 - 4 + (type === "garage" ? 4 : 8);
  const plates = Math.ceil((perimeter * 3) / 8);
  const pitch = type === "cabin" ? 6 / 12 : 4 / 12;
  const rafterFt = Math.hypot(width / 2, (width / 2) * pitch) + 0.5;
  const rafters = oc(length) * 2;
  const wallSq = perimeter * height;
  const roofSq = rafterFt * length * 2;
  const floorSq = width * length;
  const lines: Line[] = [
    line("Skids", Math.max(3, Math.ceil(width / 4) + 1), "pc", PRICE.pt4x6x12, `PT 4×6×12 under the ${trim(length)} ft length.`),
    line("Floor joists", joists, "pc", height > 0 && width > 10 ? PRICE.joist2x8 : PRICE.joist2x6, `16 in. o.c. spanning ${trim(width)} ft.`),
    line("Rim joists", 2, "pc", PRICE.joist2x6, `Close the ${trim(length)} ft sides.`),
    line("Floor sheathing", sheets(floorSq), "sheet", PRICE.sheetFloor, "3/4 in. tongue-and-groove."),
    line("Wall plates", plates, "pc", studEach, `Three plates around ${trim(perimeter)} ft.`),
    line("Wall studs", studs, "pc", studEach, `${studStock}, 16 in. o.c., plus trimmers.`),
  ];

  if (material === "concrete") {
    const blocks = Math.ceil(wallSq / 0.89);
    lines.push(
      line("Concrete block", blocks, "block", PRICE.cmu, "8×8×16, two cores."),
      line("Mortar", Math.ceil(blocks / 40), "bag", PRICE.mortarBag, "About 40 blocks a bag."),
      line("Rebar", Math.ceil(perimeter / 4) * Math.ceil(height / 4), "pc", PRICE.rebar, "Verticals about 4 ft apart."),
    );
  } else if (material === "metal") {
    lines.push(line("Metal wall panels", sheets(wallSq), "sheet", PRICE.metalPanel, "3 ft panels, ribs vertical."));
  } else {
    lines.push(line("Wall sheathing", sheets(wallSq), "sheet", PRICE.sheetT111, "T1-11, grooves vertical."));
  }

  lines.push(
    line("Rafters", rafters, "pc", studEach, `${trim(rafterFt)} ft long, 16 in. o.c., ${type === "cabin" ? "6/12" : "4/12"}.`),
    line("Ridge board", Math.ceil(length / 12), "pc", PRICE.joist2x6, `Along the ${trim(length)} ft ridge.`),
    line("Roof sheathing", sheets(roofSq), "sheet", PRICE.sheetOsb, "7/16 in. on the rafters."),
    line(
      "Roofing",
      Math.max(1, Math.ceil((roofSq * 1.15) / 100)),
      "square",
      material === "metal" ? 110 : PRICE.shingleSquare,
      material === "metal" ? "Metal roof panels, exposed fastener." : "Architectural shingles, plus starter.",
    ),
    line("Ridge cap", 1, "bundle", PRICE.ridgeCap, "Cap and drip edge."),
  );

  if (type === "garage") {
    lines.push(line("Overhead door", 1, "door", PRICE.overhead, `Fits an opening up to ${trim(Math.min(16, width - 1))} ft.`));
  } else {
    lines.push(line("Prehung door", 1, "door", PRICE.door36, "3-0 exterior, includes jamb."));
    lines.push(line("Window", type === "cabin" ? 2 : 1, "window", PRICE.window, "Flanged, about 3 ft wide."));
  }

  if (type === "cabin") {
    lines.push(line("Wall insulation", Math.ceil(wallSq / 80), "bag", PRICE.insulationBag, "R-13 batts for the stud bays."));
  }

  lines.push(line("Fasteners and ties", 1, "kit", PRICE.hardware, "Nails, structural screws, hangers, hurricane ties."));
  return lines.slice(0, 16);
}

function deckLines(width: number, length: number, height: number, material: Material): Line[] {
  const joists = oc(length);
  const posts = Math.max(4, (Math.ceil(width / 6) + 1) * (Math.ceil(length / 8) + 1));
  const boards = Math.ceil((width * 12) / 5.5) * Math.ceil(length / 12);
  const boardPrice = material === "composite" ? PRICE.compositeBoard : PRICE.deckBoard;
  const lines: Line[] = [
    line("Posts", posts, "pc", PRICE.post4x4, `4×4, cut to about ${trim(height)} ft above grade.`),
    line("Beams", Math.ceil(length / 8) * 2, "pc", PRICE.beam2x10, "Doubled 2×10 under the joists."),
    line("Joists", joists, "pc", width > 10 ? PRICE.joist2x8 : PRICE.joist2x6, `16 in. o.c. spanning ${trim(width)} ft.`),
    line("Decking", boards, "pc", boardPrice, material === "composite" ? "Composite, 12 ft boards." : "5/4×6×12 boards."),
  ];
  if (height > 2) {
    lines.push(line("Guardrail", Math.ceil(perimeterOpen(width, length)), "ft", PRICE.railLf, "Both open sides and the stair."));
  }
  lines.push(
    line("Stair stringers", 3, "pc", PRICE.joist2x6, "3 ft wide flight on the low side."),
    line("Fasteners and ties", 1, "kit", PRICE.hardware, "Joist hangers, post bases, deck screws."),
  );
  return lines;
}

function perimeterOpen(width: number, length: number): number {
  return 2 * (width + length);
}
