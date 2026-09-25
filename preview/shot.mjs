import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve('dist');
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml'};
const srv = http.createServer((q,s)=>{ let p = decodeURIComponent(q.url.split('?')[0]); if(p.endsWith('/')) p+='index.html'; const f=path.join(root,p); if(!f.startsWith(root)||!fs.existsSync(f)){s.writeHead(404);return s.end('nf');} s.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(s);}).listen(0);
const port = srv.address().port;
const [,, page='garden-test.html', out='/tmp/shot.png', w='1200', h='680', extra='{}'] = process.argv;
const cfg = JSON.parse(extra);
const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:+w,height:+h}, deviceScaleFactor: cfg.dpr||1, hasTouch: !!cfg.touch, isMobile: !!cfg.mobile });
const p = await ctx.newPage();
p.on('console', m=>{ if(m.type()==='error'||m.type()==='warning') console.log('console', m.type(), m.text()); });
p.on('pageerror', e=>console.log('pageerror', e.message));
await p.goto(`http://localhost:${port}/${page}`);
await p.waitForFunction('window.ready===true', null, {timeout:15000}).catch(()=>console.log('no ready flag'));
await p.waitForTimeout(cfg.wait||800);
if (cfg.eval) { const v = await p.evaluate(cfg.eval); if (v!==undefined) console.log('eval', JSON.stringify(v)); await p.waitForTimeout(cfg.wait2||300); }
await p.screenshot({ path: out, fullPage: !!cfg.full });
await b.close(); srv.close();
