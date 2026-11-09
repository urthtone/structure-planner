# Supplied Grok/Vite frontend compatibility

James's supplied `planner/` is a separate prebuilt Vite/React frontend, not the
Next/PWA source in this repository. Its public API setting is runtime JavaScript:

```js
window.HILLTOP_PLAN_API = "https://hilltop-planner-api-da467d.azurewebsites.net/api/plan";
```

Only `config.js` is changed in the release copy. All HTML, CSS, bundled JavaScript
and the favicon remain byte-for-byte identical to the supplied files. Extract
`/workspace/planner-grok-upload.zip` **directly into `public_html/planner/`** (or
that domain's docroot/planner). The archive has index.html at its root, not an
extra planner/ wrapper. No Bluehost login/upload was performed.

## Exact wire contract

POST JSON, Content-Type application/json, Origin https://hilltopstructures.us:

```ts
{
  images: string[]; // 1–5 inline base64 raster data URLs
  structureType: 'shed' | 'deck' | 'cabin' | 'garage';
  widthFt?: number; lengthFt?: number; heightFt?: number;
  estimateSize: boolean;
  material: 'wood' | 'metal' | 'composite' | 'concrete';
  notes: string; // UI trims; up to 800 characters
}
```

When estimateSize is false the UI includes all three dimensions (defaults 10,12,8).
When true JSON.stringify omits them. The server requires positive numeric values,
width/length <=120 ft and height <=40 ft when not estimating. Photos without a
reliable scale cannot establish accurate dimensions: estimate mode uses explicitly
labeled planning assumptions (shed/cabin 10×12×8, deck 12×12×3, garage 12×20×8).
Those are not photo measurements. All dimensions require on-site verification.

Success is **`{ok:true,plan:Plan}`**, not `{ok:true,data:...}`. All errors use
**`{ok:false,error:string}`**. OPTIONS is 204 without a body. Status codes:
400 input, 401 optional server key, 403 origin, 429 quota, 502 invalid/provider
output, 503 missing/invalid configuration. The original `/api/analyze` contract
remains unchanged.

The exact Plan schema extracted from `assets/bluehost-BoaV2Lvu.js` is below. All
fields are required. String limits and array maxima are enforced server-side.

```ts
interface Plan {
  title: string; // 1..120 characters
  structureType: 'shed'|'deck'|'cabin'|'garage';
  photoReadings: {index:number;reading:string}[]; // <=5; integer index 1..5, reading <=400
  siteNotes: string; // <=800
  dimensions: {widthFt:number;lengthFt:number;wallHeightFt:number;roof:string};
  // positive width/length <=120, wallHeight <=40; roof STRING <=80, not an object
  rooms: {name:string;x:number;y:number;w:number;h:number}[];
  // <=8; name <=40; x/y 0..120; positive w/h <=120
  openings: {kind:'door'|'window'|'stairs';wall:'n'|'s'|'e'|'w';offsetFt:number;widthFt:number}[];
  // <=12; offset 0..120; positive width <=40
  materials: {item:string;qty:string;notes:string}[];
  // <=16; item <=80, qty <=40, notes <=160 (qty is STRING)
  steps: {title:string;detail:string}[]; // 1..10; title <=80, detail <=400
  warnings: string[]; // <=6, each <=240
  costRange: string; // <=80
}
```

The reviewed original 804-character Zod expression and bundle SHA256/offsets are
in `azure-api/test/fixtures/grok-plan-zod-expression.*`. Tests evaluate only that
reviewed schema fixture, never the full untrusted bundle, and compare it to the
server schema. The server additionally checks one reading per photo, unchanged
structure/dimensions, rooms inside the footprint and openings inside their wall.
The model produces a conceptual draft, **not** engineered drawings or a verified
material takeoff. This route does not invoke the original wizard's deterministic
planning engine. Costs/quantities are explicitly illustrative, not supplier quotes.

## API implementation / operations

`plan.ts` and `analyze.ts` use the same `vision-handler.ts`: bounded streaming
body/image validation, exact-origin CORS, optional server-only key, provider
selection, no photo logging, bounded provider response,
`store:false` and strict xAI Responses JSON schema. `/api/plan` uses at most 6,000
output tokens; `/api/analyze` retains 2,000. The full-plan provider budget is 50
seconds (analysis remains 35), inside the unchanged 60-second Function limit.
Grok 4.3 / grok-4.3-latest plan requests explicitly use documented reasoning
effort `none`; other model overrides are not sent that model-specific option.
A live 35-second timeout was reproduced; a non-reasoning valid plan required
about 32 seconds, so the longer route needs latency headroom. Longer plans can consume more AI tokens
and function execution time. Existing model/app settings and infrastructure stay
unchanged. Both registered routes share one process-local 10-request/600-second
IP limiter, so switching routes does not double that worker's quota. Restart and
scale-out limitations still apply; CORS is not authentication or a spending cap.

For code updates use **only** the ZIP deployment in DEPLOY.md. Do not apply the
bootstrap ARM template, reset app settings, or bundle a Function/shared/AI key.
Verify the AI setting by **name only** after deployment. No new resources needed.

## Important differences / issues in the supplied build

- A Zod schema is constructed then discarded. The response adapter checks only
  for an `ok` property; it does **not** actually parse/validate `plan` client-side.
  Server-side validation is therefore essential.
- On missing URL, API failure or offline use, it shows a warning and uses its own
  placeholder local sketch/math. That fallback is not a successful photo analysis
  or the original deterministic takeoff engine.
- Its photo compression uses a 960-pixel edge and JPEG quality .72, allowing up to
  1,600,000 data-URL characters (and limited original-image fallback). Our retained
  API limit is stricter: 650,000 characters per image, 4,500,000 total request bytes.
  Some accepted large/noisy photos can be rejected by the API. xAI accepts JPEG/PNG;
  an undecodable original WebP passed through by the UI is rejected. Retake/resize
  such photos; no original bundle changes were authorized.
- No fetch timeout/AbortController in its adapter; the server bounds provider time.
- There is **no .htaccess, webmanifest, service worker or install icon set** (only
  favicon.svg). This supplied release is not our installable/offline PWA. Its local
  asset/config paths correctly use /planner/. It is one URL, so no SPA fallback is
  needed for its current wizard. Apache HTTPS/MIME/cache headers are not supplied
  by this ZIP; inherited hosting configuration must be reviewed separately.
- It loads Google Fonts externally. Offline fonts are not guaranteed.
- If a prior /planner/ PWA/service worker was ever installed, unregister/remove
  that old worker/cache when switching builds; otherwise it can serve the old UI.
  This archive deliberately does not change or unregister anything in the browser.

## Browser verification without Bluehost access

Serve the copied files under a local `/planner/` path with
`PLANNER_STATIC_ROOT=/path/to/copy PORT=3103 npm start`.
For a browser on localhost, run `node scripts/serve-grok-preview.mjs` (defaults to
port 3103). This localhost-only test proxy substitutes a relative API URL **only
in its config.js HTTP response**, then forwards photo requests to the fixed real
Azure URL with the approved production Origin. The on-disk release config/ZIP and
production CORS are unchanged. Never upload this server. Each click on Draft can
make a paid AI request. It cannot be used as evidence of browser CORS by itself;
`scripts/smoke-grok-api.mjs` separately verifies the actual Azure preflight/CORS
and real one-image response against the original extracted schema. It makes one
paid AI request and logs only status/count evidence, not photos/AI contents/keys.

Browser execution remains a separate check if a browser subagent is unavailable;
HTTP/contract tests must not be represented as a completed browser render test.

## Verified release status

November 8, 2026, 6:12 PM CST: code-only deployment succeeded; the AI key remains
present by name-only check. Live OPTIONS returned 204, disallowed origin 403, and
a real 10×12×8 shed photo POST returned 200 / ok:true in about 10.7 seconds, valid
against the extracted schema (one reading, 16 material entries, six build steps).
The legacy analyze route still returns its original validation envelope.
Lint, 51 unit tests, Node 22 API build/tests and original static Next build pass.
ZIP integrity and config-only byte preservation pass. HTTP asset/subpath checks
pass; **interactive browser/photo/render verification is still pending** because
this executor has no browser/delegation tool. The localhost preview is prepared
for that check. No Bluehost access occurred.
