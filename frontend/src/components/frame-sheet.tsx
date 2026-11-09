import type { ReactNode } from "react";
import { frameOf, formatFeet, type Frame } from "@/lib/frame";
import type { Plan } from "@/lib/plan";

export function FrameSheet({ plan }: { plan: Plan }) {
  const frame = frameOf(plan);
  const { widthFt: w, lengthFt: l } = plan.dimensions;

  return (
    <div className="space-y-6">
      <section className="print-sheet overflow-hidden rounded-xl border border-line bg-card">
        <header className="border-b border-line px-4 py-3">
          <h2 className="text-xl">Frame</h2>
          <p className="text-sm text-muted">16 in. on center. Planning lengths, not a stamped drawing.</p>
        </header>
        <div className="grid gap-6 p-4">
          <Drawing title={frame.deck ? "Deck framing" : "Floor framing"} caption={`${frame.joists.length} joists span ${formatFeet(w)}`}>
            <FloorFrame frame={frame} width={w} length={l} />
          </Drawing>
          {frame.deck ? (
            <Drawing title="Section" caption={`Posts about ${formatFeet(plan.dimensions.wallHeightFt)} above grade`}>
              <DeckSection frame={frame} width={w} height={plan.dimensions.wallHeightFt} />
            </Drawing>
          ) : (
            <>
              <Drawing title="Front wall" caption={`Studs cut to ${formatFeet(frame.studFt)}`}>
                <WallFrame frame={frame} width={w} />
              </Drawing>
              <Drawing title="Roof section" caption={`${frame.pitchLabel} · rafter ${formatFeet(frame.rafterFt)}`}>
                <RoofFrame frame={frame} width={w} />
              </Drawing>
            </>
          )}
        </div>
      </section>

      <section className="print-sheet overflow-hidden rounded-xl border border-line bg-card p-4">
        <h2 className="text-xl">Cut list</h2>
        <p className="mt-1 text-sm text-muted">Cut from the buy length. Check the stick before you cut the next one.</p>
        <div className="cut-scroll mt-3 overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="text-muted">
              <tr className="border-b border-line">
                <th className="py-2 pr-3 font-semibold">Member</th>
                <th className="py-2 pr-3 font-semibold">Size</th>
                <th className="py-2 pr-3 font-semibold">Cut</th>
                <th className="py-2 pr-3 font-semibold">Qty</th>
                <th className="py-2 font-semibold">Buy</th>
              </tr>
            </thead>
            <tbody>
              {frame.cuts.map((row, index) => (
                <tr key={`${row.member}-${index}`} className="border-b border-line last:border-0">
                  <td className="py-2 pr-3 font-semibold">{row.member}</td>
                  <td className="py-2 pr-3 tabular-nums">{row.size}</td>
                  <td className="py-2 pr-3 tabular-nums">{row.length}</td>
                  <td className="py-2 pr-3 tabular-nums">{row.qty}</td>
                  <td className="py-2 tabular-nums text-muted">{row.buy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Drawing({ title, caption, children }: { title: string; caption: string; children: ReactNode }) {
  return (
    <figure>
      <figcaption className="mb-2">
        <span className="font-semibold">{title}</span>
        <span className="mt-0.5 block text-sm text-muted">{caption}</span>
      </figcaption>
      {children}
    </figure>
  );
}

function FloorFrame({ frame, width, length }: { frame: Frame; width: number; length: number }) {
  const pad = 36;
  const draw = 260;
  const scale = draw / Math.max(width, length);
  const W = width * scale;
  const L = length * scale;
  const sheetW = W + pad * 2;
  const sheetH = L + pad * 2;
  return (
    <svg viewBox={`0 0 ${sheetW} ${sheetH}`} className="h-auto w-full text-ink" role="img" aria-label="Floor framing plan">
      <rect width={sheetW} height={sheetH} fill="var(--color-card)" />
      {frame.skids.map((at) => (
        <line key={`skid-${at}`} x1={pad + at * scale} x2={pad + at * scale} y1={pad} y2={pad + L} stroke="currentColor" strokeWidth="4" />
      ))}
      {frame.joists.map((at) => (
        <line key={`joist-${at}`} x1={pad} x2={pad + W} y1={pad + at * scale} y2={pad + at * scale} stroke="var(--color-cedar)" strokeWidth="1.5" />
      ))}
      <rect x={pad} y={pad} width={W} height={L} fill="none" stroke="currentColor" strokeWidth="3" />
    </svg>
  );
}

function WallFrame({ frame, width }: { frame: Frame; width: number }) {
  const left = 28;
  const right = 392;
  const span = right - left;
  const top = 36;
  const bottom = 168;
  const opening = frame.opening;
  const openX = opening ? left + (opening.offsetFt / width) * span : 0;
  const openW = opening ? Math.min((opening.widthFt / width) * span, span * 0.7) : 0;
  const headerY = opening?.kind === "window" ? 78 : 52;
  return (
    <svg viewBox="0 0 420 200" className="h-auto w-full text-ink" role="img" aria-label="Front wall framing">
      <rect width="420" height="200" fill="var(--color-card)" />
      <rect x={left} y={top} width={span} height="8" fill="currentColor" />
      <rect x={left} y={top + 10} width={span} height="6" fill="currentColor" />
      <rect x={left} y={bottom} width={span} height="8" fill="currentColor" />
      {frame.studs.map((at) => {
        const x = left + (at / width) * span;
        if (opening && x > openX + 4 && x < openX + openW - 4) return null;
        return <line key={at} x1={x} x2={x} y1={top + 16} y2={bottom} stroke="currentColor" strokeWidth="2" />;
      })}
      {opening && (
        <>
          <line x1={openX} x2={openX} y1={headerY} y2={bottom} stroke="var(--color-cedar)" strokeWidth="3" />
          <line x1={openX + openW} x2={openX + openW} y1={headerY} y2={bottom} stroke="var(--color-cedar)" strokeWidth="3" />
          <rect x={openX} y={headerY - 8} width={openW} height="8" fill="var(--color-cedar)" />
        </>
      )}
    </svg>
  );
}

function RoofFrame({ frame, width }: { frame: Frame; width: number }) {
  const rise = Math.min(70, (width / 2) * (frame.pitchLabel === "6/12" ? 0.5 : 1 / 3) * 18);
  const left = 50;
  const right = 370;
  const ridge = (left + right) / 2;
  const plate = 150;
  return (
    <svg viewBox="0 0 420 190" className="h-auto w-full text-ink" role="img" aria-label="Roof framing section">
      <rect width="420" height="190" fill="var(--color-card)" />
      <line x1={left} x2={ridge} y1={plate} y2={plate - rise} stroke="currentColor" strokeWidth="3" />
      <line x1={right} x2={ridge} y1={plate} y2={plate - rise} stroke="currentColor" strokeWidth="3" />
      <line x1={left - 16} x2={left + 16} y1={plate} y2={plate} stroke="var(--color-cedar)" strokeWidth="6" />
      <line x1={right - 16} x2={right + 16} y1={plate} y2={plate} stroke="var(--color-cedar)" strokeWidth="6" />
      <text x={ridge} y={plate - rise - 10} textAnchor="middle" fill="currentColor" fontSize="13" fontFamily="Source Sans 3, sans-serif">
        {frame.pitchLabel}
      </text>
      <text x={ridge} y={178} textAnchor="middle" fill="currentColor" fontSize="13" fontFamily="Source Sans 3, sans-serif">
        {formatFeet(width)} span · {frame.rafters.length * 2} rafters
      </text>
    </svg>
  );
}

function DeckSection({ frame, width, height }: { frame: Frame; width: number; height: number }) {
  return (
    <svg viewBox="0 0 420 180" className="h-auto w-full text-ink" role="img" aria-label="Deck section">
      <rect width="420" height="180" fill="var(--color-card)" />
      <line x1="40" x2="380" y1="150" y2="150" stroke="currentColor" strokeWidth="2" />
      <rect x="70" y="70" width="280" height="10" fill="var(--color-cedar)" />
      <line x1="90" x2="90" y1="80" y2="150" stroke="currentColor" strokeWidth="4" />
      <line x1="330" x2="330" y1="80" y2="150" stroke="currentColor" strokeWidth="4" />
      <line x1="86" x2="334" y1="84" y2="84" stroke="currentColor" strokeWidth="6" />
      <text x="210" y="40" textAnchor="middle" fill="currentColor" fontSize="13" fontFamily="Source Sans 3, sans-serif">
        {formatFeet(width)} · {frame.joists.length} joists · posts {formatFeet(height)}
      </text>
    </svg>
  );
}
