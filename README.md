# Structure Planner

A Next.js 16 / React 19 app for preliminary shed, deck, cabin and garage shell planning. The initial example is a 10×12-ft wood shed. See [the verified default takeoff](docs/example-10x12-shed.md) for quantities and its example-price total.

## Run locally

```sh
npm install
npm run dev
```

Open http://localhost:3000. `npm test`, `npm run lint`, and `npm run build` verify the project. Browser smoke tests: `npx playwright install chromium` then `npm run test:e2e` (starts and stops a local dev server on port 3100, with provider keys disabled). Use `npm start` after a production build.

## Planning workflow

1. Optionally select or drag/drop up to **five** photos. Remove photos individually. Raster images only (JPEG, PNG, WebP, GIF); originals are capped at 20 MB and are decoded and compressed to JPEG with a maximum 1280-pixel edge and 650 KB output before storage in browser memory. Concurrent uploads are guarded while compression is running to preserve the five-photo limit.
2. Choose structure, dimensions, foundation, roof style (gable/single-slope), pitch, door width, window count and wall stud spacing. The default door is 7 ft tall; each assumed window is 3×3 ft. Decks use piers, garages use slabs. Unsupported material systems are not presented as calculated alternatives: the engine estimates wood framing (with optional composite deck boards).
3. Review notes and the **editable example/default price table** (USD, not live prices or quotes). Generate the deterministic takeoff; no API key needed.
4. Review the dimensioned floor-plan SVG, optional framing layout, net cut list, purchasing quantities, example cost and structure/foundation-specific build sequence. Use **Print / PDF** for the browser's print/save-as-PDF dialog.

## Optional photo analysis

Copy `.env.example` to `.env.local`, set `XAI_API_KEY` or `OPENAI_API_KEY`, and restart. Keys stay on the server: never use `NEXT_PUBLIC_` variables for credentials or commit `.env.local`.

- XAI default: `https://api.x.ai/v1`, model `grok-4`.
- OpenAI default: `https://api.openai.com/v1`, model `gpt-4o`.
- Override model with `VISION_MODEL` (must support vision and JSON response format).
- Override an OpenAI-compatible HTTPS API base with `VISION_BASE_URL`.

Click **Analyze photos** to explicitly send the compressed images to the configured provider. Photos are not sent merely by selecting them. The route accepts no more than five bounded image data URLs and validates the model's JSON. It returns observations for slope, visible ground, obstructions, sun/shade, style, foundation suggestion and notes. These are uncertain visual observations, not surveys or soil/load determinations. Foundation suggestions require clicking **Use suggestion** and remain editable. Provider failures and absent configuration are explained without disabling planning. Nothing is persisted to a database.

**Deployment security:** `/api/analyze` spends the server's configured API credits. Before exposing a keyed deployment publicly, add authentication, rate limits and provider spending limits at your hosting gateway; the sample has no user/accounts system. Image requests are capped at 4.5 MB, each at 650 KB, with a 35-second provider timeout. Avoid photos containing private information. No provider keys are returned to the browser.

## Calculation assumptions and limits

The pure TypeScript engine is in `src/lib/planning.ts`, with unit tests beside it. All dimensions are feet; width is the roof span and ridge runs along length. One centered door on the front wall; windows alternate along side walls. Wall height is low eave height. Footprint is rectangular.

- Wood floor: provisional 2×8 joists at 16 in OC along length, two lengthwise rim joists, 3/4-in T&G 4×8 sheets; support lines at no more than 4 ft across width. Skids run lengthwise; piers are estimated at no more than 6 ft along each support line.
- Walls: 2×4 studs at selected 16/24 in OC, extra corner/opening members, bottom plate and double top plates. Gross wall/gable area is used for sheathing and siding; openings are intentionally not deducted. Header pieces (provisional double 2×8), sill and cripple allowances are counted. Counts are conservative estimating allowances, **not a wall-panel fabrication layout**.
- Gable roof: 12-in horizontal overhang, slope-correct rafter length and roof area, 16-in OC rafter pairs, ridge, roof sheets, roofing squares (100 sq ft), 400-sq-ft underlayment rolls and 10-ft drip-edge sticks. Single-slope roof includes tall-wall and rake-wall area, plus stud extension allowances. Lumber sizes are placeholders pending span/load checks, not code-approved member selections.
- Slab: 4-in slab volume, gravel base, vapor barrier and mesh allowances; excludes engineered footings, thickened edges and frost details. Slabs have no wood floor takeoff.
- Deck: open platform with 2×8 joists, 2×10 beams, 6×6 posts, piers, nominal 5.5-in-wide deck boards and a guardrail allowance. No roof/walls, stairs or ledger connection design. Assumed freestanding, not a permit-ready attachment design.
- Garage: wood shell on slab with user-defined door opening; large headers require engineering. Cabin: same shell logic, **not a habitable building design** (no insulation, utilities, interior finish or residential compliance).
- Cut list shows **net pieces and geometric lengths** (no waste). Purchase list adds 10% once to each applicable category, rounding sheets/pieces/packages up. Linear-foot lumber pricing is an allowance, not stock-length optimization; field cuts, member deductions, birdsmouths and joinery are not specified. Fasteners/hardware are budgeting allowances.
- Total excludes labor, tax, delivery, permits, tools, utilities, paint, engineered footings, snow/wind/seismic design and site-specific costs. Door/window units are included as example allowances. Notes and photo observations do not alter dimensions or act as structural constraints.

**Do not build directly from this output.** Verify local permits, setbacks, utilities, ground bearing, anchorage, frost depth and wind/snow loads. A qualified local builder/engineer must size spans, headers, connections and foundations and prepare construction drawings. The SVG is conceptual, and its optional framing lines are not a detailed opening-framing plan.
