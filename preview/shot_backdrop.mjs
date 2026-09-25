import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve('dist');
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg'};
const srv = http.createServer((q,s)=>{ let p=decodeURIComponent(q.url.split('?')[0]); const f=path.join(root,p); if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end();} s.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(s);}).listen(0);
const url = `http://localhost:${srv.address().port}/page.html?static`;
const b = await chromium.launch();
const p = await b.newPage({viewport:{width:1440,height:900}});
const errs=[]; p.on('console',m=>{if(['error','warning'].includes(m.type())) errs.push(m.text())}); p.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
await p.goto(url); await p.waitForFunction('window.ready===true'); await p.waitForTimeout(700);
await p.evaluate(()=>document.querySelector('#garden-stage').scrollIntoView({behavior:'instant', block:'center'}));
await p.waitForTimeout(500);
await p.screenshot({path:'/tmp/backdrop_default.png'});

// force the plane mid-flight for a clear screenshot
await p.addStyleTag({content: `.gb-plane { animation: none !important; transform: translate(650px, 235px) !important; opacity: 1 !important; }`});
await p.waitForTimeout(200);
await p.screenshot({path:'/tmp/backdrop_plane.png'});
// zoomed crop on the plane
const box = await p.locator('.garden__canvas').boundingBox();
await p.screenshot({path:'/tmp/backdrop_plane_crop.png', clip: { x: box.x + box.width*0.32, y: box.y, width: box.width*0.5, height: box.height*0.42 }});

console.log('console errors:', JSON.stringify(errs));
await b.close(); srv.close();
