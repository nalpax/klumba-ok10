import { createDemoApi } from './demo';
import type { Api } from './types';

let instance: Api | null = null;

/**
 * Возвращает «бэкенд» сайта. Сейчас всегда демо; на этапе Realtime здесь появится
 * выбор по NEXT_PUBLIC_SUPABASE_URL: если задан — реальная база, иначе демо.
 * ?static в адресе отключает «посторонних» посадчиков в демо (удобно для проверки).
 */
export function getApi(): Api {
  if (!instance) {
    const simulate = typeof window !== 'undefined' && !new URLSearchParams(window.location.search).has('static');
    instance = createDemoApi({ simulateOthers: simulate });
  }
  return instance;
}

export * from './types';
