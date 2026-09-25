import { EMBLEM_HOLE, LAWN, WORLD_H, WORLD_W } from './constants';
import { FLOWER_COLORS } from './palette';
import { mulberry32 } from './rng';
import type { FlowerType, Planting, Slot, Teacher } from './types';

export const DEMO_FLOWERS: FlowerType[] = [
  { id: 1, name: 'Тюльпан', kind: 'tulip' },
  { id: 2, name: 'Роза', kind: 'rose' },
  { id: 3, name: 'Мак', kind: 'poppy' },
  { id: 4, name: 'Ромашка', kind: 'daisy' },
  { id: 5, name: 'Василёк', kind: 'cornflower' },
  { id: 6, name: 'Подсолнух', kind: 'sunflower' },
];

export interface DemoTeacher extends Teacher {
  /** Личное пожелание для открытки (в базе — teacher_cards.wish). */
  wish: string;
  /** Насколько часто для этого учителя сажают цветы в демо. */
  weight: number;
}

export const DEMO_TEACHERS: DemoTeacher[] = [
  {
    id: 1, lastName: 'Иванов', firstName: 'Иван', middleName: 'Петрович', subject: 'Математика',
    color: '#E03131', flowerIds: [1, 2, 3], weight: 5,
    wish:
      'Спасибо, что вы умеете объяснять сложное так, что оно становится понятным. С вами математика перестаёт пугать и начинает нравиться.\n\n' +
      'Желаем вам учеников, которые задают трудные вопросы, и времени на то, что вы любите больше всего.',
  },
  {
    id: 2, lastName: 'Петрова', firstName: 'Мария', middleName: 'Сергеевна', subject: 'География',
    color: '#2F7CD8', flowerIds: [1, 5, 4], weight: 3.5,
    wish:
      'Благодаря вам карта перестала быть просто картинкой: за каждой точкой на ней мы видим страну, людей и приключение.\n\n' +
      'Пусть впереди у вас будет много интересных дорог, а в школе — благодарные попутчики.',
  },
  {
    id: 3, lastName: 'Сидорова', firstName: 'Анна', middleName: 'Викторовна', subject: 'Биология',
    color: '#7CB518', flowerIds: [1, 4, 6], weight: 2.6,
    wish:
      'Вы учите нас замечать живое: в листе, в капле воды, в каждом из нас. Спасибо за терпение и за любовь к своему предмету.\n\n' +
      'Пусть всё, что вы посеяли в нас, обязательно вырастет.',
  },
  {
    id: 4, lastName: 'Кузнецов', firstName: 'Сергей', middleName: 'Александрович', subject: 'История',
    color: '#F4C20D', flowerIds: [1, 6, 4], weight: 4,
    wish:
      'С вами история оживает: даты становятся судьбами, а события — уроками. Спасибо за честный разговор и за умение слушать.\n\n' +
      'Желаем вам крепкого здоровья, бодрости и учеников, которые запомнят ваши уроки надолго.',
  },
  {
    id: 5, lastName: 'Смирнова', firstName: 'Ольга', middleName: 'Николаевна', subject: 'Литература',
    color: '#9B4DCA', flowerIds: [1, 2, 5], weight: 3,
    wish:
      'Благодаря вам мы читаем не ради оценки, а ради себя. Спасибо за книги, которые вы нам открыли, и за слова, которые вы находите для каждого.\n\n' +
      'Пусть в вашей жизни будет много хороших историй.',
  },
  {
    id: 6, lastName: 'Попов', firstName: 'Дмитрий', middleName: 'Андреевич', subject: 'Физика',
    color: '#F08A24', flowerIds: [3, 6, 1], weight: 2.2,
    wish:
      'Вы показали нам, что за формулами стоит настоящий мир. Спасибо за опыты, которые получаются, и за те, что не получаются — с ними тоже интересно.\n\n' +
      'Пусть у вас всегда всё сходится, а настроение остаётся на высоте.',
  },
  {
    id: 7, lastName: 'Васильева', firstName: 'Елена', middleName: 'Игоревна', subject: 'Химия',
    color: '#D6337F', flowerIds: [2, 1, 3], weight: 2,
    wish:
      'Спасибо за уроки, после которых хочется остаться в кабинете ещё на пять минут. С вами даже самая сложная реакция получается.\n\n' +
      'Желаем вам тепла, добрых учеников и много поводов для радости.',
  },
  {
    id: 8, lastName: 'Морозова', firstName: 'Наталья', middleName: 'Владимировна', subject: 'Английский язык',
    color: '#1FA2A6', flowerIds: [5, 4, 1], weight: 3,
    wish:
      'Вы открыли для нас целый мир и научили не бояться говорить. Спасибо за поддержку, за терпение и за улыбку на каждом уроке.\n\n' +
      'Пусть впереди будет много путешествий и тёплых встреч.',
  },
];

/**
 * Клиентская копия SQL-генератора мест (supabase/migrations/0004_seed.sql):
 * шестиугольная сетка с шумом внутри овала, без зоны подсолнуха.
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

function pickTeacher(rnd: () => number): DemoTeacher {
  const total = DEMO_TEACHERS.reduce((s, t) => s + t.weight, 0);
  let r = rnd() * total;
  for (const t of DEMO_TEACHERS) {
    r -= t.weight;
    if (r <= 0) return t;
  }
  return DEMO_TEACHERS[0];
}

export function makeDemoPlanting(id: number, slot: Slot, rnd: () => number, createdAt: number): Planting {
  const t = pickTeacher(rnd);
  return {
    id,
    teacherId: t.id,
    flowerId: t.flowerIds[Math.floor(rnd() * t.flowerIds.length)],
    color: FLOWER_COLORS[Math.floor(rnd() * FLOWER_COLORS.length)].hex,
    slotId: slot.id,
    x: slot.x,
    y: slot.y,
    scale: slot.scale,
    rotation: slot.rotation,
    variant: slot.variant,
    createdAt,
  };
}

export function makeDemoPlantings(count: number, slots: Slot[], seed = 3): Planting[] {
  const rnd = mulberry32(seed);
  const now = Date.now();
  return slots.slice(0, count).map((s, i) => makeDemoPlanting(i + 1, s, rnd, now - (count - i) * 45_000));
}
