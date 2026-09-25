import { EMBLEM, LAWN, WORLD_H, WORLD_W } from './constants';
import { mulberry32 } from './rng';

/** Во сколько раз фон растеризуется относительно единиц мира. */
export const BG_SCALE = 1.25;

const TAU = Math.PI * 2;
const BLADES = ['#1b5823', '#246a27', '#2f7d2c', '#3f9134', '#56a83c', '#78c04a'];

/**
 * Рисует газон: тень, земляной бортик, траву, кромку из травинок
 * и холмик под подсолнухом. Выполняется один раз и кешируется в canvas.
 */
export function paintLawn(seed = 11): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.round(WORLD_W * BG_SCALE);
  c.height = Math.round(WORLD_H * BG_SCALE);
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas is not available');
  ctx.scale(BG_SCALE, BG_SCALE);
  const rnd = mulberry32(seed);
  const { cx, cy, rx, ry } = LAWN;

  // тень под клумбой
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 30;
  ctx.fillStyle = '#20150d';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 10, rx + 22, ry + 16, 0, 0, TAU);
  ctx.fill();
  ctx.restore();

  // земляной бортик
  const soil = ctx.createLinearGradient(0, cy - ry, 0, cy + ry + 30);
  soil.addColorStop(0, '#4d3625');
  soil.addColorStop(1, '#22160e');
  ctx.fillStyle = soil;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 8, rx + 18, ry + 14, 0, 0, TAU);
  ctx.fill();

  // газон (эллиптический градиент)
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, -rx * 0.2, rx * 0.05, 0, 0, rx);
  g.addColorStop(0, '#54a238');
  g.addColorStop(0.55, '#347f2b');
  g.addColorStop(1, '#1d5a23');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, TAU);
  ctx.fill();
  ctx.restore();

  // трава внутри овала
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
  ctx.clip();

  const buckets: Array<Array<[number, number, number, number]>> = BLADES.map(() => []);
  for (let i = 0; i < 15000; i++) {
    const a = rnd() * TAU;
    const r = Math.sqrt(rnd());
    const x = cx + Math.cos(a) * r * rx;
    const y = cy + Math.sin(a) * r * ry;
    const t = (y - (cy - ry)) / (2 * ry); // 0 — дальний край, 1 — ближний
    const idx = Math.max(0, Math.min(BLADES.length - 1, Math.floor((t * 0.75 + rnd() * 0.5 - 0.08) * BLADES.length)));
    buckets[idx].push([x, y, 7 + rnd() * 11, (rnd() - 0.5) * 7]);
  }
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  buckets.forEach((list, i) => {
    ctx.beginPath();
    for (const [x, y, len, lean] of list) {
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + lean * 0.4, y - len * 0.55, x + lean, y - len);
    }
    ctx.strokeStyle = BLADES[i];
    ctx.stroke();
  });

  // виньетка к краям
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx);
  const v = ctx.createRadialGradient(0, 0, rx * 0.55, 0, 0, rx);
  v.addColorStop(0, 'rgba(4,26,8,0)');
  v.addColorStop(1, 'rgba(4,26,8,0.5)');
  ctx.fillStyle = v;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.restore();

  // кромка: травинки на границе овала, торчат вверх
  const rim: Array<Array<[number, number, number, number]>> = [[], [], []];
  for (let i = 0; i < 1300; i++) {
    const a = rnd() * TAU;
    const k = 0.965 + rnd() * 0.07;
    const x = cx + Math.cos(a) * rx * k;
    const y = cy + Math.sin(a) * ry * k;
    rim[Math.floor(rnd() * 3)].push([x, y, 12 + rnd() * 20, Math.cos(a) * 5 + (rnd() - 0.5) * 6]);
  }
  const rimColors = ['#2f7d2c', '#3f9134', '#56a83c'];
  ctx.lineWidth = 1.9;
  rim.forEach((list, i) => {
    ctx.beginPath();
    for (const [x, y, len, lean] of list) {
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + lean * 0.3, y - len * 0.6, x + lean, y - len);
    }
    ctx.strokeStyle = rimColors[i];
    ctx.stroke();
  });

  // холмик под подсолнухом
  const mound = ctx.createLinearGradient(0, EMBLEM.baseY - 12, 0, EMBLEM.baseY + 18);
  mound.addColorStop(0, '#5a3f2a');
  mound.addColorStop(1, '#2a1b11');
  ctx.fillStyle = mound;
  ctx.beginPath();
  ctx.ellipse(EMBLEM.x, EMBLEM.baseY + 4, 58, 15, 0, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  for (let i = 0; i < 70; i++) {
    const a = rnd() * TAU;
    const x = EMBLEM.x + Math.cos(a) * 56 * Math.sqrt(rnd());
    const y = EMBLEM.baseY + 4 + Math.sin(a) * 13 * Math.sqrt(rnd());
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 1, y - 7, x + (rnd() - 0.5) * 6, y - 13 - rnd() * 7);
  }
  ctx.strokeStyle = '#4a9a35';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  return c;
}
