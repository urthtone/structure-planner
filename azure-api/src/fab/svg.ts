import { getProfile } from './profiles';
import type { CutListLine, MemberDraft, StickPlan, ViewDef } from './types';
import { feetInchesText, inchesText } from './units';

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const n = (v: number) => (Math.round(v * 100) / 100).toString();
const COLORS: Record<string, string> = { A: '#1f6feb', B: '#2da44e', C: '#d4772c', D: '#8250df', E: '#cf222e', F: '#6e7781' };
const FONT = 'font-family="Helvetica, Arial, sans-serif"';

export function endCutText(line: Pick<CutListLine, 'ends' | 'parallelEnds'>): string {
  const [a, b] = line.ends;
  const one = (e: { angleDeg: number; note?: string }) => (e.angleDeg ? `${e.angleDeg}°${e.note ? ' ' + e.note : ''}` : 'square');
  if (!a.angleDeg && !b.angleDeg) return 'square both ends';
  if (a.angleDeg === b.angleDeg && a.note === b.note) return `${one(a)} both ends${line.parallelEnds ? ' (parallel)' : ' (opposed)'}`;
  return `${one(a)} / ${one(b)}${line.parallelEnds ? ' (parallel)' : ''}`;
}

/** Dimensioned drawing of one cut-list part. */
export function partSvg(line: CutListLine): string {
  const Wd = 720, Hd = 250, x0 = 40, usable = Wd - 80;
  const profile = getProfile(line.profileId);
  const depth = 30, y0 = 92;
  const off = (deg: number) => Math.min(depth * Math.tan((deg * Math.PI) / 180), usable / 3);
  const a = off(line.ends[0].angleDeg), b = off(line.ends[1].angleDeg);
  const x1 = x0 + usable;
  // Top edge is the long-point length; bottom edge is shortened by each angled cut.
  const pts = line.parallelEnds
    ? [[x0, y0], [x1 - b, y0], [x1, y0 + depth], [x0 + a, y0 + depth]]
    : [[x0, y0], [x1, y0], [x1 - b, y0 + depth], [x0 + a, y0 + depth]];
  const poly = pts.map(([x, y]) => `${n(x)},${n(y)}`).join(' ');
  const scale = usable / line.lengthIn;
  const marks = line.marks.map(mark => {
    const x = x0 + mark.atIn * scale;
    const hole = mark.holeDiaIn ? `<circle cx="${n(x)}" cy="${y0 + depth / 2}" r="5" fill="#fff" stroke="#111"/>` : `<line x1="${n(x)}" y1="${y0 - 4}" x2="${n(x)}" y2="${y0 + depth + 4}" stroke="#cf222e" stroke-dasharray="3 2"/>`;
    return `${hole}<text x="${n(x)}" y="${y0 + depth + 18}" font-size="9" text-anchor="middle" fill="#cf222e" ${FONT}>${esc(inchesText(mark.atIn))}</text>`;
  }).join('');
  const markNote = line.marks.length ? `Marks from left end: ${line.marks.map(m => `${inchesText(m.atIn)} ${m.note}${m.holeDiaIn ? ` (Ø${inchesText(m.holeDiaIn)} hole)` : ''}`).join('; ')}` : '';
  const notes = [markNote, ...line.notes].filter(Boolean).slice(0, 4);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Wd} ${Hd}" width="${Wd}" height="${Hd}" class="fab-part">
<rect width="${Wd}" height="${Hd}" fill="#fff"/>
<circle cx="24" cy="22" r="16" fill="${COLORS[line.group] ?? '#333'}"/><text x="24" y="27" font-size="13" font-weight="bold" text-anchor="middle" fill="#fff" ${FONT}>${esc(line.label)}</text>
<text x="48" y="20" font-size="14" font-weight="bold" ${FONT}>${esc(line.name)} — qty ${line.qty}</text>
<text x="48" y="36" font-size="11" fill="#444" ${FONT}>${esc(profile.name)} · ${esc(endCutText(line))} · ${line.weightLbEach.toFixed(1)} lb each</text>
<line x1="${x0}" y1="62" x2="${x1}" y2="62" stroke="#111" marker-start="url(#a)" marker-end="url(#a)"/>
<line x1="${x0}" y1="56" x2="${x0}" y2="${y0}" stroke="#999"/><line x1="${x1}" y1="56" x2="${x1}" y2="${y0}" stroke="#999"/>
<defs><marker id="a" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#111"/></marker></defs>
<rect x="${(x0 + x1) / 2 - 120}" y="50" width="240" height="16" fill="#fff"/>
<text x="${(x0 + x1) / 2}" y="62" font-size="13" text-anchor="middle" font-weight="bold" ${FONT}>${esc(line.lengthText)} (${esc(line.lengthInText)}) long point</text>
<polygon points="${poly}" fill="#e8eef7" stroke="#111" stroke-width="1.5"/>
${marks}
${line.ends.map((e, i) => (e.angleDeg ? `<text x="${i ? x1 - 4 : x0 + 4}" y="${y0 + depth + 32}" font-size="10" text-anchor="${i ? 'end' : 'start'}" ${FONT}>${e.angleDeg}° from square${e.note ? ' — ' + esc(e.note) : ''}</text>` : '')).join('')}
${notes.map((t, i) => `<text x="20" y="${180 + i * 15}" font-size="10.5" fill="#333" ${FONT}>${esc(t.length > 125 ? t.slice(0, 122) + '…' : t)}</text>`).join('')}
<text x="${Wd - 10}" y="${Hd - 8}" font-size="8.5" text-anchor="end" fill="#888" ${FONT}>Not to scale across the section. Verify all dimensions before cutting. Not an engineered drawing.</text>
</svg>`;
}

/** Framing/assembly view: members as strokes scaled to their face width, labeled. */
export function assemblySvg(view: ViewDef, members: (MemberDraft & { label: string })[]): string {
  const placements = members.flatMap(m => (m.placements ?? []).filter(p => p.view === view.id).map(p => ({ ...p, m })));
  const xs = [0, view.widthIn, ...placements.flatMap(p => [p.x1, p.x2]), ...(view.context ?? []).flatMap(p => [p.x1, p.x2])];
  const ys = [0, view.heightIn, ...placements.flatMap(p => [p.y1, p.y2]), ...(view.context ?? []).flatMap(p => [p.y1, p.y2])];
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const Wd = 760, pad = 50, top = 44; // right pad leaves room for the height label
  const scale = Math.min((Wd - 2 * pad) / (maxX - minX || 1), 520 / (maxY - minY || 1));
  const Hd = top + (maxY - minY) * scale + pad + 20 + (view.notes?.length ?? 0) * 14;
  const X = (x: number) => pad + (x - minX) * scale;
  const Y = (y: number) => top + (maxY - y) * scale; // y up
  const seen = new Set<string>();
  const strokes = placements.map(p => {
    const width = Math.max(2, getProfile(p.m.profileId).faceIn * scale);
    const key = `${p.m.label}`;
    const showLabel = !seen.has(key + Math.round(p.x1) + Math.round(p.y1)) && placements.length < 160;
    seen.add(key + Math.round(p.x1) + Math.round(p.y1));
    const mx = (X(p.x1) + X(p.x2)) / 2, my = (Y(p.y1) + Y(p.y2)) / 2;
    return `<line x1="${n(X(p.x1))}" y1="${n(Y(p.y1))}" x2="${n(X(p.x2))}" y2="${n(Y(p.y2))}" stroke="${COLORS[p.m.group] ?? '#333'}" stroke-width="${n(width)}" stroke-linecap="butt" opacity="0.85"/>` +
      (showLabel ? `<text x="${n(mx)}" y="${n(my + 3)}" font-size="9" text-anchor="middle" fill="#000" stroke="#fff" stroke-width="2.5" paint-order="stroke" ${FONT}>${esc(p.m.label)}</text>` : '');
  }).join('\n');
  const ctx = (view.context ?? []).map(p => `<line x1="${n(X(p.x1))}" y1="${n(Y(p.y1))}" x2="${n(X(p.x2))}" y2="${n(Y(p.y2))}" stroke="#aaa" stroke-width="2" stroke-dasharray="6 4"/>`).join('');
  const dimY = top + (maxY - minY) * scale + 22;
  const legend = [...new Set(placements.map(p => p.m.group))].sort();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Wd} ${n(Hd)}" width="${Wd}" height="${n(Hd)}" class="fab-assembly">
<rect width="${Wd}" height="${n(Hd)}" fill="#fff"/>
<text x="12" y="20" font-size="14" font-weight="bold" ${FONT}>${esc(view.title)}</text>
<text x="12" y="35" font-size="10" fill="#555" ${FONT}>${legend.map(g => `■ ${g}`).join('  ')}  · labels match the cut list · dashed = context (counted elsewhere)</text>
${ctx}
${strokes}
<line x1="${n(X(0))}" y1="${n(dimY)}" x2="${n(X(view.widthIn))}" y2="${n(dimY)}" stroke="#111"/>
<line x1="${n(X(0))}" y1="${n(dimY - 5)}" x2="${n(X(0))}" y2="${n(dimY + 5)}" stroke="#111"/><line x1="${n(X(view.widthIn))}" y1="${n(dimY - 5)}" x2="${n(X(view.widthIn))}" y2="${n(dimY + 5)}" stroke="#111"/>
<text x="${n((X(0) + X(view.widthIn)) / 2)}" y="${n(dimY + 15)}" font-size="11" text-anchor="middle" ${FONT}>${esc(feetInchesText(view.widthIn))}</text>
<text x="${n(X(maxX) + 22)}" y="${n((Y(0) + Y(view.heightIn)) / 2)}" font-size="11" ${FONT} transform="rotate(-90 ${n(X(maxX) + 22)} ${n((Y(0) + Y(view.heightIn)) / 2)})" text-anchor="middle">${esc(feetInchesText(view.heightIn))}</text>
${(view.notes ?? []).map((t, i) => `<text x="12" y="${n(dimY + 34 + i * 14)}" font-size="10" fill="#333" ${FONT}>${esc(t)}</text>`).join('')}
</svg>`;
}

/** Stick diagram for one profile's nesting plan. */
export function nestingSvg(profileName: string, bars: StickPlan[]): string {
  const Wd = 760, rowH = 26, top = 30;
  const longest = Math.max(...bars.map(b => b.stockLengthIn));
  const scale = (Wd - 140) / longest;
  const rows = bars.map((bar, i) => {
    const y = top + i * rowH;
    let x = 120;
    const cuts = bar.cuts.map(c => {
      const w = c.lengthIn * scale;
      const r = `<rect x="${n(x)}" y="${y}" width="${n(Math.max(1, w - 1))}" height="18" fill="#cfe1fb" stroke="#1f6feb"/>` +
        (w > 26 ? `<text x="${n(x + w / 2)}" y="${y + 13}" font-size="9" text-anchor="middle" ${FONT}>${esc(c.label)} ${esc(inchesText(c.lengthIn))}</text>` : '');
      x += w;
      return r;
    }).join('');
    const end = 120 + bar.stockLengthIn * scale;
    return `<text x="8" y="${y + 13}" font-size="10" ${FONT}>#${i + 1} · ${bar.stockLengthIn / 12} ft</text><rect x="120" y="${y}" width="${n(bar.stockLengthIn * scale)}" height="18" fill="#f6f8fa" stroke="#999"/>${cuts}` +
      `<text x="${n(end + 4)}" y="${y + 13}" font-size="9" fill="#666" ${FONT}>off ${esc(inchesText(bar.offcutIn))}</text>`;
  }).join('\n');
  const Hd = top + bars.length * rowH + 10;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Wd} ${Hd}" width="${Wd}" height="${Hd}" class="fab-nesting"><rect width="${Wd}" height="${Hd}" fill="#fff"/><text x="8" y="18" font-size="12" font-weight="bold" ${FONT}>${esc(profileName)} — cutting plan</text>${rows}</svg>`;
}
