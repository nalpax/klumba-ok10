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

  // дальняя половина каменного бордюра (ближнюю рисуем поверх газона в конце)
  paintStones(ctx, rnd, 'back');

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

  // опавшие осенние листья на траве
  paintFallenLeaves(ctx, rnd);

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

  // ближняя половина бордюра, тыквы и табличка у края клумбы
  paintStones(ctx, rnd, 'front');
  paintPumpkin(ctx, 150, 905, 1.05, rnd);
  paintPumpkin(ctx, 225, 950, 0.7, rnd);
  paintPumpkin(ctx, 1830, 930, 0.9, rnd);
  paintSign(ctx, 1690, 1010);

  return c;
}

type Ctx = CanvasRenderingContext2D;

/** Камни бордюра по краю земляного бортика. half: дальняя (верх) или ближняя (низ) половина. */
function paintStones(ctx: Ctx, rnd: () => number, half: 'back' | 'front') {
  const { cx, cy, rx, ry } = LAWN;
  const stones: Array<[number, number, number, number, string]> = [];
  const n = 150;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + rnd() * 0.01;
    const front = Math.sin(a) > 0;
    if ((half === 'front') !== front) continue;
    const x = cx + Math.cos(a) * (rx + 26);
    const y = cy + 12 + Math.sin(a) * (ry + 20);
    const persp = 0.75 + 0.35 * ((Math.sin(a) + 1) / 2); // ближние камни крупнее
    const tone = ['#b9ad9a', '#a89c88', '#c8bfae', '#9d917e', '#d3cab9'][Math.floor(rnd() * 5)];
    stones.push([x, y, (17 + rnd() * 7) * persp, (10 + rnd() * 4) * persp, tone]);
  }
  stones.sort((p, q) => p[1] - q[1]);
  for (const [x, y, w, h, tone] of stones) {
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(x + 2, y + h * 0.55, w * 0.95, h * 0.5, 0, 0, TAU);
    ctx.fill();
    const g = ctx.createRadialGradient(x - w * 0.3, y - h * 0.4, 1, x, y, w);
    g.addColorStop(0, '#f2ece2');
    g.addColorStop(0.45, tone);
    g.addColorStop(1, '#6e6456');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, w, h, 0, 0, TAU);
    ctx.fill();
  }
}

const LEAF_COLORS = ['#c8321f', '#ee8a2b', '#f2b33d', '#d9541e', '#b8651f', '#e8a13a'];

/** Кленовые и овальные листья, опавшие на газон. */
function paintFallenLeaves(ctx: Ctx, rnd: () => number) {
  const { cx, cy, rx, ry } = LAWN;
  for (let i = 0; i < 90; i++) {
    const a = rnd() * TAU;
    const r = 0.25 + 0.75 * Math.sqrt(rnd());
    const x = cx + Math.cos(a) * r * rx * 0.97;
    const y = cy + Math.sin(a) * r * ry * 0.95;
    const t = (y - (cy - ry)) / (2 * ry);
    const s = (0.55 + 0.6 * t) * (0.8 + rnd() * 0.5);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rnd() * TAU);
    ctx.scale(s, s * 0.62); // лежит на земле — сплющен перспективой
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = LEAF_COLORS[Math.floor(rnd() * LEAF_COLORS.length)];
    ctx.beginPath();
    if (rnd() < 0.5) {
      // кленовый
      for (let k = 0; k < 10; k++) {
        const ang = (k / 10) * TAU - Math.PI / 2;
        const rr = k % 2 === 0 ? 11 : 5;
        const px = Math.cos(ang) * rr;
        const py = Math.sin(ang) * rr;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    } else {
      ctx.moveTo(0, -10);
      ctx.quadraticCurveTo(7, 0, 0, 10);
      ctx.quadraticCurveTo(-7, 0, 0, -10);
    }
    ctx.fill();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#4a2410';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(0, 9);
    ctx.stroke();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

/** Тыква у края клумбы. */
function paintPumpkin(ctx: Ctx, x: number, y: number, s: number, rnd: () => number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(4, 26, 62, 13, 0, 0, TAU);
  ctx.fill();
  const lobes: Array<[number, number, string]> = [
    [-34, 26, '#d8661a'], [34, 26, '#d8661a'], [-17, 30, '#ee8a2b'], [17, 30, '#ee8a2b'], [0, 31, '#f59a36'],
  ];
  for (const [lx, w, col] of lobes) {
    const g = ctx.createRadialGradient(lx - w * 0.3, -14, 2, lx, 0, w * 1.3);
    g.addColorStop(0, '#ffc07a');
    g.addColorStop(0.5, col);
    g.addColorStop(1, '#8f3a0c');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(lx, 0, w, 30, 0, 0, TAU);
    ctx.fill();
  }
  // хвостик и листик
  ctx.strokeStyle = '#5a3a14';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -26);
  ctx.quadraticCurveTo(3, -40, 12, -46);
  ctx.stroke();
  ctx.fillStyle = '#4c8a17';
  ctx.beginPath();
  ctx.ellipse(-14 + rnd() * 4, -34, 14, 6, -0.5, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** Деревянная табличка «Спасибо, учителя!». */
function paintSign(ctx: Ctx, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(6, 4, 40, 9, 0, 0, TAU);
  ctx.fill();
  // столбик
  ctx.fillStyle = '#6b4520';
  ctx.fillRect(-7, -120, 14, 124);
  // доска
  ctx.rotate(-0.04);
  const g = ctx.createLinearGradient(0, -170, 0, -100);
  g.addColorStop(0, '#c98a4b');
  g.addColorStop(1, '#9a6230');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(-150, -172, 300, 70, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(70,40,10,0.55)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,230,190,0.25)';
  ctx.lineWidth = 1.5;
  for (const yy of [-150, -130, -115]) {
    ctx.beginPath();
    ctx.moveTo(-140, yy);
    ctx.bezierCurveTo(-50, yy - 3, 50, yy + 3, 140, yy);
    ctx.stroke();
  }
  ctx.fillStyle = '#4a2a0c';
  for (const [nx, ny] of [[-136, -160], [136, -160], [-136, -114], [136, -114]]) {
    ctx.beginPath();
    ctx.arc(nx, ny, 3.5, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#fff4dc';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'italic 700 30px Georgia, "Times New Roman", serif';
  ctx.fillText('Спасибо, учителя!', 0, -136);
  ctx.restore();
}
