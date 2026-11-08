# Structure Planner

A Next.js 16 / React 19 app for preliminary shed, deck, cabin and garage shell planning. The initial example is a 10×12-ft wood shed. See [the verified default takeoff](docs/example-10x12-shed.md) for quantities and its example-price total.

## Run locally

```sh
npm install
npm --prefix azure-api install
npm run dev
```

Open http://localhost:3000/planner/. `npm test`, `npm run lint`, and `npm run build` verify the project. Browser smoke tests: `npx playwright install chromium` then `npm run test:e2e` (starts and stops a local dev server on port 3100, with provider keys disabled). Use `npm start` after a production build to preview static `out/` at http://127.0.0.1:3102/planner/. Function dependencies are installed separately; `npm run build:api` compiles them.

## Planning workflow

1. Optionally select or drag/drop up to **five** photos. Remove photos individually. Raster images only (JPEG, PNG, WebP, GIF); originals are capped at 20 MB and are decoded and compressed to JPEG with a maximum 1280-pixel edge and 650 KB output before storage in browser memory. Concurrent uploads are guarded while compression is running to preserve the five-photo limit.
2. Choose structure, dimensions, foundation, roof style (gable/single-slope), pitch, door width, window count and wall stud spacing. The default door is 7 ft tall; each assumed window is 3×3 ft. Decks use piers, garages use slabs. Unsupported material systems are not presented as calculated alternatives: the engine estimates wood framing (with optional composite deck boards).
3. Review notes and the **editable example/default price table** (USD, not live prices or quotes). Generate the deterministic takeoff; no API key needed.
4. Review the dimensioned floor-plan SVG, optional framing layout, net cut list, purchasing quantities, example cost and structure/foundation-specific build sequence. Use **Print / PDF** for the browser's print/save-as-PDF dialog.

## Optional photo analysis

The frontend is a **static export** for `https://hilltopstructures.us/planner/`;
there is no Next.js API route. Copy `.env.example` to `.env.local` and set only the
public build-time `NEXT_PUBLIC_ANALYZE_URL` after deploying the separate
**Azure Functions Node 22 v4** app in `azure-api/`. If the URL is blank, analysis
clearly reports "not configured" and the complete manual planner still works.

Set **`XAI_API_KEY` only in Function app settings**, never in the frontend.
xAI is the default provider (`https://api.x.ai/v1/responses`, vision model
`grok-4.3`, overridable using `VISION_MODEL`). Optional OpenAI is selected only if
an OpenAI key is set and the xAI key is absent. Clicking **Analyze photos** sends
up to five compressed images; selection alone sends nothing. Validated visual
observations/suggestions remain uncertain and user-overridable, not construction
approval. No project database is included.

See **[DEPLOY.md](docs/DEPLOY.md)** for exact Bluehost `out/` upload instructions,
Azure settings/manual deployment commands, CORS, pricing references and the
best-effort in-memory rate limiter's important limitations. CORS is not auth;
provider spending and gateway abuse protection require launch review. No secrets,
Azure resources or deployments are included in this repository.

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

## Installable PWA

The planner is now installable with a manifest, placeholder icons and a versioned production offline shell. Manual estimates work offline after one online visit; photo analysis still needs a connection. See [PWA.md](docs/PWA.md) for installation, update behavior and checks. No sign-in or signing setup is required.
