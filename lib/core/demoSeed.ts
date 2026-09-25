import { normalizeCode } from '@/lib/codes';
import { ALL_FLOWER_IDS } from '@/lib/garden/catalog';
import { FLOWER_COLORS } from '@/lib/garden/palette';
import { mulberry32 } from '@/lib/garden/rng';
import { allSlots } from '@/lib/garden/slots';
import type { Planting } from '@/lib/garden/types';
import { emptyState, type GardenState, type StoredTeacher } from './state';

/** Демо-учителя: только для предпросмотра (в демо-режиме) и для npm run seed:demo на сервере. */
export const DEMO_TEACHERS: Array<Omit<StoredTeacher, 'flowerIds'> & { weight: number }> = [
  {
    id: 2, lastName: 'Иванов', firstName: 'Иван', middleName: 'Петрович', subject: 'Математика', color: '#E03131', weight: 5,
    wish:
      'Спасибо, что вы умеете объяснять сложное так, что оно становится понятным. С вами математика перестаёт пугать и начинает нравиться.\n\n' +
      'Желаем вам учеников, которые задают трудные вопросы, и времени на то, что вы любите больше всего.',
  },
  {
    id: 3, lastName: 'Петрова', firstName: 'Мария', middleName: 'Сергеевна', subject: 'География', color: '#2F7CD8', weight: 3.5,
    wish:
      'Благодаря вам карта перестала быть просто картинкой: за каждой точкой на ней мы видим страну, людей и приключение.\n\n' +
      'Пусть впереди у вас будет много интересных дорог, а в школе — благодарные попутчики.',
  },
  {
    id: 4, lastName: 'Сидорова', firstName: 'Анна', middleName: 'Викторовна', subject: 'Биология', color: '#7CB518', weight: 2.6,
    wish:
      'Вы учите нас замечать живое: в листе, в капле воды, в каждом из нас. Спасибо за терпение и за любовь к своему предмету.\n\n' +
      'Пусть всё, что вы посеяли в нас, обязательно вырастет.',
  },
  {
    id: 5, lastName: 'Кузнецов', firstName: 'Сергей', middleName: 'Александрович', subject: 'История', color: '#F4C20D', weight: 4,
    wish:
      'С вами история оживает: даты становятся судьбами, а события — уроками. Спасибо за честный разговор и за умение слушать.\n\n' +
      'Желаем вам крепкого здоровья, бодрости и учеников, которые запомнят ваши уроки надолго.',
  },
  {
    id: 6, lastName: 'Смирнова', firstName: 'Ольга', middleName: 'Николаевна', subject: 'Литература', color: '#9B4DCA', weight: 3,
    wish:
      'Благодаря вам мы читаем не ради оценки, а ради себя. Спасибо за книги, которые вы нам открыли, и за слова, которые вы находите для каждого.\n\n' +
      'Пусть в вашей жизни будет много хороших историй.',
  },
  {
    id: 7, lastName: 'Попов', firstName: 'Дмитрий', middleName: 'Андреевич', subject: 'Физика', color: '#F08A24', weight: 2.2,
    wish:
      'Вы показали нам, что за формулами стоит настоящий мир. Спасибо за опыты, которые получаются, и за те, что не получаются — с ними тоже интересно.\n\n' +
      'Пусть у вас всегда всё сходится, а настроение остаётся на высоте.',
  },
  {
    id: 8, lastName: 'Васильева', firstName: 'Елена', middleName: 'Игоревна', subject: 'Химия', color: '#D6337F', weight: 2,
    wish:
      'Спасибо за уроки, после которых хочется остаться в кабинете ещё на пять минут. С вами даже самая сложная реакция получается.\n\n' +
      'Желаем вам тепла, добрых учеников и много поводов для радости.',
  },
  {
    id: 9, lastName: 'Морозова', firstName: 'Наталья', middleName: 'Владимировна', subject: 'Английский язык', color: '#1FA2A6', weight: 3,
    wish:
      'Вы открыли для нас целый мир и научили не бояться говорить. Спасибо за поддержку, за терпение и за улыбку на каждом уроке.\n\n' +
      'Пусть впереди будет много путешествий и тёплых встреч.',
  },
];

export const DEMO_STUDENT_CODES = ['M4NTF-E43AD', 'EN4NX-W7TKA', 'FRTRN-TMNFC'];
/** Первый — код директора, дальше — коды демо-учителей по порядку. */
export const DEMO_TEACHER_CODES = [
  'DMTRW-AHJK4', 'JHMN9-3YKAH', '3Y9FW-7PRKM', 'D9ACW-DCWDH', '7Y4DH-A7NP7',
  'NMNHA-AM4RA', 'MHRCK-XKJMR', 'N9P77-9C9EW', 'FNNP9-JF479',
];

/** Состояние для предпросмотра: директор, восемь учителей, 420 уже посаженных цветов и готовые коды. */
export function demoState(plantedCount = 420): GardenState {
  const state = emptyState(ALL_FLOWER_IDS);
  // у директора цветов для примера чуть больше
  const weights = new Map<number, number>([[1, 6]]);
  for (const t of DEMO_TEACHERS) {
    const { weight, ...rest } = t;
    state.teachers.push({ ...rest, flowerIds: [...ALL_FLOWER_IDS] });
    weights.set(t.id, weight);
  }
  state.nextTeacherId = Math.max(...state.teachers.map((t) => t.id)) + 1;

  const rnd = mulberry32(3);
  const total = [...weights.values()].reduce((a, b) => a + b, 0);
  const pickTeacher = () => {
    let r = rnd() * total;
    for (const [id, w] of weights) {
      r -= w;
      if (r <= 0) return id;
    }
    return 1;
  };
  const now = Date.now();
  const slots = allSlots();
  state.plantings = slots.slice(0, plantedCount).map<Planting>((s, i) => ({
    id: i + 1,
    teacherId: pickTeacher(),
    flowerId: ALL_FLOWER_IDS[Math.floor(rnd() * ALL_FLOWER_IDS.length)],
    color: FLOWER_COLORS[Math.floor(rnd() * FLOWER_COLORS.length)].hex,
    slotId: s.id,
    x: s.x,
    y: s.y,
    scale: s.scale,
    rotation: s.rotation,
    variant: s.variant,
    createdAt: now - (plantedCount - i) * 45_000,
  }));
  state.nextPlantingId = plantedCount + 1;

  for (const c of DEMO_STUDENT_CODES) state.studentCodes[normalizeCode(c)] = { plantingId: null };
  const teacherIds = [1, ...DEMO_TEACHERS.map((t) => t.id)];
  DEMO_TEACHER_CODES.forEach((c, i) => {
    state.teacherCodes[normalizeCode(c)] = teacherIds[i];
  });
  return state;
}
