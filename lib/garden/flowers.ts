import { darken, lighten, mix, rgba } from './color';
import type { FlowerKind } from './types';

type Ctx = CanvasRenderingContext2D;

export interface KindSpec {
  label: string;
  /** род существительного — чтобы писать «красная роза», «красный тюльпан» */
  gender: 'm' | 'f';
  /** высота стебля в единицах спрайта */
  stemH: number;
  /** радиус головки — используется для попадания курсором */
  headR: number;
}

export const KIND_SPECS: Record<FlowerKind, KindSpec> = {
  tulip: { label: 'Тюльпан', gender: 'm', stemH: 64, headR: 20 },
  rose: { label: 'Роза', gender: 'f', stemH: 58, headR: 16 },
  poppy: { label: 'Мак', gender: 'm', stemH: 66, headR: 19 },
  daisy: { label: 'Ромашка', gender: 'f', stemH: 54, headR: 18 },
  cornflower: { label: 'Василёк', gender: 'm', stemH: 70, headR: 16 },
  sunflower: { label: 'Подсолнух', gender: 'm', stemH: 78, headR: 22 },
};

/** Красный → красная (для женского рода), Синий → синяя. */
export function colorAdjective(name: string, gender: 'm' | 'f'): string {
  if (gender === 'm') return name;
  if (name.endsWith('ий')) return `${name.slice(0, -2)}яя`;
  if (name.endsWith('ый') || name.endsWith('ой')) return `${name.slice(0, -2)}ая`;
  return name;
}

/** «красная роза», «синий василёк» */
export function describeFlower(colorName: string, kind: FlowerKind, flowerName: string): string {
  return `${colorAdjective(colorName, KIND_SPECS[kind].gender).toLowerCase()} ${flowerName.toLowerCase()}`;
}

/** Наклон верхушки стебля для двух вариантов спрайта. */
export function leanFor(sv: number): number {
  return sv === 0 ? -3 : 4;
}

const TAU = Math.PI * 2;

/* ------------------------------------------------------------------ */
/* Стебли и листья                                                     */
/* ------------------------------------------------------------------ */

function stemPoint(h: number, lean: number, t: number): { x: number; y: number } {
  const u = 1 - t;
  return {
    x: 2 * u * t * (-lean * 0.5) + t * t * lean,
    y: 2 * u * t * (-h * 0.5) + t * t * -h,
  };
}

function stem(ctx: Ctx, h: number, lean: number, width: number) {
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-lean * 0.5, -h * 0.5, lean, -h);
  const g = ctx.createLinearGradient(0, 0, 0, -h);
  g.addColorStop(0, '#1d6a2c');
  g.addColorStop(1, '#63b43f');
  ctx.strokeStyle = g;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.stroke();
}

/** Лист: угол 0 — вверх, положительный — вправо. curl смещает кончик вбок. */
function leaf(
  ctx: Ctx,
  x: number,
  y: number,
  angle: number,
  len: number,
  wid: number,
  curl: number,
  tone = 0,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(wid, -len * 0.25, wid * 0.9 + curl, -len * 0.7, curl, -len);
  ctx.bezierCurveTo(-wid * 0.5 + curl * 0.6, -len * 0.65, -wid * 0.75, -len * 0.25, 0, 0);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 0, curl, -len);
  g.addColorStop(0, mix('#1a5a29', '#3a7a20', tone));
  g.addColorStop(0.55, mix('#2e8b3a', '#5f9a2a', tone));
  g.addColorStop(1, mix('#7ac74a', '#a5d05a', tone));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(8,40,14,0.35)';
  ctx.lineWidth = 0.6;
  ctx.stroke();
  // прожилка
  ctx.beginPath();
  ctx.moveTo(0, -1);
  ctx.quadraticCurveTo(curl * 0.35, -len * 0.5, curl * 0.95, -len * 0.92);
  ctx.strokeStyle = 'rgba(210,245,160,0.45)';
  ctx.lineWidth = 0.7;
  ctx.stroke();
  ctx.restore();
}

/** Стебель и листья (без головки). Начало координат — основание стебля. */
export function paintBody(ctx: Ctx, kind: FlowerKind, sv: number): void {
  const { stemH: h } = KIND_SPECS[kind];
  const lean = leanFor(sv);
  const m = sv === 0 ? 1 : -1;

  switch (kind) {
    case 'tulip':
      leaf(ctx, 0, -1, -0.46 * m, 62, 7.5, -10 * m);
      leaf(ctx, 0, -1, 0.38 * m, 54, 7, 9 * m, 0.2);
      leaf(ctx, 0, -1, -0.1 * m, 44, 5, -3 * m, 0.1);
      stem(ctx, h, lean, 2.8);
      break;
    case 'rose': {
      leaf(ctx, 0, -1, -0.7 * m, 26, 6, -4 * m);
      leaf(ctx, 0, -1, 0.6 * m, 22, 5, 4 * m, 0.2);
      stem(ctx, h, lean, 2.5);
      const p1 = stemPoint(h, lean, 0.42);
      const p2 = stemPoint(h, lean, 0.66);
      leaf(ctx, p1.x, p1.y, 1.05 * m, 22, 8, 3 * m, 0.1);
      leaf(ctx, p2.x, p2.y, -1.0 * m, 20, 7.5, -3 * m, 0.25);
      break;
    }
    case 'poppy':
      leaf(ctx, 0, -1, -0.62 * m, 36, 6, -6 * m, 0.45);
      leaf(ctx, 0, -1, 0.5 * m, 32, 5.5, 6 * m, 0.5);
      stem(ctx, h, lean, 2.2);
      leaf(ctx, stemPoint(h, lean, 0.45).x, stemPoint(h, lean, 0.45).y, 0.9 * m, 18, 4, 3 * m, 0.5);
      break;
    case 'daisy':
      leaf(ctx, 0, -1, -0.75 * m, 26, 4.5, -4 * m, 0.15);
      leaf(ctx, 0, -1, 0.05, 28, 4, 1, 0.1);
      leaf(ctx, 0, -1, 0.7 * m, 24, 4.5, 4 * m, 0.2);
      stem(ctx, h, lean, 2.2);
      break;
    case 'cornflower': {
      leaf(ctx, 0, -1, -0.5 * m, 38, 2.8, -3 * m, 0.55);
      leaf(ctx, 0, -1, 0.42 * m, 34, 2.6, 3 * m, 0.6);
      stem(ctx, h, lean, 1.9);
      const p1 = stemPoint(h, lean, 0.45);
      const p2 = stemPoint(h, lean, 0.7);
      leaf(ctx, p1.x, p1.y, 1.1 * m, 17, 2.2, 2 * m, 0.6);
      leaf(ctx, p2.x, p2.y, -1.05 * m, 15, 2, -2 * m, 0.6);
      break;
    }
    case 'sunflower': {
      leaf(ctx, 0, -1, -0.6 * m, 30, 7, -4 * m, 0.1);
      leaf(ctx, 0, -1, 0.55 * m, 26, 6.5, 4 * m, 0.2);
      stem(ctx, h, lean, 3.6);
      const p1 = stemPoint(h, lean, 0.4);
      const p2 = stemPoint(h, lean, 0.62);
      leaf(ctx, p1.x, p1.y, 1.2 * m, 32, 15, 4 * m, 0.05);
      leaf(ctx, p2.x, p2.y, -1.15 * m, 28, 13, -4 * m, 0.15);
      break;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Головки                                                             */
/* ------------------------------------------------------------------ */

function edge(color: string): string {
  return rgba(darken(color, 0.6), 0.5);
}

function tulipHead(ctx: Ctx, color: string) {
  const dark = darken(color, 0.3);
  const light = lighten(color, 0.24);
  const e = edge(color);
  // чашелистик
  ctx.beginPath();
  ctx.ellipse(0, 3, 5.5, 3.4, 0, 0, TAU);
  ctx.fillStyle = '#2e8b3a';
  ctx.fill();
  // боковые лепестки
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0, 3);
    ctx.bezierCurveTo(s * 17, 2, s * 19.5, -22, s * 9, -38);
    ctx.bezierCurveTo(s * 7.5, -26, s * 3, -10, 0, 3);
    ctx.closePath();
    ctx.fillStyle = dark;
    ctx.fill();
    ctx.strokeStyle = e;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
  // центральный лепесток
  ctx.beginPath();
  ctx.moveTo(0, 4);
  ctx.bezierCurveTo(-13.5, -2, -12.5, -26, 0, -42);
  ctx.bezierCurveTo(12.5, -26, 13.5, -2, 0, 4);
  ctx.closePath();
  const g = ctx.createLinearGradient(-10, -32, 10, 2);
  g.addColorStop(0, light);
  g.addColorStop(0.5, color);
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = e;
  ctx.lineWidth = 0.8;
  ctx.stroke();
  // блик
  ctx.beginPath();
  ctx.moveTo(-5.2, -4);
  ctx.bezierCurveTo(-8.4, -14, -6.4, -27, -1.2, -35);
  ctx.strokeStyle = 'rgba(255,255,255,0.38)';
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.stroke();
}

function roseHead(ctx: Ctx, color: string, sv: number) {
  const rot = sv * 0.9;
  const dark = darken(color, 0.34);
  const light = lighten(color, 0.2);
  const e = edge(color);
  ctx.beginPath();
  ctx.arc(0, 0, 15.5, 0, TAU);
  ctx.fillStyle = dark;
  ctx.fill();
  ctx.strokeStyle = e;
  ctx.lineWidth = 0.8;
  ctx.stroke();
  const rings = [
    { r: 12.5, n: 6, c: mix(dark, color, 0.55) },
    { r: 9, n: 5, c: color },
    { r: 5.6, n: 4, c: light },
  ];
  for (const ring of rings) {
    for (let i = 0; i < ring.n; i++) {
      const a = rot + (i * TAU) / ring.n + ring.r * 0.13;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * ring.r * 0.5, Math.sin(a) * ring.r * 0.5, ring.r * 0.62, 0, TAU);
      ctx.fillStyle = ring.c;
      ctx.fill();
      ctx.strokeStyle = e;
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }
  }
  ctx.beginPath();
  for (let t = 0; t < 4.6; t += 0.15) {
    const rr = 0.5 + t * 0.85;
    const a = t * 1.7 + rot;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.strokeStyle = rgba(darken(color, 0.55), 0.65);
  ctx.lineWidth = 0.9;
  ctx.stroke();
}

function poppyHead(ctx: Ctx, color: string, sv: number) {
  const rot = sv * 0.7;
  const dark = darken(color, 0.38);
  const light = lighten(color, 0.16);
  const e = edge(color);
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.rotate(rot + Math.PI / 4 + (i * Math.PI) / 2);
    ctx.translate(0, -9.5);
    ctx.beginPath();
    ctx.ellipse(0, 0, 10.6, 10.2, 0, 0, TAU);
    const g = ctx.createRadialGradient(0, 9, 1, 0, 0, 13);
    g.addColorStop(0, dark);
    g.addColorStop(0.5, color);
    g.addColorStop(1, light);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = e;
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.strokeStyle = rgba(dark, 0.4);
    ctx.lineWidth = 0.6;
    for (const dx of [-4, 0, 4]) {
      ctx.beginPath();
      ctx.moveTo(dx * 0.4, 8);
      ctx.quadraticCurveTo(dx * 1.1, 0, dx * 1.5, -8);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0, 0, 4.6, 0, TAU);
  ctx.fillStyle = '#2b1a12';
  ctx.fill();
  ctx.fillStyle = '#17100c';
  for (let i = 0; i < 14; i++) {
    const a = (i * TAU) / 14;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 7.4, Math.sin(a) * 7.4, 0.95, 0, TAU);
    ctx.fill();
  }
}

function daisyHead(ctx: Ctx, color: string, sv: number) {
  const rot = sv * 0.2;
  const petal = mix(color, '#ffffff', 0.5);
  const e = rgba(darken(color, 0.45), 0.45);
  const n = 15;
  for (let i = 0; i < n; i++) {
    ctx.save();
    ctx.rotate(rot + (i * TAU) / n);
    ctx.translate(0, -10.6);
    ctx.beginPath();
    ctx.ellipse(0, 0, 3.4, 8.4, 0, 0, TAU);
    const g = ctx.createLinearGradient(0, 8, 0, -8);
    g.addColorStop(0, mix(petal, color, 0.5));
    g.addColorStop(1, lighten(petal, 0.25));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = e;
    ctx.lineWidth = 0.6;
    ctx.stroke();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0, 0, 6.3, 0, TAU);
  const g = ctx.createRadialGradient(-1.5, -1.5, 0.5, 0, 0, 7);
  g.addColorStop(0, '#ffe066');
  g.addColorStop(1, '#df9a00');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(120,70,0,0.5)';
  ctx.lineWidth = 0.7;
  ctx.stroke();
}

function cornflowerHead(ctx: Ctx, color: string, sv: number) {
  const rot = sv * 0.25;
  const e = edge(color);
  const petal = (len: number) => {
    ctx.beginPath();
    ctx.moveTo(-1.8, -3.5);
    ctx.lineTo(-2.7, -len * 0.72);
    ctx.lineTo(-1.5, -len * 0.76);
    ctx.lineTo(-1.7, -len);
    ctx.lineTo(0, -len * 0.88);
    ctx.lineTo(1.7, -len);
    ctx.lineTo(1.5, -len * 0.76);
    ctx.lineTo(2.7, -len * 0.72);
    ctx.lineTo(1.8, -3.5);
    ctx.closePath();
  };
  const n = 12;
  for (let i = 0; i < n; i++) {
    ctx.save();
    ctx.rotate(rot + (i * TAU) / n);
    petal(15.5);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = e;
    ctx.lineWidth = 0.6;
    ctx.stroke();
    ctx.restore();
  }
  for (let i = 0; i < n; i++) {
    ctx.save();
    ctx.rotate(rot + TAU / n / 2 + (i * TAU) / n);
    petal(11.5);
    ctx.fillStyle = lighten(color, 0.18);
    ctx.fill();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0, 0, 3.4, 0, TAU);
  ctx.fillStyle = darken(color, 0.5);
  ctx.fill();
  ctx.fillStyle = lighten(color, 0.4);
  for (let i = 0; i < 7; i++) {
    const a = (i * TAU) / 7;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 1.8, Math.sin(a) * 1.8, 0.55, 0, TAU);
    ctx.fill();
  }
}

function sunflowerHead(ctx: Ctx, color: string, sv: number) {
  const rot = sv * 0.15;
  const e = edge(color);
  const petal = (len: number, w: number) => {
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.bezierCurveTo(w, -10 - len * 0.25, w * 1.05, -10 - len * 0.7, 0, -10 - len);
    ctx.bezierCurveTo(-w * 1.05, -10 - len * 0.7, -w, -10 - len * 0.25, 0, -10);
    ctx.closePath();
  };
  const n = 21;
  for (let i = 0; i < n; i++) {
    ctx.save();
    ctx.rotate(rot + TAU / n / 2 + (i * TAU) / n);
    petal(13, 3.6);
    ctx.fillStyle = darken(color, 0.16);
    ctx.fill();
    ctx.strokeStyle = e;
    ctx.lineWidth = 0.6;
    ctx.stroke();
    ctx.restore();
  }
  for (let i = 0; i < n; i++) {
    ctx.save();
    ctx.rotate(rot + (i * TAU) / n);
    petal(14.5, 4);
    const g = ctx.createLinearGradient(0, -10, 0, -24);
    g.addColorStop(0, darken(color, 0.06));
    g.addColorStop(1, lighten(color, 0.12));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = e;
    ctx.lineWidth = 0.6;
    ctx.stroke();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0, 0, 11.6, 0, TAU);
  const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 12);
  g.addColorStop(0, '#3a2009');
  g.addColorStop(0.7, '#6b3f12');
  g.addColorStop(1, '#8a5a1e');
  ctx.fillStyle = g;
  ctx.fill();
  for (let n2 = 1; n2 < 80; n2++) {
    const r = 1.2 * Math.sqrt(n2);
    if (r > 10.6) break;
    const a = n2 * 2.39996;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 0.75, 0, TAU);
    ctx.fillStyle = n2 % 2 ? '#b07a30' : '#25140a';
    ctx.fill();
  }
}

/** Головка цветка. Начало координат — верхушка стебля. */
export function paintHead(ctx: Ctx, kind: FlowerKind, color: string, sv: number): void {
  switch (kind) {
    case 'tulip':
      return tulipHead(ctx, color);
    case 'rose':
      return roseHead(ctx, color, sv);
    case 'poppy':
      return poppyHead(ctx, color, sv);
    case 'daisy':
      return daisyHead(ctx, color, sv);
    case 'cornflower':
      return cornflowerHead(ctx, color, sv);
    case 'sunflower':
      return sunflowerHead(ctx, color, sv);
  }
}
