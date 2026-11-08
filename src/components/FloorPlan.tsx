import React from "react";
import type { PlanInput } from "../lib/planning";

export function FloorPlan({
  input: p,
  showFraming,
}: {
  input: PlanInput;
  showFraming: boolean;
}) {
  const scale = 20;
  const w = p.width * scale,
    l = p.length * scale;
  const door = p.doorWidth * scale;
  const deck = p.type === "deck";
  const windows = deck
    ? []
    : Array.from({ length: p.windows }, (_, i) => {
        const side = i % 2;
        const count =
          side === 0 ? Math.ceil(p.windows / 2) : Math.floor(p.windows / 2);
        return {
          x: side === 0 ? 0 : w,
          y: ((Math.floor(i / 2) + 1) * l) / (count + 1),
        };
      });
  return (
    <svg
      viewBox={`-60 -45 ${w + 120} ${l + 130}`}
      className="floor-plan"
      role="img"
      aria-label={`${p.width} by ${p.length} foot ${p.type} floor plan`}
    >
      <title>{`${p.width} × ${p.length} ft ${p.type}; front at bottom`}</title>
      <rect
        width={w}
        height={l}
        fill="#faf8ef"
        stroke="#334155"
        strokeWidth="5"
      />
      {showFraming && (
        <g stroke="#94a3b8" strokeWidth="1">
          {p.foundation !== "slab" &&
            Array.from(
              { length: Math.ceil((p.length * 12) / 16) + 1 },
              (_, i) => (
                <line
                  key={`j${i}`}
                  x1="3"
                  x2={w - 3}
                  y1={Math.min(((i * 16) / 12) * scale, l)}
                  y2={Math.min(((i * 16) / 12) * scale, l)}
                  strokeDasharray="4 3"
                />
              ),
            )}
          {!deck &&
            Array.from(
              { length: Math.ceil((p.width * 12) / p.studSpacing) + 1 },
              (_, i) => (
                <g key={`s${i}`}>
                  <line
                    x1={Math.min(((i * p.studSpacing) / 12) * scale, w)}
                    x2={Math.min(((i * p.studSpacing) / 12) * scale, w)}
                    y1="0"
                    y2="7"
                  />
                </g>
              ),
            )}
        </g>
      )}
      {!deck && (
        <g>
          <line
            x1={(w - door) / 2}
            x2={(w + door) / 2}
            y1={l}
            y2={l}
            stroke="#fff"
            strokeWidth="7"
          />
          <line
            x1={(w - door) / 2}
            x2={(w - door) / 2}
            y1={l}
            y2={l - door}
            stroke="#b45309"
            strokeWidth="2"
          />
          <path
            d={`M ${(w - door) / 2} ${l - door} A ${door} ${door} 0 0 1 ${(w + door) / 2} ${l}`}
            fill="none"
            stroke="#b45309"
            strokeDasharray="3 2"
          />
          <text x={w / 2} y={l + 23} textAnchor="middle" fontSize="11">
            {p.doorWidth}-ft door · front
          </text>
        </g>
      )}
      {windows.map((position, i) => (
        <g key={i} data-window={i + 1}>
          <line
            x1={position.x}
            x2={position.x}
            y1={position.y - 30}
            y2={position.y + 30}
            stroke="#38bdf8"
            strokeWidth="7"
          />
          <title>{`Window ${i + 1}: assumed 3×3 ft`}</title>
        </g>
      ))}
      <g stroke="#64748b" strokeWidth="1">
        <path
          d={`M 0 -12 V -25 H ${w} V -12 M -12 0 H -25 V ${l} H -12`}
          fill="none"
        />
      </g>
      <text x={w / 2} y="-30" textAnchor="middle" fontSize="12">
        {p.width} ft
      </text>
      <text
        transform={`translate(-35 ${l / 2}) rotate(-90)`}
        textAnchor="middle"
        fontSize="12"
      >
        {p.length} ft
      </text>
      <text x={w / 2} y={l + 45} textAnchor="middle" fontSize="11">
        Concept only · not construction drawings
      </text>
      {showFraming && (
        <text x={w / 2} y={l + 64} textAnchor="middle" fontSize="10">
          {p.foundation === "slab"
            ? "Slab — wall stud marks only"
            : `Joists 16″ OC · wall studs ${p.studSpacing}″ OC`}
        </text>
      )}
    </svg>
  );
}
