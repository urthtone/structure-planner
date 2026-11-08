/** Deterministic preliminary takeoff only. Member sizes require local engineering. */
export type StructureType = "shed" | "deck" | "cabin" | "garage";
export type Foundation = "skids" | "piers" | "slab";
export interface PlanInput {
  type: StructureType;
  width: number;
  length: number;
  height: number;
  material: "wood" | "composite";
  roofStyle: "gable" | "single-slope";
  pitch: number;
  doorWidth: number;
  windows: number;
  foundation: Foundation;
  studSpacing: 16 | 24;
  notes: string;
}
export const DEFAULT_INPUT: PlanInput = {
  type: "shed",
  width: 10,
  length: 12,
  height: 8,
  material: "wood",
  roofStyle: "gable",
  pitch: 6,
  doorWidth: 3,
  windows: 2,
  foundation: "skids",
  studSpacing: 16,
  notes: "",
};

export const PRICE_ITEMS = {
  joists: { label: "PT 2×8 floor joists / rim", unit: "linear ft", price: 2.1 },
  skids: { label: "PT 4×6 skids", unit: "linear ft", price: 4.5 },
  piers: { label: "Pier + base hardware allowance", unit: "each", price: 65 },
  beams: {
    label: "PT 2×10 deck beams (double)",
    unit: "linear ft",
    price: 3.2,
  },
  posts: { label: "PT 6×6 posts", unit: "linear ft", price: 6 },
  floorSheets: {
    label: "3/4-in T&G 4×8 floor sheathing",
    unit: "sheet",
    price: 48,
  },
  studs: {
    label: "2×4 wall framing incl. corners/openings",
    unit: "linear ft",
    price: 0.75,
  },
  plates: {
    label: "2×4 plates (PT bottom where required)",
    unit: "linear ft",
    price: 0.9,
  },
  headers: {
    label: "2×8 header allowance — verify sizing",
    unit: "linear ft",
    price: 2.1,
  },
  wallSheets: {
    label: "7/16-in OSB 4×8 wall sheathing",
    unit: "sheet",
    price: 18,
  },
  siding: { label: "4×8 panel siding", unit: "sheet", price: 42 },
  wrap: { label: "Wall weather barrier", unit: "sq ft", price: 0.2 },
  rafters: {
    label: "2×6 rafters — verify span/load",
    unit: "linear ft",
    price: 1.6,
  },
  ties: { label: "2×4 rafter ties (gable)", unit: "linear ft", price: 0.75 },
  ridge: { label: "2×8 ridge board", unit: "linear ft", price: 2.1 },
  roofSheets: { label: "1/2-in 4×8 roof sheathing", unit: "sheet", price: 24 },
  roofing: {
    label: "Asphalt shingles (100 sq ft)",
    unit: "square",
    price: 125,
  },
  underlayment: { label: "Underlayment (400 sq ft)", unit: "roll", price: 55 },
  dripEdge: { label: "10-ft drip edge", unit: "stick", price: 12 },
  concrete: { label: "Concrete — 4-in slab only", unit: "cu yd", price: 175 },
  gravel: { label: "4-in compacted base allowance", unit: "cu yd", price: 55 },
  vapor: { label: "Slab vapor barrier", unit: "sq ft", price: 0.25 },
  mesh: { label: "Slab reinforcement allowance", unit: "sq ft", price: 0.8 },
  decking: {
    label: "Wood 5.5-in-wide deck boards",
    unit: "linear ft",
    price: 1.9,
  },
  composite: {
    label: "Composite 5.5-in-wide deck boards",
    unit: "linear ft",
    price: 4.5,
  },
  rail: { label: "Deck guardrail allowance", unit: "linear ft", price: 35 },
  door: { label: "Door unit / hardware allowance", unit: "each", price: 300 },
  garageDoor: {
    label: "Garage door unit allowance",
    unit: "each",
    price: 1000,
  },
  window: { label: "3×3-ft window unit", unit: "each", price: 180 },
  fasteners: { label: "Nails / screws (5-lb boxes)", unit: "box", price: 30 },
  hardware: {
    label: "Connectors / anchors / flashing allowance",
    unit: "lot",
    price: 180,
  },
} as const;
export type PriceId = keyof typeof PRICE_ITEMS;
export type PriceTable = Record<PriceId, number>;
export const DEFAULT_PRICES = Object.fromEntries(
  Object.entries(PRICE_ITEMS).map(([id, item]) => [id, item.price]),
) as PriceTable;
export interface CutItem {
  piece: string;
  size: string;
  quantity: number;
  length: number;
}
export interface MaterialItem {
  id: PriceId;
  label: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  cost: number;
}
export interface GeneratedPlan {
  geometry: {
    area: number;
    joists: number;
    supportLines: number;
    piers: number;
    studs: number;
    wallArea: number;
    rafters: number;
    rafterLength: number;
    roofArea: number;
    rise: number;
  };
  cutList: CutItem[];
  materials: MaterialItem[];
  total: number;
  warnings: string[];
  steps: string[];
}
const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const waste = 1.1;

export function validateInput(p: PlanInput): void {
  if (!["shed", "deck", "cabin", "garage"].includes(p.type))
    throw new Error("Choose a valid structure.");
  for (const key of ["width", "length"] as const) {
    if (!Number.isFinite(p[key]) || p[key] < 6 || p[key] > 60)
      throw new Error(`${key} must be between 6 and 60 ft.`);
  }
  if (
    !Number.isFinite(p.height) ||
    p.height < (p.type === "deck" ? 1 : 8) ||
    p.height > 12
  )
    throw new Error("Height must be 8–12 ft (deck platform: 1–12 ft).");
  if (
    ![4, 6, 8, 12].includes(p.pitch) ||
    !["gable", "single-slope"].includes(p.roofStyle)
  )
    throw new Error("Choose a supported roof and pitch.");
  if (![16, 24].includes(p.studSpacing))
    throw new Error("Stud spacing must be 16 or 24 inches.");
  if (!["skids", "piers", "slab"].includes(p.foundation))
    throw new Error("Choose a valid foundation.");
  if (p.type === "deck" && p.foundation !== "piers")
    throw new Error("This freestanding deck estimate requires piers.");
  if (p.type === "garage" && p.foundation !== "slab")
    throw new Error("This garage shell estimate requires a slab.");
  if (
    p.material !== "wood" &&
    !(p.material === "composite" && p.type === "deck")
  )
    throw new Error(
      "Only wood framing and optional composite deck boards are supported.",
    );
  if (
    !Number.isFinite(p.doorWidth) ||
    p.doorWidth < 2 ||
    p.doorWidth > p.width - 2
  )
    throw new Error(
      "Door width must be at least 2 ft and leave 1 ft at each front corner.",
    );
  if (
    !Number.isInteger(p.windows) ||
    p.windows < 0 ||
    p.windows > Math.min(8, 2 * Math.floor((p.length - 2) / 4))
  )
    throw new Error(
      "Window count exceeds side-wall space (3-ft windows, 1-ft gaps, up to 8).",
    );
}

export function generatePlan(
  p: PlanInput,
  prices: PriceTable = DEFAULT_PRICES,
): GeneratedPlan {
  validateInput(p);
  for (const id of Object.keys(PRICE_ITEMS) as PriceId[]) {
    if (!Number.isFinite(prices[id]) || prices[id] < 0 || prices[id] > 100000)
      throw new Error(`Invalid example price: ${id}`);
  }
  const { width: w, length: l, height: h } = p;
  const deck = p.type === "deck";
  const slab = p.foundation === "slab";
  const gable = p.roofStyle === "gable";
  const area = w * l;
  const perimeter = 2 * (w + l);
  const joists = slab ? 0 : Math.ceil((l * 12) / 16) + 1;
  const supportLines = slab ? 0 : Math.ceil(w / 4) + 1;
  const piers = supportLines * (Math.ceil(l / 6) + 1);
  const rise = deck ? 0 : ((gable ? w / 2 : w) * p.pitch) / 12;
  const rafterLength = deck
    ? 0
    : ((gable ? w / 2 : w) + (gable ? 1 : 2)) * Math.hypot(1, p.pitch / 12);
  const rafterStations = Math.ceil((l * 12) / 16) + 1;
  const rafters = deck ? 0 : rafterStations * (gable ? 2 : 1);
  const roofArea = deck ? 0 : rafterLength * (l + 2) * (gable ? 2 : 1);
  const wallArea = deck
    ? 0
    : perimeter * h + (gable ? w * rise : (w + l) * rise);
  // Gross stud grid retained at openings, plus corner/king/jack/cripple allowances.
  const studs = deck
    ? 0
    : 2 * (Math.ceil((w * 12) / p.studSpacing) + 1) +
      2 * (Math.ceil((l * 12) / p.studSpacing) + 1) +
      8 +
      4 +
      p.windows * 6;
  const cutList: CutItem[] = [];
  const materials: MaterialItem[] = [];
  const cut = (
    piece: string,
    size: string,
    quantity: number,
    length: number,
  ) => {
    if (quantity > 0) cutList.push({ piece, size, quantity, length });
  };
  const add = (id: PriceId, quantity: number) => {
    if (quantity <= 0) return;
    materials.push({
      id,
      label: PRICE_ITEMS[id].label,
      unit: PRICE_ITEMS[id].unit,
      quantity,
      unitPrice: prices[id],
      cost: round(quantity * prices[id]),
    });
  };
  // Waste applied once here; cut list remains net. Linear-foot purchases are allowances.
  const linear = (id: PriceId, ft: number) =>
    add(id, Math.ceil(ft * waste - 1e-9));
  if (slab) {
    add("concrete", round((area / 3 / 27) * waste));
    add("gravel", round((area / 3 / 27) * waste));
    add("vapor", Math.ceil(area * waste));
    add("mesh", Math.ceil(area * waste));
  } else {
    cut("Floor joist", "PT 2×8", joists, w);
    cut("Rim joist", "PT 2×8", 2, l);
    linear("joists", joists * w + 2 * l);
    if (p.foundation === "skids") {
      cut("Skid", "PT 4×6", supportLines, l);
      linear("skids", supportLines * l);
      add("gravel", round((area / 3 / 27) * waste));
    } else {
      add("piers", piers);
      if (deck) {
        cut("Double beam ply", "PT 2×10", supportLines * 2, l);
        cut("Post (field-trim to platform height)", "PT 6×6", piers, h);
        linear("beams", supportLines * 2 * l);
        linear("posts", piers * h);
      } else {
        cut("Pier-supported bearer", "PT 4×6", supportLines, l);
        linear("skids", supportLines * l);
      }
    }
    if (deck) {
      const boards = Math.ceil(l / (5.5 / 12));
      cut(
        "Deck board",
        p.material === "composite" ? "Composite 5.5-in" : "PT 5/4×6",
        boards,
        w,
      );
      linear(p.material === "composite" ? "composite" : "decking", boards * w);
      linear("rail", perimeter); // Local code determines whether guards are required.
    } else add("floorSheets", Math.ceil((area * waste) / 32));
  }
  if (!deck) {
    cut("Wall stud incl. opening/corner allowance", "2×4", studs, h - 4.5 / 12);
    cut("Width-wall plates (1 bottom + 2 top)", "2×4", 6, w);
    cut("Length-wall plates (1 bottom + 2 top)", "2×4", 6, l);
    cut("Door header ply (provisional)", "2×8", 2, p.doorWidth + 0.5);
    cut("Window header ply (provisional)", "2×8", p.windows * 2, 3.5);
    cut("Window sill", "2×4", p.windows, 3);
    const rakeCount = 2 * (Math.ceil((w * 12) / p.studSpacing) + 1);
    const highCount = gable ? 0 : Math.ceil((l * 12) / p.studSpacing) + 1;
    cut(
      gable
        ? "Gable infill (average, field fit)"
        : "Rake-wall infill (average, field fit)",
      "2×4",
      rakeCount,
      rise / 2,
    );
    cut(
      "High-wall stud extension",
      "2×4 allowance only — not a splice",
      highCount,
      rise,
    );
    const extraWallLength = (rakeCount * rise) / 2 + highCount * rise;
    linear("studs", studs * (h - 4.5 / 12) + p.windows * 3 + extraWallLength);
    linear("plates", perimeter * 3);
    linear("headers", 2 * (p.doorWidth + 0.5) + p.windows * 7);
    add("wallSheets", Math.ceil((wallArea * waste) / 32));
    add("siding", Math.ceil((wallArea * waste) / 32));
    add("wrap", Math.ceil(wallArea * waste));
    cut("Rafter (geometric, before joinery)", "2×6", rafters, rafterLength);
    linear("rafters", rafters * rafterLength);
    if (gable) {
      cut("Ridge board", "2×8", 1, l);
      cut("Rafter tie", "2×4", rafterStations, w);
      linear("ridge", l);
      linear("ties", rafterStations * w);
    }
    add("roofSheets", Math.ceil((roofArea * waste) / 32));
    add("roofing", Math.ceil(roofArea * waste) / 100);
    add("underlayment", Math.ceil((roofArea * waste) / 400));
    const edgeLength = 2 * (l + 2) + (gable ? 4 : 2) * rafterLength;
    add("dripEdge", Math.ceil((edgeLength * waste) / 10));
    add(p.type === "garage" ? "garageDoor" : "door", 1);
    add("window", p.windows);
  }
  add(
    "fasteners",
    Math.ceil(((area + wallArea + roofArea) * 0.025 * waste) / 5),
  );
  add("hardware", 1);
  const warnings = [
    "PRELIMINARY ESTIMATE — not engineered drawings or a permit-ready plan. Verify spans, member sizes, connections, anchorage, soil, frost depth, wind/snow loads, permits and setbacks locally before construction.",
    "Example/default USD prices, not quotes. Approximately 10% purchasing waste. Excludes labor, tax, delivery, tools, paint, utilities and engineered footing details.",
    "Cut lengths are geometric/net allowances before joinery and stock-length optimization. Gross wall studs/sheets intentionally do not deduct openings; opening framing and infill are allowances, not a fabrication schedule.",
  ];
  if (p.type === "cabin")
    warnings.push(
      "Cabin is a shell estimate only, not a habitable building design; insulation, utilities, interior finish and residential compliance are excluded.",
    );
  if (p.type === "garage")
    warnings.push(
      "Garage door headers and lateral bracing require engineering. Slab excludes footings/thickened edges.",
    );
  if (deck)
    warnings.push(
      "Freestanding deck only. Beam, post and joist sizing, guards and footing depths need local verification; stairs/ledger details are excluded.",
    );
  if (!gable && !deck)
    warnings.push(
      "Single-slope height is the low eave; the high eave is taller by the calculated roof rise. Infill lengths are average allowances; field-fit a reviewed wall layout. High-wall extensions describe extra material only, NOT stud splices: use reviewed continuous-height wall framing.",
    );
  const foundationStep =
    p.foundation === "skids"
      ? `Prepare drained compacted gravel; level ${supportLines} lengthwise skids and specify uplift anchorage with a local professional.`
      : p.foundation === "piers"
        ? `Lay out approximately ${piers} piers in ${supportLines} support lines; confirm soil bearing, frost depth and uplift hardware, then fit ${deck ? "posts and double beams" : "bearers"}.`
        : "Form a slab with compacted base, vapor barrier and reinforcement; have local footing/frost/anchorage details designed before pouring. Allow proper cure time.";
  const steps = [
    `Confirm the ${p.type} footprint (${w} × ${l} ft), boundaries, utilities, drainage and local permit/load requirements; obtain reviewed construction details.`,
    foundationStep,
    ...(slab
      ? [
          "Mark and anchor PT sill plates to the cured slab using the reviewed anchor schedule.",
        ]
      : [
          `Square the ${joists}-joist floor frame at 16 in OC, fix rims and ${deck ? "fit decking with manufacturer gaps" : "install staggered 3/4-in T&G floor sheets; support sheet edges and follow the fastening schedule"}.`,
        ]),
    ...(deck
      ? [
          "Install code-appropriate guards and safe access; verify all connectors, footing bearing and final inspection.",
        ]
      : [
          `Frame ${h}-ft low-eave walls at ${p.studSpacing} in OC with bottom/double-top plates, corners, one ${p.doorWidth}-ft door and ${p.windows} assumed 3×3-ft windows. Have headers and bracing sized before cutting.`,
          `Plumb and brace walls; frame the ${p.roofStyle} roof at ${p.pitch}/12 pitch (${round(rise)}-ft rise), with ${rafters} rafters${gable ? ", ridge board and rafter ties" : " and a taller support wall"}. Follow reviewed uplift/connection details.`,
          `Install roof sheathing, drip edge, underlayment and ${round(roofArea)} sq ft of sloped roofing (before waste); detail ventilation and flashing.`,
          "Install wall sheathing, weather barrier, flashed door/windows and siding. Complete anchors, weatherproofing and required inspections before use.",
        ]),
  ];
  return {
    geometry: {
      area,
      joists,
      supportLines,
      piers: p.foundation === "piers" ? piers : 0,
      studs,
      wallArea,
      rafters,
      rafterLength,
      roofArea,
      rise,
    },
    cutList,
    materials,
    total: round(materials.reduce((sum, m) => sum + m.cost, 0)),
    warnings,
    steps,
  };
}
