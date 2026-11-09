import { app } from '@azure/functions';
import { createAnalyzeHandler } from './analyze';
import { createPlanHandler } from './plan';
import { createFabHandler } from './fab-route';
import { createRateLimitState } from './vision-handler';
app.setup({ enableHttpStream: true });
// All routes use one photo quota per IP in each worker process, not two separate quotas.
const rateLimitState=createRateLimitState();
const analyze=createAnalyzeHandler({rateLimitState});
const plan=createPlanHandler({rateLimitState});
const fab=createFabHandler({rateLimitState});
const authLevel=process.env.ANALYZE_REQUIRE_FUNCTION_KEY === 'true' ? 'function' : 'anonymous';
app.http('analyze', {
  methods:['POST','OPTIONS'],route:'analyze',authLevel,
  handler:request=>analyze(request),
});
app.http('plan', {
  methods:['POST','OPTIONS'],route:'plan',authLevel,
  handler:request=>plan(request),
});
app.http('fab', {
  methods:['POST','OPTIONS'],route:'fab',authLevel,
  handler:request=>fab(request),
});
