import type { FlowerType } from './types';

/** Все цветы, которые можно посадить. Рисуются кодом (lib/garden/flowers.ts) и красятся в выбранный цвет. */
export const FLOWERS: FlowerType[] = [
  { id: 1, name: 'Тюльпан', kind: 'tulip' },
  { id: 2, name: 'Роза', kind: 'rose' },
  { id: 3, name: 'Мак', kind: 'poppy' },
  { id: 4, name: 'Ромашка', kind: 'daisy' },
  { id: 5, name: 'Василёк', kind: 'cornflower' },
  { id: 6, name: 'Подсолнух', kind: 'sunflower' },
  { id: 7, name: 'Астра', kind: 'aster' },
  { id: 8, name: 'Хризантема', kind: 'chrysanthemum' },
  { id: 9, name: 'Колокольчик', kind: 'bellflower' },
];

export const ALL_FLOWER_IDS = FLOWERS.map((f) => f.id);
