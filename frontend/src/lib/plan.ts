import { z } from "zod";
import { framingTakeoff } from "@/lib/takeoff";

export const STRUCTURES = ["shed", "deck", "cabin", "garage"] as const;
export type StructureType = (typeof STRUCTURES)[number];

export const MATERIALS = ["wood", "metal", "composite", "concrete"] as const;
export type Material = (typeof MATERIALS)[number];

export const MAX_PHOTOS = 5;

/** Stay under the photo reader's 1,600,000 character cap, with room to spare. */
export const MAX_PHOTO_DATA_URL = 350_000;

export const planSchema = z.object({
  title: z.string().min(1).max(120),
  structureType: z.enum(STRUCTURES),
  photoReadings: z
    .array(z.object({ index: z.number().int().min(1).max(MAX_PHOTOS), reading: z.string().max(400) }))
    .max(MAX_PHOTOS),
  siteNotes: z.string().max(800),
  dimensions: z.object({
    widthFt: z.number().positive().max(120),
    lengthFt: z.number().positive().max(120),
    wallHeightFt: z.number().positive().max(40),
    roof: z.string().max(80),
  }),
  rooms: z
    .array(
      z.object({
        name: z.string().max(40),
        x: z.number().min(0).max(120),
        y: z.number().min(0).max(120),
        w: z.number().positive().max(120),
        h: z.number().positive().max(120),
      }),
    )
    .max(8),
  openings: z
    .array(
      z.object({
        kind: z.enum(["door", "window", "stairs"]),
        wall: z.enum(["n", "s", "e", "w"]),
        offsetFt: z.number().min(0).max(120),
        widthFt: z.number().positive().max(40),
      }),
    )
    .max(12),
  materials: z
    .array(
      z.object({
        item: z.string().max(80),
        qty: z.string().max(40),
        notes: z.string().max(160),
      }),
    )
    .max(16),
  steps: z
    .array(z.object({ title: z.string().max(80), detail: z.string().max(400) }))
    .min(1)
    .max(10),
  warnings: z.array(z.string().max(240)).max(6),
  costRange: z.string().max(80),
});

export type Plan = z.infer<typeof planSchema>;

export type Brief = {
  structureType: StructureType;
  widthFt?: number;
  lengthFt?: number;
  heightFt?: number;
  estimateSize: boolean;
  material: Material;
  notes: string;
};

export function fallbackPlan(brief: Brief, photoCount: number): Plan {
  return framingTakeoff(brief, photoCount);
}
