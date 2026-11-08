// Explicit deployment smoke test. Configured mode makes exactly ONE AI request.
import assert from 'node:assert/strict';
import { readFile,writeFile } from 'node:fs/promises';
import { parseAnalysis } from '../azure-api/dist/contract.js';
const [endpoint,mode='unconfigured'] = process.argv.slice(2);
assert(['unconfigured','configured'].includes(mode));
const target=new URL(endpoint);
assert(target.protocol==='https:' && !target.search && !target.username && !target.password);
const origin='https://hilltopstructures.us';
const options=await fetch(endpoint,{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'},signal:AbortSignal.timeout(120000)});
assert([200,204].includes(options.status),`OPTIONS status ${options.status}`);
assert.equal(options.headers.get('access-control-allow-origin'),origin);
assert(options.headers.get('access-control-allow-methods')?.includes('POST'));
const image=await readFile(new URL('../azure-api/test/fixtures/synthetic-site.png',import.meta.url));
const response=await fetch(endpoint,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({images:[`data:image/png;base64,${image.toString('base64')}`]}),signal:AbortSignal.timeout(120000)});
assert.equal(response.headers.get('access-control-allow-origin'),origin);
const data=await response.json();
assert.equal(response.status,200,`POST status ${response.status}; ${typeof data.message==='string'?data.message:'analysis unavailable'}`);
if(mode==='configured') {assert.equal(data.status,'ok');parseAnalysis(data.analysis);}
else assert.equal(data.status,'not_configured');
const denied=await fetch(endpoint,{method:'OPTIONS',headers:{Origin:'https://untrusted.example','Access-Control-Request-Method':'POST'},signal:AbortSignal.timeout(120000)});
assert.notEqual(denied.headers.get('access-control-allow-origin'),'https://untrusted.example');
const result={endpoint,mode,optionsStatus:options.status,postStatus:response.status,resultStatus:data.status,allowedOrigin:origin,otherOriginDenied:true,structuredAnalysisValidated:mode==='configured'};
await writeFile(`.azure/smoke-${mode}.json`,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
