import { buildBom } from './bom';
import { generateBlind } from './blind';
import { generateCarport } from './carport';
import { generateGate } from './gate';
import { nestCutList } from './nesting';
import { getProfile } from './profiles';
import { FabSpecError, normalizeSpec, type NormalizedSpec } from './spec';
import { assemblySvg, endCutText, partSvg } from './svg';
import { generateTrailer } from './trailer';
import type { CutListLine, FabResult, FabSpec, GeneratorOutput, MemberDraft } from './types';
import { feetInchesText, inchesText, round, sixteenth } from './units';

export const SAFETY_WARNINGS = [
  'NOT ENGINEERED: this is a fabrication planning aid, not stamped or engineered drawings.',
  'Verify every dimension, member size, weld and load (wind, snow, live, towing) and local codes/permits before cutting steel.',
  'Welding and cutting hazards: use proper PPE, ventilation and fire watch; follow equipment instructions.',
];

const GENERATORS: Record<NormalizedSpec['projectType'], (spec: NormalizedSpec) => GeneratorOutput> = {
  blind: generateBlind, trailer: generateTrailer, gate: generateGate, carport: generateCarport,
};

/** Split members longer than the longest stick into equal spliced pieces. */
function splitLong(members: MemberDraft[], spec: NormalizedSpec, out: GeneratorOutput) {
  const usable = Math.max(...spec.stock.lengthsFt) * 12 - spec.stock.trimIn - 0.25;
  const result: MemberDraft[] = [];
  let splices = 0;
  for (const m of members) {
    if (m.lengthIn <= usable) { result.push(m); continue; }
    // Cut points: prefer the furthest support (post/truss line) within reach, else equal pieces.
    const cuts: number[] = [];
    let start = 0;
    const supports = [...(m.supports ?? [])].sort((a, b) => a - b);
    while (m.lengthIn - start > usable) {
      const reach = supports.filter(s => s > start + 12 && s <= start + usable).pop();
      const remaining = m.lengthIn - start;
      const next = reach ?? start + remaining / Math.ceil(remaining / usable);
      cuts.push(next);
      start = next;
    }
    const bounds = [0, ...cuts, m.lengthIn];
    const k = bounds.length - 1;
    splices += (k - 1) * m.qty;
    const note = `Spliced: ${k} pieces make one ${feetInchesText(m.lengthIn)} member (joints at ${cuts.map(c => feetInchesText(c)).join(', ')} from its start); ${m.supports?.length ? 'joints land on supports' : 'land joints over a support'} — add an internal sleeve or splice plates.`;
    for (let i = 0; i < k; i++) {
      const ends: MemberDraft['ends'] = [i === 0 ? m.ends[0] : { angleDeg: 0 }, i === k - 1 ? m.ends[1] : { angleDeg: 0 }];
      result.push({ ...m, name: `${m.name} (splice piece)`, lengthIn: bounds[i + 1] - bounds[i], ends, notes: [...(m.notes ?? []), note], placements: i === 0 ? m.placements : [], marks: [], supports: [] });
    }
  }
  if (splices) {
    out.hardware.push({ item: 'Splice sleeve / plate set (cut from next-size tube or flat bar)', qty: splices, unit: 'ea', examplePrice: 12 });
    out.warnings.push(`${splices} splice(s) needed because some members are longer than the ${Math.max(...spec.stock.lengthsFt)} ft stock; longer stock avoids splices.`);
  }
  return result;
}

function groupMembers(members: MemberDraft[], groups: Record<string, string>) {
  const lines = new Map<string, { member: MemberDraft; qty: number; placements: MemberDraft['placements']; notes: Set<string> }>();
  for (const m of members) {
    const length = sixteenth(m.lengthIn);
    const key = [m.group, m.name, m.profileId, length, m.ends.map(e => `${e.angleDeg}:${e.note ?? ''}`).join('/'), m.parallelEnds ? 'p' : ''].join('|');
    const prior = lines.get(key);
    if (prior) { prior.qty += m.qty; prior.placements = [...(prior.placements ?? []), ...(m.placements ?? [])]; (m.notes ?? []).forEach(n => prior.notes.add(n)); }
    else lines.set(key, { member: { ...m, lengthIn: length }, qty: m.qty, placements: [...(m.placements ?? [])], notes: new Set(m.notes ?? []) });
  }
  const counters = new Map<string, number>();
  const sorted = [...lines.values()].sort((a, b) => a.member.group.localeCompare(b.member.group) || b.member.lengthIn - a.member.lengthIn);
  const labeled: (MemberDraft & { label: string })[] = [];
  const cutList: CutListLine[] = sorted.map(({ member, qty, placements, notes }) => {
    const index = (counters.get(member.group) ?? 0) + 1;
    counters.set(member.group, index);
    const label = `${member.group}${index}`;
    const profile = getProfile(member.profileId);
    labeled.push({ ...member, qty, placements, label });
    const line: CutListLine = {
      label, group: member.group, groupName: groups[member.group] ?? member.group, name: member.name, role: member.role,
      profileId: member.profileId, profileName: profile.name, lengthIn: member.lengthIn, lengthText: feetInchesText(member.lengthIn), lengthInText: inchesText(member.lengthIn),
      qty, ends: member.ends, endsText: '', parallelEnds: !!member.parallelEnds, notes: [...notes], marks: member.marks ?? [],
      weightLbEach: round((member.lengthIn / 12) * profile.lbPerFt, 2),
    };
    line.endsText = endCutText(line);
    return line;
  });
  return { cutList, labeled };
}

/** Deterministic fabrication plan from a structured spec. Throws FabSpecError for invalid specs. */
export function generateFab(input: FabSpec | unknown): FabResult {
  const spec = normalizeSpec(input);
  const out = GENERATORS[spec.projectType](spec);
  const members = splitLong(out.members, spec, out);
  const { cutList, labeled } = groupMembers(members, out.groups);
  if (!cutList.length) throw new FabSpecError(['The spec produced no members.']);
  const factors = new Map(labeled.map(m => [m.label, m.weldFactor ?? 1]));
  const nesting = nestCutList(cutList, spec.stock.lengthsFt, spec.stock.kerfIn, spec.stock.trimIn);
  const bom = buildBom(spec, cutList, nesting, out.hardware, out.panels, factors);
  const assembly = out.views
    .filter(view => labeled.some(m => m.placements?.some(p => p.view === view.id)))
    .map(view => ({ id: view.id, title: view.title, svg: assemblySvg(view, labeled) }));
  const fullSpec: FabSpec = { ...spec, title: out.title };
  return {
    title: out.title,
    projectType: spec.projectType,
    spec: fullSpec,
    cutList,
    nesting,
    bom,
    plans: { parts: cutList.map(line => ({ label: line.label, svg: partSvg(line) })), assembly },
    warnings: [...SAFETY_WARNINGS, ...out.warnings],
    assumptions: [
      ...out.assumptions,
      `Stock ${spec.stock.lengthsFt.join('/')} ft sticks, ${inchesText(spec.stock.kerfIn)} kerf, ${inchesText(spec.stock.trimIn)} trimmed off each stick end. Lengths are long point to long point, rounded to 1/16".`,
      'Weights from published A500/A36 lb/ft tables; weld, wire, gas and paint quantities are rough estimates.',
    ],
  };
}
export { FabSpecError };
