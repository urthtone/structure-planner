import { isPanelId, isProfileId } from './profiles';
import { FAB_PROJECT_TYPES, WALL_SIDES, type FabOpening, type FabOptions, type FabProjectType, type FabSpec } from './types';

/** Role → default profile id, per project type. Any role may be overridden in spec.profiles. */
export const ROLE_DEFAULTS: Record<FabProjectType, Record<string, string>> = {
  blind: { floor: 'sq-2x2-11ga', wall: 'sq-2x2-11ga', opening: 'sq-2x2-11ga', roof: 'sq-2x2-11ga', leaf: 'sq-1x1-14ga', tab: 'flat-2x1/4' },
  trailer: { rail: 'channel-c4x5.4', crossmember: 'angle-2x2x3/16', tongue: 'rect-2x4-3/16', siderail: 'sq-1.5x1.5-11ga', stake: 'sq-1.5x1.5-11ga', tab: 'flat-2x1/4' },
  gate: { frame: 'sq-2x2-14ga', brace: 'sq-1.5x1.5-14ga', picket: 'sq-1x1-14ga', post: 'sq-4x4-11ga', rail: 'sq-1.5x1.5-14ga' },
  carport: { post: 'sq-3x3-11ga', header: 'rect-2x4-11ga', rafter: 'rect-2x4-11ga', purlin: 'sq-2x2-14ga', brace: 'sq-2x2-14ga', girt: 'sq-2x2-14ga' },
};
export const ROLE_LABELS: Record<string, string> = {
  floor: 'Floor frame', wall: 'Wall posts & plates', opening: 'Door/window framing', roof: 'Roof purlins/rafters', leaf: 'Door leaf', tab: 'Anchor tabs',
  rail: 'Frame rails', crossmember: 'Crossmembers', tongue: 'Tongue', siderail: 'Side top rail', stake: 'Side stakes',
  frame: 'Gate frame', brace: 'Diagonal / knee brace', picket: 'Pickets', post: 'Posts', header: 'Eave headers', rafter: 'Rafters / truss chords',
  purlin: 'Purlins', girt: 'Wall girts',
};
/** Role → maximum on-center spacing in inches. */
export const SPACING_DEFAULTS: Record<FabProjectType, Record<string, number>> = {
  blind: { floor: 24, wall: 24, roof: 24 },
  trailer: { crossmember: 24, stake: 24 },
  gate: { post: 96 },
  carport: { post: 120, purlin: 48, girt: 48 },
};
export const OPTION_DEFAULTS: Record<FabProjectType, FabOptions> = {
  blind: { joint: 'butt', roofStyle: 'flat', roofPitch: 4 },
  trailer: { joint: 'butt', tongueLengthFt: 4, tongueStyle: 'a-frame', axles: 1, axleRatingLb: 3500, sideRailHeightIn: 15, brakes: false },
  gate: { joint: 'butt', gateMode: 'gate', infill: 'pickets', infillGapIn: 3.75, postEmbedIn: 30, groundClearanceIn: 2, gateCount: 0, gateWidthFt: 4 },
  carport: { joint: 'butt', roofStyle: 'gable', roofPitch: 3, enclosed: false, postBase: 'plate' },
};
export const SKIN_DEFAULTS: Record<FabProjectType, NonNullable<FabSpec['skin']>> = {
  blind: { wallPanel: 'corrugated-29ga', roofPanel: 'corrugated-29ga', floorPanel: 'plywood-3/4', overhangIn: 3 },
  trailer: { wallPanel: null, roofPanel: null, floorPanel: 'deck-2x6-treated', overhangIn: 0 },
  gate: { wallPanel: null, roofPanel: null, floorPanel: null, overhangIn: 0 },
  carport: { wallPanel: 'r-panel-26ga', roofPanel: 'r-panel-26ga', floorPanel: null, overhangIn: 6 },
};
export const DIMENSION_DEFAULTS: Record<FabProjectType, { widthFt: number; lengthFt: number; heightFt: number }> = {
  blind: { widthFt: 6, lengthFt: 8, heightFt: 7 },
  trailer: { widthFt: 6, lengthFt: 12, heightFt: 1.5 },
  gate: { widthFt: 4, lengthFt: 4, heightFt: 4 },
  carport: { widthFt: 12, lengthFt: 20, heightFt: 8 },
};
const DIMENSION_LIMITS: Record<FabProjectType, { width: [number, number]; length: [number, number]; height: [number, number] }> = {
  blind: { width: [3, 20], length: [3, 30], height: [3, 14] },
  trailer: { width: [3, 8.5], length: [4, 30], height: [0, 10] },
  gate: { width: [1, 24], length: [1, 400], height: [2, 12] },
  carport: { width: [8, 40], length: [8, 80], height: [6, 16] },
};

export class FabSpecError extends Error {
  constructor(readonly issues: string[]) { super(issues.join(' ')); }
}

export type NormalizedSpec = Required<Pick<FabSpec, 'projectType' | 'widthFt' | 'lengthFt' | 'heightFt'>> & {
  title: string;
  profiles: Record<string, string>;
  spacingIn: Record<string, number>;
  openings: FabOpening[];
  skin: Required<NonNullable<FabSpec['skin']>>;
  stock: { lengthsFt: number[]; kerfIn: number; trimIn: number };
  options: FabOptions;
  prices: { steelPerFt: Record<string, number> };
};

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** Validate and fill defaults. Throws FabSpecError listing every problem found. */
export function normalizeSpec(input: unknown): NormalizedSpec {
  const raw = obj(input);
  const issues: string[] = [];
  const projectType = raw.projectType as FabProjectType;
  if (!FAB_PROJECT_TYPES.includes(projectType)) throw new FabSpecError([`projectType must be one of ${FAB_PROJECT_TYPES.join(', ')}.`]);
  const dims = DIMENSION_DEFAULTS[projectType];
  const limits = DIMENSION_LIMITS[projectType];
  const dim = (key: 'widthFt' | 'lengthFt' | 'heightFt', range: [number, number]) => {
    const value = raw[key] ?? dims[key];
    if (!num(value) || value < range[0] || value > range[1]) {
      issues.push(`${key} must be a number from ${range[0]} to ${range[1]} ft for ${projectType}.`);
      return dims[key];
    }
    return value;
  };
  const widthFt = dim('widthFt', limits.width);
  const lengthFt = dim('lengthFt', limits.length);
  const heightFt = dim('heightFt', limits.height);

  const profiles = { ...ROLE_DEFAULTS[projectType] };
  for (const [role, id] of Object.entries(obj(raw.profiles))) {
    if (!(role in profiles)) { issues.push(`Unknown role "${role}" for ${projectType}; roles: ${Object.keys(profiles).join(', ')}.`); continue; }
    if (!isProfileId(id)) { issues.push(`Unknown profile "${String(id)}" for role ${role}.`); continue; }
    profiles[role] = id;
  }
  const spacingIn = { ...SPACING_DEFAULTS[projectType] };
  for (const [role, value] of Object.entries(obj(raw.spacingIn))) {
    if (!(role in spacingIn)) { issues.push(`Spacing role "${role}" is not used for ${projectType}; roles: ${Object.keys(spacingIn).join(', ') || 'none'}.`); continue; }
    if (!num(value) || value < 4 || value > 240) { issues.push(`spacingIn.${role} must be 4–240 in.`); continue; }
    spacingIn[role] = value;
  }

  const options: FabOptions = { ...OPTION_DEFAULTS[projectType] };
  const rawOptions = obj(raw.options);
  const enumOpt = <K extends keyof FabOptions>(key: K, allowed: readonly unknown[]) => {
    if (rawOptions[key] === undefined || rawOptions[key] === null) return;
    if (!allowed.includes(rawOptions[key])) issues.push(`options.${String(key)} must be one of ${allowed.join(', ')}.`);
    else (options as Record<string, unknown>)[key] = rawOptions[key];
  };
  const numOpt = <K extends keyof FabOptions>(key: K, min: number, max: number, integer = false) => {
    const value = rawOptions[key];
    if (value === undefined || value === null) return;
    if (!num(value) || value < min || value > max || (integer && !Number.isInteger(value))) issues.push(`options.${String(key)} must be ${integer ? 'an integer' : 'a number'} from ${min} to ${max}.`);
    else (options as Record<string, unknown>)[key] = value;
  };
  enumOpt('joint', ['butt', 'miter']);
  enumOpt('roofStyle', ['flat', 'gable']);
  numOpt('roofPitch', 0.5, 12);
  numOpt('tongueLengthFt', 2, 8);
  enumOpt('tongueStyle', ['a-frame', 'straight']);
  enumOpt('axles', [1, 2]);
  numOpt('axleRatingLb', 1000, 8000);
  numOpt('sideRailHeightIn', 0, 48);
  enumOpt('brakes', [true, false]);
  enumOpt('gateMode', ['gate', 'fence']);
  enumOpt('leaves', [1, 2]);
  enumOpt('infill', ['pickets', 'sheet', 'mesh', 'none']);
  numOpt('infillGapIn', 1, 12);
  numOpt('postEmbedIn', 0, 60);
  numOpt('groundClearanceIn', 0, 12);
  numOpt('gateCount', 0, 6, true);
  numOpt('gateWidthFt', 2, 20);
  enumOpt('enclosed', [true, false]);
  enumOpt('postBase', ['plate', 'embed']);
  if (projectType === 'gate' && options.gateMode === 'fence' && !obj(raw.profiles).post) profiles.post = 'sq-2.5x2.5-11ga';
  if (projectType === 'gate' && options.gateMode === 'gate' && options.leaves === undefined) options.leaves = widthFt > 6 ? 2 : 1;

  const skin = { ...SKIN_DEFAULTS[projectType] } as Required<NonNullable<FabSpec['skin']>>;
  const rawSkin = obj(raw.skin);
  for (const key of ['wallPanel', 'roofPanel', 'floorPanel'] as const) {
    if (!(key in rawSkin)) continue;
    const value = rawSkin[key];
    if (value === null || value === 'none') skin[key] = null;
    else if (isPanelId(value)) skin[key] = value;
    else issues.push(`skin.${key} "${String(value)}" is not a known panel/sheet product.`);
  }
  if (rawSkin.overhangIn !== undefined) {
    if (!num(rawSkin.overhangIn) || rawSkin.overhangIn < 0 || rawSkin.overhangIn > 36) issues.push('skin.overhangIn must be 0–36 in.');
    else skin.overhangIn = rawSkin.overhangIn;
  }

  const rawStock = obj(raw.stock);
  let lengthsFt = [20, 24];
  if (rawStock.lengthsFt !== undefined) {
    const list = rawStock.lengthsFt;
    if (!Array.isArray(list) || !list.length || list.length > 6 || list.some(v => !num(v) || v < 4 || v > 60)) issues.push('stock.lengthsFt must be 1–6 stick lengths from 4 to 60 ft.');
    else lengthsFt = [...new Set(list as number[])].sort((a, b) => a - b);
  }
  let kerfIn = 0.125;
  if (rawStock.kerfIn !== undefined) {
    if (!num(rawStock.kerfIn) || rawStock.kerfIn < 0 || rawStock.kerfIn > 0.5) issues.push('stock.kerfIn must be 0–0.5 in.');
    else kerfIn = rawStock.kerfIn;
  }
  let trimIn = 0.5;
  if (rawStock.trimIn !== undefined) {
    if (!num(rawStock.trimIn) || rawStock.trimIn < 0 || rawStock.trimIn > 6) issues.push('stock.trimIn must be 0–6 in.');
    else trimIn = rawStock.trimIn;
  }

  const openings: FabOpening[] = [];
  const rawOpenings = raw.openings;
  if (rawOpenings !== undefined) {
    if (!Array.isArray(rawOpenings) || rawOpenings.length > 16) issues.push('openings must be an array of at most 16 openings.');
    else if (projectType !== 'blind' && rawOpenings.length) issues.push('openings are only used for blind/shed projects.');
    else rawOpenings.forEach((value, i) => {
      const o = obj(value);
      const where = `openings[${i}]`;
      if (o.kind !== 'door' && o.kind !== 'window') { issues.push(`${where}.kind must be door or window.`); return; }
      if (!WALL_SIDES.includes(o.wall as never)) { issues.push(`${where}.wall must be front, back, left or right.`); return; }
      if (!num(o.widthIn) || o.widthIn < 6 || o.widthIn > 120) { issues.push(`${where}.widthIn must be 6–120.`); return; }
      if (!num(o.heightIn) || o.heightIn < 6 || o.heightIn > 120) { issues.push(`${where}.heightIn must be 6–120.`); return; }
      if (o.sillIn !== undefined && o.sillIn !== null && (!num(o.sillIn) || o.sillIn < 0 || o.sillIn > 120)) { issues.push(`${where}.sillIn must be 0–120.`); return; }
      if (o.offsetIn !== undefined && o.offsetIn !== null && (!num(o.offsetIn) || o.offsetIn < 0 || o.offsetIn > 400)) { issues.push(`${where}.offsetIn must be 0–400.`); return; }
      openings.push({
        kind: o.kind, wall: o.wall as FabOpening['wall'], widthIn: o.widthIn, heightIn: o.heightIn,
        ...(num(o.sillIn) ? { sillIn: o.sillIn } : {}), ...(num(o.offsetIn) ? { offsetIn: o.offsetIn } : {}),
        ...(o.fabricateLeaf === true ? { fabricateLeaf: true } : {}),
      });
    });
  }

  const steelPerFt: Record<string, number> = {};
  for (const [id, value] of Object.entries(obj(obj(raw.prices).steelPerFt))) {
    if (!isProfileId(id) || !num(value) || value < 0 || value > 500) issues.push(`prices.steelPerFt.${id} must be a known profile with a 0–500 $/ft price.`);
    else steelPerFt[id] = value;
  }
  const title = typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim().slice(0, 120) : '';
  if (issues.length) throw new FabSpecError(issues);
  return { projectType, title, widthFt, lengthFt, heightFt, profiles, spacingIn, openings, skin, stock: { lengthsFt, kerfIn, trimIn }, options, prices: { steelPerFt } };
}
