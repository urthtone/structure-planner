# Deployment: Bluehost static PWA + Azure photo analysis

**Preparation only. Nothing has been deployed or created.** The website target is
`https://hilltopstructures.us/planner/`. Bluehost shared hosting needs only static
files; it does not run Next.js, Node or the API. No Bluehost access has been used.
No sign-in, code-signing, native-wrapper or app-store setup is required.

## 1. Build and upload the frontend

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
Example public value (not yet provisioned):
`https://hilltop-planner-api-UNIQUE.azurewebsites.net/api/analyze`.

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

## 2. Proposed Azure plan (not existing resources)

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

### Inventory/access found on this box

`az` is installed and `az account show` returns the enabled subscription/tenant
above: a cached/logged-in account context exists. This does **not** verify a live
management token or deployment permission. Core Tools (`func`) was not installed
at inspection time. The sanctioned Azure connector's resource-group/subscription
reads were blocked by policy (`management.azure.com is not allowed`); its Functions
language inventory was also blocked (`cdn.functions.azure.com is not allowed`).
Therefore existing groups, Function apps, storage, quotas and usable regions are
**unknown, not empty**. No lower-level API workaround was attempted. No signing
accounts, registrations or credentials were inspected for this task.

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
`dist/functions.js` registers **POST `/api/analyze`** plus OPTIONS. The pure shared
JSON contract in `azure-api/src/contract.ts` is also used by the frontend. Root
`src/app/api` is removed so Next can export static files.

Set these as **Function app settings**, never frontend variables:

| Setting | Value / purpose |
| --- | --- |
| `XAI_API_KEY` | James's xAI API key, set privately in Azure Portal app settings or via a Key Vault reference. **Never** commit, paste into `.env.local`, `NEXT_PUBLIC_*` or an endpoint URL. |
| `VISION_MODEL` | Default `grok-4.3`, a current image-capable model verified against xAI docs. Override for another supported vision/structured-output model. |
| `VISION_BASE_URL` | Optional; xAI default `https://api.x.ai/v1`. HTTPS only; no query/credentials. |
| `OPENAI_API_KEY` | Optional alternative **only when XAI_API_KEY is absent**; default `gpt-4o`, Chat Completions. No automatic failover after an xAI error. |
| `ALLOWED_ORIGINS` | `https://hilltopstructures.us` (comma-separated exact origins if necessary; no wildcard, no `/planner` path). |
| `REQUIRE_ORIGIN` | `true` (default); reject missing Origin. A trusted server client can explicitly opt out with `false`. |
| `FUNCTIONS_REQUEST_BODY_SIZE_LIMIT` | `4500000`; host limit, in addition to streamed application validation. |
| `RATE_LIMIT_MAX` | `10` requests per IP/window/process by default. |
| `RATE_LIMIT_WINDOW_SECONDS` | `600` by default. |
| `ANALYZE_SHARED_KEY` | Optional server-to-server shared key, expected as `X-Analysis-Key`. Leave absent for direct public PWA use. |
| `ANALYZE_REQUIRE_FUNCTION_KEY` | `false` for public direct PWA; `true` registers host `function` auth instead of anonymous, requiring a Function key. Only useful behind a trusted proxy; never bundle a key in the frontend. |

Runtime/storage/telemetry settings are configured by app creation. Flex determines
Node runtime from its runtime configuration: do not blindly copy legacy
`FUNCTIONS_WORKER_RUNTIME`/`FUNCTIONS_EXTENSION_VERSION` settings to Flex. Those
local-runtime settings in `local.settings.example.json` are for Core Tools only.

Request: `{ "images": ["data:image/jpeg;base64,..."] }`, 1–5 raster images, each
at most 650,000 data-URL characters and total body at most 4,500,000 bytes. Remote
URLs and SVG are rejected. Legacy JPEG/PNG/WebP/GIF input validation is retained;
xAI additionally requires JPEG/PNG at its provider boundary. The browser converts
all accepted raster uploads to JPEG, including WebP/GIF, before any request.
Success: `{status:'ok',analysis:{groundSlope,groundType,obstructions,sunShade,
styleHints,suggestedFoundation,notes}}`. Missing provider key:
`{status:'not_configured',message}`. Errors use `{status:'error',message}`:
400 invalid/oversize input, 401 optional shared auth, 403 origin, 429 rate limit,
502 provider timeout/error/invalid JSON, 503 invalid origin configuration.
Provider calls time out after 35 seconds and outputs are strictly validated.
The frontend allows 45 seconds; Function timeout is 60 seconds.

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
the spoofable first one; verify Azure's actual trusted ingress chain before
launch. Without a header all callers share one bucket; proxy/NAT behavior may
also group callers. It is **best-effort abuse friction, not production DDoS or
budget protection**. Add a trusted gateway with distributed throttling and/or
real authorization before a broadly exposed paid endpoint. If using a gateway,
restrict direct Function ingress too. No such infrastructure was created here.
Static JavaScript cannot keep a Function/shared key secret. Enabling either key
mode intentionally makes this direct public frontend unable to call the API
until a trusted server proxy exists. Never "fix" that by embedding a key.

## 4. Manual Azure creation/deployment commands (NOT executed)

**Review and obtain deployment approval first. These commands create billable
resources.** Install a current Azure CLI and Azure Functions Core Tools v4;
use Node 22. Authenticate interactively through normal Azure tools if needed.
Check naming availability, quotas, policy, provider registration and role access.

```sh
SUBSCRIPTION=fab73657-6b07-46a5-956f-685cf81cb414
RG=rg-hilltop-planner-api
REGION=eastus2
APP=hilltop-planner-api-REPLACE_WITH_UNIQUE_SUFFIX
STORAGE=htplannerREPLACEWITHUNIQUESUFFIX  # replace: lowercase alphanumeric, <=24 chars
az account set --subscription "$SUBSCRIPTION"
# Read-only discovery; must succeed before creation:
az group list --subscription "$SUBSCRIPTION" --output table
az functionapp list-flexconsumption-locations --output table
# Confirm Node 22 in the selected region using portal/current runtime listing.

az group create --name "$RG" --location "$REGION" --output none
az storage account create --name "$STORAGE" --resource-group "$RG" \
  --location "$REGION" --sku Standard_LRS --allow-blob-public-access false --output none
az functionapp create --name "$APP" --resource-group "$RG" \
  --storage-account "$STORAGE" --flexconsumption-location "$REGION" \
  --runtime node --runtime-version 22 --instance-memory 512 \
  --maximum-instance-count 40 --output none
# No --always-ready-instances: scale to zero. 40 is a conservative documented
# HTTP scale ceiling choice, NOT a 1-instance budget cap or guaranteed capacity.
az functionapp update --name "$APP" --resource-group "$RG" \
  --set httpsOnly=true --output none
az functionapp config appsettings set --name "$APP" --resource-group "$RG" \
  --settings ALLOWED_ORIGINS=https://hilltopstructures.us REQUIRE_ORIGIN=true \
  VISION_MODEL=grok-4.3 RATE_LIMIT_MAX=10 RATE_LIMIT_WINDOW_SECONDS=600 \
  FUNCTIONS_REQUEST_BODY_SIZE_LIMIT=4500000 ANALYZE_REQUIRE_FUNCTION_KEY=false \
  --output none
az functionapp cors add --name "$APP" --resource-group "$RG" \
  --allowed-origins https://hilltopstructures.us --output none
# A new app should have no wildcard CORS; if present, remove it explicitly:
az functionapp cors remove --name "$APP" --resource-group "$RG" \
  --allowed-origins '*' --output none
# Privately add XAI_API_KEY in Portal -> Function app -> environment variables.
# Do not run commands that print app settings or keys into logs/transcripts.

npm --prefix azure-api ci
npm --prefix azure-api test
npm --prefix azure-api run build
# Ship a locally compiled Linux/Node 22 package with production dependencies.
npm --prefix azure-api prune --omit=dev
cd azure-api
func azure functionapp publish "$APP" --no-build
cd ..
npm --prefix azure-api ci  # restore dev dependencies for subsequent tests/builds
# Read the actual hostname in Azure, then set the nonsecret endpoint locally:
# NEXT_PUBLIC_ANALYZE_URL=https://ACTUAL_HOSTNAME/api/analyze in .env.local
npm run build
# Upload out/ as in section 1; do not upload azure-api/ to Bluehost.
```

Publish runs from `azure-api/`, ships compiled `dist/` with `host.json` and package
files plus production `node_modules`, and excludes local secrets/source/tests.
`.funcignore` deliberately does **not** exclude `node_modules`: `--no-build` ships
the already compiled code and installed dependencies, so no remote compilation
is assumed. Prune dev dependencies before publishing and restore them afterward.
Use a Linux/Node 22 build environment; any future native dependencies must match
Azure's OS/runtime. See [TypeScript build options](https://learn.microsoft.com/en-us/azure/azure-functions/typescript-build-options).
Review package contents and host logs before exposing the endpoint; do not ship
a local settings file. Resource names above are placeholders, not reserved.

Host CORS and `ALLOWED_ORIGINS` must match; origin is the domain, not a URL path.
Add www only if that site really serves the planner, and add localhost only for
local testing. Do not enable credentialed wildcard CORS.

For local host testing, install Core Tools v4 plus Azurite, copy
`azure-api/local.settings.example.json` to ignored `azure-api/local.settings.json`,
start Azurite and `npm --prefix azure-api start`. Set frontend public endpoint to
`http://localhost:7071/api/analyze` and restart Next dev. Only loopback HTTP is
accepted by the frontend; production requires HTTPS. No live host/provider call
has been made in this work: provider tests are mocked and `func` was unavailable.

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
