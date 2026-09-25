import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve('dist');
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg'};
const srv = http.createServer((q,s)=>{ let p=decodeURIComponent(q.url.split('?')[0]); const f=path.join(root,p); if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end();} s.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(s);}).listen(0);
const url = `http://localhost:${srv.address().port}/page.html?static`;
const b = await chromium.launch();

async function measure(label, throttle, scrollTo) {
  const ctx = await b.newContext({viewport:{width:390,height:844}, hasTouch:true, isMobile:true, deviceScaleFactor: 3});
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  await p.goto(url); await p.waitForFunction('window.ready===true');
  await p.waitForTimeout(600);
  if (scrollTo) {
    await p.evaluate((sel) => document.querySelector(sel)?.scrollIntoView({behavior:'instant', block:'center'}), scrollTo);
    await p.waitForTimeout(600);
  }
  // measure rAF-based fps over 3s, plus long-task count via PerformanceObserver
  const result = await p.evaluate(() => new Promise((resolve) => {
    let frames = 0;
    let longTasks = 0;
    let longTaskTotal = 0;
    const obs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) { longTasks++; longTaskTotal += entry.duration; }
    });
    try { obs.observe({ entryTypes: ['longtask'] }); } catch {}
    const start = performance.now();
    function tick() {
      frames++;
      if (performance.now() - start < 3000) requestAnimationFrame(tick);
      else {
        obs.disconnect();
        resolve({ frames, elapsed: performance.now() - start, longTasks, longTaskTotal });
      }
    }
    requestAnimationFrame(tick);
  }));
  const fps = (result.frames / (result.elapsed/1000)).toFixed(1);
  console.log(`${label}: ${fps} fps  | long tasks: ${result.longTasks} totaling ${result.longTaskTotal.toFixed(0)}ms`);
  await ctx.close();
}

await measure('hero (idle, 4x throttle)', 4, null);
await measure('garden scrolled into view (idle, 4x throttle)', 4, '#garden-stage');
await measure('how-it-works scrolled (idle, 4x throttle)', 4, '#how');

await b.close(); srv.close();
