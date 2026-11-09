import { Builder, distribute, line, marksAt, perimeter, SQUARE } from './builder';
import { getPanel } from './profiles';
import { gableRoof } from './roof';
import type { NormalizedSpec } from './spec';
import { FabSpecError } from './spec';
import type { FabOpening, GeneratorOutput, WallSide } from './types';
import { ft, inchesText } from './units';

const GROUPS = { A: 'Floor frame', B: 'Walls (corner posts, studs, top plates)', C: 'Door & window framing', D: 'Roof framing', E: 'Door leaf', F: 'Anchor tabs' };

export function generateBlind(spec: NormalizedSpec): GeneratorOutput {
  const b = new Builder(spec, GROUPS);
  const W = ft(spec.widthFt), L = ft(spec.lengthFt), H = ft(spec.heightFt);
  const fp = b.profile('floor'), wp = b.profile('wall'), op = b.profile('opening');
  const fd = fp.depthIn, wd = wp.depthIn, bw = wp.faceIn, ob = op.faceIn;
  const Hc = H - fd - wd;
  const issues: string[] = [];
  if (Hc < 24) throw new FabSpecError([`Wall height ${spec.heightFt} ft leaves only ${inchesText(Hc)} between floor and top plate.`]);

  // A: floor frame (plan: x along length, y along width)
  b.view({ id: 'floor', title: `Floor frame (plan) ${spec.lengthFt}′ × ${spec.widthFt}′`, widthIn: L, heightIn: W });
  const joists = distribute(fp.faceIn / 2, L - fp.faceIn / 2, b.spacing('floor'));
  perimeter(b, { role: 'floor', view: 'floor', a: L, b: W, group: 'A', longName: 'Floor side rail', shortName: 'Floor end rail', longMarks: marksAt(joists, 'joist center') });
  for (const x of joists) b.add({ group: 'A', role: 'floor', name: 'Floor joist', lengthIn: W - 2 * fp.faceIn, qty: 1, placements: [line('floor', x, fp.faceIn, x, W - fp.faceIn)] });
  const tabCount = 4 + (L > 72 ? 2 : 0) + (W > 96 ? 2 : 0);
  b.add({ group: 'F', role: 'tab', name: 'Anchor tab', lengthIn: 4, qty: tabCount, weldFactor: 0.5,
    notes: ['Weld flat to the outside bottom of the floor rail, hole end projecting.'], marks: [{ atIn: 2.5, note: 'hole center', holeDiaIn: 0.5625 }] });
  b.hw('Ground anchor or 1/2" wedge anchor (per tab)', tabCount, 'ea', 9, 'Choose to suit ground/slab; verify uplift.');

  // B: top plate (roof plan) and walls
  b.view({ id: 'roof', title: `Top plate & roof framing (plan)`, widthIn: L, heightIn: W });
  perimeter(b, { role: 'wall', view: 'roof', a: L, b: W, group: 'B', longName: 'Top plate, long wall', shortName: 'Top plate, end wall' });

  const walls: { side: WallSide; length: number }[] = [
    { side: 'front', length: L }, { side: 'back', length: L }, { side: 'left', length: W }, { side: 'right', length: W },
  ];
  for (const wall of walls) {
    const id = `wall-${wall.side}`;
    const long = wall.side === 'front' || wall.side === 'back';
    b.view({ id, title: `${wall.side[0].toUpperCase() + wall.side.slice(1)} wall framing (elevation, outside view) ${inchesText(wall.length)} × ${inchesText(H)}`, widthIn: wall.length, heightIn: H });
    b.context(id, 0, fd / 2, wall.length, fd / 2);
    b.context(id, 0, H - wd / 2, wall.length, H - wd / 2);
    const cornerPlacements = [line(id, bw / 2, fd, bw / 2, H - wd), line(id, wall.length - bw / 2, fd, wall.length - bw / 2, H - wd)];
    if (long) b.add({ group: 'B', role: 'wall', name: 'Corner post', lengthIn: Hc, qty: 2, placements: cornerPlacements });
    else for (const p of cornerPlacements) b.context(id, p.x1, p.y1, p.x2, p.y2);

    const openings = placeOpenings(spec.openings.filter(o => o.wall === wall.side), wall.length, bw, ob, issues, wall.side);
    for (const o of openings) {
      const bottom = fd + (o.kind === 'door' ? 0 : o.sill);
      const top = bottom + o.heightIn;
      const name = `${o.kind === 'door' ? 'Door' : 'Window'} ${inchesText(o.widthIn)} × ${inchesText(o.heightIn)}`;
      if (o.kind === 'window' && o.sill < ob) issues.push(`${name} on ${wall.side} wall: sill ${inchesText(o.sill)} is lower than the ${inchesText(ob)} sill member.`);
      if (top + ob > H - wd + 0.01) { issues.push(`${name} on ${wall.side} wall is too tall: max opening top is ${inchesText(H - wd - ob - fd)} above the floor frame.`); continue; }
      b.add({ group: 'C', role: 'opening', name: `${o.kind === 'door' ? 'Door' : 'Window'} jamb`, lengthIn: Hc, qty: 2,
        placements: [line(id, o.left - ob / 2, fd, o.left - ob / 2, H - wd), line(id, o.right + ob / 2, fd, o.right + ob / 2, H - wd)] });
      b.add({ group: 'C', role: 'opening', name: `${o.kind === 'door' ? 'Door' : 'Window'} header`, lengthIn: o.widthIn, qty: 1, placements: [line(id, o.left, top + ob / 2, o.right, top + ob / 2)] });
      if (o.kind === 'window') b.add({ group: 'C', role: 'opening', name: 'Window sill', lengthIn: o.widthIn, qty: 1, placements: [line(id, o.left, bottom - ob / 2, o.right, bottom - ob / 2)] });
      b.views.find(v => v.id === id)?.notes?.push(`${name}: rough opening ${inchesText(o.left)} from left corner${o.kind === 'window' ? `, sill ${inchesText(o.sill)} above floor frame` : ''}.`);
      if (o.kind === 'window') b.hw(`Sliding window kit / track for ${inchesText(o.widthIn)} × ${inchesText(o.heightIn)} opening`, 1, 'ea', 85);
      else if (o.fabricateLeaf) doorLeaf(b, o.widthIn, o.heightIn, wall.side);
      else b.hw(`Steel door unit for ${inchesText(o.widthIn)} × ${inchesText(o.heightIn)} rough opening`, 1, 'ea', 325, 'Or set fabricateLeaf to weld a leaf.');
    }
    for (const x of distribute(bw / 2, wall.length - bw / 2, b.spacing('wall'))) {
      const hit = openings.find(o => x > o.left - ob - bw / 2 - 1 && x < o.right + ob + bw / 2 + 1);
      if (!hit) { b.add({ group: 'B', role: 'wall', name: 'Wall stud', lengthIn: Hc, qty: 1, placements: [line(id, x, fd, x, H - wd)] }); continue; }
      if (x < hit.left + bw / 2 || x > hit.right - bw / 2) continue; // the jamb takes this stud's place
      const bottom = fd + (hit.kind === 'door' ? 0 : hit.sill);
      const top = bottom + hit.heightIn;
      const above = H - wd - (top + ob);
      if (above > 0.5) b.add({ group: 'C', role: 'opening', name: 'Cripple above header', lengthIn: above, qty: 1, placements: [line(id, x, top + ob, x, H - wd)] });
      const below = bottom - ob - fd;
      if (hit.kind === 'window' && below > 0.5) b.add({ group: 'C', role: 'opening', name: 'Cripple below sill', lengthIn: below, qty: 1, placements: [line(id, x, fd, x, bottom - ob)] });
    }
  }
  if (issues.length) throw new FabSpecError(issues);

  // D: roof
  const overhang = spec.skin.overhangIn;
  if (spec.options.roofStyle === 'gable') {
    const lines = distribute(bw / 2, L - bw / 2, b.spacing('roof'));
    gableRoof(b, { span: W, length: L, pitch: spec.options.roofPitch ?? 4, lines: [bw / 2, ...lines, L - bw / 2], rafterRole: 'roof', purlinRole: 'roof', purlinSpacing: b.spacing('roof'),
      group: 'D', purlinGroup: 'D', chordLength: i => (i === 0 || i === lines.length + 1 ? null : W - 2 * bw), panelId: spec.skin.roofPanel, overhangIn: overhang });
  } else {
    for (const x of distribute(bw / 2, L - bw / 2, b.spacing('roof')))
      b.add({ group: 'D', role: 'roof', name: 'Roof purlin (cross member)', lengthIn: W - 2 * bw, qty: 1, placements: [line('roof', x, bw, x, W - bw)] });
    if (spec.skin.roofPanel) {
      const panel = getPanel(spec.skin.roofPanel);
      b.panel(spec.skin.roofPanel, 'Roof', Math.ceil((W + 2 * overhang) / panel.coverageIn), L + 2 * overhang, 'Panels run the long way over the cross purlins.');
    }
    b.assumptions.push('Flat roof: add 1–2 in of slope (shim one long top plate or lengthen the back posts) so water drains.');
  }

  // Skins and floor
  const perimeterIn = 2 * (W + L);
  if (spec.skin.wallPanel) {
    const panel = getPanel(spec.skin.wallPanel);
    const pieces = walls.reduce((sum, wall) => sum + Math.ceil(wall.length / panel.coverageIn), 0);
    b.panel(spec.skin.wallPanel, 'Walls', pieces, H, 'Cut window/door openings after fastening; hem or trim cut edges.');
    b.hw('Outside corner trim, 10 ft', Math.ceil((4 * H) / 120), 'ea', 14);
  }
  if (spec.skin.floorPanel) {
    const panel = getPanel(spec.skin.floorPanel);
    const sheets = Math.min(Math.ceil(W / panel.coverageIn) * Math.ceil(L / (panel.fixedLengthIn || 96)), Math.ceil(L / panel.coverageIn) * Math.ceil(W / (panel.fixedLengthIn || 96)));
    b.panel(spec.skin.floorPanel, 'Floor', sheets, panel.fixedLengthIn || 96);
    b.hw('1/4" × 2" self-drilling flat-head floor screws', Math.ceil((W * L) / 144) * 2, 'ea', 0.18, 'About 2 per sq ft.');
  }
  const skinSqFt = (spec.skin.wallPanel ? (perimeterIn * H) / 144 : 0) + (spec.skin.roofPanel ? ((W + 2 * overhang) * (L + 2 * overhang)) / 144 : 0);
  b.hw('#12 × 1" self-drilling roofing screws with washers', Math.ceil(skinSqFt * 0.8), 'ea', 0.12, 'About 80 per 100 sq ft of panel.');

  b.warnings.push(
    'Not engineered. Verify anchoring for wind uplift, roof snow/live loads and every member size before building.',
    'If the blind will sit on an elevated stand or tower, the stand, stairs/ladder, railings and fall protection need their own engineering and tie-down.',
  );
  b.assumptions.push(
    `Walls: front/back are the ${spec.lengthFt} ft long walls, left/right the ${spec.widthFt} ft end walls. Wall height ${inchesText(H)} is bottom of floor frame to top of top plate.`,
    `Butt joints unless joint = miter; posts and studs ${inchesText(Hc)} fit between floor frame and top plate.`,
  );
  return b.output(spec.title || `${spec.widthFt}′ × ${spec.lengthFt}′ steel box blind / shed frame`);
}

type Placed = FabOpening & { left: number; right: number; sill: number };
function placeOpenings(openings: FabOpening[], length: number, bw: number, ob: number, issues: string[], side: string): Placed[] {
  if (!openings.length) return [];
  const sill = (o: FabOpening) => (o.kind === 'window' ? (o.sillIn ?? 36) : 0);
  let placed: Placed[];
  if (openings.every(o => o.offsetIn !== undefined)) {
    placed = openings.map(o => ({ ...o, left: o.offsetIn!, right: o.offsetIn! + o.widthIn, sill: sill(o) })).sort((a, c) => a.left - c.left);
  } else {
    const clear = length - 2 * bw;
    const total = openings.reduce((sum, o) => sum + o.widthIn + 2 * ob, 0);
    const gap = (clear - total) / (openings.length + 1);
    if (gap < 0) { issues.push(`Openings on the ${side} wall need ${inchesText(total)} but only ${inchesText(clear)} is clear between corner posts.`); return []; }
    let cursor = bw + gap;
    placed = openings.map(o => {
      const left = cursor + ob;
      cursor = left + o.widthIn + ob + gap;
      return { ...o, left, right: left + o.widthIn, sill: sill(o) };
    });
  }
  placed.forEach((o, i) => {
    if (o.left - ob < bw - 0.01 || o.right + ob > length - bw + 0.01) issues.push(`An opening on the ${side} wall (with its jambs) runs into a corner post.`);
    const next = placed[i + 1];
    if (next && o.right + ob > next.left - ob + 0.01) issues.push(`Two openings on the ${side} wall overlap; leave room for both jambs.`);
  });
  return placed;
}

function doorLeaf(b: Builder, roughW: number, roughH: number, side: string) {
  const lp = b.profile('leaf');
  const w = roughW - 0.5, h = roughH - 0.75;
  const view = b.view({ id: `leaf-${side}`, title: `Door leaf (${side} wall) ${inchesText(w)} × ${inchesText(h)}`, widthIn: w, heightIn: h });
  perimeter(b, { role: 'leaf', view, a: w, b: h, group: 'E', longName: 'Door leaf rail (top/bottom)', shortName: 'Door leaf stile' });
  b.add({ group: 'E', role: 'leaf', name: 'Door leaf mid rail', lengthIn: w - 2 * lp.faceIn, qty: 1, ends: [SQUARE, SQUARE], placements: [line(view, lp.faceIn, h / 2, w - lp.faceIn, h / 2)] });
  if (b.spec.skin.wallPanel) b.panel(b.spec.skin.wallPanel, 'Door leaf skin', Math.ceil(w / getPanel(b.spec.skin.wallPanel).coverageIn), h);
  b.hw('Weld-on barrel hinge 5/8" pin (door)', 3, 'ea', 9);
  b.hw('Door latch / hasp, lockable', 1, 'ea', 24);
  b.assumptions.push('Door leaf: 1/4" clearance at sides and top, 1/2" at the bottom.');
}
