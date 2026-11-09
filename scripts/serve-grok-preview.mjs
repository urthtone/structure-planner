// Local-only test harness. Never upload this proxy to Bluehost.
// It simulates the allowed production Origin for the approved live API test;
// CORS remains production-only and the release ZIP is never changed.
import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(process.env.PLANNER_STATIC_ROOT || '/workspace/planner-grok-release');
const port=Number(process.env.PORT || 3103);
const endpoint='https://hilltop-planner-api-da467d.azurewebsites.net/api/plan';
const proxyPath='/planner/__preview-plan';
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml'};
http.createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(pathname===proxyPath){
      if(req.method!=='POST'){res.writeHead(405,{Allow:'POST'});res.end();return;}
      const chunks=[];let bytes=0;
      for await(const chunk of req){bytes+=chunk.length;if(bytes>4500000){res.writeHead(413);res.end();return;}chunks.push(chunk);}
      const response=await fetch(endpoint,{method:'POST',headers:{Origin:'https://hilltopstructures.us','Content-Type':'application/json'},body:Buffer.concat(chunks),signal:AbortSignal.timeout(65000)});
      res.writeHead(response.status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(await response.text());return;
    }
    if(pathname==='/planner'){res.writeHead(308,{Location:'/planner/'});res.end();return;}
    if(!pathname.startsWith('/planner/') || !['GET','HEAD'].includes(req.method)) throw new Error('Not found');
    let file=path.resolve(root,'.'+pathname.slice('/planner'.length));
    if(file!==root && !file.startsWith(root+path.sep)) throw new Error('Not found');
    if(path.basename(file).startsWith('.')) throw new Error('Not found');
    if((await stat(file)).isDirectory())file=path.join(file,'index.html');
    let data=await readFile(file);
    if(pathname==='/planner/config.js')data=Buffer.from(data.toString().replace(endpoint,proxyPath));
    res.writeHead(200,{'Content-Type':types[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:data);
  }catch{res.writeHead(502,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:false,error:'Local preview unavailable.'}));}
}).listen(port,'127.0.0.1',()=>console.log(`Grok local preview: http://127.0.0.1:${port}/planner/ (test-only API origin proxy; one paid call per Draft)`));
