import { normalizeWord } from '@/lib/codes';
import * as engine from '@/lib/core/engine';
import { DEMO_STUDENT_CODES, DEMO_TEACHER_CODES, demoState } from '@/lib/core/demoSeed';
import { FLOWERS } from '@/lib/garden/catalog';
import { FLOWER_COLORS } from '@/lib/garden/palette';
import { mulberry32 } from '@/lib/garden/rng';
import type { Planting } from '@/lib/garden/types';
import { fullName } from '@/lib/names';
import type { Api, GardenSnapshot } from './types';

/**
 * Слово администратора в демо. Демо — только для предпросмотра: здесь всё хранится в памяти
 * браузера, и слово видно в исходниках. На настоящем сайте пароль задаётся на сервере
 * (переменная ADMIN_PASSWORD) и в браузер не попадает.
 */
export const DEMO_ADMIN_WORD = 'ПОДСОЛНУХ';

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Демо-«сервер» в памяти браузера: те же правила (lib/core/engine.ts), что и на настоящем сервере. */
export function createDemoApi(options: { simulateOthers?: boolean } = {}): Api {
  const { simulateOthers = true } = options;
  const state = demoState();
  const listeners = new Set<(p: Planting) => void>();
  const metaListeners = new Set<() => void>();
  const rnd = mulberry32(777);
  let timer: ReturnType<typeof setInterval> | null = null;

  const publishMeta = () => {
    for (const l of metaListeners) l();
  };

  // «другие ученики» в демо иногда сажают цветы
  const addRandomPlanting = () => {
    if (state.status !== 'open') return;
    const free = engine.freeSlots(state);
    if (free.length === 0 || state.teachers.length === 0) return;
    const slot = free[Math.floor(rnd() * free.length)];
    const t = state.teachers[Math.floor(rnd() * state.teachers.length)];
    const p: Planting = {
      id: state.nextPlantingId++,
      teacherId: t.id,
      flowerId: t.flowerIds[Math.floor(rnd() * t.flowerIds.length)] ?? FLOWERS[0].id,
      color: FLOWER_COLORS[Math.floor(rnd() * FLOWER_COLORS.length)].hex,
      slotId: slot.id,
      x: slot.x,
      y: slot.y,
      scale: slot.scale,
      rotation: slot.rotation,
      variant: slot.variant,
      createdAt: Date.now(),
    };
    state.plantings.push(p);
    for (const l of listeners) l(p);
  };

  const teacherName = (i: number) => {
    const t = state.teachers[i];
    return t ? fullName(t) : '';
  };

  return {
    mode: 'demo',
    demoCodes: {
      students: DEMO_STUDENT_CODES,
      teachers: DEMO_TEACHER_CODES.slice(0, 3).map((code, i) => ({ code, name: teacherName(i) })),
      admin: DEMO_ADMIN_WORD,
    },

    async load(): Promise<GardenSnapshot> {
      await wait(120);
      return engine.snapshot(state);
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
      return () => {
        metaListeners.delete(onChange);
      };
    },

    async restoreAdmin(token) {
      return token === 'demo-admin';
    },
    async adminLogout() {},

    async freeSlots() {
      await wait(150);
      return engine.freeSlots(state);
    },

    async login(raw) {
      await wait(350);
      if (normalizeWord(raw) === normalizeWord(DEMO_ADMIN_WORD)) return { ok: true, role: 'admin', token: 'demo-admin' };
      return engine.login(state, raw);
    },

    async plant(input) {
      await wait(450);
      const res = engine.plant(state, input);
      if (res.ok) for (const l of listeners) l(res.planting);
      return res;
    },

    async openCard(code) {
      await wait(400);
      return engine.openCard(state, code);
    },

    async adminStats() {
      await wait(150);
      return engine.adminStats(state);
    },
    async adminSetStatus(status) {
      await wait(200);
      const res = engine.setStatus(state, status);
      publishMeta();
      return res;
    },
    async adminSetClosing(closing) {
      await wait(200);
      const res = engine.setClosing(state, closing);
      if (res.ok) publishMeta();
      return res;
    },
    async adminListTeachers() {
      await wait(120);
      return engine.listTeachers(state);
    },
    async adminSaveTeacher(input) {
      await wait(250);
      const res = engine.saveTeacher(state, input);
      if (res.ok) publishMeta();
      return res;
    },
    async adminDeleteTeacher(id) {
      await wait(250);
      const res = engine.deleteTeacher(state, id);
      if (res.ok) publishMeta();
      return res;
    },
    async adminGenerateStudentCodes(count, label) {
      await wait(300);
      return engine.generateStudentCodes(state, count, label);
    },
    async adminGenerateTeacherCode(teacherId) {
      await wait(200);
      return engine.generateTeacherCode(state, teacherId);
    },
    async adminExportCodes() {
      await wait(200);
      return engine.exportCodes(state);
    },
  };
}
