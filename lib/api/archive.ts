import type { Api, ApiError, GardenSnapshot } from './types';

/**
 * Архив клумбы: сайт только для просмотра, без сервера. Данные — файл archive.json рядом со страницей
 * (его скачивают в админке кнопкой «Скачать архив клумбы» после праздника). В архиве нет ни кодов,
 * ни личных пожеланий — только учителя, цветы и тексты. Войти, посадить цветок или открыть админку нельзя.
 */
export function createArchiveApi(url = 'archive.json'): Api {
  let cached: Promise<GardenSnapshot> | null = null;
  const closed = async () => ({ ok: false as const, error: 'closed' as ApiError });
  const forbidden = () => Promise.reject(new Error('forbidden'));

  return {
    mode: 'archive',
    load() {
      if (!cached) {
        cached = fetch(url, { cache: 'no-cache' })
          .then((r) => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.json() as Promise<GardenSnapshot>;
          })
          .then((snap) => ({ ...snap, status: 'closed' as const }))
          .catch((e) => {
            cached = null;
            throw e;
          });
      }
      return cached;
    },
    subscribe: () => () => {},
    subscribeMeta: () => () => {},
    freeSlots: async () => [],
    login: closed,
    plant: closed,
    openCard: closed,
    restoreAdmin: async () => false,
    adminLogout: async () => {},
    adminStats: forbidden,
    adminSetStatus: closed,
    adminSetClosing: closed,
    adminListTeachers: forbidden,
    adminSaveTeacher: closed,
    adminDeleteTeacher: closed,
    adminGenerateStudentCodes: closed,
    adminGenerateTeacherCode: closed,
    adminExportCodes: forbidden,
  };
}
