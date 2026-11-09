export const WELD_CHOICES = [
  { id: "blind", label: "Box blind", fabType: "blind", width: "6", length: "8", height: "7", profile: "sq-2x2-11ga" },
  { id: "steel-shed", label: "Steel shed", fabType: "blind", width: "10", length: "12", height: "8", profile: "sq-2x2-11ga" },
  { id: "trailer", label: "Trailer", fabType: "trailer", width: "6", length: "12", height: "2", profile: "channel-c4x5.4" },
  { id: "gate", label: "Gate or fence", fabType: "gate", width: "4", length: "12", height: "4", profile: "sq-2x2-14ga" },
  { id: "carport", label: "Carport or steel building", fabType: "carport", width: "12", length: "20", height: "8", profile: "sq-3x3-11ga" },
  { id: "trough", label: "Water trough", fabType: null, width: "2", length: "6", height: "2", profile: "sq-2x2-11ga" },
] as const;

export type WeldChoice = (typeof WELD_CHOICES)[number]["id"];

export const PROFILES = [
  { id: "sq-2x2-11ga", label: "2×2 × 11 ga square tube" },
  { id: "sq-2x2-14ga", label: "2×2 × 14 ga square tube" },
  { id: "sq-1.5x1.5-14ga", label: "1.5×1.5 × 14 ga square tube" },
  { id: "sq-3x3-11ga", label: "3×3 × 11 ga square tube" },
  { id: "sq-4x4-11ga", label: "4×4 × 11 ga square tube" },
  { id: "rect-2x4-11ga", label: "2×4 × 11 ga rectangle tube" },
  { id: "channel-c4x5.4", label: "C4×5.4 channel" },
] as const;

export type FabView = {
  waiting: boolean;
  title: string;
  message: string;
  cuts: { name: string; qty: string; length: string; ends: string }[];
  stock: { profile: string; stick: string; kerf: string; waste: string };
  parts: string[];
  plans: { title: string; svg?: string }[];
  warnings: string[];
};

export type FabRequest = {
  choice: WeldChoice;
  images: string[];
  widthFt?: number;
  lengthFt?: number;
  heightFt?: number;
  notes: string;
  profileId: string;
  stickFt: number;
  kerfIn: number;
  gateMode: "gate" | "fence";
};

const WAITING = "The shop reader is not connected yet. This was not planned as a shed, and it was not sent to the building planner.";
const TROUGH = "Water troughs are not in the shop reader yet. This was not sent to the building planner.";

function fabEndpoint() {
  if (typeof window === "undefined") return "";
  const explicit = window.HILLTOP_FAB_API?.trim();
  if (explicit) return explicit;
  const plan = window.HILLTOP_PLAN_API?.trim() ?? "";
  return plan.endsWith("/api/plan") ? plan.replace(/\/api\/plan$/, "/api/fab") : "";
}

function profileLabel(id: string) {
  return PROFILES.find((item) => item.id === id)?.label ?? id;
}

function waitingView(input: FabRequest, message: string): FabView {
  const choice = WELD_CHOICES.find((item) => item.id === input.choice);
  return {
    waiting: true,
    title: choice?.label ?? "Welding",
    message,
    cuts: [],
    stock: {
      profile: profileLabel(input.profileId),
      stick: `${input.stickFt} ft`,
      kerf: `${input.kerfIn} in`,
      waste: "Stick nesting will show here when the shop reader is connected.",
    },
    parts: ["Steel weight, hardware, and consumables will show here. Nothing has been priced yet."],
    plans: [{ title: "Drawings will show here when the shop reader is connected." }],
    warnings: ["This is a waiting sheet, not a cut list to buy or weld from."],
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function safeSvg(value: unknown) {
  if (typeof value !== "string") return undefined;
  const svg = value.trim();
  if (!svg.startsWith("<svg") || svg.includes("<script")) return undefined;
  return svg;
}

function viewFromFab(fab: Record<string, unknown>, input: FabRequest): FabView | null {
  const title = typeof fab.title === "string" ? fab.title : "Welding plan";
  const cuts = Array.isArray(fab.cutList)
    ? fab.cutList.slice(0, 40).flatMap((line) => {
        const row = asRecord(line);
        if (!row || typeof row.name !== "string") return [];
        return [
          {
            name: row.name,
            qty: String(row.qty ?? ""),
            length: typeof row.lengthText === "string" ? row.lengthText : "",
            ends: typeof row.endsText === "string" ? row.endsText : "",
          },
        ];
      })
    : [];
  const nesting = asRecord(fab.nesting);
  const bom = asRecord(fab.bom);
  const totals = asRecord(bom?.totals);
  const plans = asRecord(fab.plans);
  const assembly = Array.isArray(plans?.assembly)
    ? plans.assembly.slice(0, 6).flatMap((item) => {
        const row = asRecord(item);
        if (!row || typeof row.title !== "string") return [];
        return [{ title: row.title, svg: safeSvg(row.svg) }];
      })
    : [];
  if (!cuts.length && !assembly.length) return null;
  const warnings = Array.isArray(fab.warnings) ? fab.warnings.filter((item): item is string => typeof item === "string").slice(0, 6) : [];
  return {
    waiting: false,
    title,
    message: "",
    cuts,
    stock: {
      profile: profileLabel(input.profileId),
      stick: Array.isArray(nesting?.stockLengthsFt) ? `${nesting.stockLengthsFt.join(" and ")} ft` : `${input.stickFt} ft`,
      kerf: typeof nesting?.kerfIn === "number" ? `${nesting.kerfIn} in` : `${input.kerfIn} in`,
      waste: typeof nesting?.wastePct === "number" ? `${nesting.wastePct}% waste` : "Waste is on the stock tab when the reader sends it.",
    },
    parts: [
      typeof totals?.steelWeightLb === "number" ? `Steel about ${Math.round(totals.steelWeightLb)} lb.` : "Steel weight was not included.",
    ],
    plans: assembly.length ? assembly : [{ title: "No drawing came back with this plan." }],
    warnings,
  };
}

export async function requestFab(input: FabRequest): Promise<{ kind: "ready"; view: FabView } | { kind: "waiting"; view: FabView } | { kind: "error"; message: string }> {
  if (input.choice === "trough") {
    return { kind: "waiting", view: waitingView(input, TROUGH) };
  }
  const url = fabEndpoint();
  if (!url) return { kind: "waiting", view: waitingView(input, WAITING) };
  const choice = WELD_CHOICES.find((item) => item.id === input.choice);
  const projectType = choice?.fabType;
  if (!projectType) return { kind: "waiting", view: waitingView(input, WAITING) };
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        images: input.images,
        projectType,
        widthFt: input.widthFt,
        lengthFt: input.lengthFt,
        heightFt: input.heightFt,
        notes: input.notes,
        stock: { lengthsFt: [input.stickFt], kerfIn: input.kerfIn },
        profiles: { frame: input.profileId, wall: input.profileId, post: input.profileId },
        options: projectType === "gate" ? { gateMode: input.gateMode } : undefined,
      }),
    });
  } catch {
    return { kind: "waiting", view: waitingView(input, "Could not reach the shop reader. This was not sent to the building planner.") };
  }
  if (response.status === 404 || response.status === 503) {
    return { kind: "waiting", view: waitingView(input, WAITING) };
  }
  const body = (await response.json().catch(() => null)) as { ok?: unknown; error?: unknown; fab?: unknown } | null;
  if (!response.ok || !body || body.ok !== true) {
    const message = body && typeof body.error === "string" && body.error.trim() ? body.error.trim() : `The shop reader returned ${response.status}.`;
    return { kind: "error", message };
  }
  const fab = asRecord(body.fab);
  const view = fab ? viewFromFab(fab, input) : null;
  if (!view) return { kind: "error", message: "The shop reader returned a plan this page could not use. Try again." };
  return { kind: "ready", view };
}
