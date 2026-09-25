import { DEFAULT_CLOSING, type ClosingContent, type EventStatus } from '@/lib/content';
import type { Planting, Teacher } from '@/lib/garden/types';

/** Учитель вместе с тем, что видит только администратор (личное пожелание). */
export interface StoredTeacher extends Teacher {
  wish: string;
}

export interface StudentCode {
  plantingId: number | null;
  label?: string;
}

/**
 * Всё состояние клумбы. На сервере лежит в одном JSON-файле (lib/server/store.ts),
 * в демо-режиме — в памяти браузера. Правила работы с ним — в lib/core/engine.ts, одни и те же для обоих.
 */
export interface GardenState {
  schema: 1;
  status: EventStatus;
  closing: ClosingContent;
  teachers: StoredTeacher[];
  plantings: Planting[];
  /** нормализованный код → посадка (null — код ещё не использован) */
  studentCodes: Record<string, StudentCode>;
  /** нормализованный код → id учителя (или директора) */
  teacherCodes: Record<string, number>;
  nextTeacherId: number;
  nextPlantingId: number;
  /**
   * Номер версии «метаданных»: статус, тексты, учителя. Растёт при каждом изменении из админки.
   * Если открытая страница видит новую версию — она перезагружает клумбу целиком
   * (так пропадают цветы удалённого учителя).
   */
  version: number;
}

export const DIRECTOR_ID = 1;

export const DIRECTOR_WISH =
  'Спасибо вам за то, что наша школа — это место, куда хочется приходить каждый день. За вашу мудрость, ' +
  'заботу о каждом ученике и каждом учителе, за умение вдохновлять и вести за собой.\n\n' +
  'Этот подсолнух в самом центре клумбы — для вас: как солнце, вокруг которого растёт весь наш сад. ' +
  'Желаем вам крепкого здоровья, сил, тепла и множества поводов для гордости за нашу школу!';

/** Директор школы — всегда есть на клумбе, удалить её нельзя (изменить — можно). */
export function makeDirector(allFlowerIds: number[]): StoredTeacher {
  return {
    id: DIRECTOR_ID,
    lastName: 'Дмитриева',
    firstName: 'Любовь',
    middleName: 'Валентиновна',
    subject: 'Директор школы',
    color: '#F5B400',
    flowerIds: [...allFlowerIds],
    isDirector: true,
    wish: DIRECTOR_WISH,
  };
}

export function emptyState(allFlowerIds: number[]): GardenState {
  return {
    schema: 1,
    status: 'open',
    closing: { ...DEFAULT_CLOSING },
    teachers: [makeDirector(allFlowerIds)],
    plantings: [],
    studentCodes: {},
    teacherCodes: {},
    nextTeacherId: DIRECTOR_ID + 1,
    nextPlantingId: 1,
    version: 1,
  };
}
