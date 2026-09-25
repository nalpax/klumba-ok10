import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve('dist');
const mime = {'.html':'text/html','.js':'text/javascript','.webp':'image/webp'};
const srv = http.createServer((q,s)=>{ let p=q.url.split('?')[0]; const f=path.join(root,p); if(!fs.existsSync(f)){s.writeHead(404);return s.end();} s.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(s);}).listen(0);
const b = await chromium.launch(); const p = await b.newPage({viewport:{width:1200,height:680}});
await p.goto(`http://localhost:${srv.address().port}/garden-test.html?n=300`);
await p.waitForFunction('window.ready===true'); await p.waitForTimeout(500);
await p.evaluate(()=>{ window.r.zoomBy(3.6, 600, 492); });
await p.waitForTimeout(200);
await p.evaluate(()=>{ const r=window.r; r.add({id:99999,teacherId:1,flowerId:1,color:'#E03131',x:0.5,y:825/1100,scale:1.1,rotation:0,variant:0,createdAt:Date.now()}, true); r.highlightPlanting(99999, 4000); });
const times=[120,420,420,420,700]; let acc=0;
for (let i=0;i<times.length;i++){ await p.waitForTimeout(times[i]); acc+=times[i]; await p.screenshot({path:`/tmp/anim_${i}.png`, clip:{x:400,y:230,width:400,height:330}}); }
await b.close(); srv.close();
