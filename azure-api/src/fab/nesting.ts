import { getProfile } from './profiles';
import type { CutListLine, NestingResult, ProfileNesting, StickPlan } from './types';
import { round } from './units';

interface Piece { label: string; lengthIn: number }
interface Bin { stockLengthIn: number; cuts: Piece[]; used: number }

/** Material consumed by the cuts on a stick: trim + pieces + one kerf between each piece. */
const consumed = (trimIn: number, kerfIn: number, pieces: Piece[], extra?: Piece) => {
  const list = extra ? [...pieces, extra] : pieces;
  return trimIn + list.reduce((sum, piece) => sum + piece.lengthIn, 0) + kerfIn * Math.max(0, list.length - 1);
};

/** First-fit decreasing onto sticks of one length. */
function firstFitDecreasing(pieces: Piece[], stockIn: number, kerfIn: number, trimIn: number): Bin[] {
  const bins: Bin[] = [];
  for (const piece of [...pieces].sort((a, b) => b.lengthIn - a.lengthIn || a.label.localeCompare(b.label))) {
    // Best fit: the stick that would be left with the smallest remainder.
    let best: Bin | undefined;
    let bestLeft = Infinity;
    for (const bin of bins) {
      const left = bin.stockLengthIn - consumed(trimIn, kerfIn, bin.cuts, piece);
      if (left >= -1e-9 && left < bestLeft) { best = bin; bestLeft = left; }
    }
    if (best) { best.cuts.push(piece); best.used = consumed(trimIn, kerfIn, best.cuts); }
    else bins.push({ stockLengthIn: stockIn, cuts: [piece], used: consumed(trimIn, kerfIn, [piece]) });
  }
  return bins;
}

/**
 * 1D cutting-stock heuristic: best-fit decreasing on each available stick length,
 * then each stick is downsized to the shortest available length that still fits.
 * Picks the plan with the least purchased length (ties: fewer sticks).
 */
export function nestProfile(profileId: string, pieces: Piece[], stockLengthsFt: number[], kerfIn: number, trimIn: number): ProfileNesting {
  const lengths = [...stockLengthsFt].sort((a, b) => a - b).map(feet => feet * 12);
  const longest = lengths[lengths.length - 1];
  for (const piece of pieces)
    if (consumed(trimIn, kerfIn, [piece]) > longest + 1e-9)
      throw new Error(`Piece ${piece.label} (${piece.lengthIn}") is longer than the longest stock stick.`);
  // Tiny quantities (e.g. a few tabs): buy a cut-to-length drop instead of a full stick.
  const total = consumed(trimIn, kerfIn, pieces);
  if (total <= 48 && total < 0.25 * lengths[0]) {
    const dropIn = Math.ceil(total / 12) * 12;
    const usedIn = pieces.reduce((sum, piece) => sum + piece.lengthIn, 0);
    return {
      profileId, profileName: getProfile(profileId).name,
      sticks: [{ stockLengthFt: dropIn / 12, count: 1, drop: true }], totalSticks: 1,
      bars: [{ stockLengthIn: dropIn, drop: true, cuts: pieces.map(p => ({ label: p.label, lengthIn: p.lengthIn })), offcutIn: round(Math.max(0, dropIn - total - kerfIn), 4) }],
      purchasedIn: dropIn, usedIn: round(usedIn, 4), wastePct: round(((dropIn - usedIn) / dropIn) * 100, 1), usableOffcutsIn: [],
    };
  }
  let bestBins: Bin[] = [];
  let bestScore = Infinity;
  for (const stockIn of lengths) {
    if (pieces.some(piece => consumed(trimIn, kerfIn, [piece]) > stockIn + 1e-9)) continue;
    const bins = firstFitDecreasing(pieces, stockIn, kerfIn, trimIn);
    for (const bin of bins) bin.stockLengthIn = lengths.find(length => length >= bin.used - 1e-9) ?? bin.stockLengthIn;
    const purchased = bins.reduce((sum, bin) => sum + bin.stockLengthIn, 0);
    const score = purchased * 1000 + bins.length;
    if (score < bestScore) { bestScore = score; bestBins = bins; }
  }
  const bars: StickPlan[] = bestBins
    .map(bin => ({
      stockLengthIn: bin.stockLengthIn,
      cuts: bin.cuts.map(cut => ({ label: cut.label, lengthIn: cut.lengthIn })),
      offcutIn: round(Math.max(0, bin.stockLengthIn - bin.used - (bin.stockLengthIn - bin.used > kerfIn ? kerfIn : 0)), 4),
    }))
    .sort((a, b) => b.stockLengthIn - a.stockLengthIn || a.offcutIn - b.offcutIn);
  const counts = new Map<number, number>();
  for (const bar of bars) counts.set(bar.stockLengthIn, (counts.get(bar.stockLengthIn) ?? 0) + 1);
  const purchasedIn = bars.reduce((sum, bar) => sum + bar.stockLengthIn, 0);
  const usedIn = pieces.reduce((sum, piece) => sum + piece.lengthIn, 0);
  return {
    profileId,
    profileName: getProfile(profileId).name,
    sticks: [...counts].sort((a, b) => b[0] - a[0]).map(([inches, count]) => ({ stockLengthFt: inches / 12, count })),
    totalSticks: bars.length,
    bars,
    purchasedIn,
    usedIn: round(usedIn, 4),
    wastePct: purchasedIn ? round(((purchasedIn - usedIn) / purchasedIn) * 100, 1) : 0,
    usableOffcutsIn: bars.map(bar => bar.offcutIn).filter(offcut => offcut >= 12).sort((a, b) => b - a),
  };
}

export function nestCutList(cutList: CutListLine[], stockLengthsFt: number[], kerfIn: number, trimIn: number): NestingResult {
  const byProfile = new Map<string, Piece[]>();
  for (const line of cutList) {
    const list = byProfile.get(line.profileId) ?? [];
    for (let i = 0; i < line.qty; i++) list.push({ label: line.label, lengthIn: line.lengthIn });
    byProfile.set(line.profileId, list);
  }
  const profiles = [...byProfile].map(([id, pieces]) => nestProfile(id, pieces, stockLengthsFt, kerfIn, trimIn));
  const purchased = profiles.reduce((sum, p) => sum + p.purchasedIn, 0);
  const used = profiles.reduce((sum, p) => sum + p.usedIn, 0);
  return {
    kerfIn, trimIn, stockLengthsFt,
    profiles,
    purchasedFt: round(purchased / 12, 2),
    usedFt: round(used / 12, 2),
    wastePct: purchased ? round(((purchased - used) / purchased) * 100, 1) : 0,
  };
}
