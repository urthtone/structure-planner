import { Builder, cut, distributeInclusive, line, SQUARE } from './builder';
import { getPanel } from './profiles';
import { deg } from './units';

/**
 * Gable roof built from trusses (two top chords/rafters, a bottom chord, a king post
 * and two webs on spans ≥ 16 ft) at the given frame lines, plus purlins along the length.
 */
export function gableRoof(b: Builder, o: {
  span: number; length: number; pitch: number; lines: number[]; rafterRole: string; purlinRole: string; purlinSpacing: number;
  group: string; purlinGroup: string; chordLength: (index: number) => number | null; panelId: string | null; overhangIn: number;
}) {
  const rafter = b.profile(o.rafterRole);
  const purlin = b.profile(o.purlinRole);
  const theta = Math.atan(o.pitch / 12);
  const run = o.span / 2;
  const rise = run * Math.tan(theta);
  const rafterLen = run / Math.cos(theta);
  const plumb = deg(theta);
  const truss = b.view({ id: 'truss', title: `Truss / rafter pair (end elevation, ${o.pitch}/12 pitch)`, widthIn: o.span, heightIn: rise + rafter.depthIn * 2 });
  const plan = 'roof';
  o.lines.forEach((x, i) => {
    const first = i === 0;
    b.add({ group: o.group, role: o.rafterRole, name: 'Rafter / top chord', lengthIn: rafterLen, qty: 2, ends: [cut(plumb, 'plumb cut'), cut(plumb, 'plumb cut at peak')], parallelEnds: true,
      notes: ['Long-point length along the top edge. Cuts are parallel; lay out one full-size and use it as a pattern.'],
      placements: [line(plan, x, 0, x, o.span / 2), line(plan, x, o.span / 2, x, o.span), ...(first ? [line(truss, 0, rafter.depthIn, run, rafter.depthIn + rise), line(truss, o.span, rafter.depthIn, run, rafter.depthIn + rise)] : [])] });
    const chord = o.chordLength(i);
    if (chord) b.add({ group: o.group, role: o.rafterRole, name: 'Bottom chord / ceiling tie', lengthIn: chord, qty: 1,
      placements: first ? [line(truss, (o.span - chord) / 2, rafter.depthIn / 2, (o.span + chord) / 2, rafter.depthIn / 2)] : [] });
    const king = rise - rafter.depthIn / Math.cos(theta);
    if (king > 3) b.add({ group: o.group, role: o.rafterRole, name: 'King post', lengthIn: king, qty: 1, ends: [SQUARE, cut(90 - plumb, 'V-notch or double cut to meet both rafters')],
      placements: first ? [line(truss, run, rafter.depthIn, run, rafter.depthIn + king)] : [] });
    if (o.span >= 192) {
      const webLen = Math.hypot(run / 2, rise / 2);
      const webAngle = deg(Math.atan2(rise / 2, run / 2));
      b.add({ group: o.group, role: o.rafterRole, name: 'Truss web (diagonal)', lengthIn: webLen - rafter.faceIn, qty: 2, ends: [cut(90 - webAngle, 'fit to chord'), cut(webAngle, 'fit to rafter')],
        notes: ['Approximate; scribe to fit the assembled truss.'],
        placements: first ? [line(truss, run, rafter.depthIn, run / 2, rafter.depthIn + rise / 2), line(truss, run, rafter.depthIn, run * 1.5, rafter.depthIn + rise / 2)] : [] });
    }
  });
  // Purlins along the length on each slope.
  const along = distributeInclusive(purlin.faceIn / 2, rafterLen - purlin.faceIn / 2, o.purlinSpacing);
  for (const side of [0, 1])
    for (const s of along) {
      const horizontal = s * Math.cos(theta);
      const y = side ? o.span - horizontal : horizontal;
      b.add({ group: o.purlinGroup, role: o.purlinRole, name: 'Roof purlin', lengthIn: o.length, qty: 1, supports: o.lines, placements: [line(plan, 0, y, o.length, y)] });
    }
  if (o.panelId) {
    const panel = getPanel(o.panelId);
    const perSide = Math.ceil((o.length + 2 * o.overhangIn) / panel.coverageIn);
    b.panel(o.panelId, 'Roof (both slopes)', perSide * 2, rafterLen + o.overhangIn / Math.cos(theta), 'Run panels eave to ridge.');
    b.hw('Ridge cap, 10 ft', Math.ceil((o.length + 2 * o.overhangIn) / 120), 'ea', 22);
  }
  b.assumptions.push(`Gable roof ${o.pitch}/12 pitch: rise ${(rise).toFixed(1)}", rafter ${rafterLen.toFixed(1)}" long-point, plumb cuts ${plumb.toFixed(1)}° from square.`);
  return { rise, rafterLen, theta };
}
