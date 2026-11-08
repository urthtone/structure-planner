// Local export smoke-test server only; production uses Bluehost/Apache.
import http from 'node:http';
import { readFile,stat } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve('out');
const port = Number(process.env.PORT || 3102);
const types = {'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8'};
const server = http.createServer(async (req,res)=>{
  try {
    const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if (pathname === '/planner') {res.writeHead(308,{Location:'/planner/'});res.end();return;}
    if (!pathname.startsWith('/planner/') || !['GET','HEAD'].includes(req.method)) throw new Error('Not found');
    let file = path.resolve(root,'.'+pathname.slice('/planner'.length));
    if (file !== root && !file.startsWith(root+path.sep)) throw new Error('Not found');
    if (path.basename(file).startsWith('.')) throw new Error('Not found');
    if ((await stat(file)).isDirectory()) file=path.join(file,'index.html');
    const data=await readFile(file);
    const headers = {'Content-Type':types[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-cache'};
    if (pathname === '/planner/sw.js') headers['Service-Worker-Allowed']='/planner/';
    res.writeHead(200,headers);res.end(req.method === 'HEAD' ? undefined : data);
  } catch {res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Static planner: http://127.0.0.1:${port}/planner/`));
