import { Builder, cut, distribute, distributeInclusive, line, marksAt, perimeter } from './builder';
import { getPanel } from './profiles';
import type { NormalizedSpec } from './spec';
import type { GeneratorOutput } from './types';
import { deg, ft, inchesText, round } from './units';

const GROUPS = { A: 'Main frame (rails, ends, crossmembers)', B: 'Tongue', C: 'Side rails & stakes', D: 'Tabs & mounts' };

export function generateTrailer(spec: NormalizedSpec): GeneratorOutput {
  const b = new Builder(spec, GROUPS);
  const W = ft(spec.widthFt), L = ft(spec.lengthFt);
  const o = spec.options;
  const T = ft(o.tongueLengthFt ?? 4);
  const rp = b.profile('rail'), tp = b.profile('tongue');
  const rf = rp.faceIn;
  const view = b.view({ id: 'frame', title: `Trailer frame (plan, coupler at left) ${spec.widthFt}′ × ${spec.lengthFt}′ deck + ${o.tongueLengthFt} ft tongue`, widthIn: L + T, heightIn: W });
  const ox = T;

  // Axle placement: center ~60% of the box length back from the front.
  const axleCenter = 0.6 * L;
  const tandem = o.axles === 2;
  const axleCenters = tandem ? [axleCenter - 17.5, axleCenter + 17.5] : [axleCenter];
  const eye = (o.axleRatingLb ?? 3500) > 3500 ? 30 : 25.25;
  const hangers = tandem
    ? [axleCenters[0] - eye / 2, axleCenter, axleCenters[1] + eye / 2]
    : [axleCenter - eye / 2, axleCenter + eye / 2];

  const crossCenters = distribute(rf / 2, L - rf / 2, b.spacing('crossmember'));
  perimeter(b, { role: 'rail', view, a: L, b: W, ox, group: 'A', longName: 'Main side rail', shortName: 'Front/rear cross rail',
    longNotes: [`Axle center ${inchesText(axleCenter)} from front (~60% of the deck length). Spring hangers at ${hangers.map(h => inchesText(h)).join(', ')} from front.`],
    longMarks: [...hangers.map(atIn => ({ atIn: round(atIn, 4), note: tandem && atIn === axleCenter ? 'equalizer hanger' : 'spring hanger' })), ...axleCenters.map(atIn => ({ atIn, note: 'axle center' }))] });
  for (const x of crossCenters)
    b.add({ group: 'A', role: 'crossmember', name: 'Crossmember', lengthIn: W - 2 * rf, qty: 1, placements: [line(view, ox + x, rf, ox + x, W - rf)] });
  b.views[0].notes?.push(`Axle center ${inchesText(axleCenter)} back from the front cross rail; crossmembers ${crossCenters.length} at ≤ ${inchesText(b.spacing('crossmember'))} on center.`);
  for (const a of axleCenters) b.context(view, ox + a, -6, ox + a, W + 6);

  // Tongue
  if (o.tongueStyle === 'straight') {
    const back = 2 + (crossCenters.find(x => x > 0.35 * L) ?? 0.4 * L);
    b.add({ group: 'B', role: 'tongue', name: 'Straight tongue', lengthIn: T + back, qty: 1,
      notes: ['Runs under the front cross rail and crossmembers; weld at every crossing and add gussets.'], placements: [line(view, 0, W / 2, ox + back, W / 2)] });
  } else {
    const spread = W / 2 - rf / 2;
    const phi = Math.atan2(spread, T);
    // Long point to long point: centerline plus the overrun of each angled cut.
    const armLen = Math.hypot(T, spread) + (tp.faceIn / 2) * (Math.tan(Math.PI / 2 - phi) + Math.tan(phi));
    b.add({ group: 'B', role: 'tongue', name: 'A-frame tongue arm', lengthIn: armLen, qty: 2,
      ends: [cut(90 - deg(phi), 'apex cut, meets the other arm on center'), cut(deg(phi), 'cut to sit flat on front cross rail')],
      notes: [`Arms meet at the coupler on the centerline at ${deg(2 * phi).toFixed(1)}° included angle. Fit the A-frame coupler before final welding.`],
      placements: [line(view, 0, W / 2, ox, rf / 2), line(view, 0, W / 2, ox, W - rf / 2)] });
  }
  b.add({ group: 'D', role: 'tab', name: 'Safety chain tab', lengthIn: 4, qty: 2, weldFactor: 0.5, marks: [{ atIn: 2.75, note: 'hole', holeDiaIn: 0.5625 }],
    notes: ['Weld under the tongue behind the coupler.'] });

  // Side rails
  const railH = o.sideRailHeightIn ?? 0;
  if (railH > 0) {
    const sp = b.profile('siderail'), st = b.profile('stake');
    const side = b.view({ id: 'side', title: `Side rail (elevation) ${inchesText(L)} × ${inchesText(railH)} above frame`, widthIn: L, heightIn: railH + rp.depthIn });
    b.context(side, 0, rp.depthIn / 2, L, rp.depthIn / 2);
    b.add({ group: 'C', role: 'siderail', name: 'Side top rail', lengthIn: L, qty: 2, placements: [line(side, 0, rp.depthIn + railH - sp.faceIn / 2, L, rp.depthIn + railH - sp.faceIn / 2)] });
    b.add({ group: 'C', role: 'siderail', name: 'Front top rail', lengthIn: W - 2 * sp.faceIn, qty: 1 });
    const stakes = distributeInclusive(st.faceIn / 2, L - st.faceIn / 2, b.spacing('stake'));
    const front = distribute(st.faceIn / 2, W - st.faceIn / 2, b.spacing('stake'));
    b.add({ group: 'C', role: 'stake', name: 'Stake / upright', lengthIn: railH - sp.faceIn, qty: stakes.length * 2 + front.length,
      placements: stakes.map(x => line(side, x, rp.depthIn, x, rp.depthIn + railH - sp.faceIn)) });
  }

  // Deck
  if (spec.skin.floorPanel) {
    const deck = getPanel(spec.skin.floorPanel);
    if (deck.kind === 'board') b.panel(deck.id, 'Deck boards (run lengthwise)', Math.ceil(W / deck.coverageIn), L, 'Fasten to every crossmember with carriage bolts or self-drilling deck screws.');
    else b.panel(deck.id, 'Deck sheets', Math.ceil(W / deck.coverageIn) * Math.ceil(L / deck.fixedLengthIn), deck.fixedLengthIn);
    b.hw('Self-drilling deck screws / carriage bolts', Math.ceil((W / 5.75) * (crossCenters.length + 2) * 2), 'ea', 0.25);
  }

  const rating = o.axleRatingLb ?? 3500;
  const n = tandem ? 2 : 1;
  b.hw(`${rating} lb axle, ${o.brakes ? 'electric brakes' : 'idler'} (spring seats set to frame width)`, n, 'ea', o.brakes ? 420 : 260, `Track width to suit ${spec.widthFt} ft outside frame; verify hub face.`);
  b.hw('Leaf spring, double-eye (pair per axle)', n * 2, 'ea', 38, `${eye}" eye-to-eye`);
  b.hw(tandem ? 'Tandem hanger kit with equalizers' : 'Spring hanger kit (front + rear hangers, shackles, bolts)', 1, 'kit', tandem ? 95 : 45);
  b.hw('U-bolt kit (per axle)', n, 'kit', 22);
  b.hw('Wheel + tire assembly (load range to suit GVWR)', n * 2, 'ea', 120);
  b.hw('Trailer fender', 2, 'ea', 45);
  b.hw('2" A-frame coupler (rated ≥ GVWR)', 1, 'ea', 55);
  b.hw('Safety chains with hooks (rated ≥ GVWR)', 2, 'ea', 18);
  b.hw('Swivel tongue jack, weld-on', 1, 'ea', 60);
  b.hw('LED trailer light kit with 4-flat harness', 1, 'kit', 55, 'Stop/tail/turn, side markers and license light per DOT/FMVSS 108.');
  if (o.brakes) b.hw('Breakaway kit + 7-way plug', 1, 'kit', 85);
  b.hw('D-ring tie-down, weld-on', 4, 'ea', 8);

  b.warnings.push(
    'Not engineered. GVWR, axle rating, tire load range, frame member sizes, welds, coupler rating, brakes, lighting and registration/DOT requirements must be verified for your state before road use.',
    'Most states require brakes above a GVWR threshold (often 3,000 lb); check yours. Keep ~10–15% of the loaded weight on the tongue.',
  );
  b.assumptions.push(
    `Axle center at 60% of the deck length from the front (${inchesText(axleCenter)}); move it to balance your expected load.`,
    `${n} × ${rating} lb axle${n > 1 ? 's' : ''}; ${eye}" eye-to-eye springs.`,
  );
  return b.output(spec.title || `${spec.widthFt}′ × ${spec.lengthFt}′ ${railH > 0 ? 'utility' : 'flatbed'} trailer frame`);
}
