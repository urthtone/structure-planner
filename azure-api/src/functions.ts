import { app } from '@azure/functions';
import { createAnalyzeHandler } from './analyze';
import { createPlanHandler } from './plan';
import { createRateLimitState } from './vision-handler';
app.setup({ enableHttpStream: true });
// Both routes use one quota per IP in each worker process, not two separate quotas.
const rateLimitState=createRateLimitState();
const analyze=createAnalyzeHandler({rateLimitState});
const plan=createPlanHandler({rateLimitState});
const authLevel=process.env.ANALYZE_REQUIRE_FUNCTION_KEY === 'true' ? 'function' : 'anonymous';
app.http('analyze', {
  methods:['POST','OPTIONS'],route:'analyze',authLevel,
  handler:request=>analyze(request),
});
app.http('plan', {
  methods:['POST','OPTIONS'],route:'plan',authLevel,
  handler:request=>plan(request),
});
