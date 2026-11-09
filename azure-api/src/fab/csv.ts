import type { FabResult } from './types';

const cell = (v: unknown) => {
  const s = v === undefined || v === null ? '' : String(v);
  // Neutralize spreadsheet formula injection and quote as needed.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
const rows = (data: unknown[][]) => data.map(r => r.map(cell).join(',')).join('\r\n') + '\r\n';

export function cutListCsv(fab: FabResult): string {
  return rows([
    ['Label', 'Group', 'Part', 'Profile', 'Qty', 'Length (ft-in)', 'Length (in)', 'Length decimal in', 'End cuts', 'Weight each (lb)', 'Notes'],
    ...fab.cutList.map(l => [l.label, l.groupName, l.name, l.profileName, l.qty, l.lengthText, l.lengthInText, l.lengthIn, l.endsText, l.weightLbEach, l.notes.join(' | ')]),
  ]);
}

export function bomCsv(fab: FabResult): string {
  const b = fab.bom;
  return rows([
    ['Section', 'Item', 'Qty', 'Unit', 'Linear ft', 'Weight (lb)', 'Example unit price ($)', 'Example cost ($)', 'Notes'],
    ...b.steel.map(l => ['Steel', l.item, l.qty, `${l.unit} (${l.sticks})`, l.linearFt, l.weightLb, l.examplePrice, l.exampleCost, l.notes]),
    ...b.panels.map(l => ['Panels/sheet', l.item, l.qty, l.unit, '', l.weightLb, l.examplePrice, l.exampleCost, l.notes]),
    ...b.hardware.map(l => ['Hardware', l.item, l.qty, l.unit, '', '', l.examplePrice, l.exampleCost, l.notes]),
    ...b.consumables.map(l => ['Consumables', l.item, l.qty, l.unit, '', '', l.examplePrice, l.exampleCost, l.notes]),
    ['Total', 'Example total (not a quote)', '', '', '', b.totals.steelWeightLb, '', b.totals.exampleCost.total, b.priceNote],
  ]);
}
