import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve('dist');
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg'};
const srv = http.createServer((q,s)=>{ let p=decodeURIComponent(q.url.split('?')[0]); const f=path.join(root,p); if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end();} s.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(s);}).listen(0);
const url = `http://localhost:${srv.address().port}/page.html?static`;
const b = await chromium.launch();

async function run(label, injectCss) {
  const ctx = await b.newContext({viewport:{width:390,height:844}, hasTouch:true, isMobile:true, deviceScaleFactor: 3});
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await p.goto(url); await p.waitForFunction('window.ready===true');
  if (injectCss) await p.addStyleTag({ content: injectCss });
  await p.waitForTimeout(500);

  const resultPromise = p.evaluate(() => new Promise((resolve) => {
    const frameTimes = []; let last = performance.now();
    function tick() {
      const now = performance.now();
      frameTimes.push(now - last); last = now;
      if (now < window.__perfStart + 4000) requestAnimationFrame(tick); else resolve(frameTimes);
    }
    window.__perfStart = performance.now();
    requestAnimationFrame(tick);
  }));
  await p.waitForTimeout(200);
  await p.evaluate(() => window.scrollTo({ top: 0 }));
  await p.mouse.move(195, 400);
  for (let i = 0; i < 25; i++) { await p.mouse.wheel(0, 140); await p.waitForTimeout(60); }
  const frameTimes = await resultPromise;
  const over16 = frameTimes.filter(t => t > 16.7).length;
  const over33 = frameTimes.filter(t => t > 33.4).length;
  const worst = Math.max(...frameTimes);
  console.log(`${label}: frames ${frameTimes.length}, dropped(>16.7ms) ${over16}, janky(>33ms) ${over33}, worst ${worst.toFixed(1)}ms`);
  await ctx.close();
}

await run('baseline', null);
await run('no backdrop-filter anywhere', `* { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }`);
await run('no sun blur/pulse/spin', `.hero__sun-rays, .hero__sun-core { animation: none !important; filter: none !important; } .hero__sun::before { display:none !important; }`);
await run('no leaves', `.hero__leaves { display: none !important; }`);
await run('everything disabled', `
  * { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
  .hero__sun-rays, .hero__sun-core { animation: none !important; filter: none !important; }
  .hero__leaves { display: none !important; }
`);
await run('no noise/mix-blend-mode layer', `.site::after { display: none !important; }`);
await run('fixed bg -> absolute (no fixed attachment)', `.site::before, .site::after { position: absolute !important; }`);
await run('ALL fixes combined', `
  * { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
  .hero__sun-rays, .hero__sun-core { animation: none !important; filter: none !important; }
  .hero__leaves { display: none !important; }
  .site::after { display: none !important; }
  .site::before { position: absolute !important; }
`);

await b.close(); srv.close();
