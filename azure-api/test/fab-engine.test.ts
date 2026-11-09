import { describe, expect, it } from 'vitest';
import { bomCsv, cutListCsv, FabSpecError, feetInchesText, generateFab, getProfile, inchesText, nestProfile, normalizeSpec } from '../src/fab/index';
import { fitDiagonal, distribute } from '../src/fab/builder';

import { BLIND_SPEC, TRAILER_SPEC } from './fixtures/fab-specs';

describe('units', () => {
  it('formats to the nearest 1/16 in ft-in and inches', () => {
    expect(inchesText(95.9375)).toBe('95-15/16"');
    expect(feetInchesText(95.9375)).toBe(`7' 11-15/16"`);
    expect(feetInchesText(96)).toBe(`8' 0"`);
    expect(inchesText(0.5)).toBe('1/2"');
    expect(inchesText(12.03)).toBe('12"');
  });
});

describe('nesting', () => {
  it('packs with kerf and trim and never overfills a stick', () => {
    const pieces = Array.from({ length: 10 }, (_, i) => ({ label: `P${i}`, lengthIn: 47.9375 }));
    const plan = nestProfile('sq-2x2-11ga', pieces, [20], 0.125, 0.5);
    // 5 × 47.9375 + 4 kerf + trim = 240.69 > 240 → only 4 per stick
    expect(plan.totalSticks).toBe(3);
    for (const bar of plan.bars) {
      const used = 0.5 + bar.cuts.reduce((s, c) => s + c.lengthIn, 0) + 0.125 * (bar.cuts.length - 1);
      expect(used).toBeLessThanOrEqual(bar.stockLengthIn + 1e-9);
    }
    expect(plan.wastePct).toBeCloseTo(((720 - 479.375) / 720) * 100, 1);
  });
  it('downsizes sticks to a shorter available length when the remainder fits', () => {
    // Best plan is two 20 ft sticks (230 | 100+50), cheaper than 24 ft (230+50) + 20 ft (100).
    const plan = nestProfile('sq-2x2-11ga', [{ label: 'A', lengthIn: 230 }, { label: 'B', lengthIn: 50 }, { label: 'C', lengthIn: 100 }], [20, 24], 0.125, 0.5);
    expect(plan.purchasedIn).toBe(480);
    expect(plan.sticks).toEqual([{ stockLengthFt: 20, count: 2 }]);
    const big = nestProfile('sq-2x2-11ga', [{ label: 'A', lengthIn: 230 }, { label: 'B', lengthIn: 50 }], [20, 24], 0.125, 0.5);
    expect(big.sticks).toEqual([{ stockLengthFt: 24, count: 1 }]);
  });
  it('rejects pieces longer than the longest stick', () => {
    expect(() => nestProfile('sq-2x2-11ga', [{ label: 'X', lengthIn: 300 }], [20, 24], 0.125, 0.5)).toThrow();
  });
});

describe('geometry helpers', () => {
  it('distributes interior members without exceeding the spacing', () => {
    const xs = distribute(1, 95, 24);
    expect(xs).toHaveLength(3);
    const all = [1, ...xs, 95];
    for (let i = 1; i < all.length; i++) expect(all[i] - all[i - 1]).toBeLessThanOrEqual(24);
  });
  it('fits a diagonal brace inside its bay', () => {
    const fit = fitDiagonal(40, 40, 1.5);
    expect(fit.x0).toBeGreaterThan(0);
    expect(fit.x1).toBeLessThan(40);
    expect(fit.lengthIn).toBeGreaterThan(Math.hypot(40 - 2 * fit.x0, 40));
    expect(fit.cutDeg).toBeGreaterThan(40);
  });
});

describe('spec validation', () => {
  it('fills defaults and rejects bad input with every issue listed', () => {
    expect(normalizeSpec({ projectType: 'gate' }).options.leaves).toBe(1);
    expect(normalizeSpec({ projectType: 'gate', widthFt: 12 }).options.leaves).toBe(2);
    try { normalizeSpec({ projectType: 'blind', widthFt: -1, profiles: { floor: 'unobtainium' }, stock: { kerfIn: 3 } }); throw new Error('no'); }
    catch (e) { expect(e).toBeInstanceOf(FabSpecError); expect((e as FabSpecError).issues.length).toBe(3); }
    expect(() => normalizeSpec({ projectType: 'boat' })).toThrow(FabSpecError);
  });
  it('rejects openings that do not fit', () => {
    expect(() => generateFab({ ...BLIND_SPEC, openings: [{ kind: 'window', wall: 'left', widthIn: 70, heightIn: 12 }] })).toThrow(/clear between corner posts/);
    expect(() => generateFab({ ...BLIND_SPEC, openings: [{ kind: 'door', wall: 'front', widthIn: 30, heightIn: 82 }] })).toThrow(/too tall/);
  });
});

describe('box blind (James): 6×8×7, 2×2×11ga, corrugated skin, 2 sliders per long wall, steel door', () => {
  const fab = generateFab(BLIND_SPEC);
  it('builds a labeled cut list with 1/16" lengths', () => {
    const rail = fab.cutList.find(l => l.name === 'Floor side rail')!;
    expect(rail).toMatchObject({ label: 'A1', qty: 2, lengthIn: 96, lengthText: `8' 0"` });
    expect(fab.cutList.find(l => l.name === 'Floor end rail')!.lengthIn).toBe(68);
    expect(fab.cutList.find(l => l.name === 'Corner post')).toMatchObject({ qty: 4, lengthIn: 80 });
    expect(fab.cutList.find(l => l.name === 'Window jamb')!.qty).toBe(8);
    expect(fab.cutList.find(l => l.name === 'Window header')!.qty).toBe(4);
    expect(fab.cutList.find(l => l.name === 'Window sill')!.qty).toBe(4);
    expect(fab.cutList.find(l => l.name === 'Door header')!.qty).toBe(1);
    for (const l of fab.cutList) expect(l.lengthIn * 16).toBe(Math.round(l.lengthIn * 16));
    expect(new Set(fab.cutList.map(l => l.label)).size).toBe(fab.cutList.length);
  });
  it('nests 2x2 tube onto 20/24 ft sticks and buys the anchor-tab flat as a drop', () => {
    const tube = fab.nesting.profiles.find(p => p.profileId === 'sq-2x2-11ga')!;
    expect(tube.totalSticks).toBeGreaterThan(8);
    expect(tube.wastePct).toBeLessThan(12);
    expect(fab.nesting.profiles.find(p => p.profileId === 'flat-2x1/4')!.sticks[0].drop).toBe(true);
    const pieces = fab.cutList.filter(l => l.profileId === 'sq-2x2-11ga').reduce((s, l) => s + l.qty, 0);
    expect(tube.bars.reduce((s, b) => s + b.cuts.length, 0)).toBe(pieces);
  });
  it('produces BOM weight from the lb/ft table, panels, hardware and example costs', () => {
    const tube = fab.cutList.filter(l => l.profileId === 'sq-2x2-11ga').reduce((s, l) => s + l.qty * l.lengthIn, 0) / 12;
    expect(fab.bom.steel.find(s => s.profileId === 'sq-2x2-11ga')!.weightLb).toBeCloseTo(tube * getProfile('sq-2x2-11ga').lbPerFt, 0);
    expect(fab.bom.panels.some(p => /corrugated.*Walls/.test(p.item))).toBe(true);
    expect(fab.bom.hardware.filter(h => /Sliding window/.test(h.item)).reduce((s, h) => s + h.qty, 0)).toBe(4);
    expect(fab.bom.hardware.some(h => /Steel door unit/.test(h.item))).toBe(true);
    expect(fab.bom.consumables.find(c => /MIG wire/.test(c.item))!.qty).toBeGreaterThan(1);
    expect(fab.bom.totals.exampleCost.total).toBeGreaterThan(1000);
    expect(fab.bom.priceNote).toMatch(/EXAMPLE/);
  });
  it('draws part plans and framing views, and warns it is not engineered', () => {
    expect(fab.plans.parts).toHaveLength(fab.cutList.length);
    expect(fab.plans.parts[0].svg).toMatch(/^<svg[^>]+xmlns/);
    expect(fab.plans.assembly.map(a => a.id)).toEqual(expect.arrayContaining(['floor', 'roof', 'wall-front', 'wall-back', 'wall-left', 'wall-right']));
    expect(fab.warnings.join(' ')).toMatch(/NOT ENGINEERED/);
  });
  it('exports CSV with formula-injection protection', () => {
    const csv = cutListCsv(fab);
    expect(csv.split('\r\n')[0]).toMatch(/^Label,Group,Part/);
    expect(csv).toContain('A1,');
    expect(bomCsv(fab)).toMatch(/Example total/);
    const evil = generateFab({ ...BLIND_SPEC, title: '=HYPERLINK("x")' });
    expect(evil.title).toBe('=HYPERLINK("x")');
  });
  it('supports miter joints and a gable roof', () => {
    const m = generateFab({ ...BLIND_SPEC, options: { joint: 'miter', roofStyle: 'gable', roofPitch: 4 } });
    expect(m.cutList.find(l => l.name === 'Floor end rail')).toMatchObject({ lengthIn: 72, endsText: expect.stringMatching(/45°/) });
    expect(m.cutList.some(l => l.name === 'Rafter / top chord' && l.parallelEnds)).toBe(true);
  });
});

describe('6×12 utility trailer', () => {
  const fab = generateFab(TRAILER_SPEC);
  it('places the axle ~60% back with hanger marks and a GVWR/DOT warning', () => {
    const rail = fab.cutList.find(l => l.name === 'Main side rail')!;
    expect(rail.lengthIn).toBe(144);
    expect(rail.marks.find(m => m.note === 'axle center')!.atIn).toBeCloseTo(86.4, 1);
    expect(fab.warnings.join(' ')).toMatch(/GVWR/);
    expect(fab.warnings.join(' ')).toMatch(/DOT/);
  });
  it('builds an A-frame tongue with angled cuts and trailer hardware', () => {
    const arm = fab.cutList.find(l => l.name === 'A-frame tongue arm')!;
    expect(arm.qty).toBe(2);
    expect(arm.ends[0].angleDeg).toBeGreaterThan(45);
    for (const item of [/axle/i, /coupler/i, /tongue jack/i, /Safety chains/, /fender/i, /light kit/i]) expect(fab.bom.hardware.some(h => item.test(h.item))).toBe(true);
    expect(fab.cutList.find(l => l.name === 'Crossmember')!.qty).toBe(5);
  });
});

describe('gates, fences and carports', () => {
  it('splits a wide gate into two braced leaves with pickets under the max gap', () => {
    const fab = generateFab({ projectType: 'gate', widthFt: 12, lengthFt: 1, heightFt: 5 });
    expect(fab.cutList.find(l => l.name === 'Gate stile')!.qty).toBe(4);
    expect(fab.cutList.find(l => l.name === 'Diagonal brace')!.parallelEnds).toBe(true);
    const note = fab.cutList.find(l => l.name === 'Gate picket')!.notes[0];
    const gap = parseFloat(note.split(', ')[1]);
    expect(gap).toBeLessThanOrEqual(3.75);
    expect(fab.bom.hardware.some(h => /hinge/i.test(h.item))).toBe(true);
  });
  it('lays out a fence run with posts, rails, caps and a gate', () => {
    const fab = generateFab({ projectType: 'gate', widthFt: 4, lengthFt: 50, heightFt: 4, options: { gateMode: 'fence', gateCount: 1 } });
    expect(fab.cutList.find(l => l.name === 'Fence post')!.qty).toBe(8);
    expect(fab.bom.hardware.some(h => /Post cap/.test(h.item))).toBe(true);
  });
  it('builds carport trusses, splices long members over posts and warns about wind/snow', () => {
    const fab = generateFab({ projectType: 'carport', widthFt: 20, lengthFt: 30, heightFt: 8 });
    expect(fab.cutList.filter(l => l.name.startsWith('Eave header')).every(l => l.lengthIn <= 288)).toBe(true);
    expect(fab.bom.hardware.some(h => /Splice/.test(h.item))).toBe(true);
    expect(fab.cutList.some(l => l.name === 'Knee brace')).toBe(true);
    expect(fab.warnings.join(' ')).toMatch(/wind/);
    expect(fab.warnings.join(' ')).toMatch(/snow/);
    const enclosed = generateFab({ projectType: 'carport', widthFt: 20, lengthFt: 30, heightFt: 8, options: { enclosed: true } });
    expect(enclosed.cutList.some(l => l.name === 'Side wall girt')).toBe(true);
  });
});
