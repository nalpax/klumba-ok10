export type FlowerKind =
  | 'tulip'
  | 'rose'
  | 'poppy'
  | 'daisy'
  | 'cornflower'
  | 'sunflower';

export const FLOWER_KINDS: FlowerKind[] = [
  'tulip',
  'rose',
  'poppy',
  'daisy',
  'cornflower',
  'sunflower',
];

/** Тип цветка из таблицы flowers. */
export interface FlowerType {
  id: number;
  name: string;
  kind: FlowerKind;
}

/** Цвет из палитры (таблица flower_colors). */
export interface FlowerColor {
  id: number;
  name: string;
  hex: string; // #RRGGBB
}

/** Учитель из таблицы teachers (то, что нужно сайту). */
export interface Teacher {
  id: number;
  firstName: string;
  middleName: string;
  lastName: string;
  subject: string;
  description?: string;
  photoUrl?: string | null;
  /** Акцентный цвет учителя: точка в списках. На цвет цветка не влияет — его выбирает ученик. */
  color: string;
  /** Какие цветы можно посадить для этого учителя (teacher_flowers). */
  flowerIds: number[];
}

/** Один посаженный цветок. x, y — нормализованные (0..1) координаты основания стебля. */
export interface Planting {
  id: number;
  teacherId: number;
  flowerId: number;
  /** Цвет, который выбрал ученик. */
  color: string;
  slotId: number;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  variant: number;
  createdAt: number; // ms since epoch
}

/** Свободное место на клумбе (таблица garden_slots). */
export interface Slot {
  id: number;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  variant: number;
}
