import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve('dist');
const mime = {'.html':'text/html','.js':'text/javascript','.webp':'image/webp'};
const srv = http.createServer((q,s)=>{ let p=q.url.split('?')[0]; const f=path.join(root,p); if(!fs.existsSync(f)){s.writeHead(404);return s.end();} s.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(s);}).listen(0);
const b = await chromium.launch(); const p = await b.newPage({viewport:{width:600,height:400}});
await p.setContent('<body style="margin:0;background:#07100a"><canvas id="c" style="display:block;width:600px;height:400px"></canvas>');
await p.goto(`http://localhost:${srv.address().port}/garden-test.html?n=0`);
await p.addStyleTag({content:'#c{width:600px!important;height:400px!important}'});
await p.waitForFunction('window.ready===true'); await p.waitForTimeout(400);
const kinds=['tulip','rose','poppy','daisy','cornflower','sunflower'];
const colors=['#E03131','#D6337F','#E03131','#F4F1E8','#2F7CD8','#F4C20D'];
const frames=[0.08,0.2,0.35,0.5,0.7,0.85,1.0];
for (let k=0;k<kinds.length;k+=1){
  await p.evaluate(({k,colors})=>{ const r=window.r; window.requestAnimationFrame=()=>0; r.raf=1; r.setPlantings([]); r.zoomBy(2.6, 300, 250);
    const id=100+k; r.add({id,teacherId:1,flowerId:k+1,color:colors[k],x:0.5,y:0.72,scale:1.15,rotation:0,variant:0,createdAt:Date.now()}, true); window.__id=id; window.__start=r.growing.get(id); }, {k,colors});
  for (let i=0;i<frames.length;i++){
    await p.evaluate((t)=>{ window.r.draw(window.__start + t*1500); }, frames[i]);
    await p.screenshot({path:`/tmp/g_${k}_${i}.png`, clip:{x:200,y:60,width:200,height:290}});
  }
}
await b.close(); srv.close();
