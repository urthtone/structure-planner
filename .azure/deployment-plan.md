# Planner Azure deployment record

Status: Deployed and verified. xAI key activated securely; real single-image structured result and CORS verified.
Recipe: Azure CLI + native ARM template; Azure Prepare -> Azure Validate -> Azure Deploy completed.

## 1. Approval and scope

James explicitly approved creating the proposed resources and deploying the photo
reader. Subscription: Azure subscription 1, fab73657-6b07-46a5-956f-685cf81cb414.
Region selected: eastus2, confirmed supported with Node 22. No fresh login needed.
No signing, user sign-in, native wrapper, Bluehost access, push or main changes.

## 2. Resources actually created

- rg-hilltop-planner-api (eastus2).
- htplannerda467d, StorageV2/Standard_LRS; private deployments blob container.
- plan-hilltop-planner-da467d, required FC1/Linux Flex hosting plan.
- hilltop-planner-api-da467d, Node 22, 512 MB, no always-ready, max scale 40.
- No App Insights, Log Analytics, identities, custom roles, gateway or database.
- Only required Microsoft.Web/Microsoft.Storage provider registrations enabled.

## 3. Runtime and security

Endpoint: https://hilltop-planner-api-da467d.azurewebsites.net/api/analyze
HTTPS only; exact-origin CORS https://hilltopstructures.us, no credentials.
Explicit VISION_PROVIDER=xai; VISION_MODEL=grok-4.3; VISION_BASE_URL=https://api.x.ai/v1.
Input: 5 bounded images, 4.5 MB streamed body cap; 35-second provider timeout.
Basic per-process IP throttling: 10 requests / 600 seconds, bounded buckets.
This is not authentication, distributed DDoS protection or a hard spend cap.
XAI_API_KEY was supplied through a fresh login-shell environment and set only in
Function app settings. It was never printed, written locally, placed in argv or
committed. CLI name-only verification confirmed the setting exists. The Function
was restarted to load the updated environment; real analysis then passed.

## 4. Deployment packaging

Native ARM bootstrap template: infra/main.json + deployment.parameters.json.
No credentials in templates or outputs. Storage connection strings are generated
inside Azure, with no local credential inspection or output. No MI/RBAC needed.
Bootstrap inline app settings must not be reapplied after adding a provider key;
future code-only ZIP deployments preserve app settings (see infra/README.md).
Compiled production package: /workspace/planner-function.zip, Node 22 dependencies,
124 files, no env/local.settings/source/test files. CLI ZIP deployment succeeded.

## 5. Cost settings

Flex scales to zero; no always-ready baseline or optional telemetry resources.
Storage, execution memory/time, networking and future xAI calls are separately
billable. Max scale 40 and in-memory throttling are not budget caps. Current paid
provider successful smoke inferences: one (synthetic 256-pixel PNG). Pricing references in docs/DEPLOY.md.

## 6. Live smoke results

OPTIONS: 204, Access-Control-Allow-Origin exactly https://hilltopstructures.us.
Before key activation: POST 200, status not_configured (preserved historical proof).
After activation/restart: POST 200, status ok, all structured fields validated.
Different origin denied CORS in both cases. One successful xAI inference; the
pre-restart not_configured request did not call the provider. No analysis contents
or photos were logged. Evidence: .azure/smoke-configured.json, historical
.azure/smoke-unconfigured.json, and .azure/deployed.json.

## 7. Validation proof — November 8, 2026 (CST)

- 5:26 PM CST: az group exists succeeded; target group absent; subscription matched.
- 5:27 PM CST: az version 2.92.0; Flex region and Node 22 runtime listing passed.
- Required providers registered by 5:30 PM CST; storage name available.
- ARM JSON parsed; Bicep compilation N/A (native ARM). No Docker/container used.
- az deployment sub validate: Succeeded at 5:29 PM CST.
- az deployment sub what-if, ResourceIdOnly: Succeeded at 5:30 PM CST, exactly
  five Create changes (group/storage/container/plan/function), no deletes/extras.
- Subscription policy list empty; actual ARM validation passed. Static/live role
  review: no managed identities/custom roles; shared-key storage configured in
  Azure; deployed host loads the published anonymous HTTP function successfully.
- npm run lint; npm test: 19 frontend/engine/tooling + 12 Function tests passed.
- npm run build:api; isolated Node 22 Function tests/build passed.
- Production-only Node 22 package installed; npm audit zero vulnerabilities;
  compiled handler loads and ZIP excludes env/local settings.
- az deployment sub create: Succeeded at 5:32 PM CST.
- az functionapp deployment source config-zip: exit 0 at 5:33 PM CST, trigger sync
  and host health check completed. Actual resource inventory contains only the
  required storage, FC1 plan and Function, in the approved group.
- Live CORS/no-key smoke passed at 5:33 PM CST.
- npm run test:e2e: 4 passed (intake, compression, suggestions, manual plan/PDF).
- Static build with actual NEXT_PUBLIC_ANALYZE_URL passed; 28 scoped precache files.
- Production browser tests: 2 passed, including offline reload/default $4,189.10
  shed plan, manifest/icons/scope/mobile layout and configured hosted endpoint
  used only on Analyze click (mocked response, no provider credits).
- git diff --check passed. Archive and final source checks recorded in commit.

## 8. Remaining checks

Only production Apache headers and physical-phone install/camera behavior remain
after the owner uploads the static files. Azure photo analysis is verified.
No Bluehost login/upload performed. No fresh Azure login or resource blockers.

### Final code-only hardening

Before activation of paid analysis, a regression test exposed source ports in
forwarded-IP quota keys. IPv4 ports and bracketed IPv6 ports are now stripped,
IPv6 forms canonicalized, and malformed addresses fail into a shared bucket.
The 12 Function tests (including this red/green regression) and Node 22 build
passed before a code-only ZIP update. No infrastructure/app settings changed.
This does not change the documented trusted-proxy/distributed-limit caveats.

### Upload artifact

/workspace/planner-upload.zip: 41 static files, 366369 bytes. Includes .htaccess
at archive root, /planner-scoped shell and compiled live API URL; no out/ wrapper,
provider key identifiers or local settings. ZIP CRC verified; sha256 and CST build
time recorded in .azure/upload-artifact.json. Upload contents to the domain's
planner/ directory. No Bluehost upload/access performed.

### Secure key activation continuation — November 8, 2026 (CST)

- A fresh bash login shell received XAI_API_KEY. Initial Node stdin transport failed
  locally: its socket could not be reopened as /dev/stdin (ENXIO). No key appeared
  in logs; only fixed diagnostic categories were reported.
- Reproduced with a nonsecret fixture. Added two red/green transport regression
  tests and a Python subprocess.PIPE bridge. Same Azure CLI, same scoped setting
  operation; no REST/internal-API workaround or credentials/token inspection.
- Key sent in an anonymous in-memory pipe, never in a file, argv, output or commit.
  Azure CLI app-setting update succeeded; name-only check confirmed presence.
- Immediate request reached an old worker and returned not_configured, spending
  no provider credits. Targeted Function restart completed; no new resources.
- 5:44 PM CST: live configured smoke passed: OPTIONS 204, POST 200/status ok,
  strict structured JSON validated, unrelated origin denied. One successful
  provider inference. Runtime/provider remain Node 22/xAI/grok-4.3.
- Fresh lint, 31 unit tests (19 frontend/tooling + 12 Function), Function build,
  Node 22 Function tests, 4 workflow browser tests, static export and 2 production
  PWA tests passed. Fresh export uses the unchanged live endpoint.
