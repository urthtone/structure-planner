import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createPlanHandler } from '../src/plan';
import { planSchema } from '../src/plan-contract';
import { createAnalyzeHandler } from '../src/analyze';
import { createRateLimitState } from '../src/vision-handler';

const originalSchema = runInNewContext(readFileSync(new URL('./fixtures/grok-plan-zod-expression.txt', import.meta.url),'utf8'),{
  Ps:z.object,es:z.string,ws:z.number,Bs:z.enum,Ms:z.array,uc:['shed','deck','cabin','garage'],
},{timeout:500}) as typeof planSchema;
const image='data:image/png;base64,AAAA';
const input={images:[image],structureType:'shed',widthFt:10,lengthFt:12,heightFt:8,estimateSize:false,material:'wood',notes:''};
const plan={title:'10 × 12 shed concept',structureType:'shed',photoReadings:[{index:1,reading:'Visible grass; soil bearing cannot be established.'}],siteNotes:'Verify slope and drainage on site.',dimensions:{widthFt:10,lengthFt:12,wallHeightFt:8,roof:'6/12 gable, preliminary'},rooms:[{name:'Shed',x:0,y:0,w:10,h:12}],openings:[{kind:'door',wall:'s',offsetFt:3.5,widthFt:3}],materials:[{item:'Floor sheathing',qty:'5 sheets',notes:'Example allowance with waste; verify framing.'}],steps:[{title:'Verify the site',detail:'Check permits, setbacks, drainage and foundation requirements.'}],warnings:[],costRange:'$2,000–$4,000 materials, illustrative'};
const req=(body:unknown=input,headers:Record<string,string>={},method='POST')=>new Request('https://functions.example.test/api/plan',{method,headers:{origin:'https://hilltopstructures.us','content-type':'application/json','x-forwarded-for':'192.0.2.5',...headers},...(method==='POST'?{body:JSON.stringify(body)}:{})});
const provider=(value:unknown=plan)=>vi.fn().mockImplementation(async()=>new Response(JSON.stringify({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]})));
const env={XAI_API_KEY:'test-only',VISION_PROVIDER:'xai'};

describe('Grok frontend plan contract',()=>{
  it('matches every constraint of the schema extracted from the actual frontend bundle',()=>{
    expect(z.toJSONSchema(planSchema)).toEqual(z.toJSONSchema(originalSchema));
    expect(originalSchema.safeParse(plan).success).toBe(true);
  });
  it('accepts the exact measured request and returns ok + plan validated with the original schema',async()=>{
    const fetcher=provider();const result=await createPlanHandler({env,fetcher})(req());
    expect(result.status).toBe(200);expect(result.jsonBody).toMatchObject({ok:true});
    const body=result.jsonBody as {ok:boolean;plan:unknown};expect(originalSchema.safeParse(body.plan).success).toBe(true);
    expect(body.plan).toMatchObject({dimensions:inputDimensions()});
    expect(fetcher.mock.calls[0][0]).toBe('https://api.x.ai/v1/responses');
    const wire=JSON.parse(fetcher.mock.calls[0][1].body);
    expect(wire.store).toBe(false);expect(wire.model).toBe('grok-4.3');
    expect(wire.input[1].content).toContainEqual({type:'input_image',image_url:image});
    expect(wire.text.format).toMatchObject({type:'json_schema',strict:true,name:'structure_plan'});
    expect((body.plan as typeof plan).warnings.join(' ')).toMatch(/not.*engineered|engineer/i);
    expect((body.plan as typeof plan).costRange).toMatch(/example|illustrative/i);
  });
  it('disables optional Grok 4.3 reasoning for the longer plan to fit the provider deadline',async()=>{
    const fetcher=provider();await createPlanHandler({env,fetcher})(req());
    expect(JSON.parse(fetcher.mock.calls[0][1].body).reasoning).toEqual({effort:'none'});
  });
  it('gives the larger plan 50 seconds while staying inside the unchanged 60-second Function budget',async()=>{
    const timeout=vi.spyOn(AbortSignal,'timeout');
    try{await createPlanHandler({env,fetcher:provider()})(req());expect(timeout).toHaveBeenCalledWith(50000);}
    finally{timeout.mockRestore();}
  });
  it('does not send a model-specific reasoning option to unknown model overrides',async()=>{
    const fetcher=provider();await createPlanHandler({env:{...env,VISION_MODEL:'other-vision'},fetcher})(req());
    const body=JSON.parse(fetcher.mock.calls[0][1].body);expect(body.model).toBe('other-vision');expect(body.reasoning).toBeUndefined();
  });
  it('accepts estimate mode without dimensions but explicitly labels assumed planning dimensions',async()=>{
    const result=await createPlanHandler({env,fetcher:provider()})(req({images:[image],structureType:'shed',estimateSize:true,material:'wood',notes:''}));
    expect(result.status).toBe(200);
    const body=result.jsonBody as {plan:typeof plan};
    expect(originalSchema.safeParse(body.plan).success).toBe(true);
    expect(body.plan.siteNotes).toMatch(/assumed|not measured/i);
    expect(body.plan.warnings.join(' ')).toMatch(/measure|scale/i);
  });
  it.each(['deck','cabin','garage'])('accepts the frontend structure enum %s',async(structureType)=>{
    expect((await createPlanHandler({env,fetcher:provider({...plan,structureType})})(req({...input,structureType}))).status).toBe(200);
  });
  it.each(['metal','composite','concrete'])('accepts the frontend material enum %s',async(material)=>{
    expect((await createPlanHandler({env,fetcher:provider()})(req({...input,material}))).status).toBe(200);
  });
  it('rejects invalid dimensions, types and oversized notes before spending credits',async()=>{
    const fetcher=provider();
    for(const changes of [{widthFt:0},{widthFt:121},{lengthFt:-1},{heightFt:41},{heightFt:undefined},{widthFt:'10'},{estimateSize:'false'},{material:'brick'},{structureType:'tower'},{notes:'x'.repeat(801)}]){
      const result=await createPlanHandler({env,fetcher})(req({...input,...changes}));
      expect(result.status).toBe(400);expect(result.jsonBody).toMatchObject({ok:false,error:expect.any(String)});
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('retains five-photo, raster, per-image and streamed body caps',async()=>{
    for(const images of [[],Array(6).fill(image),['data:image/svg+xml;base64,AAAA'],['data:image/png;base64,'+'A'.repeat(650000)]]){
      const result=await createPlanHandler({env})(req({...input,images}));expect(result.status).toBe(400);expect(result.jsonBody).toMatchObject({ok:false});
    }
    const result=await createPlanHandler({env})(req(input,{'content-length':'4500001'}));expect(result.status).toBe(400);
  });
  it('requires exactly one valid reading for each submitted photo',async()=>{
    for(const photoReadings of [[],[{index:2,reading:'Wrong image.'}],[plan.photoReadings[0],plan.photoReadings[0]]]){
      const result=await createPlanHandler({env,fetcher:provider({...plan,photoReadings})})(req());expect(result.status).toBe(502);
    }
  });
  it('rejects mismatched measured dimensions, structure types, rooms and openings outside the footprint',async()=>{
    for(const changes of [{dimensions:{...plan.dimensions,widthFt:11}},{structureType:'garage'},{rooms:[{name:'Outside',x:9,y:0,w:2,h:1}]},{openings:[{kind:'door',wall:'n',offsetFt:9,widthFt:3}]}]){
      const result=await createPlanHandler({env,fetcher:provider({...plan,...changes})})(req());expect(result.status).toBe(502);expect(result.jsonBody).toMatchObject({ok:false});
    }
  });
  it('rejects malformed schema output without exposing provider errors',async()=>{
    for(const value of [{...plan,steps:[]},{...plan,dimensions:{...plan.dimensions,heightFt:8,wallHeightFt:undefined}},{...plan,title:'x'.repeat(121)}]){
      expect((await createPlanHandler({env,fetcher:provider(value)})(req())).status).toBe(502);
    }
    const result=await createPlanHandler({env,fetcher:vi.fn().mockRejectedValue(new Error('private-provider-error'))})(req());
    expect(result.status).toBe(502);expect(JSON.stringify(result.jsonBody)).not.toContain('private-provider-error');
  });
  it('returns a clear compatible not-configured error without calling a provider',async()=>{
    const fetcher=provider();const result=await createPlanHandler({env:{VISION_PROVIDER:'xai'},fetcher})(req());
    expect(result.status).toBe(503);expect(result.jsonBody).toMatchObject({ok:false,error:expect.stringMatching(/not configured/i)});expect(fetcher).not.toHaveBeenCalled();
  });
  it('keeps exact-origin CORS, preflight and optional shared-key checks',async()=>{
    const handler=createPlanHandler({env:{}});
    const preflight=await handler(req(undefined,{},'OPTIONS'));expect(preflight.status).toBe(204);expect(new Headers(preflight.headers).get('Access-Control-Allow-Origin')).toBe('https://hilltopstructures.us');
    const denied=await handler(req(input,{origin:'https://evil.test'}));expect(denied.status).toBe(403);expect(denied.jsonBody).toMatchObject({ok:false});
    expect(new Headers(denied.headers).has('Access-Control-Allow-Origin')).toBe(false);
    expect((await createPlanHandler({env:{ANALYZE_SHARED_KEY:'only-server'}})(req())).status).toBe(401);
  });
  it('shares the limiter with analyze so alternating endpoints does not double the quota',async()=>{
    const rateLimitState=createRateLimitState();const shared={env:{RATE_LIMIT_MAX:'1'},rateLimitState};
    expect((await createAnalyzeHandler(shared)(req())).status).toBe(200);
    const result=await createPlanHandler(shared)(req());expect(result.status).toBe(429);expect(result.jsonBody).toMatchObject({ok:false});expect(new Headers(result.headers).has('Retry-After')).toBe(true);
  });
});
function inputDimensions(){return {widthFt:10,lengthFt:12,wallHeightFt:8};}
