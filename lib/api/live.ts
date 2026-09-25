import type { Planting, Slot } from '@/lib/garden/types';
import type { Api, ApiError, GardenSnapshot } from './types';

const POLL_MS = 4000;

class HttpError extends Error {
  constructor(public status: number) {
    super(`HTTP ${status}`);
  }
}

/**
 * Клиент настоящего сервера (app/api/[action]/route.ts).
 * Новые цветы и изменения из админки приходят опросом раз в 4 секунды (только когда вкладка
 * открыта): 100 человек — 25 маленьких запросов в секунду, для сервера это ничто, зато
 * работает через любые прокси, школьные фильтры и мобильный интернет.
 */
export function createLiveApi(base = ''): Api {
  let adminToken: string | null = null;
  let lastId = 0;
  let version = 0;
  const listeners = new Set<(p: Planting) => void>();
  const metaListeners = new Set<() => void>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let polling = false;
  let inflight: Promise<GardenSnapshot> | null = null;

  async function get<T>(action: string, query = ''): Promise<T> {
    const res = await fetch(`${base}/api/${action}${query}`, { cache: 'no-store' });
    if (!res.ok) throw new HttpError(res.status);
    return res.json() as Promise<T>;
  }

  async function post<T>(action: string, body: unknown, admin = false): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (admin && adminToken) headers.Authorization = `Bearer ${adminToken}`;
    const res = await fetch(`${base}/api/${action}`, { method: 'POST', headers, body: JSON.stringify(body ?? {}) });
    if (res.status === 401) return { ok: false, error: 'unauthorized' as ApiError } as T;
    if (!res.ok && res.status !== 400) throw new HttpError(res.status);
    return res.json() as Promise<T>;
  }

  /** Для запросов админки, которые возвращают данные без обёртки { ok }. */
  async function adminGet<T>(action: string): Promise<T> {
    const res = await post<T | { ok: false; error: ApiError }>(action, {}, true);
    if (res && typeof res === 'object' && 'ok' in res && res.ok === false) throw new Error(res.error);
    return res as T;
  }

  const trackPlantings = (list: Planting[]) => {
    for (const p of list) if (p.id > lastId) lastId = p.id;
  };

  async function poll() {
    timer = null;
    if (listeners.size + metaListeners.size === 0) return;
    if (typeof document !== 'undefined' && document.hidden) return; // продолжим при возвращении на вкладку
    try {
      const upd = await get<{ version: number; plantings: Planting[] }>('updates', `?after=${lastId}`);
      if (upd.plantings.length) {
        trackPlantings(upd.plantings);
        for (const p of upd.plantings) for (const l of listeners) l(p);
      }
      if (version && upd.version !== version) {
        version = upd.version;
        for (const l of metaListeners) l();
      }
      version = upd.version;
    } catch {
      /* нет связи — просто попробуем в следующий раз */
    }
    schedule();
  }

  function schedule(delay = POLL_MS) {
    if (timer || polling === false) return;
    timer = setTimeout(poll, delay);
  }

  function startPolling() {
    if (polling) return;
    polling = true;
    schedule();
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && !timer) schedule(50);
      });
    }
  }

  return {
    mode: 'live',

    load(): Promise<GardenSnapshot> {
      // несколько частей страницы просят снимок одновременно — отправляем один запрос на всех
      if (!inflight) {
        inflight = get<GardenSnapshot>('garden')
          .then((snap) => {
            trackPlantings(snap.plantings);
            version = snap.version;
            return snap;
          })
          .finally(() => {
            inflight = null;
          });
      }
      return inflight;
    },

    subscribe(onPlanting) {
      listeners.add(onPlanting);
      startPolling();
      return () => {
        listeners.delete(onPlanting);
      };
    },

    subscribeMeta(onChange) {
      metaListeners.add(onChange);
      startPolling();
      return () => {
        metaListeners.delete(onChange);
      };
    },

    freeSlots: () => get<Slot[]>('slots'),

    async login(code) {
      const res = await post<Awaited<ReturnType<Api['login']>>>('login', { code });
      if (res.ok && res.role === 'admin') adminToken = res.token;
      return res;
    },

    async restoreAdmin(token) {
      adminToken = token;
      try {
        const res = await post<{ ok: boolean }>('admin-check', {}, true);
        if (!res.ok) adminToken = null;
        return res.ok;
      } catch {
        return false;
      }
    },

    async adminLogout() {
      adminToken = null;
    },

    async plant(input) {
      const res = await post<Awaited<ReturnType<Api['plant']>>>('plant', input);
      if (res.ok) trackPlantings([res.planting]);
      return res;
    },

    openCard: (code) => post('card', { code }),

    adminStats: () => adminGet('admin-stats'),
    adminSetStatus: (status) => post('admin-status', { status }, true),
    adminSetClosing: (closing) => post('admin-closing', { closing }, true),
    adminListTeachers: () => adminGet('admin-teachers'),
    adminSaveTeacher: (teacher) => post('admin-save-teacher', { teacher }, true),
    adminDeleteTeacher: (id) => post('admin-delete-teacher', { id }, true),
    adminGenerateStudentCodes: (count, label) => post('admin-student-codes', { count, label }, true),
    adminGenerateTeacherCode: (teacherId) => post('admin-teacher-code', { teacherId }, true),
    async adminExportCodes() {
      const res = await post<{ ok: boolean; csv?: string; error?: ApiError }>('admin-export', {}, true);
      if (!res.ok || res.csv === undefined) throw new Error(res.error ?? 'network');
      return res.csv;
    },
  };
}
