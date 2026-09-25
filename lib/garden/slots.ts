import { EMBLEM_HOLE, LAWN, WORLD_H, WORLD_W } from './constants';
import { mulberry32 } from './rng';
import type { Slot } from './types';

/**
 * Места на клумбе: шестиугольная сетка с шумом внутри овала, без зоны подсолнуха в центре.
 * Генератор детерминированный (один и тот же seed — одни и те же места), поэтому места не нужно
 * хранить: сервер и браузер получают одинаковый список.
 */
export function generateSlots(seed = 7): Slot[] {
  const rnd = mulberry32(seed);
  const DX = 26;
  const DY = 22;
  const raw: Array<{ x: number; y: number }> = [];
  for (let j = 0; j <= 49; j++) {
    for (let i = 0; i <= 79; i++) {
      const gx = i * DX + (j % 2 ? DX / 2 : 0);
      const gy = j * DY;
      const x = gx + (rnd() - 0.5) * 0.7 * DX;
      const y = gy + (rnd() - 0.5) * 0.7 * DY;
      const inLawn = ((x - LAWN.cx) / 900) ** 2 + ((y - LAWN.cy) / 430) ** 2 <= 1;
      const inHole =
        ((x - EMBLEM_HOLE.cx) / EMBLEM_HOLE.rx) ** 2 + ((y - EMBLEM_HOLE.cy) / EMBLEM_HOLE.ry) ** 2 <= 1;
      if (inLawn && !inHole) raw.push({ x, y });
    }
  }
  // перемешиваем (Фишер—Йетс)
  for (let i = raw.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [raw[i], raw[j]] = [raw[j], raw[i]];
  }
  return raw.map((r, idx) => {
    const t = Math.max(0, Math.min(1, (r.y - 140) / 860));
    return {
      id: idx + 1,
      x: r.x / WORLD_W,
      y: r.y / WORLD_H,
      scale: (0.7 + 0.6 * t) * (0.92 + rnd() * 0.16),
      rotation: (rnd() - 0.5) * 0.24,
      variant: Math.floor(rnd() * 8),
    };
  });
}

let cached: Slot[] | null = null;
let cachedById: Map<number, Slot> | null = null;

/** Все места клумбы (считаются один раз). */
export function allSlots(): Slot[] {
  if (!cached) cached = generateSlots();
  return cached;
}

export function slotById(id: number): Slot | undefined {
  if (!cachedById) cachedById = new Map(allSlots().map((s) => [s.id, s]));
  return cachedById.get(id);
}
