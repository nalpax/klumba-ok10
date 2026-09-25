import type { FlowerColor } from './types';

/**
 * Цвета, из которых ученик выбирает цвет цветка. В базе они лежат в таблице flower_colors
 * (админ может добавлять и отключать); этот список — то же самое для демо и запасной вариант.
 */
export const FLOWER_COLORS: FlowerColor[] = [
  { id: 1, name: 'Красный', hex: '#E03131' },
  { id: 2, name: 'Малиновый', hex: '#C2255C' },
  { id: 3, name: 'Розовый', hex: '#F783AC' },
  { id: 4, name: 'Персиковый', hex: '#FFA574' },
  { id: 5, name: 'Оранжевый', hex: '#F08C00' },
  { id: 6, name: 'Жёлтый', hex: '#F5C518' },
  { id: 7, name: 'Салатовый', hex: '#A9E34B' },
  { id: 8, name: 'Бирюзовый', hex: '#15AABF' },
  { id: 9, name: 'Голубой', hex: '#6CB4F5' },
  { id: 10, name: 'Синий', hex: '#2F6FDE' },
  { id: 11, name: 'Фиолетовый', hex: '#7950F2' },
  { id: 12, name: 'Сиреневый', hex: '#B197FC' },
  { id: 13, name: 'Белый', hex: '#F8F4E8' },
  { id: 14, name: 'Бордовый', hex: '#8C2F4B' },
];
