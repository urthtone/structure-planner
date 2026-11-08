import { describe, expect, it, vi } from 'vitest';
import { createAnalyzeHandler } from '../src/analyze';
const image = 'data:image/jpeg;base64,/9j/';
const analysis = { groundSlope:'unknown',groundType:'grass',obstructions:[],sunShade:'unknown',styleHints:['gable'],suggestedFoundation:'skids',notes:['Verify on site.'] };
const req = (images: unknown = [image], headers: Record<string,string> = {}, method = 'POST') => new Request('https://functions.example.test/api/analyze',{ method, headers:{origin:'https://hilltopstructures.us','content-type':'application/json','x-forwarded-for':'192.0.2.1',...headers}, ...(method === 'POST' ? {body:JSON.stringify({images})} : {}) });
const response = () => new Response(JSON.stringify({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(analysis)}]}]}));
describe('Azure photo analysis',()=>{
  it('preserves the unconfigured response without spending credits',async()=>{
    const fetcher=vi.fn(); const result=await createAnalyzeHandler({env:{},fetcher})(req());
    expect(result.status).toBe(200); expect(result.jsonBody).toMatchObject({status:'not_configured'}); expect(fetcher).not.toHaveBeenCalled();
  });
  it('defaults to documented xAI vision Responses input and does not store images',async()=>{
    const fetcher=vi.fn().mockResolvedValue(response());
    const result=await createAnalyzeHandler({env:{XAI_API_KEY:'test-only'},fetcher})(req());
    expect(result.status).toBe(200); expect(result.jsonBody).toMatchObject({status:'ok',analysis});
    expect(fetcher.mock.calls[0][0]).toBe('https://api.x.ai/v1/responses');
    const body=JSON.parse(fetcher.mock.calls[0][1].body);
    expect(body.model).toBe('grok-4.3'); expect(body.store).toBe(false);
    expect(body.input[1].content).toContainEqual({type:'input_image',image_url:image});
    expect(body.text.format.type).toBe('json_schema');
  });
  it('allows a model override and explicitly configured OpenAI fallback when xAI is absent',async()=>{
    const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(analysis)}}]})));
    const result=await createAnalyzeHandler({env:{OPENAI_API_KEY:'test-only',VISION_MODEL:'custom-vision'},fetcher})(req());
    expect(result.status).toBe(200); expect(fetcher.mock.calls[0][0]).toBe('https://api.openai.com/v1/chat/completions');
    expect(JSON.parse(fetcher.mock.calls[0][1].body).model).toBe('custom-vision');
  });
  it('rejects non-images, too many images and oversized streams',async()=>{
    for(const images of [[],Array(6).fill(image),['https://example.test/a.png'],['data:image/svg+xml;base64,AAAA'],['data:image/jpeg;base64,'+'A'.repeat(650000)]]) {
      expect((await createAnalyzeHandler({env:{}})(req(images))).status).toBe(400);
    }
    expect((await createAnalyzeHandler({env:{}})(req([image],{'content-length':'4500001'}))).status).toBe(400);
    const big = new Request('https://example.test/api/analyze',{method:'POST',headers:{origin:'https://hilltopstructures.us'},body:'a'.repeat(4500001)});
    expect((await createAnalyzeHandler({env:{}})(big)).status).toBe(400);
  });
  it('restricts origins, handles preflight and can require a server-to-server shared key',async()=>{
    const handler=createAnalyzeHandler({env:{}});
    expect((await handler(req([image],{origin:'https://evil.test'}))).status).toBe(403);
    expect((await handler(req([image],{origin:''}))).status).toBe(403);
    const preflight=await handler(req(undefined,{},'OPTIONS'));
    expect(preflight.status).toBe(204); expect(new Headers(preflight.headers).get('Access-Control-Allow-Origin')).toBe('https://hilltopstructures.us');
    const secured=createAnalyzeHandler({env:{ANALYZE_SHARED_KEY:'test-key'}});
    expect((await secured(req())).status).toBe(401);
    expect((await secured(req([image],{'x-analysis-key':'test-key'}))).status).toBe(200);
  });
  it('enforces a bounded per-IP in-memory window and recovers after expiry',async()=>{
    let now=0; const handler=createAnalyzeHandler({env:{RATE_LIMIT_MAX:'1',RATE_LIMIT_WINDOW_SECONDS:'60'},now:()=>now});
    expect((await handler(req())).status).toBe(200);
    expect((await handler(req())).status).toBe(429);
    expect((await handler(req([image],{'x-forwarded-for':'192.0.2.2'}))).status).toBe(200);
    now=61000;expect((await handler(req())).status).toBe(200);
  });
  it('does not leak provider errors and rejects malformed structured output',async()=>{
    for(const raw of [new Response('provider-secret',{status:401}),new Response(JSON.stringify({output:[{type:'message',content:[{type:'output_text',text:'{"suggestedFoundation":"magic"}'}]}]}))]) {
      const result=await createAnalyzeHandler({env:{XAI_API_KEY:'test-only'},fetcher:vi.fn().mockResolvedValue(raw)})(req());
      expect(result.status).toBe(502); expect(JSON.stringify(result.jsonBody)).not.toContain('provider-secret');
    }
  });
  it('supports an xAI model override without failing over photos to OpenAI',async()=>{
    const fetcher=vi.fn().mockRejectedValue(new Error('provider unavailable'));
    const result=await createAnalyzeHandler({env:{XAI_API_KEY:'test-only',OPENAI_API_KEY:'other-test-only',VISION_MODEL:'grok-4.7'},fetcher})(req());
    expect(result.status).toBe(502);expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe('https://api.x.ai/v1/responses');
    expect(JSON.parse(fetcher.mock.calls[0][1].body).model).toBe('grok-4.7');
  });
  it('rejects unsupported xAI direct raster types and invalid CORS configuration before provider use',async()=>{
    const fetcher=vi.fn();
    expect((await createAnalyzeHandler({env:{XAI_API_KEY:'test-only'},fetcher})(req(['data:image/gif;base64,AAAA']))).status).toBe(400);
    expect((await createAnalyzeHandler({env:{ALLOWED_ORIGINS:'*'},fetcher})(req())).status).toBe(503);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects foundation arrays rather than coercing them into valid enum strings',async()=>{
    const invalid={...analysis,suggestedFoundation:['skids']};
    const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(invalid)}]}]})));
    expect((await createAnalyzeHandler({env:{XAI_API_KEY:'test-only'},fetcher})(req())).status).toBe(502);
  });

});
