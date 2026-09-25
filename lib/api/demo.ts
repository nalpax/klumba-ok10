import { CODE_ALPHABET, CODE_LENGTH, formatCode, normalizeCode, normalizeWord } from '@/lib/codes';
import { DEFAULT_CLOSING, type ClosingContent, type EventStatus } from '@/lib/content';
import {
  DEMO_FLOWERS,
  DEMO_TEACHERS,
  generateSlots,
  makeDemoPlanting,
  makeDemoPlantings,
  type DemoTeacher,
} from '@/lib/garden/demo';
import { FLOWER_COLORS } from '@/lib/garden/palette';
import { mulberry32 } from '@/lib/garden/rng';
import type { Planting, Slot, Teacher } from '@/lib/garden/types';
import { fullName } from '@/lib/names';
import type {
  Api,
  AdminResult,
  AdminStats,
  AdminTeacherResult,
  CardResult,
  GardenSnapshot,
  LoginResult,
  PlantInput,
  PlantResult,
  TeacherInput,
} from './types';

const DEMO_STUDENT_CODES = ['M4NTF-E43AD', 'EN4NX-W7TKA', 'FRTRN-TMNFC'];
const DEMO_TEACHER_CODES = [
  'JHMN9-3YKAH', '3Y9FW-7PRKM', 'D9ACW-DCWDH', '7Y4DH-A7NP7',
  'NMNHA-AM4RA', 'MHRCK-XKJMR', 'N9P77-9C9EW', 'FNNP9-JF479',
];

/**
 * Слово-код администратора — вход для организатора (не ученика и не учителя), см. lib/codes.ts.
 * ВАЖНО: это удобство именно для этого демо-предпросмотра (клиентский код виден в исходниках
 * страницы). На настоящем сайте вход администратора должен идти через Supabase Auth
 * (email + пароль, уже настроено в supabase/migrations/0002_security.sql + admins) — там
 * пароль не лежит в открытом виде в коде, который получает браузер.
 */
export const DEMO_ADMIN_WORD = 'ПОДСОЛНУХ';

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function toPublicTeacher(t: DemoTeacher): Teacher {
  const { wish: _wish, weight: _weight, ...pub } = t;
  return pub;
}

function genCode(taken: (code: string) => boolean): string {
  for (let tries = 0; tries < 50; tries++) {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    if (!taken(code)) return code;
  }
  return String(Date.now()); // практически недостижимо, просто чтобы всегда что-то вернуть
}

/**
 * Демо-«сервер» в памяти браузера: те же правила, что в SQL (один код — один цветок,
 * занятое место нельзя выбрать, выбор проверяется), но без базы. Данные живут до перезагрузки страницы.
 */
export function createDemoApi(options: { simulateOthers?: boolean; status?: EventStatus } = {}): Api {
  const { simulateOthers = true, status: initialStatus = 'open' } = options;
  let status: EventStatus = initialStatus;
  let closing: ClosingContent = { ...DEFAULT_CLOSING };

  // изменяемая копия демо-учителей: админка правит именно её, DEMO_TEACHERS остаётся эталоном
  let teachers: DemoTeacher[] = DEMO_TEACHERS.map((t) => ({ ...t, flowerIds: [...t.flowerIds] }));
  let nextTeacherId = Math.max(...teachers.map((t) => t.id)) + 1;

  const slots = generateSlots();
  const slotById = new Map(slots.map((s) => [s.id, s]));
  const plantings: Planting[] = makeDemoPlantings(420, slots);
  const taken = new Set<number>(plantings.map((p) => p.slotId));
  const listeners = new Set<(p: Planting) => void>();
  const metaListeners = new Set<() => void>();
  const rnd = mulberry32(777);
  let nextId = plantings.length + 1;

  const studentCodes = new Map<string, { plantingId: number | null; label?: string }>();
  for (const c of DEMO_STUDENT_CODES) studentCodes.set(normalizeCode(c), { plantingId: null });
  const teacherCodes = new Map<string, number>();
  DEMO_TEACHER_CODES.forEach((c, i) => teacherCodes.set(normalizeCode(c), teachers[i].id));

  const publish = (p: Planting) => {
    plantings.push(p);
    for (const l of listeners) l(p);
  };
  const publishMeta = () => {
    for (const l of metaListeners) l();
  };

  const addRandomPlanting = () => {
    if (status !== 'open') return;
    const free = slots.filter((s) => !taken.has(s.id));
    const withFlowers = teachers.filter((t) => t.flowerIds.length > 0);
    if (free.length === 0 || withFlowers.length === 0) return;
    const slot = free[Math.floor(rnd() * free.length)];
    taken.add(slot.id);
    const t = withFlowers[Math.floor(rnd() * withFlowers.length)];
    const flowerId = t.flowerIds.length ? t.flowerIds[Math.floor(rnd() * t.flowerIds.length)] : DEMO_FLOWERS[0].id;
    const color = FLOWER_COLORS[Math.floor(rnd() * FLOWER_COLORS.length)].hex;
    publish({
      id: nextId++,
      teacherId: t.id,
      flowerId,
      color,
      slotId: slot.id,
      x: slot.x,
      y: slot.y,
      scale: slot.scale,
      rotation: slot.rotation,
      variant: slot.variant,
      createdAt: Date.now(),
    });
  };

  let timer: ReturnType<typeof setInterval> | null = null;

  const api: Api = {
    mode: 'demo',
    demoCodes: {
      students: DEMO_STUDENT_CODES,
      teachers: DEMO_TEACHER_CODES.slice(0, 3).map((code, i) => ({ code, name: fullName(teachers[i]) })),
      admin: DEMO_ADMIN_WORD,
    },

    async load(): Promise<GardenSnapshot> {
      await wait(120);
      return {
        status,
        closing: { ...closing },
        teachers: teachers.map(toPublicTeacher),
        flowers: DEMO_FLOWERS,
        colors: FLOWER_COLORS,
        plantings: [...plantings],
      };
    },

    subscribe(onPlanting) {
      listeners.add(onPlanting);
      if (simulateOthers && !timer) timer = setInterval(addRandomPlanting, 11_000);
      return () => {
        listeners.delete(onPlanting);
        if (listeners.size === 0 && timer) {
          clearInterval(timer);
          timer = null;
        }
      };
    },

    subscribeMeta(onChange) {
      metaListeners.add(onChange);
      return () => metaListeners.delete(onChange);
    },

    async freeSlots(): Promise<Slot[]> {
      await wait(150);
      return slots.filter((s) => !taken.has(s.id));
    },

    async login(rawCode: string): Promise<LoginResult> {
      await wait(350);

      // слово администратора проверяем отдельно и до общей проверки формы кода —
      // оно не обязано быть похоже на 10-значные коды учеников/учителей
      if (normalizeWord(rawCode) === normalizeWord(DEMO_ADMIN_WORD)) {
        return { ok: true, role: 'admin' };
      }

      const code = normalizeCode(rawCode);
      const teacherId = teacherCodes.get(code);
      if (teacherId !== undefined) {
        if (status === 'draft') return { ok: false, error: 'not_open' };
        const t = teachers.find((x) => x.id === teacherId);
        if (!t) return { ok: false, error: 'invalid_code' };
        return {
          ok: true,
          role: 'teacher',
          teacher: {
            id: t.id,
            firstName: t.firstName,
            middleName: t.middleName,
            lastName: t.lastName,
            subject: t.subject,
            photoUrl: null,
          },
          planted: plantings.filter((p) => p.teacherId === t.id).length,
          opened: false,
        };
      }
      const st = studentCodes.get(code);
      if (!st) return { ok: false, error: 'invalid_code' };
      if (st.plantingId !== null) {
        return { ok: true, role: 'student', status: 'used', planting: plantings.find((p) => p.id === st.plantingId) ?? null };
      }
      if (status === 'closed') return { ok: false, error: 'closed' };
      if (status === 'draft') return { ok: false, error: 'not_open' };
      return { ok: true, role: 'student', status: 'unused' };
    },

    async plant(input: PlantInput): Promise<PlantResult> {
      await wait(450);
      if (status !== 'open') return { ok: false, error: status === 'closed' ? 'closed' : 'not_open' };
      const code = normalizeCode(input.code);
      if (teacherCodes.has(code)) return { ok: false, error: 'not_student_code' };
      const st = studentCodes.get(code);
      if (!st) return { ok: false, error: 'invalid_code' };
      if (st.plantingId !== null) return { ok: false, error: 'code_used' };

      const teacher = teachers.find((t) => t.id === input.teacherId);
      const flower = DEMO_FLOWERS.find((f) => f.id === input.flowerId);
      const color = FLOWER_COLORS.find((c) => c.hex.toUpperCase() === input.color.toUpperCase());
      if (!teacher || !flower || !color || !teacher.flowerIds.includes(flower.id)) {
        return { ok: false, error: 'invalid_choice' };
      }
      const slot = slotById.get(input.slotId);
      if (!slot || taken.has(slot.id)) return { ok: false, error: 'slot_taken' };

      taken.add(slot.id);
      const planting: Planting = {
        id: nextId++,
        teacherId: teacher.id,
        flowerId: flower.id,
        color: color.hex,
        slotId: slot.id,
        x: slot.x,
        y: slot.y,
        scale: slot.scale,
        rotation: slot.rotation,
        variant: slot.variant,
        createdAt: Date.now(),
      };
      st.plantingId = planting.id;
      publish(planting);
      return { ok: true, planting };
    },

    async openCard(rawCode: string): Promise<CardResult> {
      await wait(400);
      const teacherId = teacherCodes.get(normalizeCode(rawCode));
      if (teacherId === undefined) return { ok: false, error: 'invalid_code' };
      const t = teachers.find((x) => x.id === teacherId);
      if (!t) return { ok: false, error: 'invalid_code' };
      return { ok: true, wish: t.wish, planted: plantings.filter((p) => p.teacherId === t.id).length };
    },

    async adminStats(): Promise<AdminStats> {
      await wait(200);
      const byTeacher: Record<number, number> = {};
      for (const p of plantings) byTeacher[p.teacherId] = (byTeacher[p.teacherId] ?? 0) + 1;
      let studentCodesUsed = 0;
      for (const v of studentCodes.values()) if (v.plantingId !== null) studentCodesUsed++;
      return {
        plantings: plantings.length,
        studentCodesTotal: studentCodes.size,
        studentCodesUsed,
        teacherCodesTotal: teacherCodes.size,
        slotsTotal: slots.length,
        slotsFree: slots.length - taken.size,
        teachersWithoutWish: teachers.filter((t) => !t.wish.trim()).length,
        byTeacher,
      };
    },

    async adminSetStatus(next: EventStatus): Promise<AdminResult> {
      await wait(250);
      status = next;
      publishMeta();
      return { ok: true };
    },

    async adminSetClosing(next: ClosingContent): Promise<AdminResult> {
      await wait(250);
      const title = next.title.trim();
      const text = next.text.trim();
      if (!title || !text) return { ok: false, error: 'validation' };
      closing = { title, text, showStats: next.showStats };
      publishMeta();
      return { ok: true };
    },

    async adminSaveTeacher(input: TeacherInput): Promise<AdminTeacherResult> {
      await wait(300);
      const firstName = input.firstName.trim();
      const lastName = input.lastName.trim();
      const subject = input.subject.trim();
      if (!firstName || !lastName || !subject || !/^#[0-9A-Fa-f]{6}$/.test(input.color) || input.flowerIds.length === 0) {
        return { ok: false, error: 'validation' };
      }
      const flowerIds = input.flowerIds.filter((id) => DEMO_FLOWERS.some((f) => f.id === id));

      if (input.id != null) {
        const idx = teachers.findIndex((t) => t.id === input.id);
        if (idx === -1) return { ok: false, error: 'invalid_choice' };
        teachers[idx] = {
          ...teachers[idx],
          firstName,
          middleName: input.middleName.trim(),
          lastName,
          subject,
          color: input.color,
          flowerIds,
          wish: input.wish.trim(),
        };
        publishMeta();
        return { ok: true, teacher: toPublicTeacher(teachers[idx]) };
      }

      const t: DemoTeacher = {
        id: nextTeacherId++,
        firstName,
        middleName: input.middleName.trim(),
        lastName,
        subject,
        color: input.color,
        flowerIds,
        wish: input.wish.trim(),
        weight: 1,
      };
      teachers = [...teachers, t];
      const code = genCode((c) => studentCodes.has(c) || teacherCodes.has(c));
      teacherCodes.set(code, t.id);
      publishMeta();
      return { ok: true, teacher: toPublicTeacher(t), code: formatCode(code) };
    },

    async adminDeleteTeacher(id: number): Promise<AdminResult> {
      await wait(250);
      if (plantings.some((p) => p.teacherId === id)) {
        return { ok: false, error: 'has_plantings' };
      }
      teachers = teachers.filter((t) => t.id !== id);
      for (const [code, tid] of teacherCodes) if (tid === id) teacherCodes.delete(code);
      publishMeta();
      return { ok: true };
    },

    async adminListTeachers(): Promise<TeacherInput[]> {
      await wait(150);
      return teachers.map((t) => ({
        id: t.id,
        firstName: t.firstName,
        middleName: t.middleName,
        lastName: t.lastName,
        subject: t.subject,
        color: t.color,
        flowerIds: [...t.flowerIds],
        wish: t.wish,
      }));
    },

    async adminGenerateStudentCodes(count, label) {
      await wait(350);
      if (!Number.isFinite(count) || count < 1 || count > 500) {
        return { ok: false, error: 'validation' };
      }
      if (studentCodes.size + count > slots.length) {
        return { ok: false, error: 'garden_full' };
      }
      const cleanLabel = label.trim() || undefined;
      const codes: string[] = [];
      for (let i = 0; i < count; i++) {
        const code = genCode((c) => studentCodes.has(c) || teacherCodes.has(c));
        studentCodes.set(code, { plantingId: null, label: cleanLabel });
        codes.push(formatCode(code));
      }
      publishMeta();
      return { ok: true, codes };
    },

    async adminGenerateTeacherCode(teacherId) {
      await wait(250);
      if (!teachers.some((t) => t.id === teacherId)) {
        return { ok: false, error: 'invalid_choice' };
      }
      // у учителя действует только один код — старый (если был) отзываем
      for (const [c, tid] of teacherCodes) if (tid === teacherId) teacherCodes.delete(c);
      const code = genCode((c) => studentCodes.has(c) || teacherCodes.has(c));
      teacherCodes.set(code, teacherId);
      return { ok: true, code: formatCode(code) };
    },

    async adminExportCodes(): Promise<string> {
      await wait(250);
      const lines = ['code,role,teacher,status,label'];
      for (const [code, st] of studentCodes) {
        lines.push(
          `${formatCode(code)},student,,${st.plantingId !== null ? 'USED' : 'UNUSED'},${st.label ? `"${st.label.replace(/"/g, '""')}"` : ''}`,
        );
      }
      for (const [code, tid] of teacherCodes) {
        const t = teachers.find((x) => x.id === tid);
        lines.push(`${formatCode(code)},teacher,"${t ? fullName(t).replace(/"/g, '""') : ''}",-,`);
      }
      return lines.join('\n');
    },
  };
  return api;
}
