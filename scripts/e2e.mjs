// Сквозная проверка сайта в браузере. Нужен Playwright: npm i -D playwright. Как запускать — в README.
import { chromium } from 'playwright';
import fs from 'node:fs';
const BASE = process.env.BASE || 'http://localhost:3005';
const PW = process.env.PW || 'Подсолнух2026';
const DEMO = !!process.env.DEMO;
const S = 'e2e-shots/';
fs.mkdirSync(S, { recursive: true });
const b = await chromium.launch();
const errs = [];
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const watch = (p) => { p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message)); };
const openLogin = async (p) => { await p.click('.nav__actions button'); await p.waitForSelector('dialog[open] input.field__input--code'); };
const submit = async (p, code) => { await p.fill('dialog[open] input.field__input--code', code); await p.click('dialog[open] button[type=submit]'); await p.waitForTimeout(900); };
const toGarden = async (p) => { await p.evaluate(() => document.getElementById('garden-stage').scrollIntoView({ block: 'center' })); await p.waitForTimeout(600); };

const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage(); watch(p);
await p.goto(BASE); await p.waitForSelector('.garden__count strong'); await p.waitForTimeout(1200);
await p.screenshot({ path: S + '01_hero.png' });
await toGarden(p);
// самолёт: ждём, пока влетит
await p.evaluate(() => document.getAnimations().forEach((a) => { if (a.animationName === 'gb-track' || a.animationName === 'gb-self') a.currentTime = 42000 * 0.3; }));
await p.waitForTimeout(400);
await p.screenshot({ path: S + '02_garden_plane.png' });
const plane = await p.locator('.gb-plane__img').boundingBox();
ok(plane && plane.x > 0 && plane.x < 1280, 'самолёт виден на сцене');
ok(await p.locator('.gb-banner textPath').textContent() === 'С Днём учителя!', 'надпись на флаге не изменилась');
ok(await p.locator('.gb-banner animate').count() > 0, 'флаг анимирован (волна)');

// наведение на центральный подсолнух
const st = await p.locator('#garden-stage').boundingBox();
await p.mouse.move(st.x + st.width / 2, st.y + st.height * 0.33);
await p.waitForTimeout(300);
const tipText = await p.locator('.garden__tip').textContent().catch(() => '');
ok(tipText.includes('Дмитриева Любовь Валентиновна'), 'центральный подсолнух — директора: ' + tipText);
await p.screenshot({ path: S + '03_tip_director.png', clip: { x: st.x, y: st.y, width: st.width, height: st.height * 0.6 } });
// наведение на обычный цветок
let found = false;
for (let dx = -300; dx <= 300 && !found; dx += 9) for (let dy = 0.45; dy <= 0.8 && !found; dy += 0.05) {
  await p.mouse.move(st.x + st.width / 2 + dx, st.y + st.height * dy);
  const t = await p.locator('.garden__tip').count();
  if (t) { const tx = await p.locator('.garden__tip').textContent(); if (!tx.includes('Дмитриева')) found = true; }
}
ok(found, 'подсказка над обычным цветком');
const color = await p.locator('.garden__tip strong').evaluate((e) => getComputedStyle(e).color).catch(() => '');
ok(color === 'rgb(30, 22, 9)', 'имя в подсказке тёмное на светлом фоне: ' + color);
await p.screenshot({ path: S + '04_tip.png' });
await p.mouse.move(5, 5);

// учитель: код вставлен с двойным дефисом и пробелами (так раньше показывала админка)
await openLogin(p);
await submit(p, '  JHMN9--3YKAH  ');
ok(await p.locator('.postcard').count() === 1, 'вход учителя по коду с лишними дефисами и пробелами');
await p.click('.postcard .btn--lime'); await p.waitForTimeout(2200);
ok((await p.locator('.pc-card__text').textContent()).includes('математика'), 'открытка учителя открылась');
await p.click('dialog[open] .link-button'); await p.waitForTimeout(300);

// директор: отдельный вход
await p.evaluate(() => document.getElementById('how').scrollIntoView());
await p.click('.director-link'); await p.waitForTimeout(300);
ok((await p.locator('dialog[open] .dialog__title').textContent()).includes('директора'), 'отдельное окно входа для директора');
await p.fill('dialog[open] input.field__input--code', 'dmtrw-ahjk4');
await p.click('dialog[open] button[type=submit]'); await p.waitForTimeout(900);
ok(await p.locator('.postcard--director').count() === 1, 'золотая открытка директора');
await p.click('.postcard .btn--lime'); await p.waitForTimeout(2300);
await p.screenshot({ path: S + '05_director_card.png' });
ok((await p.locator('.pc-card__text').textContent()).includes('подсолнух'), 'персональное поздравление директора');
await p.click('.postcard__buttons .btn--lime'); await p.waitForTimeout(1500);
await p.screenshot({ path: S + '06_director_sunflower.png' });
await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(1500);

// ученик по ссылке с кодом (как из QR)
const ctx2 = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const m = await ctx2.newPage(); watch(m);
await m.goto(BASE + '/?code=M4NTF-E43AD'); await m.waitForTimeout(1800);
ok(!m.url().includes('code='), 'код убран из адреса');
ok((await m.locator('dialog[open] .dialog__title').textContent().catch(() => '')).includes('Вы вошли'), 'вход ученика по ссылке ?code=');
await m.click('dialog[open] .btn--lime'); await m.waitForTimeout(900);
await m.locator('.teacher-opt').nth(2).click();
const nFlowers = await m.locator('.flower-opt').count();
ok(nFlowers >= 5, 'выбор цветов для учителя: ' + nFlowers);
await m.locator('.flower-opt').nth(7).click();
await m.locator('.swatch').nth(10).click();
await m.screenshot({ path: S + '07_mobile_choose.png', fullPage: false });
await m.click('.plant__preview .btn--lime'); await m.waitForTimeout(1500);
// выбор места: коснуться светящейся точки
const box = await m.locator('#garden-stage').boundingBox();
const slot = await m.evaluate(() => 1);
let placed = false;
for (let i = 0; i < 40 && !placed; i++) {
  await m.touchscreen.tap(box.x + 40 + (i % 8) * 40, box.y + 150 + Math.floor(i / 8) * 30);
  await m.waitForTimeout(150);
  placed = !(await m.locator('.placebar .btn--lime').isDisabled());
}
ok(placed, 'место выбрано');
await m.click('.placebar .btn--lime'); await m.waitForTimeout(400);
await m.click('dialog[open] .btn--lime'); await m.waitForTimeout(2200);
ok((await m.locator('dialog[open] .thanks').count()) === 1, 'благодарность после посадки');
await m.screenshot({ path: S + '08_thanks.png' });
await m.click('dialog[open] .thanks .btn--lime'); await m.waitForTimeout(1200);
await m.screenshot({ path: S + '09_after_plant.png' });

// админ: удаление учителя с цветами; вторая вкладка должна увидеть, что цветы пропали
const before = Number(await m.locator('.garden__count strong').textContent());
await openLogin(p);
await submit(p, PW);
ok(await p.locator('.admin-tab').count() === 1, 'вход администратора');
await p.click('.admin-tabs button:nth-child(2)'); await p.waitForTimeout(700);
await p.screenshot({ path: S + '10_admin_teachers.png' });
ok(await p.locator('.admin-teacher-row--director [aria-label^="Удалить"]').count() === 0, 'директора удалить нельзя');
const row = p.locator('.admin-teacher-row', { hasText: 'Петрова' });
await row.locator('[aria-label^="Удалить"]').click();
const confirmTxt = await row.locator('.admin-teacher-row__confirm').textContent();
ok(/вместе с \d+/.test(confirmTxt), 'предупреждение: ' + confirmTxt);
await row.locator('button', { hasText: 'Да' }).click(); await p.waitForTimeout(800);
const notice = await p.locator('.admin-notice').textContent();
ok(/Удалено: Петрова.*\d+ цвет/.test(notice), notice);
const pageToCheck = DEMO ? p : m;
if (DEMO) await p.click('.modal--admin .modal__close');
await pageToCheck.waitForTimeout(5500);
const after = Number(await pageToCheck.locator('.garden__count strong').textContent());
if (!DEMO) ok(after < before, `вторая вкладка: цветов было ${before}, стало ${after}`);
else ok(after < 420, `цветов после удаления: ${after}`);
ok(!(await pageToCheck.locator('.legend').textContent()).includes('Петрова'), 'удалённый учитель пропал из легенды');
if (DEMO) { await p.click('.nav__actions button'); await p.waitForTimeout(500); }

// код учителя из админки → вход
const r2 = p.locator('.admin-teacher-row', { hasText: 'Иванов' });
await r2.locator('[aria-label^="Новый код"]').click(); await p.waitForTimeout(600);
const code = (await p.locator('.admin-code-reveal strong').textContent()).trim();
ok(/^[A-Z0-9]{5}-[A-Z0-9]{5}$/.test(code), 'код учителя показан без двойного дефиса: ' + code);
// QR
await p.click('.admin-tabs button:nth-child(4)'); await p.waitForTimeout(700);
ok(await p.locator('.admin-qr img').count() === 1, 'QR-код сайта');
await p.screenshot({ path: S + '11_admin_qr.png' });
await p.click('.admin-logout'); await p.waitForTimeout(400);
await openLogin(p); await submit(p, code);
ok(await p.locator('.postcard').count() === 1, 'вход по новому коду из админки');

console.log('console errors:', errs.length ? errs : 'нет');
console.log(fails ? `FAILED: ${fails}` : 'ALL OK');
await b.close();
