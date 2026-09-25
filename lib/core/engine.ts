import type {
  AdminStats,
  ApiError,
  CardResult,
  GardenSnapshot,
  LoginResult,
  PlantInput,
  PlantResult,
  TeacherInput,
} from '@/lib/api/types';
import { CODE_ALPHABET, CODE_LENGTH, formatCode, isValidCodeShape, normalizeCode } from '@/lib/codes';
import type { ClosingContent, EventStatus } from '@/lib/content';
import { FLOWERS } from '@/lib/garden/catalog';
import { FLOWER_COLORS } from '@/lib/garden/palette';
import { allSlots, slotById } from '@/lib/garden/slots';
import type { Planting, Slot, Teacher } from '@/lib/garden/types';
import { fullName } from '@/lib/names';
import type { GardenState, StoredTeacher } from './state';

/**
 * Правила клумбы. Функции получают состояние и меняют его на месте; вызывающий код
 * (сервер или демо) отвечает только за хранение и доставку изменений.
 * Всё синхронное: в Node.js запросы выполняются по одному, поэтому одновременные посадки
 * с одним кодом или на одно место физически не могут «проскочить» обе.
 */

type Fail = { ok: false; error: ApiError };
const fail = (error: ApiError): Fail => ({ ok: false, error });

export const MAX_CODES_PER_BATCH = 500;
const MAX_TEXT = 2000;

function toPublic(t: StoredTeacher): Teacher {
  const { wish: _wish, ...pub } = t;
  return pub;
}

/** Директор всегда первым, остальные — по фамилии. */
function sortedTeachers(state: GardenState): StoredTeacher[] {
  return [...state.teachers].sort(
    (a, b) => Number(!!b.isDirector) - Number(!!a.isDirector) || a.lastName.localeCompare(b.lastName, 'ru') || a.id - b.id,
  );
}

function bump(state: GardenState) {
  state.version += 1;
}

function randomCode(): string {
  const bytes = new Uint32Array(CODE_LENGTH);
  globalThis.crypto.getRandomValues(bytes);
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return code;
}

function newCode(state: GardenState): string {
  for (;;) {
    const c = randomCode();
    if (!(c in state.studentCodes) && !(c in state.teacherCodes)) return c;
  }
}

function takenSlots(state: GardenState): Set<number> {
  return new Set(state.plantings.map((p) => p.slotId));
}

/* ------------------------------ публичная часть ------------------------------ */

export function snapshot(state: GardenState): GardenSnapshot {
  return {
    status: state.status,
    closing: { ...state.closing },
    teachers: sortedTeachers(state).map(toPublic),
    flowers: FLOWERS,
    colors: FLOWER_COLORS,
    plantings: [...state.plantings],
    version: state.version,
  };
}

export function plantingsAfter(state: GardenState, afterId: number): Planting[] {
  // посадки добавляются по возрастанию id — ищем с конца
  const out: Planting[] = [];
  for (let i = state.plantings.length - 1; i >= 0 && state.plantings[i].id > afterId; i--) out.push(state.plantings[i]);
  return out.reverse();
}

export function freeSlots(state: GardenState): Slot[] {
  const taken = takenSlots(state);
  return allSlots().filter((s) => !taken.has(s.id));
}

function teacherInfo(t: StoredTeacher) {
  return {
    id: t.id,
    firstName: t.firstName,
    middleName: t.middleName,
    lastName: t.lastName,
    subject: t.subject,
    photoUrl: t.photoUrl ?? null,
    isDirector: !!t.isDirector,
  };
}

/** Вход по 10-значному коду (ученик, учитель или директор). Вход администратора проверяется отдельно. */
export function login(state: GardenState, rawCode: string): LoginResult {
  const code = normalizeCode(rawCode);
  if (!isValidCodeShape(code)) return fail('invalid_code');

  const teacherId = state.teacherCodes[code];
  if (teacherId !== undefined) {
    const t = state.teachers.find((x) => x.id === teacherId);
    if (!t) return fail('invalid_code');
    return {
      ok: true,
      role: 'teacher',
      teacher: teacherInfo(t),
      planted: state.plantings.filter((p) => p.teacherId === t.id).length,
      opened: false,
    };
  }

  const st = state.studentCodes[code];
  if (!st) return fail('invalid_code');
  if (st.plantingId !== null) {
    return {
      ok: true,
      role: 'student',
      status: 'used',
      planting: state.plantings.find((p) => p.id === st.plantingId) ?? null,
    };
  }
  if (state.status === 'closed') return fail('closed');
  if (state.status === 'draft') return fail('not_open');
  return { ok: true, role: 'student', status: 'unused' };
}

export function plant(state: GardenState, input: PlantInput, now = Date.now()): PlantResult {
  if (state.status !== 'open') return fail(state.status === 'closed' ? 'closed' : 'not_open');
  const code = normalizeCode(String(input.code ?? ''));
  if (code in state.teacherCodes) return fail('not_student_code');
  const st = state.studentCodes[code];
  if (!st) return fail('invalid_code');
  if (st.plantingId !== null) return fail('code_used');

  const teacher = state.teachers.find((t) => t.id === input.teacherId);
  const flower = FLOWERS.find((f) => f.id === input.flowerId);
  const color = FLOWER_COLORS.find((c) => c.hex.toUpperCase() === String(input.color ?? '').toUpperCase());
  if (!teacher || !flower || !color || !teacher.flowerIds.includes(flower.id)) return fail('invalid_choice');

  const slot = slotById(Number(input.slotId));
  if (!slot) return fail('slot_taken');
  if (state.plantings.some((p) => p.slotId === slot.id)) return fail('slot_taken');

  const planting: Planting = {
    id: state.nextPlantingId++,
    teacherId: teacher.id,
    flowerId: flower.id,
    color: color.hex,
    slotId: slot.id,
    x: slot.x,
    y: slot.y,
    scale: slot.scale,
    rotation: slot.rotation,
    variant: slot.variant,
    createdAt: now,
  };
  state.plantings.push(planting);
  st.plantingId = planting.id;
  return { ok: true, planting };
}

export function openCard(state: GardenState, rawCode: string): CardResult {
  const teacherId = state.teacherCodes[normalizeCode(rawCode)];
  if (teacherId === undefined) return fail('invalid_code');
  const t = state.teachers.find((x) => x.id === teacherId);
  if (!t) return fail('invalid_code');
  return { ok: true, wish: t.wish, planted: state.plantings.filter((p) => p.teacherId === t.id).length };
}

/* ---------------------------------- админка ---------------------------------- */

export function adminStats(state: GardenState): AdminStats {
  const byTeacher: Record<number, number> = {};
  for (const p of state.plantings) byTeacher[p.teacherId] = (byTeacher[p.teacherId] ?? 0) + 1;
  const codes = Object.values(state.studentCodes);
  const slotsTotal = allSlots().length;
  return {
    plantings: state.plantings.length,
    studentCodesTotal: codes.length,
    studentCodesUsed: codes.filter((c) => c.plantingId !== null).length,
    teacherCodesTotal: Object.keys(state.teacherCodes).length,
    slotsTotal,
    slotsFree: slotsTotal - takenSlots(state).size,
    teachersWithoutWish: state.teachers.filter((t) => !t.wish.trim()).length,
    byTeacher,
  };
}

export function setStatus(state: GardenState, status: EventStatus): { ok: true } | Fail {
  if (!['draft', 'open', 'closed'].includes(status)) return fail('validation');
  state.status = status;
  bump(state);
  return { ok: true };
}

export function setClosing(state: GardenState, next: ClosingContent): { ok: true } | Fail {
  const title = String(next?.title ?? '').trim().slice(0, 200);
  const text = String(next?.text ?? '').trim().slice(0, MAX_TEXT);
  if (!title || !text) return fail('validation');
  state.closing = { title, text, showStats: !!next.showStats };
  bump(state);
  return { ok: true };
}

export function listTeachers(state: GardenState): TeacherInput[] {
  return sortedTeachers(state).map((t) => ({
    id: t.id,
    firstName: t.firstName,
    middleName: t.middleName,
    lastName: t.lastName,
    subject: t.subject,
    color: t.color,
    flowerIds: [...t.flowerIds],
    wish: t.wish,
    isDirector: !!t.isDirector,
  }));
}

export function saveTeacher(
  state: GardenState,
  input: TeacherInput,
): { ok: true; teacher: Teacher; code?: string } | Fail {
  const clean = (v: unknown, max = 80) => String(v ?? '').trim().slice(0, max);
  const firstName = clean(input.firstName);
  const lastName = clean(input.lastName);
  const middleName = clean(input.middleName);
  const subject = clean(input.subject, 120);
  const color = String(input.color ?? '');
  const flowerIds = Array.isArray(input.flowerIds)
    ? [...new Set(input.flowerIds.map(Number))].filter((id) => FLOWERS.some((f) => f.id === id))
    : [];
  const wish = String(input.wish ?? '').trim().slice(0, MAX_TEXT);
  if (!firstName || !lastName || !subject || !/^#[0-9A-Fa-f]{6}$/.test(color) || flowerIds.length === 0) {
    return fail('validation');
  }

  if (input.id != null) {
    const idx = state.teachers.findIndex((t) => t.id === Number(input.id));
    if (idx === -1) return fail('invalid_choice');
    const prev = state.teachers[idx];
    state.teachers[idx] = { ...prev, firstName, middleName, lastName, subject, color, flowerIds, wish };
    bump(state);
    return { ok: true, teacher: toPublic(state.teachers[idx]) };
  }

  const t: StoredTeacher = { id: state.nextTeacherId++, firstName, middleName, lastName, subject, color, flowerIds, wish };
  state.teachers.push(t);
  const code = newCode(state);
  state.teacherCodes[code] = t.id;
  bump(state);
  return { ok: true, teacher: toPublic(t), code: formatCode(code) };
}

/**
 * Удаляет учителя вместе с его цветами. Места освобождаются, а коды учеников, чьи цветы
 * пропали, снова становятся неиспользованными — ученик сможет посадить цветок другому учителю.
 */
export function deleteTeacher(state: GardenState, id: number): { ok: true; removed: number } | Fail {
  const t = state.teachers.find((x) => x.id === id);
  if (!t) return fail('invalid_choice');
  if (t.isDirector) return fail('director');

  const removedIds = new Set(state.plantings.filter((p) => p.teacherId === id).map((p) => p.id));
  state.plantings = state.plantings.filter((p) => p.teacherId !== id);
  for (const st of Object.values(state.studentCodes)) {
    if (st.plantingId !== null && removedIds.has(st.plantingId)) st.plantingId = null;
  }
  for (const [code, tid] of Object.entries(state.teacherCodes)) if (tid === id) delete state.teacherCodes[code];
  state.teachers = state.teachers.filter((x) => x.id !== id);
  bump(state);
  return { ok: true, removed: removedIds.size };
}

export function generateStudentCodes(
  state: GardenState,
  count: number,
  label: string,
): { ok: true; codes: string[] } | Fail {
  const n = Math.floor(Number(count));
  if (!Number.isFinite(n) || n < 1 || n > MAX_CODES_PER_BATCH) return fail('validation');
  const unused = Object.values(state.studentCodes).filter((c) => c.plantingId === null).length;
  const free = allSlots().length - takenSlots(state).size;
  if (unused + n > free) return fail('garden_full');
  const cleanLabel = String(label ?? '').trim().slice(0, 60) || undefined;
  const codes: string[] = [];
  for (let i = 0; i < n; i++) {
    const code = newCode(state);
    state.studentCodes[code] = cleanLabel ? { plantingId: null, label: cleanLabel } : { plantingId: null };
    codes.push(formatCode(code));
  }
  return { ok: true, codes };
}

/** Новый личный код учителя; старый (если был) перестаёт действовать. */
export function generateTeacherCode(state: GardenState, teacherId: number): { ok: true; code: string } | Fail {
  if (!state.teachers.some((t) => t.id === teacherId)) return fail('invalid_choice');
  for (const [c, tid] of Object.entries(state.teacherCodes)) if (tid === teacherId) delete state.teacherCodes[c];
  const code = newCode(state);
  state.teacherCodes[code] = teacherId;
  return { ok: true, code: formatCode(code) };
}

const csv = (v: string) => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function exportCodes(state: GardenState): string {
  const lines = ['code,role,teacher,status,label'];
  for (const [code, st] of Object.entries(state.studentCodes)) {
    lines.push([formatCode(code), 'student', '', st.plantingId !== null ? 'USED' : 'UNUSED', csv(st.label ?? '')].join(','));
  }
  for (const [code, tid] of Object.entries(state.teacherCodes)) {
    const t = state.teachers.find((x) => x.id === tid);
    lines.push([formatCode(code), t?.isDirector ? 'director' : 'teacher', csv(t ? fullName(t) : ''), '-', ''].join(','));
  }
  return lines.join('\n');
}
