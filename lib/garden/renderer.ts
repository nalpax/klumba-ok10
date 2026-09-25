import { EMBLEM, GROW_MS, LAWN, WORLD_H, WORLD_W } from './constants';
import { KIND_SPECS, leanFor } from './flowers';
import { BG_SCALE, paintLawn } from './lawn';
import {
  BOX_H,
  BOX_W,
  HEAD_BOX,
  HEAD_O,
  OX,
  OY,
  getParts,
  getSprite,
  spriteVariant,
} from './sprites';
import type { FlowerKind, Planting, Slot } from './types';

const TAU = Math.PI * 2;

export type Selection =
  | { type: 'planting'; planting: Planting; x: number; y: number }
  | { type: 'emblem'; x: number; y: number };

export interface CameraState {
  zoom: number;
  fit: number;
  maxZoom: number;
}

export interface RendererOptions {
  canvas: HTMLCanvasElement;
  resolveKind: (flowerId: number) => FlowerKind;
  onSelect?: (selection: Selection | null) => void;
  onCamera?: (state: CameraState) => void;
  /** Ученик коснулся свободного места в режиме выбора места. */
  onPickSlot?: (slot: Slot) => void;
  reducedMotion?: boolean;
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const clamp01 = (v: number) => clamp(v, 0, 1);
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

interface Tween {
  from: { cx: number; cy: number; zoom: number };
  to: { cx: number; cy: number; zoom: number };
  start: number;
  dur: number;
}

/**
 * Canvas-рендерер клумбы. Не зависит от React.
 * Все цветы рисуются готовыми спрайтами, кадр перерисовывается только при изменениях.
 */
export class GardenRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly opts: RendererOptions;
  private readonly bg: HTMLCanvasElement;
  private readonly ro: ResizeObserver;

  private dpr = 1;
  private vw = 0;
  private vh = 0;
  private cam = { cx: LAWN.cx, cy: LAWN.cy, zoom: 1 };
  /** минимальный масштаб: вся клумба целиком */
  private fit = 1;
  /** стартовый масштаб: на узких экранах — крупнее, чтобы цветы были различимы */
  private home = 1;
  private maxZoom = 4;
  private ready = false;

  private items: Planting[] = [];
  private byId = new Map<number, Planting>();
  private growing = new Map<number, number>();
  private highlight: { id: number; until: number } | null = null;
  private emblem: HTMLImageElement | null = null;

  // выбор места
  private pickSlots: Slot[] | null = null;
  private pickHover: number | null = null;
  private chosen: { slot: Slot; kind: FlowerKind; color: string } | null = null;
  // «показать цветы одного учителя»: остальные приглушаются
  private focusTeacher: number | null = null;
  private dimmed = false;

  private raf = 0;
  private dirty = true;
  private tween: Tween | null = null;

  private pointers = new Map<number, { x: number; y: number }>();
  private drag: { x: number; y: number; cx: number; cy: number; moved: boolean } | null = null;
  private pinch: { dist: number; zoom: number; wx: number; wy: number } | null = null;

  constructor(opts: RendererOptions) {
    this.opts = opts;
    this.canvas = opts.canvas;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas is not available');
    this.ctx = ctx;
    this.bg = paintLawn();

    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointercancel', this.onPointerCancel);
    this.canvas.addEventListener('pointerleave', this.onPointerLeave);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    this.canvas.addEventListener('dblclick', this.onDblClick);
    this.canvas.addEventListener('keydown', this.onKeyDown);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.canvas);
    this.resize();
  }

  /* ---------------------------- данные ---------------------------- */

  setEmblem(img: HTMLImageElement | null) {
    this.emblem = img;
    this.invalidate();
  }

  /** Полная замена набора цветов, без анимации. */
  setPlantings(list: Planting[]) {
    this.items = [...list].sort((a, b) => a.y - b.y || a.id - b.id);
    this.byId = new Map(this.items.map((p) => [p.id, p]));
    this.growing.clear();
    this.invalidate();
  }

  /** Добавить один цветок (например, пришёл по realtime). */
  add(p: Planting, animate = true) {
    if (this.byId.has(p.id)) return;
    this.byId.set(p.id, p);
    let lo = 0;
    let hi = this.items.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const q = this.items[mid];
      if (q.y < p.y || (q.y === p.y && q.id < p.id)) lo = mid + 1;
      else hi = mid;
    }
    this.items.splice(lo, 0, p);
    if (animate && !this.opts.reducedMotion) this.growing.set(p.id, performance.now());
    this.invalidate();
  }

  /** Подсветить цветок кольцом на несколько секунд. */
  highlightPlanting(id: number | null, ms = 4500) {
    this.highlight = id === null ? null : { id, until: performance.now() + ms };
    this.invalidate();
  }

  /** Включить режим выбора места: показать свободные точки. null — выключить. */
  setPickMode(slots: Slot[] | null) {
    this.pickSlots = slots;
    this.pickHover = null;
    this.invalidate();
  }

  /** Показать «призрак» цветка на выбранном месте. */
  setChosen(slot: Slot | null, kind?: FlowerKind, color?: string) {
    this.chosen = slot && kind && color ? { slot, kind, color } : null;
    this.invalidate();
  }

  /** Оставить яркими только цветы этого учителя (null — показать все). */
  setFocusTeacher(id: number | null) {
    this.focusTeacher = id;
    this.invalidate();
  }

  /** Приблизить вид, если он мельче min (нужно, чтобы точки места можно было выбрать пальцем). */
  ensureZoom(min: number) {
    if (this.cam.zoom < min) this.animateTo(this.cam.cx, this.cam.cy, Math.min(min, this.maxZoom), 600);
  }

  /* ----------------------------- камера ---------------------------- */

  private computeZooms(): { fit: number; home: number } {
    const padX = 90;
    const padY = 150;
    const byW = this.vw / (LAWN.rx * 2 + padX);
    const byH = this.vh / (LAWN.ry * 2 + padY);
    const fit = Math.min(byW, byH);
    // на узких экранах показываем клумбу по высоте: вся ширина не поместится, но её можно двигать
    return { fit, home: this.vw < 640 ? Math.max(fit, byH) : fit };
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    const wasHome = !this.ready || this.cam.zoom <= this.home * 1.02;
    this.vw = rect.width;
    this.vh = rect.height;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.vw * this.dpr);
    this.canvas.height = Math.round(this.vh * this.dpr);
    const z = this.computeZooms();
    this.fit = z.fit;
    this.home = z.home;
    this.maxZoom = Math.max(this.home * 5, 1.7);
    if (wasHome) {
      this.cam = { cx: LAWN.cx, cy: LAWN.cy, zoom: this.home };
    } else {
      this.cam.zoom = clamp(this.cam.zoom, this.fit, this.maxZoom);
    }
    this.ready = true;
    this.clampCam();
    this.invalidate();
  }

  private clampCam() {
    const halfW = this.vw / 2 / this.cam.zoom;
    const halfH = this.vh / 2 / this.cam.zoom;
    const x0 = LAWN.cx - LAWN.rx - 70;
    const x1 = LAWN.cx + LAWN.rx + 70;
    const y0 = LAWN.cy - LAWN.ry - 150;
    const y1 = LAWN.cy + LAWN.ry + 60;
    this.cam.cx = x1 - x0 <= halfW * 2 ? (x0 + x1) / 2 : clamp(this.cam.cx, x0 + halfW, x1 - halfW);
    this.cam.cy = y1 - y0 <= halfH * 2 ? (y0 + y1) / 2 : clamp(this.cam.cy, y0 + halfH, y1 - halfH);
  }

  private toWorld(sx: number, sy: number) {
    return {
      x: (sx - this.vw / 2) / this.cam.zoom + this.cam.cx,
      y: (sy - this.vh / 2) / this.cam.zoom + this.cam.cy,
    };
  }

  private toScreen(wx: number, wy: number) {
    return {
      x: (wx - this.cam.cx) * this.cam.zoom + this.vw / 2,
      y: (wy - this.cam.cy) * this.cam.zoom + this.vh / 2,
    };
  }

  zoomBy(factor: number, sx = this.vw / 2, sy = this.vh / 2) {
    this.tween = null;
    const before = this.toWorld(sx, sy);
    const zoom = clamp(this.cam.zoom * factor, this.fit, this.maxZoom);
    this.cam.zoom = zoom;
    this.cam.cx = before.x - (sx - this.vw / 2) / zoom;
    this.cam.cy = before.y - (sy - this.vh / 2) / zoom;
    this.clampCam();
    this.invalidate();
  }

  private animateTo(cx: number, cy: number, zoom: number, dur = 750) {
    if (this.opts.reducedMotion) {
      this.cam = { cx, cy, zoom };
      this.clampCam();
      this.invalidate();
      return;
    }
    this.tween = {
      from: { ...this.cam },
      to: { cx, cy, zoom: clamp(zoom, this.fit, this.maxZoom) },
      start: performance.now(),
      dur,
    };
    this.schedule();
  }

  /** Показать клумбу целиком. */
  fitView() {
    this.animateTo(LAWN.cx, LAWN.cy, this.fit, 600);
  }

  /** Вернуться к стартовому виду. */
  homeView() {
    this.animateTo(LAWN.cx, LAWN.cy, this.home, 600);
  }

  /** Плавно приблизиться к цветку. */
  focusOn(id: number, zoomFactor = 3) {
    const p = this.byId.get(id);
    if (!p) return;
    this.animateTo(p.x * WORLD_W, p.y * WORLD_H - 40, this.home * zoomFactor);
  }

  getCamera(): CameraState {
    return { zoom: this.cam.zoom, fit: this.fit, maxZoom: this.maxZoom };
  }

  /* ---------------------------- рисование --------------------------- */

  private invalidate() {
    this.dirty = true;
    this.schedule();
  }

  private schedule() {
    if (!this.raf) this.raf = requestAnimationFrame(this.frame);
  }

  private frame = (now: number) => {
    this.raf = 0;
    if (this.tween) {
      const t = clamp01((now - this.tween.start) / this.tween.dur);
      const e = easeInOut(t);
      const { from, to } = this.tween;
      this.cam.cx = from.cx + (to.cx - from.cx) * e;
      this.cam.cy = from.cy + (to.cy - from.cy) * e;
      this.cam.zoom = from.zoom + (to.zoom - from.zoom) * e;
      if (t >= 1) this.tween = null;
      this.clampCam();
    }
    this.draw(now);
    this.notifyCamera();
    const ringActive = this.highlight !== null && this.highlight.until > now;
    if (this.highlight && !ringActive) {
      this.highlight = null;
      this.dirty = true;
    }
    if (this.growing.size > 0 || this.tween || ringActive || this.dirty) this.schedule();
  };

  private lastCam = '';
  private notifyCamera() {
    if (!this.opts.onCamera) return;
    const key = `${this.cam.zoom.toFixed(3)}|${this.fit.toFixed(3)}`;
    if (key === this.lastCam) return;
    this.lastCam = key;
    // пока вид не сильно приближен, вертикальный жест листает страницу, горизонтальный двигает клумбу
    this.canvas.style.touchAction = this.cam.zoom > this.home * 2.2 ? 'none' : 'pan-y';
    this.opts.onCamera(this.getCamera());
  }

  private draw(now: number) {
    const { ctx, cam, vw, vh, dpr } = this;
    this.dirty = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.globalAlpha = 1;
    this.dimmed = false;

    const k = cam.zoom * dpr;
    const ox = (vw / 2 - cam.cx * cam.zoom) * dpr;
    const oy = (vh / 2 - cam.cy * cam.zoom) * dpr;

    const bs = k / BG_SCALE;
    ctx.setTransform(bs, 0, 0, bs, ox, oy);
    ctx.drawImage(this.bg, 0, 0);

    const halfX = vw / 2 / cam.zoom + 44;
    const yMin = cam.cy - vh / 2 / cam.zoom - 12;
    const yMax = cam.cy + vh / 2 / cam.zoom + 150;

    // бинарный поиск первого цветка с y >= yMin
    let lo = 0;
    let hi = this.items.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.items[mid].y * WORLD_H < yMin) lo = mid + 1;
      else hi = mid;
    }

    let emblemDone = !this.emblem;
    for (let i = lo; i < this.items.length; i++) {
      const p = this.items[i];
      const py = p.y * WORLD_H;
      if (py > yMax) break;
      if (!emblemDone && py >= EMBLEM.baseY) {
        this.drawEmblem(k, ox, oy);
        emblemDone = true;
      }
      const px = p.x * WORLD_W;
      if (Math.abs(px - cam.cx) > halfX) continue;
      this.drawPlanting(p, px, py, k, ox, oy, now);
    }
    if (!emblemDone) this.drawEmblem(k, ox, oy);
    ctx.globalAlpha = 1;
    this.dimmed = false;

    if (this.pickSlots) this.drawPick(k, ox, oy);
    if (this.chosen) this.drawChosen(k, ox, oy);
    if (this.highlight) this.drawRing(k, ox, oy, now);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  private drawEmblem(k: number, ox: number, oy: number) {
    const img = this.emblem;
    if (!img || !img.naturalWidth) return;
    const ctx = this.ctx;
    const h = EMBLEM.height;
    const w = h * (img.naturalWidth / img.naturalHeight);
    ctx.globalAlpha = 1;
    this.dimmed = false;
    ctx.setTransform(k, 0, 0, k, ox, oy);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(EMBLEM.x, EMBLEM.baseY + 3, 60, 11, 0, 0, TAU);
    ctx.fill();
    ctx.drawImage(img, EMBLEM.x - w / 2, EMBLEM.baseY - h, w, h);
  }

  private drawPlanting(p: Planting, px: number, py: number, k: number, ox: number, oy: number, now: number) {
    const ctx = this.ctx;
    const kind = this.opts.resolveKind(p.flowerId);
    const { sv, flip } = spriteVariant(p.variant);
    const dim = this.focusTeacher !== null && p.teacherId !== this.focusTeacher;
    if (dim !== this.dimmed) {
      ctx.globalAlpha = dim ? 0.16 : 1;
      this.dimmed = dim;
    }
    const s = p.scale * k;
    const cos = Math.cos(p.rotation);
    const sin = Math.sin(p.rotation);
    ctx.setTransform(cos * s * flip, sin * s * flip, -sin * s, cos * s, px * k + ox, py * k + oy);

    const started = this.growing.get(p.id);
    if (started === undefined) {
      ctx.drawImage(getSprite(kind, p.color, sv), -OX, -OY, BOX_W, BOX_H);
      return;
    }
    const t = clamp01((now - started) / GROW_MS);
    if (t >= 1) {
      this.growing.delete(p.id);
      ctx.drawImage(getSprite(kind, p.color, sv), -OX, -OY, BOX_W, BOX_H);
      return;
    }
    const parts = getParts(kind, p.color, sv);
    const spec = KIND_SPECS[kind];
    const g1 = easeOutCubic(clamp01((t - 0.12) / 0.55));
    const g2 = easeOutBack(clamp01((t - 0.58) / 0.42));
    const mound = t < 0.3 ? t / 0.3 : Math.max(0, 1 - (t - 0.3) / 0.55);
    if (mound > 0) {
      ctx.fillStyle = `rgba(62,40,25,${0.92 * mound})`;
      ctx.beginPath();
      ctx.ellipse(0, 1, 6 + 6 * mound, 2 + 2.2 * mound, 0, 0, TAU);
      ctx.fill();
    }
    if (g1 > 0) {
      ctx.save();
      ctx.scale(0.55 + 0.45 * g1, g1);
      ctx.drawImage(parts.body, -OX, -OY, BOX_W, BOX_H);
      ctx.restore();
    }
    if (g2 > 0.001) {
      ctx.save();
      ctx.translate(leanFor(sv) * g1, -spec.stemH * g1);
      ctx.scale(g2, g2);
      ctx.drawImage(parts.head, -HEAD_O, -HEAD_O, HEAD_BOX, HEAD_BOX);
      ctx.restore();
    }
  }

  /** Свободные места: маленькие светящиеся точки на основании будущих стеблей. */
  private drawPick(k: number, ox: number, oy: number) {
    const slots = this.pickSlots;
    if (!slots) return;
    const ctx = this.ctx;
    const z = this.cam.zoom;
    const halfX = this.vw / 2 / z + 20;
    const halfY = this.vh / 2 / z + 20;
    const r = Math.max(4.2, 3.4 / z);
    ctx.setTransform(k, 0, 0, k, ox, oy);
    ctx.beginPath();
    for (const s of slots) {
      const sx = s.x * WORLD_W;
      const sy = s.y * WORLD_H;
      if (Math.abs(sx - this.cam.cx) > halfX || Math.abs(sy - this.cam.cy) > halfY) continue;
      ctx.moveTo(sx + r, sy);
      ctx.arc(sx, sy, r, 0, TAU);
    }
    ctx.fillStyle = 'rgba(224,255,130,0.62)';
    ctx.fill();
    ctx.lineWidth = 1.1 / z;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.stroke();

    if (this.pickHover !== null) {
      const h = slots.find((s) => s.id === this.pickHover);
      if (h) {
        ctx.beginPath();
        ctx.arc(h.x * WORLD_W, h.y * WORLD_H, r * 2.6, 0, TAU);
        ctx.lineWidth = 2 / z;
        ctx.strokeStyle = 'rgba(214,250,110,0.95)';
        ctx.stroke();
      }
    }
  }

  /** Выбранное место: цветок-«призрак» и кольцо вокруг основания. */
  private drawChosen(k: number, ox: number, oy: number) {
    const c = this.chosen;
    if (!c) return;
    const ctx = this.ctx;
    const { slot } = c;
    const { sv, flip } = spriteVariant(slot.variant);
    const px = slot.x * WORLD_W;
    const py = slot.y * WORLD_H;
    const s = slot.scale * k;
    const cos = Math.cos(slot.rotation);
    const sin = Math.sin(slot.rotation);

    ctx.setTransform(k, 0, 0, k, ox, oy);
    ctx.beginPath();
    ctx.ellipse(px, py, 20 * slot.scale, 8 * slot.scale, 0, 0, TAU);
    ctx.lineWidth = 2.4 / this.cam.zoom + 0.8;
    ctx.strokeStyle = 'rgba(214,250,110,0.95)';
    ctx.shadowColor = 'rgba(190,240,90,0.9)';
    ctx.shadowBlur = 14;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.globalAlpha = 0.92;
    ctx.setTransform(cos * s * flip, sin * s * flip, -sin * s, cos * s, px * k + ox, py * k + oy);
    ctx.drawImage(getSprite(c.kind, c.color, sv), -OX, -OY, BOX_W, BOX_H);
    ctx.globalAlpha = 1;
  }

  private slotAt(sx: number, sy: number): Slot | null {
    if (!this.pickSlots) return null;
    let best: Slot | null = null;
    let bd = 30 * 30; // радиус 30 px: удобно попадать пальцем
    for (const s of this.pickSlots) {
      const p = this.toScreen(s.x * WORLD_W, s.y * WORLD_H);
      const d = (p.x - sx) * (p.x - sx) + (p.y - sy) * (p.y - sy);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    return best;
  }

  private headCenter(p: Planting) {
    const kind = this.opts.resolveKind(p.flowerId);
    const { sv, flip } = spriteVariant(p.variant);
    const lean = leanFor(sv) * flip;
    const ly = -KIND_SPECS[kind].stemH;
    const cos = Math.cos(p.rotation);
    const sin = Math.sin(p.rotation);
    return {
      x: p.x * WORLD_W + (cos * lean - sin * ly) * p.scale,
      y: p.y * WORLD_H + (sin * lean + cos * ly) * p.scale,
      r: KIND_SPECS[kind].headR * p.scale,
    };
  }

  private drawRing(k: number, ox: number, oy: number, now: number) {
    const h = this.highlight;
    if (!h) return;
    const p = this.byId.get(h.id);
    if (!p) return;
    const c = this.headCenter(p);
    const ctx = this.ctx;
    const pulse = 0.5 + 0.5 * Math.sin(now / 260);
    const fade = clamp01((h.until - now) / 700);
    ctx.setTransform(k, 0, 0, k, ox, oy);
    ctx.lineWidth = 3.2 / Math.max(this.cam.zoom / this.fit, 1) + 1.2;
    ctx.strokeStyle = `rgba(212,250,110,${(0.55 + 0.4 * pulse) * fade})`;
    ctx.shadowColor = 'rgba(190,240,90,0.9)';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r + 12 + 5 * pulse, 0, TAU);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  /* -------------------------- взаимодействие ------------------------- */

  private hitTest(sx: number, sy: number): Selection | null {
    const w = this.toWorld(sx, sy);
    let best: Planting | null = null;
    let bestScore = Infinity;
    const minR = 15 / this.cam.zoom;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      if (Math.abs(p.x * WORLD_W - w.x) > 60) continue;
      const c = this.headCenter(p);
      const d = Math.hypot(c.x - w.x, c.y - w.y);
      if (d <= Math.max(c.r * 1.05, minR) && d < bestScore) {
        best = p;
        bestScore = d;
      }
    }
    if (best) {
      const c = this.headCenter(best);
      const s = this.toScreen(c.x, c.y - c.r);
      return { type: 'planting', planting: best, x: s.x, y: s.y };
    }
    if (this.emblem) {
      const h = EMBLEM.height;
      const inX = Math.abs(w.x - EMBLEM.x) < h * 0.5;
      const inY = w.y > EMBLEM.baseY - h && w.y < EMBLEM.baseY;
      if (inX && inY) {
        const s = this.toScreen(EMBLEM.x, EMBLEM.baseY - h);
        return { type: 'emblem', x: s.x, y: s.y };
      }
    }
    return null;
  }

  private local(e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private onPointerDown = (e: PointerEvent) => {
    const pt = this.local(e);
    this.pointers.set(e.pointerId, pt);
    this.tween = null;
    if (this.pointers.size === 1) {
      this.drag = { x: pt.x, y: pt.y, cx: this.cam.cx, cy: this.cam.cy, moved: false };
    } else if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const w = this.toWorld(mid.x, mid.y);
      this.pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom: this.cam.zoom, wx: w.x, wy: w.y };
      this.drag = null;
    }
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    const pt = this.local(e);
    if (!this.pointers.has(e.pointerId)) {
      if (e.pointerType === 'mouse') {
        if (this.pickSlots) {
          const id = this.slotAt(pt.x, pt.y)?.id ?? null;
          if (id !== this.pickHover) {
            this.pickHover = id;
            this.invalidate();
          }
        } else {
          this.opts.onSelect?.(this.hitTest(pt.x, pt.y));
        }
      }
      return;
    }
    this.pointers.set(e.pointerId, pt);
    if (this.pointers.size === 2 && this.pinch) {
      const [a, b] = [...this.pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const zoom = clamp((this.pinch.zoom * dist) / this.pinch.dist, this.fit, this.maxZoom);
      this.cam.zoom = zoom;
      this.cam.cx = this.pinch.wx - (mid.x - this.vw / 2) / zoom;
      this.cam.cy = this.pinch.wy - (mid.y - this.vh / 2) / zoom;
      this.clampCam();
      this.invalidate();
    } else if (this.drag) {
      const dx = pt.x - this.drag.x;
      const dy = pt.y - this.drag.y;
      if (!this.drag.moved && Math.hypot(dx, dy) > 6) {
        this.drag.moved = true;
        this.opts.onSelect?.(null);
      }
      if (this.drag.moved) {
        this.cam.cx = this.drag.cx - dx / this.cam.zoom;
        this.cam.cy = this.drag.cy - dy / this.cam.zoom;
        this.clampCam();
        this.invalidate();
      }
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    const pt = this.local(e);
    const wasTap = this.drag !== null && !this.drag.moved && this.pointers.size === 1;
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = null;
    if (this.pointers.size === 0) this.drag = null;
    if (wasTap) {
      if (this.pickSlots) {
        const slot = this.slotAt(pt.x, pt.y);
        if (slot) this.opts.onPickSlot?.(slot);
      } else {
        this.opts.onSelect?.(this.hitTest(pt.x, pt.y));
      }
    }
  };

  private onPointerCancel = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    this.pinch = null;
    if (this.pointers.size === 0) this.drag = null;
  };

  private onPointerLeave = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    this.opts.onSelect?.(null);
    if (this.pickHover !== null) {
      this.pickHover = null;
      this.invalidate();
    }
  };

  private onWheel = (e: WheelEvent) => {
    // обычная прокрутка колесом листает страницу; масштаб — с Ctrl/⌘ (и щипок на трекпаде)
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    const pt = { x: e.clientX - this.canvas.getBoundingClientRect().left, y: e.clientY - this.canvas.getBoundingClientRect().top };
    this.zoomBy(Math.exp(-e.deltaY * 0.0025), pt.x, pt.y);
  };

  private onDblClick = (e: MouseEvent) => {
    const r = this.canvas.getBoundingClientRect();
    if (this.cam.zoom > this.home * 1.4) this.homeView();
    else this.zoomBy(2.2, e.clientX - r.left, e.clientY - r.top);
  };

  private onKeyDown = (e: KeyboardEvent) => {
    const step = 90 / this.cam.zoom;
    switch (e.key) {
      case '+':
      case '=':
        this.zoomBy(1.4);
        break;
      case '-':
      case '_':
        this.zoomBy(1 / 1.4);
        break;
      case '0':
        this.homeView();
        break;
      case 'ArrowLeft':
        this.cam.cx -= step;
        break;
      case 'ArrowRight':
        this.cam.cx += step;
        break;
      case 'ArrowUp':
        this.cam.cy -= step;
        break;
      case 'ArrowDown':
        this.cam.cy += step;
        break;
      default:
        return;
    }
    e.preventDefault();
    this.clampCam();
    this.invalidate();
  };

  destroy() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.ro.disconnect();
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerCancel);
    this.canvas.removeEventListener('pointerleave', this.onPointerLeave);
    this.canvas.removeEventListener('wheel', this.onWheel);
    this.canvas.removeEventListener('dblclick', this.onDblClick);
    this.canvas.removeEventListener('keydown', this.onKeyDown);
  }
}
