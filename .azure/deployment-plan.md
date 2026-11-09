# Planner Azure deployment record

Status: Deployed and API-verified for /api/plan; supplied frontend browser-render check pending.
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


## Grok frontend contract adaptation (code-only deployment)
- Approved scope: preserve existing resources/settings; add `/api/plan` and retain `/api/analyze`. Never reapply the bootstrap template.
- Extracted request/schema from James's Vite bundle; keep the reviewed 804-character Zod expression as an independent test fixture.
- Implement server-side schema, dimension/layout bounds and photo-index validation; label AI drafts and assumed dimensions explicitly. Share the existing process-local limiter across both routes.
- Run API/root tests, lint and builds, package Node 22 production dependencies, then ZIP-deploy code only. Verify XAI_API_KEY by setting name only.
- Smoke-test production-only CORS and a real photo request, including the original frontend rendering. Serve the unchanged frontend locally using a production-origin mapping in an isolated browser (no Bluehost requests).
- Release ZIP changes only config.js; document the supplied build's missing PWA/Apache configuration and unused client schema. Commit locally, no push.

### Code-only validation proof — November 8, 2026, 6:04 PM CST
- npm run lint: passed. npm test: 19 root + 29 API tests passed.
- Node 22 isolated API tests: 29 passed; Node 22 TypeScript API build passed.
- Existing Next static export: passed with live /api/analyze URL; 28 precache assets.
- az account show: approved subscription matched; group location eastus2.
- az functionapp cors show: only https://hilltopstructures.us, no credentials.
- Name-only setting check: XAI_API_KEY present; no values read/printed.
- Fresh production package includes compiled dist, host/package files and Node 22 production dependencies; npm audit zero vulnerabilities, ZIP CRC passed.
- No infrastructure changes; prior ARM validation/what-if proof remains applicable. Bicep/Docker/ACR/MI/RBAC not used; no role or policy changes. Do not rerun bootstrap provisioning.
- Approval already names the existing app/group/subscription/region and code-only deployment. No AZD/new environment needed.

### Latency regression investigation / validation
- First live plan hit 502 at 35 seconds. Local provider-boundary instrumentation reproduced TimeoutError at 35,007 ms; connectivity without a key returned 401 promptly. No photos, keys or provider contents logged.
- xAI Grok 4.3 docs confirm reasoning none is supported. An isolated non-reasoning full-plan request returned valid JSON: 746 output tokens, zero reasoning tokens, about 32 seconds. A 35-second budget is too close to actual latency.
- Added red/green tests: plan requests use reasoning none only for documented Grok 4.3 IDs and a 50-second provider deadline; unknown model overrides remain untouched. Original analyze provider deadline stays 35 seconds, Function host limit stays 60 seconds. Image/body/quota limits and all settings unchanged.
- Fresh lint and 51 unit tests (19 root + 32 API) passed; isolated Node 22 API build/tests passed. Production ZIP refreshed from that build; CRC verified.
- Validated at November 08, 2026, 06:10 PM CST. Ready for code-only corrective deployment.

### Corrective deployment and live proof — November 8, 2026, CST
- Code-only config-zip deployment exited 0 with trigger sync and host health check; no ARM/provisioning/settings update.
- 6:12 PM CST: real allowed-origin OPTIONS 204; denied origin POST 403 with no CORS; legacy /api/analyze invalid request 400 with its original envelope.
- One real synthetic-image /api/plan POST: 200 / ok:true in 10,698 ms; validated using the exact extracted frontend Zod expression. Dimensions 10×12×8, one indexed photo reading, 16 material entries, six build steps. No response contents/photos/keys logged. Evidence: .azure/grok-plan-smoke.json.
- CLI post-deployment projection confirmed XAI_API_KEY remains present by name only.
- Fresh final Next static build, Function TypeScript build, lint, 51 unit tests and diff whitespace check passed. Production Node 22 tests/build also passed.
- Supplied frontend served locally under /planner/: index and four linked local assets return 200 with appropriate JS MIME; config contains live /api/plan. ZIP CRC passed and all files except config.js are byte-identical to the supplied build. Artifact evidence: .azure/grok-upload-artifact.json.
- Browser rendering is NOT verified in this executor: no browser/subagent tool is available, and the desktop skill forbids Shell-driven browser automation. No Playwright browser run claimed. Parent can perform the remaining photo/render check at http://127.0.0.1:3103/planner/ using the local-only origin test proxy; unmodified static preview is at http://127.0.0.1:3104/planner/. No Bluehost requests were made.
- Automated independent reviewer subagent is likewise unavailable; local source/diff review and tests were used.
- Debugging involved three timed-out provider attempts (one deployed, two local) and one successful local diagnostic before the final successful deployed inference. Timeouts can still incur provider charges. No retry loop or automatic provider failover was added.
