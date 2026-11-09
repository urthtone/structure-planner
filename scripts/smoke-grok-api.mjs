// Explicit paid-provider smoke test: one synthetic image, no keys/AI contents logged.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {z} from '../azure-api/node_modules/zod/index.js';
const endpoint=process.argv[2] || 'https://hilltop-planner-api-da467d.azurewebsites.net/api/plan';
const url=new URL(endpoint);
assert.equal(url.protocol,'https:');assert.equal(url.origin,'https://hilltop-planner-api-da467d.azurewebsites.net');assert.equal(url.pathname,'/api/plan');assert.equal(url.search,'');
const origin='https://hilltopstructures.us';
const schema=runInNewContext(await readFile(new URL('../azure-api/test/fixtures/grok-plan-zod-expression.txt',import.meta.url),'utf8'),{Ps:z.object,es:z.string,ws:z.number,Bs:z.enum,Ms:z.array,uc:['shed','deck','cabin','garage']},{timeout:500});
const request=(path,options)=>fetch(new URL(path,url),{...options,signal:AbortSignal.timeout(65000)});
const options=await request('/api/plan',{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'Content-Type'}});
assert.ok([200,204].includes(options.status));assert.equal(options.headers.get('access-control-allow-origin'),origin);assert.match(options.headers.get('access-control-allow-methods') || '',/POST/);
const denied=await request('/api/plan',{method:'POST',headers:{Origin:'https://not-allowed.example','Content-Type':'application/json'},body:'{}'});
assert.equal(denied.status,403);assert.equal(denied.headers.get('access-control-allow-origin'),null);assert.equal((await denied.json()).ok,false);
const legacy=await request('/api/analyze',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{"images":[]}'});
assert.equal(legacy.status,400);assert.equal((await legacy.json()).status,'error');
const image=await readFile(new URL('../azure-api/test/fixtures/synthetic-site.png',import.meta.url));
const body={images:[`data:image/png;base64,${image.toString('base64')}`],structureType:'shed',widthFt:10,lengthFt:12,heightFt:8,estimateSize:false,material:'wood',notes:'Synthetic test illustration; do not assume real site conditions.'};
const start=Date.now();
const response=await request('/api/plan',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
const result=await response.json();
if(response.status!==200 || result.ok!==true){
  console.error(JSON.stringify({step:'real-photo-plan',status:response.status,ok:result.ok,error:result.error || 'Invalid response'}));process.exitCode=1;
}else{
  schema.parse(result.plan);
  assert.equal(response.headers.get('access-control-allow-origin'),origin);
  assert.deepEqual([result.plan.dimensions.widthFt,result.plan.dimensions.lengthFt,result.plan.dimensions.wallHeightFt],[10,12,8]);
  assert.equal(result.plan.photoReadings.length,1);assert.equal(result.plan.photoReadings[0].index,1);
  const evidence={endpoint,checkedAt:new Intl.DateTimeFormat('en-US',{dateStyle:'long',timeStyle:'long',timeZone:'America/Chicago'}).format(new Date()),optionsStatus:options.status,allowedOrigin:origin,deniedOriginStatus:denied.status,legacyAnalyzeInvalidStatus:legacy.status,postStatus:response.status,ok:true,originalFrontendSchemaValid:true,dimensions:[10,12,8],photoReadings:1,materials:result.plan.materials.length,steps:result.plan.steps.length,elapsedMs:Date.now()-start,paidProviderRequests:1};
  await writeFile(new URL('../.azure/grok-plan-smoke.json',import.meta.url),JSON.stringify(evidence,null,2)+'\n');
  console.log(JSON.stringify(evidence,null,2));
}
