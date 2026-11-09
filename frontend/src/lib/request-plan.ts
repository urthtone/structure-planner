import type { Plan, Material, StructureType } from "@/lib/plan";

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

export async function requestPlan(brief: GenerateInput): Promise<GenerateResult> {
  const url = endpoint();
  if (!url) {
    return { ok: false, error: "The photo reader is not connected yet. Add the Azure address in config.js." };
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(brief),
    });
    const body = (await res.json().catch(() => null)) as GenerateResult | null;
    if (body && typeof body === "object" && "ok" in body) return body;
    return { ok: false, error: "Photo reading is not available right now." };
  } catch {
    return { ok: false, error: "Could not reach the photo reader." };
  }
}
