// Pure shared contract: safe to import in the static frontend. No provider/configuration imports.
export interface PhotoAnalysis {
  groundSlope: string;
  groundType: string;
  obstructions: string[];
  sunShade: string;
  styleHints: string[];
  suggestedFoundation: "skids" | "piers" | "slab" | "unknown";
  notes: string[];
}
export function parseAnalysis(value: unknown): PhotoAnalysis {
  if (!value || typeof value !== "object") throw new Error("Invalid analysis.");
  const a = value as Record<string, unknown>;
  const text = (key: string) => {
    const v = a[key];
    if (typeof v !== "string" || v.length > 1500)
      throw new Error("Invalid analysis field.");
    return v;
  };
  const list = (key: string): string[] => {
    const v = a[key];
    if (
      !Array.isArray(v) ||
      v.length > 12 ||
      v.some((item) => typeof item !== "string" || item.length > 1500)
    )
      throw new Error("Invalid analysis list.");
    return v;
  };
  if (
    typeof a.suggestedFoundation !== "string" ||
    !["skids", "piers", "slab", "unknown"].includes(a.suggestedFoundation)
  )
    throw new Error("Invalid foundation suggestion.");
  return {
    groundSlope: text("groundSlope"),
    groundType: text("groundType"),
    obstructions: list("obstructions"),
    sunShade: text("sunShade"),
    styleHints: list("styleHints"),
    suggestedFoundation:
      a.suggestedFoundation as PhotoAnalysis["suggestedFoundation"],
    notes: list("notes"),
  };
}
