# Deployment preparation plan

Status: Local preparation complete; Azure deployment NOT authorized or validated.

## Scope and architecture

- Static Next.js/PWA export at `/planner/` for Apache/Bluehost.
- Separate Azure Functions v4 programming-model Node 22 photo-analysis app.
- Public build-time NEXT_PUBLIC_ANALYZE_URL; provider secrets only in Function settings.
- xAI Responses API, current vision-capable `grok-4.3` default, model overridable.
- Manual Flex Consumption creation/publish commands in docs/DEPLOY.md only.
- No signing, sign-in, native packaging, Azure provisioning or Bluehost access.

## Proposed Azure resources

Subscription: Azure subscription 1 (fab73657-6b07-46a5-956f-685cf81cb414).
Proposed group: rg-hilltop-planner-api; region eastus2 pending availability checks.
Proposed Linux Flex Consumption/Node 22, 512 MB, no always-ready instances.
Names, region, quotas, costs, RBAC and production gateway need owner review.

## Validation proof (LOCAL ONLY)

- npm run lint: passed.
- npm test: 17 frontend/engine tests + 10 mocked-provider Function tests passed.
- npm run build:api: passed; compiled SDK entry point and standalone handler.
- Node 22.23.4 isolated TypeScript build and 10 Function tests: passed.
  Default box Node is 24.22.1; Node 22 checks used npm exec's isolated Node binary.
- npm run test:e2e: 4 passed (photo limits/compression, suggestions, manual plan, PDF).
- npm run test:e2e:pwa: static Next build plus 1 production mobile browser test passed.
  Browser verified /planner assets/manifest/icons, service-worker scope, offline
  reload/generation, no horizontal overflow/runtime errors, and default $4,189.10.
- Generated out/.htaccess exists; all 28 precache resources exist under /planner/.
- git diff --check: passed.

## Live validation blockers / deliberately not performed

- Cached Azure CLI context shows the enabled subscription/tenant; live token and
  deployment permission not independently verified.
- Sanctioned connector resource-group/subscription reads blocked by policy:
  management.azure.com not allowed. Functions language inventory similarly blocked
  for cdn.functions.azure.com. Existing resource/region/quotas are unknown.
- No Azure resources created, modified or deployed; no Bicep/ARM preview executed.
- Azure validation/deploy stages not entered: deployment plan lacks owner approval.
- Core Tools is not installed; actual Functions host/startup not smoke-tested.
- No real xAI/optional OpenAI request; tests inject a mocked provider.
- No Bluehost/Apache access or real-phone install/camera testing.
- CORS and in-memory IP throttling are not authentication/distributed spending caps;
  gateway authorization/throttling and provider spending controls need launch review.
