import { z } from 'zod';

export const structureTypes = ['shed','deck','cabin','garage'] as const;
/** Matches the supplied bluehost-BoaV2Lvu.js Zod expression, including limits. */
export const planSchema = z.object({
  title:z.string().min(1).max(120),
  structureType:z.enum(structureTypes),
  photoReadings:z.array(z.object({index:z.number().int().min(1).max(10),reading:z.string().max(400)})).max(10),
  siteNotes:z.string().max(800),
  dimensions:z.object({widthFt:z.number().positive().max(120),lengthFt:z.number().positive().max(120),wallHeightFt:z.number().positive().max(40),roof:z.string().max(80)}),
  rooms:z.array(z.object({name:z.string().max(40),x:z.number().min(0).max(120),y:z.number().min(0).max(120),w:z.number().positive().max(120),h:z.number().positive().max(120)})).max(8),
  openings:z.array(z.object({kind:z.enum(['door','window','stairs']),wall:z.enum(['n','s','e','w']),offsetFt:z.number().min(0).max(120),widthFt:z.number().positive().max(40)})).max(12),
  materials:z.array(z.object({item:z.string().max(80),qty:z.string().max(40),notes:z.string().max(160)})).max(16),
  steps:z.array(z.object({title:z.string().max(80),detail:z.string().max(400)})).min(1).max(10),
  warnings:z.array(z.string().max(240)).max(6),
  costRange:z.string().max(160),
});
export type StructurePlan = z.infer<typeof planSchema>;

export const planInputSchema = z.object({
  structureType:z.enum(structureTypes),
  widthFt:z.number().positive().max(120).optional(),
  lengthFt:z.number().positive().max(120).optional(),
  heightFt:z.number().positive().max(40).optional(),
  estimateSize:z.boolean(),
  material:z.enum(['wood','metal','composite','concrete']),
  notes:z.string().max(800),
}).refine(value=>value.estimateSize || (value.widthFt!==undefined && value.lengthFt!==undefined && value.heightFt!==undefined));
export type PlanInput = z.infer<typeof planInputSchema>;

/** An unscaled photograph cannot supply reliable measurements. These are assumptions. */
export function planningDimensions(input: PlanInput) {
  const defaults = {
    shed:{widthFt:10,lengthFt:12,wallHeightFt:8},
    deck:{widthFt:12,lengthFt:12,wallHeightFt:3},
    cabin:{widthFt:10,lengthFt:12,wallHeightFt:8},
    garage:{widthFt:12,lengthFt:20,wallHeightFt:8},
  };
  return input.estimateSize ? defaults[input.structureType] : {
    widthFt:input.widthFt!,lengthFt:input.lengthFt!,wallHeightFt:input.heightFt!,
  };
}

export function validatePlan(value: unknown, input: PlanInput, imageCount: number): StructurePlan {
  const plan=planSchema.parse(value);
  const dimensions=planningDimensions(input);
  if(plan.structureType!==input.structureType ||
    Object.entries(dimensions).some(([key,number])=>Math.abs(plan.dimensions[key as keyof typeof dimensions]-number)>1e-6))
    throw new Error('Plan changed the specified dimensions or structure.');
  const indices=new Set(plan.photoReadings.map(reading=>reading.index));
  if(plan.photoReadings.length!==imageCount || indices.size!==imageCount || [...indices].some(index=>index>imageCount))
    throw new Error('Photo readings do not match the submitted photos.');
  if(plan.rooms.some(room=>room.x+room.w>dimensions.widthFt+1e-6 || room.y+room.h>dimensions.lengthFt+1e-6))
    throw new Error('Room outside footprint.');
  if(plan.openings.some(opening=>opening.offsetFt+opening.widthFt>(['n','s'].includes(opening.wall)?dimensions.widthFt:dimensions.lengthFt)+1e-6))
    throw new Error('Opening outside wall.');
  const warnings=[
    'Conceptual AI draft, not engineered drawings. Verify permits, setbacks, ground conditions and all structural sizes with qualified local professionals.',
    'Material quantities and costs are illustrative AI estimates, not a verified takeoff or supplier quote.',
  ];
  if(input.estimateSize){
    warnings.push('Dimensions are assumed planning defaults, not measurements from unscaled photos. Measure the site before ordering or building.');
    plan.siteNotes=('Dimensions assumed for planning, not measured from photos. '+plan.siteNotes).slice(0,800);
  }
  plan.warnings=[...warnings,...plan.warnings].slice(0,6);
  plan.costRange=('Example allowance, not a quote: '+(plan.costRange || 'verify local supplier prices')).slice(0,160);
  return planSchema.parse(plan);
}
