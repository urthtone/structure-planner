# AI team handoff: Structure Planner

This doc is for any AI (Gemini, Grok, or others) working on this repo alongside
Planner, James Dancer's Grok Bot assistant. Read the whole thing before you
change anything.

## What this is

Structure Planner turns up to 10 photos plus a few answers into a build plan for
small structures (sheds, decks, cabins, garages). Steel and welding projects are
being added now.

- **Live app:** https://hilltopstructures.us/planner/ (Bluehost, folder
  `public_html/website_98d9e671/planner`, served through Cloudflare).
- **Photo reader API:** an Azure Function at
  `https://hilltop-planner-api-da467d.azurewebsites.net`, in resource group
  `rg-hilltop-planner-api` in eastus2. It uses xAI vision (`grok-4.3`) with
  James's key, which is stored as an Azure app setting.
- **Repo:** https://github.com/urthtone/structure-planner. Work from branch
  `feature/static-azure-api`, never from `main`.

## Bluehost layout and work storage (as of November 9, 2026)

Account home is `/home2/conniew7`. The live site is Hilltop Construction /
hilltopstructures.us.

**Live planner files** are in `public_html/website_98d9e671/planner/`:

- `index.html` — current 10-photo build. It loads `/planner/assets/bluehost-10photos.js` and `/planner/config.js?v=2`.
- `assets/bluehost-10photos.js` — 10-photo frontend bundle. Leave older `bluehost-*.js` files in place.
- `config.js` — sets `window.HILLTOP_PLAN_API` to the live `/api/plan` URL. **Do not overwrite or replace this file.** Cloudflare caches it for a day; `index.html` uses `?v=2` to get past a previously cached blank copy. If the photo reader looks disconnected, hard-refresh or bump the query string.
- Leave the CSS and `favicon.svg` alone unless you are intentionally updating them.
- There is also a nested `planner/planner/` subfolder. Do not upload into that by mistake.

`curl` of the live site often hits a Cloudflare challenge; check files in a browser or in File Manager.

**Work storage:** `/home2/conniew7/planner-work/` is a sibling of `public_html`, so it is not web-served and needs no `.htaccess`. Use this folder for zips, drafts, and other working files. A copy of `planner-10photos.zip` is already there. If you ever cannot create a sibling of `public_html`, use `public_html/website_98d9e671/_planner_work` with a deny-all `.htaccess` instead — do not leave work files in the public `planner/` folder.

The canonical 10-photo live-build files in this repo are under `frontend/live-build/`. Upload `index.html` and the new JS only; never overwrite live `config.js`.

## Two frontends (important)

1. **The live site is Grok's prebuilt Vite/React app.** Only the build output is
   on Bluehost. Its source is **not** in this repo yet. It reads
   `window.HILLTOP_PLAN_API` from `/planner/config.js`, and `index.html` loads
   `config.js?v=2` to get past the Cloudflare cache.
2. **The Next.js 16 PWA in this repo** (`src/`) is a static export with
   basePath `/planner`. It has the deterministic takeoff engine
   (`src/lib/planning.ts`), photo handling, and a service worker.

**Grok:** please commit the Vite source for the live frontend into this repo
under `frontend/` on a branch of your own, so everyone can work on one codebase.

## API contracts (live now)

- `POST /api/plan` is the contract Grok's frontend uses. The full request and
  response shapes are in `docs/GROK_FRONTEND.md`. The request is
  `{images: string[] (1-10 base64 data URLs), structureType, widthFt?, lengthFt?,
  heightFt?, estimateSize, material, notes}`. The response is
  `{ok:true, plan}` or `{ok:false, error}`.
- `POST /api/analyze` is the original contract for the Next app
  (`azure-api/src/contract.ts`).
- CORS only allows `https://hilltopstructures.us`. Requests are rate limited.
- A real request with 10 phone photos, each shrunk to about 1280px and about
  120 KB, comes back in about 20 seconds.

## Roles (locked in)

- **Planner** is the project manager: task list, PR review, live-site tests, Azure and Bluehost deploys. Not the primary coder from this point.
- **Grok (GK)** is a workhorse: live Vite frontend **source** under `frontend/`, PWA files, show real errors instead of a silent sketch fallback, keep the UI at 10 photos, shrink data URLs to the API limit.
- **Gemini (GM)** is a workhorse: finish the welding engine on `feature/welding-plans`, build the welding screens and PDF/Word export against `FabSpec` / `FabResult`.

Shared starting point: branch `feature/static-azure-api`. Welding WIP is on `feature/welding-plans`, which should stay based on that branch. Open PRs into `feature/static-azure-api` (or into `feature/welding-plans` for fab work). Put your name and the task in the PR description. Do not push to `main`.

## Welding work, handed off (finish this)

Planner stopped mid-build so you can take it. The WIP is on branch
`feature/welding-plans` (commit `bf3ee84`). Pick it up from there; do not start over.

- A **welding and fabrication engine** for box blinds and steel sheds, trailers,
  gates and fences, and carports and steel buildings. It produces:
  - cut lists with miter angles
  - 20 ft and 24 ft stick nesting that accounts for kerf and waste
  - a parts list (BOM) with steel weight, hardware, and consumables
  - SVG part drawings and an assembly view
- A new **`POST /api/fab`** route. Photos go to xAI to draft a spec, then the
  deterministic engine builds the cut list, BOM, and plans. The contract will
  be in `docs/WELDING.md`.
- **PDF and Word (.docx) export** for structure plans and fab results, as a
  reusable client-side module.
- The `/api/plan` `costRange` limit goes from 80 to about 160 characters, and
  the server gives a clear error for oversized images.

## Open work for Gemini and Grok

Pick one, put your name on it in a PR description, and use your own branch:

1. **Live frontend fixes (Grok's app):**
   - Shrink photos on the device to about 1600px JPEG at 0.8 quality before
     upload. Full 2-3 MB phone photos are too big for the API.
   - Stop silently falling back to placeholder math when the reader fails. Show
     the real error and a retry button.
   - Use the zod validator that's already bundled to check API responses.
   - Add `manifest.webmanifest`, a service worker, and an `.htaccess` (SPA
     fallback, no-cache on `config.js` and `index.html`).
2. **Welding UI screens** in the live frontend: a "Welding project" type with
   the 4 subtypes, a stock form (profile, stick length, kerf), and result tabs
   for Cut list, Stock, Parts, and Plans. Build against the `/api/fab` contract
   once `docs/WELDING.md` lands. Until then, mock it.
3. **Export buttons** wired to Planner's export module (PDF and DOCX), once
   pushed.
4. **Nice-to-haves:** scale detection from a known object in the photo (a tape
   measure, a 4x8 sheet, a door), a saved projects list (localStorage), a
   shareable plan link, and a materials price list per supplier that James can
   edit.

## Rules

- Never commit secrets. The xAI key lives only in Azure app settings, and
  `local.settings.example.json` keeps it blank.
- Don't push to `main` or merge without James's OK. Open PRs into
  `feature/static-azure-api`.
- Don't reapply the Azure bootstrap ARM template, because it wipes app
  settings, including the key. Deploy code only. See `docs/DEPLOY.md`.
- Every plan is a conceptual draft. Keep the "not engineered, verify with local
  pros, permits, wind and snow loads" warnings, and the DOT and GVWR warnings
  for trailers.
- Run `npm test` and `npm run build`, and run `npm run build:api` for API
  changes, before opening a PR.
