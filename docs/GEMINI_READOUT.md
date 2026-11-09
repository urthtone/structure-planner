# Readout for Gemini (and Grok)

Answers to Gemini's five questions, from Planner (project manager).
The live site's Vite **source is not in this repo and Planner does not have it** —
only Grok's prebuilt files exist. Do not wait on a source commit from Planner.
Work from these contracts and from `feature/welding-plans` now. Grok should still
commit the Vite source under `frontend/` when ready.

Live app: https://hilltopstructures.us/planner/
API base: https://hilltop-planner-api-da467d.azurewebsites.net
CORS origin allowed: `https://hilltopstructures.us` only.

---

## 1. Repo layout and mount points

### Repos and branches

- Repo: https://github.com/urthtone/structure-planner
- Integration branch: `feature/static-azure-api` (open PRs into this, not `main`)
- Welding WIP: `feature/welding-plans` (commit `bf3ee84`, unfinished, handed off)
- Next.js 16 PWA source in this repo lives at `src/` (static export, `basePath` `/planner`)
- Azure Functions source: `azure-api/`
- Live site on Bluehost: `public_html/website_98d9e671/planner`, served at `/planner/`

### Live frontend (Grok's Vite build) — web root

The built files, and only the built files, are:

```
planner/
  index.html
  config.js          # sets window.HILLTOP_PLAN_API
  favicon.svg
  assets/bluehost-BoaV2Lvu.js
  assets/bluehost-B8ROFVLC.css
```

`index.html` mounts the app on a single node and loads config after the module:

```html
<body>
  <div id="root"></div>
  <script type="module" crossorigin src="/planner/assets/bluehost-BoaV2Lvu.js"></script>
  <script src="/planner/config.js?v=2"></script>
</body>
```

(`?v=2` is required; Cloudflare was serving a cached blank `config.js`.)

`config.js` is one assignment:

```js
window.HILLTOP_PLAN_API = "https://hilltop-planner-api-da467d.azurewebsites.net/api/plan";
```

### DOM IDs and selectors

There are **almost no stable IDs**. The only one is `#root`.

Photo inputs are two visually hidden `<input type="file">` elements with
`class="sr-only"`, no `id`, no `name`, wired only by React refs:

- Camera: `accept="image/*"` and `capture="environment"` (single file)
- Gallery: `accept="image/*"` and `multiple` (multi file)

Buttons labeled "Gallery" and a later "Draft the plan" button have no IDs.
The main workspace is whatever React renders inside `#root`. Screens are
internal state (`photos` → `details` → `plan`), not routes.

The live UI still caps at **five** photos (`slice(0, 5)` and
`Math.max(0, 5 - count)` in the bundle). James asked to raise this to **10**.
The API and the Next.js PWA in this repo are being updated to 10; the live
Vite UI is not, until Grok or Gemini change it.

Client-side shrink is **already in the live bundle**: photos are drawn to a
max edge of 960 px and re-encoded as JPEG quality 0.72. A data URL longer
than 1,600,000 characters is rejected in the browser with
"That photo is still too large." The API is stricter (see below).

### Where the silent fallback triggers

It is not a CSS hook. Flow in the minified bundle:

1. `ie()` reads `window.HILLTOP_PLAN_API?.trim()`. Empty → skip the network.
2. `oe(payload)` either POSTs or returns
   `{ok:false, error:"The photo reader is not connected yet. Add the Azure address in config.js."}`
3. `ae(url, payload)` POSTs JSON. If the body is not an object with an `ok`
   field: `{ok:false, error:"Photo reading is not available right now."}`.
   On fetch throw: `{ok:false, error:"Could not reach the photo reader."}`
4. On draft (`he()`): **whether the reader fails or not, a plan is shown.**

```js
let e = await oe(a);
e.ok ? (ue(e.plan), fe(null)) : (ue(pc(a, i.length)), fe(e.error));
```

`pc(...)` is the local placeholder planner. `fe(error)` sets React state
shown on the plan screen as a `p[role="status"]` with classes
`no-print rounded-lg border border-cedar bg-cedar-soft px-3 py-2 text-sm`:

> `{error} A measured sketch is shown instead.`

There is no retry button. The bundled zod `planSchema` is never used to
validate the API response (only an `ok` field is checked).

---

## 2. Azure photo reader request format

**JSON**, not multipart and not a raw binary body.

```
POST https://hilltop-planner-api-da467d.azurewebsites.net/api/plan
Content-Type: application/json
Origin: https://hilltopstructures.us
```

Body:

```ts
{
  images: string[]; // 1–10 data URLs, WITH the data:image/jpeg;base64, prefix
  structureType: 'shed' | 'deck' | 'cabin' | 'garage';
  widthFt?: number; lengthFt?: number; heightFt?: number;
  estimateSize: boolean;
  material: 'wood' | 'metal' | 'composite' | 'concrete';
  notes: string; // trimmed, max 800
}
```

- Base64 **includes** the `data:image/jpeg;base64,` (or png/webp/gif) prefix.
- When `estimateSize` is `false`, send all three dimensions (UI defaults 10, 12, 8).
- When `estimateSize` is `true`, the UI omits the three dimension keys.
- Current live limits on the API (being raised with the 10-photo change):
  each image data-URL ≤ 650,000 characters; total body ≤ 4.5 MB (going to 9 MB);
  1–5 images (going to 1–10).
- The live frontend may produce a data URL up to 1,600,000 characters, which
  the API will currently reject. Shrink further, or wait for the API limit bump
  / a clear error. Prefer ~1280 px JPEG at quality ~0.75 (around 120 KB each).
- Full contract: `docs/GROK_FRONTEND.md`. Companion route `POST /api/analyze`
  is only for the Next.js app (`azure-api/src/contract.ts`); do not use it from
  the live Vite app.

---

## 3. Azure response and error schema

Success (HTTP 200):

```ts
{ ok: true, plan: Plan }
```

**Not** `{ok:true, data:...}`. The reader does **not** return bounding boxes,
picket counts, or a welding cut list. Those belong to `/api/fab` (WIP).

```ts
interface Plan {
  title: string;                         // 1..120
  structureType: 'shed'|'deck'|'cabin'|'garage';
  photoReadings: { index: number; reading: string }[];
  // index 1..10, reading <=400, at most 10 entries, one per submitted photo
  siteNotes: string;                     // <=800
  dimensions: {
    widthFt: number;                     // positive, <=120
    lengthFt: number;                    // positive, <=120
    wallHeightFt: number;                // positive, <=40
    roof: string;                        // <=80, a string, not an object
  };
  rooms: { name: string; x: number; y: number; w: number; h: number }[]; // <=8
  openings: { kind: 'door'|'window'|'stairs'; wall: 'n'|'s'|'e'|'w';
              offsetFt: number; widthFt: number }[];                     // <=12
  materials: { item: string; qty: string; notes: string }[];             // <=16; qty is a STRING
  steps: { title: string; detail: string }[];                            // 1..10
  warnings: string[];                                                    // <=6, each <=240
  costRange: string;                     // was <=80, being raised to <=160
}
```

Errors are always:

```ts
{ ok: false, error: string }
```

| HTTP | When |
|------|------|
| 204  | OPTIONS preflight, empty body |
| 400  | bad input (count, type, size, missing fields) |
| 401  | optional server key rejected (usually unset) |
| 403  | Origin is not `https://hilltopstructures.us` |
| 429  | rate limit |
| 502  | invalid or failed provider output |
| 503  | missing/invalid Azure configuration (e.g. no xAI key) |

The model output is a conceptual draft, not engineered drawings and not a
verified takeoff. Keep the existing warning language.

---

## 4. Cut list and welding state object

**Grok's live frontend has no welding/gate state object.** Gemini should not
invent a parallel schema. Use the WIP types on `feature/welding-plans`:

- `azure-api/src/fab/types.ts` — `FabSpec` in, `FabResult` out
- `azure-api/src/fab/spec.ts` — defaults, limits, `normalizeSpec()`
- `azure-api/src/fab-route.ts` — `POST /api/fab` (not deployed yet)

`FabSpec` (the screen / request object):

```ts
type FabProjectType = 'blind' | 'trailer' | 'gate' | 'carport';

interface FabSpec {
  projectType: FabProjectType;
  title?: string;
  widthFt: number;    // blind/carport: end-wall width; trailer: deck width; gate: opening width
  lengthFt: number;   // blind/carport: long-wall length; trailer: deck length; fence: run length
  heightFt: number;   // blind: wall frame; gate/fence: height; carport: eave; trailer: unused
  profiles?: Record<string, string>;    // role → profile id (see ROLE_DEFAULTS)
  spacingIn?: Record<string, number>;   // role → max on-center inches
  openings?: FabOpening[];
  skin?: { wallPanel?: string | null; roofPanel?: string | null;
           floorPanel?: string | null; overhangIn?: number };
  stock?: { lengthsFt?: number[]; kerfIn?: number; trimIn?: number };
  options?: FabOptions;                 // joint, roof, tongue/axles, infill/pickets, etc.
  prices?: { steelPerFt?: Record<string, number> };
}
```

`POST /api/fab` accepts either a full `spec`, or `{projectType, widthFt?, lengthFt?,
heightFt?, notes?, images?}`. Images are the same data-URL array as `/api/plan`.
When images are present, xAI drafts a spec; the deterministic engine then
builds the cut list, nesting, BOM, and SVGs.

Success: `{ ok: true, fab: FabResult }`
Error: `{ ok: false, error: string }` (same status table as `/api/plan`)

`FabResult` has `title`, `projectType`, `spec`, `cutList`, `nesting`, `bom`,
`plans.parts[]` / `plans.assembly[]` (SVG strings), `warnings`, `assumptions`.

This route is **not live** yet. Mock against `FabResult` until Planner reviews
and deploys it. Do not start a second engine. Finish and test the WIP, then
open a PR into `feature/static-azure-api`. Also raise the fab draft's
`photoReadings` cap from 5 to 10 to match James's request.

Default stick lengths are 20 ft and 24 ft; default kerf is 1/8 in. Trailer
plans must keep the DOT / GVWR / axle / brake warning. Every plan is
"not engineered — verify loads, wind/snow, and code with a local pro."

---

## 5. Task split — who is coding what

Planner is the project manager: task list, PR review, live-site tests, Azure
and Bluehost deploys. Planner is **not** finishing the welding engine.

### Planner is doing / just did

- Pushed WIP `feature/welding-plans` (`bf3ee84`) and stopped.
- The API, the Next.js PWA, and a patched live build (`frontend/live-build/`) now allow 10 photos, with `costRange` at 160 characters, a 9 MB body, an 80 s provider timeout, and a 120 s function timeout. Azure code deploy of that API may still be pending from Planner. The old live JS still says 5 until `frontend/live-build/` is uploaded to Bluehost.
- Keeping `docs/AI_HANDOFF.md` and this readout current.
- Reviewing PRs. Do not push to `main`. Do not reapply the Azure ARM
  bootstrap template (it wipes the xAI key). Deploy function **code only**.

### Grok should take

- Commit the live Vite **source** under `frontend/` on your own branch, PR
  into `feature/static-azure-api`.
- In that UI: raise the 5-photo cap to 10, shrink data URLs to the API's
  per-image limit, stop treating a failed read as a successful sketch
  without a retry, actually run the zod validator, add manifest / service
  worker / `.htaccess` (no-cache on `index.html` and `config.js`).

### Gemini should take

- Welding screens in the live frontend (or the Next app until source lands):
  project type `blind | trailer | gate | carport`, stock form (profile, stick
  length, kerf), result tabs Cut list / Stock / Parts / Plans, CSV export.
  Build against `FabSpec` / `FabResult` and mock `/api/fab` until it is deployed.
- PDF and Word (.docx) export buttons (James asked for both), reusable so
  regular structure plans can use them too.
- Nice-to-haves after that: scale from a tape in the photo, saved projects
  in localStorage, a shareable plan link, an editable supplier price list.

Put your name and the task in the PR description. One concern per PR when
possible, so reviews stay clean.
