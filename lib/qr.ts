import QRCode from 'qrcode';
import { formatCode, normalizeCode } from '@/lib/codes';
import { SCHOOL } from '@/lib/content';

/**
 * Адрес сайта для QR-кодов. Берётся из NEXT_PUBLIC_SITE_URL (если задан при сборке),
 * иначе — адрес, с которого сейчас открыт сайт. В админке его можно поправить вручную.
 */
export function defaultSiteUrl(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (env) return env.replace(/\/+$/, '');
  if (typeof window === 'undefined') return '';
  return window.location.origin + window.location.pathname.replace(/\/[^/]*\.html$/, '').replace(/\/+$/, '');
}

/** Ссылка, которая сразу входит по коду (для QR на карточке ученика или учителя). */
export function codeLink(siteUrl: string, code: string): string {
  return `${siteUrl.replace(/\/+$/, '')}/?code=${formatCode(normalizeCode(code))}`;
}

/** QR в SVG. Уровень коррекции M: печатается мелко и всё равно читается любым телефоном. */
export function qrSvg(text: string, margin = 1): Promise<string> {
  return QRCode.toString(text, { type: 'svg', errorCorrectionLevel: 'M', margin, color: { dark: '#10240f', light: '#ffffff' } });
}

export function qrPng(text: string, width = 1024): Promise<string> {
  return QRCode.toDataURL(text, { errorCorrectionLevel: 'M', margin: 2, width, color: { dark: '#10240f', light: '#ffffff' } });
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

const PRINT_CSS = `
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Manrope,'Segoe UI',Arial,sans-serif;color:#15230f;background:#fff}
  .bar{padding:12px 16px;background:#f3f7e8;border-bottom:1px solid #cfdcae;display:flex;gap:12px;align-items:center;font-size:14px}
  .bar button{font:inherit;padding:8px 16px;border-radius:999px;border:0;background:#4c8a17;color:#fff;cursor:pointer}
  @media print{.bar{display:none}}
  @page{size:A4;margin:10mm}
`;

/** Лист A4 с карточками кодов: код крупно + QR, по которому телефон сразу входит на сайт с этим кодом. */
export async function printCodeCards(win: Window, siteUrl: string, codes: string[], title: string, label?: string) {
  const qrs = await Promise.all(codes.map((c) => qrSvg(codeLink(siteUrl, c), 0)));
  const host = esc(siteUrl.replace(/^https?:\/\//, ''));
  const cards = codes
    .map(
      (c, i) => `<div class="card">
        <div class="qr">${qrs[i]}</div>
        <div class="txt">
          <p class="t">${esc(title)}</p>
          <p class="code">${esc(formatCode(c))}</p>
          <p class="s">Наведите камеру телефона на QR-код — или откройте <b>${host}</b> и введите код.</p>
          ${label ? `<p class="l">${esc(label)}</p>` : ''}
        </div>
      </div>`,
    )
    .join('');
  win.document.open();
  win.document.write(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Коды — ${esc(SCHOOL.complex)}</title>
    <style>${PRINT_CSS}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:0;padding:0}
    .card{display:flex;gap:4mm;align-items:center;padding:5mm;border:1px dashed #9bb07a;break-inside:avoid;height:36mm}
    .qr{width:26mm;height:26mm;flex:none}.qr svg{width:100%;height:100%}
    .t{font-size:11px;color:#4c6a2a;font-weight:700}
    .code{font-size:20px;font-weight:800;letter-spacing:.06em;margin:1mm 0;font-family:'DejaVu Sans Mono',Consolas,monospace}
    .s{font-size:9.5px;color:#4d5a44;line-height:1.3}.l{font-size:10px;margin-top:1mm;font-weight:700}
    </style></head><body>
    <div class="bar"><button onclick="print()">Печать</button><span>${codes.length} шт. · Разрежьте по пунктиру. Один код — один цветок.</span></div>
    <div class="grid">${cards}</div></body></html>`);
  win.document.close();
}

/** Плакат A4 с QR-кодом сайта — повесить в школе или показать на экране. */
export async function printPoster(win: Window, siteUrl: string) {
  const svg = await qrSvg(siteUrl, 0);
  win.document.open();
  win.document.write(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>QR-код клумбы</title>
    <style>${PRINT_CSS}
    .poster{max-width:180mm;margin:12mm auto;text-align:center;padding:12mm;border:3px solid #f5b400;border-radius:10mm}
    h1{font-family:Lora,Georgia,serif;font-weight:600;font-size:34px;line-height:1.15}
    .lead{margin-top:4mm;font-size:17px;color:#4d5a44}
    .qr{width:120mm;height:120mm;margin:9mm auto}.qr svg{width:100%;height:100%}
    .url{font-size:22px;font-weight:800;color:#2f5a0f}.foot{margin-top:6mm;font-size:14px;color:#6d6650}
    </style></head><body>
    <div class="bar"><button onclick="print()">Печать</button><span>Плакат A4 с QR-кодом сайта</span></div>
    <div class="poster">
      <h1>🌷 Посади цветок для своего учителя!</h1>
      <p class="lead">Наведите камеру телефона на QR-код и введите код, который вам выдали.</p>
      <div class="qr">${svg}</div>
      <p class="foot">С Днём учителя! · ${esc(SCHOOL.complex)}, ${esc(SCHOOL.city)}</p>
    </div></body></html>`);
  win.document.close();
}

/**
 * Листы для волонтёров: сверху один QR-код сайта и короткая инструкция, ниже 30 талончиков с кодами (3 × 10).
 * Волонтёр держит лист, ученик сканирует QR, получает талончик и вводит код. Кодов больше 30 — несколько листов.
 */
export async function printVolunteerSheets(win: Window, siteUrl: string, codes: string[], label?: string) {
  const svg = await qrSvg(siteUrl, 0);
  const pages: string[][] = [];
  for (let i = 0; i < codes.length; i += 30) pages.push(codes.slice(i, i + 30));
  const sheet = (list: string[], n: number) => `<section class="sheet">
      <h1>Посади цветок для своего учителя!</h1>
      <p class="sub">С Днём учителя! · ${esc(SCHOOL.complex)}${label ? ` · ${esc(label)}` : ''}${pages.length > 1 ? ` · лист ${n}` : ''}</p>
      <div class="head">
        <div class="qr">${svg}</div>
        <ol>
          <li>Наведи камеру телефона на QR-код слева.</li>
          <li>На сайте нажми «Вход» и введи код со своего талончика.</li>
          <li>Выбери, кому посадить цветок, сам цветок, его цвет и место на клумбе.</li>
        </ol>
      </div>
      <p class="cut">Один талон — один человек</p>
      <div class="tickets">${list
        .map((c) => `<div class="t"><b>${esc(formatCode(c))}</b></div>`)
        .join('')}</div>
    </section>`;
  win.document.open();
  win.document.write(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Листы для волонтёров — ${esc(SCHOOL.complex)}</title>
    <style>${PRINT_CSS}
    .sheet{width:190mm;margin:0 auto;padding-top:2mm;break-after:page}
    .sheet:last-child{break-after:auto}
    h1{font-family:Georgia,serif;font-size:26px;color:#2f5a0f;text-align:center}
    .sub{text-align:center;color:#6d6650;font-size:13px;margin-top:1mm}
    .head{display:flex;gap:7mm;align-items:center;margin:5mm 0 3mm}
    .head .qr{width:48mm;height:48mm;flex:none}.head .qr svg{width:100%;height:100%}
    ol{padding-left:6mm;font-size:15px;line-height:1.45}ol li{margin-bottom:2mm}ol li::marker{color:#2f5a0f;font-weight:700}
    .cut{text-align:center;color:#6d6650;font-size:11px;margin-bottom:2mm}
    .tickets{display:grid;grid-template-columns:repeat(3,1fr)}
    .t{height:17.6mm;border:.5px solid #c9d3b4;background:#fffdf5;display:flex;align-items:center;justify-content:center}
    .t b{font-size:22px;letter-spacing:.06em;font-family:'DejaVu Sans Mono',Consolas,monospace}
    </style></head><body>
    <div class="bar"><button onclick="print()">Печать</button><span>${codes.length} ${codes.length === 1 ? 'код' : 'кодов'} · листов: ${pages.length}</span></div>
    ${pages.map((p, i) => sheet(p, i + 1)).join('')}</body></html>`);
  win.document.close();
}
