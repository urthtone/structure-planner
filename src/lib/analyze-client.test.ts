import { expect,it,vi } from 'vitest';
import { requestAnalysis } from './analyze-client';
it('does not fetch when the static app has no configured analysis URL',async()=>{
  const fetcher=vi.fn();expect(await requestAnalysis([],undefined,fetcher)).toMatchObject({status:'not_configured'});expect(fetcher).not.toHaveBeenCalled();
});
it('uses only a configured HTTPS analysis URL without embedded keys',async()=>{
  const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({status:'not_configured',message:'test'})));
  await requestAnalysis(['photo'],'https://api.example.test/api/analyze',fetcher);
  expect(fetcher.mock.calls[0][0]).toBe('https://api.example.test/api/analyze');
  await expect(requestAnalysis([],'https://api.example.test/api/analyze?code=secret',fetcher)).rejects.toThrow();
});
