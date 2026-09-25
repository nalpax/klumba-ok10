import { createDemoApi } from './demo';
import { createLiveApi } from './live';
import type { Api } from './types';

let instance: Api | null = null;

/**
 * Возвращает «бэкенд» сайта.
 * Обычно — настоящий сервер (app/api). Демо в памяти браузера включается сборкой
 * с NEXT_PUBLIC_DEMO=1 (так собирается статический предпросмотр) или адресом с ?demo.
 * ?static в демо отключает «посторонних» посадчиков (удобно для проверки).
 */
export function getApi(): Api {
  if (!instance) {
    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
    const demo = process.env.NEXT_PUBLIC_DEMO === '1' || params.has('demo');
    instance = demo ? createDemoApi({ simulateOthers: !params.has('static') }) : createLiveApi();
  }
  return instance;
}

export * from './types';
