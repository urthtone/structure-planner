import { getProfile, type SteelProfile } from './profiles';
import type { NormalizedSpec } from './spec';
import type { EndCut, GeneratorOutput, HardwareItem, Mark, MemberDraft, PanelNeed, Placement, ViewDef } from './types';
import { deg, round } from './units';

export const SQUARE: EndCut = { angleDeg: 0 };
export const MITER45: EndCut = { angleDeg: 45, note: 'miter' };
export const cut = (angleDeg: number, note?: string): EndCut => (Math.abs(angleDeg) < 0.05 ? SQUARE : { angleDeg: round(angleDeg, 1), ...(note ? { note } : {}) });

/** Interior centers between two end centers so no gap exceeds maxSpacing. */
export function distribute(start: number, end: number, maxSpacing: number): number[] {
  const span = end - start;
  if (span <= 0) return [];
  const bays = Math.max(1, Math.ceil(span / maxSpacing - 1e-9));
  return Array.from({ length: bays - 1 }, (_, i) => start + ((i + 1) * span) / bays);
}
/** All centers including both ends. */
export const distributeInclusive = (start: number, end: number, maxSpacing: number) => [start, ...distribute(start, end, maxSpacing), end];

/**
 * A brace of face width b fitted diagonally inside a clear w × h bay with its ends
 * cut level so they sit on the horizontal rails. Returns long-point length and the
 * end-cut angle from square.
 */
export function fitDiagonal(w: number, h: number, b: number) {
  let alpha = Math.atan2(h, w);
  for (let i = 0; i < 50; i++) alpha = Math.atan2(h, Math.max(1, w - b / Math.sin(alpha)));
  const centerline = h / Math.sin(alpha);
  return { lengthIn: centerline + b / Math.tan(alpha), cutDeg: 90 - deg(alpha), alphaDeg: deg(alpha), x0: b / (2 * Math.sin(alpha)), x1: w - b / (2 * Math.sin(alpha)) };
}

export class Builder {
  members: MemberDraft[] = [];
  hardware: HardwareItem[] = [];
  panels: PanelNeed[] = [];
  views: ViewDef[] = [];
  warnings: string[] = [];
  assumptions: string[] = [];
  constructor(readonly spec: NormalizedSpec, readonly groups: Record<string, string>) {}
  profile(role: string): SteelProfile { return getProfile(this.spec.profiles[role]); }
  spacing(role: string): number { return this.spec.spacingIn[role]; }
  view(def: ViewDef) { this.views.push({ context: [], notes: [], ...def }); return def.id; }
  context(view: string, x1: number, y1: number, x2: number, y2: number) {
    this.views.find(v => v.id === view)?.context?.push({ view, x1, y1, x2, y2 });
  }
  add(member: Omit<MemberDraft, 'profileId' | 'ends'> & { ends?: [EndCut, EndCut]; profileId?: string }) {
    if (member.qty <= 0) return;
    if (!(member.lengthIn > 0.25)) throw new Error(`Generated member "${member.name}" has no usable length; check dimensions versus profile sizes.`);
    this.members.push({ ends: [SQUARE, SQUARE], profileId: this.spec.profiles[member.role], ...member });
  }
  hw(item: string, qty: number, unit: string, examplePrice: number, notes?: string) {
    if (qty > 0) this.hardware.push({ item, qty, unit, examplePrice, ...(notes ? { notes } : {}) });
  }
  panel(productId: string | null, use: string, pieces: number, lengthIn: number, notes?: string) {
    if (productId && pieces > 0) this.panels.push({ productId, use, pieces, lengthIn: round(lengthIn, 2), ...(notes ? { notes } : {}) });
  }
  output(title: string): GeneratorOutput {
    return { title, members: this.members, hardware: this.hardware, panels: this.panels, views: this.views, warnings: this.warnings, assumptions: this.assumptions, groups: this.groups };
  }
}
export const line = (view: string, x1: number, y1: number, x2: number, y2: number): Placement => ({ view, x1, y1, x2, y2 });
export const marksAt = (positions: number[], note: string, max = 14): Mark[] =>
  positions.length > max ? [] : positions.map(atIn => ({ atIn: round(atIn, 4), note }));

/** Perimeter frame of outside size a (x) × b (y) with members of face f. */
export function perimeter(builder: Builder, opts: {
  role: string; view: string; a: number; b: number; ox?: number; oy?: number; group: string;
  longName: string; shortName: string; longNotes?: string[]; shortNotes?: string[]; longMarks?: Mark[]; qtyScale?: number;
}) {
  const f = builder.profile(opts.role).faceIn;
  const { a, b, view, group } = opts;
  const ox = opts.ox ?? 0, oy = opts.oy ?? 0;
  const miter = builder.spec.options.joint === 'miter';
  const scale = opts.qtyScale ?? 1;
  const longPlacements = [line(view, ox, oy + f / 2, ox + a, oy + f / 2), line(view, ox, oy + b - f / 2, ox + a, oy + b - f / 2)];
  const shortPlacements = miter
    ? [line(view, ox + f / 2, oy, ox + f / 2, oy + b), line(view, ox + a - f / 2, oy, ox + a - f / 2, oy + b)]
    : [line(view, ox + f / 2, oy + f, ox + f / 2, oy + b - f), line(view, ox + a - f / 2, oy + f, ox + a - f / 2, oy + b - f)];
  builder.add({ group, role: opts.role, name: opts.longName, lengthIn: a, qty: 2 * scale, ends: miter ? [MITER45, MITER45] : [SQUARE, SQUARE], notes: opts.longNotes, marks: opts.longMarks, placements: longPlacements });
  builder.add({ group, role: opts.role, name: opts.shortName, lengthIn: miter ? b : b - 2 * f, qty: 2 * scale, ends: miter ? [MITER45, MITER45] : [SQUARE, SQUARE], notes: opts.shortNotes, placements: shortPlacements });
  return f;
}
