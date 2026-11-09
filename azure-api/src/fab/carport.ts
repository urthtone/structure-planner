import { Builder, distribute, distributeInclusive, line, MITER45 } from './builder';
import { getPanel } from './profiles';
import { gableRoof } from './roof';
import type { NormalizedSpec } from './spec';
import type { GeneratorOutput } from './types';
import { ft, inchesText } from './units';

const GROUPS = { A: 'Posts', B: 'Eave headers', C: 'Trusses / rafters', D: 'Purlins', E: 'Knee braces', F: 'Wall girts (enclosed)' };

export function generateCarport(spec: NormalizedSpec): GeneratorOutput {
  const b = new Builder(spec, GROUPS);
  const o = spec.options;
  const W = ft(spec.widthFt), L = ft(spec.lengthFt), H = ft(spec.heightFt);
  const pp = b.profile('post'), hp = b.profile('header'), br = b.profile('brace');
  const lines = [pp.faceIn / 2, ...distribute(pp.faceIn / 2, L - pp.faceIn / 2, b.spacing('post')), L - pp.faceIn / 2];
  const k = lines.length;
  const embed = o.postBase === 'embed' ? (o.postEmbedIn ?? 36) : 0;
  const postLen = H - hp.depthIn + embed;
  const side = b.view({ id: 'side', title: `Side elevation ${inchesText(L)} long, ${k} posts per side`, widthIn: L, heightIn: H });
  b.view({ id: 'roof', title: 'Roof framing (plan): trusses at each post line, purlins along the length', widthIn: L, heightIn: W });
  b.add({ group: 'A', role: 'post', name: 'Post', lengthIn: postLen, qty: 2 * k,
    notes: [o.postBase === 'embed' ? `Includes ${inchesText(embed)} embedment in a concrete footing.` : 'Weld to a base plate; anchor to footing/slab.'],
    placements: lines.map(x => line(side, x, 0, x, H - hp.depthIn)) });
  if (o.postBase !== 'embed') {
    b.hw('Base plate 6" × 6" × 1/4" with 4 holes (cut from plate)', 2 * k, 'ea', 9);
    b.hw('1/2" × 4-1/2" wedge anchor', 8 * k, 'ea', 2.2, 'Verify slab/footing thickness and edge distance.');
  } else b.hw('Concrete, 80 lb bag (≈3 per post footing)', 6 * k, 'bag', 7);
  b.add({ group: 'B', role: 'header', name: 'Eave header', lengthIn: L, qty: 2, supports: lines, notes: ['Sits on post tops; splice only over a post.'],
    placements: [line(side, 0, H - hp.depthIn / 2, L, H - hp.depthIn / 2)] });

  gableRoof(b, { span: W, length: L, pitch: o.roofPitch ?? 3, lines, rafterRole: 'rafter', purlinRole: 'purlin', purlinSpacing: b.spacing('purlin'),
    group: 'C', purlinGroup: 'D', chordLength: () => W, panelId: spec.skin.roofPanel, overhangIn: spec.skin.overhangIn });

  // Knee braces: 24" long at 45°, post to header (along the length) and post to truss chord.
  const kneeLen = 24;
  const run = kneeLen / Math.SQRT2;
  const alongLength = 2 * (2 * k - 2);
  b.add({ group: 'E', role: 'brace', name: 'Knee brace', lengthIn: kneeLen, qty: alongLength + 2 * k, ends: [MITER45, MITER45], parallelEnds: true,
    notes: ['45° both ends (parallel). Post-to-header along each side and post-to-truss chord at every post.'],
    placements: lines.flatMap((x, i) => [
      ...(i > 0 ? [line(side, x - pp.faceIn / 2 - run, H - hp.depthIn, x - pp.faceIn / 2, H - hp.depthIn - run)] : []),
      ...(i < k - 1 ? [line(side, x + pp.faceIn / 2, H - hp.depthIn - run, x + pp.faceIn / 2 + run, H - hp.depthIn)] : []),
    ]) });

  if (o.enclosed) {
    const gp = b.profile('girt');
    const rows = distributeInclusive(48, H - hp.depthIn - 12, b.spacing('girt'));
    for (let i = 0; i < k - 1; i++) {
      const clear = lines[i + 1] - lines[i] - pp.faceIn;
      b.add({ group: 'F', role: 'girt', name: 'Side wall girt', lengthIn: clear, qty: rows.length * 2, placements: rows.map(y => line(side, lines[i] + pp.faceIn / 2, y, lines[i + 1] - pp.faceIn / 2, y)) });
    }
    const endPosts = W > 144 ? distribute(pp.faceIn / 2, W - pp.faceIn / 2, 120) : [];
    b.add({ group: 'A', role: 'post', name: 'End-wall post', lengthIn: postLen + hp.depthIn, qty: endPosts.length * 2, notes: ['Runs to the truss bottom chord.'] });
    const endBays = endPosts.length + 1;
    b.add({ group: 'F', role: 'girt', name: 'End wall girt', lengthIn: (W - pp.faceIn * (endBays + 1)) / endBays, qty: rows.length * 2 * endBays });
    if (spec.skin.wallPanel) {
      const panel = getPanel(spec.skin.wallPanel);
      b.panel(spec.skin.wallPanel, 'Side walls', 2 * Math.ceil(L / panel.coverageIn), H, 'Plus trim; frame any doors before sheeting.');
      b.panel(spec.skin.wallPanel, 'End walls (cut gable triangles from these)', 2 * Math.ceil(W / panel.coverageIn), H + (W / 2) * ((o.roofPitch ?? 3) / 12));
    }
    b.assumptions.push('Enclosed building: no door/window framed openings are generated yet; add headers and jambs for any roll-up or walk door before ordering.');
  }
  const roofSqFt = ((W + 2 * spec.skin.overhangIn) * (L + 2 * spec.skin.overhangIn)) / 144 * 1.03;
  const wallSqFt = o.enclosed && spec.skin.wallPanel ? (2 * (W + L) * H) / 144 : 0;
  b.hw('#12 × 1" self-drilling roofing screws with washers', Math.ceil((roofSqFt + wallSqFt) * 0.8), 'ea', 0.12, 'About 80 per 100 sq ft of panel.');
  b.hw('Butyl/foam closure strip, 3 ft', Math.ceil((2 * (L + 2 * spec.skin.overhangIn)) / 36), 'ea', 3);

  b.warnings.push(
    'Not engineered. Carports and steel buildings must be designed for local wind (uplift), snow and seismic loads; most jurisdictions require a permit and stamped drawings.',
    'Verify footing size, anchors, post/truss/purlin sizes and spans with a licensed engineer or the building department before ordering steel.',
  );
  b.assumptions.push(`${k} post lines at ≤ ${inchesText(b.spacing('post'))} on center; truss at every post line; purlins at ≤ ${inchesText(b.spacing('purlin'))} along the slope.`);
  return b.output(spec.title || `${spec.widthFt}′ × ${spec.lengthFt}′ steel ${o.enclosed ? 'building' : 'carport'}`);
}
