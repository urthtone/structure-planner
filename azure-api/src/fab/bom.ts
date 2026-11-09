import { getPanel, getProfile } from './profiles';
import type { NormalizedSpec } from './spec';
import type { BomLine, CutListLine, FabBom, HardwareItem, NestingResult, PanelNeed } from './types';
import { round } from './units';

export const PRICE_NOTE = 'EXAMPLE PRICES ONLY — illustrative late-2026 retail ballpark, not a quote. Replace with your supplier\'s prices before buying.';
const money = (n: number) => round(n, 2);

/** Weld inches: all-around at each welded end (perimeter × weldFactor). */
export function weldInches(cutList: CutListLine[], factors: Map<string, number>): number {
  return round(cutList.reduce((sum, line) => sum + line.qty * 2 * getProfile(line.profileId).perimeterIn * (factors.get(line.label) ?? 1), 0), 0);
}

export function buildBom(spec: NormalizedSpec, cutList: CutListLine[], nesting: NestingResult, hardware: HardwareItem[], panels: PanelNeed[], factors: Map<string, number>): FabBom {
  const steel = nesting.profiles.map(p => {
    const profile = getProfile(p.profileId);
    const price = spec.prices.steelPerFt[p.profileId] ?? profile.examplePricePerFt;
    const linearFt = round(p.purchasedIn / 12, 2);
    return {
      profileId: p.profileId, item: profile.name, qty: p.totalSticks, unit: 'sticks',
      sticks: p.sticks.map(s => (s.drop ? `${s.stockLengthFt} ft cut drop` : `${s.count} × ${s.stockLengthFt} ft`)).join(' + '),
      linearFt, weightLb: round((p.usedIn / 12) * profile.lbPerFt, 1), examplePrice: price, exampleCost: money(linearFt * price),
      notes: `${round(p.usedIn / 12, 1)} ft used of ${linearFt} ft bought (${p.wastePct}% waste); ${profile.lbPerFt} lb/ft.`,
    };
  });
  // Merge identical panel needs.
  const merged = new Map<string, PanelNeed>();
  for (const need of panels) {
    const key = `${need.productId}|${need.lengthIn}|${need.use}`;
    const prior = merged.get(key);
    if (prior) prior.pieces += need.pieces; else merged.set(key, { ...need });
  }
  const panelLines: BomLine[] = [...merged.values()].map(need => {
    const product = getPanel(need.productId);
    const lengthFt = need.lengthIn / 12;
    const area = (need.pieces * product.coverageIn * need.lengthIn) / 144;
    const cost = product.priceUnit === 'per-lf' ? need.pieces * lengthFt * product.examplePrice : need.pieces * product.examplePrice;
    return {
      item: `${product.name} — ${need.use}`, qty: need.pieces, unit: product.kind === 'panel' || product.kind === 'board' ? `pcs @ ${round(lengthFt, 2)} ft` : 'sheets',
      weightLb: round(area * product.lbPerSqFt, 1), examplePrice: product.examplePrice, exampleCost: money(cost),
      notes: [need.notes, product.priceUnit === 'per-lf' ? 'Example price per linear ft.' : 'Example price per sheet.'].filter(Boolean).join(' '),
    };
  });
  const hardwareLines: BomLine[] = hardware.map(h => ({ item: h.item, qty: h.qty, unit: h.unit, examplePrice: h.examplePrice, exampleCost: money(h.qty * h.examplePrice), ...(h.notes ? { notes: h.notes } : {}) }));

  const weld = weldInches(cutList, factors);
  // Fillet leg ≈ wall thickness (1/8"–3/16"); weld metal 0.2836 lb/in³; 90% MIG wire efficiency; 20% allowance for tacks/starts.
  const wireLb = cutList.reduce((sum, line) => {
    const p = getProfile(line.profileId);
    const leg = Math.min(0.1875, Math.max(0.125, p.thicknessIn));
    const inches = line.qty * 2 * p.perimeterIn * (factors.get(line.label) ?? 1);
    return sum + (inches * 0.5 * leg * leg * 0.2836) / 0.9;
  }, 0) * 1.2;
  const arcMinutes = weld / 8;
  const gasCuFt = (arcMinutes / 60) * 25 * 1.5;
  const paintSqFt = round(cutList.reduce((sum, line) => sum + (line.qty * line.lengthIn * getProfile(line.profileId).perimeterIn) / 144, 0) * 1.1, 0);
  const pieces = cutList.reduce((sum, line) => sum + line.qty, 0);
  const gallons = (sqft: number, coats: number) => Math.max(0.25, Math.ceil(((sqft * coats) / 300) * 4) / 4);
  const consumables: BomLine[] = [
    { item: 'MIG wire ER70S-6 .030" (or ~1.6× as much 6011/7018 stick rod)', qty: round(Math.max(1, wireLb), 1), unit: 'lb', examplePrice: 5.5, exampleCost: 0, notes: `≈${weld} weld inches (all-around at each joint).` },
    { item: 'Shielding gas 75/25 Ar/CO₂', qty: round(Math.max(10, gasCuFt), 0), unit: 'cu ft', examplePrice: 0.45, exampleCost: 0, notes: `≈${round(arcMinutes / 60, 1)} h arc time at 25 CFH + 50% for tacks/pre-flow.` },
    { item: 'Metal primer (rust-inhibiting)', qty: gallons(paintSqFt, 1), unit: 'gal', examplePrice: 48, exampleCost: 0, notes: `${paintSqFt} sq ft of steel surface; one coat ≈ 300 sq ft/gal (≈${Math.ceil(paintSqFt / 15)} spray cans).` },
    { item: 'Topcoat enamel', qty: gallons(paintSqFt, 2), unit: 'gal', examplePrice: 55, exampleCost: 0, notes: 'Two coats.' },
    { item: 'Cut-off wheels / abrasive saw blade wear', qty: Math.max(1, Math.ceil(pieces / 30)), unit: 'ea', examplePrice: 4, exampleCost: 0, notes: `${pieces} cuts.` },
    { item: 'Flap discs (weld cleanup)', qty: Math.max(1, Math.ceil(weld / 500)), unit: 'ea', examplePrice: 7, exampleCost: 0 },
  ].map(line => ({ ...line, exampleCost: money(line.qty * line.examplePrice) }));
  const sum = (lines: BomLine[]) => money(lines.reduce((s, l) => s + l.exampleCost, 0));
  const exampleCost = { steel: sum(steel), panels: sum(panelLines), hardware: sum(hardwareLines), consumables: sum(consumables), total: 0 };
  exampleCost.total = money(exampleCost.steel + exampleCost.panels + exampleCost.hardware + exampleCost.consumables);
  return {
    steel, panels: panelLines, hardware: hardwareLines, consumables,
    totals: {
      steelWeightLb: round(steel.reduce((s, l) => s + (l.weightLb ?? 0), 0), 1),
      panelWeightLb: round(panelLines.reduce((s, l) => s + (l.weightLb ?? 0), 0), 1),
      weldInches: weld, paintSqFt, exampleCost,
    },
    priceNote: PRICE_NOTE,
  };
}
