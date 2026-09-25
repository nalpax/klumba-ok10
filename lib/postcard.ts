import type { TeacherInfo } from '@/lib/api';
import { addressName } from '@/lib/names';
import { pickBySeed, TEACHER_FALLBACK_WISHES } from '@/lib/wishes';

/**
 * Текст-«заглушка» под размытием. Он одинаков для всех и ничего не говорит о настоящем пожелании:
 * само пожелание в браузер приходит только после нажатия «Открыть открытку».
 */
export const DECOY_WISH =
  'Спасибо вам за каждый урок, за терпение и внимание к каждому из нас. Мы знаем, сколько сил вы вкладываете в свою работу, и очень это ценим.\n\n' +
  'Пусть в этот день будет много тёплых слов, улыбок и хороших новостей, а впереди — только радость и вдохновение.';

/**
 * Если администратор не написал личное пожелание, показываем один из запасных текстов
 * (lib/wishes.ts) — привязан к id учителя, поэтому у каждого учителя без своего текста
 * всё равно получается разное пожелание, а не один и тот же на всех.
 */
export function defaultWish(t: TeacherInfo): string {
  const fallback = pickBySeed(TEACHER_FALLBACK_WISHES, t.id);
  return `${addressName(t)}, ${fallback.body.charAt(0).toLowerCase()}${fallback.body.slice(1)}`;
}

/** Куда лететь листьям при открытии: [смещение по X, смещение по Y, поворот, цвет, форма, задержка]. */
export const BURST_LEAVES: Array<[number, number, number, string, 'maple' | 'ovate', number]> = [
  [-46, -70, -40, '#c8321f', 'maple', 0],
  [-30, -92, 30, '#ee8a2b', 'ovate', 0.05],
  [-12, -104, 70, '#f2b33d', 'ovate', 0.1],
  [8, -96, -20, '#7a2e6b', 'ovate', 0.02],
  [26, -108, 50, '#c8321f', 'maple', 0.08],
  [44, -84, -60, '#ee8a2b', 'maple', 0.04],
  [58, -58, 25, '#f2b33d', 'ovate', 0.12],
  [-58, -48, 80, '#ee8a2b', 'ovate', 0.06],
  [-20, -60, -80, '#c8321f', 'ovate', 0.14],
  [18, -66, 15, '#7a2e6b', 'maple', 0.09],
];
