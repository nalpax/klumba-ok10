import { KIND_SPECS, leanFor, paintBody, paintHead } from './flowers';
import type { FlowerKind } from './types';

/** Плотность растеризации спрайтов. 2 — компромисс резкости и памяти (~120 КБ на спрайт). */
export const SPRITE_RES = 2;

export const BOX_W = 72;
export const BOX_H = 124;
/** Точка основания стебля внутри спрайта. */
export const OX = 36;
export const OY = 116;

export const HEAD_BOX = 68;
export const HEAD_O = 34;

function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * SPRITE_RES);
  c.height = Math.ceil(h * SPRITE_RES);
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas is not available');
  ctx.scale(SPRITE_RES, SPRITE_RES);
  return { c, ctx };
}

/** 8 вариантов из БД → 2 варианта рисунка × отражение. */
export function spriteVariant(variant: number): { sv: number; flip: 1 | -1 } {
  const v = ((variant % 8) + 8) % 8;
  return { sv: v % 2, flip: (v >> 1) % 2 ? -1 : 1 };
}

const fullCache = new Map<string, HTMLCanvasElement>();
const partsCache = new Map<string, { body: HTMLCanvasElement; head: HTMLCanvasElement }>();

/** Готовый цветок целиком (стебель, листья, головка). */
export function getSprite(kind: FlowerKind, color: string, sv: number): HTMLCanvasElement {
  const key = `${kind}|${color}|${sv}`;
  let hit = fullCache.get(key);
  if (hit) return hit;
  const { c, ctx } = makeCanvas(BOX_W, BOX_H);
  ctx.translate(OX, OY);
  paintBody(ctx, kind, sv);
  const lean = leanFor(sv);
  ctx.translate(lean, -KIND_SPECS[kind].stemH);
  ctx.rotate(lean * 0.018);
  paintHead(ctx, kind, color, sv);
  hit = c;
  fullCache.set(key, hit);
  return hit;
}

/** Отдельно стебель и головка — для анимации роста. */
export function getParts(kind: FlowerKind, color: string, sv: number) {
  const key = `${kind}|${color}|${sv}`;
  let hit = partsCache.get(key);
  if (hit) return hit;
  const b = makeCanvas(BOX_W, BOX_H);
  b.ctx.translate(OX, OY);
  paintBody(b.ctx, kind, sv);
  const h = makeCanvas(HEAD_BOX, HEAD_BOX);
  h.ctx.translate(HEAD_O, HEAD_O);
  h.ctx.rotate(leanFor(sv) * 0.018);
  paintHead(h.ctx, kind, color, sv);
  hit = { body: b.c, head: h.c };
  partsCache.set(key, hit);
  return hit;
}

export function clearSpriteCache(): void {
  fullCache.clear();
  partsCache.clear();
}
