import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve('dist');
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg'};
const srv = http.createServer((q,s)=>{ let p=decodeURIComponent(q.url.split('?')[0]); const f=path.join(root,p); if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end();} s.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(s);}).listen(0);
const url = `http://localhost:${srv.address().port}/page.html?static`;
const b = await chromium.launch();
const p = await b.newPage({viewport:{width:1600,height:900}, reducedMotion: 'reduce'});
await p.goto(url); await p.waitForFunction('window.ready===true'); await p.waitForTimeout(500);
await p.evaluate(() => document.querySelector('#garden')?.scrollIntoView({ behavior: 'instant' }));
await p.waitForTimeout(400);
// zoom into the plane's static resting position inside the backdrop (translate(560px,235px) per prefers-reduced-motion rule)
const stage = await p.locator('.garden-backdrop').boundingBox();
await p.screenshot({path:'/tmp/shot6_plane_zoom.png', clip:{x: stage.x + 350, y: stage.y + 170, width: 500, height: 140}});
await b.close(); srv.close();
