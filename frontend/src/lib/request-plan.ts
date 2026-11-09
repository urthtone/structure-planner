import { planSchema, type Material, type Plan, type StructureType } from "@/lib/plan";

export type GenerateInput = {
  images: string[];
  structureType: StructureType;
  widthFt?: number;
  lengthFt?: number;
  heightFt?: number;
  estimateSize: boolean;
  material: Material;
  notes: string;
};

export type GenerateResult = { ok: true; plan: Plan } | { ok: false; error: string };

function endpoint() {
  if (typeof window === "undefined") return "";
  return window.HILLTOP_PLAN_API?.trim() ?? "";
}

function readResult(body: unknown, status: number): GenerateResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: `The photo reader returned ${status} and no plan.` };
  }
  const record = body as { ok?: unknown; error?: unknown; plan?: unknown };
  if (record.ok === false) {
    const message = typeof record.error === "string" ? record.error.trim() : "";
    return { ok: false, error: message || "The photo reader could not read these photos." };
  }
  if (record.ok !== true) {
    return { ok: false, error: `The photo reader returned status ${status}.` };
  }
  const parsed = planSchema.safeParse(record.plan);
  if (!parsed.success) {
    return { ok: false, error: "The photo reader returned a plan this page could not use. Try again." };
  }
  return { ok: true, plan: parsed.data };
}

export async function requestPlan(brief: GenerateInput): Promise<GenerateResult> {
  const url = endpoint();
  if (!url) {
    return { ok: false, error: "The photo reader is not connected yet. Add the Azure address in config.js." };
  }
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(brief),
    });
  } catch {
    return { ok: false, error: "Could not reach the photo reader." };
  }
  const body = await res.json().catch(() => null);
  return readResult(body, res.status);
}
