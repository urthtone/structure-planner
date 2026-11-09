/**
 * Steel stock catalog. Weights (lb/ft) are nominal values from published
 * mill/distributor charts (ASTM A500 HSS tube per Bull Moose Tube / Maruichi
 * charts; A36 angle, channel, flat and square bar per AISC/standard tables;
 * Schedule 40 pipe per ASME B36.10). They are for estimating only.
 *
 * examplePricePerFt values are ILLUSTRATIVE EXAMPLE PRICES (late-2026 retail
 * ballpark), not quotes. Always replace with your supplier's prices.
 */
export type ProfileShape = 'square-tube' | 'rect-tube' | 'angle' | 'channel' | 'flat-bar' | 'square-bar' | 'pipe';

export interface SteelProfile {
  id: string;
  name: string;
  shape: ProfileShape;
  /** Face width seen in plan/elevation when the member is laid in a frame (in). */
  faceIn: number;
  /** Depth perpendicular to the face (in). */
  depthIn: number;
  /** Wall / leg / web thickness (in). */
  thicknessIn: number;
  lbPerFt: number;
  /** Outer surface perimeter used for paint and weld estimates (in). */
  perimeterIn: number;
  examplePricePerFt: number;
}

const tube = (id: string, name: string, b: number, d: number, t: number, lbPerFt: number, price: number): SteelProfile => ({
  id, name, shape: b === d ? 'square-tube' : 'rect-tube', faceIn: b, depthIn: d, thicknessIn: t, lbPerFt,
  perimeterIn: 2 * (b + d), examplePricePerFt: price,
});
const angle = (id: string, name: string, leg: number, t: number, lbPerFt: number, price: number): SteelProfile => ({
  id, name, shape: 'angle', faceIn: leg, depthIn: leg, thicknessIn: t, lbPerFt, perimeterIn: 4 * leg, examplePricePerFt: price,
});
const channel = (id: string, name: string, d: number, bf: number, tw: number, lbPerFt: number, price: number): SteelProfile => ({
  id, name, shape: 'channel', faceIn: bf, depthIn: d, thicknessIn: tw, lbPerFt, perimeterIn: 2 * d + 4 * bf, examplePricePerFt: price,
});
const flat = (id: string, name: string, w: number, t: number, price: number): SteelProfile => ({
  id, name, shape: 'flat-bar', faceIn: w, depthIn: t, thicknessIn: t, lbPerFt: round(w * t * 3.4, 3), perimeterIn: 2 * (w + t), examplePricePerFt: price,
});
const round = (n: number, digits = 2) => Math.round(n * 10 ** digits) / 10 ** digits;

export const PROFILES: readonly SteelProfile[] = [
  // Square tube, ASTM A500 (lb/ft from Bull Moose Tube A500 chart, Feb 2022)
  tube('sq-1x1-14ga', '1" × 1" × 14ga (0.083") sq tube', 1, 1, 0.083, 0.976, 1.15),
  tube('sq-1x1-11ga', '1" × 1" × 11ga (0.120") sq tube', 1, 1, 0.12, 1.311, 1.45),
  tube('sq-1.5x1.5-14ga', '1-1/2" × 1-1/2" × 14ga sq tube', 1.5, 1.5, 0.083, 1.54, 1.6),
  tube('sq-1.5x1.5-11ga', '1-1/2" × 1-1/2" × 11ga sq tube', 1.5, 1.5, 0.12, 2.128, 2.05),
  tube('sq-2x2-14ga', '2" × 2" × 14ga (0.083") sq tube', 2, 2, 0.083, 2.105, 2.0),
  tube('sq-2x2-11ga', '2" × 2" × 11ga (0.120") sq tube', 2, 2, 0.12, 2.944, 2.6),
  tube('sq-2x2-3/16', '2" × 2" × 3/16" sq tube', 2, 2, 0.188, 4.318, 3.85),
  tube('sq-2.5x2.5-11ga', '2-1/2" × 2-1/2" × 11ga sq tube', 2.5, 2.5, 0.12, 3.761, 3.3),
  tube('sq-3x3-11ga', '3" × 3" × 11ga sq tube', 3, 3, 0.12, 4.578, 4.1),
  tube('sq-3x3-3/16', '3" × 3" × 3/16" sq tube', 3, 3, 0.188, 6.87, 5.9),
  tube('sq-4x4-11ga', '4" × 4" × 11ga sq tube', 4, 4, 0.12, 6.211, 5.6),
  tube('sq-4x4-3/16', '4" × 4" × 3/16" sq tube', 4, 4, 0.188, 9.422, 8.2),
  // Rectangular tube (same perimeter/wall as the equivalent square in A500 charts)
  tube('rect-2x3-14ga', '2" × 3" × 14ga rect tube', 2, 3, 0.083, 2.67, 2.45),
  tube('rect-2x3-11ga', '2" × 3" × 11ga rect tube', 2, 3, 0.12, 3.761, 3.3),
  tube('rect-2x4-11ga', '2" × 4" × 11ga rect tube', 2, 4, 0.12, 4.578, 4.1),
  tube('rect-2x4-3/16', '2" × 4" × 3/16" rect tube', 2, 4, 0.188, 6.87, 5.9),
  tube('rect-2x6-3/16', '2" × 6" × 3/16" rect tube', 2, 6, 0.188, 9.422, 8.4),
  // Hot-rolled A36 equal-leg angle (AISC)
  angle('angle-1.5x1.5x1/8', '1-1/2" × 1-1/2" × 1/8" angle', 1.5, 0.125, 1.23, 1.35),
  angle('angle-2x2x1/8', '2" × 2" × 1/8" angle', 2, 0.125, 1.65, 1.7),
  angle('angle-2x2x3/16', '2" × 2" × 3/16" angle', 2, 0.188, 2.44, 2.3),
  angle('angle-2x2x1/4', '2" × 2" × 1/4" angle', 2, 0.25, 3.19, 2.9),
  angle('angle-3x3x3/16', '3" × 3" × 3/16" angle', 3, 0.188, 3.71, 3.4),
  angle('angle-3x3x1/4', '3" × 3" × 1/4" angle', 3, 0.25, 4.9, 4.3),
  // American Standard channel (AISC C-shapes): depth, flange width, web
  channel('channel-c3x4.1', 'C3 × 4.1 channel', 3, 1.41, 0.17, 4.1, 3.7),
  channel('channel-c4x5.4', 'C4 × 5.4 channel', 4, 1.58, 0.184, 5.4, 4.8),
  channel('channel-c5x6.7', 'C5 × 6.7 channel', 5, 1.75, 0.19, 6.7, 6.0),
  channel('channel-c6x8.2', 'C6 × 8.2 channel', 6, 1.92, 0.2, 8.2, 7.3),
  // Flat bar (3.4 lb/ft per sq in of section)
  flat('flat-1x1/8', '1" × 1/8" flat bar', 1, 0.125, 0.55),
  flat('flat-1x1/4', '1" × 1/4" flat bar', 1, 0.25, 0.95),
  flat('flat-1.5x1/4', '1-1/2" × 1/4" flat bar', 1.5, 0.25, 1.35),
  flat('flat-2x1/4', '2" × 1/4" flat bar', 2, 0.25, 1.75),
  flat('flat-2x3/16', '2" × 3/16" flat bar', 2, 0.1875, 1.4),
  // Square bar (pickets)
  { id: 'sqbar-1/2', name: '1/2" square bar', shape: 'square-bar', faceIn: 0.5, depthIn: 0.5, thicknessIn: 0.5, lbPerFt: 0.85, perimeterIn: 2, examplePricePerFt: 0.9 },
  { id: 'sqbar-5/8', name: '5/8" square bar', shape: 'square-bar', faceIn: 0.625, depthIn: 0.625, thicknessIn: 0.625, lbPerFt: 1.33, perimeterIn: 2.5, examplePricePerFt: 1.3 },
  // Schedule 40 pipe (nominal size; OD in name)
  { id: 'pipe-1.25-sch40', name: '1-1/4" sch 40 pipe (1.660" OD)', shape: 'pipe', faceIn: 1.66, depthIn: 1.66, thicknessIn: 0.14, lbPerFt: 2.27, perimeterIn: round(Math.PI * 1.66), examplePricePerFt: 2.6 },
  { id: 'pipe-2-sch40', name: '2" sch 40 pipe (2.375" OD)', shape: 'pipe', faceIn: 2.375, depthIn: 2.375, thicknessIn: 0.154, lbPerFt: 3.65, perimeterIn: round(Math.PI * 2.375), examplePricePerFt: 3.9 },
  { id: 'pipe-3-sch40', name: '3" sch 40 pipe (3.500" OD)', shape: 'pipe', faceIn: 3.5, depthIn: 3.5, thicknessIn: 0.216, lbPerFt: 7.58, perimeterIn: round(Math.PI * 3.5), examplePricePerFt: 7.9 },
];

const byId = new Map(PROFILES.map(p => [p.id, p]));
export const PROFILE_IDS = PROFILES.map(p => p.id);
export function getProfile(id: string): SteelProfile {
  const profile = byId.get(id);
  if (!profile) throw new Error(`Unknown steel profile "${id}".`);
  return profile;
}
export const isProfileId = (id: unknown): id is string => typeof id === 'string' && byId.has(id);

/** Panels and sheet goods used for skins, floors and decks. */
export interface PanelProduct {
  id: string;
  name: string;
  kind: 'panel' | 'sheet' | 'board';
  /** Coverage width per piece (in). Sheets/boards: nominal width. */
  coverageIn: number;
  /** Fixed piece length (in) for sheets/boards; panels are cut-to-length (0). */
  fixedLengthIn: number;
  lbPerSqFt: number;
  /** Example price: per linear foot of panel (cut-to-length) or per piece (fixed). */
  examplePrice: number;
  priceUnit: 'per-lf' | 'per-piece';
}
export const PANELS: readonly PanelProduct[] = [
  { id: 'corrugated-29ga', name: '29ga galvanized 2-1/2" corrugated panel (26" wide, 24" coverage)', kind: 'panel', coverageIn: 24, fixedLengthIn: 0, lbPerSqFt: 0.6, examplePrice: 2.25, priceUnit: 'per-lf' },
  { id: 'corrugated-26ga', name: '26ga galvanized corrugated panel (26" wide, 24" coverage)', kind: 'panel', coverageIn: 24, fixedLengthIn: 0, lbPerSqFt: 0.85, examplePrice: 2.9, priceUnit: 'per-lf' },
  { id: 'r-panel-26ga', name: '26ga R-panel / PBR (36" coverage)', kind: 'panel', coverageIn: 36, fixedLengthIn: 0, lbPerSqFt: 0.95, examplePrice: 3.4, priceUnit: 'per-lf' },
  { id: 'sheet-16ga', name: '16ga HR steel sheet 4×8', kind: 'sheet', coverageIn: 48, fixedLengthIn: 96, lbPerSqFt: 2.5, examplePrice: 145, priceUnit: 'per-piece' },
  { id: 'sheet-14ga', name: '14ga HR steel sheet 4×8', kind: 'sheet', coverageIn: 48, fixedLengthIn: 96, lbPerSqFt: 3.125, examplePrice: 175, priceUnit: 'per-piece' },
  { id: 'expanded-metal-3/4-9ga', name: '3/4" #9 expanded metal 4×8', kind: 'sheet', coverageIn: 48, fixedLengthIn: 96, lbPerSqFt: 0.86, examplePrice: 95, priceUnit: 'per-piece' },
  { id: 'plywood-3/4', name: '3/4" exterior/treated plywood 4×8', kind: 'sheet', coverageIn: 48, fixedLengthIn: 96, lbPerSqFt: 2.2, examplePrice: 62, priceUnit: 'per-piece' },
  { id: 'deck-2x6-treated', name: '2×6 treated deck board (5-1/2" face)', kind: 'board', coverageIn: 5.75, fixedLengthIn: 0, lbPerSqFt: 2.6, examplePrice: 1.35, priceUnit: 'per-lf' },
];
const panelById = new Map(PANELS.map(p => [p.id, p]));
export const PANEL_IDS = PANELS.map(p => p.id);
export function getPanel(id: string): PanelProduct {
  const panel = panelById.get(id);
  if (!panel) throw new Error(`Unknown panel/sheet product "${id}".`);
  return panel;
}
export const isPanelId = (id: unknown): id is string => typeof id === 'string' && panelById.has(id);
