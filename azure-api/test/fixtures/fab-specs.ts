/** James's steel box blind (≈6×8 ft, 7 ft walls, 2×2×11ga, corrugated skin, 2 sliders per long side, 1 steel door) and a 6×12 utility trailer. */
export const BLIND_SPEC = {
  projectType: 'blind', title: "James's steel box blind", widthFt: 6, lengthFt: 8, heightFt: 7,
  profiles: { floor: 'sq-2x2-11ga', wall: 'sq-2x2-11ga', opening: 'sq-2x2-11ga', roof: 'sq-2x2-11ga' },
  skin: { wallPanel: 'corrugated-29ga', roofPanel: 'corrugated-29ga', floorPanel: 'plywood-3/4' },
  openings: [
    { kind: 'window', wall: 'front', widthIn: 24, heightIn: 14, sillIn: 38 }, { kind: 'window', wall: 'front', widthIn: 24, heightIn: 14, sillIn: 38 },
    { kind: 'window', wall: 'back', widthIn: 24, heightIn: 14, sillIn: 38 }, { kind: 'window', wall: 'back', widthIn: 24, heightIn: 14, sillIn: 38 },
    { kind: 'door', wall: 'left', widthIn: 24, heightIn: 66 },
  ],
} as const;
export const TRAILER_SPEC = { projectType: 'trailer', widthFt: 6, lengthFt: 12, heightFt: 1.5 } as const;

