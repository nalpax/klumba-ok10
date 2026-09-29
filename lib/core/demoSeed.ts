import { normalizeCode } from '@/lib/codes';
import { ALL_FLOWER_IDS } from '@/lib/garden/catalog';
import { FLOWER_COLORS } from '@/lib/garden/palette';
import { mulberry32 } from '@/lib/garden/rng';
import { allSlots } from '@/lib/garden/slots';
import type { Planting } from '@/lib/garden/types';
import { SUBJECT_AREAS } from './areas';
import { emptyState, type GardenState } from './state';

/** Демо: те же предметные области, что и на настоящей клумбе (lib/core/areas.ts). */
export const DEMO_TEACHERS = SUBJECT_AREAS;

export const DEMO_STUDENT_CODES = ['M4NTF-E43AD', 'EN4NX-W7TKA', 'FRTRN-TMNFC'];
/** Первый — код директора, дальше — коды предметных областей по порядку. */
export const DEMO_TEACHER_CODES = [
  'DMTRW-AHJK4', 'JHMN9-3YKAH', '3Y9FW-7PRKM', 'D9ACW-DCWDH', '7Y4DH-A7NP7',
  'NMNHA-AM4RA', 'MHRCK-XKJMR', 'N9P77-9C9EW', 'FNNP9-JF479',
];

/** Состояние для предпросмотра: директор, восемь предметных областей, 420 уже посаженных цветов и готовые коды. */
export function demoState(plantedCount = 420): GardenState {
  const state = emptyState(ALL_FLOWER_IDS);
  // у директора цветов для примера чуть больше
  const weights = new Map<number, number>([[1, 6]]);
  for (const t of DEMO_TEACHERS) weights.set(t.id, t.weight);

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
