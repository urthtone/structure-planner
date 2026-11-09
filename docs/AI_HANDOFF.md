# AI team handoff: Structure Planner

This doc is for any AI (Gemini, Grok, or others) working on this repo alongside
Planner, James Dancer's Grok Bot assistant. Read the whole thing before you
change anything.

## What this is

Structure Planner turns up to 5 photos plus a few answers into a build plan for
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
  `{images: string[] (1-5 base64 data URLs), structureType, widthFt?, lengthFt?,
  heightFt?, estimateSize, material, notes}`. The response is
  `{ok:true, plan}` or `{ok:false, error}`.
- `POST /api/analyze` is the original contract for the Next app
  (`azure-api/src/contract.ts`).
- CORS only allows `https://hilltopstructures.us`. Requests are rate limited.
- A real request with 5 phone photos, each shrunk to about 1280px and about
  120 KB, comes back in about 20 seconds.

## In progress by Planner (don't duplicate)

These are on local branch `feature/welding-plans`, which will be pushed when
ready:

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
