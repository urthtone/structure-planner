import { Builder, cut, distributeInclusive, fitDiagonal, line, perimeter } from './builder';
import { getPanel } from './profiles';
import type { NormalizedSpec } from './spec';
import { FabSpecError } from './spec';
import type { GeneratorOutput } from './types';
import { ft, inchesText } from './units';

const GROUPS = { A: 'Gate leaf frame', B: 'Braces', C: 'Infill (pickets)', D: 'Posts', E: 'Fence rails', F: 'Fence pickets' };

export function generateGate(spec: NormalizedSpec): GeneratorOutput {
  const b = new Builder(spec, GROUPS);
  const o = spec.options;
  const H = ft(spec.heightFt);
  const clearance = o.groundClearanceIn ?? 2;
  const embed = o.postEmbedIn ?? 30;
  const pp = b.profile('post');
  if (o.gateMode === 'fence') {
    const R = ft(spec.lengthFt);
    const gates = o.gateCount ?? 0;
    const gw = ft(o.gateWidthFt ?? 4);
    const run = R - gates * gw;
    if (run < 24) throw new FabSpecError(['Fence run is shorter than the gates it contains.']);
    const maxBay = b.spacing('post');
    const bays = Math.ceil(run / maxBay - 1e-9);
    const bayCenter = run / bays;
    const clear = bayCenter - pp.faceIn;
    const rp = b.profile('rail');
    const rails = H > 60 ? 3 : 2;
    const view = b.view({ id: 'fence', title: `Fence elevation (first bay) ${inchesText(bayCenter)} on-center posts, ${bays} bays`, widthIn: bayCenter + pp.faceIn, heightIn: H + clearance + 2 });
    const posts = bays + 1 + gates;
    b.add({ group: 'D', role: 'post', name: 'Fence post', lengthIn: H + clearance + embed, qty: posts,
      notes: [`${inchesText(embed)} embedded in concrete; top flush with pickets + cap.`],
      placements: [line(view, pp.faceIn / 2, -embed / 4, pp.faceIn / 2, H + clearance), line(view, bayCenter + pp.faceIn / 2, -embed / 4, bayCenter + pp.faceIn / 2, H + clearance)] });
    const railYs = distributeInclusive(clearance + 4, clearance + H - 4, (H - 8) / (rails - 1) + 0.01);
    b.add({ group: 'E', role: 'rail', name: 'Fence rail', lengthIn: clear, qty: rails * bays, placements: railYs.map(y => line(view, pp.faceIn, y, pp.faceIn + clear, y)) });
    if (o.infill === 'pickets') {
      const pk = b.profile('picket');
      const { count, gap } = pickets(clear, pk.faceIn, o.infillGapIn ?? 3.75);
      b.add({ group: 'F', role: 'picket', name: 'Fence picket', lengthIn: H - 1, qty: count * bays, weldFactor: 0.5,
        notes: [`${count} per bay, ${inchesText(gap)} clear gaps; weld to the rail faces.`],
        placements: Array.from({ length: count }, (_, i) => pp.faceIn + gap + pk.faceIn / 2 + i * (pk.faceIn + gap)).map(x => line(view, x, clearance + 0.5, x, clearance + H - 0.5)) });
    } else infillPanels(b, clear, H - 1, bays, 'Fence bay');
    b.hw(`Post cap for ${pp.name}`, posts, 'ea', 6);
    b.hw('Concrete, 50 lb bag (≈2 per post)', posts * 2, 'bag', 6.5);
    for (let i = 0; i < gates; i++) gateLeaves(b, gw, H, clearance, i + 1, false);
    b.assumptions.push(`${bays} bays on ${inchesText(bayCenter)} centers (max ${inchesText(maxBay)}); ${gates} gate(s) of ${inchesText(gw)} add one post each.`);
    b.warnings.push('Not engineered. Verify post size/embedment for wind on solid infill, frost depth, property lines, utilities (call 811 before digging) and any pool-barrier or HOA rules.');
    return b.output(spec.title || `${spec.lengthFt} ft steel fence, ${spec.heightFt} ft high`);
  }
  const opening = ft(spec.widthFt);
  gateLeaves(b, opening, H, clearance, 0, true);
  b.add({ group: 'D', role: 'post', name: 'Gate post (hinge/latch)', lengthIn: H + clearance + 2 + embed, qty: 2,
    notes: [`${inchesText(embed)} embedded in concrete, top 2" above the gate.`] });
  b.hw(`Post cap for ${pp.name}`, 2, 'ea', 6);
  b.hw('Concrete, 50 lb bag (≈3 per gate post)', 6, 'bag', 6.5);
  b.warnings.push('Not engineered. Verify post size/embedment for gate weight and wind, hinge ratings, frost depth, sag over time and any pool-barrier code (self-closing/latching).');
  return b.output(spec.title || `${spec.widthFt} ft ${o.leaves === 2 ? 'double' : 'single'} steel gate, ${spec.heightFt} ft high`);
}

function pickets(clear: number, face: number, maxGap: number) {
  const count = Math.max(1, Math.ceil((clear - maxGap) / (face + maxGap) - 1e-9));
  return { count, gap: (clear - count * face) / (count + 1) };
}

function infillPanels(b: Builder, w: number, h: number, count: number, use: string) {
  const infill = b.spec.options.infill;
  if (infill === 'none' || infill === 'pickets') return;
  const product = infill === 'mesh' ? 'expanded-metal-3/4-9ga' : (b.spec.skin.wallPanel ?? 'sheet-16ga');
  const p = getPanel(product);
  const pieces = p.kind === 'panel' ? Math.ceil(w / p.coverageIn) * count : Math.ceil((Math.ceil(w / p.coverageIn) * Math.ceil(h / p.fixedLengthIn) * count));
  b.panel(product, `${use} infill`, pieces, p.kind === 'panel' ? h : p.fixedLengthIn, 'Cut to fit inside the frame; stitch weld or rivet.');
}

/** One opening's leaves. When standalone the gate gets its own SVG view. */
function gateLeaves(b: Builder, opening: number, H: number, clearance: number, index: number, standalone: boolean) {
  const o = b.spec.options;
  const leaves = standalone ? (o.leaves ?? 1) : 1;
  const fp = b.profile('frame'), bp = b.profile('brace');
  const f = fp.faceIn;
  const leafW = (opening - leaves * 0.5 - 0.75) / leaves;
  if (leafW < 12) throw new FabSpecError(['Gate leaf narrower than 12 in; increase the opening or use one leaf.']);
  const leafH = H;
  const suffix = index ? ` (fence gate ${index})` : '';
  const view = b.view({ id: `gate${index || ''}`, title: `Gate leaf${leaves > 1 ? ' (1 of 2, mirror the other)' : ''}${suffix} ${inchesText(leafW)} × ${inchesText(leafH)}`, widthIn: leafW, heightIn: leafH });
  perimeter(b, { role: 'frame', view, a: leafW, b: leafH, group: 'A', longName: 'Gate rail (top/bottom)', shortName: 'Gate stile', qtyScale: leaves,
    shortNotes: ['Hinge stile: mark hinge centers 6" from top and bottom (plus center if 3 hinges).'] });
  const mid = leafH > 48;
  const innerW = leafW - 2 * f;
  if (mid) b.add({ group: 'A', role: 'frame', name: 'Gate mid rail', lengthIn: innerW, qty: leaves, placements: [line(view, f, leafH / 2, leafW - f, leafH / 2)] });
  const bays = mid ? 2 : 1;
  const bayH = (leafH - 2 * f - (mid ? f : 0)) / bays;
  const brace = fitDiagonal(innerW, bayH, bp.faceIn);
  for (let i = 0; i < bays; i++) {
    const y0 = f + i * (bayH + f);
    b.add({ group: 'B', role: 'brace', name: 'Diagonal brace', lengthIn: brace.lengthIn, qty: leaves, ends: [cut(brace.cutDeg, 'level cut on rail'), cut(brace.cutDeg, 'level cut on rail')], parallelEnds: true,
      notes: ['Compression brace: runs from the bottom HINGE corner up to the top LATCH corner of each bay.'],
      placements: [line(view, f + brace.x0, y0, f + brace.x1, y0 + bayH)] });
  }
  if (o.infill === 'pickets') {
    const pk = b.profile('picket');
    const { count, gap } = pickets(innerW, pk.faceIn, o.infillGapIn ?? 3.75);
    b.add({ group: 'C', role: 'picket', name: 'Gate picket', lengthIn: leafH - 1, qty: count * leaves, weldFactor: 0.5,
      notes: [`${count} per leaf, ${inchesText(gap)} clear gaps, welded to the rail faces 1/2" short of top and bottom.`],
      placements: Array.from({ length: count }, (_, i) => f + gap + pk.faceIn / 2 + i * (pk.faceIn + gap)).map(x => line(view, x, 0.5, x, leafH - 0.5)) });
  } else infillPanels(b, innerW, leafH - 2 * f, leaves, 'Gate');
  const hinges = leafH > 72 ? 3 : 2;
  b.hw('Weld-on barrel/bullet hinge, 3/4" pin', hinges * leaves, 'ea', 9);
  b.hw(leaves > 1 ? 'Gate latch (double gate) + cane bolt/drop rod' : 'Gravity or lockable gate latch', 1, 'set', leaves > 1 ? 48 : 22);
  if (leafW > 72) b.hw('Gate wheel / caster (reduce sag on wide leaves)', leaves, 'ea', 35);
  b.assumptions.push(`Gate${suffix}: ${leaves} leaf${leaves > 1 ? 'ves' : ''} ${inchesText(leafW)} wide (1/2" hinge gap${leaves > 1 ? 's' : ''}, 3/4" latch gap), ${inchesText(clearance)} ground clearance.`);
}
