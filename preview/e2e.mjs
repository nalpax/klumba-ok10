import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve('dist');
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg'};
const srv = http.createServer((q,s)=>{ let p=decodeURIComponent(q.url.split('?')[0]); const f=path.join(root,p); if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end();} s.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(s);}).listen(0);
const url = `http://localhost:${srv.address().port}/page.html?static`;
fs.mkdirSync('/tmp/e2e', {recursive:true});
const b = await chromium.launch();
const errs=[];
const log = (...a)=>console.log(...a);
const ok = (c, msg)=>{ log((c?'PASS ':'FAIL ')+msg); if(!c) process.exitCode=1; };

async function openPage(viewport) {
  const ctx = await b.newContext({viewport, hasTouch: viewport.width<600, isMobile: viewport.width<600, deviceScaleFactor: 1});
  const p = await ctx.newPage();
  p.on('console',m=>{if(['error','warning'].includes(m.type())) errs.push(m.text())}); p.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
  await p.goto(url); await p.waitForFunction('window.ready===true'); await p.waitForTimeout(700);
  return p;
}
async function login(p, code) {
  await p.click('.nav__actions button');
  await p.waitForSelector('dialog[open] input.field__input--code');
  await p.fill('input.field__input--code', code);
  await p.click('dialog[open] button[type=submit]');
}

/* ---------------- DESKTOP ---------------- */
{
  const p = await openPage({width:1440,height:900});
  await p.screenshot({path:'/tmp/e2e/d01_hero.png'});
  ok((await p.textContent('.nav__actions button')).includes('Вход'), 'header has «Вход» (desktop)');
  const steps = await p.$$eval('.step h3', els=>els.map(e=>e.textContent));
  log('steps:', JSON.stringify(steps));
  ok(steps.length===4 && steps[0]==='Получи свой код' && steps[1]==='Войди в аккаунт по коду' && steps[2]==='Выбери цвет, учителя и цветок' && steps[3]==='Посади на клумбе', 'how-it-works has exactly the 4 requested steps');
  const howText = await p.textContent('#how');
  ok(!/одноразов|один код|нельзя/i.test(howText), 'no code-mechanics text in «Как это работает»');
  await p.locator('#how').scrollIntoViewIfNeeded(); await p.waitForTimeout(400);
  await p.screenshot({path:'/tmp/e2e/d02_how.png'});

  // wrong code
  await login(p, 'ZZZZZ-00000');
  await p.waitForTimeout(500);
  log('error text:', await p.textContent('dialog[open] .form-error'));
  ok((await p.textContent('dialog[open] .form-error')).includes('Код состоит'), 'wrong-shape code rejected on client');
  await p.fill('input.field__input--code','');
  await p.fill('input.field__input--code','AAAAA-AAAAA'); await p.click('dialog[open] button[type=submit]'); await p.waitForTimeout(700);
  ok((await p.textContent('dialog[open] .form-error')).includes('Код не найден'), 'unknown code → «Код не найден»');
  await p.screenshot({path:'/tmp/e2e/d03_login_error.png'});

  // student, typed sloppily: lowercase + space + Cyrillic lookalikes (М, Т, Н → M, T, H in the code M4NTF)
  await p.fill('input.field__input--code','м4nтf e43ad'); // Cyrillic м, т
  const shown = await p.inputValue('input.field__input--code');
  ok(shown==='M4NTF-E43AD', 'input normalises case/space/Cyrillic lookalikes → '+shown);
  await p.click('dialog[open] button[type=submit]'); await p.waitForTimeout(800);
  ok((await p.textContent('dialog[open] .dialog__title')).includes('Вы вошли'), 'student logged in');
  await p.screenshot({path:'/tmp/e2e/d04_student_in.png'});
  await p.click('dialog[open] >> text=Посадить цветок'); await p.waitForTimeout(900);
  ok(await p.isVisible('#plant .plant__grid'), 'planting panel visible after login');
  ok((await p.textContent('.nav__actions button')).includes('Кабинет'), 'header button becomes «Кабинет»');

  // panel: full teacher names with patronymic
  const names = await p.$$eval('.teacher-opt strong', els=>els.map(e=>e.textContent));
  log('teachers:', JSON.stringify(names.slice(0,3)));
  ok(names.every(n=>n.split(' ').length===3), 'every teacher shown as Фамилия Имя Отчество');
  const flowersBefore = await p.$$('.flower-opt');
  ok(flowersBefore.length===0, 'no flowers before a teacher is chosen');
  await p.click('.teacher-opt:has-text("Петрова Мария Сергеевна")'); await p.waitForTimeout(300);
  const flowerNames = await p.$$eval('.flower-opt__card span', els=>els.map(e=>e.textContent));
  log('flowers for Петрова:', JSON.stringify(flowerNames));
  ok(flowerNames.length===3, 'flower list limited to the teacher’s allowed flowers');
  await p.click('.flower-opt:has-text("Ромашка")'); await p.waitForTimeout(200);
  await p.click('.swatch:nth-child(10) .swatch__dot'); await p.waitForTimeout(300);
  ok((await p.textContent('.plant__color-name'))==='Синий', 'color choice reflected: '+await p.textContent('.plant__color-name'));
  const summary = await p.textContent('.plant__summary');
  log('summary:', summary);
  ok(summary.startsWith("Синяя ромашка"), "grammar: «Синяя ромашка»");
  await p.locator('#plant').scrollIntoViewIfNeeded(); await p.evaluate(()=>window.scrollBy(0,-70)); await p.waitForTimeout(300);
  await p.screenshot({path:'/tmp/e2e/d05_panel.png'});

  // place picking
  await p.click('text=Выбрать место на клумбе'); await p.waitForTimeout(1500);
  ok(await p.isVisible('.placebar'), 'place bar visible');
  ok((await p.$eval('.placebar .btn--lime', e=>e.disabled))===true, '«Посадить здесь» disabled until a spot is chosen');
  await p.screenshot({path:'/tmp/e2e/d06_pick.png'});
  const box = await p.locator('.garden__canvas').boundingBox();
  let chosen=false;
  for (const [fx,fy] of [[.35,.72],[.42,.78],[.3,.65],[.6,.75]]) {
    await p.mouse.click(box.x+box.width*fx, box.y+box.height*fy); await p.waitForTimeout(200);
    if (!(await p.$eval('.placebar .btn--lime', e=>e.disabled))) { chosen=true; break; }
  }
  ok(chosen, 'clicking the garden chooses a free spot');
  await p.screenshot({path:'/tmp/e2e/d07_ghost.png', clip:{x:box.x,y:box.y,width:box.width,height:box.height}});
  await p.click('.placebar .btn--lime'); await p.waitForTimeout(400);
  const confirmText = await p.textContent('dialog[open] .confirm');
  log('confirm:', confirmText.replace(/\s+/g,' '));
  ok(confirmText.includes("Синяя ромашка") && confirmText.includes('Петрова Мария Сергеевна') && confirmText.includes('невозможно'), 'confirm dialog summarises choice and warns');
  await p.screenshot({path:'/tmp/e2e/d08_confirm.png'});
  const before = Number(await p.textContent('.garden__count strong'));
  await p.click('dialog[open] button:text-is("Посадить")'); await p.waitForTimeout(2600);
  const after = Number(await p.textContent('.garden__count strong'));
  ok(after===before+1, `count ${before} → ${after}`);
  ok((await p.textContent('#plant')).includes('Ваш цветок уже растёт'), 'panel switches to «уже растёт»');
  await p.evaluate(()=>document.querySelector('#garden-stage').scrollIntoView({block:'center'})); await p.waitForTimeout(700);
  await p.screenshot({path:'/tmp/e2e/d09_planted.png'});

  // relogin same code is now "used"
  await p.click('.nav__actions button'); await p.waitForTimeout(300);
  ok((await p.textContent('dialog[open] .dialog__title')).includes('уже на клумбе'), 'cabinet shows planted state');
  await p.click('dialog[open] >> text=Выйти'); await p.waitForTimeout(300);
  ok((await p.textContent('.nav__actions button')).includes('Вход'), 'logout restores «Вход»');

  // teacher + postcard
  await login(p, 'JHMN9-3YKAH'); await p.waitForTimeout(900);
  ok(await p.isVisible('dialog[open] .postcard--closed'), 'teacher sees closed postcard');
  const html0 = await p.content();
  ok(!html0.includes('умеете объяснять сложное'), 'real wish text NOT in DOM before opening');
  ok(await p.isVisible('dialog[open] .pc-card__text'), 'blurred text is present');
  const blur0 = await p.$eval('.pc-card__text', e=>getComputedStyle(e).filter);
  log('blur before:', blur0); ok(blur0.includes('blur'), 'text is blurred before opening');
  await p.screenshot({path:'/tmp/e2e/d10_card_closed.png'});
  await p.click('dialog[open] >> text=Открыть открытку'); await p.waitForTimeout(650);
  await p.screenshot({path:'/tmp/e2e/d11_card_mid.png'});
  await p.waitForTimeout(2600);
  const html1 = await p.content();
  ok(html1.includes('умеете объяснять сложное'), 'real wish text appears after opening');
  const blur1 = await p.$eval('.pc-card__text', e=>getComputedStyle(e).filter);
  ok(blur1==='none', 'blur removed after opening');
  await p.screenshot({path:'/tmp/e2e/d12_card_open.png'});
  await p.click('dialog[open] >> text=Показать мои цветы'); await p.waitForTimeout(1600);
  ok(await p.isVisible('.focus-chip'), 'focus chip shown for teacher flowers');
  await p.evaluate(()=>document.querySelector('#garden-stage').scrollIntoView({block:'center'})); await p.waitForTimeout(500);
  await p.screenshot({path:'/tmp/e2e/d13_focus.png'});
  ok(!(await p.isVisible('dialog[open]')), 'dialog closed');

  // tooltip shows teacher's full name
  await p.click('.focus-chip button'); await p.waitForTimeout(300);
  let tip=null; const b2 = await p.locator('.garden__canvas').boundingBox();
  for (let dx=-260; dx<=260 && !tip; dx+=11) for (let dy=-120; dy<=220 && !tip; dy+=11) {
    await p.mouse.move(b2.x+b2.width/2+dx, b2.y+b2.height/2+dy);
    const t = await p.$('.garden__tip'); if (t) tip = await t.innerText();
  }
  log('tooltip:', JSON.stringify(tip));
  ok(tip && /^[А-ЯЁ][а-яё]+ [А-ЯЁ][а-яё]+ [А-ЯЁ][а-яё]+\n/.test(tip), 'tooltip starts with teacher’s Фамилия Имя Отчество');
  // used-code re-plant attempt & already used
  await p.click('.nav__actions button'); await p.click('dialog[open] >> text=Выйти');
  await login(p, 'M4NTF-E43AD'); await p.waitForTimeout(900);
  ok((await p.textContent('dialog[open] .dialog__title')).includes('уже на клумбе'), 'used student code shows planted state on login');
  await p.close();
}

/* ---------------- MOBILE ---------------- */
{
  const p = await openPage({width:390,height:844});
  await p.screenshot({path:'/tmp/e2e/m01_hero.png'});
  ok(await p.isVisible('.nav__actions button'), 'header «Вход» visible on mobile');
  const ov = await p.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);
  ok(!ov, 'no horizontal overflow (mobile)');
  await p.locator('#how').scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
  await p.screenshot({path:'/tmp/e2e/m02_how.png'});
  await login(p, 'EN4NX-W7TKA'); await p.waitForTimeout(900);
  await p.screenshot({path:'/tmp/e2e/m03_dialog.png'});
  await p.click('dialog[open] >> text=Посадить цветок'); await p.waitForTimeout(1000);
  await p.click('.teacher-opt:has-text("Кузнецов")'); await p.click('.flower-opt:has-text("Подсолнух")'); await p.click('.swatch:nth-child(6) .swatch__dot');
  await p.waitForTimeout(300);
  await p.locator('#plant').scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
  await p.screenshot({path:'/tmp/e2e/m04_panel.png'});
  await p.screenshot({path:'/tmp/e2e/m04b_panel_full.png', fullPage:false});
  await p.click('text=Выбрать место на клумбе'); await p.waitForTimeout(1800);
  await p.screenshot({path:'/tmp/e2e/m05_pick.png'});
  const box = await p.locator('.garden__canvas').boundingBox();
  await p.touchscreen.tap(box.x+box.width*0.5, box.y+box.height*0.62); await p.waitForTimeout(300);
  await p.screenshot({path:'/tmp/e2e/m06_ghost.png'});
  await p.evaluate(()=>{document.querySelector('.nav__actions button')?.blur();});
  await p.click('.nav__actions button'); await p.waitForTimeout(300);
  await p.click('dialog[open] >> text=Выйти'); await p.waitForTimeout(300);
  await login(p, '3Y9FW-7PRKM'); await p.waitForTimeout(900);
  await p.screenshot({path:'/tmp/e2e/m07_card_closed.png'});
  await p.click('dialog[open] >> text=Открыть открытку'); await p.waitForTimeout(3600);
  await p.screenshot({path:'/tmp/e2e/m08_card_open.png'});
  await p.close();
}
console.log('console errors/warnings:', JSON.stringify(errs));
await b.close(); srv.close();
