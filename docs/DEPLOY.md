# Deployment: Bluehost static PWA + Azure photo analysis

**Azure infrastructure is now created with explicit owner approval; see deployment status below.** The website target is
`https://hilltopstructures.us/planner/`. Bluehost shared hosting needs only static
files; it does not run Next.js, Node or the API. The live Vite build is already on Bluehost as described below.
No code-signing, native-wrapper or app-store setup is required.

## Supplied Grok frontend (current requested upload)

James subsequently supplied a different Vite/React build. Use
**`/workspace/planner-grok-upload.zip`** for that UI, not the original Next/PWA
archive. Its runtime `config.js` points to
`https://hilltop-planner-api-da467d.azurewebsites.net/api/plan`.
See [GROK_FRONTEND.md](GROK_FRONTEND.md) for the exact contract, upload layout and
important differences (including no PWA/Apache files and an unused client schema).
`/api/analyze` remains available for the original Next/PWA below. Both routes share
the existing limits and settings; XAI_API_KEY remains only in Function settings.


## Live Bluehost layout (as of November 9, 2026)

Account home: `/home2/conniew7`. Live URL: `https://hilltopstructures.us/planner/`.
Site files are under `public_html/website_98d9e671/planner/` (not `public_html/planner/`).

Current live upload (10-photo Vite build from `frontend/live-build/`):

- Replaced `planner/index.html` (loads `/planner/assets/bluehost-10photos.js` and `config.js?v=2`).
- Added `planner/assets/bluehost-10photos.js`. Older `bluehost-*.js` files were left in place.
- **Do not overwrite** `config.js`, the CSS, or `favicon.svg`. `config.js` holds `window.HILLTOP_PLAN_API`. Cloudflare can cache a blank `config.js` for a day; the `?v=2` query string is required until cache headers are fixed.
- There is a nested `planner/planner/` subfolder; do not upload there by mistake.
- `curl` often gets a Cloudflare challenge; confirm in a browser or File Manager.

**Work storage:** `/home2/conniew7/planner-work/` is a sibling of `public_html`, so it is not web-served. A copy of `planner-10photos.zip` is already there. Prefer this folder for drafts and zips. Fallback if needed: `public_html/website_98d9e671/_planner_work` with a deny-all `.htaccess`.

**Safe deploy script:** `scripts/safe-deploy.sh`. Run it on Bluehost (SSH or cPanel Terminal). It dry-runs by default; pass `--live` to copy. The destination is hard-coded to `/home2/conniew7/public_html/website_98d9e671/planner` — never `public_html/planner`. It backups `config.js` to `/home2/conniew7/.config-backups/`, copies only an allowlist of frontend files, and restores `config.js` if it changes. Do not rsync all of `planner-work/` to the web root.


## 1. Build and upload the original Next/PWA frontend

Use Node 22 and npm. From the repository root:

```sh
npm ci
npm --prefix azure-api ci
cp .env.example .env.local
# Leave NEXT_PUBLIC_ANALYZE_URL blank for manual-only planning, or set the public
# HTTPS Function endpoint after it exists; no credentials or ?code= query string.
npm run lint
npm test
npm run build
npm run build:api
npm start
# Local static preview: http://127.0.0.1:3102/planner/
```

`NEXT_PUBLIC_ANALYZE_URL` is embedded at **build time**. Changing it requires a
new frontend build/upload; Bluehost environment variables cannot change the JS.
Deployed public endpoint:
`https://hilltop-planner-api-da467d.azurewebsites.net/api/analyze`.

The upload ZIP built for this deployment already contains that endpoint.
**XAI_API_KEY is now set securely in Function app settings.** A real synthetic-image
request returned `200 / ok` with validated structured analysis. The key never
enters the frontend build; future key changes do not require rebuilding it.

Upload **the contents of `out/`**, including its hidden `.htaccess`, to
**`public_html/planner/`**. If hilltopstructures.us has a different domain docroot,
use **that docroot's `planner/` folder** instead. Do not upload an extra `out/`
folder, the repository, `.env*`, `azure-api/`, `node_modules` or `.next`.

Expected layout:

```text
public_html/planner/index.html
public_html/planner/.htaccess
public_html/planner/sw.js
public_html/planner/manifest.webmanifest
public_html/planner/icons/...
public_html/planner/_next/static/...
```

`basePath: '/planner'`, trailing slashes and unoptimized images are fixed in
`next.config.ts`; Next prefixes its own chunks, so an additional `assetPrefix`
is unnecessary. Manifest ID/start/scope, metadata icons, service-worker scope,
offline navigation and cached resources all use `/planner/`. The wizard uses
React state on one URL; no catch-all SPA rewrite is needed. Missing chunk URLs
must remain 404s, not return HTML. `.htaccess` sets the webmanifest MIME, HTTPS
redirect, static cache policy, HTML/manifest revalidation and SW no-cache headers.

Enable the domain's TLS certificate first. Check parent/WordPress rewrite rules
leave existing `/planner/` files/directories alone; keep its `.htaccess` separate
from the site's root one. Apache must permit the included directives and have
mod_rewrite/mod_mime/mod_headers for their corresponding behavior. The Node local
preview does **not** prove Bluehost's Apache config. Verify real headers after
upload. Upload new hashed chunks first, then HTML and SW; retain old hashed chunks
during an update window so open tabs do not lose lazy-loaded assets. Old installed
windows must close to activate a waiting new worker.

Post-upload checks (to perform later, not contacted during this work):
- `/planner/` renders with no root `/_next/` failures; manifest and all icons 200.
- `/planner/sw.js`: JavaScript MIME, no-cache, scope `/planner/`.
- Install/Add to Home Screen on Android and iPhone; test real camera permissions.
- Visit online, close/reopen, disable network, reload and generate a plan.
- Print/PDF works; reload still clears unsaved photos/notes/edits.

## 2. Azure hosting plan and creation reference

Subscription: **Azure subscription 1**
`fab73657-6b07-46a5-956f-685cf81cb414`.
Tenant from CLI context: `2f633864-c751-46d0-a16b-2e48748dbcac`.

For this small, intermittent, I/O-bound API, start with **Linux Azure Functions
Flex Consumption, Node 22, v4 programming model, 512 MB, no always-ready
instances**. It scales to zero. Profile memory/cold-start/latency before launch;
2 GB may be preferable if 512 MB is constrained. Legacy Linux Consumption is not
recommended for a new project (retirement September 30, 2028). Dedicated or Premium
plans add idle baseline costs unnecessary for this initial workload.

Proposals, subject to availability/name/policy checks:
- Resource group `rg-hilltop-planner-api`.
- Region `eastus2` (proposed only; validate Flex/Node 22 and quota there).
- Function app `hilltop-planner-api-<unique-lowercase-suffix>`.
- Storage `htplanner<unique-lowercase-suffix>` (globally unique, 3–24 lowercase
  letters/digits), Standard_LRS; app and storage in the same region.
- Associated Application Insights/logging: review retention, sampling and daily
  ingestion caps. CLI creation can create this resource automatically.

### Verified deployment (November 8, 2026, CST)

- Resource group: `rg-hilltop-planner-api`.
- Storage: `htplannerda467d`, Standard_LRS, private `deployments` blob container.
- Required hosting plan: `plan-hilltop-planner-da467d`, FC1 Flex Consumption.
- Function app: `hilltop-planner-api-da467d`, eastus2, Linux/Node 22, 512 MB.
- Always-ready: none; maximum scale setting: 40 (not a spending cap).
- HTTPS only; CORS: `https://hilltopstructures.us` only; credentials disabled.
- No App Insights, Log Analytics, identities, custom role assignments or gateways.
- Provider/model settings: explicit `xai`, `grok-4.3`, `https://api.x.ai/v1`.
- Microsoft.Web and Microsoft.Storage required provider registrations were enabled;
  no unrelated resource providers/resources were provisioned.

The authenticated Azure CLI 2.92.0 successfully accessed this subscription and
deployed the reviewed ARM template. No fresh login was needed. Earlier MCP
connector policy blocks remain connector limitations, not proof the CLI is
unavailable. `infra/main.json` service validation and resource-ID-only what-if
passed; the preview contained exactly the approved group/storage/container/plan/app.
See `.azure/deployed.json` and `.azure/deployment-plan.md` for evidence.
Core Tools was unnecessary: Azure CLI ZIP deployment completed successfully,
including trigger synchronization and app health checks. Runtime code was packaged
with production dependencies using Node 22, without local settings/env files.

Live OPTIONS returned 204 with the exact allowed origin; POST returned 200 with
`status: not_configured`; a different origin was denied CORS. After secure key activation and a targeted Function restart, one real synthetic
PNG analysis returned `200 / ok` with all structured fields validated. The initial
pre-key `not_configured` result remains historical proof. No key, photos or
analysis contents were printed or committed.
The production browser tests additionally verify the compiled hosted endpoint is
used only after the user clicks Analyze (mocked response, no AI credits spent).

### Cost notes — not a quote or a guaranteed free deployment

[Official Functions pricing](https://azure.microsoft.com/en-us/pricing/details/functions/)
currently lists a PAYG Flex on-demand monthly grant of **250,000 executions and
100,000 GB-s**, shared at subscription level and subject to eligibility. Regional
unit prices depend on region/currency/agreement; the fetched page did not render
usable dollar rates. Check the calculator/current pricing before creating anything.
No always-ready allocation avoids that idle baseline, but storage transactions,
stored data, outbound networking and Application Insights are separate charges.
Waiting for a vision provider still consumes function execution memory/time.

**AI calls are a separate xAI bill**, not included in Azure's grant or Bluehost.
Token/image size, model, reasoning and output affect cost; do not assume a fixed
per-photo amount. Check [xAI pricing](https://docs.x.ai/developers/pricing) and the
[chosen model](https://docs.x.ai/developers/models/grok-4.3), set available provider
spending/usage controls and Azure budget alerts. Alerts and the sample in-memory
limiter are **not** a hard total-spend cap.

## 3. Function app settings and contract

`azure-api/` is a standalone Node/TypeScript Functions v4 app; compiled entry point
`dist/functions.js` registers **POST `/api/analyze` and `/api/plan`** plus OPTIONS. The pure shared
JSON contract in `azure-api/src/contract.ts` is also used by the frontend. Root
`src/app/api` is removed so Next can export static files.

Set these as **Function app settings**, never frontend variables:

| Setting | Value / purpose |
| --- | --- |
| `XAI_API_KEY` | James's xAI API key, set privately in Azure Portal app settings or via a Key Vault reference. **Never** commit, paste into `.env.local`, `NEXT_PUBLIC_*` or an endpoint URL. |
| `VISION_PROVIDER` | Production `xai`; explicit provider selection. `openai` selects that alternative; unset/`auto` prefers xAI when its key exists. |
| `VISION_MODEL` | Default `grok-4.3`, a current image-capable model verified against xAI docs. Override for another supported vision/structured-output model. |
| `VISION_BASE_URL` | Optional; xAI default `https://api.x.ai/v1`. HTTPS only; no query/credentials. |
| `OPENAI_API_KEY` | Optional alternative in auto mode **only when XAI_API_KEY is absent**, or explicitly choose `VISION_PROVIDER=openai`; default `gpt-4o`, Chat Completions. Production is explicitly xAI. No automatic failover after an xAI error. |
| `ALLOWED_ORIGINS` | `https://hilltopstructures.us` (comma-separated exact origins if necessary; no wildcard, no `/planner` path). |
| `REQUIRE_ORIGIN` | `true` (default); reject missing Origin. A trusted server client can explicitly opt out with `false`. |
| `FUNCTIONS_REQUEST_BODY_SIZE_LIMIT` | `9000000`; host limit, in addition to streamed application validation. |
| `RATE_LIMIT_MAX` | `10` requests per IP/window/process by default. |
| `RATE_LIMIT_WINDOW_SECONDS` | `600` by default. |
| `ANALYZE_SHARED_KEY` | Optional server-to-server shared key, expected as `X-Analysis-Key`. Leave absent for direct public PWA use. |
| `ANALYZE_REQUIRE_FUNCTION_KEY` | `false` for public direct PWA; `true` registers host `function` auth instead of anonymous, requiring a Function key. Only useful behind a trusted proxy; never bundle a key in the frontend. |

Runtime/storage/telemetry settings are configured by app creation. Flex determines
Node runtime from its runtime configuration: do not blindly copy legacy
`FUNCTIONS_WORKER_RUNTIME`/`FUNCTIONS_EXTENSION_VERSION` settings to Flex. Those
local-runtime settings in `local.settings.example.json` are for Core Tools only.

Request: `{ "images": ["data:image/jpeg;base64,..."] }`, 1–10 raster images, each
at most 650,000 data-URL characters and total body at most 9,000,000 bytes. Remote
URLs and SVG are rejected. Legacy JPEG/PNG/WebP/GIF input validation is retained;
xAI additionally requires JPEG/PNG at its provider boundary. The browser converts
all accepted raster uploads to JPEG, including WebP/GIF, before any request.
Success: `{status:'ok',analysis:{groundSlope,groundType,obstructions,sunShade,
styleHints,suggestedFoundation,notes}}`. Missing provider key:
`{status:'not_configured',message}`. Errors use `{status:'error',message}`:
400 invalid/oversize input, 401 optional shared auth, 403 origin, 429 rate limit,
502 provider timeout/error/invalid JSON, 503 invalid origin configuration.
Provider calls time out after 80 seconds and outputs are strictly validated.
The Next.js frontend allows 90 seconds; Function timeout is 120 seconds.

xAI uses **`POST https://api.x.ai/v1/responses`**, `input_image.image_url` with an
inline base64 JPEG/PNG URL, `input_text`, strict `text.format` JSON schema, and
`store:false`. See [image input documentation](https://docs.x.ai/developers/model-capabilities/images/understanding)
and [structured output documentation](https://docs.x.ai/developers/model-capabilities/text/structured-outputs).
No app database or photo logging is implemented. `store:false` is an API setting,
not a guarantee about all provider retention policies; review those and avoid
private images. Images are transmitted only after **Analyze photos** is clicked.

### Abuse/security limitations — required launch review

CORS is a browser policy, **not authentication**; nonbrowser callers can forge
Origin. The in-memory rate map is bounded at 10,000 IP buckets (fail closed when
full), resets on restart, is not shared across scaled instances and relies on
forwarded-IP ingress behavior. It uses the last `X-Forwarded-For` hop rather than
the spoofable first one, strips source ports and canonicalizes IPv6 addresses; verify Azure's actual trusted ingress chain before
launch. Without a header all callers share one bucket; proxy/NAT behavior may
also group callers. It is **best-effort abuse friction, not production DDoS or
budget protection**. Add a trusted gateway with distributed throttling and/or
real authorization before a broadly exposed paid endpoint. If using a gateway,
restrict direct Function ingress too. No such infrastructure was created here.
Static JavaScript cannot keep a Function/shared key secret. Enabling either key
mode intentionally makes this direct public frontend unable to call the API
until a trusted server proxy exists. Never "fix" that by embedding a key.

## 4. Key activation and future code-only updates

The infrastructure exists. **Do not create duplicate resources or reapply the
bootstrap template after setting a key:** its initial inline app-settings list
would replace that collection and remove the key. See `infra/README.md`.

The approved key activation is complete. For a future explicitly approved key
update, supply XAI_API_KEY securely to a fresh login-shell environment and run:

```sh
node scripts/set-xai-key.mjs
# No-op if absent. If present, sends the key to this Function's app settings using
# Azure CLI stdin; never prints it, puts it in argv, writes it locally or commits it.
# The helper bridges Node's socket to a reopenable Python pipe; Python 3 is required.
# The Function restarts automatically. Once ready, this makes ONE paid AI request:
node scripts/smoke-azure-api.mjs \
  https://hilltop-planner-api-da467d.azurewebsites.net/api/analyze configured
```

Do not put the key into the frontend URL, source, `.env.local`, shell history,
logs, or a command-line literal. `.azure/key-status.json` contains only a boolean
(and a nonsecret reason when no environment value was supplied). The smoke script uses a synthetic 256-pixel
PNG and validates structured output without logging photos or analysis contents.
If Azure requires a fresh login, stop and complete the normal interactive/device
login; never extract/reuse tokens or credentials through other means.

For a future code-only release, rebuild the Function and create a ZIP with
`host.json`, package files, compiled `dist/` and production Node 22 `node_modules`
at archive root, excluding all `.env*`, local settings, tests and source files.
The verified package for this deployment is `/workspace/planner-function.zip`.
Deploy a freshly rebuilt package (not stale code) with:

```sh
az functionapp deployment source config-zip \
  --subscription fab73657-6b07-46a5-956f-685cf81cb414 \
  --resource-group rg-hilltop-planner-api --name hilltop-planner-api-da467d \
  --src /workspace/planner-function.zip --build-remote false --timeout 600 --output none
```

This preserves app settings and creates no additional infrastructure. Core Tools
v4 is an alternative first-party publisher if installed: compile TypeScript,
prune development dependencies, and use `func azure functionapp publish
hilltop-planner-api-da467d --no-build` from `azure-api/`. `.funcignore` intentionally
includes production node_modules and excludes secrets/source/tests. Restore dev
dependencies after publishing. Never use `--publish-local-settings` or `--show-keys`.

Rebuild a public upload archive with the nonsecret endpoint:

```sh
NEXT_PUBLIC_ANALYZE_URL=https://hilltop-planner-api-da467d.azurewebsites.net/api/analyze npm run build
```

Host CORS and ALLOWED_ORIGINS must remain the exact production origin (no path,
no wildcard, no credentialed wildcard). Local browser API integration uses mocks;
real Azure CORS is tested with the allowed origin by the explicit smoke script.
Bluehost already hosts the live Vite planner as described above. The local preview still verifies static files,
not production Apache headers or real-device install/camera behavior.

## 5. Local verification

```sh
npm run lint
npm test                  # frontend/engine + isolated Function/mock-provider tests
npm run build:api
npm run test:e2e          # dev /planner checks; external analysis endpoint is mocked
npm run test:e2e:pwa      # static export served at /planner/, mobile/offline checks
```

The static smoke test verifies subpath assets, install manifest/icon fetching,
service-worker registration/scope, offline reload, manual plan generation and
mobile overflow. Apache directives, real-device install/camera behavior, live
Azure hosting/CORS/forwarded-IP behavior, xAI model access and billing remain
post-deployment checks; a successful local build does not establish those.

References: [Functions Node v4](https://learn.microsoft.com/en-us/azure/azure-functions/functions-reference-node?pivots=nodejs-model-v4),
[Flex CLI setup](https://learn.microsoft.com/en-us/azure/azure-functions/flex-consumption-how-to),
[Flex hosting](https://learn.microsoft.com/en-us/azure/azure-functions/flex-consumption-plan).
