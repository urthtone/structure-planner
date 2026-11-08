import { app } from '@azure/functions';
import { createAnalyzeHandler } from './analyze';
app.setup({ enableHttpStream: true });
const handle = createAnalyzeHandler();
app.http('analyze', {
  methods: ['POST', 'OPTIONS'],
  route: 'analyze',
  authLevel: process.env.ANALYZE_REQUIRE_FUNCTION_KEY === 'true' ? 'function' : 'anonymous',
  handler: request => handle(request),
});
