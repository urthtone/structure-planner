export const FAB_PROJECT_TYPES = ['blind', 'trailer', 'gate', 'carport'] as const;
export type FabProjectType = (typeof FAB_PROJECT_TYPES)[number];
export const WALL_SIDES = ['front', 'back', 'left', 'right'] as const;
export type WallSide = (typeof WALL_SIDES)[number];

export interface FabOpening {
  kind: 'door' | 'window';
  /** front/back are the long (lengthFt) walls; left/right are the end (widthFt) walls. */
  wall: WallSide;
  widthIn: number;
  heightIn: number;
  /** Window sill height above the top of the floor frame (in). Doors ignore it. */
  sillIn?: number;
  /** Rough-opening left edge measured from the wall's outside left corner (in). Omit to auto-space. */
  offsetIn?: number;
  /** Doors: weld up a leaf from the `leaf` profile instead of buying a door unit. */
  fabricateLeaf?: boolean;
}

export interface FabOptions {
  /** Corner joints for perimeter frames. butt = long members run through. */
  joint?: 'butt' | 'miter';
  roofStyle?: 'flat' | 'gable';
  /** Roof rise per 12 in of run (gable). */
  roofPitch?: number;
  // Trailer
  tongueLengthFt?: number;
  tongueStyle?: 'a-frame' | 'straight';
  axles?: 1 | 2;
  axleRatingLb?: number;
  sideRailHeightIn?: number;
  brakes?: boolean;
  // Gate / fence
  gateMode?: 'gate' | 'fence';
  leaves?: 1 | 2;
  infill?: 'pickets' | 'sheet' | 'mesh' | 'none';
  /** Max clear gap between pickets (in). */
  infillGapIn?: number;
  postEmbedIn?: number;
  groundClearanceIn?: number;
  gateCount?: number;
  gateWidthFt?: number;
  // Carport / building
  enclosed?: boolean;
  postBase?: 'plate' | 'embed';
}

export interface FabSpec {
  projectType: FabProjectType;
  title?: string;
  /** blind/carport: end-wall width / span; trailer: deck width; gate: opening width. */
  widthFt: number;
  /** blind/carport: long-wall length; trailer: deck length; fence: run length. */
  lengthFt: number;
  /** blind: wall frame height; gate/fence: height; carport: eave/leg height; trailer: unused. */
  heightFt: number;
  /** Role → profile id. Unspecified roles use per-type defaults (see ROLE_DEFAULTS). */
  profiles?: Record<string, string>;
  /** Role → maximum on-center spacing (in). */
  spacingIn?: Record<string, number>;
  openings?: FabOpening[];
  skin?: { wallPanel?: string | null; roofPanel?: string | null; floorPanel?: string | null; overhangIn?: number };
  stock?: { lengthsFt?: number[]; kerfIn?: number; trimIn?: number };
  options?: FabOptions;
  /** Optional per-profile $/ft overrides for the example cost. */
  prices?: { steelPerFt?: Record<string, number> };
}

/** Angle measured from a square (90°) cut. 0 = square, 45 = 45° miter. */
export interface EndCut { angleDeg: number; note?: string }
export interface Placement { view: string; x1: number; y1: number; x2: number; y2: number }
export interface Mark { atIn: number; note: string; holeDiaIn?: number }

export interface MemberDraft {
  group: string;
  name: string;
  role: string;
  profileId: string;
  lengthIn: number;
  qty: number;
  ends: [EndCut, EndCut];
  /** Both ends cut in the same direction (e.g. rafter plumb cuts) rather than opposed. */
  parallelEnds?: boolean;
  notes?: string[];
  marks?: Mark[];
  placements?: Placement[];
  /** Positions along the member (in from its start) where a splice may land, e.g. post centers. */
  supports?: number[];
  /** Fraction of an all-around weld at each end (default 1). 0 for bolted/screwed members. */
  weldFactor?: number;
}

export interface ViewDef { id: string; title: string; widthIn: number; heightIn: number; context?: Placement[]; notes?: string[] }
export interface HardwareItem { item: string; qty: number; unit: string; examplePrice: number; notes?: string }
export interface PanelNeed { productId: string; use: string; pieces: number; lengthIn: number; notes?: string }

export interface GeneratorOutput {
  title: string;
  members: MemberDraft[];
  hardware: HardwareItem[];
  panels: PanelNeed[];
  views: ViewDef[];
  warnings: string[];
  assumptions: string[];
  groups: Record<string, string>;
}

export interface CutListLine {
  label: string;
  group: string;
  groupName: string;
  name: string;
  role: string;
  profileId: string;
  profileName: string;
  lengthIn: number;
  lengthText: string;
  lengthInText: string;
  qty: number;
  ends: [EndCut, EndCut];
  endsText: string;
  parallelEnds: boolean;
  notes: string[];
  marks: Mark[];
  weightLbEach: number;
}

export interface StickPlan { stockLengthIn: number; drop?: boolean; cuts: { label: string; lengthIn: number }[]; offcutIn: number }
export interface ProfileNesting {
  profileId: string;
  profileName: string;
  sticks: { stockLengthFt: number; count: number; drop?: boolean }[];
  totalSticks: number;
  bars: StickPlan[];
  purchasedIn: number;
  usedIn: number;
  wastePct: number;
  usableOffcutsIn: number[];
}
export interface NestingResult { kerfIn: number; trimIn: number; stockLengthsFt: number[]; profiles: ProfileNesting[]; purchasedFt: number; usedFt: number; wastePct: number }

export interface BomLine { item: string; qty: number; unit: string; weightLb?: number; examplePrice: number; exampleCost: number; notes?: string }
export interface FabBom {
  steel: (BomLine & { profileId: string; linearFt: number; sticks: string })[];
  panels: BomLine[];
  hardware: BomLine[];
  consumables: BomLine[];
  totals: { steelWeightLb: number; panelWeightLb: number; weldInches: number; paintSqFt: number; exampleCost: { steel: number; panels: number; hardware: number; consumables: number; total: number } };
  priceNote: string;
}

export interface FabResult {
  title: string;
  projectType: FabProjectType;
  spec: FabSpec;
  cutList: CutListLine[];
  nesting: NestingResult;
  bom: FabBom;
  plans: { parts: { label: string; svg: string }[]; assembly: { id: string; title: string; svg: string }[] };
  warnings: string[];
  assumptions: string[];
}
