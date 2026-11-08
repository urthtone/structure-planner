# Approved planner infrastructure bootstrap

`main.json` is a minimal subscription-scope ARM template. Its reviewed parameter
file targets Azure subscription 1's planner resource group in eastus2. It creates
only the group, Standard_LRS storage with a private deployment container, a
required FC1 Flex hosting plan, and the Linux/Node 22 Function app. No App Insights,
workspace, identity, custom role assignment, gateway or database is included.

The Azure Functions runtime/deployment connection strings are generated inside
Azure and remain in app settings; the template outputs no credentials. xAI's key
is not a template parameter and must be set separately from a secure environment
value, never embedded in this repository or the static frontend.

**Bootstrap once.** The initial template sets inline app settings. Reapplying it
after adding XAI_API_KEY would replace that settings collection and remove the
key. For subsequent code deployments, publish only the compiled Function ZIP;
do not reapply bootstrap infrastructure. Preserve existing app settings when
making targeted configuration changes. No destructive/complete-mode deployment
is authorized or used.

Preflight used `az deployment sub validate` and resource-ID-only `what-if` before
`az deployment sub create`. See `.azure/deployment-plan.md` for actual validation
proof, names and deployment results. Subscription and resource creation require
explicit owner approval; do not run generic creation examples to make duplicates.
