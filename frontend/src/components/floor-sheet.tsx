import type { Plan } from "@/lib/plan";

export function FloorSheet({ plan }: { plan: Plan }) {
  const { widthFt: w, lengthFt: l, wallHeightFt: h, roof } = plan.dimensions;
  const pad = 64;
  const draw = 300;
  const scale = draw / Math.max(w, l);
  const W = w * scale;
  const L = l * scale;
  const sheetW = W + pad * 2;
  const sheetH = L + pad * 2 + 16;
  const rooms = plan.rooms.length
    ? plan.rooms
    : [{ name: plan.structureType, x: 0, y: 0, w, h: l }];
  const gable = /gable/i.test(roof) && plan.structureType !== "deck";
  const eave = 28;
  const wallH = 120;

  return (
    <div className="print-sheet overflow-hidden rounded-xl border border-line bg-card text-ink">
      <div className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <p className="font-display text-lg leading-tight">{plan.title}</p>
          <p className="text-sm text-muted">Planning sketch · not a survey or permit set</p>
        </div>
        <p className="text-right text-sm text-muted tabular-nums">
          {w}′ × {l}′
          <br />
          {h}′ high
        </p>
      </div>

      <svg viewBox={`0 0 ${sheetW} ${sheetH}`} className="h-auto w-full" role="img" aria-label={`Floor plan, ${w} by ${l} feet`}>
        <rect width={sheetW} height={sheetH} fill="var(--color-card)" />
        <text x={pad} y={28} fill="currentColor" fontSize="13" fontFamily="Source Sans 3, sans-serif">
          North
        </text>
        <polygon points={`${pad + 36},14 ${pad + 30},28 ${pad + 42},28`} fill="currentColor" />

        {rooms.map((room) => (
          <g key={`${room.name}-${room.x}-${room.y}`}>
            <rect
              x={pad + room.x * scale}
              y={pad + room.y * scale}
              width={Math.max(room.w * scale, 8)}
              height={Math.max(room.h * scale, 8)}
              fill="var(--color-cedar-soft)"
              stroke="currentColor"
              strokeWidth="3"
            />
            <text
              x={pad + (room.x + room.w / 2) * scale}
              y={pad + (room.y + room.h / 2) * scale}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="currentColor"
              fontSize="16"
              fontFamily="Fraunces, serif"
            >
              {room.name}
            </text>
          </g>
        ))}

        {plan.openings.map((opening, index) => {
          const along = opening.offsetFt * scale;
          const span = opening.widthFt * scale;
          const horizontal = opening.wall === "n" || opening.wall === "s";
          const x = horizontal ? pad + along : opening.wall === "w" ? pad - 7 : pad + W - 7;
          const y = horizontal ? (opening.wall === "n" ? pad - 7 : pad + L - 7) : pad + along;
          return (
            <g key={`${opening.wall}-${opening.kind}-${index}`}>
              <rect
                x={x}
                y={y}
                width={horizontal ? span : 14}
                height={horizontal ? 14 : span}
                fill="var(--color-card)"
              />
              {opening.kind === "window" ? (
                <line
                  x1={horizontal ? x : x + 7}
                  y1={horizontal ? y + 7 : y}
                  x2={horizontal ? x + span : x + 7}
                  y2={horizontal ? y + 7 : y + span}
                  stroke="var(--color-cedar)"
                  strokeWidth="3"
                />
              ) : (
                <path
                  d={
                    horizontal
                      ? `M ${x} ${y + 7} A ${span} ${span} 0 0 ${opening.wall === "s" ? 1 : 0} ${x + span} ${y + 7}`
                      : `M ${x + 7} ${y} A ${span} ${span} 0 0 1 ${x + 7} ${y + span}`
                  }
                  fill="none"
                  stroke="var(--color-cedar)"
                  strokeWidth="2"
                />
              )}
            </g>
          );
        })}

        <line x1={pad} x2={pad + W} y1={pad + L + 26} y2={pad + L + 26} stroke="currentColor" />
        <line x1={pad} x2={pad} y1={pad + L + 20} y2={pad + L + 32} stroke="currentColor" />
        <line x1={pad + W} x2={pad + W} y1={pad + L + 20} y2={pad + L + 32} stroke="currentColor" />
        <text x={pad + W / 2} y={pad + L + 46} textAnchor="middle" fill="currentColor" fontSize="13" fontFamily="Source Sans 3, sans-serif">
          {w} ft
        </text>
        <line x1={pad + W + 26} x2={pad + W + 26} y1={pad} y2={pad + L} stroke="currentColor" />
        <text
          x={pad + W + 42}
          y={pad + L / 2}
          fill="currentColor"
          fontSize="13"
          fontFamily="Source Sans 3, sans-serif"
          transform={`rotate(90 ${pad + W + 42} ${pad + L / 2})`}
        >
          {l} ft
        </text>
      </svg>

      <div className="border-t border-line px-4 py-4">
        <p className="mb-2 text-sm text-muted">Front · {roof}</p>
        <svg viewBox="0 0 360 190" className="h-auto w-full" role="img" aria-label={`Front elevation, ${w} feet wide and ${h} feet high`}>
          <line x1="30" y1="160" x2="330" y2="160" stroke="currentColor" strokeWidth="2" />
          {gable && <polygon points={`40,${160 - wallH} 180,${160 - wallH - eave} 320,${160 - wallH}`} fill="var(--color-cedar-soft)" stroke="currentColor" strokeWidth="2" />}
          <rect x="40" y={160 - wallH} width="280" height={wallH} fill="var(--color-paper)" stroke="currentColor" strokeWidth="2" />
          <text x="180" y="178" textAnchor="middle" fill="currentColor" fontSize="13" fontFamily="Source Sans 3, sans-serif">
            {w} ft wide · {h} ft to the plate
          </text>
          {plan.openings
            .filter((opening) => opening.wall === "s")
            .map((opening, index) => {
              const x = 40 + (opening.offsetFt / w) * 280;
              const ow = Math.min((opening.widthFt / w) * 280, 280);
              const oh = opening.kind === "window" ? 36 : 62;
              const y = opening.kind === "window" ? 160 - wallH + 28 : 160 - oh;
              return <rect key={index} x={x} y={y} width={Math.max(ow, 10)} height={oh} fill="var(--color-card)" stroke="var(--color-cedar)" strokeWidth="2" />;
            })}
        </svg>
      </div>
    </div>
  );
}
