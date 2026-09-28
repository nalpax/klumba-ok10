import { createArchiveApi } from './archive';
import { createDemoApi } from './demo';
import { createLiveApi } from './live';
import type { Api } from './types';

let instance: Api | null = null;

/**
 * Возвращает «бэкенд» сайта:
 * - настоящий сервер (app/api) — обычный режим;
 * - демо в памяти браузера — только в сборке с NEXT_PUBLIC_DEMO=1 (статический предпросмотр)
 *   или при локальной разработке с ?demo в адресе; на настоящем сайте демо включить нельзя;
 * - архив только для просмотра — сборка с NEXT_PUBLIC_ARCHIVE=1 (npm run archive:build).
 * ?static в демо отключает «посторонних» посадчиков (удобно для проверки).
 */
export function getApi(): Api {
  if (!instance) {
    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
    const devDemo = process.env.NODE_ENV !== 'production' && params.has('demo');
    if (process.env.NEXT_PUBLIC_ARCHIVE === '1') instance = createArchiveApi();
    else if (process.env.NEXT_PUBLIC_DEMO === '1' || devDemo) instance = createDemoApi({ simulateOthers: !params.has('static') });
    else instance = createLiveApi();
  }
  return instance;
}

export * from './types';
